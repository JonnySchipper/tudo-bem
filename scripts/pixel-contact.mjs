#!/usr/bin/env node
/**
 * Contact sheet of the Brazilian set pieces (art1): every piece at 4x on a neutral background with its manifest key under it.
 *
 *   pnpm pixel && node scripts/pixel-contact.mjs [out.png] [scale]
 *
 * Reads apps/client/public/pixel/manifest.json + the atlas, so it shows exactly what the game gets. Animated sprites show every
 * frame side by side; sprites with an overhead part (hat stall canopy) are shown composited; `lit` overlays are shown over their facade.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/lifesim/shots/art1/pieces.png'));
const S = Number(process.argv[3] ?? 4);
const MAX_W = 2300;
const BG = { r: 138, g: 138, b: 148 };

const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
const atlasPng = new Map();
const atlasJson = new Map();
for (const [name, a] of Object.entries(manifest.atlases)) {
  const { data, info } = await sharp(path.join(PIX, a.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  atlasPng.set(name, { data, w: info.width });
  atlasJson.set(name, JSON.parse(fs.readFileSync(path.join(PIX, a.data), 'utf8')));
}

/** RGBA image { w, h, data } of a frame. */
function frame(atlas, name) {
  const f = atlasJson.get(atlas).frames[name].frame;
  const { data, w } = atlasPng.get(atlas);
  const out = Buffer.alloc(f.w * f.h * 4);
  for (let y = 0; y < f.h; y++) data.copy(out, y * f.w * 4, ((f.y + y) * w + f.x) * 4, ((f.y + y) * w + f.x + f.w) * 4);
  return { w: f.w, h: f.h, data: out };
}

/** Composites `src` onto `dst` (both { w, h, data }) at (dx, dy) with normal alpha blending. */
function over(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
    const si = (y * src.w + x) * 4, di = (ty * dst.w + tx) * 4;
    const a = src.data[si + 3] / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) dst.data[di + c] = Math.round(src.data[si + c] * a + dst.data[di + c] * (1 - a));
    dst.data[di + 3] = Math.max(dst.data[di + 3], src.data[si + 3]);
  }
}
const blank = (w, h) => ({ w, h, data: Buffer.alloc(w * h * 4) });

/** The list of cells: [key, note?]. Frames of animated sprites are expanded. */
const KEYS = [
  'props/orelhao', 'props/placa_rua', 'props/lixeira', 'props/quiosque', 'props/barraca_chapeus', 'props/poleiro',
  'props/poste_fios', 'props/fios_seg', 'props/fios_4', 'props/fios_6', 'props/fios_8',
  'facades/padaria', 'facades/padaria_lit', 'facades/edificio_ipe', 'facades/edificio_ipe_lit', 'facades/academia', 'facades/academia_lit',
  'vehicles/onibus_e', 'vehicles/onibus_w', 'vehicles/kombi_e', 'vehicles/kombi_w', 'vehicles/fusca_e', 'vehicles/fusca_w', 'vehicles/moto_e', 'vehicles/moto_w',
  'critters/vira_lata_idle_e', 'critters/vira_lata_walk_e', 'critters/vira_lata_sleep_e', 'critters/vira_lata_walk_w',
];

function cellImage(key) {
  const d = manifest.sprites[key];
  if (!d) throw new Error('manifest: missing ' + key);
  const frames = d.anim ? d.anim.frames : [d.frame];
  const imgs = frames.map((f) => frame(d.atlas, f));
  // overhead part (canopy) composited above the standing part
  let extraTop = 0;
  const comp = imgs.map((img) => {
    if (typeof d.overhead === 'string' && manifest.sprites[d.overhead]) {
      const od = manifest.sprites[d.overhead];
      const oimg = frame(od.atlas, od.anim ? od.anim.frames[0] : od.frame);
      const oy = d.ay - od.ay; // canopy top relative to the base sprite top
      const top = Math.min(0, oy);
      extraTop = -top;
      const out = blank(Math.max(img.w, oimg.w), img.h - top);
      over(out, img, 0, -top);
      over(out, oimg, 0, oy - top);
      return out;
    }
    if (d.lit === undefined && key.endsWith('_lit')) {
      // lit overlay: show it over the day facade darkened, so the warm panes read
      const base = frame(d.atlas, manifest.sprites[key.replace('_lit', '')].frame);
      for (let i = 0; i < base.data.length; i += 4) { base.data[i] *= 0.55; base.data[i + 1] *= 0.55; base.data[i + 2] *= 0.6; }
      over(base, img, 0, 0);
      return base;
    }
    return img;
  });
  return comp;
}

const cells = KEYS.map((key) => ({ key, frames: cellImage(key) }));
const GAP = 14, LABEL = 22;
const scaled = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(img.w * S, img.h * S, { kernel: 'nearest' }).png().toBuffer();

// shelf layout
const placed = [];
let x = GAP, y = GAP, rowH = 0;
for (const c of cells) {
  const w = c.frames.reduce((n, f) => n + f.w * S + 6, -6);
  const h = Math.max(...c.frames.map((f) => f.h)) * S;
  if (x + w + GAP > MAX_W && x > GAP) { x = GAP; y += rowH + GAP + LABEL; rowH = 0; }
  placed.push({ ...c, x, y, w, h });
  x += Math.max(w, 140) + GAP;
  rowH = Math.max(rowH, h);
}
const W = MAX_W, H = y + rowH + GAP + LABEL;
const layers = [];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
for (const p of placed) {
  let fx = p.x;
  for (const f of p.frames) {
    layers.push({ input: await scaled(f), left: fx, top: p.y + (p.h - f.h * S) });
    fx += f.w * S + 6;
  }
  svg += `<text x="${p.x}" y="${p.y + p.h + 16}" font-family="Arial, Verdana, sans-serif" font-size="14" font-weight="700" fill="#ffffff" stroke="#22222c" stroke-width="0.6">${esc(p.key)}${p.frames.length > 1 ? `  (${p.frames.length} frames)` : ''}</text>`;
}
svg += '</svg>';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
  .composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }])
  .png()
  .toFile(OUT);
console.log(`[contact] ${cells.length} pieces -> ${path.relative(ROOT, OUT)} (${W}x${H}, ${S}x)`);
