import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_APPEARANCE, type ServerMsg } from '@tudobem/shared';
import { createApp } from './app.js';
import { openDatabase } from './sqliteDb.js';
import { ADMIN_SESSION_IDLE_MS, ADMIN_SESSION_MAX_MS, AdminSessions } from './adminSession.js';
import { csvCell } from './adminApi.js';

type App = ReturnType<typeof createApp>;

const ADMIN_PW = 'painel-secreto-1';

function wsClient(base: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws', { headers });
  const inbox: ServerMsg[] = [];
  let closeCode: number | null = null;
  ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
  ws.on('close', (code) => (closeCode = code));
  ws.on('error', () => {});
  const until = async (pred: () => boolean, label: string, ms = 4000) => {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error(`timeout: ${label} (got ${inbox.map((m) => m.t).join(',')}, close ${closeCode})`);
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  return {
    ws,
    inbox,
    open: () => new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject))),
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    waitFor: <T extends ServerMsg['t']>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true) =>
      until(() => inbox.some((m) => m.t === t && pred(m as Extract<ServerMsg, { t: T }>)), t).then(() => inbox.filter((m) => m.t === t && pred(m as Extract<ServerMsg, { t: T }>)).at(-1) as Extract<ServerMsg, { t: T }>),
    waitClose: () => until(() => closeCode !== null, 'close').then(() => closeCode),
  };
}

describe('admin dashboard API (/api/admin/*)', () => {
  let app: App | null = null;
  let dir = '';
  let base = '';

  async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-admin-'));
    app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 }, feedbackAdmin: { ready: true, password: ADMIN_PW }, ...opts });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]!;

  async function signIn(name = 'Jonny') {
    const res = await post('/api/admin/login', { password: ADMIN_PW, name });
    expect(res.status).toBe(200);
    const cookie = cookieOf(res);
    const get = async (p: string) => {
      const r = await fetch(`${base}/api/admin/${p}`, { headers: { cookie } });
      return { status: r.status, body: (await r.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    const write = async (p: string, b: unknown) => {
      const r = await post(`/api/admin/${p}`, b, { cookie });
      return { status: r.status, body: (await r.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    return { cookie, get, write };
  }

  /** A signed-up player with an avatar, standing in the praça, socket open. */
  async function player(name: string, email = `${name.toLowerCase()}@exemplo.com`) {
    const reg = await post('/api/auth/register', { email, password: 'pao-na-chapa-1', confirm18: true });
    const cookie = cookieOf(reg);
    const c = wsClient(base, { cookie });
    await c.open();
    c.send({ t: 'hello' });
    await c.waitFor('needProfile');
    c.send({ t: 'createProfile', name, pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    const welcome = await c.waitFor('welcome');
    c.send({ t: 'join', room: 'praca' });
    await c.waitFor('roomState');
    return { c, cookie, id: welcome.profile.id, email };
  }

  const lastAudit = () => app!.audit.list({ limit: 1 })[0]!;

  it('answers 401 on every route without the admin cookie, and with a made-up one', async () => {
    await start();
    const routes = app!.adminApi.routes;
    expect(routes.get.length).toBeGreaterThan(10);
    expect(routes.post.length).toBeGreaterThan(15);
    for (const cookie of ['', 'tb_admin=not-a-session', 'tb_session=player-cookie']) {
      const headers: Record<string, string> = cookie ? { cookie } : {};
      for (const p of routes.get) expect([p, (await fetch(base + p, { headers })).status]).toEqual([p, 401]);
      for (const p of routes.post) expect([p, (await post(p, { id: 'x' }, headers)).status]).toEqual([p, 401]);
    }
    // an unknown route does not tell anyone what exists
    expect((await fetch(base + '/api/admin/nope')).status).toBe(401);
    expect((await post('/api/admin/nope', {})).status).toBe(401);
    // the page itself is public and holds nothing
    expect((await fetch(base + '/api/admin/overview')).status).toBe(401);
  });

  it('signs in with the admin password: httpOnly strict cookie scoped to /api/admin, throttled, and the password is never logged', async () => {
    await start();
    const logs: string[] = [];
    for (const k of ['log', 'warn', 'error'] as const) vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')));

    const bad = await post('/api/admin/login', { password: 'chute-errado' });
    expect(bad.status).toBe(401);
    expect(bad.headers.get('set-cookie')).toBeNull();

    const ok = await post('/api/admin/login', { password: ADMIN_PW, name: 'Jonny' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toMatch(/^tb_admin=[\w-]{40,}; Path=\/api\/admin; HttpOnly; SameSite=Strict; Max-Age=\d+$/);
    const cookie = cookieOf(ok);
    expect(await (await fetch(base + '/api/admin/session', { headers: { cookie } })).json()).toMatchObject({ ok: true, name: 'Jonny' });

    // the game session cookie is not an admin session, and the admin cookie is not a game session
    expect(await (await fetch(base + '/api/auth/me', { headers: { cookie } })).json()).toMatchObject({ ok: false, code: 'unauthenticated' });

    // logout ends it
    const out = await post('/api/admin/logout', {}, { cookie });
    expect(out.headers.get('set-cookie')).toMatch(/tb_admin=; .*Max-Age=0/);
    expect((await fetch(base + '/api/admin/session', { headers: { cookie } })).status).toBe(401);

    // 5 wrong guesses, then even the right password is refused for a while (shared with the in-game gate)
    for (let i = 0; i < 4; i++) expect((await post('/api/admin/login', { password: `errada-${i}` })).status).toBe(401);
    expect((await post('/api/admin/login', { password: ADMIN_PW })).status).toBe(429);

    expect(logs.join('\n')).not.toContain(ADMIN_PW);
    expect(logs.join('\n')).not.toContain('chute-errado');
  });

  it('is off (404) when no admin password is configured, and refuses cross-site or non-JSON writes', async () => {
    await start({ feedbackAdmin: { ready: false } });
    expect((await post('/api/admin/login', { password: 'x' })).status).toBe(404);
    await app!.close();
    app = null;
    await start();
    const { cookie } = await signIn();
    expect((await post('/api/admin/player/coins', { id: 'x', delta: 5, reason: 'oi oi' }, { cookie, origin: 'https://evil.example' })).status).toBe(403);
    const form = await fetch(base + '/api/admin/player/coins', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' });
    expect(form.status).toBe(415);
  });

  it('expires an admin session after 30 idle minutes, and after 8 hours regardless', () => {
    let now = 1_000_000;
    const s = new AdminSessions(() => now);
    const a = s.create('Jonny', '1.2.3.4');
    now += ADMIN_SESSION_IDLE_MS - 1000;
    expect(s.check(a)?.name).toBe('Jonny');
    now += ADMIN_SESSION_IDLE_MS + 1;
    expect(s.check(a)).toBeUndefined();
    const b = s.create('Jonny', '1.2.3.4');
    for (let t = 0; t < ADMIN_SESSION_MAX_MS; t += ADMIN_SESSION_IDLE_MS / 2) {
      now += ADMIN_SESSION_IDLE_MS / 2;
      s.check(b);
    }
    now += 1;
    expect(s.check(b)).toBeUndefined();
  });

  it('overview, players and player detail read the live world and never ship a password hash or token', async () => {
    await start();
    const ana = await player('Ana');
    const { get } = await signIn();
    const o = await get('overview');
    expect(o.body).toMatchObject({ ok: true, online: { players: 1 }, totals: { accounts: 1, profiles: 1 } });
    expect(o.body.signups).toHaveLength(30);
    expect(o.body.signups.at(-1).accounts).toBe(1);
    const list = await get('players?q=ana');
    expect(list.body.total).toBe(1);
    expect(list.body.rows[0]).toMatchObject({ id: ana.id, email: ana.email, online: true, room: 'praca' });
    const d = await get(`player?id=${ana.id}`);
    expect(d.body.profile.name).toBe('Ana');
    expect(d.body.account.sessions).toHaveLength(1);
    const raw = JSON.stringify(d.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toMatch(/"token"/);
    expect(raw).not.toContain(app!.store.get(ana.id)!.token);
    // by account id too
    expect((await get(`player?id=${d.body.account.id}`)).body.profile.id).toBe(ana.id);
  });

  it('gives and takes RV with a reason, pushes it live, caps it, and audits it', async () => {
    await start();
    const ana = await player('Ana');
    const { write } = await signIn('Jonny');
    const start0 = app!.store.get(ana.id)!.coins;
    expect((await write('player/coins', { id: ana.id, delta: 50 })).status).toBe(400);
    expect((await write('player/coins', { id: ana.id, delta: 501, reason: 'too much' })).status).toBe(400);
    expect((await write('player/coins', { id: ana.id, delta: 50, reason: 'bug no balcão' })).body).toEqual({ ok: true, coins: start0 + 50 });
    expect((await ana.c.waitFor('reward')).amount).toBe(50);
    expect(lastAudit()).toMatchObject({ actor: 'Jonny @ 127.0.0.1', action: 'player.coins', target: ana.id, before: { coins: start0 }, after: { coins: start0 + 50 } });
    expect((await write('player/coins', { id: ana.id, delta: -500, reason: 'clamp' })).body.coins).toBe(0);
    expect((await write('player/coins', { id: 'nobody', delta: 5, reason: 'xyz' })).status).toBe(404);
  });

  it('grants and removes hats, furniture, birds, bag items and the gi from the real catalogs', async () => {
    await start();
    const ana = await player('Ana');
    const { write, get } = await signIn();
    const cat = (await get('catalogs')).body;
    expect(cat.items.hat.map((h: { id: string }) => h.id)).toContain('cartola');
    const p = () => app!.store.get(ana.id)!;
    expect((await write('player/item', { id: ana.id, kind: 'hat', itemId: 'cartola', op: 'grant' })).status).toBe(200);
    expect(p().hats).toContain('cartola');
    expect((await write('player/item', { id: ana.id, kind: 'hat', itemId: 'cartola', op: 'grant' })).status).toBe(409);
    expect((await write('player/item', { id: ana.id, kind: 'hat', itemId: 'coroa_de_ouro', op: 'grant' })).status).toBe(400);
    await write('player/item', { id: ana.id, kind: 'hat', itemId: 'cartola', op: 'remove' });
    expect(p().hats).not.toContain('cartola');
    await write('player/item', { id: ana.id, kind: 'furniture', itemId: 'rede', op: 'grant', qty: 2 });
    expect(p().furniture.rede).toBe(2);
    expect((await write('player/item', { id: ana.id, kind: 'furniture', itemId: 'rede', op: 'remove', qty: 3 })).status).toBe(409);
    await write('player/item', { id: ana.id, kind: 'furniture', itemId: 'rede', op: 'remove', qty: 2 });
    expect(p().furniture.rede).toBeUndefined();
    await write('player/item', { id: ana.id, kind: 'parrot', itemId: 'azul', op: 'grant' });
    expect(p().parrotOwned).toBe(true);
    expect(p().parrotColors).toContain('azul');
    await write('player/item', { id: ana.id, kind: 'parrot', itemId: 'azul', op: 'remove' });
    expect(p().parrotOwned).toBe(false);
    await write('player/item', { id: ana.id, kind: 'bag', itemId: 'banana', op: 'grant', qty: 3 });
    expect(p().bag?.banana).toBe(3);
    await write('player/item', { id: ana.id, kind: 'gi', itemId: 'kimono', op: 'grant' });
    expect(p().giOwned).toBe(true);
    expect(lastAudit()).toMatchObject({ action: 'player.item', before: { giOwned: false }, after: { giOwned: true } });
    // pushed live
    await ana.c.waitFor('profile', (m) => m.profile.giOwned === true);
  });

  it('sets belt and stripes through the win count', async () => {
    await start();
    const ana = await player('Ana');
    const { write } = await signIn();
    expect((await write('player/belt', { id: ana.id, belt: 'roxa', stripes: 2 })).body).toMatchObject({ ok: true, belt: 'roxa', stripes: 2, wins: 60 + 40 });
    expect((await write('player/belt', { id: ana.id, belt: 'dourada' })).status).toBe(400);
    expect((await write('player/belt', { id: ana.id, wins: 0 })).body).toMatchObject({ belt: 'branca', stripes: 0 });
  });

  it('resets the tutorial, the desembarque, the arrival intro and the flight in (sent once on the next sign-in)', async () => {
    await start();
    const ana = await player('Ana');
    const { write } = await signIn();
    const p = app!.store.get(ana.id)!;
    p.desembarqueDone = true;
    p.arrivalIntroDone = true;
    p.tutorial.chapeu = true;
    p.tutorialRewarded = true;
    await write('player/reset-intro', { id: ana.id, which: 'tutorial' });
    expect(Object.values(p.tutorial).every((v) => v === false)).toBe(true);
    expect(p.tutorialRewarded).toBe(true);
    await write('player/reset-intro', { id: ana.id, which: 'arrivalIntro' });
    expect(p.arrivalIntroDone).toBe(false);
    await write('player/reset-intro', { id: ana.id, which: 'flight' });
    expect(p.desembarqueDone).toBe(false);
    expect(p.replayFlight).toBe(true);
    expect((await write('player/reset-intro', { id: ana.id, which: 'everything' })).status).toBe(400);
    ana.c.ws.close();
    const again = wsClient(base, { cookie: ana.cookie });
    await again.open();
    again.send({ t: 'hello' });
    expect((await again.waitFor('welcome')).profile.replayFlight).toBe(true);
    expect(p.replayFlight).toBeUndefined();
    again.ws.close();
  });

  it('mutes, kicks, bans and unbans, live', async () => {
    await start();
    const ana = await player('Ana');
    const { write, get } = await signIn();
    expect((await write('player/mute', { id: ana.id, minutes: 60 })).status).toBe(200);
    expect(app!.store.get(ana.id)!.mutedUntil).toBeGreaterThan(Date.now());
    await ana.c.waitFor('notice', (m) => m.level === 'warn');
    expect((await write('player/mute', { id: ana.id, minutes: 99_999 })).status).toBe(400);
    await write('player/mute', { id: ana.id, minutes: 0 });
    expect(app!.store.get(ana.id)!.mutedUntil).toBeUndefined();

    expect((await write('player/kick', { id: ana.id })).status).toBe(200);
    expect(await ana.c.waitClose()).toBe(4003);
    expect((await write('player/kick', { id: ana.id })).status).toBe(409);

    const back = wsClient(base, { cookie: ana.cookie });
    await back.open();
    back.send({ t: 'hello' });
    await back.waitFor('welcome');
    await write('player/ban', { id: ana.id, ban: true });
    expect(await back.waitClose()).toBe(4004);
    expect((await get('moderation')).body.restricted).toEqual([expect.objectContaining({ id: ana.id, banned: expect.any(Number) })]);
    await write('player/ban', { id: ana.id, ban: false });
    expect(app!.store.get(ana.id)!.banned).toBeUndefined();
    expect(app!.audit.list({ target: ana.id }).map((e) => e.action)).toEqual(['player.unban', 'player.ban', 'player.kick', 'player.unmute', 'player.mute']);
  });

  it('renames through the name rules and the chat classifier, and sets the founder flag', async () => {
    await start();
    const ana = await player('Ana');
    const { write } = await signIn();
    expect((await write('player/rename', { id: ana.id, name: 'Ana Clara' })).body).toEqual({ ok: true, name: 'Ana Clara' });
    expect(app!.store.get(ana.id)!.name).toBe('Ana Clara');
    expect((await write('player/rename', { id: ana.id, name: 'x' })).status).toBe(400);
    // the name rules turn away a swear before the model is asked
    expect((await write('player/rename', { id: ana.id, name: 'porra' })).status).toBe(400);
    // anything but an `allow` from the classifier keeps the old name
    const classify = vi.spyOn(app!.world.services.safety, 'classify').mockResolvedValue({ action: 'escalate', labels: ['harassment'] } as never);
    expect((await write('player/rename', { id: ana.id, name: 'Bruno' })).body).toMatchObject({ ok: false, error: expect.stringContaining('escalate') });
    expect(classify).toHaveBeenCalledWith('Bruno', expect.anything());
    expect(app!.store.get(ana.id)!.name).toBe('Ana Clara');
    await write('player/founder', { id: ana.id, founder: false });
    expect(app!.store.get(ana.id)!.founder).toBe(false);
    await write('player/founder', { id: ana.id, founder: true });
    expect(app!.store.get(ana.id)!.founder).toBe(true);
  });

  it('signs an account out of every session', async () => {
    await start();
    const ana = await player('Ana');
    const { write } = await signIn();
    expect((await write('player/signout', { id: ana.id })).body).toEqual({ ok: true, sessions: 1 });
    expect(await ana.c.waitClose()).toBe(4002);
    expect(await (await fetch(base + '/api/auth/me', { headers: { cookie: ana.cookie } })).json()).toMatchObject({ ok: false, code: 'unauthenticated' });
  });

  it('comps supporter perks (marked comp, no founder badge) and revokes them', async () => {
    await start();
    const ana = await player('Ana');
    const { write, get } = await signIn();
    expect((await write('subscriptions/comp', { id: ana.id, grant: true, days: 10 })).body.subscription).toMatchObject({ provider: 'comp', comp: true, active: true });
    const p = app!.store.get(ana.id)!;
    expect(p.founderBadge).toBe(false);
    expect((await get('subscriptions')).body.rows).toEqual([expect.objectContaining({ id: ana.id, comp: true, active: true })]);
    expect((await write('subscriptions/comp', { id: ana.id, grant: true, days: 1000 })).status).toBe(400);
    await write('subscriptions/comp', { id: ana.id, grant: false });
    expect(p.subscription).toMatchObject({ status: 'expired', provider: 'comp' });
    // a real subscription is not the dashboard's to touch
    p.subscription = { status: 'active', currentPeriodEnd: Date.now() + 86_400_000, provider: 'lemonsqueezy' };
    expect((await write('subscriptions/comp', { id: ana.id, grant: false })).status).toBe(409);
    expect((await write('subscriptions/comp', { id: ana.id, grant: true })).status).toBe(409);
  });

  it('triages feedback with a status and a note', async () => {
    await start();
    const ana = await player('Ana');
    expect((await post('/api/feedback', { text: 'O mapa travou na feira.', category: 'bug' }, { cookie: ana.cookie })).status).toBe(201);
    const { write, get } = await signIn();
    const items = (await get('feedback?status=new')).body.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: 'O mapa travou na feira.', playerName: 'Ana', triage: { status: 'new' } });
    expect((await write('feedback/triage', { id: items[0].id, status: 'done', note: 'fixed in #300' })).body.triage).toMatchObject({ status: 'done', note: 'fixed in #300' });
    expect((await get('feedback?status=new')).body.items).toHaveLength(0);
    expect((await get('feedback?status=done')).body.items[0].triage.note).toBe('fixed in #300');
    expect((await write('feedback/triage', { id: items[0].id, status: 'archived' })).status).toBe(400);
  });

  it('switches feira carts (off by default) and resets a layout override', async () => {
    await start();
    const { write, get } = await signIn();
    const w = (await get('world')).body;
    expect(w.feiraCart.games.every((g: { mode: string }) => g.mode === 'off')).toBe(true);
    expect(w.rooms.find((r: { id: string }) => r.id === 'praca').designUrl).toBe('/?design=praca');
    const game = w.feiraCart.games[0].id;
    expect((await write('world/feira-cart', { game, mode: 'on' })).body.feiraCart.games[0].mode).toBe('on');
    await write('world/feira-cart', { game, mode: 'off' });
    expect((await write('world/feira-cart', { game, mode: 'always' })).status).toBe(400);
    expect((await write('world/layout-reset', { room: 'praca' })).status).toBe(409);
    expect((await write('world/layout-reset', { room: 'lua' })).status).toBe(400);
  });

  it('the Praia card: reads the switch and today’s numbers, changes the mode (audited, broadcast) and the party boat', async () => {
    await start();
    const { write, get } = await signIn();
    const ana = await player('Ana');
    const v = (await get('praia')).body.praia;
    expect(v).toMatchObject({ mode: 'open', partyBoat: true, onBeach: 0, aboardParty: 0, tripsNow: {} });
    expect(v.today).toMatchObject({ rentals: {}, catches: {}, soldRv: 0, bottles: 0 });
    expect((await write('praia/mode', { mode: 'lua' })).status).toBe(400);
    expect((await write('praia/mode', {})).status).toBe(400);
    const r = await write('praia/mode', { mode: 'closed', partyBoat: false });
    expect(r.status).toBe(200);
    expect(r.body.praia).toMatchObject({ mode: 'closed', partyBoat: false });
    expect(lastAudit()).toMatchObject({ action: 'world.praia', before: { mode: 'open', partyBoat: true }, after: { mode: 'closed', partyBoat: false } });
    await ana.c.waitFor('praia', (m) => m.mode === 'closed' && !m.allowed && !m.partyBoat);
    expect((await get('world')).body.praia.mode).toBe('closed');
    await write('praia/mode', { mode: 'open', partyBoat: true });
    await ana.c.waitFor('praia', (m) => m.mode === 'open' && m.allowed);
    // the player page's fishing summary, and the audited support reset
    const p = app!.store.get(ana.id)!;
    p.pesca = { casts: 3, catches: 2, log: { bagre: { n: 2, bestCm: 41, firstAt: 1, firstWater: 'praia' } }, balde: { bagre: 2 }, rentals: {}, trip: null, sales: { date: '', rv: 0 }, coached: [], party: { hosted: 0, guested: 0 } };
    expect((await get(`player?id=${ana.id}`)).body.profile.pesca).toMatchObject({ casts: 3, catches: 2, species: 1, record: { fish: 'bagre', cm: 41 } });
    expect((await write('player/reset-pesca', { id: ana.id })).status).toBe(200);
    expect(app!.store.get(ana.id)!.pesca).toBeUndefined();
    expect(lastAudit()).toMatchObject({ action: 'player.reset-pesca', target: ana.id });
    ana.c.ws.close();
  });

  it('edits game variables in range, applies them live, keeps them across a restart, and resets to default', async () => {
    await start();
    const { write, get } = await signIn();
    expect((await write('config', { key: 'startingCoins', value: 999 })).status).toBe(400);
    expect((await write('config', { key: 'notAThing', value: 1 })).status).toBe(400);
    expect((await write('config', { key: 'startingCoins', value: 40 })).status).toBe(200);
    expect((await write('config', { key: 'roomCap', value: 2 })).status).toBe(200);
    const ana = await player('Ana');
    expect(app!.store.get(ana.id)!.coins).toBe(40);
    expect((await get('config')).body.values.find((v: { key: string }) => v.key === 'startingCoins')).toMatchObject({ value: 40, default: 10, overridden: true });
    expect((await get('config')).body.locked[0].key).toBe('stripePace');
    ana.c.ws.close();
    // restart: the override is in SQLite
    await app!.close();
    const keep = dir;
    app = createApp({ dataDir: keep, scrypt: { N: 1024, r: 8, p: 1 }, feedbackAdmin: { ready: true, password: ADMIN_PW } });
    expect(app.config.get('startingCoins')).toBe(40);
    app.config.reset('startingCoins');
    expect(app.config.get('startingCoins')).toBe(10);
  });

  it('resets progress behind a typed confirmation, snapshots it, and restores it', async () => {
    await start();
    const ana = await player('Ana');
    const { write } = await signIn();
    const p = app!.store.get(ana.id)!;
    p.coins = 321;
    p.diary = ['pao', 'cafe'];
    p.hats = ['cartola'];
    expect((await write('player/reset-progress', { id: ana.id, confirm: 'Bia' })).status).toBe(400);
    const r = await write('player/reset-progress', { id: ana.id, confirm: ' ana ' });
    expect(r.status).toBe(200);
    expect(await ana.c.waitClose()).toBe(4003);
    expect(p.coins).toBe(10);
    expect(p.hats).toEqual([]);
    expect(p.name).toBe('Ana');
    const entry = app!.audit.get(r.body.auditId)!;
    expect(entry).toMatchObject({ action: 'player.reset-progress', hasSnapshot: true });
    expect(JSON.stringify(entry.snapshot)).not.toContain(p.token);
    expect((await write('audit/restore', { id: r.body.auditId })).status).toBe(200);
    expect(app!.store.get(ana.id)!.coins).toBe(321);
    expect(app!.store.get(ana.id)!.hats).toEqual(['cartola']);
    expect(lastAudit().action).toBe('audit.restore');
  });

  it('deletes an account behind its email, snapshots it first, and restores it with the same login', async () => {
    await start();
    const ana = await player('Ana');
    const { write, get } = await signIn();
    expect((await write('player/delete', { id: ana.id, confirm: 'Ana' })).status).toBe(400);
    const r = await write('player/delete', { id: ana.id, confirm: ana.email });
    expect(r.status).toBe(200);
    expect(app!.store.get(ana.id)).toBeUndefined();
    expect(app!.accounts.byEmailGet(ana.email)).toBeUndefined();
    expect((await get(`player?id=${ana.id}`)).status).toBe(404);
    const snap = (await get(`audit/entry?id=${r.body.auditId}`)).body.entry.snapshot;
    expect(snap.account.email).toBe(ana.email);
    expect(JSON.stringify(snap)).not.toContain('scrypt$');
    expect((await write('audit/restore', { id: r.body.auditId })).status).toBe(200);
    expect(app!.store.get(ana.id)?.name).toBe('Ana');
    // the same password still works: the hash came back from the snapshot
    expect((await post('/api/auth/login', { email: ana.email, password: 'pao-na-chapa-1' })).status).toBe(200);
    expect((await write('audit/restore', { id: r.body.auditId })).status).toBe(409);
  });

  it('makes, lists and downloads a backup, and exports CSV without hashes', async () => {
    await start();
    await player('Ana');
    const { write, get, cookie } = await signIn();
    const made = await write('data/backup', {});
    expect(made.status).toBe(200);
    const list = (await get('data/backups')).body.backups;
    expect(list[0].name).toBe(made.body.name);
    const file = await fetch(`${base}/api/admin/data/backup-file?name=${encodeURIComponent(made.body.name)}`, { headers: { cookie } });
    expect(file.status).toBe(200);
    expect(file.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await file.arrayBuffer()).subarray(0, 15).toString()).toBe('SQLite format 3');
    expect((await fetch(`${base}/api/admin/data/backup-file?name=..%2Ftudobem.sqlite`, { headers: { cookie } })).status).toBe(404);
    const accounts = await (await fetch(`${base}/api/admin/data/export?what=accounts`, { headers: { cookie } })).text();
    expect(accounts).toContain('ana@exemplo.com');
    expect(accounts).not.toContain('scrypt');
    const profiles = await (await fetch(`${base}/api/admin/data/export?what=profiles`, { headers: { cookie } })).text();
    expect(profiles.split('\r\n')[1]).toContain('"Ana"');
    expect(app!.audit.list({ limit: 10 }).map((e) => e.action)).toEqual(['data.export', 'data.export', 'data.download', 'data.backup']);
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it('keeps the audit log append-only in the database itself', async () => {
    await start();
    const { write, get } = await signIn();
    await write('config', { key: 'tutorialBonus', value: 30 });
    const db = openDatabase(dir);
    expect(() => db.prepare('UPDATE admin_audit SET summary = ?').run('edited')).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM admin_audit').run()).toThrow(/append-only/);
    const items = (await get('audit')).body.items;
    expect(items[0]).toMatchObject({ actor: 'Jonny @ 127.0.0.1', action: 'config.set', target: 'tutorialBonus', before: { value: 25 }, after: { value: 30 } });
  });
});
