import { OPS_SMOKE_EMAIL, validatePassword } from '@tudobem/shared';

export interface OpsSmokeConfig {
  /** `TB_OPS_SMOKE=1` */
  enabled: boolean;
  /** Smoke login is wired and advertised to the client (password present and valid). */
  ready: boolean;
  email: string;
  password?: string;
}

/**
 * Local-only default when `TB_OPS_SMOKE=1` without `TB_OPS_SMOKE_PASSWORD`.
 * Never used in production — set `TB_OPS_SMOKE_PASSWORD` on Fly instead.
 */
export const OPS_SMOKE_DEV_PASSWORD = 'tb-ops-smoke-dev-only-9';

export type PublicAppConfig = {
  opsSmoke: boolean;
  /** Google Identity Services client id (public); empty when TB_GOOGLE_CLIENT_ID is unset. */
  googleClientId: string;
};

export function readOpsSmokeConfig(env: NodeJS.ProcessEnv = process.env): OpsSmokeConfig {
  const email = OPS_SMOKE_EMAIL;
  const enabled = env.TB_OPS_SMOKE === '1';
  if (!enabled) return { enabled: false, ready: false, email };

  const fromEnv = env.TB_OPS_SMOKE_PASSWORD?.trim();
  if (fromEnv) {
    const pw = validatePassword(fromEnv);
    if (!pw.ok) {
      console.warn(`[ops-smoke] TB_OPS_SMOKE_PASSWORD invalid: ${pw.reason.en}`);
      return { enabled: true, ready: false, email };
    }
    return { enabled: true, ready: true, email, password: pw.value };
  }

  if (env.NODE_ENV === 'production') {
    console.warn('[ops-smoke] TB_OPS_SMOKE=1 but TB_OPS_SMOKE_PASSWORD is unset — smoke login disabled');
    return { enabled: true, ready: false, email };
  }

  return { enabled: true, ready: true, email, password: OPS_SMOKE_DEV_PASSWORD };
}

export function publicAppConfig(cfg: OpsSmokeConfig, googleClientId = ''): PublicAppConfig {
  return { opsSmoke: cfg.ready, googleClientId };
}
