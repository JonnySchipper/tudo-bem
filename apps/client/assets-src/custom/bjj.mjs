// BJJ "Treino no tatame" art: two-person grappling sprites (bjj/pair_*, trans_*, finish_tap, win_raise, fistbump, face_off), the referee
// signals (bjj/ref_*) and the scoreboard prop (props/placar). See bjj-rig.mjs (puppet renderer), bjj-poses.mjs, bjj-anim.mjs, bjj-ref.mjs.
import { blank } from '../../../../scripts/lib/pixel/img.mjs';
import { C, rect, box } from './draw.mjs';
import { renderPair, toImage, W as CW } from './bjj-rig.mjs';
import { POSITION_IDS } from './bjj-poses.mjs';
import { struggle, transition, TRANSITIONS, finishTap, winRaise, fistbump, faceOff } from './bjj-anim.mjs';
import { refFrame, REF_SIGNALS } from './bjj-ref.mjs';
import { standSet, clipFrames, CLIPS } from './bjj-moves.mjs';
import { CLIP_FRAMES, clipKey, standKey } from '../../src/render/pixel/bjjClips.ts';

/** Published frame size of every pair sprite: a window cut out of the 64 x 48 working canvas, centred on x = 32, bottom aligned. */
export const PAIR_W = 56;
export const PAIR_H = 42;

function windowed(img) {
  const x0 = (CW - PAIR_W) / 2, y0 = 48 - PAIR_H;
  const out = blank(PAIR_W, PAIR_H);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (!img.data[i + 3]) continue;
    const ox = x - x0, oy = y - y0;
    if (ox < 0 || oy < 0 || ox >= PAIR_W || oy >= PAIR_H) throw new Error(`bjj: pixel (${x},${y}) outside the ${PAIR_W}x${PAIR_H} window`);
    out.data.set(img.data.subarray(i, i + 4), (oy * PAIR_W + ox) * 4);
  }
  return out;
}

const pairImg = (pose) => windowed(toImage(renderPair(pose)));
const PAIR_ANCHOR = [PAIR_W / 2, PAIR_H];

/**
 * A move clip frame: drawn on a canvas 8 px bigger on every side (a body in the air may leave the idle window), then trimmed to what was
 * drawn. The anchor stays the pair's (the canvas point (40, 56), the idle frames' bottom centre), so frames of any size line up.
 */
export const CLIP_CANVAS = { w: CW + 16, h: 56, ox: 8, oy: 8 };
function clipImg(pose) {
  const img = toImage(renderPair(pose, CLIP_CANVAS));
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!img.data[(y * img.w + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) throw new Error('bjj: empty clip frame');
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = blank(w, h);
  for (let y = 0; y < h; y++) out.data.set(img.data.subarray(((y + y0) * img.w + x0) * 4, ((y + y0) * img.w + x0 + w) * 4), y * w * 4);
  return { img: out, anchor: [CW / 2 + CLIP_CANVAS.ox - x0, 48 + CLIP_CANVAS.oy - y0] };
}

/** Every frame as [{ key, img, anchor }]. */
export function bjjFrames() {
  const out = [];
  const add = (key, img, anchor = PAIR_ANCHOR) => out.push({ key: `bjj/${key}`, img, anchor });
  for (const id of POSITION_IDS) for (let k = 0; k < 4; k++) add(`pair_${id}_${k}`, pairImg(struggle(id, k)));
  for (const [a, b] of TRANSITIONS) for (let k = 0; k < 4; k++) add(`trans_${a}__${b}_${k}`, pairImg(transition(a, b, k)));
  for (let k = 0; k < 4; k++) add(`finish_tap_${k}`, pairImg(finishTap(k)));
  for (let k = 0; k < 3; k++) add(`win_raise_${k}`, pairImg(winRaise(k)));
  for (let k = 0; k < 4; k++) add(`fistbump_${k}`, pairImg(fistbump(k)));
  for (let k = 0; k < 2; k++) add(`face_off_${k}`, pairImg(faceOff(k)));
  for (const s of REF_SIGNALS) add(`ref_${s}`, toImage(refFrame(s), 0), [8, 32]);
  return out;
}

/**
 * The frames that only play during a match: the standing loops with the grips held, and the move clips. They go in their own atlas
 * (`bjj`), which the bout stage loads when a match starts, so the world's main atlas does not carry them.
 */
export function bjjMatchFrames() {
  const out = [];
  for (const s of standSet()) out.push({ key: standKey(s.you, s.partner, s.f), img: pairImg(s.pair), anchor: PAIR_ANCHOR });
  for (const def of CLIPS) {
    for (const hit of [true, false]) {
      clipFrames(def, hit).forEach((p, i) => out.push({ key: clipKey(def.move, def.from, hit, i), ...clipImg(p) }));
    }
  }
  if (out.length !== 16 * 4 + CLIPS.length * 2 * CLIP_FRAMES) throw new Error('bjj: match frame count');
  return out;
}

/** Derive generator: all bjj/* sprites (the import-map entry's key must be the first one, bjj/pair_de_pe_0). */
export async function bjjSet() {
  return [...bjjFrames().map(({ key, img, anchor }) => ({ key, img, anchor })), ...bjjMatchFrames().map(({ key, img, anchor }) => ({ key, img, anchor, atlas: 'bjj' }))];
}

// ------------------------------------------------------------------ props/placar

/**
 * Blank digit areas (x, y, w, h) inside props/placar, for the DOM digits laid over the sprite. A narrow board (30 x 34) that stands
 * between the mat's east edge and the wall: the clock across the top, then one row per fighter (gi chip, points, advantages).
 */
export const PLACAR_CELLS = {
  clock: [5, 3, 20, 7],
  player: { pontos: [11, 13, 7, 7], vantagens: [21, 13, 7, 7] },
  partner: { pontos: [11, 22, 7, 7], vantagens: [21, 22, 7, 7] },
};

export function placar() {
  const w = 30, h = 34;
  const img = blank(w, h);
  const wood = '#6b4b30', woodD = '#573c2c', woodL = '#8a6a44';
  // legs and foot
  for (const x of [4, 22]) { rect(img, x, 30, 4, 3, wood); rect(img, x, 30, 1, 3, woodL); rect(img, x + 3, 30, 1, 3, woodD); }
  rect(img, 2, 33, 8, 1, woodD); rect(img, 20, 33, 8, 1, woodD);
  // board
  box(img, 0, 0, w, 31, '#2d4468', C.navy);
  rect(img, 1, 1, w - 2, 1, '#4a6fa0'); rect(img, 1, 1, 1, 29, '#4a6fa0');
  rect(img, 1, 29, w - 2, 1, '#1f3150');
  // clock strip: orange wings either side of the clock
  rect(img, 2, 2, 2, 9, '#c45c26'); rect(img, 26, 2, 2, 9, '#c45c26');
  rect(img, 2, 2, 2, 1, '#e0884a'); rect(img, 26, 2, 2, 1, '#e0884a');
  const cell = ([x, y, cw, ch]) => { rect(img, x - 1, y - 1, cw + 2, ch + 2, C.navy); rect(img, x, y, cw, ch, '#12161f'); rect(img, x, y, cw, 1, '#1c2230'); };
  cell(PLACAR_CELLS.clock);
  for (const row of ['player', 'partner']) for (const c of Object.values(PLACAR_CELLS[row])) cell(c);
  // gi chips: white (player) and coloured (partner), with a belt
  const chip = (y, gi, gi2, belt) => {
    box(img, 2, y, 7, 7, gi, C.navy); rect(img, 3, y + 1, 5, 1, gi2); rect(img, 2, y + 4, 7, 1, belt);
  };
  chip(13, '#e8e2d4', '#fbf7ee', '#3a3a50');
  chip(22, '#4a78b8', '#6f9ad8', '#1c1c28');
  // column ticks above the digit cells (pontos / vantagens)
  for (const x of [12, 22]) rect(img, x, 11, 5, 1, '#f2b22b');
  return { img, anchor: [15, 33] };
}

// ------------------------------------------------------------------ corner flags (props/bandeira_br, props/bandeira_sp): 16 x 32, pole at the left

export function bandeira(kind) {
  const img = blank(22, 32);
  const pole = (x, y0, y1) => { rect(img, x, y0, 2, y1 - y0, '#c9c1ae'); rect(img, x, y0, 1, y1 - y0, '#fbf7ee'); rect(img, x + 1, y0, 1, y1 - y0, '#a9a18e'); };
  // base
  box(img, 1, 28, 6, 3, '#6b4b30', C.navy);
  pole(3, 4, 29);
  rect(img, 2, 2, 3, 3, C.navy); rect(img, 3, 3, 1, 1, '#f2c230'); // ball on top
  const fx = 5, fy = 4, fw = 16, fh = 12;
  rect(img, fx - 1, fy - 1, fw + 2, fh + 2, C.navy);
  if (kind === 'br') {
    // green field, yellow rhombus, blue disc with a white band
    rect(img, fx, fy, fw, fh, '#2f9a4a');
    const cx = fx + fw / 2, cy = fy + fh / 2;
    for (let r = 0; r < fh; r++) {
      const half = Math.round((fw / 2 - 1) * (1 - Math.abs(r + 0.5 - fh / 2) / (fh / 2)));
      if (half > 0) rect(img, cx - half, fy + r, half * 2, 1, '#f6d32a');
    }
    for (let r = -3; r <= 2; r++) {
      const hw = Math.round(Math.sqrt(Math.max(0, 9.5 - (r + 0.5) * (r + 0.5))));
      if (hw > 0) rect(img, cx - hw, cy + r, hw * 2, 1, '#2a4fa8');
    }
    rect(img, cx - 3, cy, 6, 1, '#f8f2e4');
  } else {
    // Sao Paulo: alternating black / white stripes, red canton with a white disc, a dark map blob and 4 gold stars
    for (let r = 0; r < fh; r++) rect(img, fx, fy + r, fw, 1, r % 2 === 0 ? '#1a1a22' : '#f8f2e4');
    rect(img, fx, fy, 8, 6, '#d0231f');
    rect(img, fx + 2, fy + 1, 4, 4, '#f8f2e4'); rect(img, fx + 1, fy + 2, 6, 2, '#f8f2e4');
    rect(img, fx + 3, fy + 2, 2, 2, '#1c2f8a'); rect(img, fx + 2, fy + 2, 1, 1, '#1c2f8a');
    for (const [sx, sy] of [[fx + 1, fy + 1], [fx + 6, fy + 1], [fx + 1, fy + 4], [fx + 6, fy + 4]]) rect(img, sx, sy, 1, 1, '#f6c93a');
  }
  // fold shade on the free end
  rect(img, fx + fw - 1, fy + 1, 1, fh - 2, '#3a3a50');
  return { img, anchor: [4, 31] };
}

export const DERIVE_BJJ = {
  bjjBandeira: async (_ctx, { kind }) => { const { img, anchor } = bandeira(kind); return [{ img, anchor }]; },
  bjjSet,
  bjjPlacar: async () => { const { img, anchor } = placar(); return [{ img, anchor }]; },
};
