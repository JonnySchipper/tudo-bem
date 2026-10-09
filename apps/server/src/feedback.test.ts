import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { FeedbackStore } from './feedbackStore.js';
import { feedbackFileAdapter } from './fileStore.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';

const NOTE = 'A porta da padaria não abre direito.';
const ADMIN = 'tb-admin-praca';

describe('feedback store', () => {
  it('round-trips newest-first, keeps the database private, and skips an unreadable row', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-fb-'));
    const store = new FeedbackStore(feedbackFileAdapter(dir));
    store.add({ text: 'primeiro recado da praça', category: null, contact: null, accountId: null, profileId: null, room: null, createdAt: 10 });
    store.add({ text: 'segundo recado da rua', category: 'idea', contact: 'joao', accountId: null, profileId: null, room: 'rua', createdAt: 20 });
    const again = new FeedbackStore(feedbackFileAdapter(dir));
    expect(again.list({ limit: 1 }).map((row) => row.text)).toEqual(['segundo recado da rua']);
    expect(again.list({ limit: 10, since: 20 })).toHaveLength(1);
    expect(again.count(11)).toBe(1);
    const mode = fs.statSync(path.join(dir, 'tudobem.sqlite')).mode & 0o777;
    expect(mode).toBe(0o600);

    openDatabase(dir).prepare('INSERT INTO feedback (id, created_at, json) VALUES (?, ?, ?)').run('abcd9999', 1, '{');
    const fresh = new FeedbackStore(feedbackFileAdapter(dir));
    expect(fresh.stored()).toBe(2);
    closeDatabase(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('POST /api/feedback and the review list', () => {
  let app: ReturnType<typeof createApp> | null = null;
  let dir = '';
  let base = '';

  async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-fb-http-'));
    app = createApp({
      dataDir: dir,
      scrypt: { N: 1024, r: 8, p: 1 },
      feedbackAdmin: { ready: true, password: ADMIN },
      ...opts,
    });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    await app?.close();
    app = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + '/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  const saved = () => {
    const items = (openDatabase(dir).prepare('SELECT json FROM feedback').all() as { json: string }[]).map((row) => JSON.parse(row.json) as Record<string, unknown>);
    return { items };
  };

  it('stores a guest note with an optional contact and lists it for the admin password', async () => {
    await start();
    const created = await post({ text: NOTE, category: 'bug', contact: 'Ana@Exemplo.com', room: 'padaria' });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ ok: true });
    const row = saved().items[0]!;
    expect(row).toMatchObject({ text: NOTE, category: 'bug', contact: 'ana@exemplo.com', accountId: null, room: 'padaria' });
    expect(JSON.stringify(row)).not.toContain('password');

    expect((await fetch(base + '/api/feedback')).status).toBe(401);
    expect((await fetch(base + '/api/feedback', { headers: { authorization: 'Bearer nope-nope-nope' } })).status).toBe(401);
    const list = await fetch(base + '/api/feedback?limit=10', { headers: { authorization: `Bearer ${ADMIN}` } });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { ok: boolean; total: number; items: Array<{ text: string; at: string }> };
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
    expect(body.items[0]?.text).toBe(NOTE);
    expect(body.items[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps a signed-in player by account id and drops the contact and the email', async () => {
    await start();
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'Dona@Exemplo.com', password: 'pao-na-chapa-1' }),
    });
    expect(reg.status).toBe(201);
    const created = await post({ text: NOTE, contact: 'secret@exemplo.com', category: 'love' }, { cookie: cookieOf(reg) });
    expect(created.status).toBe(201);
    const file = (openDatabase(dir).prepare('SELECT json FROM feedback').all() as { json: string }[]).map((row) => row.json).join('\n');
    expect(file).not.toContain('secret@exemplo.com');
    expect(file).not.toContain('dona@exemplo.com');
    expect(file).not.toContain('Dona@Exemplo.com');
    const row = saved().items[0]!;
    expect(row.contact).toBeNull();
    expect(row.category).toBe('love');
    expect(typeof row.accountId).toBe('string');
    expect(String(row.accountId).length).toBeGreaterThan(8);
  });

  it('refuses an insult and an email inside the note, and does not file them for review', async () => {
    await start();
    const insult = await post({ text: 'você é um idiota' });
    expect(insult.status).toBe(400);
    expect(await insult.json()).toMatchObject({ ok: false, code: 'unsafe' });
    expect((openDatabase(dir).prepare('SELECT COUNT(*) AS n FROM feedback').get() as { n: number }).n).toBe(0);
    expect(app!.world.services.moderation.recent(5).some((ev) => ev.surface === 'feedback' && ev.kind === 'block')).toBe(true);

    const pii = await post({ text: 'Me escreve em foo@bar.com por favor.' });
    expect(pii.status).toBe(400);
    expect(await pii.json()).toMatchObject({ ok: false, code: 'pii' });
    expect((openDatabase(dir).prepare('SELECT COUNT(*) AS n FROM feedback').get() as { n: number }).n).toBe(0);
  });

  it('accepts several notes in a row, then asks a guest to wait, and rejects another site', async () => {
    await start();
    for (let i = 0; i < 5; i++) {
      const res = await post({ text: `${NOTE} número ${i + 1}` });
      expect(res.status, `note ${i}`).toBe(201);
    }
    expect(saved().items).toHaveLength(5);
    expect((await post({ text: `${NOTE} número 6` })).status).toBe(429);

    const evil = await post({ text: NOTE }, { origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
  });

  it('hides the list when admin login is off, and still accepts notes', async () => {
    await start({ feedbackAdmin: { ready: false } });
    expect((await fetch(base + '/api/feedback', { headers: { authorization: `Bearer ${ADMIN}` } })).status).toBe(404);
    expect((await post({ text: NOTE, category: 'idea', room: 'nope' })).status).toBe(201);
    expect(saved().items[0]).toMatchObject({ category: 'idea', room: null });
  });
});
