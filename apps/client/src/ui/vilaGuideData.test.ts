import { describe, expect, it } from 'vitest';
import { JULIA_TREE } from '@tudobem/shared';
import { VILA_GUIDE, VILA_GUIDE_PT_WORDS, shouldShowVilaGuide } from './vilaGuideData';

describe('the Vila Ipê guide', () => {
  it('names each loop once, in English, short enough to read in one go', () => {
    expect(VILA_GUIDE.lines.map((l) => l.pt)).toEqual(['Favores', 'Diário', 'Lugares']);
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

  it('never opens by itself (Ajustes → Guia, the "?" and Júlia open it)', () => {
    for (const room of ['rua_leste', 'rua', 'praca', 'feira', 'padaria', 'aeroporto', 'desembarque'])
      expect(shouldShowVilaGuide({ room, arrivalIntroDone: true, desembarqueDone: true, seen: false }), room).toBe(false);
  });

  it('is one of Júlia’s answers', () => {
    expect(JULIA_TREE.filter((j) => j.guide)).toHaveLength(1);
  });
});
