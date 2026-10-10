import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import type { Manifest } from './manifest';
import { fencePieces, propArtKey, propSlices } from './props';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
it('lists missing', () => {
  const miss = new Map<string, string>();
  for (const r of Object.values(ROOMS)) for (const p of r.props) {
    const keys = p.kind === 'cerca' ? fencePieces(p).map((f) => f.key) : (propSlices(p)?.map((s) => s.key) ?? [propArtKey(p)]);
    for (const k of keys) if (!k || !(k in manifest.sprites)) miss.set(String(k), `${r.id}/${p.id} ${p.kind} fp=${JSON.stringify([p.w, p.h])}`);
  }
  fs.writeFileSync(path.resolve(__dirname, 'zz_missing.txt'), 'MISSING\n' + [...miss].map(([k, v]) => `${k}  <- ${v}`).join('\n') + '\nATLAS ' + JSON.stringify(manifest.atlases) + ' ' + manifest.terrain.count + '\n');
});
