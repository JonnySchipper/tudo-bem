import { beforeEach, describe, expect, it } from 'vitest';
import { RV_PRICE_NOTE, resetRvNoteForTests, rvNoteKey, takeRvNote } from './rvNote';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('rvNote', () => {
  beforeEach(resetRvNoteForTests);

  it('is one English sentence that explains the pair once', () => {
    expect(RV_PRICE_NOTE).toBe('RV (reais virtuais) is play money. You earn it doing favors and playing at the counter.');
  });

  it('shows the first time a price list opens for a profile, then never', () => {
    const s = memory();
    expect(takeRvNote('p1', s)).toBe(RV_PRICE_NOTE);
    expect(s.m.get(rvNoteKey('p1'))).toBe('1');
    expect(takeRvNote('p1', s)).toBeNull();
    resetRvNoteForTests(); // a new page load: the stored flag still wins
    expect(takeRvNote('p1', s)).toBeNull();
  });

  it('is per profile', () => {
    const s = memory();
    expect(takeRvNote('p1', s)).not.toBeNull();
    expect(takeRvNote('p2', s)).not.toBeNull();
  });

  it('survives storage that throws', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(takeRvNote('p3', bad)).toBe(RV_PRICE_NOTE);
    expect(takeRvNote('p3', bad)).toBeNull();
    expect(takeRvNote('p4', null)).toBe(RV_PRICE_NOTE);
  });
});
