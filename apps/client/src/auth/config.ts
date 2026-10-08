export type PublicAppConfig = {
  opsSmoke: boolean;
  googleClientId: string;
  /** Lemon Squeezy checkout is configured. Otherwise the support button says "em breve". */
  billingReady: boolean;
};

let cached: PublicAppConfig | null = null;

/** Safe server flags for the intro (no secrets). */
export async function fetchPublicConfig(): Promise<PublicAppConfig> {
  if (cached) return cached;
  try {
    const res = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (!res.ok) return { opsSmoke: false, googleClientId: '', billingReady: false };
    const data = (await res.json()) as { opsSmoke?: boolean; googleClientId?: string; billingReady?: boolean };
    cached = {
      opsSmoke: data.opsSmoke === true,
      googleClientId: typeof data.googleClientId === 'string' ? data.googleClientId : '',
      billingReady: data.billingReady === true,
    };
    return cached;
  } catch {
    return { opsSmoke: false, googleClientId: '', billingReady: false };
  }
}
