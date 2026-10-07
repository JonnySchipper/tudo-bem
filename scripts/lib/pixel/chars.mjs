// Converts LimeZu Character Generator layers into the canonical Tudo Bem sheet (HOWTO 5.5).
//
// LimeZu layer sheets: 16x32 frames, 56 columns. Source rows used here (row = y / 32):
//   1  idle    24 frames = 4 facings x 6 frames, facing block order E, N, W, S
//   2  walk    24 frames, same block order
//   4  sit     12 frames: cols 0-5 face E, cols 6-11 face W (there is no front/back sit)
//   6  phone   12 frames facing S (loop 3..8 has the phone in hand); the Smartphones layer carries the phone itself
//   9  pick up 48 frames = 4 facings x 12, block order E, N, W, S: the S block bows down and comes back up ("desculpa")
// Canonical sheet: 8 columns x 18 rows of 16x32 (see CANON_ANIMS), row order S, W, E, N inside each block.
import { blank, crop, paste, clone, flipH } from './img.mjs';
import { KEY_RAMPS, keyMapForShades, mergeTables, swapKeys } from '../../../apps/client/src/render/pixel/palette.ts';

export const FRAME_W = 16;
export const FRAME_H = 32;
export const CANON_COLS = 8;
export const CANON_ROWS = 18;

/** Canonical facing row order (matches FACING_ROW in HOWTO 5.2): S 0, W 1, E 2, N 3. */
export const FACINGS = ['S', 'W', 'E', 'N'];
/** Source block index (in units of 6 frames) for each canonical facing. Source order is E, N, W, S. */
export const SRC_BLOCK = { S: 3, W: 2, E: 0, N: 1 };

export const CANON_ANIMS = {
  idle: { rows: [0, 1, 2, 3], frames: 6, fps: 5, loop: true },
  walk: { rows: [4, 5, 6, 7], frames: 6, fps: 10, loop: true },
  sit: { rows: [8, 9, 10, 11], frames: 1 },
  // emotes (facing S). oi/rir/valeu = real idle frames + the authored gesture layer; dancar = the real walk cycle in place
  // (+ the gesture layer); desculpa = the pack's "pick up" bow, all real frames.
  oi: { row: 12, frames: 6, fps: 8, repeat: 2 },
  dancar: { row: 13, frames: 6, fps: 8, repeat: 3 },
  rir: { row: 14, frames: 4, fps: 8, repeat: 3 },
  valeu: { row: 15, frames: 4, fps: 8, repeat: 1, hold: 600 },
  desculpa: { row: 16, frames: 8, fps: 8, repeat: 1, hold: 600 },
  // idle pose "celular": the pack's phone-in-hand loop (facing S only)
  phone: { row: 17, frames: 6, fps: 6, loop: true },
};

/** Frames per canonical row (cols beyond that stay empty). */
export const ROW_FRAMES = (() => {
  const out = [];
  for (const a of Object.values(CANON_ANIMS)) {
    if (a.rows) for (const r of a.rows) out[r] = a.frames;
    else out[a.row] = a.frames;
  }
  return out;
})();

/** Facing of a canonical row (emotes and the phone row face S). */
export const rowFacing = (r) => (r < 12 ? FACINGS[r % 4] : 'S');

const frameAt = (sc) => (src, row, col) => crop(src, col * FRAME_W * sc, row * FRAME_H * sc, FRAME_W * sc, FRAME_H * sc);

/** Shifts a frame down by `dy` px, dropping what falls off the bottom (used to fake a front/back sit under a bench seat). */
function shiftDown(img, dy) {
  const out = blank(img.w, img.h);
  paste(out, img, 0, dy);
  return out;
}

/** Source frames (row, col) used by the emote rows that are not plain idle-S copies. */
const PICKUP_S = [36, 37, 38, 39, 40, 41, 42, 46];
const PHONE = [3, 4, 5, 6, 7, 8];

/**
 * @param src merged layer image (896 wide, LimeZu layout, at least 10 rows tall; 1792 wide at `scale` 2)
 * @param opts { sitFrontDrop: number } px to lower the idle frame for S/N sit (at 16x16); { scale: 2 } for the 32x32 generator (32x64 frames)
 */
export function toCanonicalSheet(src, opts = {}) {
  const sc = opts.scale ?? 1;
  const frame = frameAt(sc);
  const out = blank(CANON_COLS * FRAME_W * sc, CANON_ROWS * FRAME_H * sc);
  const put = (img, col, row) => paste(out, img, col * FRAME_W * sc, row * FRAME_H * sc);
  FACINGS.forEach((f, fi) => {
    const block = SRC_BLOCK[f];
    for (let k = 0; k < 6; k++) {
      put(frame(src, 1, block * 6 + k), k, CANON_ANIMS.idle.rows[fi]);
      put(frame(src, 2, block * 6 + k), k, CANON_ANIMS.walk.rows[fi]);
    }
  });
  // sit: side views come from the pack; front/back are the idle frame lowered so the bench seat hides the legs
  const drop = (opts.sitFrontDrop ?? 4) * sc;
  put(shiftDown(frame(src, 1, SRC_BLOCK.S * 6), drop), 0, CANON_ANIMS.sit.rows[0]);
  put(frame(src, 4, 6), 0, CANON_ANIMS.sit.rows[1]); // W
  put(frame(src, 4, 0), 0, CANON_ANIMS.sit.rows[2]); // E
  put(shiftDown(frame(src, 1, SRC_BLOCK.N * 6), drop), 0, CANON_ANIMS.sit.rows[3]);
  const idleS = (k) => frame(src, 1, SRC_BLOCK.S * 6 + k);
  const walkS = (k) => frame(src, 2, SRC_BLOCK.S * 6 + k);
  for (let k = 0; k < CANON_ANIMS.oi.frames; k++) put(idleS(k), k, CANON_ANIMS.oi.row);
  for (let k = 0; k < CANON_ANIMS.dancar.frames; k++) put(walkS(k), k, CANON_ANIMS.dancar.row);
  for (let k = 0; k < CANON_ANIMS.rir.frames; k++) put(idleS(k), k, CANON_ANIMS.rir.row);
  for (let k = 0; k < CANON_ANIMS.valeu.frames; k++) put(idleS(k), k, CANON_ANIMS.valeu.row);
  PICKUP_S.forEach((c, k) => put(frame(src, 9, c), k, CANON_ANIMS.desculpa.row));
  PHONE.forEach((c, k) => put(frame(src, 6, c), k, CANON_ANIMS.phone.row));
  return out;
}

/** Composites several source layers (same layout) back to front into one sheet. */
export function mergeLayers(layers) {
  const out = clone(layers[0]);
  for (const l of layers.slice(1)) paste(out, l, 0, 0);
  return out;
}

/** Applies key-ramp conversion: `groups` = { skin: [hex...], hair: [...], top: [...], bottom: [...], shoes: [...] } (source shades, any order). */
export function keyLayer(img, groups) {
  const tables = Object.entries(groups ?? {}).map(([ramp, shades]) => {
    if (!KEY_RAMPS[ramp]) throw new Error('unknown ramp group ' + ramp);
    return keyMapForShades(shades, ramp);
  });
  if (tables.length === 0) return img;
  const out = clone(img);
  swapKeys(out.data, mergeTables(...tables));
  return out;
}

export { flipH };
