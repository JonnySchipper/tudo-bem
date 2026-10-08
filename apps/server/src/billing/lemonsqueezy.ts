/**
 * Lemon Squeezy checkout + webhook.
 * Checkout: POST https://api.lemonsqueezy.com/v1/checkouts with custom data { user_id }.
 * Webhook: HMAC-SHA256 of the raw body in X-Signature.
 */
import { mapProviderStatus, SUBSCRIPTION_REDIRECT_URL, type BillingKind } from '@tudobem/shared';
import type { BillingConfig, BillingProvider, NormalizedBillingEvent, WebhookResult } from './provider.js';
import { headerValue } from './provider.js';
import { safeEqualString, signWebhookBody } from './signature.js';

const CHECKOUT_URL = 'https://api.lemonsqueezy.com/v1/checkouts';

const EVENT_KIND: Record<string, BillingKind> = {
  subscription_created: 'created',
  subscription_updated: 'updated',
  subscription_cancelled: 'cancelled',
  subscription_expired: 'expired',
  subscription_resumed: 'resumed',
  subscription_payment_success: 'payment_success',
  subscription_payment_recovered: 'renewed',
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class LemonSqueezyProvider implements BillingProvider {
  readonly id = 'lemonsqueezy' as const;

  constructor(
    private readonly cfg: BillingConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async createCheckout(userId: string): Promise<string> {
    const apiKey = this.cfg.apiKey;
    const storeId = this.cfg.storeId;
    const variantId = this.cfg.variantId;
    if (!apiKey || !storeId || !variantId) throw Object.assign(new Error('billing_unconfigured'), { status: 503 });
    const res = await this.fetchImpl(CHECKOUT_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: { custom: { user_id: userId } },
            product_options: { redirect_url: SUBSCRIPTION_REDIRECT_URL },
          },
          relationships: {
            store: { data: { type: 'stores', id: String(storeId) } },
            variant: { data: { type: 'variants', id: String(variantId) } },
          },
        },
      }),
    });
    if (!res.ok) throw Object.assign(new Error('checkout_failed'), { status: 502 });
    const json = (await res.json()) as { data?: { attributes?: { url?: unknown } } };
    const url = json.data?.attributes?.url;
    if (typeof url !== 'string' || !url.startsWith('https://')) throw Object.assign(new Error('checkout_failed'), { status: 502 });
    return url;
  }

  handleWebhook(body: string, headers: Readonly<Record<string, string | string[] | undefined>>): WebhookResult {
    const secret = this.cfg.webhookSecret;
    if (!secret) return { ok: false, status: 503, error: 'unconfigured' };
    const signature = headerValue(headers, 'x-signature');
    const expected = signWebhookBody(body, secret);
    if (!signature || !safeEqualString(signature, expected)) return { ok: false, status: 401, error: 'bad_signature' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { ok: false, status: 400, error: 'bad_json' };
    }
    const event = normalizeLemonEvent(parsed);
    if (!event) return { ok: false, status: 400, error: 'bad_event' };
    return { ok: true, event };
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function periodEnd(attrs: Record<string, unknown>, kind: BillingKind): number | null {
  const ends = str(attrs.ends_at);
  const renews = str(attrs.renews_at);
  const iso = kind === 'cancelled' || kind === 'expired' ? ends || renews : renews || ends;
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function normalizeLemonEvent(raw: unknown): NormalizedBillingEvent | null {
  const root = asRecord(raw);
  const meta = asRecord(root?.meta);
  const data = asRecord(root?.data);
  if (!meta || !data) return null;
  const name = str(meta.event_name);
  const eventId = str(meta.webhook_id);
  if (!name || !eventId || !(name in EVENT_KIND)) return null;
  const kind = EVENT_KIND[name]!;
  const attrs = asRecord(data.attributes) ?? {};
  const custom = asRecord(meta.custom_data);
  const userId = str(custom?.user_id) ?? str(custom?.userId);
  const urls = asRecord(attrs.urls);
  const portal = str(urls?.customer_portal);
  const status = str(attrs.status);
  let subscriptionId = str(data.id);
  if (kind === 'payment_success' || kind === 'renewed') subscriptionId = str(attrs.subscription_id) ?? subscriptionId;
  const mapped = kind === 'updated' ? mapProviderStatus(status) : null;
  return {
    eventId,
    kind: kind === 'updated' && mapped === 'expired' ? 'expired' : kind === 'updated' && mapped === 'cancelled' ? 'cancelled' : kind,
    userId,
    providerStatus: status,
    currentPeriodEnd: periodEnd(attrs, kind),
    portalUrl: portal,
    subscriptionId,
  };
}
