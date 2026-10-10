// Lagoa do Jerivá: the freshwater lagoon a trail west of the Praia, hand-authored in the LimeZu manner like custom/praia.mjs (navy outline
// where a shape meets empty space, light from the upper left, flat bands, no gradients). Original pieces; the brand palette plus the lagoon's
// own water token, a deep green-teal #3d8073 (docs/art/palette.md), darker and greener than the sea.
//
//   terrain      lagoa (w, a `shore` edge in mud and shallows instead of foam: see LAGOA_SHORE)
//   the mata     lagoa/moita, lagoa/moita_b (2 x 1 thickets of restinga on the borders), lagoa/moita_p (one tile, the side borders)
//   the banks    lagoa/heliconia, lagoa/bromelia, lagoa/tronco (a fallen log to sit on), lagoa/pique_nique (a picnic cloth)
//   the water    lagoa/junco (reeds in the shallows), lagoa/aguape_a|b|c (lily pads, two in flower), lagoa/canoa_agua (a canoe tied up)
//   the mirante  lagoa/quiosque_sape (four posts and a rail) + _telhado (the thatched roof, overhead) + _lit (a lantern under it)
//   signs        lagoa/placa_lagoa (the entrance board), lagoa/placa_capivara (the warning), lagoa/placa_trilha (the arrow on the Praia)
//   life         lagoa/capivara (walk, graze, rest), lagoa/capivara_filhote, lagoa/garca (an egret: stand, peck), lagoa/marreca (a duck
//                paddling), lagoa/libelula (a dragonfly) — moved by render/pixel/lake.ts
//   far away     lagoa/serra_0..3: the Serra do Mar over the treetops, the lagoa's skyline (14 tiles each, seamless in order)
import { blank, crop, flipH } from '../../../../scripts/lib/pixel/img.mjs';
import { put, fillRect, NAVY, h2 } from './paint.mjs';
import { C, drawShaded, newMask, fillMask, outlineAround } from './kit.mjs';
import { text, textW } from './aeroporto.mjs';

// ------------------------------------------------------------------ palette
/** The lagoon: still, deep green-teal water with pale ripples and the sky's glint. */
export const LAKE = { deep: '#2f685e', lo: '#356f65', base: '#3d8073', hi: '#55978a', hi2: '#86bcad', glint: '#c9e6dc' };
/**
 * The bank where the water meets the grass (the `shore` builder's style): a dark line of wet mud at the very edge, then a band of pale shallows,
 * then a lip a shade lighter than the water; on the grass side a soft dark-green wet band.
 */
export const LAGOA_SHORE = { foam: '#5b4a33', foam2: '#6aa08a', lip: '#4f9081', wet: [36, 70, 30] };
const LEAF = ['#2c5532', '#3d7340', '#58944a', '#7fb85a'];
const LEAF2 = ['#25483a', '#356349', '#4c8455', '#6aa864'];
const BARK = ['#4a3424', '#654832', '#836046', '#a07a5a'];
const WOOD = ['#5f4a38', '#7e6550', '#9c8268', '#b9a086'];
const THATCH = ['#8a6a32', '#a8843e', '#c6a052', '#e0c070'];
const CAPI = ['#5a3a22', '#7a5233', '#9a6b44', '#b88a5c'];
const PINK = ['#b34a77', '#d8689a', '#ef94b8', '#ffc4da'];
const WARM = '#ffd27a';

const rect = (img, x, y, w, h, hex) => fillRect(img, x, y, w, h, hex);
const dot = (img, x, y, hex) => put(img, x, y, hex);
const mask = (w, h, pred) => fillMask(newMask(w, h), pred);
const solid = (img, pred, ramp, o = {}) => drawShaded(img, mask(img.w, img.h, pred), 0, 0, ramp, o);
const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
const elp = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const poly = (pts) => (x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const opaque = (img, x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3] > 0;
const ctext = (img, cx, y, str, hex, shadow = null) => text(img, Math.round(cx - textW(str) / 2), y, str, hex, 1, shadow);
/** A semi-transparent pixel (water, light). */
const glow = (img, x, y, hex, a) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = parseInt(hex.slice(1, 3), 16);
  img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
  img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
  img.data[i + 3] = a;
};
function post(img, x, top, foot, ramp = WOOD, w = 2) {
  rect(img, x, top, w, foot - top, ramp[1]);
  rect(img, x, top, 1, foot - top, ramp[2]);
}

// ------------------------------------------------------------------ terrain
/**
 * w: the lagoon. Still water: a few long, faint ripples (lighter over darker, the light from the upper left), scattered glints, and a soft
 * darker mottling where the weed is. 32 px pattern = 2 x 2 phases.
 */
export function lagoaAgua() {
  const sheet = blank(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let c = LAKE.base;
    const weed = h2(x >> 2, y >> 2, 31) < 0.18 && h2(x, y, 32) < 0.55;
    if (weed) c = LAKE.lo;
    if (h2(x, y, 33) < 0.03) c = LAKE.lo;
    put(sheet, x, y, c);
  }
  // ripples: 5-9 px arcs, every 8 rows, staggered
  for (let r = 0; r < 4; r++) {
    const y = 3 + r * 8;
    const x0 = (r * 11 + 5) % 32;
    const len = 5 + Math.floor(h2(r, 1, 34) * 5);
    for (let i = 0; i < len; i++) {
      const x = (x0 + i) % 32;
      const lift = i === 0 || i === len - 1 ? 1 : 0;
      put(sheet, x, y + lift, LAKE.hi);
      put(sheet, x, y + 1 + lift, LAKE.lo);
    }
    // a shorter echo under it
    for (let i = 1; i < len - 2; i++) put(sheet, (x0 + i + 3) % 32, (y + 4) % 32, LAKE.hi);
  }
  for (const [x, y] of [[7, 13], [24, 6], [19, 27], [2, 22]]) put(sheet, x, y, LAKE.glint);
  const out = [];
  for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) out.push(crop(sheet, px * 16, py * 16, 16, 16));
  return out;
}

// ------------------------------------------------------------------ the mata's edge
/** Leafy mass: overlapping lit blobs, then leaf highlights and shadows sprinkled by hash, so it never looks like a smooth ball. */
function foliage(img, blobs, ramp, seed, flowers = null) {
  const inside = (x, y) => blobs.some(([cx, cy, rx, ry]) => elp(cx, cy, rx, ry)(x, y));
  solid(img, inside, ramp, { rimShade: 2 });
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const r = h2(x, y, seed);
    // leaf clusters: a light pixel with a dark one under-right
    if (r < 0.09 && inside(x + 1.5, y + 1.5)) {
      dot(img, x, y, ramp[3]);
      dot(img, x + 1, y + 1, ramp[0]);
    } else if (r > 0.94) dot(img, x, y, ramp[0]);
  }
  if (flowers) for (let n = 0; n < flowers.n; n++) {
    const x = Math.floor(h2(n, seed, 3) * img.w), y = Math.floor(h2(n, seed, 4) * img.h);
    if (inside(x + 0.5, y + 0.5) && inside(x + 1.5, y + 1.5)) {
      dot(img, x, y, flowers.c[1]);
      dot(img, x + 1, y, flowers.c[0]);
    }
  }
}

/** A thicket of restinga two tiles wide: a row of shrubs, a darker one behind, a few pink or white flowers. */
function moita(kind) {
  const img = blank(34, 28);
  const blobs = kind === 'a'
    ? [[8, 12, 8, 7], [21, 9, 9, 8], [28, 15, 6, 6], [14, 18, 9, 7], [5, 20, 5, 5], [26, 21, 7, 5]]
    : [[10, 10, 9, 8], [24, 12, 9, 7], [5, 18, 5, 6], [17, 19, 10, 7], [29, 20, 5, 5]];
  foliage(img, blobs, kind === 'a' ? LEAF : LEAF2, kind === 'a' ? 41 : 43, { n: kind === 'a' ? 26 : 30, c: kind === 'a' ? [C.white, C.cr1] : [PINK[2], PINK[1]] });
  return { img, anchor: [16, 26] };
}
/** The one-tile thicket for the side borders (they stack one per row). */
function moitaP() {
  const img = blank(20, 26);
  foliage(img, [[9, 10, 8, 8], [10, 18, 9, 7], [5, 15, 4, 5]], LEAF2, 47, { n: 10, c: [C.y1, C.y2] });
  return { img, anchor: [10, 24] };
}

/** Helicônia: big paddle leaves and a hanging zigzag of red bracts tipped with yellow. */
function heliconia() {
  const img = blank(20, 30);
  for (const [x0, y0, x1, y1] of [[10, 28, 3, 6], [10, 28, 17, 4], [10, 28, 9, 2]]) {
    // the stalk and a long oval leaf at its end
    const n = 16;
    for (let i = 0; i < n; i++) dot(img, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), C.g3);
  }
  solid(img, poly([[3, 6], [6, 3], [9, 9], [6, 14]]), LEAF, { rimShade: 1 });
  solid(img, poly([[17, 4], [14, 2], [12, 9], [15, 13]]), LEAF, { rimShade: 1 });
  solid(img, poly([[9, 2], [12, 4], [11, 11], [8, 9]]), LEAF2, { rimShade: 1 });
  // the bracts: a red zigzag hanging from the middle
  for (let i = 0; i < 5; i++) {
    const y = 13 + i * 3, side = i % 2 ? 1 : -1;
    solid(img, poly([[10, y], [10 + side * 4, y + 1], [10, y + 3]]), [C.r6, C.r4, C.r2, C.r1], { rimShade: 1, outline: false });
    dot(img, 10 + side * 3, y + 1, C.y2);
  }
  for (let y = 12; y < 29; y++) dot(img, 10, y, C.g3);
  outlineAround(img);
  return { img, anchor: [10, 28] };
}

/** Bromélia: a rosette of stiff striped leaves around a pink heart. */
function bromelia() {
  const img = blank(18, 14);
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.05 + (k / 8) * 0.9);
    const len = 6 + (k % 2) * 2;
    for (let i = 0; i < len; i++) {
      const x = Math.round(9 - Math.cos(a) * i), y = Math.round(11 - Math.sin(a) * i * 0.85);
      dot(img, x, y, i > len - 2 ? C.g1 : k % 2 ? C.g2 : '#4f8f4a');
      if (i > 1 && i < len - 2) dot(img, x + (a < Math.PI / 2 ? 1 : -1), y, C.g3);
    }
  }
  solid(img, elp(9, 8, 2.2, 2), PINK, { rimShade: 1, outline: false });
  dot(img, 9, 7, PINK[3]);
  outlineAround(img);
  return { img, anchor: [9, 12] };
}

/** A fallen log on the bank, smooth on top from all the sitting: bark, a pale cut end with its rings, a tuft of moss. */
function tronco() {
  const img = blank(34, 14);
  solid(img, box(3, 3, 30, 11), BARK, { rimShade: 2 });
  for (let x = 4; x < 29; x++) { if (h2(x, 2, 7) < 0.35) dot(img, x, 6, BARK[0]); if (h2(x, 3, 7) < 0.25) dot(img, x, 8, BARK[1]); }
  rect(img, 5, 3, 22, 1, BARK[3]);
  solid(img, elp(30, 7, 3, 4.2), ['#9a7a52', '#c9a676', '#e0c08e', '#f0d6a6'], { rimShade: 1 });
  for (const [x, y] of [[30, 6], [30, 8], [29, 7], [31, 7]]) dot(img, x, y, '#a8865a');
  dot(img, 30, 7, '#7a5a38');
  for (const [x, y] of [[8, 3], [9, 3], [10, 2], [11, 3], [20, 3], [21, 2]]) dot(img, x, y, C.g2);
  return { img, anchor: [16, 12] };
}

/** A checkered picnic cloth on the grass: a wicker basket, a slice of melancia, two cups. Lies flat. */
function piqueNique() {
  const img = blank(32, 16);
  for (let y = 2; y < 15; y++) for (let x = 2; x < 30; x++) {
    const chk = ((x >> 2) + (y >> 2)) % 2;
    dot(img, x, y, chk ? C.r3 : C.cr0);
    if (y === 14 || x === 29) dot(img, x, y, chk ? C.r6 : C.cr2);
  }
  solid(img, box(5, 3, 13, 9), [C.w5, C.w3, C.w2, C.w1], { rimShade: 1 });
  for (let x = 6; x < 12; x += 2) dot(img, x, 6, C.w5);
  for (let x = 6; x < 12; x++) dot(img, x, 2 - (x > 7 && x < 10 ? 1 : 0), C.w4);
  solid(img, poly([[17, 9], [25, 9], [21, 4]]), [C.r6, C.r2, C.r1, C.r0], { rimShade: 1 });
  rect(img, 17, 9, 9, 1, C.g2);
  for (const [x, y] of [[20, 7], [22, 7], [21, 6]]) dot(img, x, y, NAVY);
  for (const cx of [9, 13]) { solid(img, box(cx, 11, cx + 2, 13), [C.lav, C.lav3, C.lav4, C.white], { outline: false }); }
  return { img, anchor: [16, 15] };
}

// ------------------------------------------------------------------ the water
/** Reeds in the shallows (juncos): thin stalks of two greens, a couple bent over, a ring of ripple at their foot. */
function junco() {
  const img = blank(16, 24);
  for (const [x, lean, top, bend] of [[3, -0.12, 7, 0], [6, 0.02, 2, 0], [8, -0.05, 5, 1], [10, 0.12, 4, 0], [12, 0.25, 9, 1], [5, -0.3, 11, 0]]) {
    for (let y = top; y < 21; y++) {
      const x1 = Math.round(x + (21 - y) * lean);
      dot(img, x1, y, y < top + 4 ? '#a6c860' : y % 5 === 0 ? C.g3 : C.g2);
    }
    if (bend) for (let i = 1; i < 4; i++) dot(img, Math.round(x + (21 - top) * lean) + i, top - 1 + (i >> 1), '#a6c860');
  }
  outlineAround(img);
  // the ripple ring round the foot, soft and pale (drawn after the outline: the water shows through it)
  for (let x = 1; x < 15; x++) {
    const r = Math.abs(x - 8) / 7;
    glow(img, x, 21 + (r > 0.75 ? -1 : 0), LAKE.hi2, 150);
    if (r < 0.6) glow(img, x, 23, LAKE.hi, 120);
  }
  return { img, anchor: [8, 22] };
}

/** Lily pads (aguapés and ninféias): round pads each with its notch, a lighter rim, a vein; `b` has a pink flower, `c` a white one. */
function aguape(kind) {
  const img = blank(18, 14);
  const pads = { a: [[6, 6, 5, 3.6, 0.6], [12, 9, 4, 2.8, 2.4], [13, 4, 2.6, 1.8, 4.2]], b: [[7, 8, 5.5, 3.8, 5.6], [13, 5, 3.4, 2.4, 1.4]], c: [[9, 7, 6, 4, 2.2], [3, 11, 2.4, 1.6, 0.4], [15, 10, 2.2, 1.6, 3]] }[kind];
  for (const [cx, cy, rx, ry, notch] of pads) {
    const inPad = (x, y) => {
      if (!elp(cx, cy, rx, ry)(x, y)) return false;
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
      const d = Math.abs(((a - notch + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      return d > 0.32;
    };
    solid(img, inPad, ['#2f6a3a', '#3f8a44', '#5aa64e', '#86c86a'], { rimShade: 1, ol: '#24503a' });
    for (let i = 1; i < rx - 1; i++) { const x = Math.round(cx + Math.cos(notch + Math.PI) * i), y = Math.round(cy + Math.sin(notch + Math.PI) * i * (ry / rx)); if (inPad(x + 0.5, y + 0.5)) dot(img, x, y, '#4f984a'); }
  }
  if (kind === 'b' || kind === 'c') {
    const [cx, cy] = kind === 'b' ? [7, 6] : [9, 5];
    const ramp = kind === 'b' ? PINK : [C.lav2, C.lav3, C.lav4, C.white];
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) solid(img, elp(cx + dx, cy + dy, 1.4, 1.2), ramp, { rimShade: 1, outline: false });
    dot(img, cx, cy, C.y2); dot(img, cx, cy - 1, C.y1);
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3]]) dot(img, cx + dx, cy + dy, ramp[0]);
  }
  return { img, anchor: [9, 13] };
}

/** A canoe tied up off the boardwalk: dark wood, a paddle inside, the rope to the post, a soft ripple round the hull. Lies on the water. */
function canoaAgua() {
  const img = blank(40, 16);
  // the ripple first: the hull covers most of it
  for (let x = 2; x < 38; x++) {
    const u = (x - 20) / 18;
    const half = 5.6 * Math.sqrt(Math.max(0, 1 - u * u));
    glow(img, x, Math.round(8 - half - 1), LAKE.hi2, 140);
    glow(img, x, Math.round(8 + half + 1), LAKE.hi, 160);
  }
  const hull = (x, y) => { const u = (x - 20) / 16; return Math.abs(u) <= 1 && Math.abs(y - 8) <= 4.4 * Math.sqrt(Math.max(0, 1 - u * u)); };
  solid(img, hull, ['#3a2a20', '#55402e', '#6f553d', '#8a6c4e'], { rimShade: 1 });
  solid(img, (x, y) => { const u = (x - 20) / 13.5; return Math.abs(u) <= 1 && Math.abs(y - 7.5) <= 2.6 * Math.sqrt(Math.max(0, 1 - u * u)); }, ['#6f553d', '#8a6c4e', '#a3835f', '#bd9c74'], { rimShade: 1, outline: false });
  // the thwart, the paddle, a red stripe
  rect(img, 19, 5, 2, 6, C.w3);
  for (let x = 11; x < 30; x++) dot(img, x, 7 + Math.round((x - 11) * 0.06), C.w1);
  rect(img, 27, 6, 4, 2, C.w2);
  for (let x = 7; x < 34; x++) if (hull(x + 0.5, 11.5) && !hull(x + 0.5, 12.5)) dot(img, x, 11, C.r4);
  // the rope off the bow, to the post on the right
  for (let i = 0; i < 6; i++) dot(img, 36 + Math.floor(i / 2), 7 - Math.round(Math.sin((i / 5) * Math.PI)), C.cr2);
  return { img, anchor: [20, 15] };
}

// ------------------------------------------------------------------ the mirante's gazebo
/** A thatched gazebo (4 x 2): four posts with a low rail, a lantern under the roof (lit at night), the sapê roof as the overhead part. */
function quiosqueSape() {
  const W = 72, H = 64;
  const full = blank(W, H);
  // the roof: a wide straw hip, a ridge pole, a ragged fringe
  const roof = poly([[2, 26], [70, 26], [58, 5], [14, 5]]);
  solid(full, (x, y) => roof(x, y) || (y >= 26 && y < 29 && x > 2 && x < 70 && h2(Math.floor(x), 0, 9) < 0.72), THATCH);
  for (let y = 7; y < 26; y += 3) for (let x = 3; x < 69; x++) if (roof(x + 0.5, y + 0.5) && h2(x, y, 10) < 0.5) dot(full, x, y, THATCH[0]);
  for (let y = 8; y < 26; y += 5) for (let x = 3; x < 69; x++) if (roof(x + 0.5, y + 0.5) && h2(x, y, 11) < 0.12) dot(full, x, y, THATCH[3]);
  rect(full, 14, 3, 44, 3, WOOD[0]);
  rect(full, 15, 3, 42, 1, WOOD[2]);
  const roofImg = crop(full, 0, 0, W, 30);
  // the standing part: posts at the four corners (the back two shorter: they stand further away), the rail on three sides
  const base = blank(W, H);
  for (const x of [10, 60]) post(base, x, 26, 46, WOOD);
  for (const x of [5, 65]) post(base, x, 26, 62, WOOD);
  for (const y of [40, 52]) {
    rect(base, 6, y + 10, 2, 1, WOOD[2]);
    rect(base, 6, y, 1, 12, WOOD[1]);
  }
  for (const [x0, x1, y] of [[7, 65, 48], [7, 65, 54]]) { rect(base, x0, y, x1 - x0, 1, WOOD[2]); rect(base, x0, y + 1, x1 - x0, 1, WOOD[0]); }
  // the gap in the front rail where you walk in
  for (let y = 48; y < 56; y++) for (let x = 26; x < 46; x++) { const i = (y * W + x) * 4; base.data[i + 3] = 0; }
  // the lantern hanging from the ridge
  rect(base, 35, 26, 1, 6, C.navy2);
  solid(base, box(33, 32, 39, 38), [C.w5, C.w4, C.w3, C.w2], { rimShade: 1 });
  rect(base, 34, 33, 4, 4, '#f4dc9a');
  const baseImg = crop(base, 0, 26, W, H - 26);
  const lit = blank(W, H - 26);
  for (let y = 6; y < 12; y++) for (let x = 33; x < 39; x++) glow(lit, x, y, x > 33 && x < 38 && y > 6 && y < 11 ? '#fff4c0' : WARM, x > 33 && x < 38 && y > 6 && y < 11 ? 255 : 170);
  return {
    base: { img: baseImg, anchor: [36, H - 26 - 1] },
    roof: { img: roofImg, anchor: [36, H - 1] },
    lit: { img: lit, anchor: [36, H - 26 - 1] },
    light: { x: 36, y: 9, r: 56, color: '#ffd890' },
  };
}

// ------------------------------------------------------------------ signs
/** The entrance board: LAGOA DO JERIVÁ burnt into a plank between two rough posts, a fish and a reed carved at the ends. */
function placaLagoa() {
  const img = blank(50, 34);
  post(img, 6, 14, 34, BARK);
  post(img, 42, 14, 34, BARK);
  solid(img, box(1, 2, 49, 20), ['#7a5a3a', '#a07a52', '#bd966a', '#d4b082'], { rimShade: 1 });
  for (let x = 3; x < 47; x++) if (h2(x, 1, 13) < 0.3) dot(img, x, 11, '#a88458');
  ctext(img, 25, 4, 'LAGOA DO', '#4a3020');
  ctext(img, 25, 11, 'JERIVÁ', '#2f6a3a');
  // a fish on the left, a reed on the right
  for (const [x, y] of [[4, 9], [5, 9], [6, 9], [5, 8], [5, 10], [3, 8], [3, 10]]) dot(img, x, y, '#4a3020');
  for (let y = 6; y < 13; y++) dot(img, 46, y, '#2f6a3a');
  rect(img, 46, 6, 1, 2, '#4a3020');
  outlineAround(img);
  return { img, anchor: [25, 33] };
}
/** A yellow diamond on a post: a capybara walking, CAPIVARAS under it. */
function placaCapivara() {
  const img = blank(40, 40);
  const cx = 20;
  post(img, cx - 1, 20, 40, [C.slate, C.slate2, C.mist, C.mist2]);
  solid(img, (x, y) => Math.abs(x - cx) + Math.abs(y - 11) <= 10.5, [C.y4, C.y3, C.y2, C.y1], { rimShade: 1 });
  // the capybara: a barrel body, a square snout, four stubby legs
  rect(img, cx - 6, 9, 10, 5, NAVY);
  rect(img, cx + 3, 8, 4, 4, NAVY);
  for (const dx of [-5, -3, 1, 3]) rect(img, cx + dx, 14, 1, 2, NAVY);
  dot(img, cx + 4, 7, NAVY);
  rect(img, 1, 22, 38, 7, C.white);
  ctext(img, cx, 23, 'CAPIVARAS', NAVY);
  outlineAround(img);
  return { img, anchor: [cx, 39] };
}
/** The trail's arrow on the Praia: a wooden arrow pointing west, TRILHA over LAGOA, a little lily on it. */
function placaTrilha() {
  const img = blank(38, 36);
  post(img, 23, 18, 36, BARK);
  solid(img, poly([[1, 10.5], [9, 1], [9, 4], [36, 4], [36, 18], [9, 18], [9, 21]]), ['#7a5a3a', '#a07a52', '#bd966a', '#d4b082'], { rimShade: 1 });
  ctext(img, 23, 5, 'TRILHA', '#4a3020');
  ctext(img, 23, 11, 'LAGOA', '#2f6a3a');
  outlineAround(img);
  return { img, anchor: [24, 35] };
}

// ------------------------------------------------------------------ living things (lake.ts moves them)
/**
 * A capybara seen from the side, facing east: a brown barrel of a body, the big blunt head, small ears, short legs. Frames: walk (4), graze
 * (head down, 2), rest (lying down, 1). `scale` < 1 makes the pup.
 */
function capivara(pup = false) {
  const s = pup ? 0.62 : 1;
  const W = pup ? 18 : 28, H = pup ? 13 : 20;
  const frame = (legs, head, lying) => {
    const img = blank(W, H);
    const by = H - (lying ? 5 : 8) * s - 1; // body centre
    const legY = H - 2;
    if (!lying) {
      // legs first (the body covers their tops); a walk swings the front and back pairs
      for (const [lx, ph] of [[7, 0], [10, 1], [17, 1], [20, 0]]) {
        const x = Math.round(lx * s), sw = legs === null ? 0 : Math.round(Math.sin(legs + ph * Math.PI) * 1.2 * s);
        rect(img, x + sw, Math.round(by + 2 * s), Math.max(1, Math.round(2 * s)), Math.round(legY - by - 2 * s) + 1, CAPI[0]);
      }
    }
    solid(img, elp(13 * s, by, 9.5 * s, 5.2 * s), CAPI, { rimShade: 2 });
    // the head: a blunt box, lower when grazing
    const hy = by - (head === 'down' ? -2.5 : 2.5) * s;
    const hx = 22 * s;
    solid(img, (x, y) => elp(hx, hy, 4.6 * s, 3.6 * s)(x, y) || box(hx, hy - 3 * s, hx + 5 * s, hy + 3 * s)(x, y), CAPI, { rimShade: 1 });
    dot(img, Math.round(hx + 1 * s), Math.round(hy - 1.5 * s), NAVY); // the eye
    dot(img, Math.round(hx + 4 * s), Math.round(hy - 0.5 * s), CAPI[0]); // the nostril
    if (!pup) { dot(img, Math.round(hx - 2), Math.round(hy - 4), CAPI[1]); dot(img, Math.round(hx - 1), Math.round(hy - 4), CAPI[0]); } // an ear
    return img;
  };
  const walk = [0, 1, 2, 3].map((k) => frame((k / 4) * Math.PI * 2, 'up', false));
  const graze = [frame(null, 'down', false), frame(null, 'down', false)];
  // the second graze frame chews: the snout one pixel up
  const g1 = graze[1];
  for (let y = 0; y < H - 1; y++) for (let x = Math.floor(22 * s); x < W; x++) {
    const i = (y * W + x) * 4, j = ((y + 1) * W + x) * 4;
    for (let c = 0; c < 4; c++) g1.data[i + c] = g1.data[j + c];
  }
  const rest = frame(null, 'up', true);
  return { frames: [...walk, ...graze, rest], anchor: [Math.round(W / 2), H - 1], fps: 6 };
}

/** A great egret (garça-branca): white, the long S of the neck, a yellow bill, black legs. Frames: stand, peck (2), look back. */
function garca() {
  const W = 16, H = 26;
  const frame = (pose) => {
    const img = blank(W, H);
    solid(img, elp(8, 14, 4.2, 3.4), [C.lav, C.lav3, C.lav4, C.white], { rimShade: 1 });
    rect(img, 3, 15, 3, 1, C.lav3); // the tail plumes
    const neck = pose === 'peck' ? [[10, 12], [11, 13], [12, 14], [13, 16], [13, 18]] : pose === 'peck2' ? [[10, 12], [11, 13], [12, 15], [13, 17], [13, 20]] : pose === 'back' ? [[9, 11], [9, 9], [8, 7], [8, 5], [7, 4]] : [[10, 11], [11, 9], [10, 7], [10, 5], [11, 4]];
    for (const [x, y] of neck) { rect(img, x, y, 2, 2, C.white); dot(img, x + 1, y + 1, C.lav3); }
    const [hx, hy] = neck[neck.length - 1];
    const dir = pose === 'back' ? -1 : 1;
    rect(img, hx, hy - 1, 2, 2, C.white);
    for (let i = 0; i < 3; i++) dot(img, hx + (dir > 0 ? 2 + i : -1 - i), hy + (pose.startsWith('peck') ? 1 + (i >> 1) : 0), C.y2);
    dot(img, hx + (dir > 0 ? 1 : 0), hy - 1, NAVY);
    outlineAround(img);
    // thin black legs under the outline, the knee a shade lighter
    for (const x of [7, 9]) { rect(img, x, 18, 1, 8, '#2a2a36'); dot(img, x, 21, '#4a4a5a'); }
    return img;
  };
  return { frames: [frame('stand'), frame('peck'), frame('peck2'), frame('back')], anchor: [8, 25], fps: 4 };
}

/** A whistling duck (marreca-irerê) paddling: white face, brown chest, a tiny V of wake behind. 2 frames. */
function marreca() {
  const frame = (k) => {
    const img = blank(16, 10);
    solid(img, elp(8, 6, 4.6, 2.6), ['#4a3a30', '#6a5040', '#8a6a52', '#a8876a'], { rimShade: 1 });
    solid(img, elp(12, 3.5, 2, 2), [C.lav3, C.lav4, C.white, C.white], { rimShade: 1 });
    dot(img, 12, 3, NAVY); dot(img, 14, 4, NAVY); dot(img, 13, 5, '#3a2a20');
    // the wake: two faint lines behind, a frame apart
    for (let i = 0; i < 4; i++) { glow(img, 2 - i + (k ? 1 : 0), 6 - (i >> 1), LAKE.hi2, 170 - i * 30); glow(img, 2 - i + (k ? 1 : 0), 8 + (i >> 1), LAKE.hi2, 170 - i * 30); }
    return img;
  };
  return { frames: [frame(0), frame(1)], anchor: [8, 8], fps: 3 };
}

/** A dragonfly (libélula): a blue-green body, four glassy wings flicking. 2 frames. */
function libelula() {
  const frame = (k) => {
    const img = blank(9, 7);
    for (let x = 1; x < 8; x++) dot(img, x, 3, x > 5 ? '#2f6aa8' : '#3fa08a');
    dot(img, 7, 3, '#1f3a5a');
    const wy = k ? [1, 5] : [2, 4];
    for (const y of wy) for (const x of [4, 5, 6]) glow(img, x, y, '#dff4ff', k ? 200 : 140);
    for (const y of wy) glow(img, 3, y, '#dff4ff', 110);
    return img;
  };
  return { frames: [frame(0), frame(1)], anchor: [4, 6], fps: 14 };
}

// ------------------------------------------------------------------ the Serra do Mar
/**
 * The lagoa's skyline: the Serra do Mar over the treetops, 4 strips of 14 tiles that join in order and wrap (every curve is periodic over the
 * four). Back to front: a pale far ridge in the haze, a blue-green middle ridge, the near forest (round crowns) whose dark feet the thickets
 * on the north border hide.
 */
function serra() {
  const W = 224, H = 60, P = W * 4;
  const wave = (x, parts) => parts.reduce((s, [amp, per, ph]) => s + amp * Math.sin(((x + ph) / per) * Math.PI * 2), 0);
  const far = (x) => 12 + wave(x, [[7, P, 0], [4, P / 3, 90], [2, P / 8, 30]]);
  const mid = (x) => 26 + wave(x, [[6, P / 2, 200], [3, P / 5, 10], [1.5, P / 16, 50]]);
  // round crowns: a square root of |sin| gives domes with notches between them, not spikes
  const crown = (x) => 45 + wave(x, [[1.5, P / 32, 0], [2.2, P / 56, 17]]) - Math.sqrt(Math.abs(Math.sin((x / 11) * Math.PI))) * 4;
  const strips = [];
  for (let i = 0; i < 4; i++) {
    const img = blank(W, H);
    for (let x = 0; x < W; x++) {
      const gx = i * W + x;
      const fy = Math.round(far(gx)), my = Math.round(mid(gx)), cy = Math.round(crown(gx));
      for (let y = fy; y < H; y++) put(img, x, y, y === fy ? '#c3d6d6' : '#a9c4c4');
      for (let y = my; y < H; y++) put(img, x, y, y === my ? '#86ab9c' : y < my + 3 ? '#709a8a' : '#62907f');
      // the middle ridge's forest texture: darker specks below its crest
      for (let y = my + 3; y < H; y++) if (h2(gx, y, 51) < 0.08) put(img, x, y, '#557f70');
      for (let y = cy; y < H; y++) put(img, x, y, y === cy ? LEAF[3] : y < cy + 2 ? LEAF[2] : y < cy + 7 ? LEAF[1] : LEAF[0]);
      if (h2(gx, 0, 52) < 0.07) put(img, x, cy + 1, PINK[2]); // an ipê-roxo in flower here and there
      if (h2(gx, 1, 53) < 0.05) put(img, x, cy + 1, C.y2); // and an ipê-amarelo
    }
    // a band of morning mist between the far and the middle ridge
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      const gx = i * W + x;
      if (y > mid(gx) - 4 && y < mid(gx) && h2(gx >> 2, y, 54) < 0.6) glow(img, x, y, '#e8f0ee', 120);
    }
    strips.push(img);
  }
  return strips;
}

// ------------------------------------------------------------------ parts for the import pipeline
const meta = (fp, shadow = 'fx/shadow_16', cast = true) => ({ footprint: fp, shadow, ...(cast ? { cast: { kx: 0.4, ky: 0.22 } } : {}) });
const flatMeta = (fp) => ({ footprint: fp, shadow: null, decal: true });

export async function lagoa() {
  const parts = [];
  const add = (key, made, m) => parts.push({ key, ...made, meta: m });
  add('lagoa/moita', moita('a'), meta([2, 1], 'fx/shadow_32'));
  add('lagoa/moita_b', moita('b'), meta([2, 1], 'fx/shadow_32'));
  add('lagoa/moita_p', moitaP(), meta([1, 1], 'fx/shadow_16'));
  add('lagoa/heliconia', heliconia(), meta([1, 1], 'fx/shadow_10'));
  add('lagoa/bromelia', bromelia(), meta([1, 1], 'fx/shadow_10', false));
  add('lagoa/tronco', tronco(), meta([2, 1], 'fx/shadow_32'));
  add('lagoa/pique_nique', piqueNique(), flatMeta([2, 1]));
  add('lagoa/junco', junco(), { footprint: [1, 1], shadow: null });
  for (const k of ['a', 'b', 'c']) add(`lagoa/aguape_${k}`, aguape(k), flatMeta([1, 1]));
  add('lagoa/canoa_agua', canoaAgua(), flatMeta([2, 1]));
  const g = quiosqueSape();
  parts.push({ key: 'lagoa/quiosque_sape', ...g.base, meta: { footprint: [4, 2], shadow: 'fx/shadow_48', overhead: 'lagoa/quiosque_sape_telhado', lit: 'lagoa/quiosque_sape_lit', light: g.light } });
  parts.push({ key: 'lagoa/quiosque_sape_telhado', ...g.roof, meta: { footprint: [4, 2], overhead: true, shadow: null } });
  parts.push({ key: 'lagoa/quiosque_sape_lit', ...g.lit, meta: { footprint: [4, 2], shadow: null } });
  add('lagoa/placa_lagoa', placaLagoa(), meta([1, 1], 'fx/shadow_32'));
  add('lagoa/placa_capivara', placaCapivara(), meta([1, 1], 'fx/shadow_10'));
  add('lagoa/placa_trilha', placaTrilha(), meta([1, 1], 'fx/shadow_16'));
  add('lagoa/capivara', capivara(false), { footprint: [1, 1], shadow: 'fx/shadow_16' });
  add('lagoa/capivara_filhote', capivara(true), { footprint: [1, 1], shadow: 'fx/shadow_10' });
  add('lagoa/garca', garca(), { footprint: [1, 1], shadow: 'fx/shadow_10' });
  add('lagoa/marreca', marreca(), { footprint: [1, 1], shadow: null });
  add('lagoa/libelula', libelula(), { footprint: [1, 1], shadow: null });
  serra().forEach((img, i) => add(`lagoa/serra_${i}`, { img, anchor: [0, img.h] }, { footprint: [14, 2], shadow: null }));
  return parts;
}

/** scratch preview hook: every part on one sheet */
export async function preview() {
  return (await lagoa()).map((x) => x.img ?? x.frames[0]);
}
void flipH; void opaque;
