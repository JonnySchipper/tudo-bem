import { describe, expect, it } from 'vitest';
import { PESCA_FIGHT, pescaJudge, pescaRoll, runAt, type ServerMsg } from '@tudobem/shared';
import { PescaPlay, swell } from './pescaPlay';

type CastMsg = Extract<ServerMsg, { t: 'pesca'; phase: 'cast' }>;
const castMsg = (seed: number, water: CastMsg['water'] = 'remo'): CastMsg => ({ t: 'pesca', phase: 'cast', seq: 1, seed, water, weather: 'sol', minute: 600, power: 0.5, firstCatches: 5 });

/** Plays one cast like a good player: taps at the bite, holds, lets go through every run. Returns the local end and the events. */
function playWell(m: CastMsg) {
  const p = new PescaPlay();
  p.press(0);
  p.release(800);
  p.onCast(m, 1000);
  const roll = p.roll!;
  let now = 1000;
  let last: string | null = null;
  for (let i = 0; i < 2000 && p.phase !== 'sent'; i++) {
    now += 20;
    const t = now - p.t0;
    if (p.phase === 'wait' && t >= roll.biteAtMs + 100) p.press(now);
    if (p.phase === 'fight') {
      const ft = t - p.hookMs;
      const running = !!runAt(roll, ft) || roll.runs.some((r) => ft >= r.at - 40 && ft < r.at);
      if (running && p.holding) p.release(now);
      if (!running && !p.holding) p.press(now);
    }
    const r = p.tick(now);
    if (r.done) last = r.cues.at(-1) ?? null;
  }
  return { p, last, elapsed: now - 1000 };
}

describe('the fishing stage plays the same fight the server judges (PRAIA-PLAN.md 2.2)', () => {
  it('the power swells and falls back every 1.6 s', () => {
    expect(swell(0)).toBeCloseTo(0);
    expect(swell(800)).toBeCloseTo(1);
    expect(swell(1600)).toBeCloseTo(0);
  });

  it('the local end matches the server replay of the same taps and holds, cast after cast', () => {
    let caught = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const m = castMsg(seed * 13);
      const { p, last, elapsed } = playWell(m);
      const judged = pescaJudge(p.cast!, p.events, elapsed + 50);
      const local = last === 'landed' ? (judged.kind === 'junk' || judged.kind === 'released' ? judged.kind : 'caught') : last;
      expect(judged.kind, `seed ${seed * 13}: ${pescaRoll(p.cast!).catch}`).toBe(local);
      if (judged.kind === 'caught') caught++;
    }
    expect(caught).toBeGreaterThan(20);
  });

  it('a tap before the bite is early; no tap is late; holding the cast too long tangles', () => {
    const p = new PescaPlay();
    p.press(0);
    p.release(500);
    p.onCast(castMsg(5), 1000);
    expect(p.press(1000 + p.roll!.biteAtMs - 300)).toEqual(['early']);
    expect(p.events).toEqual([{ k: 'hook', ms: p.roll!.biteAtMs - 300 }]);

    const q = new PescaPlay();
    q.press(0);
    q.release(500);
    q.onCast(castMsg(5), 1000);
    const end = q.tick(1000 + q.roll!.biteAtMs + 5000);
    expect(end).toMatchObject({ done: true, cues: expect.arrayContaining(['late']) });

    const r = new PescaPlay();
    r.press(0);
    expect(r.tick(PESCA_FIGHT.tangleMs + 10).cues).toEqual(['tangle']);
    expect(r.release(PESCA_FIGHT.tangleMs + 20).castPower).toBeNull();
    expect(r.phase).toBe('aim');
  });
});
