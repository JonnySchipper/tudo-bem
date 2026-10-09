import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { CLOSE_RESTART, createApp } from './app.js';
import { SQLITE_FILE } from './sqliteDb.js';
import type { StoredProfile } from './store.js';

describe('app.close (graceful shutdown)', () => {
  let dir = '';
  afterEach(() => {
    vi.restoreAllMocks();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('writes the stores before closing sockets with 1012, writes again after, and ignores a second call', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-shutdown-'));
    const app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 } });
    await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()));
    const port = (app.server.address() as AddressInfo).port;

    const order: string[] = [];
    const flush = app.store.flush.bind(app.store);
    const shutdown = app.store.shutdown.bind(app.store);
    vi.spyOn(app.store, 'flush').mockImplementation(() => (order.push('flush'), flush()));
    vi.spyOn(app.store, 'shutdown').mockImplementation(() => (order.push('shutdown'), shutdown()));

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve, reject) => (ws.once('open', () => resolve()), ws.once('error', reject)));
    const closed = new Promise<number>((resolve) => ws.once('close', (code) => (order.push('socket closed'), resolve(code))));

    // a change still inside the debounce window when the signal lands
    app.store.add({ id: 'p1', name: 'Ana', token: 'tok-1', ageGate18: true } as StoredProfile);

    const first = app.close();
    const second = app.close();
    expect(second).toBe(first);
    await first;
    expect(await closed).toBe(CLOSE_RESTART);
    expect(order.indexOf('flush')).toBe(0);
    expect(order.indexOf('flush')).toBeLessThan(order.indexOf('socket closed'));
    expect(order).toContain('shutdown');
    expect(app.server.listening).toBe(false);

    const db = new Database(path.join(dir, SQLITE_FILE), { readonly: true });
    expect((db.prepare('SELECT json FROM profiles WHERE id = ?').get('p1') as { json: string }).json).toContain('"name":"Ana"');
    db.close();
  });

  it('rejects when the final write fails, so the process exits non-zero', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-shutdown-'));
    const app = createApp({ dataDir: dir, scrypt: { N: 1024, r: 8, p: 1 } });
    await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(app.store, 'shutdown').mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(app.close()).rejects.toThrow(/profiles/);
  });
});
