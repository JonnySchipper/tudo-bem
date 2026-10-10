import { describe, expect, it } from 'vitest';
import { visibleBoatTiers } from './barcoMenuLogic';

const rows = (...afford: boolean[]) => afford.map((canAfford, i) => ({ tier: `t${i}`, canAfford }));

describe('Bento menu tiers', () => {
  it('lists the affordable boats plus the next one', () => {
    expect(visibleBoatTiers(rows(true, false, false, false)).map((r) => r.tier)).toEqual(['t0', 't1']);
    expect(visibleBoatTiers(rows(true, true, false, false)).map((r) => r.tier)).toEqual(['t0', 't1', 't2']);
  });
  it('shows everything once everything is affordable', () => {
    expect(visibleBoatTiers(rows(true, true, true, true))).toHaveLength(4);
  });
  it('a broke player still sees the cheapest boat, and only that', () => {
    expect(visibleBoatTiers(rows(false, false, false, false)).map((r) => r.tier)).toEqual(['t0']);
  });
});
