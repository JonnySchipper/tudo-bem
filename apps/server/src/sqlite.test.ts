import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { AccountStore } from './auth.js';
import { accountsFileAdapter, fileAdapter, layoutFileAdapter } from './fileStore.js';
import { ProfileStore, type StoredProfile } from './store.js';
import { backupDatabase, closeDatabase, openDatabase, sqlitePath } from './sqliteDb.js';
import { exportSqliteToJson } from './sqliteExport.js';

const HASH = 'scrypt$16384$8$5$c2FsdA$aGFzaA';
const TOKEN = 'secret-token-value';
const EMAIL = 'ana@exemplo.com';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tb-sqlite-'));
}

function writeFixtures(dir: string) {
  fs.writeFileSync(
    path.join(dir, 'accounts.json'),
    JSON.stringify({
      version: 1,
      accounts: [
        { id: 'acc-1', email: EMAIL, passwordHash: HASH, createdAt: 10 },
        { id: 'acc-2', email: 'bia@exemplo.com', passwordHash: HASH, createdAt: 11, profileId: 'p1' },
      ],
      sessions: [{ hash: 'sesshash1', accountId: 'acc-1', createdAt: 10, expiresAt: 99_000 }],
    }),
  );
  fs.writeFileSync(
    path.join(dir, 'profiles.json'),
    JSON.stringify([
      { id: 'p1', name: 'Ana', token: TOKEN, ageGate18: true, coins: 40, photos: [{ id: 'inline', at: 1, image: 'data:image/jpeg;base64,INLINE' }] },
      { id: 'p2', name: 'Bia', token: 'other-token', ageGate18: true, coins: 7 },
    ]),
  );
  fs.writeFileSync(
    path.join(dir, 'photos.json'),
    JSON.stringify({
      p1: [{ id: 'file', at: 2, image: 'data:image/jpeg;base64,FILE' }],
      p2: [{ id: 'shot', at: 3, image: 'data:image/jpeg;base64,SHOT' }],
    }),
  );
  fs.writeFileSync(path.join(dir, 'academies.json'), JSON.stringify([{ id: 'ac1', name: 'Sol', ownerId: 'p1' }]));
  fs.writeFileSync(path.join(dir, 'padarias.json'), JSON.stringify([{ id: 'pd1', name: 'Padaria da Bia', ownerId: 'p2' }]));
  fs.writeFileSync(
    path.join(dir, 'feedback.json'),
    JSON.stringify({
      version: 1,
      items: [{ id: 'abcd1234', createdAt: 5, text: 'a porta', category: null, contact: EMAIL, accountId: null, profileId: null, room: null }],
    }),
  );
  fs.writeFileSync(path.join(dir, 'feiraCart.json'), JSON.stringify({ version: 1, games: { pastel: 'on' } }));
  fs.writeFileSync(path.join(dir, 'feiraGames.json'), JSON.stringify({ day: '2026-10-08', scores: { p1: { name: 'Ana', best: 3 } }, medals: {}, paid: {} }));
  fs.writeFileSync(path.join(dir, 'layouts.json'), JSON.stringify({ version: 1, rooms: { praca: [{ id: 'bench' }] } }));
}

function counts(dir: string) {
  const db = openDatabase(dir);
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    accounts: n('SELECT COUNT(*) AS n FROM accounts'),
    sessions: n('SELECT COUNT(*) AS n FROM sessions'),
    profiles: n('SELECT COUNT(*) AS n FROM profiles'),
    photos: n('SELECT COUNT(*) AS n FROM photos'),
    academies: n('SELECT COUNT(*) AS n FROM academies'),
    padarias: n('SELECT COUNT(*) AS n FROM padarias'),
    feedback: n('SELECT COUNT(*) AS n FROM feedback'),
    feira_cart: n('SELECT COUNT(*) AS n FROM feira_cart'),
    feira_games: n('SELECT COUNT(*) AS n FROM feira_games'),
    layouts: n(`SELECT COUNT(*) AS n FROM kv WHERE key = 'layouts'`),
  };
}

describe('sqlite migration', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) closeDatabase(dir);
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('imports every json store, checks counts, and renames the files', () => {
    const dir = tempDir();
    dirs.push(dir);
    writeFixtures(dir);
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.map(String).join(' '));
    });
    try {
      openDatabase(dir);
    } finally {
      spy.mockRestore();
    }
    const text = logs.join('\n');
    expect(text).toContain('accounts=2 sessions=1 profiles=2 photos=2 academies=1 padarias=1 feedback=1 feira_cart=1 feira_games=1 layouts=1');
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain('scrypt$');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('data:image');
    expect(text).not.toContain('Ana');

    expect(counts(dir)).toEqual({
      accounts: 2,
      sessions: 1,
      profiles: 2,
      photos: 2,
      academies: 1,
      padarias: 1,
      feedback: 1,
      feira_cart: 1,
      feira_games: 1,
      layouts: 1,
    });
    expect((fs.statSync(sqlitePath(dir)).mode & 0o777) === 0o600).toBe(true);
    const db = openDatabase(dir);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('synchronous', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);

    const account = JSON.parse((db.prepare('SELECT json FROM accounts WHERE id = ?').get('acc-1') as { json: string }).json) as { email: string; passwordHash: string };
    expect(account.email).toBe(EMAIL);
    expect(account.passwordHash).toBe(HASH);
    const profile = (db.prepare('SELECT json FROM profiles WHERE id = ?').get('p1') as { json: string }).json;
    expect(profile).not.toContain('data:image');
    expect(profile).toContain('"name":"Ana"');
    const photo = JSON.parse((db.prepare('SELECT json FROM photos WHERE profile_id = ?').get('p1') as { json: string }).json) as { id: string; image: string }[];
    expect(photo[0]?.id).toBe('file');
    expect(photo[0]?.image).toContain('FILE');
    expect((db.prepare('SELECT json FROM academies WHERE id = ?').get('ac1') as { json: string }).json).toContain('"name":"Sol"');
    expect((db.prepare('SELECT json FROM feedback WHERE id = ?').get('abcd1234') as { json: string }).json).toContain('a porta');
    expect((db.prepare(`SELECT json FROM feira_games WHERE id = 'state'`).get() as { json: string }).json).toContain('2026-10-08');
    expect(JSON.parse((db.prepare(`SELECT json FROM kv WHERE key = 'layouts'`).get() as { json: string }).json)).toMatchObject({ version: 1 });

    for (const name of ['profiles.json', 'photos.json', 'accounts.json', 'academies.json', 'padarias.json', 'feedback.json', 'feiraCart.json', 'feiraGames.json', 'layouts.json']) {
      expect(fs.existsSync(path.join(dir, name)), name).toBe(false);
      expect(fs.readdirSync(dir).some((file) => file.startsWith(`${name}.migrated-`)), name).toBe(true);
    }

    const store = new ProfileStore(fileAdapter(dir));
    expect(store.get('p1')?.name).toBe('Ana');
    expect(store.get('p1')?.coins).toBe(40);
    expect(store.get('p1')?.photos?.[0]?.id).toBe('file');
    const accounts = new AccountStore(accountsFileAdapter(dir));
    expect(accounts.get('acc-1')?.passwordHash).toBe(HASH);
    expect(accounts.get('acc-2')?.profileId).toBe('p1');
    expect(layoutFileAdapter(dir).load()).toMatchObject({ rooms: { praca: [{ id: 'bench' }] } });
  });

  it('does not import again when the json files are still there after a committed migration', () => {
    const dir = tempDir();
    dirs.push(dir);
    writeFixtures(dir);
    openDatabase(dir);
    closeDatabase(dir);
    for (const name of fs.readdirSync(dir)) {
      const migrated = name.match(/^(.*\.json)\.migrated-/);
      if (migrated) fs.copyFileSync(path.join(dir, name), path.join(dir, migrated[1]!));
    }
    openDatabase(dir);
    expect(counts(dir).profiles).toBe(2);
    expect(counts(dir).accounts).toBe(2);
    expect(fs.existsSync(path.join(dir, 'profiles.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'accounts.json'))).toBe(false);
  });

  it('leaves the json files in place when a file is unreadable, then imports once it is valid', () => {
    const dir = tempDir();
    dirs.push(dir);
    writeFixtures(dir);
    fs.writeFileSync(path.join(dir, 'accounts.json'), '{');
    expect(() => openDatabase(dir)).toThrow(/accounts\.json is not valid JSON/);
    expect(fs.existsSync(path.join(dir, 'profiles.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'accounts.json'))).toBe(true);
    const raw = new Database(path.join(dir, 'tudobem.sqlite'));
    expect((raw.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n).toBe(0);
    expect(raw.prepare(`SELECT value FROM meta WHERE key = 'json_imported'`).get()).toBeUndefined();
    raw.close();
    writeFixtures(dir);
    openDatabase(dir);
    expect(counts(dir).profiles).toBe(2);
    expect(counts(dir).accounts).toBe(2);
    expect(fs.existsSync(path.join(dir, 'profiles.json'))).toBe(false);
  });

  it('imports again from restored json after the database file is removed', () => {
    const dir = tempDir();
    dirs.push(dir);
    writeFixtures(dir);
    openDatabase(dir);
    const migrated = fs.readdirSync(dir).filter((name) => name.includes('.json.migrated-'));
    closeDatabase(dir);
    fs.rmSync(sqlitePath(dir), { force: true });
    fs.rmSync(sqlitePath(dir) + '-wal', { force: true });
    fs.rmSync(sqlitePath(dir) + '-shm', { force: true });
    for (const name of migrated) {
      const original = name.replace(/\.migrated-.*$/, '');
      fs.copyFileSync(path.join(dir, name), path.join(dir, original));
    }
    openDatabase(dir);
    expect(counts(dir)).toMatchObject({ profiles: 2, accounts: 2, photos: 2, layouts: 1 });
    const hash = JSON.parse((openDatabase(dir).prepare('SELECT json FROM accounts WHERE id = ?').get('acc-1') as { json: string }).json) as { passwordHash: string };
    expect(hash.passwordHash).toBe(HASH);
  });
});

describe('sqlite per-record writes', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) closeDatabase(dir);
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('updates one profile and one photo row without rewriting the others', () => {
    const dir = tempDir();
    dirs.push(dir);
    const photo = (id: string) => ({ id, at: 1, image: `data:image/jpeg;base64,${id}` });
    const row = (id: string, name: string, photos?: ReturnType<typeof photo>[]) => ({ id, name, token: id, ageGate18: true as const, ...(photos ? { photos } : {}) }) as unknown as StoredProfile;
    const adapter = fileAdapter(dir);
    adapter.load();
    const rows = [row('p1', 'Ana', [photo('a1')]), row('p2', 'Bia')];
    adapter.save(rows);
    const db = openDatabase(dir);
    const before = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    const p1 = (db.prepare('SELECT json FROM profiles WHERE id = ?').get('p1') as { json: string }).json;
    adapter.save(rows);
    const same = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    expect(same).toBe(before);
    expect((db.prepare('SELECT json FROM profiles WHERE id = ?').get('p1') as { json: string }).json).toBe(p1);

    rows[1] = row('p2', 'Bia Maria');
    adapter.save(rows);
    expect((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(before + 1);
    expect((db.prepare('SELECT json FROM profiles WHERE id = ?').get('p1') as { json: string }).json).toBe(p1);
    expect((db.prepare('SELECT json FROM profiles WHERE id = ?').get('p2') as { json: string }).json).toContain('Bia Maria');
    expect((db.prepare('SELECT json FROM profiles').all() as { json: string }[]).join('\n')).not.toContain('data:image');

    rows[0] = row('p1', 'Ana', [photo('a2')]);
    adapter.save(rows);
    const loaded = fileAdapter(dir).load();
    expect(loaded.find((r) => r.id === 'p1')?.photos?.map((p) => p.id)).toEqual(['a2']);
    expect(loaded.find((r) => r.id === 'p2')?.photos).toBeUndefined();

    adapter.save([rows[1]!]);
    expect((db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT json FROM profiles WHERE id = ?').get('p2') as { json: string }).json).toContain('Bia Maria');
  });
});

describe('sqlite backup and export', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) closeDatabase(dir);
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a backup file and keeps only the newest that fit', async () => {
    const dir = tempDir();
    dirs.push(dir);
    const db = openDatabase(dir);
    db.prepare('INSERT INTO profiles (id, json) VALUES (?, ?)').run('p1', JSON.stringify({ id: 'p1', name: 'Ana' }));
    const first = await backupDatabase(db, dir, { force: true, keep: 2, maxBytes: 100_000_000 });
    expect(first).toBeTruthy();
    const size = fs.statSync(first!).size;
    expect(size).toBeGreaterThan(0);
    expect(fs.statSync(first!).mode & 0o777).toBe(0o600);
    expect(await backupDatabase(db, dir, { keep: 2, maxBytes: 100_000_000 })).toBeNull();

    await backupDatabase(db, dir, { force: true, keep: 2, maxBytes: 100_000_000 });
    await backupDatabase(db, dir, { force: true, keep: 2, maxBytes: 100_000_000 });
    expect(fs.readdirSync(path.join(dir, 'backups')).filter((name) => name.endsWith('.sqlite'))).toHaveLength(2);

    db.pragma('wal_checkpoint(TRUNCATE)');
    const live = fs.statSync(sqlitePath(dir)).size;
    const cap = Math.max(live, size) + 1000;
    await backupDatabase(db, dir, { force: true, keep: 10, maxBytes: cap });
    expect(fs.readdirSync(path.join(dir, 'backups')).filter((name) => name.endsWith('.sqlite'))).toHaveLength(1);

    const skipped = await backupDatabase(db, dir, { force: true, maxBytes: 1 });
    expect(skipped).toBeNull();
  });

  it('exports json a previous build can import, with the same password hash', () => {
    const dir = tempDir();
    dirs.push(dir);
    writeFixtures(dir);
    openDatabase(dir);
    const n = exportSqliteToJson(openDatabase(dir), dir);
    expect(n).toBeGreaterThan(0);
    const accounts = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8')) as { accounts: { passwordHash: string; email: string }[] };
    expect(accounts.accounts.find((a) => a.email === EMAIL)?.passwordHash).toBe(HASH);
    expect(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8')).not.toContain('plaintext');
    const fresh = tempDir();
    dirs.push(fresh);
    for (const name of ['profiles.json', 'photos.json', 'accounts.json', 'academies.json', 'padarias.json', 'feedback.json', 'feiraCart.json', 'feiraGames.json', 'layouts.json']) {
      fs.copyFileSync(path.join(dir, name), path.join(fresh, name));
    }
    openDatabase(fresh);
    expect(counts(fresh).profiles).toBe(2);
    const hash = JSON.parse((openDatabase(fresh).prepare('SELECT json FROM accounts WHERE id = ?').get('acc-1') as { json: string }).json) as { passwordHash: string };
    expect(hash.passwordHash).toBe(HASH);
  });
});
