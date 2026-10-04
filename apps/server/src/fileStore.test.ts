import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileAdapter } from './fileStore.js';
import type { StoredProfile } from './store.js';

const photo = (id: string) => ({ id, at: 1, image: `data:image/jpeg;base64,${id.repeat(50)}` });
const row = (id: string, photos?: ReturnType<typeof photo>[]) => ({ id, name: id, ...(photos ? { photos } : {}) }) as unknown as StoredProfile;

describe('fileAdapter', () => {
  it('keeps photo images out of profiles.json and rewrites photos.json only when photos change', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-'));
    const a = fileAdapter(dir);
    a.load();
    const rows = [row('p1', [photo('a1')]), row('p2')];
    a.save(rows);
    const profiles = fs.readFileSync(path.join(dir, 'profiles.json'), 'utf8');
    expect(profiles).not.toContain('data:image');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'photos.json'), 'utf8'))).toEqual({ p1: [photo('a1')] });

    // a save where nobody's photos changed does not touch photos.json
    const before = fs.statSync(path.join(dir, 'photos.json')).mtimeMs;
    fs.utimesSync(path.join(dir, 'photos.json'), 0, 0);
    a.save(rows);
    expect(fs.statSync(path.join(dir, 'photos.json')).mtimeMs).toBe(0);
    expect(before).toBeGreaterThan(0);

    // a new photo rewrites it, and a fresh load puts the photos back on the profile
    rows[0].photos = [photo('a2'), photo('a1')];
    a.save(rows);
    const loaded = fileAdapter(dir).load();
    expect(loaded.find((r) => r.id === 'p1')?.photos?.map((p) => p.id)).toEqual(['a2', 'a1']);
    expect(loaded.find((r) => r.id === 'p2')?.photos).toBeUndefined();
  });

  it('moves photos saved inline by an older build into photos.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-store-'));
    fs.writeFileSync(path.join(dir, 'profiles.json'), JSON.stringify([row('old', [photo('x')])]));
    const a = fileAdapter(dir);
    const rows = a.load();
    expect(rows[0].photos?.[0].id).toBe('x');
    a.save(rows);
    expect(fs.readFileSync(path.join(dir, 'profiles.json'), 'utf8')).not.toContain('data:image');
    expect(fileAdapter(dir).load()[0].photos?.[0].id).toBe('x');
  });
});
