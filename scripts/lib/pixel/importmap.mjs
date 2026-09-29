// Loads apps/client/assets-src/import-map.json and merges every import-map.d/*.json fragment after it (sorted by file name).
//
// Fragments let several people (or agents) add entries without editing the main map. Merge rules:
//   arrays   (sprites, images)                          -> appended after the main map's entries, in fragment order
//   objects  (roots, sheets, recolors, terrain, atlas)  -> shallow-merged per key (a fragment key replaces the same key of the map)
//   anything else ($comment, version, chars)            -> kept from the main map (fragments cannot change it)
// A duplicate sprite key or images fn+args across the merged map is an error (it would silently overwrite an atlas frame).
import fs from 'node:fs';
import path from 'node:path';

const ARRAYS = ['sprites', 'images'];
const OBJECTS = ['roots', 'sheets', 'recolors', 'terrain', 'atlas'];

/** Pure merge: `base` map + list of `{ name, json }` fragments -> merged map. */
export function mergeImportMaps(base, fragments) {
  const out = { ...base };
  for (const k of ARRAYS) out[k] = [...(base[k] ?? [])];
  for (const k of OBJECTS) out[k] = { ...(base[k] ?? {}) };
  for (const { name, json } of fragments) {
    for (const k of Object.keys(json)) {
      if (k === '$comment') continue;
      if (ARRAYS.includes(k)) out[k].push(...json[k]);
      else if (OBJECTS.includes(k)) Object.assign(out[k], json[k]);
      else throw new Error(`import-map.d/${name}: unsupported top-level key '${k}' (allowed: ${[...ARRAYS, ...OBJECTS].join(', ')})`);
    }
  }
  const seen = new Set();
  for (const s of out.sprites) {
    if (!s.key) continue;
    if (seen.has(s.key)) throw new Error(`import-map: duplicate sprite key '${s.key}'`);
    seen.add(s.key);
  }
  return out;
}

/** Reads the main map and every `import-map.d/*.json` next to it. Returns the merged map. */
export function loadImportMap(srcDir) {
  const base = JSON.parse(fs.readFileSync(path.join(srcDir, 'import-map.json'), 'utf8'));
  const dir = path.join(srcDir, 'import-map.d');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  const fragments = names.map((name) => ({ name, json: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) }));
  return mergeImportMaps(base, fragments);
}
