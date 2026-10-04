import type { Bilingual } from './types.js';

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
/** Ops / Curriculum smoke sign-in (`TB_OPS_SMOKE=1` on the server). Not a guest bypass. */
export const OPS_SMOKE_EMAIL = 'ops-smoke@tudobem.dev';
/** Bounded so a huge body can't make scrypt chew on megabytes. */
export const PASSWORD_MAX = 128;

/** A connected player with no real input for this long is sent home and their seat is freed. */
export const IDLE_KICK_MS = 15 * 60_000;
/** Heads-up toast this long before the idle kick. */
export const IDLE_WARN_MS = 60_000;

export type Check<T> = { ok: true; value: T } | { ok: false; reason: Bilingual };

export function normalizeEmail(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): Check<string> {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, reason: { pt: 'Digite seu e-mail.', en: 'Enter your email.' } };
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email))
    return { ok: false, reason: { pt: 'Esse e-mail não parece certo.', en: 'That email doesn’t look right.' } };
  return { ok: true, value: email };
}

export function validatePassword(raw: string): Check<string> {
  const pw = typeof raw === 'string' ? raw : '';
  if (pw.length < PASSWORD_MIN)
    return { ok: false, reason: { pt: `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`, en: `Password needs at least ${PASSWORD_MIN} characters.` } };
  if (pw.length > PASSWORD_MAX)
    return { ok: false, reason: { pt: `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`, en: `Password can be at most ${PASSWORD_MAX} characters.` } };
  return { ok: true, value: pw };
}

export type AuthErrorCode = 'email' | 'password' | 'taken' | 'credentials' | 'rate' | 'bad_request' | 'unauthenticated' | 'google';

export const GOOGLE_AUTH_ENV = {
  clientId: 'TB_GOOGLE_CLIENT_ID',
  clientSecret: 'TB_GOOGLE_CLIENT_SECRET',
} as const;

/** JSON shape of every /api/auth response. `account: null` after logout. */
export type AuthResponse = { ok: true; account: { email: string; hasProfile: boolean } | null } | { ok: false; code: AuthErrorCode; pt: string; en: string };

export const AUTH_COPY = {
  taken: { pt: 'Já existe uma conta com esse e-mail. Que tal entrar?', en: 'An account with this email already exists. Try signing in.' },
  credentials: { pt: 'E-mail ou senha incorretos.', en: 'Wrong email or password.' },
  rate: { pt: 'Muitas tentativas. Respira, toma um café e tenta de novo em alguns minutos.', en: 'Too many attempts. Grab a coffee and try again in a few minutes.' },
  unauthenticated: { pt: 'Entre na sua conta pra continuar.', en: 'Sign in to continue.' },
  badRequest: { pt: 'Algo deu errado. Tenta de novo?', en: 'Something went wrong. Try again?' },
  googleDisabled: {
    pt: 'Entrar com Google ainda não está disponível neste servidor.',
    en: 'Sign in with Google is not enabled on this server yet.',
  },
  googleInvalid: { pt: 'Não foi possível confirmar sua conta Google. Tente de novo.', en: 'Could not verify your Google account. Try again.' },
  googleEmail: {
    pt: 'Use o mesmo e-mail da sua conta ou entre com senha.',
    en: 'Use the same email as your account, or sign in with your password.',
  },
} satisfies Record<string, Bilingual>;

function ptSpan(ms: number): { pt: string; en: string } {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s % 60 === 0) {
    const m = s / 60;
    return { pt: m === 1 ? '1 minuto' : `${m} minutos`, en: m === 1 ? '1 minute' : `${m} minutes` };
  }
  return { pt: s === 1 ? '1 segundo' : `${s} segundos`, en: s === 1 ? '1 second' : `${s} seconds` };
}

export function idleWarningCopy(leftMs: number): Bilingual {
  const t = ptSpan(leftMs);
  return { pt: `Ainda tá aí? Em ${t.pt} você sai da Praça por inatividade.`, en: `Still there? You’ll leave the Praça in ${t.en} for being idle.` };
}

export function idleKickedCopy(idleMs: number): Bilingual {
  const t = ptSpan(idleMs);
  return {
    pt: `Você ficou ${t.pt} sem mexer, então liberamos sua vaga na Praça. Sua conta continua conectada.`,
    en: `You were idle for ${t.en}, so we freed up your spot in the Praça. You’re still signed in.`,
  };
}

/** Copy shown when an admin removes a player from the world. */
export const ADMIN_KICKED_COPY: Bilingual = {
  pt: 'Um administrador liberou sua vaga na Praça. Sua conta continua conectada.',
  en: 'An admin freed up your spot in the Praça. You’re still signed in.',
};
