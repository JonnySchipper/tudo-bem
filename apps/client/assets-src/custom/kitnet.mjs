// Kitnet: cama (LimeZu bed), cozinha (kitchenette, authored) and every piece of the furniture catalog in both rotations
// (`furniture/<id>_0` faces SE = east, `_1` faces SW = south). Pack pieces are cropped from the theme sorters; the Brazilian ones
// (rede, filtro de barro, rádio antigo, monstera, quadro de ipê) and the fan / cat animations are authored in the pack style.
import { put, fillRect, shape, mix, h2, ell, box, or, sub, NAVY, line } from './paint.mjs';
import { blank, crop, flipH, trim, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { recolorRamp } from './kit.mjs';

const WOOD = { d: '#573c2c', lo: '#6b4b30', mid: '#8b5e3c', base: '#a9764f', hi: '#c78c59', hi2: '#daa463' };
const METAL = { lo: '#565972', mid: '#8b8bab', hi: '#b2aecb', hi2: '#d8d0e0' };
const RAMP = {
  yellow: ['#c99a2a', '#e0b030', '#f2c230', '#ffe57b'],
  green: ['#2e6a4a', '#3f8a5c', '#4fa06a', '#7cc48a'],
  terra: ['#8f3a1e', '#a94a24', '#c45c26', '#e08a52'],
  leaf: ['#2a6a3a', '#3f8d47', '#57a83f', '#9bc246'],
  clay: ['#8a4526', '#a85a34', '#c0714a', '#d98d62'],
};

/** Flip a frame horizontally and return part fields. */
const m = (img) => flipH(img);

// ------------------------------------------------------------------ pieces (each returns { img, anchor }, rot 0; rot 1 = fn(1) or a mirror)
function pufe() {
  const img = blank(16, 15);
  shape(img, ell(8, 8.5, 7, 5), [7, 7, 7, 5], RAMP.yellow);
  fillRect(img, 5, 5, 6, 1, RAMP.yellow[0]); put(img, 8, 6, RAMP.yellow[0]); // dimple + button
  put(img, 4, 8, RAMP.yellow[3]); put(img, 5, 7, RAMP.yellow[3]);
  return { img, anchor: [8, 14] };
}

function armchair(rot) {
  const G = RAMP.green;
  if (rot === 1) { // faces south: front view
    const img = blank(20, 24);
    fillRect(img, 1, 1, 18, 21, NAVY);
    fillRect(img, 3, 2, 14, 11, G[2]); fillRect(img, 3, 2, 14, 1, G[3]); fillRect(img, 3, 3, 1, 9, G[3]); fillRect(img, 3, 11, 14, 2, G[1]); // backrest
    fillRect(img, 2, 8, 3, 12, G[1]); fillRect(img, 15, 8, 3, 12, G[0]); fillRect(img, 2, 8, 3, 2, G[2]); fillRect(img, 15, 8, 3, 2, G[1]); // arms
    fillRect(img, 5, 12, 10, 6, G[3]); fillRect(img, 5, 12, 10, 1, '#a8dcae'); fillRect(img, 5, 17, 10, 1, G[2]); // seat cushion
    fillRect(img, 3, 18, 14, 3, G[1]); fillRect(img, 3, 18, 14, 1, G[2]);
    fillRect(img, 3, 22, 2, 2, NAVY); fillRect(img, 15, 22, 2, 2, NAVY);
    return { img, anchor: [10, 22] };
  }
  const img = blank(22, 24); // faces east: back on the left
  fillRect(img, 0, 1, 22, 21, NAVY);
  fillRect(img, 1, 2, 6, 19, G[1]); fillRect(img, 1, 2, 2, 19, G[2]); fillRect(img, 1, 2, 6, 1, G[3]); // back panel seen from the side
  fillRect(img, 7, 9, 14, 6, G[3]); fillRect(img, 7, 9, 14, 1, '#a8dcae'); fillRect(img, 7, 14, 14, 1, G[2]); // seat cushion
  fillRect(img, 7, 6, 14, 3, G[2]); fillRect(img, 7, 6, 14, 1, G[3]); // far arm
  fillRect(img, 7, 15, 14, 6, G[1]); fillRect(img, 7, 15, 14, 2, G[2]); fillRect(img, 7, 19, 14, 2, G[0]); // near arm, front
  fillRect(img, 2, 22, 2, 2, NAVY); fillRect(img, 17, 22, 2, 2, NAVY);
  return { img, anchor: [10, 22] };
}

function mesinha() {
  const img = blank(20, 18);
  // oval wooden top with a lit rim, a small vase with a flower
  shape(img, ell(10, 7, 9, 5), [9, 6, 9, 5], [WOOD.lo, WOOD.mid, WOOD.base, WOOD.hi2]);
  fillRect(img, 4, 12, 2, 5, NAVY); fillRect(img, 14, 12, 2, 5, NAVY); fillRect(img, 5, 12, 1, 4, WOOD.mid); fillRect(img, 14, 12, 1, 4, WOOD.lo);
  fillRect(img, 9, 3, 3, 4, NAVY); fillRect(img, 10, 4, 1, 2, '#4fa0d8'); put(img, 10, 2, '#e5572f'); put(img, 9, 3, '#f2c230'); put(img, 11, 3, '#f2c230');
  return { img, anchor: [10, 17] };
}

function monstera() {
  const img = blank(22, 32);
  // terracotta pot
  shape(img, or(box(6, 23, 17, 31)), [11, 27, 6, 4], RAMP.terra, { t: [0.7, 0.3, -0.1] });
  fillRect(img, 5, 22, 13, 3, NAVY); fillRect(img, 6, 22, 11, 2, RAMP.terra[2]); fillRect(img, 6, 22, 11, 1, RAMP.terra[3]);
  fillRect(img, 8, 20, 7, 2, '#4a3524'); // soil
  // stems
  for (const [x0, y0, x1, y1] of [[11, 21, 6, 12], [11, 21, 16, 10], [11, 21, 11, 8]]) line(img, x0, y0, x1, y1, '#2a6a3a');
  // big split leaves (heart shaped with notches)
  const leaf = (cx, cy, r) => {
    for (let y = -r; y <= r; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x * 0.85, y);
      const notch = (Math.abs(x) === 2 || Math.abs(x) === 3) && y === Math.round(r * 0.3);
      if (d <= r && !notch) put(img, cx + x, cy + y, d > r - 1 ? NAVY : x + y < -r * 0.5 ? RAMP.leaf[3] : x + y > r * 0.4 ? RAMP.leaf[1] : RAMP.leaf[2]);
    }
    line(img, cx, cy - r + 1, cx, cy + r - 1, RAMP.leaf[0]);
  };
  leaf(6, 11, 5); leaf(16, 9, 5); leaf(11, 6, 5); leaf(4, 17, 3); leaf(18, 16, 3);
  return { img, anchor: [11, 30] };
}

function tapete(rot) {
  const img = blank(16, 16);
  const stripes = ['#e5572f', '#f2c230', '#f8efe0', '#2e9e5b', '#f2c230', '#e5572f'];
  fillRect(img, 0, 1, 16, 14, NAVY);
  for (let i = 0; i < 6; i++) {
    const a = 1 + i * 2 + (i > 2 ? 0 : 0);
    if (rot === 0) fillRect(img, 1, 2 + Math.floor(i * 2.2), 14, 2, stripes[i]);
    else fillRect(img, 1 + Math.floor(i * 2.2), 2, 2, 12, stripes[i]);
    void a;
  }
  if (rot === 0) for (let y = 2; y < 14; y += 2) { put(img, 0, y, '#f8efe0'); put(img, 15, y, '#f8efe0'); } // fringe
  else for (let x = 2; x < 14; x += 2) { put(img, x, 0, '#f8efe0'); put(img, x, 15, '#f8efe0'); }
  return { img, anchor: [8, 15] };
}

function radio(rot) {
  const img = blank(16, 16);
  fillRect(img, 1, 3, 14, 11, NAVY);
  fillRect(img, 2, 4, 12, 9, '#b5452e'); fillRect(img, 2, 4, 12, 1, '#d97a45'); fillRect(img, 2, 12, 12, 1, '#8f2e1e');
  // speaker grille left, dial right (or the other way round for rot 1)
  const g = rot === 0 ? 3 : 8, d = rot === 0 ? 9 : 3;
  fillRect(img, g, 5, 5, 6, '#573c2c'); for (let y = 6; y < 11; y += 2) fillRect(img, g + 1, y, 3, 1, '#d8c8a0');
  fillRect(img, d, 5, 5, 3, '#f0dfae'); fillRect(img, d, 5, 5, 1, '#fff2c8'); put(img, d + 2, 6, '#c93232'); put(img, d + 1, 7, '#573c2c');
  put(img, d + 1, 10, '#f2c230'); put(img, d + 3, 10, '#f2c230');
  fillRect(img, 3, 14, 2, 1, NAVY); fillRect(img, 11, 14, 2, 1, NAVY);
  line(img, rot === 0 ? 12 : 4, 3, rot === 0 ? 14 : 2, 0, '#d8d0e0'); put(img, rot === 0 ? 14 : 2, 0, NAVY); // antenna
  return { img, anchor: [8, 14] };
}

function ventiladorFrames() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const img = blank(16, 28);
    // base + pole
    fillRect(img, 3, 24, 10, 3, NAVY); fillRect(img, 4, 24, 8, 2, METAL.hi2); fillRect(img, 4, 26, 8, 1, METAL.lo);
    fillRect(img, 7, 14, 2, 10, NAVY); fillRect(img, 7, 14, 1, 10, METAL.hi); fillRect(img, 8, 14, 1, 10, METAL.mid);
    // cage
    for (let y = 0; y < 15; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7);
      if (d <= 7.4 && d > 6.2) put(img, x, y, NAVY);
    }
    for (let y = 1; y < 14; y++) for (let x = 1; x < 15; x++) if (Math.hypot(x - 7.5, y - 7) <= 6.2) put(img, x, y, '#e8f0f4');
    // blades: 3 blades rotated per frame
    for (let b = 0; b < 3; b++) {
      const a = (f / 3 + b / 3) * Math.PI * 2 * (1 / 1) + 0.4;
      for (let r = 1; r <= 5; r++) {
        const bx = Math.round(7.5 + Math.cos(a) * r), by = Math.round(7 + Math.sin(a) * r * 0.95);
        put(img, bx, by, r < 3 ? '#a2a6be' : '#8b8bab'); put(img, bx + (Math.sin(a) > 0 ? 1 : -1), by, '#c6bdd5');
      }
    }
    fillRect(img, 6, 6, 3, 3, NAVY); fillRect(img, 7, 7, 1, 1, '#d93232');
    frames.push(img);
  }
  return frames;
}

function rede(rot) {
  const img = blank(26, 24);
  // two rope hooks and a striped hammock in a curve
  const y = (x) => Math.round(7 + 8 * Math.sin(((x - 2) / 22) * Math.PI));
  const cols = ['#e5572f', '#f8efe0', '#f2c230', '#f8efe0'];
  for (let x = 3; x < 23; x++) {
    const top = y(x);
    for (let k = 0; k < 5; k++) put(img, x, top + k, k === 4 ? NAVY : cols[(Math.floor((x - 3) / 2) + k) % 4]);
    put(img, x, top - 1, NAVY);
    // fringe
    if (x % 2 === 0) put(img, x, top + 5, '#c8b8a0');
  }
  for (let k = 0; k < 4; k++) { put(img, 3, y(3) + k, NAVY); put(img, 22, y(22) + k, NAVY); }
  line(img, 3, y(3) - 1, 0, 3, '#d8c8a0'); line(img, 22, y(22) - 1, 25, 3, '#d8c8a0');
  fillRect(img, 0, 1, 2, 3, NAVY); fillRect(img, 24, 1, 2, 3, NAVY); put(img, 1, 2, METAL.hi2); put(img, 24, 2, METAL.hi2);
  // a cushion at one end
  fillRect(img, rot === 0 ? 6 : 14, y(10) - 2, 6, 3, '#f8f2e4'); fillRect(img, rot === 0 ? 6 : 14, y(10) - 2, 6, 1, '#ffffff');
  return { img, anchor: [13, 21] };
}

function filtro(rot) {
  const img = blank(16, 30);
  const C = RAMP.clay;
  // wooden stand, lower jar (with a tap), upper filter with a lid and a small ladle
  fillRect(img, 3, 22, 10, 1, NAVY); fillRect(img, 2, 23, 12, 2, WOOD.mid); fillRect(img, 2, 23, 12, 1, WOOD.hi);
  fillRect(img, 3, 25, 2, 4, WOOD.lo); fillRect(img, 11, 25, 2, 4, WOOD.lo);
  shape(img, ell(8, 17, 5.5, 5), [8, 17, 5.5, 5], C); // lower jar
  shape(img, ell(8, 7.5, 5, 6), [8, 8, 5, 6], C); // upper filter
  fillRect(img, 4, 11, 8, 1, NAVY);
  fillRect(img, 5, 1, 6, 2, NAVY); fillRect(img, 6, 1, 4, 1, C[3]); fillRect(img, 6, 2, 4, 1, C[1]); put(img, 8, 0, '#573c2c'); // lid + knob
  const tapX = rot === 0 ? 13 : 1;
  fillRect(img, tapX - (rot === 0 ? 0 : 0), 19, 2, 3, NAVY); put(img, tapX + (rot === 0 ? 0 : 1) , 20, METAL.hi); put(img, tapX + (rot === 0 ? 0 : 1), 21, '#4fa0d8');
  fillRect(img, 6, 15, 4, 1, C[3]);
  return { img, anchor: [8, 29] };
}

/** Wall banner: a rod and a mustard cloth with an ipê. Walkable, so it hangs without blocking the floor. */
function bannerFundadores() {
  const img = blank(16, 28);
  fillRect(img, 1, 1, 14, 2, WOOD.base);
  fillRect(img, 1, 1, 14, 1, WOOD.hi);
  put(img, 0, 2, NAVY);
  put(img, 15, 2, NAVY);
  put(img, 3, 3, WOOD.lo);
  put(img, 12, 3, WOOD.lo);
  fillRect(img, 2, 4, 12, 16, NAVY);
  fillRect(img, 3, 5, 10, 14, '#f2c230');
  fillRect(img, 3, 5, 10, 2, '#ffe57b');
  put(img, 7, 10, '#c45c26');
  put(img, 6, 9, '#fff59a');
  put(img, 8, 9, '#fff59a');
  put(img, 7, 9, '#fff59a');
  put(img, 6, 11, '#f8d239');
  put(img, 8, 11, '#f8d239');
  put(img, 7, 11, '#f2b22b');
  put(img, 5, 10, '#ffe57b');
  put(img, 9, 10, '#ffe57b');
  fillRect(img, 3, 17, 10, 2, '#c45c26');
  for (let x = 3; x < 13; x += 2) put(img, x, 19, '#c45c26');
  return { img, anchor: [8, 26] };
}

function easel() {
  const img = blank(18, 32);
  // three wooden legs, a canvas with a yellow ipê
  for (const [x0, y0, x1, y1] of [[3, 12, 1, 30], [14, 12, 16, 30], [9, 14, 9, 31]]) line(img, x0, y0, x1, y1, WOOD.base);
  for (const [x0, y0, x1, y1] of [[3, 12, 1, 30], [14, 12, 16, 30]]) line(img, x0 - 1, y0, x1 - 1, y1, NAVY);
  fillRect(img, 1, 0, 16, 20, NAVY);
  fillRect(img, 2, 1, 14, 18, '#a9d2f0'); fillRect(img, 2, 1, 14, 6, '#c4dff2');
  fillRect(img, 2, 15, 14, 4, '#8fbf6a'); fillRect(img, 2, 15, 14, 1, '#a8d080');
  // trunk + yellow canopy
  fillRect(img, 8, 9, 2, 8, '#6b4b30'); fillRect(img, 6, 11, 2, 1, '#6b4b30'); fillRect(img, 10, 10, 2, 1, '#6b4b30');
  for (const [cx, cy, r] of [[6, 6, 3], [12, 6, 3], [9, 4, 3], [9, 8, 2]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.hypot(x, y) <= r + 0.3) put(img, cx + x, cy + y, (x + y) % 3 === 0 ? '#ffe57b' : (x * y) % 2 ? '#f8d239' : '#f2b22b');
  put(img, 5, 17, '#f2b22b'); put(img, 11, 18, '#f8d239'); put(img, 8, 18, '#f2b22b'); // fallen petals
  fillRect(img, 1, 20, 16, 2, WOOD.mid); fillRect(img, 1, 20, 16, 1, WOOD.hi); // ledge
  return { img, anchor: [9, 30] };
}

// ------------------------------------------------------------------ cozinha (kitchenette 2x1)
function cozinha() {
  const w = 32, h = 36;
  const img = blank(w, h);
  // backsplash: terracotta tiles against the wall
  fillRect(img, 0, 0, w, 14, NAVY);
  for (let y = 1; y < 13; y++) for (let x = 1; x < w - 1; x++) put(img, x, y, (x % 6 === 0 || y % 6 === 0) ? '#e9d9bd' : h2(x, y, 3) < 0.08 ? '#d8804c' : '#c8683a');
  fillRect(img, 1, 1, w - 2, 1, '#f0c95a');
  // left unit: sink counter (cream top with a basin, wooden cabinet doors)
  fillRect(img, 0, 13, 16, 22, NAVY);
  fillRect(img, 1, 14, 14, 9, '#f2e8d4'); fillRect(img, 1, 14, 14, 1, '#ffffff'); fillRect(img, 1, 22, 14, 1, '#cbbfa6');
  shape(img, or(box(3, 15, 12, 21)), [7, 18, 5, 3], ['#6c6e85', '#8b8bab', '#a2a6be', '#c6bdd5'], { t: [0.9, 0.4, 0] });
  fillRect(img, 10, 15, 1, 3, '#d8d0e0'); put(img, 10, 14, '#b2aecb'); put(img, 12, 16, '#4fa0d8');
  fillRect(img, 1, 23, 14, 11, WOOD.mid); fillRect(img, 1, 23, 14, 1, WOOD.hi);
  fillRect(img, 2, 25, 6, 8, WOOD.base); fillRect(img, 9, 25, 5, 8, WOOD.base); fillRect(img, 2, 25, 6, 1, WOOD.hi2); fillRect(img, 9, 25, 5, 1, WOOD.hi2);
  put(img, 7, 28, '#f2c230'); put(img, 9, 28, '#f2c230');
  // right unit: stove with a moka pot, oven door with a window
  fillRect(img, 16, 13, 16, 22, NAVY);
  fillRect(img, 17, 14, 14, 9, '#565972'); fillRect(img, 17, 14, 14, 1, '#8b8bab');
  for (const [cx, cy] of [[21, 17], [27, 17], [21, 20], [27, 20]]) { fillRect(img, cx - 2, cy - 1, 5, 3, NAVY); fillRect(img, cx - 1, cy, 3, 1, '#3a3a50'); put(img, cx, cy, '#6c6e85'); }
  // moka pot (cafeteira italiana) on the back right burner
  fillRect(img, 26, 9, 4, 8, NAVY); fillRect(img, 27, 10, 2, 6, '#b2aecb'); fillRect(img, 27, 10, 1, 6, '#d8d0e0'); fillRect(img, 26, 7, 4, 3, NAVY); fillRect(img, 27, 8, 2, 1, '#c45c26'); fillRect(img, 30, 11, 2, 1, NAVY); put(img, 28, 5, '#e8e4dc'); put(img, 27, 4, '#c6c8d4');
  fillRect(img, 17, 23, 14, 11, '#6c6e85'); fillRect(img, 17, 23, 14, 1, '#a2a6be');
  fillRect(img, 19, 25, 10, 7, NAVY); fillRect(img, 20, 26, 8, 5, '#3a3a50'); fillRect(img, 20, 26, 8, 1, '#565972'); fillRect(img, 20, 24, 8, 1, '#d8d0e0'); // handle
  for (const x of [19, 22, 25, 28]) put(img, x, 22, '#d93232');
  fillRect(img, 0, 34, w, 2, NAVY);
  return { img, anchor: [16, 34] };
}

// ------------------------------------------------------------------ registry
/** furniture id -> { rot0(), rot1() } returning { img, anchor } (frames for animated ones). */
export const FURNITURE_ART = {
  pufe_amarelo: { a: pufe, b: pufe },
  poltrona_verde: { a: () => armchair(0), b: () => armchair(1) },
  mesinha: { a: mesinha, b: mesinha },
  planta: { a: monstera, b: monstera },
  tapete: { a: () => tapete(0), b: () => tapete(1) },
  radio: { a: () => radio(0), b: () => radio(1) },
  rede: { a: () => rede(0), b: () => rede(1) },
  filtro: { a: () => filtro(0), b: () => filtro(1) },
  quadro: { a: easel, b: easel },
  banner_fundadores: { a: bannerFundadores, b: bannerFundadores },
};

export function furnitureAuthored(_ctx, { id, rot }) {
  const e = FURNITURE_ART[id];
  const r = (rot === 0 ? e.a : e.b)();
  // mirrored (rot 1) copies of symmetric pieces face the other way
  const mirror = e.a === e.b && rot === 1;
  return [{ img: mirror ? m(r.img) : r.img, anchor: mirror ? [r.img.w - r.anchor[0], r.anchor[1]] : r.anchor }];
}

export function ventilador(_ctx, { rot }) {
  const frames = ventiladorFrames();
  return [{ frames: rot === 1 ? frames.map(m) : frames, anchor: [8, 26], fps: 8 }];
}

export const cozinhaPart = () => {
  const r = cozinha();
  return [{ img: r.img, anchor: r.anchor }];
};

// pack pieces with a recolor / trim: cropped from sheets by the generator so the map stays short
export async function packPiece(ctx, { sheet, rect, ramp, foot = 2, mirror = false }) {
  let img = trim(crop(await ctx.sheet(sheet), ...rect)).img;
  if (ramp) img = recolorRamp(img, ramp);
  if (mirror) img = flipH(img);
  return [{ img, anchor: [Math.floor(img.w / 2), img.h - foot] }];
}

/** The pack cat (18 frames of 32x16: settling, lying, tail flick) trimmed to their common box; rot 1 is mirrored so it faces the other way. */
export async function gato(ctx, { rot }) {
  const sheet = recolorRamp(await ctx.sheet('cat'), ['#8f4f1a', '#b8692a', '#e0913f', '#f0b060', '#f8d896']);
  const frames = Array.from({ length: 18 }, (_, i) => crop(sheet, i * 32, 0, 32, 16));
  let x0 = 32, y0 = 16, x1 = 0, y1 = 0;
  for (const f of frames) {
    const t = trim(f);
    if (t.img.w === 1 && t.img.h === 1) continue;
    x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x + t.img.w); y1 = Math.max(y1, t.y + t.img.h);
  }
  const out = frames.map((f) => { const c = crop(f, x0, y0, x1 - x0, y1 - y0); return rot === 1 ? flipH(c) : c; });
  return [{ frames: out, anchor: [Math.floor((x1 - x0) / 2), y1 - y0 - 1], fps: 6 }];
}

/** A 1-tile-wide bookshelf: the pack's 2-tile shelf cut to its left 14 px plus a mirrored copy of its left post as the right side. */
export async function estante(ctx, { rect }) {
  const src = trim(crop(await ctx.sheet('living'), ...rect)).img;
  const out = blank(16, src.h);
  paste(out, crop(src, 0, 0, 14, src.h), 0, 0);
  paste(out, flipH(crop(src, 0, 0, 2, src.h)), 14, 0);
  return [{ img: out, anchor: [8, src.h - 2] }];
}

export async function cama(ctx) {
  const g = await ctx.sheet('generic');
  const img = blank(32, 32);
  const head = crop(g, 64, 944, 32, 16); // terracotta headboard with the pillow rests
  const blanket = crop(g, 128, 944, 16, 16); // green blanket tile
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
    const i = ((y + 16) * 32 + x) * 4;
    const s = ((y * 16) + (x % 16)) * 4;
    img.data.set(blanket.data.subarray(s, s + 4), i);
  }
  paste(img, head, 0, 0);
  // pillows and a folded edge, then a navy outline round the blanket
  fillRect(img, 3, 12, 11, 4, '#f8f2e4'); fillRect(img, 18, 12, 11, 4, '#f8f2e4'); fillRect(img, 3, 12, 11, 1, '#ffffff'); fillRect(img, 18, 12, 11, 1, '#ffffff');
  fillRect(img, 3, 15, 11, 1, '#cfc4b0'); fillRect(img, 18, 15, 11, 1, '#cfc4b0');
  fillRect(img, 1, 20, 30, 1, '#f2c230'); fillRect(img, 1, 21, 30, 1, '#c99a2a'); // mustard stripe of the throw
  fillRect(img, 0, 16, 1, 16, NAVY); fillRect(img, 31, 16, 1, 16, NAVY); fillRect(img, 0, 31, 32, 1, NAVY);
  fillRect(img, 1, 30, 30, 1, '#2e6a4a');
  return [{ img, anchor: [16, 32] }];
}

export const DERIVE_KITNET = {
  kitCama: cama,
  kitGato: gato,
  kitEstante: estante,
  kitFurniture: furnitureAuthored,
  kitVentilador: ventilador,
  kitCozinha: cozinhaPart,
  kitPack: packPiece,
};
export { paste, sub };
