/**
 * Where a photo's print is held while its words burst out of it (ui/photoFind.ts). Pure, so it is tested without a DOM.
 */

/** Room the word takes over the print: the kicker, the big word, the English and the tally, and the gap above the print. */
export const LOCKUP_ROOM = 190;
/** How much the print grows on stage when the screen has room for it. */
export const STAGE_SCALE = 1.25;

/**
 * The print's centre on stage and its scale: in the middle of the screen across, and down far enough that the word fits above it between
 * the HUD bars (`top` and `bottom` are their heights in CSS px). A short screen keeps the print at its own size.
 */
export function printStage(print: { w: number; h: number }, view: { w: number; h: number; top: number; bottom: number }): { x: number; y: number; scale: number } {
  const pad = 8;
  const free = view.h - view.top - view.bottom;
  const scale = free >= LOCKUP_ROOM + print.h * STAGE_SCALE + 4 * pad ? STAGE_SCALE : 1;
  const ph = print.h * scale;
  const block = LOCKUP_ROOM + ph;
  const y = view.top + Math.max(pad, (free - block) / 2) + LOCKUP_ROOM + ph / 2;
  const lo = view.top + pad + ph / 2;
  const hi = view.h - view.bottom - pad - ph / 2;
  return { x: view.w / 2, y: hi < lo ? view.h / 2 : Math.max(lo, Math.min(hi, y)), scale };
}
