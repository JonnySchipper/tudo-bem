// BJJ "Treino no tatame" art: two-person grappling sprites (bjj/pair_*, trans_*, finish_tap, win_raise, fistbump, face_off), the referee
// signals (bjj/ref_*) and the scoreboard prop (props/placar). See bjj-rig.mjs (puppet renderer), bjj-poses.mjs, bjj-anim.mjs, bjj-ref.mjs.
import { blank } from '../../../../scripts/lib/pixel/img.mjs';
import { C, rect, box } from './draw.mjs';
import { renderPair, toImage, W as CW } from './bjj-rig.mjs';
import { POSITION_IDS } from './bjj-poses.mjs';
import { struggle, transition, TRANSITIONS, finishTap, winRaise, fistbump, faceOff } from './bjj-anim.mjs';
import { refFrame, REF_SIGNALS } from './bjj-ref.mjs';

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

/** Derive generator: all bjj/* sprites (the import-map entry's key must be the first one, bjj/pair_de_pe_0). */
export async function bjjSet() {
  return bjjFrames().map(({ key, img, anchor }) => ({ key, img, anchor }));
}

// ------------------------------------------------------------------ props/placar

/** Blank digit areas (x, y, w, h) inside props/placar, for the DOM digits laid over the sprite. */
export const PLACAR_CELLS = {
  clock: [14, 3, 20, 7],
  player: { pontos: [27, 13, 8, 8], vantagens: [37, 13, 8, 8] },
  partner: { pontos: [27, 23, 8, 8], vantagens: [37, 23, 8, 8] },
};

export function placar() {
  const w = 48, h = 44;
  const img = blank(w, h);
  const wood = '#6b4b30', woodD = '#573c2c', woodL = '#8a6a44';
  // legs and foot
  for (const x of [6, 36]) { rect(img, x, 31, 6, 12, wood); rect(img, x, 31, 1, 12, woodL); rect(img, x + 5, 31, 1, 12, woodD); }
  rect(img, 4, 42, 10, 2, woodD); rect(img, 34, 42, 10, 2, woodD);
  // board
  box(img, 0, 0, w, 33, '#2d4468', C.navy);
  rect(img, 1, 1, w - 2, 1, '#4a6fa0'); rect(img, 1, 1, 1, 31, '#4a6fa0');
  rect(img, 1, 31, w - 2, 1, '#1f3150');
  // clock strip
  rect(img, 2, 2, 11, 9, '#c45c26'); rect(img, 35, 2, 11, 9, '#c45c26');
  rect(img, 2, 2, 11, 1, '#e0884a'); rect(img, 35, 2, 11, 1, '#e0884a');
  const cell = ([x, y, cw, ch]) => { rect(img, x - 1, y - 1, cw + 2, ch + 2, C.navy); rect(img, x, y, cw, ch, '#12161f'); rect(img, x, y, cw, 1, '#1c2230'); };
  cell(PLACAR_CELLS.clock);
  for (const row of ['player', 'partner']) for (const c of Object.values(PLACAR_CELLS[row])) cell(c);
  // gi chips: white (player) and blue (partner), with a belt
  const chip = (y, gi, gi2, belt) => {
    rect(img, 3, y, 21, 8, '#1f3150');
    rect(img, 3, y, 21, 1, '#16233a');
    box(img, 4, y, 8, 8, gi, C.navy); rect(img, 5, y + 1, 6, 1, gi2); rect(img, 4, y + 4, 8, 2, belt);
    // name slot (blank)
    rect(img, 13, y + 1, 10, 6, '#16233a');
  };
  chip(13, '#e8e2d4', '#fbf7ee', '#3a3a50');
  chip(23, '#4a78b8', '#6f9ad8', '#1c1c28');
  // column ticks above the digit cells (pontos / vantagens)
  for (const x of [28, 38]) rect(img, x, 11, 6, 1, '#f2b22b');
  return { img, anchor: [24, 42] };
}

export const DERIVE_BJJ = {
  bjjSet,
  bjjPlacar: async () => { const { img, anchor } = placar(); return [{ img, anchor }]; },
};
