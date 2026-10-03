export type PublicAppConfig = {
  opsSmoke: boolean;
  googleClientId: string;
};

let cached: PublicAppConfig | null = null;

/** Safe server flags for the intro (no secrets). */
export async function fetchPublicConfig(): Promise<PublicAppConfig> {
  if (cached) return cached;
  try {
    const res = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (!res.ok) return { opsSmoke: false, googleClientId: '' };
    const data = (await res.json()) as { opsSmoke?: boolean; googleClientId?: string };
    cached = { opsSmoke: data.opsSmoke === true, googleClientId: typeof data.googleClientId === 'string' ? data.googleClientId : '' };
    return cached;
  } catch {
    return { opsSmoke: false, googleClientId: '' };
  }
}
