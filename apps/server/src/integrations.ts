/**
 * One boot line that says which optional integrations this process has turned on. Only on/off: no key,
 * password, id or token ever reaches the log.
 */
import { readAdminAuthConfig } from './adminAuth.js';
import { billingConfigured, readBillingConfig } from './billing/provider.js';
import { readEnv } from './env.js';
import { readGoogleOAuthConfig } from './googleAuth.js';

export interface IntegrationFlags {
  googleAuth: boolean;
  billing: boolean;
  admin: boolean;
  githubToken: boolean;
}

export async function integrationFlags(env: Record<string, string | undefined> = process.env): Promise<IntegrationFlags> {
  return {
    googleAuth: readGoogleOAuthConfig().ready,
    billing: billingConfigured(readBillingConfig(env)),
    admin: readAdminAuthConfig().ready,
    githubToken: !!readEnv('TB_GITHUB_TOKEN')?.trim(),
  };
}

export function formatIntegrations(f: IntegrationFlags): string {
  const on = (b: boolean) => (b ? 'on' : 'off');
  return `[boot] integrations google_auth=${on(f.googleAuth)} billing=${on(f.billing)} admin=${on(f.admin)} github_token=${on(f.githubToken)}`;
}

export async function logIntegrations(): Promise<void> {
  try {
    console.log(formatIntegrations(await integrationFlags()));
  } catch {
    console.error('[boot] could not read integration flags');
  }
}
