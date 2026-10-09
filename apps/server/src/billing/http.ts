/**
 * POST /api/billing/checkout — signed-in player, Lemon Squeezy URL (or 503 when unconfigured).
 * POST /api/billing/webhook — Lemon Squeezy events. 503 until LS_WEBHOOK_SECRET and the other vars are set.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { applyBillingTransition } from '@tudobem/shared';
import type { AccountStore } from '../auth.js';
import { sessionCookieOf } from '../auth.js';
import type { ProfileStore } from '../store.js';
import { LemonSqueezyProvider } from './lemonsqueezy.js';
import { billingConfigured, type BillingConfig, type BillingProvider } from './provider.js';

const MAX_BODY = 1024 * 1024;

export interface BillingHttpDeps {
  config: BillingConfig;
  accounts: AccountStore;
  store: ProfileStore;
  /** Push the new entitlement to a player who is online. */
  sync: (userId: string) => void;
  now?: () => number;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Test hook. Production uses Lemon Squeezy when configured. */
  provider?: BillingProvider | null;
  /** Webhook history for the admin dashboard (adminStores.ts BillingEventLog). */
  logEvent?: (e: { eventId: string; kind: string; profileId: string | null; status: string | null; outcome: string }) => void;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readRaw(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

export function billingProviderFor(deps: BillingHttpDeps): BillingProvider | null {
  if (deps.provider !== undefined) return deps.provider;
  if (!billingConfigured(deps.config)) return null;
  return new LemonSqueezyProvider(deps.config, deps.fetchImpl);
}

export async function handleBillingApi(req: IncomingMessage, res: ServerResponse, deps: BillingHttpDeps): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/api/billing/checkout' && url.pathname !== '/api/billing/webhook') return false;

  if (url.pathname === '/api/billing/webhook') {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: 'method' });
      return true;
    }
    if (!billingConfigured(deps.config)) {
      send(res, 503, { ok: false, error: 'unconfigured' });
      return true;
    }
    const raw = await readRaw(req);
    if (raw == null) {
      send(res, 413, { ok: false, error: 'body' });
      return true;
    }
    const provider = billingProviderFor(deps);
    if (!provider) {
      send(res, 503, { ok: false, error: 'unconfigured' });
      return true;
    }
    const result = provider.handleWebhook(raw, req.headers);
    if (!result.ok) {
      send(res, result.status, { ok: false, error: result.error });
      return true;
    }
    const event = result.event;
    const log = (profileId: string | null, outcome: string) =>
      deps.logEvent?.({ eventId: event.eventId, kind: event.kind, profileId, status: event.providerStatus ?? null, outcome });
    const userId = event.userId ?? userIdForSubscription(deps.store, event.subscriptionId);
    if (!userId) {
      log(null, 'ignored_user');
      send(res, 200, { ok: true, ignored: 'user' });
      return true;
    }
    const profile = deps.store.get(userId);
    if (!profile) {
      log(userId, 'ignored_user');
      send(res, 200, { ok: true, ignored: 'user' });
      return true;
    }
    const applied = applyBillingTransition(profile, {
      eventId: event.eventId,
      kind: event.kind,
      providerStatus: event.providerStatus,
      currentPeriodEnd: event.currentPeriodEnd,
      portalUrl: event.portalUrl,
      subscriptionId: event.subscriptionId,
      provider: 'lemonsqueezy',
      now: deps.now?.() ?? Date.now(),
    });
    if (applied) {
      deps.store.save(profile.id);
      deps.sync(userId);
    }
    log(profile.id, applied ? 'applied' : 'duplicate');
    send(res, 200, { ok: true, duplicate: !applied, eventId: event.eventId });
    return true;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'method' });
    return true;
  }
  const provider = billingProviderFor(deps);
  if (!provider || provider.id !== 'lemonsqueezy') {
    send(res, 503, { ok: false, error: 'unconfigured', soon: true });
    return true;
  }
  const account = deps.accounts.accountForSession(sessionCookieOf(req));
  const userId = account?.profileId;
  if (!account || !userId) {
    send(res, 401, { ok: false, error: 'unauthenticated' });
    return true;
  }
  try {
    const urlOut = await provider.createCheckout(userId);
    send(res, 200, { ok: true, url: urlOut });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    send(res, status, { ok: false, error: 'checkout_failed' });
  }
  return true;
}

function userIdForSubscription(store: ProfileStore, subscriptionId: string | null): string | null {
  if (!subscriptionId) return null;
  for (const p of store.all()) {
    if (p.subscription?.providerSubscriptionId === subscriptionId) return p.id;
  }
  return null;
}
