#!/usr/bin/env node
/**
 * Contact sheet of every pet breed × coat (#234, docs/PET-STORE-PLAN.md §3.2.7), with the real runtime recolour:
 *
 *   pnpm pixel && node scripts/pet-breeds-sheet.mjs [out.png] [scale]      # default docs/lifesim/shots/petshop-art/breeds.png, 4
 *
 * One row per catalog group (a breed and its pattern variants), one cell per coat: idle S, walk E (frame 0), sit S and lie E of the
 * key-coloured strip `chars/pet_<species>_<shape>_<pattern>` with the coat / coat2 / collar keys swapped like `petLook.ts` does.
 * The last row shows the legacy `chars/pet_dog` and `chars/pet_cat` strips next to the caramelo and the orange cat so the two can be
 * compared by eye (they must be the same picture).
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

register('./lib/ts-resolve.mjs', import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const { BREEDS, DEFAULT_COLLAR, breedGroups } = await import('../packages/shared/src/petBreeds.ts');
const { PET_KEY_RAMPS, buildRamp, mergeTables, rampMap, swapKeys } = await import('../apps/client/src/render/pixel/palette.ts');

const OUT = path.resolve(ROOT, process.argv[2] ?? 'docs/lifesim/shots/petshop-art/breeds.png');
const S = Number(process.argv[3] ?? 4);
const FRAME_W = 24;
const POSES = [12, 0, 15, 17]; // idleS, walkE, sitS, lieE
const BG = { r: 138, g: 138, b: 148 };

const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
const strips = new Map();
async function strip(key) {
  if (!strips.has(key)) {
    const d = manifest.images[key];
    if (!d) throw new Error('manifest.images: missing ' + key);
    const { data, info } = await sharp(path.join(PIX, d.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    strips.set(key, { w: info.width, h: info.height, data });
  }
  return strips.get(key);
}
const swapTable = (coat, coat2, collar) =>
  mergeTables(rampMap(PET_KEY_RAMPS.coat, buildRamp(coat)), rampMap(PET_KEY_RAMPS.coat2, buildRamp(coat2)), rampMap(PET_KEY_RAMPS.collar, buildRamp(collar).slice(2)));

/** The chosen poses of a (recoloured) strip side by side as one RGBA image. */
function poses(src, table) {
  const h = src.h;
  const out = { w: POSES.length * (FRAME_W + 2), h, data: Buffer.alloc(POSES.length * (FRAME_W + 2) * h * 4) };
  POSES.forEach((f, i) => {
    for (let y = 0; y < h; y++) src.data.copy(out.data, (y * out.w + i * (FRAME_W + 2)) * 4, (y * src.w + f * FRAME_W) * 4, (y * src.w + f * FRAME_W + FRAME_W) * 4);
  });
  if (table) swapKeys(out.data, table);
  return out;
}
const scaled = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(img.w * S, img.h * S, { kernel: 'nearest' }).png().toBuffer();

const rows = [];
for (const g of breedGroups()) {
  const cells = [];
  for (const b of g.breeds) {
    const src = await strip(`chars/pet_${b.species}_${b.shape}_${b.pattern}`);
    for (const c of b.coats) cells.push({ label: `${c.id}${g.breeds.length > 1 ? ` (${b.pattern})` : ''}`, img: poses(src, swapTable(c.coat, c.coat2, DEFAULT_COLLAR)) });
  }
  rows.push({ title: `${g.pt} · ${g.en}${g.br ? ' · BR' : ''}  [${g.breeds[0].species} ${g.breeds[0].shape}]`, cells });
}
// the legacy strips next to their breed looks
const legacy = [];
for (const [species, key, breedId] of [['dog', 'chars/pet_dog', 'vira_lata_caramelo'], ['cat', 'chars/pet_cat', 'gato_laranja']]) {
  const b = BREEDS.find((x) => x.id === breedId);
  legacy.push({ label: `${key} (legacy, as baked)`, img: poses(await strip(key), null) });
  legacy.push({ label: `${breedId} recoloured`, img: poses(await strip(`chars/pet_${species}_${b.shape}_${b.pattern}`), swapTable(b.coats[0].coat, b.coats[0].coat2, DEFAULT_COLLAR)) });
}
rows.push({ title: 'legacy strips vs the recoloured breed (must match)', cells: legacy });

const GAP = 10, TITLE = 18, LABEL = 14;
const cellW = POSES.length * (FRAME_W + 2) * S + GAP;
const maxCells = Math.max(...rows.map((r) => r.cells.length));
const W = GAP + maxCells * cellW;
const rowH = TITLE + 20 * S + LABEL + GAP;
const H = GAP + rows.length * rowH;
const layers = [];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
const text = (x, y, s, size) => `<text x="${x}" y="${y}" font-family="Arial, Verdana, sans-serif" font-size="${size}" font-weight="700" fill="#ffffff" stroke="#22222c" stroke-width="0.6">${esc(s)}</text>`;
for (const [ri, r] of rows.entries()) {
  const y = GAP + ri * rowH;
  svg += text(GAP, y + 13, r.title, 13);
  for (const [ci, c] of r.cells.entries()) {
    layers.push({ input: await scaled(c.img), left: GAP + ci * cellW, top: y + TITLE });
    svg += text(GAP + ci * cellW, y + TITLE + 20 * S + 11, c.label, 10);
  }
}
svg += '</svg>';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
  .composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }])
  .png()
  .toFile(OUT);
console.log(`[breeds] ${rows.length} rows, ${rows.reduce((n, r) => n + r.cells.length, 0)} looks -> ${path.relative(ROOT, OUT)} (${W}x${H}, ${S}x)`);
