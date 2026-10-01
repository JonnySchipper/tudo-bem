#!/usr/bin/env node
/**
 * Dev tool: lays the named atlas sprites side by side, upscaled, on a grey (or --bg=#hex) background.
 *   node scripts/sprite-peek.mjs out.png scale key [key...]      (keys may end in * for a prefix match)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--bg='));
const bg = (process.argv.find((a) => a.startsWith('--bg=')) ?? '--bg=#8a8a94').slice(5);
const [out, scaleS, ...keys] = args;
const S = Number(scaleS);
const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
const atlases = {};
for (const [n, a] of Object.entries(manifest.atlases)) {
  const { data, info } = await sharp(path.join(PIX, a.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  atlases[n] = { data, w: info.width, json: JSON.parse(fs.readFileSync(path.join(PIX, a.data), 'utf8')) };
}
const all = Object.keys(manifest.sprites);
const names = keys.flatMap((k) => (k.endsWith('*') ? all.filter((n) => n.startsWith(k.slice(0, -1))) : [k]));
const pics = [];
for (const k of names) {
  const d = manifest.sprites[k];
  if (!d) { console.log('missing', k); continue; }
  const at = atlases[d.atlas];
  const fr = at.json.frames[d.frames?.[0] ?? k] ?? at.json.frames[k];
  if (!fr) { console.log('no frame', k); continue; }
  const f = fr.frame;
  const buf = Buffer.alloc(f.w * f.h * 4);
  for (let y = 0; y < f.h; y++) at.data.copy(buf, y * f.w * 4, ((f.y + y) * at.w + f.x) * 4, ((f.y + y) * at.w + f.x + f.w) * 4);
  const png = await sharp(buf, { raw: { width: f.w, height: f.h, channels: 4 } }).resize(f.w * S, f.h * S, { kernel: 'nearest' }).png().toBuffer();
  pics.push({ k, w: f.w * S, h: f.h * S, png });
}
const W = Math.max(400, Math.min(2400, pics.reduce((n, p) => n + p.w + 8, 8)));
let x = 8, y = 8, rowH = 0;
const place = [];
for (const p of pics) {
  if (x + p.w > W && x > 8) { x = 8; y += rowH + 8; rowH = 0; }
  place.push({ input: p.png, left: x, top: y });
  x += p.w + 8;
  rowH = Math.max(rowH, p.h);
}
await sharp({ create: { width: W, height: y + rowH + 8, channels: 4, background: bg } }).composite(place).png().toFile(out);
console.log('wrote', out, names.join(' '));
