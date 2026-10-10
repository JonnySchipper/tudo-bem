/**
 * Which emote rows the body actually plays.
 * `EMOTE_ANIMS` in charsheet.ts is oi, dancar, rir, valeu, desculpa.
 * The oi, valeu and dancar rows paint a second arm on top of the idle body, so the scene
 * keeps the idle pose for those three and lets the pop-up icon say which one it is.
 * Dançar leans the whole sprite side to side instead of drawing hands. Nobody waves: Oi is a small nod.
 */

export const LIMB_EMOTES = ['oi', 'valeu', 'dancar'] as const;

/** False for Oi, Valeu and Dançar: those sheet rows are not played. */
export function emotePlaysSheet(kind: string): boolean {
  return !(LIMB_EMOTES as readonly string[]).includes(kind);
}

/** One lean each way. Two world pixels at the peak, so the figure never grows a new limb. */
const DANCE_PERIOD_S = 1.4;
const DANCE_AMP = 2;

/**
 * Horizontal offset while Dançar is in progress. `elapsed` and `duration` are seconds.
 * `reduced` holds the figure still.
 */
export function danceSway(kind: string, elapsed: number, duration: number, reduced = false): number {
  if (reduced || kind !== 'dancar') return 0;
  if (!(elapsed >= 0) || !(duration > 0) || elapsed >= duration) return 0;
  return Math.round(Math.sin((elapsed / DANCE_PERIOD_S) * Math.PI * 2) * DANCE_AMP);
}

/** A nod: the figure dips one pixel, comes back up, and does it once more. */
const NOD_BEAT_S = 0.16;
const NOD_DIPS = 2;
/** How long a nod lasts, in seconds. */
export const NOD_S = NOD_BEAT_S * 2 * NOD_DIPS;

/** How far down (0 or 1 px) a nodding figure sits, `elapsed` seconds into the nod. `reduced` holds it still. */
export function nodDip(elapsed: number, reduced = false): number {
  if (reduced || !(elapsed >= 0) || elapsed >= NOD_S) return 0;
  return Math.floor(elapsed / NOD_BEAT_S) % 2 === 0 ? 1 : 0;
}

/** The greeting (Oi) is a nod on the idle body, never the waving arm. Every other emote: 0. */
export function emoteNod(kind: string, elapsed: number, reduced = false): number {
  return kind === 'oi' ? nodDip(elapsed, reduced) : 0;
}
