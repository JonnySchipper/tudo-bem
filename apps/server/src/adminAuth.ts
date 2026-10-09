/**
 * Hidden admin mode (credits easter egg). Password is server-side only (`TB_ADMIN_PASSWORD`).
 * Local / non-production builds fall back to `ADMIN_DEV_PASSWORD` when the env is unset.
 */
import crypto from 'node:crypto';
import { validatePassword } from '@tudobem/shared';
import { readEnv } from './env.js';
import { AttemptLimiter } from './attemptLimiter.js';

/** Local-only default when `TB_ADMIN_PASSWORD` is unset. Never used in production. */
export const ADMIN_DEV_PASSWORD = 'tb-admin-praca';

/** Cap on a single admin money grant (RV). */
export const ADMIN_MONEY_MAX = 500;

export const ADMIN_WRONG_PASSWORD = { pt: 'Senha incorreta.', en: 'Wrong password.' };

/** Constant-time compare for the admin secret (same check as feedback review and Ops smoke). */
export function adminPasswordMatches(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export interface AdminAuthConfig {
  /** Admin login is accepted on this world. */
  ready: boolean;
  password?: string;
}

/** Resolve admin password from an env map (tests) or `readEnv` (server / solo). */
export function readAdminAuthConfig(env?: Record<string, string | undefined>): AdminAuthConfig {
  const pick = (name: string) => (env ? env[name] : readEnv(name));
  const fromEnv = pick('TB_ADMIN_PASSWORD')?.trim();
  if (fromEnv) {
    const pw = validatePassword(fromEnv);
    if (!pw.ok) return { ready: false };
    return { ready: true, password: pw.value };
  }

  if (pick('NODE_ENV') === 'production') return { ready: false };
  return { ready: true, password: ADMIN_DEV_PASSWORD };
}

/** Wrong admin passwords allowed per key (IP, account, socket) in the window before it locks. */
export const ADMIN_LOGIN_MAX = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60_000;

export const ADMIN_TOO_MANY = {
  pt: 'Muitas tentativas de senha. Espere 15 minutos.',
  en: 'Too many password attempts. Wait 15 minutes.',
};

/**
 * Throttle for the admin secret. The WebSocket admin login, `GET /api/feedback` and the admin deletion
 * endpoint share one instance (app.ts), keyed by client IP plus account / socket where known. Any locked
 * key blocks the attempt, and wrong guesses are logged.
 */
export class AdminLoginGuard {
  private readonly limiter: AttemptLimiter;
  constructor(max = ADMIN_LOGIN_MAX, windowMs = ADMIN_LOGIN_WINDOW_MS, now: () => number = Date.now) {
    this.limiter = new AttemptLimiter(max, windowMs, now);
  }

  /** Keys for one caller. Missing parts are skipped. */
  static keys(parts: { ip?: string; accountId?: string; socket?: string }): string[] {
    const out: string[] = [];
    if (parts.ip) out.push(`ip:${parts.ip}`);
    if (parts.accountId) out.push(`acct:${parts.accountId}`);
    if (parts.socket) out.push(`ws:${parts.socket}`);
    return out.length ? out : ['anon'];
  }

  blocked(keys: string[]): boolean {
    return keys.some((k) => this.limiter.blocked(k));
  }

  /** Check one password attempt. 'blocked' means it was not compared. A wrong guess counts against every key. */
  attempt(keys: string[], given: string, expected: string, where: string): 'ok' | 'wrong' | 'blocked' {
    if (this.blocked(keys)) {
      console.warn(`[admin] ${where}: locked out (${keys.join(' ')})`);
      return 'blocked';
    }
    if (given && adminPasswordMatches(given, expected)) return 'ok';
    for (const k of keys) this.limiter.hit(k);
    console.warn(`[admin] ${where}: wrong password (${keys.join(' ')})`);
    return 'wrong';
  }
}
