import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_APPEARANCE, type ServerMsg } from '@tudobem/shared';
import { createApp } from './app.js';

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
    expect(await a.waitFor('needProfile')).toEqual({ t: 'needProfile', confirm18: false });
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

    const saved = fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8');
    expect(saved).not.toContain('pao-na-chapa-1');
    expect(saved).toContain('scrypt$');
    c.ws.close();
  });

  it('a socket without a session cookie cannot create an avatar', async () => {
    await start();
    const a = wsClient(base);
    await a.open();
    a.send({ t: 'hello' });
    await a.waitFor('authRequired');
    a.send({ t: 'createProfile', name: 'Pirata', pronoun: 'ele', appearance: DEFAULT_APPEARANCE, confirm18: true });
    await new Promise((r) => setTimeout(r, 100));
    expect(a.inbox.some((m) => m.t === 'welcome')).toBe(false);
    expect(app!.store.count()).toBe(0);
    a.ws.close();
  });

  it('refuses cross-site requests and duplicate / under-affirmed signups', async () => {
    await start();
    const evil = await post('/api/auth/register', { email: 'x@exemplo.com', password: 'senha-senha-1', confirm18: true }, { origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
    const form = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a&password=b' });
    expect(form.status).toBe(403);
    await expect(wsClient(base, { origin: 'https://evil.example' }).open()).rejects.toThrow(/403/);

    expect((await post('/api/auth/register', { email: 'y@exemplo.com', password: 'senha-senha-1' })).status).toBe(400);
    expect((await post('/api/auth/register', { email: 'y@exemplo.com', password: 'senha-senha-1', confirm18: true })).status).toBe(201);
    const dup = await post('/api/auth/register', { email: 'Y@exemplo.com', password: 'senha-senha-2', confirm18: true });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ code: 'taken' });
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

  it('binds /api/conversa to the signed-in player instead of the body playerId', async () => {
    await start();
    const anon = await post('/api/conversa', { action: 'start', npcId: 'carlos', playerId: 'someone-else', daily: {} });
    expect(anon.status).toBe(401);
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
      expect(kicked).toMatchObject({ reason: 'idle', pt: expect.stringContaining('liberar a vaga') });
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
