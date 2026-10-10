import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileAdapter } from './fileStore.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';
import { ProfileStore, STORE_RETRY_BASE_MS, STORE_SAVE_DEBOUNCE_MS, type PersistenceAdapter, type StoredProfile } from './store.js';

const profile = (id: string) => ({ id, name: id, token: `t-${id}`, ageGate18: true, coins: 0 }) as unknown as StoredProfile;

function spyAdapter(rows: StoredProfile[] = []) {
  const upserts: string[][] = [];
  const removes: string[][] = [];
  const adapter: PersistenceAdapter & { failNext: number } = {
    failNext: 0,
    describe: () => 'spy',
    load: () => rows,
    save: () => {
      throw new Error('whole-set save must not be used when upsert exists');
    },
    upsert: (r) => {
      if (adapter.failNext > 0) {
        adapter.failNext--;
        throw new Error('disk full');
      }
      upserts.push(r.map((p) => p.id));
    },
    remove: (ids) => void removes.push([...ids]),
  };
  return { adapter, upserts, removes };
}

describe('ProfileStore writes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes only the profiles marked dirty', () => {
    const { adapter, upserts } = spyAdapter([profile('a'), profile('b'), profile('c')]);
    const store = new ProfileStore(adapter);
    store.get('b')!.coins = 5;
    store.save('b');
    store.save('b');
    vi.advanceTimersByTime(STORE_SAVE_DEBOUNCE_MS);
    expect(upserts).toEqual([['b']]);
    store.flush();
    expect(upserts).toHaveLength(1);
  });

  it('offers every profile once for a save() without ids, and never deletes', () => {
    const { adapter, upserts, removes } = spyAdapter([profile('a'), profile('b')]);
    const store = new ProfileStore(adapter);
    store.save();
    store.flush();
    expect(upserts).toEqual([['a', 'b']]);
    expect(removes).toEqual([]);
  });

  it('deletes only through remove(id)', () => {
    const { adapter, upserts, removes } = spyAdapter([profile('a'), profile('b')]);
    const store = new ProfileStore(adapter);
    store.save('a');
    expect(store.remove('a')).toBe(true);
    expect(store.remove('nobody')).toBe(false);
    expect(store.get('a')).toBeUndefined();
    expect(store.byTokenGet('t-a')).toBeUndefined();
    store.flush();
    expect(removes).toEqual([['a']]);
    expect(upserts).toEqual([[]]);
  });

  it('refuses to start when the profiles cannot be read', () => {
    const adapter: PersistenceAdapter = {
      describe: () => 'broken',
      load: () => {
        throw new Error('SQLITE_CORRUPT');
      },
      save: () => {},
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => new ProfileStore(adapter)).toThrow(/SQLITE_CORRUPT/);
  });

  it('keeps the dirty set after a failed timer write, records it, and retries with backoff', () => {
    const { adapter, upserts } = spyAdapter([profile('a')]);
    const store = new ProfileStore(adapter);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    adapter.failNext = 2;
    store.save('a');
    vi.advanceTimersByTime(STORE_SAVE_DEBOUNCE_MS);
    expect(upserts).toEqual([]);
    expect(store.health()).toMatchObject({ lastFlushOk: null, lastFlushError: 'disk full', failures: 1, pending: 1 });
    expect(err).toHaveBeenCalled();
    vi.advanceTimersByTime(STORE_RETRY_BASE_MS);
    expect(store.health().failures).toBe(2);
    vi.advanceTimersByTime(STORE_RETRY_BASE_MS); // second retry waits twice as long
    expect(upserts).toEqual([]);
    vi.advanceTimersByTime(STORE_RETRY_BASE_MS);
    expect(upserts).toEqual([['a']]);
    expect(store.health()).toMatchObject({ failures: 0, pending: 0 });
    expect(store.health().lastFlushOk).not.toBeNull();
  });

  it('flush() throws so a caller (shutdown) can tell the write failed', () => {
    const { adapter } = spyAdapter([profile('a')]);
    const store = new ProfileStore(adapter);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    adapter.failNext = 1;
    store.save('a');
    expect(() => store.flush()).toThrow(/disk full/);
    expect(store.health().pending).toBe(1);
  });

  it('shutdown offers every profile and ignores later saves', () => {
    const { adapter, upserts } = spyAdapter([profile('a'), profile('b')]);
    const store = new ProfileStore(adapter);
    store.shutdown();
    expect(upserts).toEqual([['a', 'b']]);
    store.save('a');
    vi.advanceTimersByTime(60_000);
    expect(upserts).toHaveLength(1);
  });

  it('writes the whole set through an adapter without upsert (browser localStorage)', () => {
    const saved: string[][] = [];
    const store = new ProfileStore({ describe: () => 'ls', load: () => [profile('a'), profile('b')], save: (rows) => void saved.push(rows.map((r) => r.id)) });
    store.save('a');
    store.flush();
    expect(saved).toEqual([['a', 'b']]);
  });
});

describe('ProfileStore on SQLite', () => {
  let dir = '';
  afterEach(() => {
    if (dir) {
      closeDatabase(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    dir = '';
  });

  it('upserts the dirty row, leaves rows it does not hold, and removes on request', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-dirty-'));
    const store = new ProfileStore(fileAdapter(dir));
    store.add(profile('a'));
    store.add(profile('b'));
    store.flush();
    const db = openDatabase(dir);
    // a row this process never loaded (written by another tool) is not "missing from memory" any more
    db.prepare('INSERT INTO profiles (id, json) VALUES (?, ?)').run('outside', JSON.stringify(profile('outside')));
    const before = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    store.get('a')!.coins = 9;
    store.save('a');
    store.flush();
    expect((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(before + 1);
    expect(JSON.parse((db.prepare('SELECT json FROM profiles WHERE id = ?').get('a') as { json: string }).json).coins).toBe(9);
    expect(db.prepare('SELECT id FROM profiles WHERE id = ?').get('outside')).toBeTruthy();

    // save() without ids: unchanged rows are not rewritten
    const mid = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    store.save();
    store.flush();
    expect((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(mid);

    store.remove('b');
    store.flush();
    expect(db.prepare('SELECT id FROM profiles WHERE id = ?').get('b')).toBeUndefined();
    expect((db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n).toBe(2);
  });

  it('writes and drops the photo row and its images with the profile', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-dirty-'));
    const store = new ProfileStore(fileAdapter(dir));
    const p = profile('a');
    p.photos = [{ id: 'x', at: 1 }];
    store.add(p);
    store.images.put('a', 'x', 'data:image/jpeg;base64,AAAA');
    store.flush();
    const db = openDatabase(dir);
    expect(db.prepare('SELECT profile_id FROM photos WHERE profile_id = ?').get('a')).toBeTruthy();
    expect((await store.images.get('a', ['x', 'nope'])).get('x')).toBe('data:image/jpeg;base64,AAAA');
    store.get('a')!.photos = [];
    store.save('a');
    store.flush();
    expect(db.prepare('SELECT profile_id FROM photos WHERE profile_id = ?').get('a')).toBeUndefined();
    store.get('a')!.photos = [{ id: 'y', at: 2 }];
    store.save('a');
    store.flush();
    store.remove('a');
    store.flush();
    expect(db.prepare('SELECT profile_id FROM photos WHERE profile_id = ?').get('a')).toBeUndefined();
    expect(db.prepare('SELECT photo_id FROM photo_images WHERE profile_id = ?').get('a')).toBeUndefined();
    expect(new ProfileStore(fileAdapter(dir)).count()).toBe(0);
  });

  it('moves the jpegs of an old photo row (inline images) to photo_images, and rewrites the row without them', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-photos-'));
    const db = openDatabase(dir);
    db.prepare('INSERT INTO profiles (id, json) VALUES (?, ?)').run('a', JSON.stringify(profile('a')));
    const old = [
      { id: 'n', at: 2, image: 'data:image/jpeg;base64,NEW' },
      { id: 'o', at: 1, image: 'data:image/jpeg;base64,OLD' },
    ];
    db.prepare('INSERT INTO photos (profile_id, json) VALUES (?, ?)').run('a', JSON.stringify(old));
    const store = new ProfileStore(fileAdapter(dir));
    expect(store.get('a')!.photos).toEqual([
      { id: 'n', at: 2 },
      { id: 'o', at: 1 },
    ]);
    const images = await store.images.get('a', ['n', 'o']);
    expect(images.get('n')).toBe('data:image/jpeg;base64,NEW');
    expect(images.get('o')).toBe('data:image/jpeg;base64,OLD');
    store.flush();
    const row = db.prepare('SELECT json FROM photos WHERE profile_id = ?').get('a') as { json: string };
    expect(JSON.parse(row.json)).toEqual([
      { id: 'n', at: 2 },
      { id: 'o', at: 1 },
    ]);
    // the next start finds nothing left to move
    const again = new ProfileStore(fileAdapter(dir));
    expect((await again.images.get('a', ['n'])).get('n')).toBe('data:image/jpeg;base64,NEW');
    store.shutdown();
    again.shutdown();
  });
});
