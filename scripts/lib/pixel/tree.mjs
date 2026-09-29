// Tree helpers: split a tree into trunk + overhead canopy, and derive a 3-frame sway for the canopy.
import { blank, crop, paste } from './img.mjs';

/** Rows above cutY are the canopy (overhead layer), rows from cutY down are the trunk (standing layer). */
export function splitTree(img, cutY) {
  return { canopy: crop(img, 0, 0, img.w, cutY), trunk: crop(img, 0, cutY, img.w, img.h - cutY) };
}

/**
 * Three canopy frames padded by `pad` px on each side: 0 = rest, 1 = top half leans right, 2 = top half leans left.
 * The lean is a whole-pixel row shift (pixel art never resamples), strongest at the top, none in the bottom third.
 */
export function swayFrames(canopy, pad = 1) {
  const w = canopy.w + pad * 2;
  const frames = [];
  for (const dir of [0, 1, -1]) {
    const f = blank(w, canopy.h);
    for (let y = 0; y < canopy.h; y++) {
      const t = 1 - y / canopy.h; // 1 at the top, 0 at the bottom
      const shift = dir === 0 ? 0 : t > 0.55 ? dir * 1 : t > 0.3 ? (y % 2 === 0 ? dir : 0) : 0;
      paste(f, crop(canopy, 0, y, canopy.w, 1), pad + shift, y);
    }
    frames.push(f);
  }
  return frames;
}
