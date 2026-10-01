// Ground materials, V1 pass: asphalt fills (calm, with a few cracks, patches and oil stains), the bus-bay box, and the grass dressing decals
// (large soft value patches, worn dirt, clover, blade tufts). Colours are the LimeZu palette (grass and asphalt values sampled from the pack's own
// terrain tiles) plus the Brazilian road yellow. Hard pixels only; the soft patches use a Bayer dither, never alpha gradients.
import { blank, setPx, hexPx, rng } from '../../../../scripts/lib/pixel/img.mjs';

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

/** The asphalt of the pack, three near-identical warm greys. */
export const ASPHALT = { base: '#565254', lo: '#534f52', hi: '#595555', warm: '#605755', crack: '#3f3b42', crackHi: '#645d5d', oil: '#47434a', patch: '#4e4a4e', patchHi: '#5e5959' };

function noisy(seed, density = 0.1) {
  const img = blank(16, 16);
  const r = rng(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = r();
      setPx(img, x, y, hexPx(v < density ? ASPHALT.lo : v > 1 - density ? ASPHALT.hi : v > 1 - density * 1.25 ? ASPHALT.warm : ASPHALT.base));
    }
  }
  return img;
}

/** A hairline crack: a random walk across the tile, one dark pixel per step with a lighter lip below it. */
function crack(img, x0, y0, len, seed) {
  const r = rng(seed);
  let x = x0, y = y0;
  for (let i = 0; i < len; i++) {
    setPx(img, x & 15, y & 15, hexPx(ASPHALT.crack));
    setPx(img, x & 15, (y + 1) & 15, hexPx(ASPHALT.crackHi));
    const v = r();
    x += v < 0.7 ? 1 : v < 0.85 ? 0 : 1;
    y += v < 0.7 ? 0 : v < 0.85 ? 1 : -1;
  }
}

/**
 * Asphalt fill variants (weighted: the first `plain` are the common, almost flat ones). Hash-picked per tile by `tileIndex`, so a crack or a patch
 * shows up on roughly one tile in ten and the rest of the street stays calm.
 */
export function asfalto() {
  const plain = [];
  for (let k = 0; k < 7; k++) plain.push(noisy(0xa5 + k * 31, 0.08));
  // the variant pick is a uniform hash, so the plain tiles are repeated to weight the specials down to about one tile in ten
  const out = [];
  for (let rep = 0; rep < 5; rep++) out.push(...plain);
  // cracked
  const c1 = noisy(901, 0.07); crack(c1, 0, 6, 11, 5); crack(c1, 6, 7, 6, 8); out.push(c1);
  const c2 = noisy(902, 0.07); crack(c2, 3, 14, 9, 12); crack(c2, 8, 9, 7, 13); out.push(c2);
  // a repaired patch: a rectangle of slightly different asphalt with a lit seam on its top and left edges
  const p = noisy(903, 0.05);
  for (let y = 4; y < 11; y++) for (let x = 3; x < 13; x++) setPx(p, x, y, hexPx(y === 4 || x === 3 ? ASPHALT.patchHi : y === 10 || x === 12 ? ASPHALT.crack : ASPHALT.patch));
  out.push(p);
  // an oil stain: a dithered dark drop
  const o = noisy(904, 0.06);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot((x - 7.5) / 5.5, (y - 8) / 4);
    if (d < 1 && (1 - d) * 1.3 > bayer(x, y)) setPx(o, x, y, hexPx(ASPHALT.oil));
  }
  out.push(o);
  return out;
}

/** The bus bay: a clean yellow box on the road in front of the stop (w x h px, 2 px border, lit top edge, a few small hatch ticks). */
export function busBay(w = 112, h = 32) {
  const img = blank(w, h);
  const Y = '#f2b22b', YH = '#f8d239', YL = '#ed931e';
  for (let x = 0; x < w; x++) {
    setPx(img, x, 3, hexPx(YH)); setPx(img, x, 4, hexPx(Y));
    setPx(img, x, h - 4, hexPx(Y)); setPx(img, x, h - 3, hexPx(YL));
  }
  for (let y = 3; y < h - 2; y++) {
    for (const x of [0, w - 2]) { setPx(img, x, y, hexPx(YH)); setPx(img, x + 1, y, hexPx(y > h - 5 ? YL : Y)); }
  }
  // diagonal hatching along the near (bottom) border reads as "no parking" without any lettering
  for (let x = 6; x < w - 8; x += 8) for (let k = 0; k < 4; k++) setPx(img, x + k, h - 5 - k, hexPx(Y));
  return img;
}

// ------------------------------------------------------------------ grass dressing
export const GRASS = { base: '#63a650', light: '#74b453', yellow: '#9bc246', deep: '#529760', leaf: '#64b63b', dark: '#568d61', white: '#ebe4f2', softLight: '#70b455', softDark: '#559b4c' };

/** A big, soft, wobbly patch of lighter or darker grass: dithered edge, solid centre. `tone` is 'light' or 'dark'. */
export function grassPatch(w, h, seed, tone) {
  const img = blank(w, h);
  const r = rng(seed);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const wob = [r() * 6.28, r() * 6.28, r() * 6.28];
  const main = tone === 'light' ? GRASS.softLight : GRASS.softDark;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.atan2((y - cy) / (h / 2), (x - cx) / (w / 2));
      const edge = 0.8 + 0.12 * Math.sin(a * 2 + wob[0]) + 0.07 * Math.sin(a * 3 + wob[1]);
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d > edge) continue;
      const t = 1 - d / edge; // 1 centre .. 0 edge
      if (t * 1.9 > bayer(x, y) + 0.12) {
        const sprinkle = tone === 'light' && r() < 0.035;
        setPx(img, x, y, hexPx(sprinkle ? GRASS.yellow : main));
      }
    }
  }
  return img;
}

/** A worn dirt patch where feet cut the corner: ochre in a dithered blob with a few pebbles. */
export function dirtPatch(w, h, seed) {
  const img = blank(w, h);
  const r = rng(seed);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const wob = [r() * 6.28, r() * 6.28];
  const tones = ['#b08a5e', '#a07c52', '#8f6a4a'];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.atan2((y - cy) / (h / 2), (x - cx) / (w / 2));
      const edge = 0.8 + 0.14 * Math.sin(a * 3 + wob[0]) + 0.06 * Math.sin(a * 5 + wob[1]);
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d > edge) continue;
      const t = 1 - d / edge;
      if (t * 2.4 <= bayer(x, y)) continue;
      const v = r();
      setPx(img, x, y, hexPx(t > 0.5 ? (v < 0.75 ? tones[0] : tones[1]) : v < 0.5 ? tones[1] : tones[2]));
    }
  }
  for (let k = 0; k < Math.max(2, Math.round((w * h) / 90)); k++) {
    const x = 2 + Math.floor(r() * (w - 4)), y = 2 + Math.floor(r() * (h - 4));
    if (img.data[(y * w + x) * 4 + 3]) setPx(img, x, y, hexPx(r() < 0.5 ? '#c6bdd5' : '#d8d0e0'));
  }
  return img;
}

/** A small clover cluster: three round leaves on one stem, a white blossom now and then. 7x6. */
export function clover(kind = 0) {
  const img = blank(7, 6);
  const rows = kind === 0
    ? ['.gg.gg.', 'gGGggGG', 'gGgGGGg', '.ggGGg.', '..gGg..', '...G...']
    : ['..gg...', '.gGGg.g', '.gGGgGG', '..gg.GG', '...G.g.', '..G....'];
  const pal = { g: GRASS.leaf, G: GRASS.dark };
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') setPx(img, x, y, hexPx(pal[c])); }));
  // lit upper-left leaf pixels
  setPx(img, 1, 0, hexPx(GRASS.yellow));
  if (kind === 0) setPx(img, 3, 2, hexPx(GRASS.white));
  return img;
}

/** A tuft of blades standing on the lawn: 5 wide, 4..5 tall, light tips, dark roots, three shapes. */
export function gtuft(kind = 0) {
  const shapes = [
    ['.l.l.', 'lgLgl', 'gGgGg', '.GgG.'],
    ['l...l', 'gl.lg', 'gGlGg', '.GGG.'],
    ['..l..', '.lgl.', 'lgGgl', 'gGGGg'],
  ];
  const pal = { l: GRASS.yellow, L: GRASS.light, g: GRASS.leaf, G: GRASS.deep };
  const rows = shapes[kind % shapes.length];
  const img = blank(5, rows.length);
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') setPx(img, x, y, hexPx(pal[c])); }));
  return img;
}
