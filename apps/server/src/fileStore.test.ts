import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileAdapter } from './fileStore.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';
import type { StoredProfile } from './store.js';

const photo = (id: string) => ({ id, at: 1, image: `data:image/jpeg;base64,${id.repeat(20)}` });
const row = (id: string, photos?: ReturnType<typeof photo>[]) => ({ id, name: id, ...(photos ? { photos } : {}) }) as unknown as StoredProfile;

describe('fileAdapter', () => {
  let dir = '';
  afterEach(() => {
    if (dir) {
      closeDatabase(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    dir = '';
  });

  it('keeps photo images out of the profiles table and does not rewrite an unchanged photo row', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-'));
    const a = fileAdapter(dir);
    a.load();
    const rows = [row('p1', [photo('a1')]), row('p2')];
    a.save(rows);
    const db = openDatabase(dir);
    const profiles = (db.prepare('SELECT json FROM profiles').all() as { json: string }[]).map((r) => r.json).join('\n');
    expect(profiles).not.toContain('data:image');
    expect(JSON.parse((db.prepare('SELECT json FROM photos WHERE profile_id = ?').get('p1') as { json: string }).json)).toEqual([photo('a1')]);

    const before = (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    a.save(rows);
    expect((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n).toBe(before);

    rows[0]!.photos = [photo('a2'), photo('a1')];
    a.save(rows);
    const loaded = fileAdapter(dir).load();
    expect(loaded.find((r) => r.id === 'p1')?.photos?.map((p) => p.id)).toEqual(['a2', 'a1']);
    expect(loaded.find((r) => r.id === 'p2')?.photos).toBeUndefined();
  });

  it('moves photos saved inline in profiles.json into the photos table', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-'));
    fs.writeFileSync(path.join(dir, 'profiles.json'), JSON.stringify([row('old', [photo('x')])]));
    const a = fileAdapter(dir);
    const rows = a.load();
    expect(rows[0]?.photos?.[0]?.id).toBe('x');
    expect(fs.existsSync(path.join(dir, 'profiles.json'))).toBe(false);
    const db = openDatabase(dir);
    expect((db.prepare('SELECT json FROM profiles WHERE id = ?').get('old') as { json: string }).json).not.toContain('data:image');
    expect(fileAdapter(dir).load()[0]?.photos?.[0]?.id).toBe('x');
  });
});
