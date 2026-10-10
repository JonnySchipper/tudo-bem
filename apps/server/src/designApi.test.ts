import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_APPEARANCE, ROOMS, bundledObjects, revertRoomProps, type PropDef, type ServerMsg } from '@tudobem/shared';
import { createApp } from './app.js';

type App = ReturnType<typeof createApp>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ADMIN_PW = 'painel-secreto-1';
const DESIGN_GET = ['/api/admin/design/state'];
const DESIGN_POST = ['/api/admin/design/draft', '/api/admin/design/draft/discard', '/api/admin/design/publish', '/api/admin/design/revert', '/api/admin/design/reset', '/api/admin/design/pr'];

const benchX = () => ROOMS.praca.props.find((p) => p.id === 'banco_4')!.x;
const moveBench = (objects: PropDef[], dx: number) => objects.map((p) => (p.id === 'banco_4' ? { ...p, x: p.x + dx } : p));

describe('design mode API (/api/admin/design/*)', () => {
  let app: App | null = null;
  let dir = '';
  let base = '';

  async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-design-'));
    app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 }, feedbackAdmin: { ready: true, password: ADMIN_PW }, githubToken: null, ...opts });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    revertRoomProps('praca');
    revertRoomProps('padaria');
  });

  const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]!;

  async function signIn(name = 'Jonny') {
    const res = await post('/api/admin/login', { password: ADMIN_PW, name });
    expect(res.status).toBe(200);
    const cookie = cookieOf(res);
    const get = async (p: string) => {
      const r = await fetch(`${base}/api/admin/design/${p}`, { headers: { cookie } });
      return { status: r.status, body: (await r.json()) as Json };
    };
    const write = async (p: string, b: unknown) => {
      const r = await post(`/api/admin/design/${p}`, b, { cookie });
      return { status: r.status, body: (await r.json()) as Json };
    };
    return { cookie, get, write };
  }

  /** A player standing in the praça, collecting what the server pushes. */
  async function player(name: string) {
    const reg = await post('/api/auth/register', { email: `${name.toLowerCase()}@exemplo.com`, password: 'pao-na-chapa-1', confirm18: true });
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws', { headers: { cookie: cookieOf(reg) } });
    const inbox: ServerMsg[] = [];
    ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
    await new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject)));
    const waitFor = async (t: ServerMsg['t'], ms = 4000) => {
      const end = Date.now() + ms;
      while (!inbox.some((m) => m.t === t)) {
        if (Date.now() > end) throw new Error(`timeout: ${t}`);
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    ws.send(JSON.stringify({ t: 'hello' }));
    await waitFor('needProfile');
    ws.send(JSON.stringify({ t: 'createProfile', name, pronoun: 'ele', appearance: DEFAULT_APPEARANCE }));
    await waitFor('welcome');
    ws.send(JSON.stringify({ t: 'join', room: 'praca' }));
    await waitFor('roomState');
    const layouts = () => inbox.filter((m): m is Extract<ServerMsg, { t: 'layout' }> => m.t === 'layout');
    const settle = () => new Promise((r) => setTimeout(r, 120));
    return { ws, layouts, settle };
  }

  const audit = (action: string) => app!.audit.list({ action });

  it('answers 401 without the admin cookie (a game session is not one), and refuses cross-site or non-JSON writes', async () => {
    await start();
    const routes = app!.adminApi.routes;
    for (const p of DESIGN_GET) expect(routes.get).toContain(p);
    for (const p of DESIGN_POST) expect(routes.post).toContain(p);
    for (const cookie of ['', 'tb_admin=made-up', 'tb_session=player-cookie']) {
      const headers: Record<string, string> = cookie ? { cookie } : {};
      for (const p of DESIGN_GET) expect([p, (await fetch(`${base}${p}?room=praca`, { headers })).status]).toEqual([p, 401]);
      for (const p of DESIGN_POST) expect([p, (await post(p, { room: 'praca', objects: bundledObjects('praca') }, headers)).status]).toEqual([p, 401]);
    }
    const { cookie } = await signIn();
    expect((await post('/api/admin/design/publish', { room: 'praca', objects: bundledObjects('praca') }, { cookie, origin: 'https://evil.example' })).status).toBe(403);
    const form = await fetch(`${base}/api/admin/design/publish`, { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' });
    expect(form.status).toBe(415);
    expect(benchX()).toBe(bundledObjects('praca').find((p) => p.id === 'banco_4')!.x);
    expect(audit('design.publish')).toHaveLength(0);
  });

  it('opens a room on the code layout, with the room list and no draft', async () => {
    await start();
    const { get } = await signIn();
    const s = await get('state?room=praca');
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({ ok: true, room: 'praca', source: 'code', rev: 0, draft: null, history: [], github: false });
    expect(s.body.live).toEqual(bundledObjects('praca'));
    expect(s.body.code).toEqual(bundledObjects('praca'));
    expect(s.body.rooms.map((r: Json) => r.id)).toContain('padaria');
    expect(s.body.rooms.map((r: Json) => r.id)).not.toContain('andar');
    expect((await get('state?room=lua')).status).toBe(400);
  });

  it('autosaves a draft that nobody else sees, and rejects an invalid one', async () => {
    await start();
    const lia = await player('Lia');
    const { get, write } = await signIn();
    const x0 = benchX();
    // a whole room is far over the 8 KB the other admin routes take
    const objects = moveBench(bundledObjects('praca'), 2);
    expect(JSON.stringify(objects).length).toBeGreaterThan(8 * 1024);
    const saved = await write('draft', { room: 'praca', objects, baseRev: 0 });
    expect(saved).toMatchObject({ status: 200, body: { ok: true, baseRev: 0 } });
    const s = await get('state?room=praca');
    expect(s.body.draft).toMatchObject({ by: expect.stringContaining('Jonny'), baseRev: 0 });
    expect(s.body.draft.objects.find((p: PropDef) => p.id === 'banco_4').x).toBe(x0 + 2);
    expect(s.body.rooms.find((r: Json) => r.id === 'praca')).toMatchObject({ draft: true, override: false });
    await lia.settle();
    expect(benchX()).toBe(x0);
    expect(lia.layouts()).toHaveLength(0);

    const bad = await write('draft', { room: 'praca', objects: [{ id: 'x', kind: 'dragao', x: 1, y: 1, blocks: true }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/Unknown type/);

    expect((await write('draft/discard', { room: 'praca' })).status).toBe(200);
    expect((await get('state?room=praca')).body.draft).toBeNull();
    // drafts are not audited (nobody else sees them); nothing above went live
    expect(app!.audit.list({}).filter((e) => e.action.startsWith('design.'))).toHaveLength(0);
  });

  it('publishes for everyone, audits it with the layout it replaced, and catches a stale publish', async () => {
    await start();
    const lia = await player('Lia');
    const { get, write } = await signIn('Jonny');
    const x0 = benchX();
    await write('draft', { room: 'praca', objects: moveBench(bundledObjects('praca'), 1), baseRev: 0 });

    const pub = await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 1), baseRev: 0 });
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ ok: true, rev: 1, diff: { added: [], removed: [], changed: [{ id: 'banco_4', fields: ['x'] }] } });
    expect(benchX()).toBe(x0 + 1);
    await lia.settle();
    expect(lia.layouts().at(-1)?.objects?.find((p) => p.id === 'banco_4')?.x).toBe(x0 + 1);

    const row = audit('design.publish')[0]!;
    expect(row).toMatchObject({ target: 'praca', actor: expect.stringContaining('Jonny'), hasSnapshot: true });
    expect(row.summary).toMatch(/published praca layout .*\+0 -0 ~1/);
    const entry = app!.audit.get(row.id)!;
    expect((entry.snapshot as { objects: PropDef[] }).objects.find((p) => p.id === 'banco_4')!.x).toBe(x0);

    const s = await get('state?room=praca');
    expect(s.body).toMatchObject({ source: 'override', rev: 1, draft: null, history: [{ objects: null }] });

    // a second editor that opened the room at rev 0 does not overwrite it without knowing
    const stale = await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 3), baseRev: 0 });
    expect(stale.status).toBe(409);
    expect(benchX()).toBe(x0 + 1);
    const forced = await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 3), baseRev: 0, force: true });
    expect(forced.status).toBe(200);
    expect(benchX()).toBe(x0 + 3);
    expect(audit('design.publish')).toHaveLength(2);

    const bad = await write('publish', { room: 'praca', objects: [{ id: 'x', kind: 'dragao', x: 1, y: 1, blocks: true }] });
    expect(bad.status).toBe(400);
    expect(audit('design.publish')).toHaveLength(2);
  });

  it('reverts to the version before the last publish, step by step, back to the code layout', async () => {
    await start();
    const lia = await player('Lia');
    const { get, write } = await signIn();
    const x0 = benchX();
    expect((await write('revert', { room: 'praca' })).status).toBe(409);
    await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 1) });
    await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 2) });
    expect(benchX()).toBe(x0 + 2);

    const r1 = await write('revert', { room: 'praca' });
    expect(r1.status).toBe(200);
    expect(benchX()).toBe(x0 + 1);
    expect((await get('state?room=praca')).body).toMatchObject({ source: 'override', history: [{ objects: null }] });

    expect((await write('revert', { room: 'praca' })).status).toBe(200);
    expect(benchX()).toBe(x0);
    expect((await get('state?room=praca')).body).toMatchObject({ source: 'code', history: [] });
    await lia.settle();
    expect(lia.layouts().at(-1)).toMatchObject({ room: 'praca', objects: null });
    expect((await write('revert', { room: 'praca' })).status).toBe(409);

    const rows = audit('design.revert');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.summary).toMatch(/code layout/);
    expect(rows.every((r) => r.hasSnapshot)).toBe(true);
  });

  it('resets a room to the code layout, keeps what was live so the reset can be reverted, and audits it', async () => {
    await start();
    const { get, write } = await signIn();
    const x0 = benchX();
    expect((await write('reset', { room: 'praca' })).status).toBe(409);
    await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 4) });
    const reset = await write('reset', { room: 'praca' });
    expect(reset.status).toBe(200);
    expect(benchX()).toBe(x0);
    expect((await get('state?room=praca')).body.source).toBe('code');
    expect(audit('design.reset')[0]).toMatchObject({ target: 'praca', hasSnapshot: true });
    // undo the reset
    expect((await write('revert', { room: 'praca' })).status).toBe(200);
    expect(benchX()).toBe(x0 + 4);
    expect((await write('reset', { room: 'lua' })).status).toBe(400);
  });

  it('keeps drafts, history and the live layout across a restart', async () => {
    await start();
    const { write } = await signIn();
    const x0 = benchX();
    await write('publish', { room: 'praca', objects: moveBench(bundledObjects('praca'), 1) });
    await write('draft', { room: 'padaria', objects: bundledObjects('padaria').slice(1) });
    await app!.close();
    revertRoomProps('praca');
    app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 }, feedbackAdmin: { ready: true, password: ADMIN_PW }, githubToken: null });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    expect(benchX()).toBe(x0 + 1);
    const again = await signIn();
    expect((await again.get('state?room=praca')).body).toMatchObject({ rev: 1, history: [{ objects: null }] });
    expect((await again.get('state?room=padaria')).body.draft.objects).toHaveLength(bundledObjects('padaria').length - 1);
  });

  it('hands back the file to download when TB_GITHUB_TOKEN is unset, without calling GitHub or changing the live room', async () => {
    let called = false;
    await start({
      githubFetch: () => {
        called = true;
        return Promise.resolve(new Response('{}'));
      },
    });
    const { write } = await signIn();
    const x0 = benchX();
    const r = await write('pr', { room: 'praca', objects: moveBench(bundledObjects('praca'), 1) });
    expect(r.body).toMatchObject({ ok: true, fallback: true, name: 'praca.json' });
    expect(JSON.parse(r.body.file).objects.find((p: PropDef) => p.id === 'banco_4').x).toBe(x0 + 1);
    expect(called).toBe(false);
    expect(benchX()).toBe(x0);
    expect(audit('design.download')).toHaveLength(1);
  });

  it('opens a pull request when a token is configured, and never returns or logs the token', async () => {
    const calls: { url: string; auth: string }[] = [];
    const fake = (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, auth: String((init?.headers as Record<string, string>)?.authorization ?? '') });
      const json = u.endsWith('/git/ref/heads/main') ? { object: { sha: 'abc' } } : u.endsWith('/pulls') ? { html_url: 'https://github.com/x/y/pull/9' } : {};
      return Promise.resolve(new Response(JSON.stringify(json), { status: u.includes('/contents/') && init?.method === 'GET' ? 404 : 200 }));
    };
    await start({ githubToken: 'ghp_segredo123', githubFetch: fake as typeof fetch });
    const { get, write } = await signIn();
    expect((await get('state?room=praca')).body.github).toBe(true);
    const r = await write('pr', { room: 'praca', objects: bundledObjects('praca') });
    expect(r.body).toEqual({ ok: true, url: 'https://github.com/x/y/pull/9' });
    expect(calls.every((c) => c.auth === 'Bearer ghp_segredo123')).toBe(true);
    const row = audit('design.pr')[0]!;
    expect(row.summary).toContain('pull/9');
    expect(JSON.stringify(row)).not.toContain('ghp_segredo123');
  });
});
