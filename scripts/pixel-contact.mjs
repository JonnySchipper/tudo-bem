#!/usr/bin/env node
/**
 * Contact sheets of the pixel art (art1 set pieces, art2 portraits / feira / icons / UI kit / fixes).
 *
 *   pnpm pixel && node scripts/pixel-contact.mjs [--set art1|portraits|feira|icons|ui|fixes] [out.png] [scale]
 *
 * Sets: art1 (default: the Brazilian set pieces), portraits (5 NPCs x 4 expressions), feira (market stalls open + closed),
 * icons (item icons at 8x / 3x / 1x), ui (panel / bubble / button 9-slices stretched to two sizes, arrow frames),
 * fixes (art track 2: before | after of the kombi, fusca, moto and vira-lata).
 * Reads apps/client/public/pixel/manifest.json + the atlas + the standalone images, so it shows exactly what the game gets.
 * Animated sprites show every frame side by side; sprites with an overhead part (stall tarps) are shown composited;
 * `lit` overlays are shown over their facade.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const argv = process.argv.slice(2);
const setIdx = argv.indexOf('--set');
const SET = setIdx >= 0 ? argv.splice(setIdx, 2)[1] : 'art1';
const ART3 = { floors: 'art3/floors.png', walls: 'art3/walls.png', padaria: 'art3/padaria.png', kitnet: 'art3/kitnet.png', academia: 'art3/academia.png', praca: 'art3/praca.png' };
const DEFAULTS = { ...Object.fromEntries(Object.entries(ART3).map(([k, v]) => [k, [v, 4]])), art1: ['art1/pieces.png', 4], portraits: ['art2/portraits.png', 3], feira: ['art2/feira.png', 4], icons: ['art2/icons.png', 4], ui: ['art2/ui.png', 4], fixes: ['art2/fixes.png', 4], petshop: ['petshop-art/pieces.png', 4], lagoa: ['lagoa-art/pieces.png', 4] };
if (!DEFAULTS[SET]) throw new Error('unknown --set ' + SET);
const OUT = path.resolve(argv[0] ?? path.join(ROOT, 'docs/lifesim/shots', DEFAULTS[SET][0]));
const S = Number(argv[1] ?? DEFAULTS[SET][1]);
const MAX_W = { kitnet: 1500, floors: 2300, walls: 1900, portraits: 1120, icons: 1400, ui: 1000, feira: 900, petshop: 1400, lagoa: 1600 }[SET] ?? 2300;
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
const solid = (w, h, rgb) => {
  const o = blank(w, h);
  for (let i = 0; i < w * h; i++) { o.data[i * 4] = rgb[0]; o.data[i * 4 + 1] = rgb[1]; o.data[i * 4 + 2] = rgb[2]; o.data[i * 4 + 3] = 255; }
  return o;
};

/** Loads a standalone image (manifest.images) as { w, h, data, meta }. */
async function fileImage(key) {
  const d = manifest.images?.[key];
  if (!d) throw new Error('manifest.images: missing ' + key);
  const { data, info } = await sharp(path.join(PIX, d.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data, meta: d };
}
async function loadFile(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data };
}
/** 9-slice stretch of `img` to w x h with insets { top, right, bottom, left } (corners kept, edges and centre stretched by nearest). */
function nineSlice(img, sl, w, h) {
  const out = blank(w, h);
  const map = (v, n, lo, hi, N) => (v < lo ? v : v >= n - hi ? N - (n - v) : lo + Math.floor(((v - lo) * (N - lo - hi)) / (n - lo - hi)));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = map(x, w, sl.left, sl.right, img.w), sy = map(y, h, sl.top, sl.bottom, img.h);
    img.data.copy(out.data, (y * w + x) * 4, (sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4);
  }
  return out;
}

const ART1 = [
  'props/orelhao', 'props/placa_rua', 'props/lixeira', 'props/quiosque', 'props/barraca_chapeus', 'props/poleiro',
  'props/poste_fios', 'props/fios_seg', 'props/fios_4', 'props/fios_6', 'props/fios_8',
  'facades/padaria', 'facades/padaria_lit', 'facades/edificio_ipe', 'facades/edificio_ipe_lit', 'facades/academia', 'facades/academia_lit',
  'vehicles/onibus_e', 'vehicles/onibus_w', 'vehicles/kombi_e', 'vehicles/kombi_w', 'vehicles/fusca_e', 'vehicles/fusca_w', 'vehicles/moto_e', 'vehicles/moto_w',
  'critters/vira_lata_idle_e', 'critters/vira_lata_walk_e', 'critters/vira_lata_sleep_e', 'critters/vira_lata_walk_w',
];
const NL = { newline: true };

function cellImage(key) {
  const d = manifest.sprites[key];
  if (!d) throw new Error('manifest: missing ' + key);
  const frames = d.anim ? d.anim.frames : [d.frame];
  const imgs = frames.map((f) => frame(d.atlas, f));
  // overhead part (canopy / tarp) composited above the standing part
  const comp = imgs.map((img) => {
    if (typeof d.overhead === 'string' && manifest.sprites[d.overhead]) {
      const od = manifest.sprites[d.overhead];
      const oimg = frame(od.atlas, od.anim ? od.anim.frames[0] : od.frame);
      const oy = d.ay - od.ay; // canopy top relative to the base sprite top
      const top = Math.min(0, oy);
      const out = blank(Math.max(img.w, oimg.w), Math.max(img.h, oy + oimg.h) - top);
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

async function buildCells() {
  if (SET === 'art1') return ART1.map((key) => ({ key, frames: cellImage(key) }));
  if (SET === 'portraits') {
    const out = [];
    for (const npc of ['carlos', 'nanda', 'julia', 'graca', 'tia_lu', 'prof', 'ze', 'chico', 'rosa', 'dito']) {
      for (const e of ['neutro', 'feliz', 'surpreso', 'pensativo']) out.push({ key: `portraits/${npc}_${e}`, frames: [await fileImage(`portraits/${npc}_${e}`)] });
      // 1x and 2x references (what the DOM will show at those sizes)
      const ref = await fileImage(`portraits/${npc}_neutro`);
      out.push({ key: `${npc} neutro at 1x and 2x`, frames: [{ ...ref, s: 1 }, { ...ref, s: 2 }] });
      out.push(NL);
    }
    return out;
  }
  if (SET === 'feira') {
    const out = [];
    for (const k of ['frutas', 'verduras', 'pastel', 'flores']) {
      out.push({ key: `feira/${k}`, frames: cellImage(`feira/${k}`) });
      out.push({ key: `feira/${k}_fechada`, frames: cellImage(`feira/${k}_fechada`) });
      out.push(NL);
    }
    out.push({ key: 'feira/caixotes', frames: cellImage('feira/caixotes') });
    for (const k of Object.keys(manifest.sprites).filter((n) => n.startsWith('feira/preco_'))) out.push({ key: k, frames: cellImage(k).map((f) => ({ ...f, s: 8 })) });
    return out;
  }
  if (SET === 'icons') {
    const out = [];
    for (const k of Object.keys(manifest.images).filter((n) => n.startsWith('icons/'))) {
      const im = await fileImage(k);
      out.push({ key: k, frames: [{ ...im, s: 8 }, { ...im, s: 3 }, { ...im, s: 1 }] });
    }
    return out;
  }
  if (SET === 'ui') {
    const out = [];
    for (const k of Object.keys(manifest.images).filter((n) => n.startsWith('ui/'))) {
      const im = await fileImage(k);
      const sl = im.meta.slice;
      if (sl) {
        const sizes = im.meta.demo ?? [[64, 40], [112, 56]];
        const demos = sizes.map(([w, h]) => { const bgim = solid(w + 16, h + 16, [138, 176, 130]); over(bgim, nineSlice(im, sl, w, h), 8, 8); return bgim; });
        out.push({ key: `${k} (slice ${sl.top} ${sl.right} ${sl.bottom} ${sl.left})`, frames: [im, ...demos] });
      } else if (im.meta.frames) {
        const fw = im.meta.frameW;
        const fr = [];
        for (let i = 0; i < im.meta.frames; i++) {
          const f = blank(fw, im.h);
          for (let y = 0; y < im.h; y++) im.data.copy(f.data, y * fw * 4, (y * im.w + i * fw) * 4, (y * im.w + i * fw + fw) * 4);
          const bgim = solid(fw + 4, im.h + 4, [245, 230, 211]);
          over(bgim, f, 2, 2);
          fr.push(bgim);
        }
        out.push({ key: `${k} (${im.meta.frames} frames)`, frames: fr });
      } else out.push({ key: k, frames: [im] });
    }
    return out;
  }
  if (SET === 'fixes') {
    const B = path.join(ROOT, 'docs/lifesim/shots/art2/before');
    const div = (h) => solid(1, h, [255, 255, 255]);
    const out = [];
    for (const [bf, key] of [['vehicles_kombi_e', 'vehicles/kombi_e'], ['vehicles_fusca_e', 'vehicles/fusca_e'], ['vehicles_moto_e', 'vehicles/moto_e']]) {
      const before = await loadFile(path.join(B, bf + '.png'));
      const after = cellImage(key);
      out.push({ key: `${key}: before | after`, frames: [before, div(before.h), ...after] });
      const w = key.replace('_e', '_w');
      out.push({ key: w, frames: cellImage(w) });
      out.push(NL);
    }
    for (const kind of ['idle', 'walk', 'sleep']) {
      const before = await loadFile(path.join(B, `critters_vira_lata_${kind}_e.png`));
      const after = cellImage(`critters/vira_lata_${kind}_e`);
      out.push({ key: `critters/vira_lata_${kind}_e: before | after`, frames: [{ ...before, s: 8 }, { ...div(before.h), s: 8 }, ...after.map((f) => ({ ...f, s: 8 }))] });
      out.push(NL);
    }
    return out;
  }
  if (SET === 'floors') {
    // each flush terrain painted as a blob with a notch (all 16 masks appear), drawn like terrainLayers.ts does (dual grid, half tile offset)
    const t = manifest.terrain;
    const { data, info } = await sharp(path.join(PIX, t.tileset)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const tileImg = (n) => {
      const col = n % t.columns, row = Math.floor(n / t.columns);
      const ox = t.margin + col * (16 + t.spacing), oy = t.margin + row * (16 + t.spacing);
      const out = blank(16, 16);
      for (let y = 0; y < 16; y++) data.copy(out.data, y * 64, ((oy + y) * info.width + ox) * 4, ((oy + y) * info.width + ox + 16) * 4);
      return out;
    };
    const FL = ['........', '.######.', '.######.', '.##..##.', '.######.', '.######.', '........'];
    const out = [];
    for (const [ch, def] of Object.entries(t.layers)) {
      const is = (x, y) => (FL[y]?.[x] === '#' ? 1 : 0);
      const img = solid(FL[0].length * 16, FL.length * 16, [40, 38, 52]);
      for (let j = 0; j <= FL.length; j++) for (let i = 0; i <= FL[0].length; i++) {
        const mask = is(i - 1, j - 1) * 8 + is(i, j - 1) * 4 + is(i - 1, j) * 2 + is(i, j);
        if (!mask) continue;
        let n;
        if (def.edge === 'flush') n = def.first + (((j % (def.phasesY ?? 1)) * def.phases + (i % def.phases)) * 16) + mask;
        else if (def.edge === 'slab') n = def.first + (i % def.phases) * 16 + mask;
        else n = def.first + mask;
        over(img, tileImg(n), i * 16 - 8, j * 16 - 8);
      }
      out.push({ key: `terrain ${ch} ${def.name} (${def.edge}, ${def.phases}x${def.phasesY ?? 1} phases)`, frames: [img] });
    }
    return out;
  }
  const A3 = {
    walls: (k) => /^(walls|doors)\//.test(k) || k === 'props/doormat',
    padaria: (k) => /^props\/(balcao|vitrine|estufa|trilho_pedidos|caixa|banqueta|mesa|cadeira_padaria)/.test(k),
    kitnet: (k) => /^props\/(cama|cozinha)/.test(k) || k.startsWith('furniture/'),
    academia: (k) => /^props\/(tatame|quadro_fila|parede_faixas|banco_espectador|vestiario|quadro_foto)/.test(k),
    praca: (k) => /^props\/(bicicletario|mesa_cafe|jornais)/.test(k),
    lagoa: (k) => manifest.sprites[k].atlas === 'lagoa',
    petshop: (k) => manifest.sprites[k].atlas === 'petshop' || /^diary\/(cercadinho|peixe|bolinha|ossinho|pelucia|pata)$/.test(k),
  };
  if (A3[SET]) {
    const out = [];
    let last = '';
    for (const k of Object.keys(manifest.sprites).filter(A3[SET])) {
      const g = SET === 'petshop' || SET === 'lagoa' ? k.split('/')[0] : SET === 'kitnet' && k.startsWith('furniture/') ? 'f' : SET === 'walls' ? (k.startsWith('walls/north') ? 'n:' + k.split('_')[1] : k.startsWith('walls/west') ? 'w' : 'x') : k.replace(/_(\d+_of_\d+|[0-9]|e|w|n|s|se|sw|ne|nw|lit)$/, '');
      if (last && g !== last) out.push(NL);
      last = g;
      out.push({ key: k, frames: cellImage(k) });
    }
    return out;
  }
  throw new Error('no cells for set ' + SET);
}

const cellsAll = await buildCells();
const cells = cellsAll.filter((c) => !c.newline);
const GAP = 14, LABEL = 22;
const sc = (f) => f.s ?? S;
const scaled = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).resize(img.w * sc(img), img.h * sc(img), { kernel: 'nearest' }).png().toBuffer();

// shelf layout (a { newline } marker forces a new row)
const placed = [];
let x = GAP, y = GAP, rowH = 0;
for (const c of cellsAll) {
  if (c.newline) { if (x > GAP) { x = GAP; y += rowH + GAP + LABEL; rowH = 0; } continue; }
  const w = c.frames.reduce((n, f) => n + f.w * sc(f) + 6, -6);
  const h = Math.max(...c.frames.map((f) => f.h * sc(f)));
  if (x + w + GAP > MAX_W && x > GAP) { x = GAP; y += rowH + GAP + LABEL; rowH = 0; }
  placed.push({ ...c, x, y, w, h });
  x += Math.max(w, SET === 'art1' ? 140 : 60) + GAP;
  rowH = Math.max(rowH, h);
}
const W = MAX_W, H = y + rowH + GAP + LABEL;
const layers = [];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
for (const p of placed) {
  let fx = p.x;
  for (const f of p.frames) {
    layers.push({ input: await scaled(f), left: fx, top: p.y + (p.h - f.h * sc(f)) });
    fx += f.w * sc(f) + 6;
  }
  svg += `<text x="${p.x}" y="${p.y + p.h + 16}" font-family="Arial, Verdana, sans-serif" font-size="14" font-weight="700" fill="#ffffff" stroke="#22222c" stroke-width="0.6">${esc(p.key)}${p.frames.length > 1 && SET === 'art1' ? `  (${p.frames.length} frames)` : ''}</text>`;
}
svg += '</svg>';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
  .composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }])
  .png()
  .toFile(OUT);
console.log(`[contact:${SET}] ${cells.length} pieces -> ${path.relative(ROOT, OUT)} (${W}x${H}, ${S}x)`);
