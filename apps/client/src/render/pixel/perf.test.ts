import { describe, expect, it } from 'vitest';
import { FrameProbe, LOWFX_P90_MS, LOWFX_WINDOW_MS, LowFxGovernor, MAX_SAMPLE_MS, quantile } from './perf';

/** Feed a probe frames of `dtMs` for `seconds`, calling `each` after every frame. */
function run(probe: FrameProbe, dtMs: number, seconds: number, start: number, each?: (now: number) => void): number {
  let now = start;
  const end = start + seconds * 1000;
  while (now < end) {
    now += dtMs;
    probe.record(dtMs, now);
    each?.(now);
  }
  return now;
}

describe('quantile', () => {
  it('nearest-rank', () => {
    expect(quantile([], 0.9)).toBe(0);
    expect(quantile([5], 0.9)).toBe(5);
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(quantile(v, 0.5)).toBe(50);
    expect(quantile(v, 0.9)).toBe(90);
    expect(quantile(v, 1)).toBe(100);
  });
  it('does not need sorted input', () => {
    expect(quantile([9, 1, 5, 3, 7], 0.5)).toBe(5);
  });
});

describe('FrameProbe', () => {
  it('reports fps and percentiles over a rolling window', () => {
    const p = new FrameProbe();
    run(p, 16.7, 2, 0);
    const s = p.stats();
    expect(s.fps).toBe(60);
    expect(s.p90Ms).toBe(16.7);
    expect(s.avgMs).toBe(16.7);
    expect(s.frames).toBeGreaterThan(100);
  });

  it('forgets frames older than the window', () => {
    const p = new FrameProbe();
    let now = run(p, 50, 3, 0); // slow start
    now = run(p, 10, 6, now); // then fast for longer than the window
    expect(p.stats().p90Ms).toBe(10);
    expect(p.span(now)).toBeLessThanOrEqual(LOWFX_WINDOW_MS);
  });

  it('ignores stalls (hidden tab) and non-positive samples', () => {
    const p = new FrameProbe();
    p.record(MAX_SAMPLE_MS + 1, 1000);
    p.record(0, 1001);
    p.record(-5, 1002);
    expect(p.values()).toHaveLength(0);
    expect(p.stats().fps).toBe(0);
  });
});

describe('LowFxGovernor (p90 over 25 ms for 5 s)', () => {
  it('stays off for a healthy run', () => {
    const p = new FrameProbe();
    const g = new LowFxGovernor(p);
    run(p, 16.7, 20, 0, (n) => g.check(n));
    expect(g.tripped).toBe(false);
  });

  it('trips once the p90 has been slow across a full 5 s window, not before', () => {
    const p = new FrameProbe();
    const g = new LowFxGovernor(p);
    let trippedAt = -1;
    run(p, 40, 12, 0, (n) => {
      if (g.check(n)) trippedAt = n;
    });
    expect(g.tripped).toBe(true);
    expect(g.reason).toBe('p90');
    expect(trippedAt).toBeGreaterThanOrEqual(LOWFX_WINDOW_MS * 0.98);
    expect(trippedAt).toBeLessThan(LOWFX_WINDOW_MS + 500);
  });

  it('a brief hitch does not trip it (the p90 shrugs off a few slow frames)', () => {
    const p = new FrameProbe();
    const g = new LowFxGovernor(p);
    let now = run(p, 16.7, 4, 0, (n) => g.check(n));
    for (let i = 0; i < 6; i++) {
      now += 120;
      p.record(120, now);
      g.check(now);
    }
    now = run(p, 16.7, 10, now, (n) => g.check(n));
    expect(g.tripped).toBe(false);
  });

  it('exactly at the limit is fine, just over trips', () => {
    const ok = new FrameProbe();
    const gOk = new LowFxGovernor(ok);
    run(ok, LOWFX_P90_MS, 8, 0, (n) => gOk.check(n));
    expect(gOk.tripped).toBe(false);
    const bad = new FrameProbe();
    const gBad = new LowFxGovernor(bad);
    run(bad, LOWFX_P90_MS + 1, 8, 0, (n) => gBad.check(n));
    expect(gBad.tripped).toBe(true);
  });

  it('?lowfx=1 starts tripped and never reports a new trip', () => {
    const p = new FrameProbe();
    const g = new LowFxGovernor(p, true);
    expect(g.tripped).toBe(true);
    expect(g.reason).toBe('flag');
    let again = false;
    run(p, 60, 10, 0, (n) => {
      if (g.check(n)) again = true;
    });
    expect(again).toBe(false);
  });

  it('never un-trips when the frames get fast again', () => {
    const p = new FrameProbe();
    const g = new LowFxGovernor(p);
    let now = run(p, 40, 8, 0, (n) => g.check(n));
    expect(g.tripped).toBe(true);
    run(p, 8, 20, now, (n) => g.check(n));
    expect(g.tripped).toBe(true);
  });
});
