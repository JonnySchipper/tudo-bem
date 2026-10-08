/**
 * Payment provider boundary. Checkout returns a URL; webhooks report subscription
 * created, renewed, cancelled and expired (plus the Lemon Squeezy resume and payment events).
 * A follow-up can swap the concrete class. This PR ships Lemon Squeezy and a dev/test provider.
 */
import type { BillingKind } from '@tudobem/shared';

export interface NormalizedBillingEvent {
  eventId: string;
  kind: BillingKind;
  userId: string | null;
  providerStatus: string | null;
  currentPeriodEnd: number | null;
  portalUrl: string | null;
  subscriptionId: string | null;
}

export type WebhookResult =
  | { ok: true; event: NormalizedBillingEvent }
  | { ok: false; status: number; error: string };

export interface BillingProvider {
  readonly id: 'lemonsqueezy' | 'dev';
  createCheckout(userId: string): Promise<string>;
  handleWebhook(body: string, headers: Readonly<Record<string, string | string[] | undefined>>): WebhookResult;
}

export interface BillingConfig {
  apiKey?: string;
  storeId?: string;
  variantId?: string;
  webhookSecret?: string;
}

export function readBillingConfig(env: Record<string, string | undefined>): BillingConfig {
  return {
    apiKey: env.LEMONSQUEEZY_API_KEY?.trim() || undefined,
    storeId: env.LS_STORE_ID?.trim() || undefined,
    variantId: env.LS_VARIANT_ID?.trim() || undefined,
    webhookSecret: env.LS_WEBHOOK_SECRET?.trim() || undefined,
  };
}

/** Checkout and the webhook both stay dark until every secret is set. */
export function billingConfigured(cfg: BillingConfig): boolean {
  return !!(cfg.apiKey && cfg.storeId && cfg.variantId && cfg.webhookSecret);
}

export function headerValue(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}
