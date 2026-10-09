import { describe, expect, it } from 'vitest';
import { HATS, PARROT_COLORS } from '@tudobem/shared';
import { newlyOwned, shortBy, splitStall } from './stallLogic';

describe('market stall panels', () => {
  it('splits owned from for-sale in catalog order', () => {
    const { owned, sale } = splitStall(PARROT_COLORS, ['vermelha', 'verde']);
    expect(owned.map((c) => c.id)).toEqual(['verde', 'vermelha']);
    expect(sale.map((c) => c.id)).toEqual(['azul', 'canarinho', 'periquito']);
  });

  it('every good lands in exactly one group', () => {
    const { owned, sale } = splitStall(HATS, [HATS[1].id]);
    expect(owned.length + sale.length).toBe(HATS.length);
    expect(owned.map((h) => h.id)).toEqual([HATS[1].id]);
  });

  it('only a change after opening counts as a buy moment', () => {
    expect(newlyOwned(null, ['verde'])).toEqual([]);
    expect(newlyOwned(new Set(['verde']), ['verde', 'azul'])).toEqual(['azul']);
    expect(newlyOwned(new Set(['verde', 'azul']), ['verde', 'azul'])).toEqual([]);
  });

  it('says how much RV is missing', () => {
    expect(shortBy(10, 12)).toBe(2);
    expect(shortBy(20, 12)).toBe(0);
    expect(shortBy(0, 0)).toBe(0);
  });

  it('the Puleiro prices are unchanged', () => {
    expect(PARROT_COLORS.map((c) => [c.id, c.price])).toEqual([
      ['verde', 0],
      ['azul', 12],
      ['canarinho', 15],
      ['vermelha', 18],
      ['periquito', 20],
    ]);
  });
});
