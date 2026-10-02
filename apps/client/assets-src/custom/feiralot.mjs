// The feira lot (Wave 2): paralelepipedo paving (granite setts, like the old streets of São Paulo) and the decals the market leaves on it:
// chalk price scribbles, damp stains, cabbage leaves, a flattened box. Hard pixels only (the damp stains use a Bayer dither), light from the upper left.
import { blank, setPx, hexPx, rng } from '../../../../scripts/lib/pixel/img.mjs';

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

export const SETT = { joint: '#8b8587', jointLo: '#7d787a', moss: '#7f9a60', mossHi: '#98b274', tones: ['#b3adaa', '#bab3ae', '#a9a4a3', '#c0b8b0', '#aea6a3'], hi: '#cdc6bf', lo: '#989293', tar: '#7d787b', tarHi: '#8e888a' };

/**
 * One fill tile of granite setts: square-ish 8 x 8 stones in running bond (two rows per tile, the second shifted by 4 px, so the tile wraps on all
 * sides), a soft 1 px joint to the right of and under each stone, rounded corners, a lit top-left edge and a shaded bottom-right edge, one of five
 * pale granite tones per stone. `opts` adds wear: `moss` (green in the joints), `sunk` (a stone gone, dark soil), `tar` (a tar patch over a few stones).
 */
function settTile(seed, opts = {}) {
  const img = blank(16, 16);
  const r = rng(seed);
  for (let row = 0; row < 2; row++) {
    const shift = row ? 4 : 0;
    for (let s = 0; s < 2; s++) {
      const x0 = s * 8 + shift;
      const tone = SETT.tones[Math.floor(r() * SETT.tones.length)];
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const x = (x0 + dx) & 15, y = row * 8 + dy;
          const corner = (dx === 6 || dx === 0) && (dy === 6 || dy === 0);
          let c = tone;
          if (dx === 7 || dy === 7) c = dx === 7 && dy === 7 ? SETT.jointLo : SETT.joint;
          else if (corner) c = SETT.joint;
          else if (dy === 0 || dx === 0) c = SETT.hi;
          else if (dy === 6 || dx === 6) c = SETT.lo;
          else if (r() < 0.07) c = r() < 0.5 ? SETT.hi : SETT.lo;
          setPx(img, x, y, hexPx(c));
        }
      }
    }
  }
  if (opts.moss) {
    for (let i = 0; i < 8; i++) setPx(img, Math.floor(r() * 16), r() < 0.5 ? 7 : 15, hexPx(r() < 0.5 ? SETT.moss : SETT.mossHi));
  }
  if (opts.sunk) {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) setPx(img, 4 + x, 8 + y, hexPx(y < 2 ? SETT.jointLo : '#6c6668'));
    for (let x = 0; x < 7; x += 3) setPx(img, 4 + x, 12, hexPx(SETT.tones[2]));
  }
  if (opts.tar) {
    for (let y = 4; y < 12; y++) {
      for (let x = 3; x < 13; x++) {
        if ((x === 3 || x === 12) && (y === 4 || y === 11)) continue;
        const edge = y === 4 || x === 3;
        setPx(img, x, y, hexPx(!edge && (x + y) % 5 === 0 ? SETT.joint : edge ? SETT.tarHi : SETT.tar));
      }
    }
  }
  return img;
}

/** Fill variants of the lot's paving: weighted so most tiles are calm setts; about one tile in six carries some wear. */
export function paralelepipedo() {
  const out = [];
  for (let rep = 0; rep < 4; rep++) for (let k = 0; k < 6; k++) out.push(settTile(0x71 + k * 17));
  out.push(settTile(301, { moss: true }), settTile(302, { moss: true }), settTile(303, { sunk: true }), settTile(304, { tar: true }), settTile(305, { moss: true, sunk: true }));
  return out;
}

const CHALK = '#ebe8de';
const CHALK_LO = '#c9c6bd';
/** 3 x 5 hand-lettering for the chalk prices. */
const GLYPHS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], R: ['110', '101', '110', '101', '101'], $: ['011', '110', '010', '011', '110'],
  ',': ['0', '0', '0', '1', '1'], '/': ['001', '001', '010', '100', '100'], k: ['100', '101', '110', '101', '101'], g: ['011', '101', '011', '001', '110'],
};

function chalkText(text, seed) {
  const r = rng(seed);
  const w = text.length * 4 + 5, h = 11;
  const img = blank(w, h);
  let x = 2;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) { x += 3; continue; }
    const jy = r() < 0.4 ? 1 : 0; // letters wander a little, like chalk
    g.forEach((row, gy) => [...row].forEach((v, gx) => { if (v === '1') setPx(img, x + gx, 2 + gy + jy - (gy > 99 ? 1 : 0), hexPx(r() < 0.18 ? CHALK_LO : CHALK)); }));
    x += g[0].length + 1;
  }
  for (let i = 1; i < x - 1; i++) if (r() < 0.9) setPx(img, i, 9, hexPx(CHALK_LO)); // an underline
  setPx(img, x - 1, 8, hexPx(CHALK_LO));
  return img;
}

/** A damp patch: a dithered darker blob with a firmer core (a leak, a hose, melted ice from the fish stall). */
function damp(w, h, seed) {
  const img = blank(w, h);
  const r = rng(seed);
  const wob = [r() * 6.28, r() * 6.28];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.atan2((y - h / 2) / (h / 2), (x - w / 2) / (w / 2));
      const edge = 0.82 + 0.14 * Math.sin(a * 2 + wob[0]) + 0.08 * Math.sin(a * 3 + wob[1]);
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      if (d > edge) continue;
      const t = 1 - d / edge;
      if (t * 2.2 > bayer(x, y) + 0.1) setPx(img, x, y, hexPx(t > 0.45 ? '#4a4a58' : '#585666'));
    }
  }
  return img;
}

/** Cabbage leaves dropped in the lot: overlapping green leaves with a pale rib (16 x 16 canvas). */
function leaves(kind) {
  const img = blank(16, 16);
  const G = ['#3f7a3a', '#5a9a45', '#7fb858', '#a5d078', '#cfe6a0'];
  const leaf = (cx, cy, rx, ry, flip) => {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1) continue;
        const rib = Math.abs(y - (flip ? x * 0.4 : -x * 0.4)) < 0.7;
        setPx(img, cx + x, cy + y, hexPx(rib ? G[4] : d > 0.62 ? G[0] : (x + y) % 3 === 0 ? G[1] : G[2]));
      }
    }
  };
  if (kind === 0) { leaf(6, 8, 4, 3, false); leaf(10, 9, 3, 2, true); leaf(8, 5, 2, 2, false); }
  else { leaf(8, 7, 5, 3, true); leaf(5, 11, 3, 2, false); setPx(img, 12, 11, hexPx(G[1])); setPx(img, 13, 12, hexPx(G[0])); }
  return img;
}

/** A flattened cardboard box with a torn flap and a strip of tape (20 x 14). */
function flatBox() {
  const img = blank(20, 14);
  const B = ['#7c5a3a', '#a0794d', '#b89160', '#caa876'];
  for (let y = 2; y < 11; y++) for (let x = 2; x < 17; x++) setPx(img, x, y, hexPx(y === 2 ? B[3] : y === 10 ? B[0] : (x * 3 + y) % 7 === 0 ? B[1] : B[2]));
  for (let x = 2; x < 17; x++) setPx(img, x, 11, hexPx(B[0]));
  for (let y = 2; y < 11; y++) { setPx(img, 2, y, hexPx(B[1])); setPx(img, 16, y, hexPx(B[0])); setPx(img, 9, y, hexPx('#d9c9a3')); }
  for (const [x, y] of [[17, 4], [18, 4], [17, 5], [18, 5], [19, 5], [17, 6], [18, 6]]) setPx(img, x, y, hexPx(B[2]));
  setPx(img, 19, 5, hexPx(B[1]));
  for (let x = 4; x < 8; x++) setPx(img, x, 6, hexPx('#a23a30')); // a faded print on the lid
  return img;
}

/** The market-lot decals. `kind`: giz (chalk prices, `n` picks the text), mancha (damp stain, `n` the size), repolho (`n` 0/1), caixa. */
export function feiraDecal(kind, n = 0) {
  if (kind === 'giz') return chalkText(['R$2,50', '3/R$10', 'R$5/kg', 'R$8', 'R$1,99'][n % 5], 700 + n);
  if (kind === 'mancha') return [damp(30, 14, 801), damp(22, 12, 802), damp(36, 16, 803)][n % 3];
  if (kind === 'repolho') return leaves(n % 2);
  return flatBox();
}
