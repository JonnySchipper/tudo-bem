// Visual pass V3 (buildings): proper roofs for the three terraço houses, small street-level details shared by every facade
// (grilles, awnings, AC units, pots, lamps, soleira), and the rear facades ("fundos") of the south row.
// Everything is authored on the pack palette (navy outline, light from the upper left).
import { blank, rect, hline, vline, dot, box, C, K, outlineAround, hexPx, setPx, px } from './kit.mjs';
import { rng } from '../../../../scripts/lib/pixel/img.mjs';
import { shape, ell, mix, line } from './paint.mjs';
import { tank, dish, antenna, plant, acUnit, shadowOn } from './telhados.mjs';

const TANK = [C.b4, C.b3, C.b2, C.b1];
const TANK_BROWN = ['#7b5b3a', '#a9764f', '#c78c59', '#daa463'];
const PLANT = ['#32675a', '#568d61', '#64b63b', '#9bc246'];

// ------------------------------------------------------------------ small street-level details (all on the 96-wide facades)
/** Terracotta pot with a leafy plant, 8 px tall, bottom row at y + 7. */
export function pot(img, x, y, bloom = null) {
  rect(img, x + 1, y + 4, 6, 4, K.te2);
  hline(img, x + 1, y + 4, 6, K.te0);
  hline(img, x + 1, y + 7, 6, K.te4);
  dot(img, x + 1, y + 5, K.te1);
  shape(img, ell(x + 4, y + 2.5, 3.6, 3), [x + 4, y + 2.5, 3.6, 3], PLANT, {});
  if (bloom) { dot(img, x + 3, y + 1, bloom); dot(img, x + 5, y + 3, bloom); }
}

/** Window grille over a pane rect (x, y, w, h): navy bars with a light edge and a rail. */
export function grille(img, x, y, w, h, step = 3) {
  for (let xx = x + 1; xx < x + w - 1; xx += step) { vline(img, xx, y, h, C.navy2); dot(img, xx + 1, y + 1, C.slate2); }
  hline(img, x, y + Math.floor(h / 2), w, C.navy2);
  hline(img, x, y + Math.floor(h / 2) + 1, w, C.slate2);
}

/** Striped toldo over a window or door: a flat valance with a scalloped hem. */
export function toldo(img, x, y, w, a, b, h = 7) {
  for (let yy = 0; yy < h - 2; yy++) for (let xx = 0; xx < w; xx++) setPx(img, x + xx, y + yy, hexPx(((xx >> 2) & 1) === 0 ? a : b));
  hline(img, x, y, w, mix(a, '#ffffff', 0.4));
  for (let xx = 0; xx < w; xx++) { const c = ((xx >> 2) & 1) === 0 ? a : b; setPx(img, x + xx, y + h - 2, hexPx(mix(c, '#3a3a50', 0.3))); if ((xx & 3) !== 3 && (xx & 3) !== 0) setPx(img, x + xx, y + h - 1, hexPx(mix(c, '#3a3a50', 0.55))); }
  box(img, x - 1, y - 1, w + 2, h + 1, null, C.navy);
}

/** Wall lantern (lamp on a bracket), 3 x 6. */
export function lantern(img, x, y) {
  vline(img, x + 1, y, 2, C.navy2);
  rect(img, x, y + 2, 3, 3, C.y2);
  dot(img, x + 1, y + 3, C.y0);
  hline(img, x, y + 5, 3, C.navy2);
  box(img, x - 1, y + 1, 5, 5, null, C.navy);
  dot(img, x + 1, y + 3, C.y0);
}

/** Mail box on the wall. */
export function mailbox(img, x, y) {
  rect(img, x, y, 6, 5, C.r3);
  hline(img, x, y, 6, C.r1);
  hline(img, x, y + 4, 6, C.r5);
  hline(img, x + 1, y + 2, 4, C.navy);
  box(img, x - 1, y - 1, 8, 7, null, C.navy);
}

/** Split AC unit on the wall (11 x 7) with a little drip stain under it. */
export function acWall(img, x, y) {
  // outdoor condenser on two brackets: a box with a round fan grille, a lit top and a drip stain below
  const w = 12, h = 10;
  vline(img, x + 5, y + h + 2, 3, '#9a9fb8');
  rect(img, x, y, w, h, C.lav2);
  hline(img, x, y, w, C.white);
  vline(img, x, y, h, C.lav4);
  hline(img, x, y + h - 1, w, C.mist);
  vline(img, x + w - 1, y, h, C.mist2);
  shape(img, ell(x + 5.5, y + 5, 3.8, 3.8), [x + 5.5, y + 5, 3.8, 3.8], [C.navy2, C.slate, C.slate2, C.mist], { outline: false, flat: true });
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) dot(img, x + 5 + dx, y + 4 + dy, C.navy2);
  dot(img, x + 5, y + 4, C.mist2);
  dot(img, x + 9, y + 1, C.b0);
  for (const bx of [x + 1, x + w - 3]) rect(img, bx, y + h, 2, 2, C.navy2);
  box(img, x - 1, y - 1, w + 2, h + 2, null, C.navy);
}

/** Darker band + step where the wall meets the sidewalk: the last rows of a facade sprite. */
export function soleira(img, alongX0 = 0, alongX1 = img.w) {
  const H = img.h;
  for (let x = alongX0; x < alongX1; x++) {
    for (const [dy, t] of [[1, 0.58], [2, 0.3], [3, 0.12]]) {
      const y = H - dy;
      const p = px(img, x, y);
      if (!p || !p[3]) continue;
      const hex = '#' + [0, 1, 2].map((c) => p[c].toString(16).padStart(2, '0')).join('');
      setPx(img, x, y, hexPx(mix(hex, '#2a2a48', t)));
    }
  }
}

// ------------------------------------------------------------------ roofs for the terraço houses (rows 0..44 of a 96 px front)
const ROOF_H = 45;

/** Clay tile hip roof with a ridge cap and a chimney. */
export function roofTelha(img, w, tone = 0) {
  const t = tone ? ['#5b4c78', '#72608f', '#8a76a8', '#a38fc0', '#c1aedb'] : [K.te5, K.te3, K.te2, K.te1, K.te0];
  const cx = w / 2;
  const top = 8, bot = ROOF_H - 1;
  const r = rng(77);
  for (let y = top; y <= bot; y++) {
    const f = (y - top) / (bot - top);
    const hw = Math.round(cx - 20 + f * 17); // half width: 28 at the ridge -> 45 at the eave
    const row = (y - top) >> 2, pos = (y - top) & 3;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      const tx = (x + (row & 1) * 3) % 6;
      let c = pos === 0 ? t[4] : pos === 3 ? t[1] : t[3];
      if (tx === 0) c = pos === 3 ? t[0] : t[2];
      if (r() < 0.04) c = t[2];
      // hip faces: the outer 7 px of each side are in shadow / light
      const dl = x - Math.round(cx - hw), dr = Math.round(cx + hw) - 1 - x;
      if (dr < 6 + f * 3) c = mix(c, '#2a2a48', 0.28);
      else if (dl < 2) c = mix(c, '#ffffff', 0.2);
      setPx(img, x, y, hexPx(c));
    }
  }
  // eave lip
  hline(img, 1, bot - 1, w - 2, t[1]);
  hline(img, 1, bot, w - 2, t[0]);
  // ridge cap
  rect(img, Math.round(cx - 29), top - 3, 58, 4, t[3]);
  hline(img, Math.round(cx - 29), top - 3, 58, t[4]);
  hline(img, Math.round(cx - 29), top, 58, t[1]);
  for (let x = Math.round(cx - 29); x < Math.round(cx + 29); x += 5) vline(img, x, top - 2, 2, t[2]);
  // chimney
  const hx = Math.round(cx + 12);

  rect(img, hx, 0, 9, 17, '#b5754d');
  for (let y = 2; y < 17; y += 3) hline(img, hx, y, 9, '#8f4b38');
  vline(img, hx, 0, 17, '#dcaa8a');
  vline(img, hx + 8, 0, 17, '#8f4b38');
  rect(img, hx - 1, 0, 11, 2, '#d0be9c');
  hline(img, hx - 1, 1, 11, '#9c786b');
  dot(img, hx + 4, 1, C.navy);
}

/** Flat slab behind a pastel parapet: tank, antenna, dish, plants and washing peeking over the edge. */
export function roofLaje(img, w, cw, opts = {}) {
  const wall = cw.wall, trim = cw.trim;
  const yP = 25; // top of the parapet coping
  // things behind the parapet first
  tank(img, opts.tankX ?? 9, 1, opts.tank ?? TANK);
  antenna(img, opts.antX ?? 64, 5, 20);
  dish(img, opts.dishX ?? 76, 13);
  // washing line behind the wall: poles + clothes tops
  const cols = ['#f8f8f8', '#fc5c46', '#4280dd', '#f2b22b', '#ffa0a0', '#64b63b'];
  const lx0 = opts.lineX0 ?? 32, lx1 = opts.lineX1 ?? 58;
  for (const x of [lx0, lx1]) vline(img, x, yP - 11, 11, C.navy2);
  for (let x = lx0; x <= lx1; x++) dot(img, x, yP - 10 + (x - lx0 < 3 || lx1 - x < 3 ? 0 : 1), C.mist2);
  let x = lx0 + 2, i = 0;
  while (x < lx1 - 3) {
    const c = cols[(i + (opts.seed ?? 0)) % cols.length];
    const wd = 3 + (i % 2);
    rect(img, x, yP - 9, wd, 9, c);
    hline(img, x, yP - 9, wd, mix(c, '#ffffff', 0.35));
    vline(img, x + wd - 1, yP - 8, 8, mix(c, '#2a2a48', 0.3));
    x += wd + 2; i++;
  }
  // the parapet wall face
  for (let y = yP; y < ROOF_H; y++) for (let xx = 0; xx < w; xx++) {
    let c = wall[3];
    if ((xx * 7 + y * 13) % 17 === 0) c = wall[2];
    setPx(img, xx, y, hexPx(c));
  }
  rect(img, 0, yP, w, 4, trim[4]);
  hline(img, 0, yP, w, trim[5]);
  hline(img, 0, yP + 3, w, trim[1]);
  hline(img, 0, yP + 4, w, wall[1]);
  hline(img, 0, yP + 5, w, wall[2]);
  // a scupper and a drainpipe
  const dx = opts.pipeX ?? w - 9;
  rect(img, dx, yP + 4, 4, 2, C.slate2);
  vline(img, dx + 1, yP + 6, ROOF_H - yP - 6, C.slate2);
  vline(img, dx + 2, yP + 6, ROOF_H - yP - 6, C.slate);
  vline(img, dx, yP + 6, ROOF_H - yP - 6, C.mist2);
  // vent slots in the parapet
  for (const vx of opts.vents ?? [30, 44, 58]) { rect(img, vx, yP + 8, 8, 5, wall[1]); for (let k = 0; k < 3; k++) hline(img, vx + 1, yP + 9 + k * 1 + (k > 0 ? 0 : 0), 6, k % 2 ? wall[3] : wall[0]); }
  // plants on the coping
  for (const [px0, big, bl] of opts.plants ?? [[22, true, C.r1], [opts.plantX2 ?? 84, false, C.y2]]) plant(img, px0, yP - 9, big);
}

/** A casinha da laje: a little stair house on the roof with a slab roof, a door and a window, a tank beside it. */
export function roofCasinha(img, w, cw) {
  const wall = cw.wall, trim = cw.trim;
  const yP = 31;
  // tank (fibra marrom) and dish behind the little room
  tank(img, 56, 6, TANK_BROWN);
  dish(img, w - 12 - 40, 20);
  // the room
  const rx = 10, ry = 10, rw = 44;
  for (let y = ry + 5; y < yP + 1; y++) for (let x = rx; x < rx + rw; x++) setPx(img, x, y, hexPx(wall[(x * 3 + y) % 11 === 0 ? 2 : 3]));
  vline(img, rx, ry + 5, yP - ry - 4, trim[5]);
  vline(img, rx + rw - 1, ry + 5, yP - ry - 4, wall[1]);
  // slab roof with an overhang
  rect(img, rx - 2, ry, rw + 4, 5, trim[4]);
  hline(img, rx - 2, ry, rw + 4, trim[5]);
  hline(img, rx - 2, ry + 4, rw + 4, trim[1]);
  shadowOn(img, rx, ry + 5, rw, 3, 0.35);
  // door and window
  rect(img, rx + 7, ry + 12, 9, yP - ry - 12 + 1, '#2e7177');
  box(img, rx + 6, ry + 11, 11, yP - ry - 11 + 2, null, C.navy);
  rect(img, rx + 9, ry + 14, 5, 5, K.gl3);
  dot(img, rx + 14, ry + 22, C.y2);
  rect(img, rx + 26, ry + 12, 12, 9, K.gl3);
  box(img, rx + 25, ry + 11, 14, 11, null, C.navy);
  vline(img, rx + 32, ry + 12, 9, K.gl5);
  hline(img, rx + 26, ry + 12, 12, K.gl1);
  grille(img, rx + 26, ry + 12, 12, 9, 3);
  box(img, rx, ry + 5, rw, yP - ry - 4, null, C.navy);
  // the parapet in front
  for (let y = yP; y < ROOF_H; y++) for (let xx = 0; xx < w; xx++) setPx(img, xx, y, hexPx((xx * 7 + y * 13) % 17 === 0 ? wall[2] : wall[3]));
  rect(img, 0, yP, w, 3, trim[4]);
  hline(img, 0, yP, w, trim[5]);
  hline(img, 0, yP + 2, w, trim[1]);
  hline(img, 0, yP + 3, w, wall[1]);
  vline(img, 24, yP + 3, ROOF_H - yP - 3, wall[1]);
  // plants and a cat-sized planter on the coping
  plant(img, 76, yP - 8, true);
  plant(img, 87, yP - 6, false);
  // laundry rack end
}

/** Replaces rows 0..ROOF_H-1 of a 96-wide terraço front with a new top (the old terrace panel is erased first). */
export function reroof(img, kind, cw) {
  for (let y = 0; y < ROOF_H; y++) for (let x = 0; x < img.w; x++) setPx(img, x, y, [0, 0, 0, 0]);
  if (kind === 'telha') roofTelha(img, img.w);
  else if (kind === 'casinha') roofCasinha(img, img.w, cw);
  else roofLaje(img, img.w, cw, typeof kind === 'object' ? kind : {});
  return img;
}

/** Open louvered shutters on both sides of a window (x, y, w, h = the pane block), in a darker green. */
export function shutters(img, x, y, w, h, base = '#2f5f4a') {
  for (const lx of [x - 6, x + w + 1]) {
    rect(img, lx, y - 1, 5, h + 2, base);
    for (let yy = y; yy < y + h; yy += 2) hline(img, lx + 1, yy, 3, mix(base, '#ffffff', 0.22));
    vline(img, lx, y - 1, h + 2, mix(base, '#ffffff', 0.3));
    vline(img, lx + 4, y - 1, h + 2, mix(base, '#2a2a48', 0.4));
    box(img, lx - 1, y - 2, 7, h + 4, null, C.navy);
  }
}

void blank; void K; void line; void outlineAround;
