import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_APPEARANCE, type ServerMsg } from '@tudobem/shared';
import { createApp } from './app.js';
import { AccountStore } from './auth.js';
import { AcademyStore } from './academyStore.js';
import { PadariaStore } from './padariaStore.js';
import { FeedbackStore } from './feedbackStore.js';
import { ProfileStore, type StoredProfile } from './store.js';
import { memoryFeiraGames } from './feiraGames.js';
import { deleteAccountCascade } from './accountDelete.js';
import { FileModerationQueue } from './services/fileModeration.js';
import { openDatabase } from './sqliteDb.js';

const FAST = { N: 1024, r: 8, p: 1 };
const ADMIN = 'admin-senha-de-teste';

function wsClient(base: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws', { headers });
  const inbox: ServerMsg[] = [];
  let closeCode: number | null = null;
  ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
  ws.on('close', (code) => (closeCode = code));
  const until = async (pred: () => boolean, label: string) => {
    const end = Date.now() + 4000;
    while (!pred()) {
      if (Date.now() > end) throw new Error(`timeout: ${label} (got ${inbox.map((m) => m.t).join(',')}, close ${closeCode})`);
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  return {
    inbox,
    open: () => new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject))),
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    waitFor: <T extends ServerMsg['t']>(t: T) => until(() => inbox.some((m) => m.t === t), t).then(() => inbox.filter((m) => m.t === t).at(-1) as Extract<ServerMsg, { t: T }>),
    waitClose: () => until(() => closeCode !== null, 'close').then(() => closeCode),
    close: () => ws.close(),
  };
}

describe('account API: rate limits, password, sign-out everywhere, export, deletion', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let dir = '';
  let base = '';

  async function start() {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-acct-'));
    app = createApp({ dataDir: dir, scrypt: FAST, feedbackAdmin: { ready: true, password: ADMIN } });
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

  async function signUpAndPlay(email: string, password: string, name: string) {
    const reg = await post('/api/auth/register', { email, password });
    expect(reg.status).toBe(201);
    const cookie = cookieOf(reg);
    const ws = wsClient(base, { cookie });
    await ws.open();
    ws.send({ t: 'hello' });
    await ws.waitFor('needProfile');
    ws.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    const welcome = await ws.waitFor('welcome');
    return { cookie, ws, profileId: welcome.profile.id };
  }

  it('parallel wrong logins cannot get past the per-email limit', async () => {
    await start();
    await post('/api/auth/register', { email: 'z@exemplo.com', password: 'senha-senha-1' });
    const codes = await Promise.all(Array.from({ length: 20 }, (_, i) => post('/api/auth/login', { email: 'z@exemplo.com', password: `errada-${i}-xx` }).then((r) => r.status)));
    expect(codes.filter((c) => c === 401)).toHaveLength(8);
    expect(codes.filter((c) => c === 429)).toHaveLength(12);
  });

  it('parallel signups cannot get past the per-IP limit, and a refused signup gives its slot back', async () => {
    await start();
    expect((await post('/api/auth/register', { email: 'bad', password: 'senha-senha-1' })).status).toBe(400);
    const codes = await Promise.all(Array.from({ length: 15 }, (_, i) => post('/api/auth/register', { email: `n${i}@exemplo.com`, password: 'senha-senha-1' }).then((r) => r.status)));
    expect(codes.filter((c) => c === 201)).toHaveLength(10);
    expect(codes.filter((c) => c === 429)).toHaveLength(5);
  });

  it('changes the password (other devices signed out) and signs out everywhere', async () => {
    await start();
    const reg = await post('/api/auth/register', { email: 'rui@exemplo.com', password: 'velha-senha-1' });
    const here = cookieOf(reg);
    const there = cookieOf(await post('/api/auth/login', { email: 'rui@exemplo.com', password: 'velha-senha-1' }));

    expect((await post('/api/auth/password', { current: 'x', next: 'nova-senha-22' })).status).toBe(401);
    expect((await post('/api/auth/password', { current: 'x', next: 'nova-senha-22' }, { cookie: here, origin: 'https://evil.example' })).status).toBe(403);
    const wrong = await post('/api/auth/password', { current: 'errada-123', next: 'nova-senha-22' }, { cookie: here });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ code: 'credentials' });
    const ok = await post('/api/auth/password', { current: 'velha-senha-1', next: 'nova-senha-22' }, { cookie: here });
    expect(ok.status).toBe(200);
    const me = (c: string) => fetch(base + '/api/auth/me', { headers: { cookie: c } }).then((r) => r.json());
    expect(await me(here)).toMatchObject({ ok: true });
    expect(await me(there)).toMatchObject({ ok: false });
    expect((await post('/api/auth/login', { email: 'rui@exemplo.com', password: 'nova-senha-22' })).status).toBe(200);

    const all = await post('/api/auth/logout-all', {}, { cookie: here });
    expect(all.status).toBe(200);
    expect(all.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect(await me(here)).toMatchObject({ ok: false });
  });

  it('exports the account and profile without password or session hashes', async () => {
    await start();
    const { cookie, ws, profileId } = await signUpAndPlay('bia@exemplo.com', 'coxinha-quente', 'Bia');
    expect((await fetch(base + '/api/account/export')).status).toBe(401);
    const res = await fetch(base + '/api/account/export', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    const text = await res.text();
    expect(text).not.toContain('scrypt$');
    expect(text).not.toContain(cookie.split('=')[1]!);
    const data = JSON.parse(text);
    expect(data.account.email).toBe('bia@exemplo.com');
    expect(data.profiles[0].id).toBe(profileId);
    expect(data.profiles[0].name).toBe('Bia');
    expect(data.profiles[0].token).toBeUndefined();
    ws.close();
  });

  it('deletes a live account: socket closed, profile, friends, feedback and moderation gone, nothing comes back', async () => {
    await start();
    const ana = await signUpAndPlay('ana@exemplo.com', 'senha-da-ana-1', 'Ana');
    const leo = await signUpAndPlay('leo@exemplo.com', 'senha-do-leo-1', 'Leo');
    const a = app!.store.get(ana.profileId)!;
    const l = app!.store.get(leo.profileId)!;
    a.friends.push(l.id);
    l.friends.push(a.id);
    app!.store.save();
    expect((await post('/api/feedback', { text: 'Adorei a padaria, muito bom!' }, { cookie: ana.cookie })).status).toBe(201);
    app!.world.services.moderation.push({ kind: 'report', surface: 'chat', playerId: leo.profileId, playerName: 'Leo', room: 'praca', text: 'x', labels: [], targetId: ana.profileId, at: 1 });
    app!.world.services.moderation.push({ kind: 'warn', surface: 'chat', playerId: leo.profileId, playerName: 'Leo', room: 'praca', text: 'y', labels: [], at: 2 });

    expect((await post('/api/account/delete', { password: 'errada-123' }, { cookie: ana.cookie })).status).toBe(401);
    const del = await post('/api/account/delete', { password: 'senha-da-ana-1' }, { cookie: ana.cookie });
    expect(del.status).toBe(200);
    expect(del.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect(await ana.ws.waitClose()).toBe(4002);

    expect(app!.store.get(ana.profileId)).toBeUndefined();
    expect(app!.store.get(leo.profileId)!.friends).not.toContain(ana.profileId);
    expect(await (await fetch(base + '/api/auth/me', { headers: { cookie: ana.cookie } })).json()).toMatchObject({ ok: false });
    expect((await post('/api/auth/login', { email: 'ana@exemplo.com', password: 'senha-da-ana-1' })).status).toBe(401);

    // Let any debounced profile save run, then read the database itself.
    leo.ws.send({ t: 'emote', kind: 'oi' });
    await new Promise((r) => setTimeout(r, 1000));
    const db = openDatabase(dir);
    const dump = ['accounts', 'sessions', 'profiles', 'feedback'].map((t) => (db.prepare(`SELECT json FROM ${t}`).all() as { json: string }[]).map((r) => r.json).join('\n')).join('\n');
    expect(dump).not.toContain('ana@exemplo.com');
    expect(dump).not.toContain(`"${ana.profileId}"`);
    expect(dump).not.toContain('Adorei a padaria');
    expect(dump).toContain('leo@exemplo.com');
    const log = fs.readFileSync(path.join(dir, 'moderation.jsonl'), 'utf8');
    expect(log).not.toContain(ana.profileId);
    expect(log).toContain('"text":"y"');
    expect(app!.world.services.moderation.recent(10).some((ev) => ev.targetId === ana.profileId)).toBe(false);
    leo.ws.close();
  });

  it('a Google account confirms deletion by typing its email; the admin endpoint deletes by email and is throttled', async () => {
    await start();
    const store = app!.accounts;
    const g = await store.loginWithGoogle({ sub: 'g-1', email: 'gui@exemplo.com', emailVerified: true });
    if (!g.ok) throw new Error('google failed');
    const cookie = `tb_session=${store.createSession(g.account.id)}`;
    const wrong = await post('/api/account/delete', { confirmEmail: 'outro@exemplo.com' }, { cookie });
    expect(wrong.status).toBe(401);
    expect((await post('/api/account/delete', { confirmEmail: ' Gui@Exemplo.com ' }, { cookie })).status).toBe(200);
    expect(store.byEmailGet('gui@exemplo.com')).toBeUndefined();

    await post('/api/auth/register', { email: 'tchau@exemplo.com', password: 'senha-senha-1' });
    const admin = (pw: string, email: string) => post('/api/account/admin-delete', { email }, { authorization: `Bearer ${pw}` });
    expect((await admin(ADMIN, 'ninguem@exemplo.com')).status).toBe(404);
    expect((await admin(ADMIN, 'tchau@exemplo.com')).status).toBe(200);
    expect(store.byEmailGet('tchau@exemplo.com')).toBeUndefined();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await admin(`chute-${i}`, 'x@exemplo.com')).status);
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[5]).toBe(429);
    // The same lock covers the feedback review list and the right password.
    expect((await fetch(base + '/api/feedback', { headers: { authorization: `Bearer ${ADMIN}` } })).status).toBe(429);
  });

  it('throttles the WebSocket admin login and closes the socket after repeated failures', async () => {
    await start();
    const { ws } = await signUpAndPlay('adm@exemplo.com', 'senha-senha-1', 'Adm');
    for (let i = 0; i < 5; i++) ws.send({ t: 'admin', action: 'login', password: `chute-${i}` });
    expect(await ws.waitClose()).toBe(4003);
    const replies = ws.inbox.filter((m) => m.t === 'admin');
    expect(replies.length).toBe(5);
    // A new socket from the same IP and account is still locked, even with the right (local default) password.
    const again = wsClient(base, { cookie: cookieOf(await post('/api/auth/login', { email: 'adm@exemplo.com', password: 'senha-senha-1' })) });
    await again.open();
    again.send({ t: 'hello' });
    await again.waitFor('welcome');
    again.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    const r = await again.waitFor('admin');
    expect(r).toMatchObject({ phase: 'auth', ok: false });
    again.close();
  });

  it('limits guest feedback notes per IP', async () => {
    await start();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await post('/api/feedback', { text: `Uma ideia boa número ${i + 1}` })).status);
    expect(codes).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe('deleteAccountCascade', () => {
  it('removes owned academies and padarias, the seat in other academies, feira entries and leaves other players alone', async () => {
    const accounts = new AccountStore(null, { scrypt: FAST });
    const r = await accounts.register('x@exemplo.com', 'senha-senha-1', false);
    if (!r.ok) throw new Error('register failed');
    const store = new ProfileStore(null);
    const mk = (id: string, accountId?: string) => ({ id, token: `t-${id}`, accountId, friends: [] as string[], name: id }) as unknown as StoredProfile;
    store.add(mk('p-x', r.account.id));
    store.add(mk('p-y'));
    accounts.linkProfile(r.account.id, 'p-x');
    const academies = new AcademyStore(null);
    academies.add({ id: 'a1', name: 'Minha', nameKey: 'minha', ownerId: 'p-x', members: ['p-x', 'p-y'], createdAt: 1 } as never);
    academies.add({ id: 'a2', name: 'Outra', nameKey: 'outra', ownerId: 'p-y', members: ['p-y', 'p-x'], createdAt: 2 } as never);
    const padarias = new PadariaStore(null);
    padarias.add({ id: 'd1', name: 'Pão', nameKey: 'pao', ownerId: 'p-x', createdAt: 1 } as never);
    const feedback = new FeedbackStore(null);
    feedback.add({ text: 'oi', category: null, contact: null, accountId: r.account.id, profileId: 'p-x', room: null });
    feedback.add({ text: 'oi 2', category: null, contact: null, accountId: null, profileId: null, room: null });
    const feiraGames = memoryFeiraGames(() => Date.now());
    feiraGames.state.medals['p-x'] = [];
    feiraGames.state.paid['p-x'] = 1;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-mod-'));
    const moderation = new FileModerationQueue(path.join(dir, 'moderation.jsonl'));
    moderation.push({ kind: 'warn', surface: 'chat', playerId: 'p-x', playerName: 'x', room: 'praca', text: 'a', labels: [], at: 1 });
    moderation.push({ kind: 'warn', surface: 'chat', playerId: 'p-y', playerName: 'y', room: 'praca', text: 'b', labels: [], at: 2 });
    const live: string[] = [];

    const out = deleteAccountCascade({ accounts, store, academies, padarias, feedback, feiraGames, moderation, forgetLive: (id) => live.push(id) }, r.account.id);
    expect(out).toMatchObject({ profileIds: ['p-x'], academies: 1, padarias: 1, feedback: 1, moderation: 1 });
    expect(live).toEqual([r.account.id]);
    expect(store.get('p-x')).toBeUndefined();
    expect(store.get('p-y')).toBeDefined();
    expect(academies.get('a1')).toBeUndefined();
    expect(academies.get('a2')?.members).toEqual(['p-y']);
    expect(padarias.list()).toHaveLength(0);
    expect(feedback.stored()).toBe(1);
    expect(feiraGames.state.paid['p-x']).toBeUndefined();
    expect(feiraGames.state.medals['p-x']).toBeUndefined();
    expect(fs.readFileSync(path.join(dir, 'moderation.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
    expect(accounts.get(r.account.id)).toBeUndefined();
    expect(deleteAccountCascade({ accounts, store, academies, padarias, feedback }, r.account.id)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
