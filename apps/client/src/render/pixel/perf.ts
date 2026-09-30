/**
 * Performance budget helpers (HOWTO §5.11): a tiny frame-time probe (exposed as `window.__tb.perf` for tests and the shots script), the
 * automatic low-fx fallback (p90 frame time over 25 ms for 5 s), and `prefers-reduced-motion`. Pure and injectable, so it is unit tested.
 */

/** p90 frame time over this many ms trips the fallback. */
export const LOWFX_P90_MS = 25;
/** ... measured over this long. */
export const LOWFX_WINDOW_MS = 5000;
/** Frames longer than this are a hidden tab or a stall, not a slow renderer: they are not counted. */
export const MAX_SAMPLE_MS = 500;

/** The q-quantile (0..1) of a list, nearest-rank. Empty list: 0. */
export function quantile(values: readonly number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i];
}

export interface PerfStats {
  frames: number;
  fps: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  maxMs: number;
}

/** Rolling window of frame times (ms), stamped with the time each frame ended. */
export class FrameProbe {
  private t: number[] = [];
  private dt: number[] = [];
  private total = 0;
  constructor(private readonly windowMs = LOWFX_WINDOW_MS) {}

  record(dtMs: number, nowMs: number): void {
    if (!(dtMs > 0) || dtMs > MAX_SAMPLE_MS) return;
    this.total++;
    this.t.push(nowMs);
    this.dt.push(dtMs);
    const cut = nowMs - this.windowMs;
    let n = 0;
    while (n < this.t.length && this.t[n] < cut) n++;
    if (n > 0) {
      this.t.splice(0, n);
      this.dt.splice(0, n);
    }
  }

  /** Age of the oldest sample in the window (how much history there is), ms. */
  span(nowMs: number): number {
    return this.t.length ? nowMs - this.t[0] : 0;
  }

  values(): readonly number[] {
    return this.dt;
  }

  stats(): PerfStats {
    const n = this.dt.length;
    const sum = this.dt.reduce((a, b) => a + b, 0);
    const avg = n ? sum / n : 0;
    return {
      frames: this.total,
      fps: avg ? Math.round(1000 / avg) : 0,
      avgMs: round1(avg),
      p50Ms: round1(quantile(this.dt, 0.5)),
      p90Ms: round1(quantile(this.dt, 0.9)),
      maxMs: round1(n ? Math.max(...this.dt) : 0),
    };
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Trips once when the p90 frame time has stayed above the budget across a full window. It never un-trips on its own: flapping between full
 * and low quality is worse than staying low.
 */
export class LowFxGovernor {
  tripped = false;
  reason: 'flag' | 'p90' | null = null;
  constructor(
    private readonly probe: FrameProbe,
    forced = false,
    private readonly limitMs = LOWFX_P90_MS,
    private readonly windowMs = LOWFX_WINDOW_MS,
  ) {
    if (forced) {
      this.tripped = true;
      this.reason = 'flag';
    }
  }

  /** Call once per frame after `probe.record`. Returns true on the frame it trips. */
  check(nowMs: number): boolean {
    if (this.tripped) return false;
    if (this.probe.span(nowMs) < this.windowMs * 0.98) return false;
    if (quantile(this.probe.values(), 0.9) <= this.limitMs) return false;
    this.tripped = true;
    this.reason = 'p90';
    return true;
  }
}

/** `prefers-reduced-motion: reduce`, live. */
export function reducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
