import { describe, expect, it } from 'vitest';
import { TAPIOCA_COOK, pastelFry } from '@tudobem/shared';
import {
  CROWD_HEADS,
  CROWD_MAX,
  END_BEAT,
  EXIT_LINE,
  crowdAfter,
  crowdHeads,
  endTier,
  meterZone,
  pointsFor,
  urgency,
} from './feiraStallLogic';

describe('the Feira stall view-model', () => {
  it('the crowd starts at half and moves with each customer who leaves', () => {
    expect(crowdHeads(0)).toBe(CROWD_HEADS / 2);
    expect(crowdAfter(0, 'perfect')).toBeGreaterThan(crowdAfter(0, 'ok'));
    expect(crowdAfter(0, 'ok')).toBeGreaterThan(0);
    expect(crowdAfter(0, 'soft')).toBe(0);
    expect(crowdAfter(0, 'miss')).toBeLessThan(0);
    expect(crowdAfter(0, 'left')).toBeLessThan(crowdAfter(0, 'miss'));
  });

  it('the crowd is clamped, so a long streak fills it and a bad run empties it', () => {
    let g = 0;
    for (let i = 0; i < 20; i++) g = crowdAfter(g, 'perfect');
    expect(g).toBe(CROWD_MAX);
    expect(crowdHeads(g)).toBe(CROWD_HEADS);
    for (let i = 0; i < 20; i++) g = crowdAfter(g, 'left');
    expect(g).toBe(-CROWD_MAX);
    expect(crowdHeads(g)).toBe(0);
  });

  it('a ticket goes calm, hurry, late as patience runs out', () => {
    expect(urgency(1)).toBe('calm');
    expect(urgency(0.5)).toBe('calm');
    expect(urgency(0.4)).toBe('hurry');
    expect(urgency(0.27)).toBe('late');
    expect(urgency(0)).toBe('late');
  });

  it('the tapioca flip window sits where tapiocaFlip says perfect', () => {
    const { cookMs, earlyMs, lateMs } = TAPIOCA_COOK;
    const z = meterZone(cookMs - earlyMs, cookMs + lateMs, cookMs + lateMs);
    expect(z.left).toBeCloseTo(((cookMs - earlyMs) / (cookMs + lateMs)) * 100, 0);
    expect(z.left + z.width).toBeCloseTo(100, 0);
  });

  it('the pastel golden window is inside the bar for both ladders', () => {
    for (const combo of [false, true]) {
      const fry = pastelFry(combo);
      const z = meterZone(fry.goldenAt, fry.darkAt, fry.fireAt);
      expect(z.left).toBeGreaterThan(0);
      expect(z.width).toBeGreaterThan(0);
      expect(z.left + z.width).toBeLessThan(100);
    }
  });

  it('a zone never leaves the bar, even with odd inputs', () => {
    expect(meterZone(-50, 50, 100)).toEqual({ left: 0, width: 50 });
    expect(meterZone(80, 400, 100)).toEqual({ left: 80, width: 20 });
    expect(meterZone(60, 20, 100)).toEqual({ left: 60, width: 0 });
    expect(meterZone(0, 10, 0).width).toBeLessThanOrEqual(100);
  });

  it('the end card reads as ground gained, held or lost', () => {
    expect(endTier({ score: 0, served: 0, left: 0 })).toBe('lose');
    expect(endTier({ score: 320, served: 8, left: 1 })).toBe('win');
    expect(endTier({ score: 120, served: 4, left: 1 })).toBe('hold');
    expect(endTier({ score: 200, served: 4, left: 3 })).toBe('hold');
    expect(endTier({ score: 90, served: 2, left: 5 })).toBe('lose');
  });

  it('every beat has Portuguese and an English gloss', () => {
    for (const beat of Object.values(END_BEAT)) {
      expect(beat.stamp.pt && beat.stamp.en && beat.line.pt && beat.line.en).toBeTruthy();
    }
    for (const line of Object.values(EXIT_LINE)) expect(line.pt && line.en).toBeTruthy();
  });

  it('the running guess matches the shared 48 / 32 / 16 / 0 steps', () => {
    expect([pointsFor('perfect'), pointsFor('ok'), pointsFor('soft'), pointsFor('miss')]).toEqual([48, 32, 16, 0]);
  });
});
