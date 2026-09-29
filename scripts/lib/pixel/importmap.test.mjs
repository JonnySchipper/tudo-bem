import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mergeImportMaps, loadImportMap } from './importmap.mjs';

const base = { version: 1, roots: { int: 'a' }, sheets: { one: 'int:x.png' }, recolors: {}, atlas: { outdoor: { maxWidth: 512 } }, sprites: [{ key: 'props/a' }], images: [], terrain: { c: { name: 'calcada' } }, chars: { layers: [] } };

describe('import-map.d fragments', () => {
  it('appends arrays and merges objects after the main map', () => {
    const m = mergeImportMaps(base, [
      { name: 'a.json', json: { sheets: { two: 'int:y.png' }, sprites: [{ key: 'props/b' }], terrain: { m: { name: 'madeira' } } } },
      { name: 'b.json', json: { sprites: [{ key: 'props/c' }], images: [{ fn: 'x' }] } },
    ]);
    expect(m.sprites.map((s) => s.key)).toEqual(['props/a', 'props/b', 'props/c']);
    expect(Object.keys(m.sheets)).toEqual(['one', 'two']);
    expect(Object.keys(m.terrain)).toEqual(['c', 'm']);
    expect(m.images).toEqual([{ fn: 'x' }]);
    expect(m.chars).toBe(base.chars);
    expect(base.sprites).toHaveLength(1); // the input is not mutated
  });

  it('rejects duplicate sprite keys and unsupported top-level keys', () => {
    expect(() => mergeImportMaps(base, [{ name: 'a.json', json: { sprites: [{ key: 'props/a' }] } }])).toThrow(/duplicate sprite key 'props\/a'/);
    expect(() => mergeImportMaps(base, [{ name: 'a.json', json: { chars: {} } }])).toThrow(/unsupported top-level key 'chars'/);
  });

  it('loadImportMap reads import-map.json and every import-map.d/*.json in file-name order', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-importmap-'));
    fs.writeFileSync(path.join(dir, 'import-map.json'), JSON.stringify(base));
    fs.mkdirSync(path.join(dir, 'import-map.d'));
    fs.writeFileSync(path.join(dir, 'import-map.d', 'b.json'), JSON.stringify({ sprites: [{ key: 'props/second' }] }));
    fs.writeFileSync(path.join(dir, 'import-map.d', 'a.json'), JSON.stringify({ sprites: [{ key: 'props/first' }] }));
    fs.writeFileSync(path.join(dir, 'import-map.d', 'notes.txt'), 'ignored');
    expect(loadImportMap(dir).sprites.map((s) => s.key)).toEqual(['props/a', 'props/first', 'props/second']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('the real assets-src map merges cleanly', () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../apps/client/assets-src');
    const m = loadImportMap(src);
    expect(m.sprites.length).toBeGreaterThan(50);
  });
});
