import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_APPEARANCE, FOUNDER_BANNER_ID, type ServerMsg } from '@tudobem/shared';
import { ADMIN_DEV_PASSWORD } from '../adminAuth.js';
import { createApp } from '../app.js';
import { BillingEventLog } from '../adminStores.js';
import { openDatabase } from '../sqliteDb.js';
import { DevBillingProvider } from './devProvider.js';
import { billingConfigured, readBillingConfig } from './provider.js';
import { LemonSqueezyProvider, normalizeLemonEvent } from './lemonsqueezy.js';
import { signWebhookBody } from './signature.js';

const SECRET = 'whsec_test_secret_value';
const NOW = Date.parse('2026-10-08T15:00:00Z');

function eventBody(eventName: string, eventId: string, userId: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    meta: { event_name: eventName, webhook_id: eventId, custom_data: { user_id: userId } },
    data: {
      id: 'sub_9',
      type: eventName === 'subscription_payment_success' ? 'subscription-invoices' : 'subscriptions',
      attributes: {
        status: 'active',
        renews_at: '2026-11-08T15:00:00.000Z',
        ends_at: null,
        subscription_id: 9,
        urls: { customer_portal: 'https://playtudobem.lemonsqueezy.com/billing' },
        ...extra,
      },
    },
  });
}

describe('Lemon Squeezy payloads', () => {
  it('maps the subscription events and keeps the user id', () => {
    const created = normalizeLemonEvent(JSON.parse(eventBody('subscription_created', 'evt_c', 'user-1')));
    expect(created).toMatchObject({ eventId: 'evt_c', kind: 'created', userId: 'user-1', subscriptionId: 'sub_9', portalUrl: 'https://playtudobem.lemonsqueezy.com/billing' });
    const paid = normalizeLemonEvent(JSON.parse(eventBody('subscription_payment_success', 'evt_p', 'user-1')));
    expect(paid?.kind).toBe('payment_success');
    expect(paid?.subscriptionId).toBe('9');
    expect(normalizeLemonEvent(JSON.parse(eventBody('subscription_cancelled', 'evt_x', 'user-1', { status: 'cancelled', ends_at: '2026-11-08T15:00:00.000Z' })))?.kind).toBe('cancelled');
    expect(normalizeLemonEvent(JSON.parse(eventBody('subscription_expired', 'evt_e', 'user-1', { status: 'expired' })))?.kind).toBe('expired');
    expect(normalizeLemonEvent(JSON.parse(eventBody('subscription_resumed', 'evt_r', 'user-1')))?.kind).toBe('resumed');
    expect(normalizeLemonEvent(JSON.parse(eventBody('subscription_updated', 'evt_u', 'user-1', { status: 'past_due' })))?.kind).toBe('cancelled');
  });

  it('rejects a bad signature and accepts the hex HMAC of the raw body', () => {
    const provider = new LemonSqueezyProvider({ apiKey: 'k', storeId: '1', variantId: '2', webhookSecret: SECRET });
    const body = eventBody('subscription_expired', 'evt_e', 'user-1', { status: 'expired', ends_at: '2026-10-01T00:00:00.000Z' });
    expect(provider.handleWebhook(body, { 'x-signature': 'nope' }).ok).toBe(false);
    expect(provider.handleWebhook(body, { 'x-signature': 'ab' }).ok).toBe(false);
    const good = provider.handleWebhook(body, { 'x-signature': signWebhookBody(body, SECRET) });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.event.kind).toBe('expired');
  });

  it('posts a checkout with user_id custom data and the playtudobem redirect', async () => {
    let seen: { url?: string; body?: string; auth?: string } = {};
    const provider = new LemonSqueezyProvider({ apiKey: 'key-1', storeId: '11', variantId: '22', webhookSecret: SECRET }, async (url, init) => {
      seen = { url, body: String(init?.body ?? ''), auth: String((init?.headers as Record<string, string>)?.Authorization ?? '') };
      return new Response(JSON.stringify({ data: { attributes: { url: 'https://checkout.lemonsqueezy.com/buy/test' } } }), { status: 201 });
    });
    await expect(provider.createCheckout('player-9')).resolves.toBe('https://checkout.lemonsqueezy.com/buy/test');
    expect(seen.url).toBe('https://api.lemonsqueezy.com/v1/checkouts');
    expect(seen.auth).toBe('Bearer key-1');
    const sent = JSON.parse(seen.body ?? '{}');
    expect(sent.data.attributes.checkout_data.custom).toEqual({ user_id: 'player-9' });
    expect(sent.data.attributes.product_options.redirect_url).toBe('https://playtudobem.com');
    expect(sent.data.relationships.store.data.id).toBe('11');
    expect(sent.data.relationships.variant.data.id).toBe('22');
  });
});

describe('dev provider', () => {
  it('refuses createCheckout unless the caller is an admin', async () => {
    const profile = { founderBadge: false, furniture: {} };
    const dev = new DevBillingProvider({
      isAdmin: () => false,
      now: () => NOW,
      getProfile: () => profile,
      afterChange: () => {},
    });
    await expect(dev.createCheckout('ana')).rejects.toMatchObject({ status: 403 });
    expect(profile.founderBadge).toBe(false);
    expect(dev.handleWebhook('', {}).ok).toBe(false);
  });
});

describe('billing HTTP and admin auth', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let dir = '';
  let base = '';

  async function start(billing?: { apiKey: string; storeId: string; variantId: string; webhookSecret: string; enabled?: boolean } | null, fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-bill-'));
    app = createApp({
      dataDir: dir,
      scrypt: { N: 1024, r: 8, p: 1 },
      ambiance: false,
      billing: billing ?? {},
      billingFetch: fetchImpl,
    });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  async function player() {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ana-${crypto.randomBytes(3).toString('hex')}@exemplo.com`, password: 'pao-na-chapa-1', confirm18: true }),
    });
    const cookie = (reg.headers.get('set-cookie') ?? '').split(';')[0]!;
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws', { headers: { cookie } });
    const inbox: ServerMsg[] = [];
    const waiters: (() => void)[] = [];
    const poke = () => waiters.splice(0).forEach((w) => w());
    ws.on('message', (d) => {
      inbox.push(JSON.parse(String(d)));
      poke();
    });
    await new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject)));
    const until = async (pred: () => boolean, label: string) => {
      const end = Date.now() + 4000;
      while (!pred()) {
        if (Date.now() > end) throw new Error(`timeout: ${label} (${inbox.map((m) => m.t).join(',')})`);
        await new Promise<void>((r) => {
          waiters.push(r);
          setTimeout(r, 30);
        });
      }
    };
    const send = (m: unknown) => ws.send(JSON.stringify(m));
    send({ t: 'hello' });
    await until(() => inbox.some((m) => m.t === 'needProfile'), 'needProfile');
    send({ t: 'createProfile', name: 'Ana', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    await until(() => inbox.some((m) => m.t === 'welcome'), 'welcome');
    const welcome = inbox.find((m) => m.t === 'welcome') as Extract<ServerMsg, { t: 'welcome' }>;
    send({ t: 'join', room: 'praca' });
    await until(() => inbox.some((m) => m.t === 'roomState'), 'room');
    return { cookie, ws, inbox, send, until, id: welcome.profile.id };
  }

  it('stays dark with every secret set until TB_BILLING_ENABLED=1', async () => {
    await start({ apiKey: 'k', storeId: '1', variantId: '2', webhookSecret: SECRET });
    expect((await fetch(base + '/api/billing/checkout', { method: 'POST' })).status).toBe(503);
    expect(await (await fetch(base + '/api/config')).json()).toMatchObject({ billingReady: false });
  });

  it('reads the switch and the secrets from the environment', () => {
    const env = { LEMONSQUEEZY_API_KEY: 'k', LS_STORE_ID: '1', LS_VARIANT_ID: '2', LS_WEBHOOK_SECRET: SECRET };
    expect(billingConfigured(readBillingConfig(env))).toBe(false);
    expect(billingConfigured(readBillingConfig({ ...env, TB_BILLING_ENABLED: 'true' }))).toBe(false);
    expect(billingConfigured(readBillingConfig({ ...env, TB_BILLING_ENABLED: '1' }))).toBe(true);
    expect(billingConfigured(readBillingConfig({ TB_BILLING_ENABLED: '1' }))).toBe(false);
  });

  it('returns 503 from the webhook and checkout when secrets are missing', async () => {
    await start();
    expect((await fetch(base + '/api/billing/webhook', { method: 'POST', body: '{}' })).status).toBe(503);
    expect((await fetch(base + '/api/billing/checkout', { method: 'POST' })).status).toBe(503);
    expect(await (await fetch(base + '/api/config')).json()).toMatchObject({ billingReady: false });
  });

  it('applies a signed payment once, keeps the banner on cancel, and reverts perks on expire', async () => {
    await start({ apiKey: 'k', storeId: '1', variantId: '2', webhookSecret: SECRET, enabled: true });
    const ana = await player();
    const post = (body: string) =>
      fetch(base + '/api/billing/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': signWebhookBody(body, SECRET) }, body });
    const bad = await fetch(base + '/api/billing/webhook', {
      method: 'POST',
      headers: { 'x-signature': 'ffff' },
      body: eventBody('subscription_payment_success', 'evt_pay', ana.id),
    });
    expect(bad.status).toBe(401);

    const pay = eventBody('subscription_payment_success', 'evt_pay', ana.id);
    expect((await post(pay)).status).toBe(200);
    const again = await (await post(pay)).json();
    expect(again).toMatchObject({ ok: true, duplicate: true });
    await ana.until(() => ana.inbox.some((m) => m.t === 'profile' && m.profile.founderBadge === true), 'badge');
    const paid = [...ana.inbox].reverse().find((m) => m.t === 'profile' && m.profile.founderBadge) as Extract<ServerMsg, { t: 'profile' }>;
    expect(paid.profile.founderBanner).toBe(true);
    expect(paid.profile.furniture[FOUNDER_BANNER_ID]).toBe(1);
    expect(paid.profile.coins).toBe(ana.inbox.find((m) => m.t === 'welcome') && (ana.inbox.find((m) => m.t === 'welcome') as Extract<ServerMsg, { t: 'welcome' }>).profile.coins);
    expect(paid.profile.nameplate).toBe('verde');

    ana.send({ t: 'perk', action: 'pet', pet: 'dog' });
    ana.send({ t: 'perk', action: 'bubble', style: 'festa' });
    await ana.until(() => ana.inbox.some((m) => m.t === 'profile' && m.profile.pet === 'dog' && m.profile.bubbleStyle === 'festa'), 'perks');

    const cancel = eventBody('subscription_cancelled', 'evt_cancel', ana.id, { status: 'cancelled', ends_at: '2026-11-08T15:00:00.000Z' });
    expect((await post(cancel)).status).toBe(200);
    await ana.until(() => ana.inbox.some((m) => m.t === 'profile' && m.profile.subscription?.status === 'cancelled'), 'cancelled');
    const cancelled = [...ana.inbox].reverse().find((m) => m.t === 'profile' && m.profile.subscription?.status === 'cancelled') as Extract<ServerMsg, { t: 'profile' }>;
    expect(cancelled.profile.founderBadge).toBe(true);
    expect(cancelled.profile.pet).toBe('dog');

    const expired = eventBody('subscription_expired', 'evt_exp', ana.id, { status: 'expired', ends_at: '2026-10-01T00:00:00.000Z' });
    expect((await post(expired)).status).toBe(200);
    await ana.until(() => ana.inbox.some((m) => m.t === 'profile' && m.profile.subscription?.status === 'expired' && m.profile.pet == null), 'expired');
    const ended = [...ana.inbox].reverse().find((m) => m.t === 'profile' && m.profile.subscription?.status === 'expired') as Extract<ServerMsg, { t: 'profile' }>;
    expect(ended.profile.founderBadge).toBe(true);
    expect(ended.profile.founderBanner).toBe(true);
    expect(ended.profile.bubbleStyle).toBe('classic');
    expect(ended.profile.furniture[FOUNDER_BANNER_ID]).toBe(1);
    // the admin dashboard's webhook history: one row per signed event, the bad signature is not logged
    const history = new BillingEventLog(openDatabase(dir)).list();
    expect(history.map((e) => [e.eventId, e.outcome])).toEqual([
      ['evt_exp', 'applied'],
      ['evt_cancel', 'applied'],
      ['evt_pay', 'duplicate'],
      ['evt_pay', 'applied'],
    ]);
    expect(history[0]!.profileId).toBe(ana.id);
    ana.ws.close();
  });

  it('refuses a test grant without the admin password and allows it after login', async () => {
    await start();
    const ana = await player();
    ana.send({ t: 'admin', action: 'grantSub', targetId: ana.id });
    await ana.until(() => ana.inbox.some((m) => m.t === 'admin' && m.phase === 'auth' && m.ok === false), 'denied');
    expect(ana.inbox.some((m) => m.t === 'profile' && m.profile.founderBadge)).toBe(false);

    ana.send({ t: 'admin', action: 'login', password: ADMIN_DEV_PASSWORD });
    await ana.until(() => ana.inbox.some((m) => m.t === 'admin' && m.phase === 'auth' && m.ok === true), 'admin');
    ana.send({ t: 'admin', action: 'grantSub', targetId: ana.id });
    await ana.until(() => ana.inbox.some((m) => m.t === 'profile' && m.profile.founderBadge === true && m.profile.subscription?.status === 'active'), 'granted');
    ana.send({ t: 'admin', action: 'revokeSub', targetId: ana.id });
    await ana.until(() => ana.inbox.some((m) => m.t === 'profile' && m.profile.subscription?.status === 'expired' && m.profile.founderBadge === true), 'revoked');
    const ended = [...ana.inbox].reverse().find((m) => m.t === 'profile' && m.profile.subscription?.status === 'expired') as Extract<ServerMsg, { t: 'profile' }>;
    expect(ended.profile.pet).toBeNull();
    expect(ended.profile.bubbleStyle).toBe('classic');
    ana.ws.close();
  });
});
