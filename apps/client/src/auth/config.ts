export type PublicAppConfig = {
  opsSmoke: boolean;
};

let cached: PublicAppConfig | null = null;

/** Safe server flags for the intro (no secrets). */
export async function fetchPublicConfig(): Promise<PublicAppConfig> {
  if (cached) return cached;
  try {
    const res = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (!res.ok) return { opsSmoke: false };
    const data = (await res.json()) as { opsSmoke?: boolean };
    cached = { opsSmoke: data.opsSmoke === true };
    return cached;
  } catch {
    return { opsSmoke: false };
  }
}
