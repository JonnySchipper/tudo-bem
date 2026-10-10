import { describe, expect, it } from 'vitest';
import { JULIA_TREE } from '@tudobem/shared';
import { VILA_GUIDE, VILA_GUIDE_PT_WORDS, shouldShowVilaGuide } from './vilaGuideData';

describe('the Vila Ipê guide', () => {
  it('names each loop once, in English, short enough to read in one go', () => {
    expect(VILA_GUIDE.lines.map((l) => l.pt)).toEqual(['Recados', 'Diário', 'Cartela', 'Lugares', 'Relógio']);
    const all = [VILA_GUIDE.lead, ...VILA_GUIDE.lines.map((l) => l.en), VILA_GUIDE.tip].join(' ');
    expect(all.length).toBeLessThan(1200);
  });

  it('translates every Portuguese word on it: each name has its English, and a Portuguese word in the text is glossed the first time', () => {
    for (const l of VILA_GUIDE.lines) expect(l.gloss.length).toBeGreaterThan(2);
    expect(VILA_GUIDE.title.en && VILA_GUIDE.kicker.en && VILA_GUIDE.ok.en).toBeTruthy();
    const all = [VILA_GUIDE.lead, ...VILA_GUIDE.lines.map((l) => l.en), VILA_GUIDE.tip].join(' ');
    for (const w of VILA_GUIDE_PT_WORDS) {
      const at = all.search(new RegExp(`\\b${w}\\b`));
      expect(at, w).toBeGreaterThanOrEqual(0);
      expect(all.slice(at + w.length, at + w.length + 2), `${w} is glossed`).toBe(' (');
    }
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
