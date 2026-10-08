import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AUTH_COPY, validateEmail, validatePassword, normalizeEmail, type AuthErrorCode, type AuthResponse } from '@tudobem/shared';
import type { GoogleOAuthConfig, GoogleTokenPayload } from './googleAuth.js';
import { verifyGoogleIdToken } from './googleAuth.js';
import { ADMIN_WRONG_PASSWORD, adminPasswordMatches, type AdminAuthConfig } from './adminAuth.js';
import { accountsFileAdapter } from './fileStore.js';
import type { OpsSmokeConfig } from './opsSmoke.js';
import type { AccountLink } from './world.js';

export interface Account {
  id: string;
  email: string;
  /** `scrypt$N$r$p$salt$hash` (base64url). Never the password. Google-only accounts still get an unguessable hash. */
  passwordHash: string;
  /** Google `sub` when the player signed in with GIS at least once. */
  googleSub?: string;
  profileId?: string;
  /** When the player ticked the optional “Tenho 18 anos ou mais” box at signup. Absent if left unticked. */
  confirmed18At?: number;
  createdAt: number;
  lastLoginAt?: number;
}

interface StoredSession {
  /** sha256 of the cookie value, so a leaked database can't be replayed as cookies. */
  hash: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
}

export interface AccountsData {
  version: 1;
  accounts: Account[];
  sessions: StoredSession[];
}

export interface AccountPersistence {
  load(): AccountsData | null;
  save(data: AccountsData): void;
}

export { accountsFileAdapter };

// ---------------------------------------------------------------- passwords

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** OWASP scrypt profile that fits a 256 MB Fly VM: ~16 MB per hash (128·N·r), cost spread over p. */
export const SCRYPT_DEFAULT: ScryptParams = { N: 2 ** 14, r: 8, p: 5 };
const KEYLEN = 32;

function scrypt(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, KEYLEN, { ...params, maxmem: 256 * params.N * params.r + 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string, params: ScryptParams = SCRYPT_DEFAULT): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (![params.N, params.r, params.p].every((v) => Number.isInteger(v) && v > 0)) return false;
  const expected = Buffer.from(hash, 'base64url');
  const got = await scrypt(password, Buffer.from(salt, 'base64url'), params);
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

// ---------------------------------------------------------------- rate limiting

/** Sliding-window failure counter (in memory; one Fly machine). */
export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private max: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  blocked(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  hit(key: string) {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune();
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private recent(key: string) {
    const cutoff = this.now() - this.windowMs;
    return (this.hits.get(key) ?? []).filter((t) => t > cutoff);
  }

  private prune() {
    for (const k of [...this.hits.keys()]) if (!this.recent(k).length) this.hits.delete(k);
  }
}

// ---------------------------------------------------------------- store

export type AuthResult = { ok: true; account: Account } | { ok: false; code: AuthErrorCode; pt: string; en: string };

export interface AccountStoreOptions {
  now?: () => number;
  sessionTtlMs?: number;
  scrypt?: ScryptParams;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const SESSION_REFRESH_MS = 24 * 60 * 60_000;

function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

export class AccountStore implements AccountLink {
  private byId = new Map<string, Account>();
  private byEmail = new Map<string, string>();
  private sessions = new Map<string, StoredSession>();
  private readonly now: () => number;
  readonly sessionTtlMs: number;
  private readonly params: ScryptParams;
  private dummyHash: Promise<string> | null = null;

  constructor(
    private adapter: AccountPersistence | null,
    opts: AccountStoreOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.sessionTtlMs = opts.sessionTtlMs ?? SESSION_TTL_MS;
    this.params = opts.scrypt ?? SCRYPT_DEFAULT;
    const data = adapter?.load();
    if (!data) return;
    for (const a of data.accounts ?? []) {
      this.byId.set(a.id, a);
      this.byEmail.set(a.email, a.id);
    }
    const t = this.now();
    for (const s of data.sessions ?? []) if (s.expiresAt > t && this.byId.has(s.accountId)) this.sessions.set(s.hash, s);
    console.log(`[auth] ${this.byId.size} contas carregadas`);
  }

  count() {
    return this.byId.size;
  }

  get(id: string) {
    return this.byId.get(id);
  }

  async register(emailRaw: string, password: string, confirm18: boolean): Promise<AuthResult> {
    const email = validateEmail(emailRaw);
    if (!email.ok) return { ok: false, code: 'email', ...email.reason };
    const pw = validatePassword(password);
    if (!pw.ok) return { ok: false, code: 'password', ...pw.reason };
    if (this.byEmail.has(email.value)) return { ok: false, code: 'taken', ...AUTH_COPY.taken };
    const passwordHash = await hashPassword(pw.value, this.params);
    // Two racing signups for one email: the first one to finish hashing wins.
    if (this.byEmail.has(email.value)) return { ok: false, code: 'taken', ...AUTH_COPY.taken };
    const t = this.now();
    const account: Account = { id: crypto.randomUUID(), email: email.value, passwordHash, createdAt: t, lastLoginAt: t, ...(confirm18 === true ? { confirmed18At: t } : {}) };
    this.byId.set(account.id, account);
    this.byEmail.set(account.email, account.id);
    this.save();
    return { ok: true, account };
  }

  /**
   * Sign in (or register) from a verified Google ID token. Links `googleSub` on an existing email account when safe.
   */
  async loginWithGoogle(payload: GoogleTokenPayload): Promise<AuthResult> {
    const email = validateEmail(payload.email);
    if (!email.ok) return { ok: false, code: 'email', ...email.reason };
    const bySub = [...this.byId.values()].find((a) => a.googleSub === payload.sub);
    if (bySub) {
      bySub.lastLoginAt = this.now();
      this.save();
      return { ok: true, account: bySub };
    }
    const existing = this.byId.get(this.byEmail.get(email.value) ?? '');
    if (existing) {
      if (existing.googleSub && existing.googleSub !== payload.sub) {
        return { ok: false, code: 'google', ...AUTH_COPY.googleEmail };
      }
      if (!existing.googleSub) existing.googleSub = payload.sub;
      existing.lastLoginAt = this.now();
      this.save();
      return { ok: true, account: existing };
    }
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('base64url'), this.params);
    const t = this.now();
    const account: Account = { id: crypto.randomUUID(), email: email.value, passwordHash, googleSub: payload.sub, createdAt: t, lastLoginAt: t };
    this.byId.set(account.id, account);
    this.byEmail.set(account.email, account.id);
    this.save();
    return { ok: true, account };
  }

  async login(emailRaw: string, password: string): Promise<AuthResult> {
    const fail: AuthResult = { ok: false, code: 'credentials', ...AUTH_COPY.credentials };
    if (typeof password !== 'string' || !password || password.length > 1024) return fail;
    const account = this.byId.get(this.byEmail.get(normalizeEmail(emailRaw)) ?? '');
    if (!account) {
      // Same scrypt cost as a real check so response time doesn't reveal which emails exist.
      this.dummyHash ??= hashPassword('tudo-bem-dummy-password', this.params);
      await verifyPassword(password, await this.dummyHash);
      return fail;
    }
    if (!(await verifyPassword(password, account.passwordHash))) return fail;
    account.lastLoginAt = this.now();
    this.save();
    return { ok: true, account };
  }

  /** Returns the raw cookie value. Only its hash is stored. */
  createSession(accountId: string): string {
    const raw = crypto.randomBytes(32).toString('base64url');
    const t = this.now();
    this.sessions.set(sha256(raw), { hash: sha256(raw), accountId, createdAt: t, expiresAt: t + this.sessionTtlMs });
    this.save();
    return raw;
  }

  /** Resolve a cookie value. Sliding expiry: an active session is pushed forward at most once a day. */
  accountForSession(raw: string | undefined): Account | undefined {
    if (!raw) return undefined;
    const s = this.sessions.get(sha256(raw));
    if (!s) return undefined;
    const t = this.now();
    if (s.expiresAt <= t) {
      this.sessions.delete(s.hash);
      this.save();
      return undefined;
    }
    if (t + this.sessionTtlMs - s.expiresAt > SESSION_REFRESH_MS) {
      s.expiresAt = t + this.sessionTtlMs;
      this.save();
    }
    return this.byId.get(s.accountId);
  }

  revokeSession(raw: string | undefined): Account | undefined {
    if (!raw) return undefined;
    const s = this.sessions.get(sha256(raw));
    if (!s) return undefined;
    this.sessions.delete(s.hash);
    this.save();
    return this.byId.get(s.accountId);
  }

  profileIdFor(accountId: string) {
    return this.byId.get(accountId)?.profileId;
  }

  /** Profile linked to this email, if the account exists and has finished the avatar creator. */
  profileIdForEmail(email: string): string | undefined {
    return this.byId.get(this.byEmail.get(normalizeEmail(email)) ?? '')?.profileId;
  }

  linkProfile(accountId: string, profileId: string) {
    const a = this.byId.get(accountId);
    if (!a) return;
    a.profileId = profileId;
    this.save();
  }

  private smokeEnsure = new Map<string, Promise<Account>>();

  /**
   * A brand-new Ops smoke account with no profile, so the plane intro runs.
   * The stable `ops-smoke@tudobem.dev` account is unchanged.
   */
  async createFreshSmokeAccount(password: string): Promise<Account> {
    const email = `ops-new-${crypto.randomUUID()}@tudobem.dev`;
    return this.ensureSmokeAccount(email, password);
  }

  /** Idempotent seed for Ops smoke (`ops-smoke@tudobem.dev`). Updates the hash when the env password rotates. */
  async ensureSmokeAccount(emailRaw: string, password: string): Promise<Account> {
    const email = normalizeEmail(emailRaw);
    let pending = this.smokeEnsure.get(email);
    if (!pending) {
      pending = this.ensureSmokeAccountOnce(email, password).finally(() => this.smokeEnsure.delete(email));
      this.smokeEnsure.set(email, pending);
    }
    return pending;
  }

  private async ensureSmokeAccountOnce(email: string, password: string): Promise<Account> {
    const existing = this.byId.get(this.byEmail.get(email) ?? '');
    const t = this.now();
    if (existing) {
      if (!(await verifyPassword(password, existing.passwordHash))) {
        const pw = validatePassword(password);
        if (!pw.ok) throw new Error(pw.reason.en);
        existing.passwordHash = await hashPassword(pw.value, this.params);
      }
      existing.lastLoginAt = t;
      this.save();
      return existing;
    }
    const pw = validatePassword(password);
    if (!pw.ok) throw new Error(pw.reason.en);
    const passwordHash = await hashPassword(pw.value, this.params);
    const account: Account = { id: crypto.randomUUID(), email, passwordHash, createdAt: t, lastLoginAt: t };
    this.byId.set(account.id, account);
    this.byEmail.set(account.email, account.id);
    this.save();
    return account;
  }

  private save() {
    if (!this.adapter) return;
    const t = this.now();
    for (const [h, s] of this.sessions) if (s.expiresAt <= t) this.sessions.delete(h);
    this.adapter.save({ version: 1, accounts: [...this.byId.values()], sessions: [...this.sessions.values()] });
  }
}

// ---------------------------------------------------------------- HTTP

export const SESSION_COOKIE = 'tb_session';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* malformed cookie — ignore */
    }
  }
  return out;
}

export function sessionCookieOf(req: IncomingMessage): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

export type CookieSecure = boolean | 'auto';

function isHttps(req: IncomingMessage, mode: CookieSecure) {
  if (mode !== 'auto') return mode;
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0]?.trim();
  return proto === 'https' || !!(req.socket as { encrypted?: boolean }).encrypted;
}

function cookie(value: string, maxAgeSec: number, secure: boolean) {
  return [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`, secure ? 'Secure' : ''].filter(Boolean).join('; ');
}

/**
 * Browsers always send Origin on WebSocket upgrades and fetch POSTs. A cookie-bearing request from
 * another site is refused (CSRF / cross-site WebSocket hijacking). Non-browser clients send none.
 */
export function originAllowed(req: IncomingMessage, allowed: readonly string[] = []): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function clientIp(req: IncomingMessage): string {
  const fly = req.headers['fly-client-ip'];
  if (typeof fly === 'string' && fly) return fly;
  return req.socket.remoteAddress ?? 'unknown';
}

export interface AuthApiDeps {
  accounts: AccountStore;
  cookieSecure?: CookieSecure;
  allowedOrigins?: readonly string[];
  /** Close live sockets of an account that just logged out. */
  onLogout?: (accountId: string) => void;
  limiters: AuthLimiters;
  opsSmoke?: OpsSmokeConfig;
  /** Same secret as the hidden admin panel (`TB_ADMIN_PASSWORD`). */
  adminAuth?: AdminAuthConfig;
  googleOAuth?: GoogleOAuthConfig;
  /** Test hook: skip network JWKS verification. */
  verifyGoogleIdToken?: (token: string, clientId: string) => Promise<GoogleTokenPayload | null>;
}

export interface AuthLimiters {
  /** Failed logins per email. */
  login: AttemptLimiter;
  /** Failed logins per client IP. */
  ip: AttemptLimiter;
  /** New accounts per client IP. */
  signup: AttemptLimiter;
}

export function defaultLimiters(now: () => number = Date.now): AuthLimiters {
  return {
    login: new AttemptLimiter(8, 15 * 60_000, now),
    ip: new AttemptLimiter(40, 15 * 60_000, now),
    signup: new AttemptLimiter(10, 60 * 60_000, now),
  };
}

const MAX_BODY = 8 * 1024;

function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function send(res: ServerResponse, status: number, body: AuthResponse, setCookie?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (setCookie) headers['set-cookie'] = setCookie;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const fail = (code: AuthErrorCode, copy: { pt: string; en: string }): AuthResponse => ({ ok: false, code, ...copy });
const okBody = (a: Account): AuthResponse => ({ ok: true, account: { email: a.email, hasProfile: !!a.profileId } });

type AdminGateFail = { ok: false; status: number; body: AuthResponse };

function verifyAdminGate(
  admin: AdminAuthConfig | undefined,
  limiters: AuthLimiters,
  ip: string,
  adminPassword: string,
): { ok: true } | AdminGateFail {
  if (!admin?.ready || !admin.password) {
    return { ok: false, status: 403, body: fail('bad_request', AUTH_COPY.badRequest) };
  }
  if (limiters.ip.blocked(ip)) {
    return { ok: false, status: 429, body: fail('rate', AUTH_COPY.rate) };
  }
  if (!adminPassword || !adminPasswordMatches(adminPassword, admin.password)) {
    limiters.ip.hit(ip);
    return { ok: false, status: 401, body: fail('credentials', ADMIN_WRONG_PASSWORD) };
  }
  return { ok: true };
}

/** POST /api/auth/register · POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me */
export async function handleAuthApi(req: IncomingMessage, res: ServerResponse, deps: AuthApiDeps): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x');
  const action = url.pathname.replace(/^\/api\/auth\/?/, '');
  const secure = isHttps(req, deps.cookieSecure ?? 'auto');
  const maxAge = Math.floor(deps.accounts.sessionTtlMs / 1000);
  const { accounts, limiters } = deps;

  if (action === 'me' && req.method === 'GET') {
    const raw = sessionCookieOf(req);
    const account = accounts.accountForSession(raw);
    // Signed out is a normal state for this probe, so 200 (a 401 would log a console error for every new visitor).
    if (!account) return send(res, 200, fail('unauthenticated', AUTH_COPY.unauthenticated), raw ? cookie('', 0, secure) : undefined);
    return send(res, 200, okBody(account), cookie(raw!, maxAge, secure));
  }

  if (action === 'admin-gate' && req.method === 'POST') {
    if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
      return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
    }
    const body = await readJson(req);
    const adminPassword = typeof body?.adminPassword === 'string' ? body.adminPassword : '';
    const gate = verifyAdminGate(deps.adminAuth, limiters, clientIp(req), adminPassword);
    if (!gate.ok) return send(res, gate.status, gate.body);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (action === 'ops-smoke' && req.method === 'POST') {
    if (!deps.opsSmoke?.ready || !deps.opsSmoke.password) {
      return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
    }
    if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
      return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
    }
    const body = await readJson(req);
    const adminPassword = typeof body?.adminPassword === 'string' ? body.adminPassword : '';
    const gate = verifyAdminGate(deps.adminAuth, limiters, clientIp(req), adminPassword);
    if (!gate.ok) return send(res, gate.status, gate.body);
    const account = await accounts.ensureSmokeAccount(deps.opsSmoke.email, deps.opsSmoke.password);
    return send(res, 200, okBody(account), cookie(accounts.createSession(account.id), maxAge, secure));
  }

  if (action === 'ops-smoke-new' && req.method === 'POST') {
    if (!deps.opsSmoke?.ready || !deps.opsSmoke.password) {
      return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
    }
    if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
      return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
    }
    const body = await readJson(req);
    const adminPassword = typeof body?.adminPassword === 'string' ? body.adminPassword : '';
    const ip = clientIp(req);
    const gate = verifyAdminGate(deps.adminAuth, limiters, ip, adminPassword);
    if (!gate.ok) return send(res, gate.status, gate.body);
    if (limiters.signup.blocked(ip)) return send(res, 429, fail('rate', AUTH_COPY.rate));
    const account = await accounts.createFreshSmokeAccount(deps.opsSmoke.password);
    limiters.signup.hit(ip);
    return send(res, 200, okBody(account), cookie(accounts.createSession(account.id), maxAge, secure));
  }

  if (action === 'google' && req.method === 'POST') {
    if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
      return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
    }
    const cfg = deps.googleOAuth;
    if (!cfg?.ready) return send(res, 503, fail('google', AUTH_COPY.googleDisabled));
    const body = await readJson(req);
    const credential = typeof body?.credential === 'string' ? body.credential : '';
    const ip = clientIp(req);
    if (limiters.ip.blocked(ip)) return send(res, 429, fail('rate', AUTH_COPY.rate));
    const verify = deps.verifyGoogleIdToken ?? verifyGoogleIdToken;
    const payload = await verify(credential, cfg.clientId);
    if (!payload) {
      limiters.ip.hit(ip);
      return send(res, 401, fail('google', AUTH_COPY.googleInvalid));
    }
    const r = await accounts.loginWithGoogle(payload);
    if (!r.ok) return send(res, r.code === 'google' ? 409 : 400, fail(r.code, r));
    limiters.ip.reset(ip);
    return send(res, 200, okBody(r.account), cookie(accounts.createSession(r.account.id), maxAge, secure));
  }

  if (req.method !== 'POST' || !['register', 'login', 'logout'].includes(action)) {
    return send(res, 404, fail('bad_request', AUTH_COPY.badRequest));
  }
  // JSON-only + same-origin: a cross-site <form> can't produce either, so no CSRF token is needed.
  if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
    return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
  }

  if (action === 'logout') {
    const account = accounts.revokeSession(sessionCookieOf(req));
    if (account) deps.onLogout?.(account.id);
    return send(res, 200, { ok: true, account: null }, cookie('', 0, secure));
  }

  const body = await readJson(req);
  if (!body) return send(res, 400, fail('bad_request', AUTH_COPY.badRequest));
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const ip = clientIp(req);

  if (action === 'register') {
    if (limiters.signup.blocked(ip)) return send(res, 429, fail('rate', AUTH_COPY.rate));
    const r = await accounts.register(email, password, body.confirm18 === true);
    if (!r.ok) return send(res, r.code === 'taken' ? 409 : 400, fail(r.code, r));
    limiters.signup.hit(ip);
    return send(res, 201, okBody(r.account), cookie(accounts.createSession(r.account.id), maxAge, secure));
  }

  const key = normalizeEmail(email);
  if (limiters.login.blocked(key) || limiters.ip.blocked(ip)) return send(res, 429, fail('rate', AUTH_COPY.rate));
  const r = await accounts.login(email, password);
  if (!r.ok) {
    limiters.login.hit(key);
    limiters.ip.hit(ip);
    return send(res, 401, fail(r.code, r));
  }
  limiters.login.reset(key);
  return send(res, 200, okBody(r.account), cookie(accounts.createSession(r.account.id), maxAge, secure));
}
