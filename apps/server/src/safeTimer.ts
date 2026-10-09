/**
 * Timer callbacks that cannot take the process down. NPC ticks, walks, bouts and Correria clocks all run
 * from `setTimeout`; an exception thrown there is an uncaught exception, which ends the world for everyone.
 * Isomorphic (the browser solo mode runs the same World).
 */

/** Wrap `fn` so a throw is logged under `label` instead of escaping the timer. */
export function guarded(label: string, fn: () => void): () => void {
  return () => {
    try {
      fn();
    } catch (e) {
      console.error(`[${label}] timer callback failed`, e);
    }
  };
}

/** The World's default `schedule`: a guarded, unref'd setTimeout (it never holds the process open). */
export function safeSchedule(fn: () => void, ms: number): void {
  const t = setTimeout(guarded('world', fn), ms) as unknown as { unref?: () => void };
  t.unref?.();
}
