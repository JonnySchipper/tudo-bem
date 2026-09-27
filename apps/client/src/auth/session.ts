import type { AuthSession } from './types';

export const AUTH_SESSION_KEY = 'tb_auth_session';
export const INTRO_PASSED_KEY = 'tb_intro_passed';

export function readAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function markIntroPassed() {
  sessionStorage.setItem(INTRO_PASSED_KEY, '1');
}

export function introAlreadyPassed(): boolean {
  if (new URLSearchParams(location.search).has('skipIntro')) return true;
  return sessionStorage.getItem(INTRO_PASSED_KEY) === '1';
}
