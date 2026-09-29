// Poste com fios: the utility pole is the LimeZu crossarm pole (cropped), the wires are drawn here in the pack's wire greys as
// OVERHEAD sprites that span from pole to pole (a tileable 16 px segment plus a few sagging spans with a tangle in the middle).
import { blank, paste, crop, setPx, hexPx, C, K, dot, stripSoftAlpha, rng, rect } from './kit.mjs';

/** The pole: LimeZu crossarm pole (16x64), foot at the bottom. Wire attach point = the crossarm (12 px below the top). */
export async function posteFios(ctx) {
  const sheet = await ctx.sheet('props');
  const pole = stripSoftAlpha(crop(sheet, 96, 384, 16, 64));
  return [{ img: pole, anchor: [8, 63], meta: { attach: [0, -51] } }];
}

const WIRE = ['#565972', '#6c6e85', '#565972', '#46465e'];

/** Draws one wire from (0, y0) to (L, y1) with a parabolic sag (px at the middle), 1 px thick, alternating tones. */
function wire(img, L, y0, y1, sag, tone = 0, x0 = 0) {
  let prev = null;
  for (let x = x0; x <= L; x++) {
    const t = x / L;
    const y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
    const c = WIRE[(Math.floor(x / 3) + tone) % WIRE.length];
    dot(img, x, y, c);
    if (prev !== null && Math.abs(y - prev) > 1) for (let yy = Math.min(y, prev) + 1; yy < Math.max(y, prev); yy++) dot(img, x, yy, c);
    prev = y;
  }
}

/** Span of `tiles` tiles between two poles: 3 parallel wires + tangled extras + a knot of cables near each pole. */
function span(tiles, seed, opts = {}) {
  const L = tiles * 16;
  const H = 26 + Math.round(tiles * 1.5);
  const img = blank(L + 1, H);
  const sag = 2 + tiles * 0.9;
  wire(img, L, 1, 1, sag, 0);
  wire(img, L, 4, 4, sag * 0.92, 1);
  wire(img, L, 7, 8, sag * 0.85, 2);
  // the tangle: two extra wires that cross the main ones, plus a droop that hangs from the middle
  const r = rng(seed);
  const cx = Math.round(L * (0.42 + r() * 0.16));
  wire(img, L, 2, 6, sag * 1.15, 3);
  wire(img, L, 6, 3, sag * 1.05, 1);
  // a knot: a few short loops of cable around cx
  for (let i = 0; i < 5; i++) {
    const kx = cx - 4 + i * 2, ky = Math.round(1 + sag * 4 * (kx / L) * (1 - kx / L)) + 2 + (i % 2);
    dot(img, kx, ky + 1, WIRE[1]); dot(img, kx + 1, ky + 2, WIRE[0]);
  }
  // a cable that hangs from the middle wire and loops back
  const hx = Math.round(L * (0.7 + r() * 0.1));
  const hy = Math.round(4 + sag * 0.92 * 4 * (hx / L) * (1 - hx / L));
  for (let k = 0; k < 6; k++) dot(img, hx + Math.round(Math.sin(k * 0.9)), hy + 1 + k, k % 2 ? WIRE[0] : WIRE[1]);
  dot(img, hx, hy + 7, WIRE[3]);
  if (opts.shoes) {
    // tênis pendurado: a pair of sneakers thrown over the wire (white sole, red body)
    const sx = Math.round(L * 0.5), sy = Math.round(4 + sag * 0.92);
    for (let k = 0; k < 4; k++) { dot(img, sx, sy + 1 + k, WIRE[1]); dot(img, sx + 3, sy + 1 + k, WIRE[0]); }
    rect(img, sx - 2, sy + 5, 4, 3, C.r3); rect(img, sx + 2, sy + 5, 4, 3, C.r4);
    rect(img, sx - 2, sy + 7, 4, 1, C.lav4); rect(img, sx + 2, sy + 7, 4, 1, C.lav3);
    dot(img, sx - 2, sy + 5, C.r1); dot(img, sx + 2, sy + 5, C.r1);
  }
  return img;
}

/** 16 px tileable segment: it starts and ends at the same heights so repeating it gives a rolling wire. */
function segment() {
  const img = blank(16, 12);
  const wave = (x) => Math.round(1.4 * Math.sin((x / 16) * Math.PI * 2));
  for (const [y0, tone] of [[2, 0], [5, 1], [8, 2]]) for (let x = 0; x < 16; x++) dot(img, x, y0 + wave(x + y0), WIRE[(Math.floor(x / 3) + tone) % 4]);
  for (let x = 0; x < 16; x++) dot(img, x, 4 + Math.round(2.4 * Math.sin(((x + 4) / 16) * Math.PI * 2)), WIRE[(x >> 1) % 2 ? 3 : 1]);
  return img;
}

export async function fios() {
  return [
    { key: 'props/fios_seg', img: segment(), anchor: [0, 3], meta: { footprint: [1, 1], overhead: true } },
    { key: 'props/fios_4', img: span(4, 11), anchor: [0, 1], meta: { footprint: [4, 1], overhead: true } },
    { key: 'props/fios_6', img: span(6, 23, { shoes: true }), anchor: [0, 1], meta: { footprint: [6, 1], overhead: true } },
    { key: 'props/fios_8', img: span(8, 37), anchor: [0, 1], meta: { footprint: [8, 1], overhead: true } },
  ];
}
