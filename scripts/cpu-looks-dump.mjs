#!/usr/bin/env node
/** Dev tool: prints the CPU look (archetype, garb, hat) of each name given, or of every allowlisted name. node scripts/cpu-looks-dump.mjs [Name...] */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = createRequire(path.join(ROOT, 'apps/server/package.json'))('esbuild');
const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-looks-')), 'shared.mjs');
await build({ entryPoints: [path.join(ROOT, 'packages/shared/src/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error' });
const { cpuLook, CPU_NAMES } = await import(pathToFileURL(outfile).href);
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : CPU_NAMES) {
  const l = cpuLook(name);
  const a = l.appearance;
  console.log(name.padEnd(10), l.archetype.padEnd(16), `${a.body}/${a.hair}/${a.top}/${a.bottom}`.padEnd(32), `hat=${l.hat}`.padEnd(20), a.garb ?? '');
}
