import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_APPEARANCE, OPS_SMOKE_EMAIL, WS_MAX_PAYLOAD, type ServerMsg } from '@tudobem/shared';
import { createApp } from './app.js';
import type { OpsSmokeConfig } from './opsSmoke.js';
import { openDatabase } from './sqliteDb.js';

type App = ReturnType<typeof createApp>;

/** A WebSocket client that records every server message and the close code. */
function wsClient(base: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws', { headers });
  const inbox: ServerMsg[] = [];
  let closeCode: number | null = null;
  const waiters: (() => void)[] = [];
  const poke = () => waiters.splice(0).forEach((w) => w());
  ws.on('message', (d) => {
    inbox.push(JSON.parse(String(d)));
    poke();
  });
  ws.on('close', (code) => {
    closeCode = code;
    poke();
  });
  ws.on('error', poke);
  const until = async (pred: () => boolean, label: string, ms = 4000) => {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error(`timeout: ${label} (got ${inbox.map((m) => m.t).join(',')}, close ${closeCode})`);
      await new Promise<void>((r) => {
        waiters.push(r);
        setTimeout(r, 50);
      });
    }
  };
  return {
    ws,
    inbox,
    closeCode: () => closeCode,
    open: () => new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject), ws.once('unexpected-response', (_q, res) => reject(new Error(`HTTP ${res.statusCode}`))))),
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    waitFor: <T extends ServerMsg['t']>(t: T) =>
      until(() => inbox.some((m) => m.t === t), t).then(() => inbox.filter((m) => m.t === t).at(-1) as Extract<ServerMsg, { t: T }>),
    waitClose: () => until(() => closeCode !== null, 'close').then(() => closeCode),
  };
}

describe('server: email/password accounts + idle kick (HTTP + WebSocket)', () => {
  let app: App | null = null;
  let dir = '';
  let base = '';

  async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-app-'));
    app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 }, ...opts });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]!;

  it('register → play → reload keeps you signed in → logout → login with the same email', async () => {
    await start();
    expect(await (await fetch(base + '/api/auth/me')).json()).toMatchObject({ ok: false, code: 'unauthenticated' });

    const reg = await post('/api/auth/register', { email: 'Jonny@Exemplo.com', password: 'pao-na-chapa-1', confirm18: true });
    expect(reg.status).toBe(201);
    expect(await reg.json()).toEqual({ ok: true, account: { email: 'jonny@exemplo.com', hasProfile: false } });
    const setCookie = reg.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/^tb_session=[\w-]{40,}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
    const cookie = cookieOf(reg);

    // Over HTTPS (Fly's proxy) the cookie is Secure.
    const me = await fetch(base + '/api/auth/me', { headers: { cookie, 'x-forwarded-proto': 'https' } });
    expect(me.status).toBe(200);
    expect(me.headers.get('set-cookie')).toMatch(/; Secure$/);

    const a = wsClient(base, { cookie });
    await a.open();
    a.send({ t: 'hello' });
    expect(await a.waitFor('needProfile')).toEqual({ t: 'needProfile' });
    a.send({ t: 'createProfile', name: 'Jonny', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    const welcome = await a.waitFor('welcome');
    a.send({ t: 'join', room: 'praca' });
    await a.waitFor('roomState');
    a.ws.close();
    await a.waitClose();

    // "Reload": new socket, same cookie → straight back into the same avatar.
    const b = wsClient(base, { cookie });
    await b.open();
    b.send({ t: 'hello' });
    expect((await b.waitFor('welcome')).profile.id).toBe(welcome.profile.id);
    expect(await (await fetch(base + '/api/auth/me', { headers: { cookie } })).json()).toMatchObject({ account: { hasProfile: true } });

    const out = await post('/api/auth/logout', {}, { cookie });
    expect(out.headers.get('set-cookie')).toMatch(/tb_session=; .*Max-Age=0/);
    expect(await b.waitClose()).toBe(4002);
    expect(await (await fetch(base + '/api/auth/me', { headers: { cookie } })).json()).toMatchObject({ ok: false, code: 'unauthenticated' });

    const bad = await post('/api/auth/login', { email: 'jonny@exemplo.com', password: 'errada-errada' });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toMatchObject({ ok: false, code: 'credentials', pt: 'E-mail ou senha incorretos.' });
    const good = await post('/api/auth/login', { email: 'JONNY@exemplo.com', password: 'pao-na-chapa-1' });
    expect(good.status).toBe(200);
    const c = wsClient(base, { cookie: cookieOf(good) });
    await c.open();
    c.send({ t: 'hello' });
    expect((await c.waitFor('welcome')).profile.id).toBe(welcome.profile.id);

    const saved = (openDatabase(dir).prepare('SELECT json FROM accounts').all() as { json: string }[]).map((r) => r.json).join('\n');
    expect(saved).not.toContain('pao-na-chapa-1');
    expect(saved).toContain('scrypt$');
    c.ws.close();
  });

  it('a socket without a session cookie cannot create an avatar (no guests in multiplayer)', async () => {
    await start();
    const a = wsClient(base);
    await a.open();
    a.send({ t: 'hello' });
    await a.waitFor('authRequired');
    a.send({ t: 'createProfile', name: 'Pirata', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    await new Promise((r) => setTimeout(r, 100));
    expect(a.inbox.some((m) => m.t === 'welcome')).toBe(false);
    expect(app!.store.count()).toBe(0);
    a.ws.close();
  });

  it('refuses cross-site requests, weak passwords and duplicate signups', async () => {
    await start();
    const evil = await post('/api/auth/register', { email: 'x@exemplo.com', password: 'senha-senha-1', confirm18: true }, { origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
    const form = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a&password=b' });
    expect(form.status).toBe(403);
    await expect(wsClient(base, { origin: 'https://evil.example' }).open()).rejects.toThrow(/403/);

    expect((await post('/api/auth/register', { email: 'y@exemplo.com', password: 'curta' })).status).toBe(400);
    // The 18+ tick is optional, so a bare { email, password } signup succeeds.
    expect((await post('/api/auth/register', { email: 'y@exemplo.com', password: 'senha-senha-1' })).status).toBe(201);
    const dup = await post('/api/auth/register', { email: 'Y@exemplo.com', password: 'senha-senha-2', confirm18: true });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ code: 'taken' });
  });

  it('logs in with a plus-addressed email in any casing, exactly as it was registered', async () => {
    await start();
    expect((await post('/api/auth/register', { email: 'Name+Tag@Exemplo.com', password: 'senha-senha-1' })).status).toBe(201);
    for (const email of ['name+tag@exemplo.com', 'NAME+TAG@EXEMPLO.COM', '  Name+Tag@Exemplo.com ']) {
      const r = await post('/api/auth/login', { email, password: 'senha-senha-1' });
      expect(r.status, email).toBe(200);
      expect(await r.json()).toMatchObject({ ok: true, account: { email: 'name+tag@exemplo.com' } });
    }
    // The tag is part of the address: a different tag is a different account.
    expect((await post('/api/auth/login', { email: 'name+other@exemplo.com', password: 'senha-senha-1' })).status).toBe(401);
  });

  it('rate-limits repeated wrong passwords for one email', async () => {
    await start();
    await post('/api/auth/register', { email: 'z@exemplo.com', password: 'senha-senha-1', confirm18: true });
    const codes: number[] = [];
    for (let i = 0; i < 9; i++) codes.push((await post('/api/auth/login', { email: 'z@exemplo.com', password: `errada-${i}-xx` })).status);
    expect(codes.slice(0, 8).every((c) => c === 401)).toBe(true);
    expect(codes[8]).toBe(429);
    expect((await post('/api/auth/login', { email: 'z@exemplo.com', password: 'senha-senha-1' })).status).toBe(429);
  });

  const smokeOn = (password = 'ops-smoke-test-password-1'): OpsSmokeConfig => ({
    enabled: true,
    ready: true,
    email: OPS_SMOKE_EMAIL,
    password,
  });
  const smokeOff: OpsSmokeConfig = { enabled: false, ready: false, email: OPS_SMOKE_EMAIL };
  const testAdmin = { ready: true, password: 'test-admin-pass-11' };

  it('hides Ops smoke when the flag is off (403 on endpoint, no public config)', async () => {
    await start({ opsSmoke: smokeOff });
    expect((await post('/api/auth/ops-smoke', {})).status).toBe(403);
    expect((await post('/api/auth/ops-smoke-new', {})).status).toBe(403);
    expect(await (await fetch(base + '/api/config')).json()).toEqual({ opsSmoke: false, googleClientId: '', billingReady: false });
  });

  it('Ops smoke rejects missing or wrong admin password', async () => {
    await start({ opsSmoke: smokeOn(), feedbackAdmin: testAdmin });
    expect((await post('/api/auth/ops-smoke', {})).status).toBe(401);
    expect((await post('/api/auth/ops-smoke-new', {})).status).toBe(401);
    expect((await post('/api/auth/ops-smoke', { adminPassword: 'not-the-admin' })).status).toBe(401);
    expect((await post('/api/auth/admin-gate', { adminPassword: 'not-the-admin' })).status).toBe(401);
    expect((await post('/api/auth/admin-gate', { adminPassword: testAdmin.password })).status).toBe(200);
    expect((await post('/api/auth/ops-smoke', { adminPassword: testAdmin.password })).status).toBe(200);
  });

  it('Ops smoke establishes a session and can enter multiplayer (not a guest bypass)', async () => {
    await start({ opsSmoke: smokeOn(), feedbackAdmin: testAdmin });
    expect(await (await fetch(base + '/api/config')).json()).toEqual({ opsSmoke: true, googleClientId: '', billingReady: false });
    const login = await post('/api/auth/ops-smoke', { adminPassword: testAdmin.password });
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ ok: true, account: { email: OPS_SMOKE_EMAIL, hasProfile: false } });
    const cookie = cookieOf(login);
    const player = wsClient(base, { cookie });
    await player.open();
    player.send({ t: 'hello' });
    expect(await player.waitFor('needProfile')).toEqual({ t: 'needProfile' });
    player.send({ t: 'createProfile', name: 'Ops', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    await player.waitFor('welcome');
    player.send({ t: 'join', room: 'praca' });
    await player.waitFor('roomState');
    player.ws.close();

    const guest = wsClient(base);
    await guest.open();
    guest.send({ t: 'hello' });
    expect(await guest.waitFor('authRequired')).toEqual({ t: 'authRequired' });
    guest.ws.close();

    const again = await post('/api/auth/ops-smoke', { adminPassword: testAdmin.password });
    expect(again.status).toBe(200);
    expect(app!.accounts.count()).toBe(1);

    const fresh = await post('/api/auth/ops-smoke-new', { adminPassword: testAdmin.password });
    expect(fresh.status).toBe(200);
    const freshBody = (await fresh.json()) as { ok: boolean; account: { email: string; hasProfile: boolean } };
    expect(freshBody.ok).toBe(true);
    expect(freshBody.account.hasProfile).toBe(false);
    expect(freshBody.account.email).toMatch(/^ops-new-[0-9a-f-]+@tudobem\.dev$/);
    expect(freshBody.account.email).not.toBe(OPS_SMOKE_EMAIL);
    const fresh2 = await post('/api/auth/ops-smoke-new', { adminPassword: testAdmin.password });
    const fresh2Body = (await fresh2.json()) as { account: { email: string } };
    expect(fresh2Body.account.email).not.toBe(freshBody.account.email);
    expect(app!.accounts.count()).toBe(3);

    const newbie = wsClient(base, { cookie: cookieOf(fresh) });
    await newbie.open();
    newbie.send({ t: 'hello' });
    expect(await newbie.waitFor('needProfile')).toEqual({ t: 'needProfile' });
    newbie.send({ t: 'createProfile', name: 'Nova', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    const welcome = await newbie.waitFor('welcome');
    expect(welcome.t === 'welcome' && welcome.profile.arrivalIntroDone).toBe(false);
    newbie.ws.close();
  });

  it('Google sign-in verifies the credential and sets a session cookie', async () => {
    await start({
      googleOAuth: { clientId: 'test.apps.googleusercontent.com', ready: true },
      verifyGoogleIdToken: async (token) =>
        token === 'valid-token' ? { sub: 'g-sub', email: 'google@exemplo.com', emailVerified: true } : null,
    });
    expect(await (await fetch(base + '/api/config')).json()).toEqual({ opsSmoke: false, googleClientId: 'test.apps.googleusercontent.com', billingReady: false });
    const bad = await post('/api/auth/google', { credential: 'nope' });
    expect(bad.status).toBe(401);
    const ok = await post('/api/auth/google', { credential: 'valid-token' });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, account: { email: 'google@exemplo.com', hasProfile: false, google: true } });
    const cookie = cookieOf(ok);
    const me = await fetch(base + '/api/auth/me', { headers: { cookie } });
    expect(await me.json()).toMatchObject({ ok: true, account: { email: 'google@exemplo.com' } });
  });

  it('keeps the socket open for a diary photo larger than the old 16KB frame', async () => {
    await start();
    const a = wsClient(base);
    await a.open();
    // A 240px viewfinder jpeg is often past 16KB. That used to close the socket before the handler ran.
    a.send({ t: 'ping', image: `data:image/jpeg;base64,${'A'.repeat(40_000)}` });
    expect(await a.waitFor('pong')).toEqual({ t: 'pong' });
    expect(a.closeCode()).toBeNull();

    const over = wsClient(base);
    await over.open();
    over.send({ t: 'ping', image: 'x'.repeat(WS_MAX_PAYLOAD) });
    expect(await over.waitClose()).toBe(1009);
  });

  it('kicks an AFK player (pings only) with close code 4001 and frees the seat; activity keeps you in', async () => {
    await start({ idleKickMs: 1200, idleSweepMs: 50 });
    const join = async (email: string, name: string) => {
      const reg = await post('/api/auth/register', { email, password: 'senha-senha-1', confirm18: true });
      const c = wsClient(base, { cookie: cookieOf(reg) });
      await c.open();
      c.send({ t: 'hello' });
      await c.waitFor('needProfile');
      c.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
      await c.waitFor('welcome');
      c.send({ t: 'join', room: 'praca' });
      await c.waitFor('roomState');
      return c;
    };
    const afk = await join('afk@exemplo.com', 'Parado');
    const busy = await join('ativa@exemplo.com', 'Ativa');
    expect(app!.world.stats().instances['praca#1']).toBe(2);
    const keepBusy = setInterval(() => busy.send({ t: 'active' }), 200);
    const keepPinging = setInterval(() => afk.send({ t: 'ping' }), 100);
    try {
      expect(await afk.waitFor('idleWarning')).toMatchObject({ pt: expect.stringContaining('Ainda tá aí?') });
      const kicked = await afk.waitFor('kicked');
      expect(kicked).toMatchObject({ reason: 'idle', pt: expect.stringContaining('continua conectada') });
      expect(await afk.waitClose()).toBe(4001);
      expect(app!.world.stats().instances['praca#1']).toBe(1);
      expect(busy.closeCode()).toBeNull();
      expect(busy.inbox.some((m) => m.t === 'avatarLeft')).toBe(true);
    } finally {
      clearInterval(keepBusy);
      clearInterval(keepPinging);
      busy.ws.close();
    }
  });
});
