/** Account session from the auth API (or Phase 0 scaffold stub). */
export interface AuthSession {
  email: string;
  /** Bearer token when the real auth service is wired. */
  accessToken?: string;
  /** True when the client fell back to the local stub (merge-safe). */
  stub?: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export type AuthMode = 'login' | 'register';

export interface AuthResult {
  ok: true;
  session: AuthSession;
}

export interface AuthError {
  ok: false;
  pt: string;
  en: string;
  code?: string;
}

export type AuthResponse = AuthResult | AuthError;
