import { describe, expect, it } from 'vitest';
import { PAPOS, PAPO_NPCS, STORY_HEARTS, normalizePapos, papoById, papoFor, papoOpen, papoProblems, paposOf, storyOf } from './papos.js';
import { BOND_MILESTONES, NPC_IDS } from './bonds.js';

const allText = (id: string) => {
  const p = papoById(id)!;
  return Object.values(p.nodes).flatMap((n) => [n.line.pt, n.line.en, ...n.chips.flatMap((c) => [c.pt, c.en])]);
};

describe('bate-papos (pre-made conversations, #229)', () => {
  it('are well formed: unique ids, known NPCs, every chip leads somewhere, every node reached, PT and EN everywhere', () => {
    expect(new Set(PAPOS.map((p) => p.id)).size).toBe(PAPOS.length);
    for (const p of PAPOS) {
      expect(NPC_IDS, p.id).toContain(p.npc);
      expect(papoProblems(p), p.id).toEqual([]);
    }
  });

  it('are never graded: no right or wrong reply, every node offers a way on and every path ends', () => {
    for (const p of PAPOS) {
      // walk every path: each one reaches `end` without loops
      const ends = (id: string, seen: Set<string>): boolean => {
        if (id === 'end') return true;
        if (seen.has(id)) return false;
        const n = p.nodes[id]!;
        return n.chips.every((c) => ends(c.next, new Set([...seen, id])));
      };
      expect(ends(p.start, new Set()), p.id).toBe(true);
      for (const t of allText(p.id)) expect(t, p.id).not.toMatch(/\b(errado|nota|pontos?|score|correct|wrong|grade)\b/i);
    }
  });

  it('have no math: no numbers, prices or sums in any line or chip', () => {
    for (const p of PAPOS) for (const t of allText(p.id)) expect(t, p.id).not.toMatch(/\d|R\$|\breais\b|\breal\b|\bquanto\b|\bmais\s+\w+\s+é\b|\bhow much\b|\btotal\b/i);
  });

  it('give every talking neighbour everyday papos and a story at 4 hearts (the `story` milestone)', () => {
    expect(BOND_MILESTONES.find((m) => m.hearts === STORY_HEARTS)?.kind).toBe('story');
    for (const npc of ['carlos', 'graca', 'nanda', 'julia', 'prof'] as const) {
      expect(PAPO_NPCS).toContain(npc);
      expect(paposOf(npc).filter((p) => p.minHearts === undefined).length, npc).toBeGreaterThanOrEqual(2);
      expect(storyOf(npc)?.minHearts, npc).toBe(STORY_HEARTS);
    }
    expect(storyOf('tia_lu')).toBeUndefined();
  });

  it('picks the story first once it opens, then the ones not heard yet, then takes turns by game day', () => {
    const story = storyOf('carlos')!;
    expect(papoOpen(story, STORY_HEARTS - 1)).toBe(false);
    expect(papoOpen(story, STORY_HEARTS)).toBe(true);
    expect(papoFor('carlos', 0, [], 0)?.id).toBe('carlos.cedo');
    expect(papoFor('carlos', 0, ['carlos.cedo'], 0)?.id).toBe('carlos.cafe');
    expect(papoFor('carlos', STORY_HEARTS, ['carlos.cedo'], 0)?.id).toBe(story.id);
    const heard = paposOf('carlos').map((p) => p.id);
    const days = new Set([0, 1, 2, 3, 4, 5].map((d) => papoFor('carlos', 10, heard, d)!.id));
    expect(days.size).toBe(heard.length);
    expect(papoFor('carlos', 0, heard, 7)?.minHearts).toBeUndefined(); // a closed story is never picked
    expect(papoFor('tia_lu', 10, [], 0)).toBeNull();
  });

  it('keeps only known ids from a save', () => {
    expect(normalizePapos(undefined)).toEqual([]);
    expect(normalizePapos(['carlos.cedo', 'carlos.cedo', 'ghost', 7])).toEqual(['carlos.cedo']);
  });
});
