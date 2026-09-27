import { AUTH_COPY, type AuthResponse } from '@tudobem/shared';

const BASE = import.meta.env.VITE_AUTH_API ?? '/api/auth';

async function call(path: string, init: RequestInit = {}): Promise<AuthResponse> {
  try {
    const res = await fetch(`${BASE}/${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
    });
    const body = (await res.json().catch(() => null)) as AuthResponse | null;
    return body ?? { ok: false, code: 'bad_request', ...AUTH_COPY.badRequest };
  } catch {
    return { ok: false, code: 'bad_request', pt: 'Sem conexão com a Praça. Tenta de novo?', en: 'Can’t reach the server. Try again?' };
  }
}

export const authApi = {
  me: () => call('me'),
  login: (email: string, password: string) => call('login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, confirm18: boolean) => call('register', { method: 'POST', body: JSON.stringify({ email, password, confirm18 }) }),
  logout: () => call('logout', { method: 'POST', body: '{}' }),
};
