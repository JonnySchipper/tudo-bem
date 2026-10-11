import { describe, expect, it } from 'vitest';
import { COUNTER_PRICES, counterMenuForOwned } from '@tudobem/shared';
import { houseCounterPicks } from './padariaOwnLogic';
import { MAX_CONTENT_CHIPS } from './dialogueLogic';

describe('the owned padaria house counter board', () => {
  it('a size-2 padaria with every sweet puts all of its menu on the board, more than the box has chips for', () => {
    const card = { size: 2 as const, sweets: { brigadeiro: true, boloCenoura: true, sonho: true } };
    const picks = houseCounterPicks(card);
    expect(picks.length).toBeGreaterThan(MAX_CONTENT_CHIPS);
    expect(picks.map((p) => p.id).sort()).toEqual([...counterMenuForOwned(card)].sort());
    // the everyday things a visitor comes for are on it, priced like the server charges
    for (const id of ['coxinha', 'cafe', 'pastel', 'pao_de_queijo', 'guarana']) {
      const p = picks.find((x) => x.id === id);
      expect(p, id).toBeTruthy();
      expect(p!.price).toBe(COUNTER_PRICES[id]);
      expect(p!.icon).toBe(id);
    }
  });

  it('the house specials lead, then the everyday menu; specials have no bag icon', () => {
    const picks = houseCounterPicks({ size: 3, sweets: { sonho: true } });
    const firstEveryday = picks.findIndex((p) => p.id === 'coxinha');
    expect(picks.slice(0, firstEveryday).map((p) => p.id)).toEqual(['prato_feito', 'arroz_feijao', 'bife_acebolado', 'salada', 'feijoada', 'pudim', 'sonho']);
    expect(picks.slice(0, firstEveryday).every((p) => p.icon === undefined && p.price > 0)).toBe(true);
    expect(picks.find((p) => p.id === 'sonho')?.pt).toBe('sonho');
  });

  it('a size-1 corner sells coffee and bread', () => {
    expect(houseCounterPicks({ size: 1, sweets: {} }).map((p) => p.id)).toEqual(['cafe', 'pao']);
  });
});
