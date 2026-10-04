/**
 * Hidden admin mode (credits easter egg). Password is server-side only (`TB_ADMIN_PASSWORD`).
 * Local / non-production builds fall back to `ADMIN_DEV_PASSWORD` when the env is unset.
 */
import { validatePassword } from '@tudobem/shared';
import { readEnv } from './env.js';

/** Local-only default when `TB_ADMIN_PASSWORD` is unset. Never used in production. */
export const ADMIN_DEV_PASSWORD = 'tb-admin-praca';

/** Cap on a single admin money grant (RV). */
export const ADMIN_MONEY_MAX = 500;

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
