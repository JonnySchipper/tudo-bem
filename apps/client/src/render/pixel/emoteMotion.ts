/**
 * Which emote rows the body actually plays.
 * `EMOTE_ANIMS` in charsheet.ts is oi, dancar, rir, valeu, desculpa.
 * The oi, valeu and dancar rows paint a second arm on top of the idle body, so the scene
 * keeps the idle pose for those three and lets the pop-up icon say which one it is.
 * Dançar leans the whole sprite side to side instead of drawing hands.
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
