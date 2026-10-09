// Per-frame editing of canonical character sheets (see chars.mjs): anchors, region keying, stamps, body warp, outfit shape edits.
// Everything here works on { w, h, data } images (img.mjs) laid out as the canonical sheet: 8 columns x 18 rows of 16x32 frames.
import { blank, clone, hexToRgb, luma } from './img.mjs';
import { CANON_ANIMS, CANON_COLS, CANON_ROWS, FRAME_H, FRAME_W, ROW_FRAMES, rowFacing } from './chars.mjs';
import { KEY_RAMPS, keyMapForShades, mergeTables, pack } from '../../../apps/client/src/render/pixel/palette.ts';

export const OUTLINES = new Set(['#3a3a50', '#46465e', '#000000']);

const idx = (img, x, y) => (y * img.w + x) * 4;
export const hexAt = (img, x, y) => {
  const i = idx(img, x, y);
  return '#' + [0, 1, 2].map((q) => img.data[i + q].toString(16).padStart(2, '0')).join('');
};
export const alphaAt = (img, x, y) => img.data[idx(img, x, y) + 3];

/** All canonical frames as { r, c }. */
export function* frames() {
  for (let r = 0; r < CANON_ROWS; r++) for (let c = 0; c < (ROW_FRAMES[r] ?? 0); c++) yield { r, c };
}

/** Frame-local accessor: (x, y) inside frame (r, c). */
export const fx = (c, x) => c * FRAME_W + x;
export const fy = (r, y) => r * FRAME_H + y;

export function copyPixel(dst, dx, dy, src, sx, sy) {
  const di = idx(dst, dx, dy), si = idx(src, sx, sy);
  for (let q = 0; q < 4; q++) dst.data[di + q] = src.data[si + q];
}

export function clearPixel(img, x, y) {
  const i = idx(img, x, y);
  img.data[i] = img.data[i + 1] = img.data[i + 2] = img.data[i + 3] = 0;
}

export function putHex(img, x, y, hex, a = 255) {
  const [r, g, b] = hexToRgb(hex);
  const i = idx(img, x, y);
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

// ------------------------------------------------------------------ anchors
/**
 * Per-frame anchors of a canonical body sheet: `top` (first opaque row = top of the head), `bottom` (last row = feet), the head's
 * x extent (rows top..top+12) and the torso's x extent (rows bottom-7..bottom-4).
 */
export function anchors(body) {
  const out = new Map();
  for (const { r, c } of frames()) {
    let top = 99, bottom = -1;
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (alphaAt(body, fx(c, x), fy(r, y))) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    if (bottom < 0) continue;
    const span = (y0, y1) => {
      let x0 = 99, x1 = -1;
      for (let y = y0; y <= y1; y++) for (let x = 0; x < FRAME_W; x++) if (alphaAt(body, fx(c, x), fy(r, y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return x1 < 0 ? [7, 8] : [x0, x1];
    };
    const [hx0, hx1] = span(top, top + 12);
    const [tx0, tx1] = span(bottom - 7, bottom - 4);
    out.set(r * CANON_COLS + c, { r, c, top, bottom, hx0, hx1, tx0, tx1 });
  }
  return out;
}

export const anchorOf = (an, r, c) => an.get(r * CANON_COLS + c);

// ------------------------------------------------------------------ region keying (outfits)
/** Row band of an outfit pixel relative to the frame's feet row: 'top' (torso), 'bottom' (pants) or 'shoes'. */
export function outfitBand(y, bottom) {
  if (y >= bottom - 1) return 'shoes';
  if (y >= bottom - 4) return 'bottom';
  return 'top';
}

/**
 * The feet row the colour bands are cut from. The front / back sit frames (canonical rows 8 and 11) are the idle frame lowered 4 px with
 * the legs cut off at the frame's edge, so their last opaque row is the pants, not the shoes: measuring from it painted the shirt in
 * the pants colour and the pants as shoes on everyone sitting on a bench facing the camera.
 */
export const SIT_FRONT_DROP = 4;
export const bandFeetRow = (a, r) => (r === 8 || r === 11 ? a.bottom + SIT_FRONT_DROP : a.bottom);

/**
 * Converts a raw canonical outfit sheet to key colors: the pixels of each band (torso / pants / shoes) keep their own luminance order
 * and are mapped onto the top / bottom / shoes key ramps. Outline colors stay as they are.
 */
export function keyOutfit(img, an) {
  const seen = { top: new Set(), bottom: new Set(), shoes: new Set() };
  const each = (fn) => {
    for (const { r, c } of frames()) {
      const a = anchorOf(an, r, c);
      if (!a) continue;
      const feet = bandFeetRow(a, r);
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
        if (!alphaAt(img, fx(c, x), fy(r, y))) continue;
        const hex = hexAt(img, fx(c, x), fy(r, y));
        if (OUTLINES.has(hex)) continue;
        fn(outfitBand(y, feet), hex, fx(c, x), fy(r, y));
      }
    }
  };
  each((band, hex) => seen[band].add(hex));
  const maps = {};
  for (const [band, ramp] of [['top', 'top'], ['bottom', 'bottom'], ['shoes', 'shoes']]) maps[band] = keyMapForShades([...seen[band]], ramp);
  const out = clone(img);
  each((band, hex, x, y) => {
    const to = maps[band].get(pack(...hexToRgb(hex)));
    if (to === undefined) return;
    const i = idx(out, x, y);
    out.data[i] = (to >> 16) & 255;
    out.data[i + 1] = (to >> 8) & 255;
    out.data[i + 2] = to & 255;
  });
  return { img: out, seen: { top: [...seen.top], bottom: [...seen.bottom], shoes: [...seen.shoes] } };
}

/** Maps every non-outline opaque color of a layer onto one ramp (hair, hats, beards...). `except` = extra hex codes left alone. */
export function keyAuto(img, ramp, except = []) {
  const keep = new Set([...OUTLINES, ...except]);
  const colors = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    const hex = '#' + [0, 1, 2].map((q) => img.data[i + q].toString(16).padStart(2, '0')).join('');
    if (!keep.has(hex)) colors.add(hex);
  }
  const map = keyMapForShades([...colors], ramp);
  const out = clone(img);
  for (let i = 0; i < out.data.length; i += 4) {
    if (!out.data[i + 3]) continue;
    const to = map.get(pack(out.data[i], out.data[i + 1], out.data[i + 2]));
    if (to === undefined) continue;
    out.data[i] = (to >> 16) & 255;
    out.data[i + 1] = (to >> 8) & 255;
    out.data[i + 2] = to & 255;
  }
  return { img: out, colors: [...colors] };
}

export { keyMapForShades, mergeTables };

// ------------------------------------------------------------------ stamps (authored pieces anchored to the head or the body)
/** Legend shared by every authored pattern. Digits/letters are key-ramp ranks (dark to light) so the piece is recolored at runtime. */
export const LEGEND = {
  o: '#3a3a50', O: '#46465e', w: '#f8f8f8', W: '#d8d0e0',
  0: KEY_RAMPS.hat[0], 1: KEY_RAMPS.hat[1], 2: KEY_RAMPS.hat[2], 3: KEY_RAMPS.hat[3],
  a: KEY_RAMPS.accent[0], b: KEY_RAMPS.accent[1], c: KEY_RAMPS.accent[2],
  p: KEY_RAMPS.skin[0], q: KEY_RAMPS.skin[1], r: KEY_RAMPS.skin[2], s: KEY_RAMPS.skin[3],
  h: KEY_RAMPS.hair[0], i: KEY_RAMPS.hair[1], j: KEY_RAMPS.hair[2], k: KEY_RAMPS.hair[3],
  t: KEY_RAMPS.top[0], u: KEY_RAMPS.top[1], v: KEY_RAMPS.top[2], x: KEY_RAMPS.top[3],
  d: KEY_RAMPS.bottom[0], e: KEY_RAMPS.bottom[1], f: KEY_RAMPS.bottom[2], z: KEY_RAMPS.bottom[3],
  m: KEY_RAMPS.shoes[0], n: KEY_RAMPS.shoes[1], l: KEY_RAMPS.shoes[2],
  y: '#f2b22b', Y: '#fff59a', g: '#3d8a4e', G: '#5cb85c', R: '#d93232', B: '#8a5a3c', P: '#e0707a', L: '#9d9dc3', K: '#1f1f2e',
  /** mural coral — flower crowns and market totes, a fixed hue so it survives a hat recolor */
  C: '#e07a5f',
  /** the authored faces (wave 3): eye white, the four iris colours (brown, green, slate, amber) and the mouth, fixed on every skin tone */
  N: '#f6f1ea', D: '#4f3328', H: '#3f7a4e', S: '#46506e', A: '#8a5a1e', M: '#8a3f3a',
};

/**
 * A pattern is { rows: string[], y0: number, x0?: number }: row 0 sits at (reference head top + y0) for head-anchored pieces or at
 * (reference feet row + y0) for body-anchored ones; column 0 sits at frame x = x0 (default 0). `alpha` maps a char to an alpha (blush).
 */
export function mirrorPattern(p) {
  const w = Math.max(...p.rows.map((r) => r.length));
  return { ...p, rows: p.rows.map((r) => r.padEnd(w, '.').split('').reverse().join('')), x0: FRAME_W - ((p.x0 ?? 0) + w) };
}

/**
 * Stamps `pat` (a set per facing: { S, E, N, W? }, W defaults to the mirrored E) onto every frame of `out`, following the frame's
 * anchors. `kind` = 'head' or 'body'. `rows` optionally limits which canonical rows are stamped (a Set of row numbers).
 */
export function stampSet(out, set, an, kind, { rows, only, alphaOf = {} } = {}) {
  const pats = { S: set.S, E: set.E, N: set.N, W: set.W ?? (set.E ? mirrorPattern(set.E) : undefined) };
  const refs = {};
  for (const f of ['S', 'W', 'E', 'N']) {
    const r = { S: 0, W: 1, E: 2, N: 3 }[f];
    refs[f] = anchorOf(an, r, 0);
  }
  for (const { r, c } of frames()) {
    if (rows && !rows.has(r)) continue;
    if (only && !only(r, c)) continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const f = rowFacing(r);
    const p = pats[f];
    if (!p) continue;
    const ref = refs[f];
    const dy = kind === 'head' ? a.top - ref.top : a.bottom - ref.bottom;
    const dx = kind === 'head' ? Math.round((a.hx0 + a.hx1 - ref.hx0 - ref.hx1) / 2) : Math.round((a.tx0 + a.tx1 - ref.tx0 - ref.tx1) / 2);
    const baseY = (kind === 'head' ? ref.top : ref.bottom) + p.y0 + dy;
    p.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const hex = LEGEND[ch];
        if (!hex) throw new Error(`pattern: no legend for '${ch}'`);
        const x = (p.x0 ?? 0) + i + dx, y = baseY + j;
        if (x < 0 || x >= FRAME_W || y < 0 || y >= FRAME_H) continue;
        putHex(out, fx(c, x), fy(r, y), hex, alphaOf[ch] ?? 255);
      }
    });
  }
  return out;
}

export const emptySheet = () => blank(CANON_COLS * FRAME_W, CANON_ROWS * FRAME_H);

// ------------------------------------------------------------------ body warp (esguio / forte)
const WARP_ROWS = [-7, -4]; // torso rows relative to the feet row
const NO_WARP_ROWS = new Set([8, 9, 10, 11]); // sitting frames have another geometry

/** Per-frame row plan derived from the body sheet: { r, c, y, cut, mode }. */
export function warpPlan(body, an, mode) {
  const plan = [];
  for (const { r, c } of frames()) {
    if (NO_WARP_ROWS.has(r)) continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    for (let y = a.bottom + WARP_ROWS[0]; y <= a.bottom + WARP_ROWS[1]; y++) {
      let x0 = 99, x1 = -1;
      for (let x = 0; x < FRAME_W; x++) if (alphaAt(body, fx(c, x), fy(r, y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      if (x1 < 0) continue;
      const w = x1 - x0 + 1;
      if (mode === 'esguio' && w < 8) continue;
      if (mode === 'forte' && (w > 14 || w < 6)) continue;
      plan.push({ r, c, y, cut: Math.floor((x0 + x1 + 1) / 2), mode });
    }
  }
  return plan;
}

/** Applies a warp plan to any body-attached layer (body, outfit, gestures): esguio drops the two centre columns, forte doubles them. */
export function warpLayer(img, plan) {
  const out = clone(img);
  for (const { r, c, y, cut, mode } of plan) {
    const row = [];
    for (let x = 0; x < FRAME_W; x++) row.push(Array.from(img.data.subarray(idx(img, fx(c, x), fy(r, y)), idx(img, fx(c, x), fy(r, y)) + 4)));
    const nrow = Array.from({ length: FRAME_W }, () => [0, 0, 0, 0]);
    if (mode === 'esguio') {
      for (let x = 0; x < FRAME_W; x++) {
        if (x === cut - 1 || x === cut) continue;
        const nx = x < cut - 1 ? x + 1 : x - 1;
        nrow[nx] = row[x];
      }
    } else {
      for (let x = 0; x < FRAME_W; x++) {
        const nx = x < cut ? x - 1 : x + 1;
        if (nx >= 0 && nx < FRAME_W) nrow[nx] = row[x];
      }
      if (cut - 1 >= 0) nrow[cut - 1] = row[cut - 1];
      if (cut < FRAME_W) nrow[cut] = row[cut];
    }
    for (let x = 0; x < FRAME_W; x++) for (let q = 0; q < 4; q++) out.data[idx(out, fx(c, x), fy(r, y)) + q] = nrow[x][q];
  }
  return out;
}

// ------------------------------------------------------------------ outfit shape edits (post keying)
const spanOfRow = (img, r, c, y) => {
  let x0 = 99, x1 = -1;
  for (let x = 0; x < FRAME_W; x++) if (alphaAt(img, fx(c, x), fy(r, y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  return x1 < 0 ? null : [x0, x1];
};

/** Tank top: drop the sleeve pixels that stick out beyond the torso (the belt row's extent), so the bare arms of the body show. */
export function regata(img, an) {
  const out = clone(img);
  for (const { r, c } of frames()) {
    if (r >= 8 && r <= 11) continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const belt = spanOfRow(img, r, c, a.bottom - 4);
    if (!belt) continue;
    for (let y = a.bottom - 9; y <= a.bottom - 5; y++) for (let x = 0; x < FRAME_W; x++) if ((x < belt[0] || x > belt[1]) && alphaAt(out, fx(c, x), fy(r, y))) clearPixel(out, fx(c, x), fy(r, y));
  }
  return out;
}

const facingIsFront = (r) => r < 12 && (r % 4 === 0 || r % 4 === 3) || r >= 12;

/** Shorts: the pants stop one row early (bare knees show) and, seen from the front or back, the two legs are split. */
export function bermuda(img, an) {
  const out = clone(img);
  for (const { r, c } of frames()) {
    if (r >= 8 && r <= 11) continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    for (let x = 0; x < FRAME_W; x++) clearPixel(out, fx(c, x), fy(r, a.bottom - 2));
    if (facingIsFront(r)) {
      const span = spanOfRow(out, r, c, a.bottom - 3);
      if (span) {
        const mid = Math.floor((span[0] + span[1] + 1) / 2);
        for (const x of [mid - 1, mid]) if (alphaAt(out, fx(c, x), fy(r, a.bottom - 3))) clearPixel(out, fx(c, x), fy(r, a.bottom - 3));
      }
    }
  }
  return out;
}

/** Skirt: the pants become one solid A-line shape that flares one pixel per side on the first row and two on the second. */
export function saia(img, an) {
  const out = clone(img);
  for (const { r, c } of frames()) {
    if (r >= 8 && r <= 11) continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    [[a.bottom - 3, 1], [a.bottom - 2, 2]].forEach(([y, grow]) => {
      const span = spanOfRow(out, r, c, y);
      if (!span) return;
      const [x0, x1] = span;
      const outline = hexAt(out, fx(c, x0), fy(r, y));
      const fillL = hexAt(out, fx(c, Math.min(x1, x0 + 1)), fy(r, y));
      const fillR = hexAt(out, fx(c, Math.max(x0, x1 - 1)), fy(r, y));
      for (let k = 1; k <= grow; k++) {
        if (x0 - k >= 0) putHex(out, fx(c, x0 - k), fy(r, y), k === grow ? outline : fillL);
        if (x1 + k < FRAME_W) putHex(out, fx(c, x1 + k), fy(r, y), k === grow ? outline : fillR);
      }
      // the old outline pixels become skirt fill
      putHex(out, fx(c, x0), fy(r, y), fillL);
      putHex(out, fx(c, x1), fy(r, y), fillR);
    });
    // fill the gap between the legs on the second row so the hem is one piece
    const y2 = a.bottom - 2;
    const s2 = spanOfRow(out, r, c, y2);
    if (s2) for (let x = s2[0]; x <= s2[1]; x++) if (!alphaAt(out, fx(c, x), fy(r, y2))) copyPixel(out, fx(c, x), fy(r, y2), out, fx(c, s2[0] + 1), fy(r, y2));
  }
  return out;
}

// ------------------------------------------------------------------ hair edits
/** Grows the hair fill by one pixel over empty or outline pixels (never over skin) and redraws the outline around it (afro / puff). */
export function puffHair(hair, body, an, { grow = 1 } = {}) {
  let cur = clone(hair);
  const outlineHex = '#3a3a50';
  for (let g = 0; g < grow; g++) {
    const next = clone(cur);
    for (const { r, c } of frames()) {
      if (r >= 8 && r <= 11) continue;
      const a = anchorOf(an, r, c);
      if (!a) continue;
      const isFill = (x, y) => x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H && alphaAt(cur, fx(c, x), fy(r, y)) && !OUTLINES.has(hexAt(cur, fx(c, x), fy(r, y)));
      const bodyOpaqueFill = (x, y) => alphaAt(body, fx(c, x), fy(r, y)) && !OUTLINES.has(hexAt(body, fx(c, x), fy(r, y)));
      // only grow above the eyes: rows from the head top to the ear line
      for (let y = a.top - 2; y <= a.top + 8; y++) for (let x = 0; x < FRAME_W; x++) {
        if (isFill(x, y) || bodyOpaqueFill(x, y)) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isFill(x + dx, y + dy));
        if (!nb.length) continue;
        const [dx, dy] = nb[0];
        copyPixel(next, fx(c, x), fy(r, y), cur, fx(c, x + dx), fy(r, y + dy));
      }
    }
    cur = next;
  }
  // re-outline: any transparent pixel next to fill (and inside the head rows) becomes outline
  for (const { r, c } of frames()) {
    if (r >= 8 && r <= 11) continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const isFill = (x, y) => x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H && alphaAt(cur, fx(c, x), fy(r, y)) && !OUTLINES.has(hexAt(cur, fx(c, x), fy(r, y)));
    const outlineNow = clone(cur);
    for (let y = a.top - 3; y <= a.top + 9; y++) for (let x = 0; x < FRAME_W; x++) {
      if (alphaAt(cur, fx(c, x), fy(r, y))) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isFill(x + dx, y + dy))) putHex(outlineNow, fx(c, x), fy(r, y), outlineHex);
    }
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) copyPixel(cur, fx(c, x), fy(r, y), outlineNow, fx(c, x), fy(r, y));
  }
  return cur;
}

export { CANON_ANIMS, luma };

/** Maps exact source colors to explicit ramp ranks: `map` = { '#rrggbb': rank }. */
export function keyRanks(img, ramp, map) {
  const out = clone(img);
  const keys = KEY_RAMPS[ramp];
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    if (!alphaAt(out, x, y)) continue;
    const rank = map[hexAt(out, x, y)];
    if (rank !== undefined) putHex(out, x, y, keys[rank], alphaAt(out, x, y));
  }
  return out;
}

// ------------------------------------------------------------------ faces (wave 2)
const EYE_WHITE = '#f6f1ea';
/**
 * Eye whites for a pack eyes layer: every eye is a 1x2 px mark (a dark lash over the iris colour). The white goes next to the iris on the
 * lower row, on the inner side from the front (S) and behind the iris in profile, so the eye reads on every skin tone (dark on dark skin used
 * to vanish). Fixed colour (not on a ramp), added to the same layer.
 */
export function eyeWhites(img) {
  const out = clone(img);
  for (const { r, c } of frames()) {
    const f = rowFacing(r);
    if (f === 'N') continue;
    for (let y = 0; y < FRAME_H - 1; y++) for (let x = 0; x < FRAME_W; x++) {
      if (!alphaAt(img, fx(c, x), fy(r, y)) || hexAt(img, fx(c, x), fy(r, y)) !== '#3a3a50' || !alphaAt(img, fx(c, x), fy(r, y + 1))) continue;
      const dx = f === 'S' ? (x < 8 ? 1 : -1) : f === 'E' ? -1 : 1;
      if (x + dx < 0 || x + dx >= FRAME_W) continue;
      putHex(out, fx(c, x + dx), fy(r, y + 1), EYE_WHITE);
    }
  }
  return out;
}

/**
 * Pulls the fringe up and aside on the front (S) frames: hair pixels in the face columns `x0..x1` at or below `rel` rows under the head top
 * are removed, so the forehead and eyes show (the pack's bowl cuts and the puff covered the eyes, worst on dark hair and at the creator's 6x).
 */
export function openFringe(hair, an, { x0 = 4, x1 = 11, rel = 8, notch = 0 } = {}) {
  const out = clone(hair);
  for (const { r, c } of frames()) {
    if (rowFacing(r) !== 'S') continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    for (let y = a.top + rel - notch; y < FRAME_H; y++) {
      // a widow's peak: the opening is `notch` columns narrower per side for each row above the full-width rows
      const narrow = Math.max(0, a.top + rel - y);
      for (let x = x0 + narrow; x <= x1 - narrow; x++) if (alphaAt(out, fx(c, x), fy(r, y))) clearPixel(out, fx(c, x), fy(r, y));
    }
  }
  return out;
}
