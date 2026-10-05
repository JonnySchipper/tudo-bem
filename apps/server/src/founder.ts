import { readEnv } from './env.js';

/**
 * When true, new profiles get `founder: true` at creation. Set `TB_FOUNDER_GRANT_NEW=0` to stop granting
 * without removing the badge from players who already have it.
 */
export function founderGrantNewEnabled(env?: Record<string, string | undefined>): boolean {
  const v = (env?.TB_FOUNDER_GRANT_NEW ?? readEnv('TB_FOUNDER_GRANT_NEW') ?? '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}
