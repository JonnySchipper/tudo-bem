import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import type { AddressInfo } from 'node:net';
import type { IncomingMessage } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { clientIp } from './auth.js';
import { parseRange } from './httpStatic.js';

type App = ReturnType<typeof createApp>;

/** Raw request (fetch would normalise odd paths and transparently gunzip). */
function raw(base: string, p: string, headers: Record<string, string> = {}, method = 'GET') {
  const u = new URL(base);
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const r = http.request({ host: u.hostname, port: u.port, path: p, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    r.end();
  });
}

describe('server: HTTP hardening and static client', () => {
  let app: App | null = null;
  let dir = '';
  let dist = '';
  let base = '';
  const js = 'console.log("vila ipê");\n'.repeat(200);
  const mp3 = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));

  async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-http-'));
    dist = path.join(dir, 'dist');
    fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dist, 'audio/tts'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Tudo Bem</title>');
    fs.writeFileSync(path.join(dist, 'assets/main-abc123.js'), js);
    fs.writeFileSync(path.join(dist, 'audio/tts/carlos-0123456789.mp3'), mp3);
    app = createApp({ dataDir: path.join(dir, 'data'), clientDist: dist, scrypt: { N: 1024, r: 8, p: 1 }, ...opts });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('survives malformed URLs and answers 400', async () => {
    await start();
    expect((await raw(base, '//')).status).toBe(400);
    expect((await raw(base, '/%E0%A4%A')).status).toBe(400);
    expect((await raw(base, '/assets/%E0%A4%A.js')).status).toBe(400);
    // still alive
    expect((await raw(base, '/healthz')).status).toBe(200);
  });

  it('a throwing route answers 500 without a stack and keeps the server up', async () => {
    await start();
    const orig = app!.world.gameMinuteNow.bind(app!.world);
    app!.world.gameMinuteNow = () => {
      throw new Error('boom secret');
    };
    const r = await raw(base, '/healthz');
    expect(r.status).toBe(500);
    expect(r.body.toString()).not.toContain('boom');
    app!.world.gameMinuteNow = orig;
    expect((await raw(base, '/healthz')).status).toBe(200);
  });

  it('sets security headers on every response, HSTS only over https', async () => {
    await start();
    for (const p of ['/', '/healthz', '/api/config', '/nope.js']) {
      const r = await raw(base, p);
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-frame-options']).toBe('DENY');
      expect(r.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(r.headers['content-security-policy-report-only']).toContain("default-src 'self'");
      expect(r.headers['content-security-policy-report-only']).toContain('https://accounts.google.com/gsi/client');
      expect(r.headers['strict-transport-security']).toBeUndefined();
    }
    const https = await raw(base, '/', { 'x-forwarded-proto': 'https' });
    expect(https.headers['strict-transport-security']).toBe('max-age=31536000');
  });

  it('public /healthz has no counts; the admin bearer sees them', async () => {
    await start({ feedbackAdmin: { ready: true, password: 'admin-pass-123' } });
    const pub = JSON.parse((await raw(base, '/healthz')).body.toString());
    expect(pub).toEqual({ ok: true, gameMinute: expect.any(Number), jev: { state: 'stub' } });
    const wrong = JSON.parse((await raw(base, '/healthz', { authorization: 'Bearer nope' })).body.toString());
    expect(wrong.players).toBeUndefined();
    const admin = JSON.parse((await raw(base, '/healthz', { authorization: 'Bearer admin-pass-123' })).body.toString());
    expect(admin).toMatchObject({ ok: true, players: 0, accounts: 0, jev: { state: 'stub' } });
  });

  it('404s missing assets and files with an extension; extensionless paths get the game shell', async () => {
    await start();
    for (const p of ['/assets/gone-123.js', '/pixel/manifest.json', '/audio/tts/x.mp3', '/icons/nope.png', '/brand/x', '/missing.png']) {
      const r = await raw(base, p);
      expect(r.status, p).toBe(404);
      expect(r.body.toString()).not.toContain('<title>Tudo Bem');
    }
    const nav = await raw(base, '/some/route');
    expect(nav.status).toBe(200);
    expect(nav.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(nav.headers['cache-control']).toBe('no-cache');
    expect((await raw(base, '/../../etc/passwd')).status).not.toBe(500);
  });

  it('serves mp3 with length, validators and byte ranges', async () => {
    await start();
    const p = '/audio/tts/carlos-0123456789.mp3';
    const full = await raw(base, p, { 'accept-encoding': 'gzip' });
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toBe('audio/mpeg');
    expect(full.headers['content-length']).toBe('1000');
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.headers['content-encoding']).toBeUndefined();
    expect(full.headers['cache-control']).toContain('immutable');
    expect(full.headers.etag).toMatch(/^".+"$/);
    expect(full.headers['last-modified']).toBeTruthy();

    const part = await raw(base, p, { range: 'bytes=0-1' });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 0-1/1000');
    expect(part.headers['content-length']).toBe('2');
    expect([...part.body]).toEqual([0, 1]);

    const tail = await raw(base, p, { range: 'bytes=-10' });
    expect(tail.status).toBe(206);
    expect(tail.headers['content-range']).toBe('bytes 990-999/1000');
    expect(tail.body.equals(mp3.subarray(990))).toBe(true);

    const open = await raw(base, p, { range: 'bytes=500-' });
    expect(open.headers['content-range']).toBe('bytes 500-999/1000');

    const bad = await raw(base, p, { range: 'bytes=5000-6000' });
    expect(bad.status).toBe(416);
    expect(bad.headers['content-range']).toBe('bytes */1000');

    const inm = await raw(base, p, { 'if-none-match': full.headers.etag! });
    expect(inm.status).toBe(304);
    expect(inm.body.length).toBe(0);
    const ims = await raw(base, p, { 'if-modified-since': full.headers['last-modified']! });
    expect(ims.status).toBe(304);
    const stale = await raw(base, p, { 'if-none-match': '"other"' });
    expect(stale.status).toBe(200);
  });

  it('gzips text on the fly, prefers a precompressed sibling, and revalidates the gzip copy', async () => {
    await start();
    const p = '/assets/main-abc123.js';
    const plain = await raw(base, p);
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.headers.vary).toBe('Accept-Encoding');
    expect(plain.body.toString()).toBe(js);

    const gz = await raw(base, p, { 'accept-encoding': 'gzip, deflate, br' });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gz.headers.vary).toBe('Accept-Encoding');
    expect(Number(gz.headers['content-length'])).toBe(gz.body.length);
    expect(gz.body.length).toBeLessThan(js.length);
    expect(zlib.gunzipSync(gz.body).toString()).toBe(js);
    expect(gz.headers.etag).not.toBe(plain.headers.etag);
    expect((await raw(base, p, { 'accept-encoding': 'gzip', 'if-none-match': gz.headers.etag! })).status).toBe(304);
    expect((await raw(base, p, { 'accept-encoding': 'gzip;q=0' })).headers['content-encoding']).toBeUndefined();

    // a range on text is served from the identity file, never compressed
    const ranged = await raw(base, p, { 'accept-encoding': 'gzip', range: 'bytes=0-9' });
    expect(ranged.status).toBe(206);
    expect(ranged.headers['content-encoding']).toBeUndefined();

    fs.writeFileSync(path.join(dist, 'assets/main-abc123.js.br'), zlib.brotliCompressSync(js));
    const br = await raw(base, p, { 'accept-encoding': 'gzip, br' });
    expect(br.headers['content-encoding']).toBe('br');
    expect(zlib.brotliDecompressSync(br.body).toString()).toBe(js);
  });

  it('HEAD sends headers only; other methods get 405', async () => {
    await start();
    const head = await raw(base, '/audio/tts/carlos-0123456789.mp3', {}, 'HEAD');
    expect(head.status).toBe(200);
    expect(head.headers['content-length']).toBe('1000');
    expect(head.body.length).toBe(0);
    expect((await raw(base, '/', {}, 'POST')).status).toBe(405);
  });
});

describe('parseRange', () => {
  it('handles the single-range forms', () => {
    expect(parseRange(undefined, 10)).toBeNull();
    expect(parseRange('bytes=0-0', 10)).toEqual({ start: 0, end: 0 });
    expect(parseRange('bytes=2-', 10)).toEqual({ start: 2, end: 9 });
    expect(parseRange('bytes=5-100', 10)).toEqual({ start: 5, end: 9 });
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange('bytes=-30', 10)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=10-', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=0-1,4-5', 10)).toBeNull();
    expect(parseRange('items=0-1', 10)).toBeNull();
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => ({ headers, socket: { remoteAddress: '10.0.0.9' } }) as unknown as IncomingMessage;

  it('trusts Fly-Client-IP only on Fly', () => {
    expect(clientIp(req({ 'fly-client-ip': '1.2.3.4' }), { FLY_APP_NAME: 'tudo-bem' })).toBe('1.2.3.4');
    expect(clientIp(req({ 'fly-client-ip': '1.2.3.4' }), {})).toBe('10.0.0.9');
  });

  it('uses the first X-Forwarded-For hop only with TB_TRUST_PROXY=1', () => {
    const r = req({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' });
    expect(clientIp(r, {})).toBe('10.0.0.9');
    expect(clientIp(r, { TB_TRUST_PROXY: '1' })).toBe('5.6.7.8');
  });
});
