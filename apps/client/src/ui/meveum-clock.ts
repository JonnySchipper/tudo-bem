/** Tray-UI clock for one Me vê um ticket. Pure so the retry re-arm can be tested without a DOM. */

export interface MgClock {
  orderAt: number;
  timeoutNotBefore: number;
  /** True once this attempt's "de novo, devagar" clock has been started. */
  repeatArmed: boolean;
}

export interface MgClockMsg {
  resync?: boolean;
  repeat: boolean;
  round: number;
  pt: string;
}

/**
 * A same-ticket resync must not restart a clock the player is already using
 * (early timeout, echo submit). The first packet that announces the retry
 * does restart it — even when that packet is a resync — so a late miss cannot
 * leave “de novo, devagar” on an already-empty bar.
 */
export function nextMgClock(prev: MgClock, msg: MgClockMsg, current: { round: number; pt: string } | null, now: number): { clock: MgClock; hold: boolean } {
  const same = !!(msg.resync && current && current.round === msg.round && current.pt === msg.pt);
  const enteringRepeat = !!msg.repeat && !prev.repeatArmed;
  if (same && !enteringRepeat) {
    return { hold: true, clock: { ...prev, timeoutNotBefore: now + 1000 } };
  }
  return { hold: false, clock: { orderAt: now, timeoutNotBefore: 0, repeatArmed: !!msg.repeat } };
}
