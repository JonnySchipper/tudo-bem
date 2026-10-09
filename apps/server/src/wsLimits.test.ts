import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createApp } from './app.js';
import { DEFAULT_WS_LIMITS, IpConnectionCap, MessageBucket, readWsLimits } from './wsLimits.js';
import { FileModerationQueue } from './services/fileModeration.js';

describe('MessageBucket', () => {
  it('allows the burst, refills at the rate, and turns abusive only on sustained drops', () => {
    let t = 0;
    const b = new MessageBucket({ rate: 20, burst: 40, abuseDrops: 50, abuseWindowMs: 10_000 }, () => t);
    for (let i = 0; i < 40; i++) expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    t += 500; // 10 tokens back
    for (let i = 0; i < 10; i++) expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    expect(b.abusive).toBe(false);
    for (let i = 0; i < 60; i++) b.take();
    expect(b.abusive).toBe(true);
  });

  it('never throttles normal play: a walk step every 100 ms plus counter-game taps at 8/s for a minute', () => {
    let t = 0;
    const b = new MessageBucket(DEFAULT_WS_LIMITS, () => t);
    let dropped = 0;
    for (let ms = 0; ms < 60_000; ms += 25) {
      t = ms;
      if (ms % 100 === 0 && !b.take()) dropped++;
      if (ms % 125 === 0 && !b.take()) dropped++;
    }
    expect(dropped).toBe(0);
  });
});

describe('IpConnectionCap + env', () => {
  it('caps per IP and frees on release', () => {
    const cap = new IpConnectionCap(2);
    expect(cap.acquire('a')).toBe(true);
    expect(cap.acquire('a')).toBe(true);
    expect(cap.acquire('a')).toBe(false);
    expect(cap.acquire('b')).toBe(true);
    cap.release('a');
    expect(cap.acquire('a')).toBe(true);
  });

  it('reads overrides and lifts the IP cap on test servers', () => {
    expect(readWsLimits({}).maxPerIp).toBe(8);
    expect(readWsLimits({ TB_WS_MAX_PER_IP: '3', TB_WS_RATE: '5' })).toMatchObject({ maxPerIp: 3, rate: 5 });
    expect(readWsLimits({ TB_TEST_CLOCK_CONTROL: '1' }).maxPerIp).toBe(200);
  });
});

describe('FileModerationQueue', () => {
  it('rolls the log over past the cap and reloads the tail on restart', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-mod-'));
    const file = path.join(dir, 'moderation.jsonl');
    const q = new FileModerationQueue(file, 600);
    for (let i = 0; i < 10; i++) q.push({ kind: 'warn', surface: 'chat', playerId: 'p', playerName: 'P', room: 'r', text: `linha ${i}`, labels: [], at: i });
    expect(fs.statSync(file).size).toBeLessThanOrEqual(600);
    expect(fs.existsSync(file + '.1')).toBe(true);
    const again = new FileModerationQueue(file, 600);
    expect(again.recent(100).at(-1)?.text).toBe('linha 9');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('WebSocket limits on the real server', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let dir = '';
  let base = '';

  async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-wsl-'));
    app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 }, ...opts });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  function open(): Promise<{ ws: WebSocket; closed: Promise<number>; got: () => number }> {
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
    let got = 0;
    ws.on('message', () => got++);
    const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve({ ws, closed, got: () => got }));
      ws.once('error', reject);
    });
  }

  it('drops a flood and closes the socket with 1008 when it keeps going', async () => {
    await start({ wsLimits: { rate: 5, burst: 5, abuseDrops: 20, abuseWindowMs: 10_000 } });
    const c = await open();
    for (let i = 0; i < 40; i++) c.ws.send(JSON.stringify({ t: 'ping' }));
    expect(await c.closed).toBe(1008);
    expect(c.got()).toBeLessThanOrEqual(5);
  });

  it('caps concurrent sockets per IP', async () => {
    await start({ wsLimits: { maxPerIp: 2 } });
    const a = await open();
    const b = await open();
    const c = await open();
    expect(await c.closed).toBe(1008);
    a.ws.close();
    await a.closed;
    await new Promise((r) => setTimeout(r, 50));
    const d = await open();
    expect(d.ws.readyState).toBe(WebSocket.OPEN);
    b.ws.close();
    d.ws.close();
  });

  it('closes a socket that never says hello (or has no session)', async () => {
    await start({ wsLimits: { helloTimeoutMs: 150 } });
    const c = await open();
    expect(await c.closed).toBe(1008);
  });

  it('GET /api/moderation needs the admin password', async () => {
    await start({ feedbackAdmin: { ready: true, password: 'segredo-admin-123' } });
    expect((await fetch(base + '/api/moderation')).status).toBe(401);
    expect((await fetch(base + '/api/moderation', { headers: { authorization: 'Bearer errada' } })).status).toBe(401);
    app!.world.services.moderation.push({ kind: 'report', surface: 'profile', playerId: 'a', playerName: 'Ana', room: 'praca', text: 'x', labels: ['spam'], targetId: 'b', reason: 'spam', lines: ['x'], status: 'pending', at: 5 });
    const res = await fetch(base + '/api/moderation?kind=report', { headers: { authorization: 'Bearer segredo-admin-123' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; items: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([expect.objectContaining({ kind: 'report', targetId: 'b', reason: 'spam', lines: ['x'] })]);
    expect((await fetch(base + '/api/moderation?limit=0', { headers: { authorization: 'Bearer segredo-admin-123' } })).status).toBe(400);
  });
});
