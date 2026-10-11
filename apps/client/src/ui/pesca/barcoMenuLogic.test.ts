import { describe, expect, it } from 'vitest';
import { boatChipRoom, visibleBoatTiers } from './barcoMenuLogic';
import { MAX_CHIPS } from '../dialogueLogic';

const rows = (...afford: boolean[]) => afford.map((canAfford, i) => ({ tier: `t${i}`, canAfford }));
const tiers = (r: { tier: string }[]) => r.map((x) => x.tier);

describe('Bento menu tiers', () => {
  it('lists the affordable boats plus the next one', () => {
    expect(tiers(visibleBoatTiers(rows(true, false, false, false)))).toEqual(['t0', 't1']);
    expect(tiers(visibleBoatTiers(rows(true, true, false, false)))).toEqual(['t0', 't1', 't2']);
  });
  it('every boat affordable and no trip: 3 boats (the dearest), so "Agora não" is the 4th chip', () => {
    const boats = visibleBoatTiers(rows(true, true, true, true), boatChipRoom(false));
    expect(tiers(boats)).toEqual(['t1', 't2', 't3']);
    expect(boats.length + 1).toBeLessThanOrEqual(MAX_CHIPS);
  });
  it('a trip running: "Devolver", 2 boats keeping the next one up (the party boat), and "Agora não"', () => {
    const boats = visibleBoatTiers(rows(true, true, false, false), boatChipRoom(true));
    expect(tiers(boats)).toEqual(['t1', 't2']);
    expect(tiers(visibleBoatTiers(rows(true, true, true, false), boatChipRoom(true)))).toEqual(['t2', 't3']);
    expect(1 + boats.length + 1).toBeLessThanOrEqual(MAX_CHIPS);
  });
  it('a broke player still sees the cheapest boat, and only that', () => {
    expect(tiers(visibleBoatTiers(rows(false, false, false, false)))).toEqual(['t0']);
    expect(tiers(visibleBoatTiers(rows(false, false, false, false), boatChipRoom(true)))).toEqual(['t0']);
  });
});
