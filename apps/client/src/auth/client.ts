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

function validateCredentials({ email, password }: AuthCredentials): AuthResponse | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, pt: 'Digite um e-mail válido.', en: 'Enter a valid email address.', code: 'email' };
  }
  if (password.length < 8) {
    return { ok: false, pt: 'A senha precisa ter pelo menos 8 caracteres.', en: 'Password must be at least 8 characters.', code: 'password' };
  }
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

async function handleApiResponse(res: Response, creds: AuthCredentials, mode: 'login' | 'register', offline: () => AuthResponse): Promise<AuthResponse> {
  if (res.status === 404 || res.status === 501) return offline();
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return offline();
  let data: { accessToken?: string; token?: string; error?: string; pt?: string; en?: string };
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
    email: creds.email.trim().toLowerCase(),
    accessToken: data.accessToken ?? data.token,
    stub: false,
  };
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
