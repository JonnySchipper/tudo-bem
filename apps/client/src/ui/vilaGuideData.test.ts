import { describe, expect, it } from 'vitest';
import { JULIA_TREE } from '@tudobem/shared';
import { VILA_GUIDE, shouldShowVilaGuide } from './vilaGuideData';

describe('the Vila Ipê guide', () => {
  it('names each loop once, in English, short enough to read in one go', () => {
    expect(VILA_GUIDE.lines.map((l) => l.pt)).toEqual(['Favores', 'Diário', 'Cartela', 'Lugares', 'Relógio']);
    const all = [VILA_GUIDE.lead, ...VILA_GUIDE.lines.map((l) => l.en), VILA_GUIDE.tip].join(' ');
    expect(all.length).toBeLessThan(1100);
  });

  it('opens by itself once, in the Vila, after the arrival', () => {
    expect(shouldShowVilaGuide({ room: 'rua_leste', arrivalIntroDone: true, seen: false })).toBe(true);
    expect(shouldShowVilaGuide({ room: 'praca', seen: false })).toBe(true);
    expect(shouldShowVilaGuide({ room: 'praca', seen: true })).toBe(false);
    expect(shouldShowVilaGuide({ room: 'aeroporto', arrivalIntroDone: false, seen: false })).toBe(false);
    expect(shouldShowVilaGuide({ room: 'desembarque', desembarqueDone: false, seen: false })).toBe(false);
    // indoors (a game, a shop) it waits for the next walk outside
    expect(shouldShowVilaGuide({ room: 'padaria', seen: false })).toBe(false);
  });

  it('is one of Júlia’s answers', () => {
    expect(JULIA_TREE.filter((j) => j.guide)).toHaveLength(1);
  });
});
