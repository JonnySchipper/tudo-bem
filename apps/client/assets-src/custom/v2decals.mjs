// Ground dressing of the V2 composition pass: worn dirt paths in the grass, the playground's sand pit, a hopscotch painted on the
// sidewalk, market leaves and cardboard on the asphalt, a dog's water bowl. Hard pixels only (edges are dithered with transparent holes),
// light from the upper left. Registered as `decal: true` sprites; `sceneryV2.ts` places them.
import { blank, put, h2 } from './paint.mjs';
import { C, K, rect, hline, vline, dot } from './kit.mjs';

const DIRT = ['#8d7648', '#a38a58', '#b39a66', '#c7b07c'];

/** An irregular worn patch of dirt: an ellipse with a noisy rim whose outermost pixels are dithered away. */
function dirtPatch(w, h, seed, tilt = 0) {
  const img = blank(w, h);
  const cx = w / 2, cy = h / 2, rx = w / 2 - 0.6, ry = h / 2 - 0.6;
  const inside = (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy + tilt * (x + 0.5 - cx) * 0.25) / ry;
    return dx * dx + dy * dy + (h2(x, y, seed) - 0.5) * 0.5 < 1;
  };
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = inside(x, y) ? 1 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    const rim = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
    const r = h2(x, y, seed + 9);
    if (rim) {
      if (r < 0.55) continue; // dither the rim away
      put(img, x, y, DIRT[0]);
      continue;
    }
    const rim2 = !at(x - 2, y) || !at(x + 2, y) || !at(x, y - 2) || !at(x, y + 2);
    let c = r < 0.18 ? DIRT[3] : r < 0.55 ? DIRT[2] : r < 0.9 ? DIRT[1] : DIRT[0];
    if (rim2 && r < 0.5) c = DIRT[1];
    put(img, x, y, c);
  }
  // a few pebbles
  for (let i = 0; i < Math.round((w * h) / 60); i++) {
    const x = 1 + Math.floor(h2(i, 3, seed) * (w - 2)), y = 1 + Math.floor(h2(i, 5, seed) * (h - 2));
    if (m[y * w + x] && at(x - 1, y) && at(x + 1, y)) { put(img, x, y, K.wg0); if (h2(i, 7, seed) < 0.5) put(img, x + 1, y, K.wg3); }
  }
  return img;
}

/** The playground's sand pit: w x h tiles, a timber frame with rounded corners, pale sand with speckles, a bucket and a spade. */
function areia(wt, ht) {
  const W = wt * 16, H = ht * 16;
  const img = blank(W, H);
  const R = 6;
  const inRound = (x, y, ins) => {
    const x0 = ins, y0 = ins, x1 = W - 1 - ins, y1 = H - 1 - ins;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = x < x0 + R ? x0 + R : x > x1 - R ? x1 - R : x, cy = y < y0 + R ? y0 + R : y > y1 - R ? y1 - R : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= R * R + 1;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inRound(x, y, 1)) continue;
    if (!inRound(x, y, 4)) {
      // timber frame: planks with joints, lit on the north and west edges
      const lit = y < H / 2 && x < W / 2;
      let c = C.w2;
      if ((x + y) % 11 === 0) c = C.w4;
      if (!inRound(x - 1, y, 1) || !inRound(x, y - 1, 1)) c = C.w0;
      if (!inRound(x + 1, y, 4) || !inRound(x, y + 1, 4)) c = C.w4;
      if (y > H - 5 || x > W - 5) c = (x + y) % 11 === 0 ? C.w5 : C.w3;
      void lit;
      put(img, x, y, c);
    } else {
      const r = h2(x, y, 41);
      put(img, x, y, r < 0.08 ? '#cdb078' : r < 0.2 ? '#dcc088' : r < 0.9 ? '#e6cf9c' : '#f3e3b8');
      // a soft shadow along the north and west inner edge
      if (!inRound(x - 3, y, 4) || !inRound(x, y - 3, 4)) if (r < 0.6) put(img, x, y, '#d6bc84');
    }
  }
  // outline
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inRound(x, y, 1) && (inRound(x - 1, y, 1) || inRound(x + 1, y, 1) || inRound(x, y - 1, 1) || inRound(x, y + 1, 1))) put(img, x, y, C.navy);
  // a bucket and a spade in the corner
  const bx = W - 22, by = H - 17;
  rect(img, bx, by, 6, 5, C.b2); hline(img, bx, by, 6, C.b0); rect(img, bx + 1, by + 5, 4, 1, C.b4);
  rect(img, bx + 8, by + 1, 1, 5, C.r3); rect(img, bx + 7, by + 5, 3, 2, C.r2);
  return img;
}

/** Hopscotch (amarelinha) in chalk on the paving: 1 2 [3 4] 5 [6 7] 8 and a round CEU, 64x16. */
function amarelinha() {
  const img = blank(64, 16);
  const CH = '#f4f0e6', CH2 = '#e7a2b5';
  const box = (x, y, w, h, c) => { hline(img, x, y, w, c); hline(img, x, y + h - 1, w, c); vline(img, x, y, h, c); vline(img, x + w - 1, y, h, c); };
  let x = 1;
  for (const cell of ['s', 's', 'd', 's', 'd', 's']) {
    if (cell === 's') { box(x, 4, 8, 8, CH); dot(img, x + 3, 7, CH2); dot(img, x + 4, 7, CH2); dot(img, x + 4, 8, CH2); }
    else { box(x, 0, 8, 8, CH); box(x, 8, 8, 8, CH); dot(img, x + 3, 3, CH2); dot(img, x + 3, 11, CH2); dot(img, x + 4, 11, CH2); }
    x += 8;
  }
  // the sky: a circle
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    dot(img, Math.round(x + 7 + Math.cos(t) * 7), Math.round(7.5 + Math.sin(t) * 7), CH);
  }
  dot(img, x + 6, 7, CH2); dot(img, x + 7, 7, CH2); dot(img, x + 8, 7, CH2); dot(img, x + 7, 6, CH2);
  return img;
}

/** Leaves and bits of cardboard left by the market (16x16 each, a few pixels). */
function lixoFeira(kind) {
  const img = blank(16, 16);
  if (kind === 0) {
    for (const [x, y] of [[3, 4], [4, 4], [4, 5], [10, 9], [11, 9], [11, 10], [7, 12], [8, 12]]) put(img, x, y, (x + y) % 2 ? C.g2 : C.g3);
    put(img, 3, 4, C.g1); put(img, 10, 9, C.g1);
  } else if (kind === 1) {
    rect(img, 4, 6, 7, 4, C.w2); hline(img, 4, 6, 7, C.w1); hline(img, 4, 9, 7, C.w4); vline(img, 7, 6, 4, C.w3);
  } else {
    for (const [x, y] of [[5, 5], [6, 5], [9, 10], [10, 10], [3, 11]]) put(img, x, y, C.r3);
    put(img, 5, 5, C.r1); put(img, 9, 10, C.y3); put(img, 12, 6, C.y2);
  }
  return img;
}

/** A dog's water bowl (8x6). */
function tigela() {
  const img = blank(8, 6);
  rect(img, 0, 1, 8, 4, C.navy); rect(img, 1, 2, 6, 2, C.b1); hline(img, 1, 2, 6, C.b0); hline(img, 1, 4, 6, C.b3);
  hline(img, 1, 0, 6, C.navy); dot(img, 1, 1, C.lav3);
  return img;
}

export async function patches() {
  const out = [];
  const defs = [['a', 22, 14, 1], ['b', 30, 16, 2], ['c', 16, 22, 3], ['d', 26, 18, 4], ['e', 14, 12, 5]];
  for (const [k, w, h, seed] of defs) out.push({ key: `decals/trilha_${k}`, img: dirtPatch(w, h, seed, k === 'b' ? 1 : k === 'd' ? -1 : 0), anchor: [w >> 1, h >> 1], meta: { decal: true, footprint: [Math.ceil(w / 16), Math.ceil(h / 16)], shadow: null } });
  return out;
}
export async function sandPit(ctx, args) {
  const wt = args?.w ?? 7, ht = args?.h ?? 5;
  return [{ img: areia(wt, ht), anchor: [0, 0], meta: { decal: true, footprint: [wt, ht], shadow: null } }];
}
export async function hopscotch() {
  return [{ img: amarelinha(), anchor: [0, 0], meta: { decal: true, footprint: [4, 1], shadow: null } }];
}
export async function lixo() {
  return [0, 1, 2].map((k) => ({ key: `decals/feira_lixo_${k}`, img: lixoFeira(k), anchor: [8, 8], meta: { decal: true, footprint: [1, 1], shadow: null } }));
}
export async function bowl() {
  return [{ img: tigela(), anchor: [4, 3], meta: { decal: true, footprint: [1, 1], shadow: null } }];
}
