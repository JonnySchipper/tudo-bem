import { OPS_SMOKE_EMAIL, validateEmail, validatePassword } from '@tudobem/shared';
import type { AuthCredentials, AuthResponse, AuthSession } from './types';
import { clearAuthSession, writeAuthSession } from './session';

const AUTH_BASE = '/api/auth';

async function postJson(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${AUTH_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** Same rules as the server (shared validators), for register and login alike, so no valid shape passes one and fails the other. */
function validateCredentials({ email, password }: AuthCredentials): AuthResponse | null {
  const e = validateEmail(email);
  if (!e.ok) return { ok: false, ...e.reason, code: 'email' };
  const p = validatePassword(password);
  if (!p.ok) return { ok: false, ...p.reason, code: 'password' };
  return null;
}

export interface AuthCallOptions {
  /**
   * Solo / static builds have no auth server, so a local stub session stands in. Off by default: on the
   * multiplayer server a missing or failing API must be an error, never a pretend sign-in.
   */
  offlineStub?: boolean;
}

const OFFLINE: AuthResponse = { ok: false, pt: 'Sem conexão com a Praça. Tenta de novo em instantes.', en: 'Can’t reach the server. Try again in a moment.', code: 'offline' };

/** Local stand-in session for solo / static builds (see `offlineStub`). */
function stubAuth(mode: 'login' | 'register', creds: AuthCredentials): AuthResponse {
  const session: AuthSession = {
    email: creds.email.trim().toLowerCase(),
    accessToken: undefined,
    stub: true,
  };
  writeAuthSession(session);
  return { ok: true, session };
}

async function handleApiResponse(
  res: Response,
  creds: AuthCredentials,
  mode: 'login' | 'register',
  offline: () => AuthResponse,
): Promise<AuthResponse> {
  if (res.status === 404 || res.status === 501) return offline();
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return offline();
  let data: { accessToken?: string; token?: string; error?: string; pt?: string; en?: string; account?: { email?: string } };
  try {
    data = await res.json();
  } catch {
    return offline();
  }
  if (!res.ok) {
    return {
      ok: false,
      pt: data.pt ?? data.error ?? 'Não foi possível entrar. Tente de novo.',
      en: data.en ?? data.error ?? 'Could not sign in. Please try again.',
      code: 'server',
    };
  }
  const session: AuthSession = {
    email: (data.account?.email ?? creds.email).trim().toLowerCase(),
    accessToken: data.accessToken ?? data.token,
    stub: false,
  };
  writeAuthSession(session);
  return { ok: true, session };
}

/** Sign in with a Google Identity Services credential (ID token). Requires `TB_GOOGLE_CLIENT_ID` on the server. */
export async function signInWithGoogle(credential: string): Promise<AuthResponse> {
  const res = await postJson('/google', { credential });
  if (!res) return OFFLINE;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return OFFLINE;
  let data: { ok?: boolean; account?: { email?: string }; pt?: string; en?: string; code?: string };
  try {
    data = await res.json();
  } catch {
    return OFFLINE;
  }
  if (!res.ok || data.ok !== true || !data.account?.email) {
    return {
      ok: false,
      pt: data.pt ?? 'Não foi possível entrar com Google.',
      en: data.en ?? 'Could not sign in with Google.',
      code: data.code ?? 'server',
    };
  }
  const session: AuthSession = { email: data.account.email.trim().toLowerCase(), stub: false };
  writeAuthSession(session);
  return { ok: true, session };
}

export async function signIn(creds: AuthCredentials, { offlineStub = false }: AuthCallOptions = {}): Promise<AuthResponse> {
  const invalid = validateCredentials(creds);
  if (invalid) return invalid;
  const offline = () => (offlineStub ? stubAuth('login', creds) : OFFLINE);
  const res = await postJson('/login', creds);
  if (!res) return offline();
  return handleApiResponse(res, creds, 'login', offline);
}

/** `confirm18`: the optional “Tenho 18 anos ou mais” tick; the server records it when true. */
export async function signUp(creds: AuthCredentials, { confirm18 = false, offlineStub = false }: AuthCallOptions & { confirm18?: boolean } = {}): Promise<AuthResponse> {
  const invalid = validateCredentials(creds);
  if (invalid) return invalid;
  const offline = () => (offlineStub ? stubAuth('register', creds) : OFFLINE);
  const res = await postJson('/register', { ...creds, confirm18 });
  if (!res) return offline();
  return handleApiResponse(res, creds, 'register', offline);
}

/** True when this browser holds a live server session (HttpOnly cookie). Always false on static / solo hosts. */
export async function hasServerSession(): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_BASE}/me`, { headers: { accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return false;
    const data = (await res.json()) as { ok?: boolean; account?: unknown };
    return data.ok === true && !!data.account;
  } catch {
    return false;
  }
}

/** Revoke the server session (clears the cookie) and forget the local session record. */
export async function signOut(): Promise<void> {
  await postJson('/logout', {});
  clearAuthSession();
}

export type AccountCallResult = { ok: true } | { ok: false; pt: string; en: string };

/** POST that only needs ok / the server's bilingual reason back (account settings). */
async function postAccount(url: string, body: unknown): Promise<AccountCallResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, pt: 'Sem conexão com a Praça. Tenta de novo em instantes.', en: 'Can’t reach the server. Try again in a moment.' };
  }
  let data: { ok?: boolean; pt?: string; en?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* not json */
  }
  if (res.ok && data.ok === true) return { ok: true };
  return { ok: false, pt: data.pt ?? 'Algo deu errado. Tenta de novo?', en: data.en ?? 'Something went wrong. Try again?' };
}

/** The signed-in account as the server sees it (email, and whether it signs in with Google). */
export async function fetchAccount(): Promise<{ email: string; google: boolean } | null> {
  try {
    const res = await fetch(`${AUTH_BASE}/me`, { headers: { accept: 'application/json' } });
    const data = (await res.json()) as { ok?: boolean; account?: { email?: string; google?: boolean } | null };
    if (data.ok !== true || !data.account?.email) return null;
    return { email: data.account.email, google: data.account.google === true };
  } catch {
    return null;
  }
}

/** New password; the server signs out every other device. */
export function changePassword(current: string, next: string): Promise<AccountCallResult> {
  return postAccount(`${AUTH_BASE}/password`, { current, next });
}

/** End every session of this account, this browser included. */
export async function signOutEverywhere(): Promise<AccountCallResult> {
  const r = await postAccount(`${AUTH_BASE}/logout-all`, {});
  if (r.ok) clearAuthSession();
  return r;
}

/** Delete the account and its game data. `password`, or for a Google account the typed email. */
export async function deleteAccount(proof: { password?: string; confirmEmail?: string }): Promise<AccountCallResult> {
  const r = await postAccount('/api/account/delete', proof);
  if (r.ok) clearAuthSession();
  return r;
}

/** Same-origin download of everything the server keeps for this account (the cookie rides along). */
export const ACCOUNT_EXPORT_URL = '/api/account/export';

/** Ops smoke sign-in (stable account). Requires the same admin password as the hidden admin panel. */
export function signInOpsSmoke(adminPassword: string): Promise<AuthResponse> {
  return signInSmokePath('/ops-smoke', adminPassword);
}

/** A fresh Ops smoke account (no profile), so the arrival intro plays. Same admin gate as Ops smoke. */
export function signInOpsSmokeNew(adminPassword: string): Promise<AuthResponse> {
  return signInSmokePath('/ops-smoke-new', adminPassword);
}

/** Check the admin password before showing Ops smoke actions on the login screen. */
export async function verifyAdminGate(adminPassword: string): Promise<AuthResponse> {
  const res = await postJson('/admin-gate', { adminPassword });
  if (!res) return OFFLINE;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) {
    return { ok: false, pt: 'Admin indisponível.', en: 'Admin gate is unavailable.', code: 'server' };
  }
  let data: { ok?: boolean; pt?: string; en?: string; code?: string };
  try {
    data = await res.json();
  } catch {
    return OFFLINE;
  }
  if (!res.ok || data.ok !== true) {
    return {
      ok: false,
      pt: data.pt ?? 'Senha incorreta.',
      en: data.en ?? 'Wrong password.',
      code: data.code ?? 'credentials',
    };
  }
  return { ok: true, session: { email: OPS_SMOKE_EMAIL, stub: false } };
}

async function signInSmokePath(path: '/ops-smoke' | '/ops-smoke-new', adminPassword: string): Promise<AuthResponse> {
  const res = await postJson(path, { adminPassword });
  if (!res) return OFFLINE;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) {
    return { ok: false, pt: 'Ops smoke indisponível.', en: 'Ops smoke sign-in is unavailable.', code: 'server' };
  }
  let data: { ok?: boolean; account?: { email?: string }; pt?: string; en?: string; code?: string };
  try {
    data = await res.json();
  } catch {
    return OFFLINE;
  }
  if (!res.ok || data.ok !== true || !data.account?.email) {
    return {
      ok: false,
      pt: data.pt ?? 'Ops smoke indisponível.',
      en: data.en ?? 'Ops smoke sign-in is unavailable.',
      code: data.code ?? 'server',
    };
  }
  const session: AuthSession = { email: data.account.email, stub: false };
  writeAuthSession(session);
  return { ok: true, session };
}

export { OPS_SMOKE_EMAIL };
