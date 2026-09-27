#!/usr/bin/env node
/**
 * Stamp every sprite in apps/client/public/art/manifest.json with a content hash (`v`).
 *
 *   node scripts/art-stamp.mjs        (pnpm art runs this automatically)
 *
 * The loader requests `<file>?v=<hash>`, so a re-baked PNG gets a new URL. Without it, art served with
 * a long immutable cache under a fixed name (props/caixa.png) stays stale in any browser that has seen
 * an older bake — which is how Padaria deltas v2/v3 never reached a returning reviewer on Fly.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const artVersion = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);

/** Adds/refreshes `v` on each manifest sprite from the file on disk. Mutates and returns the manifest. */
export function stampArtVersions(outDir, manifest) {
  for (const meta of Object.values(manifest.sprites)) meta.v = artVersion(fs.readFileSync(path.join(outDir, meta.file)));
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/client/public/art');
  const file = path.join(outDir, 'manifest.json');
  const manifest = stampArtVersions(outDir, JSON.parse(fs.readFileSync(file, 'utf8')));
  fs.writeFileSync(file, JSON.stringify(manifest, null, 1));
  console.log(`  ✓ stamped ${Object.keys(manifest.sprites).length} sprites`);
}
