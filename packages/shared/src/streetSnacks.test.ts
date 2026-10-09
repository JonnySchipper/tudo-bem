import { describe, expect, it } from 'vitest';
import { HOTSPOTS } from './hotspots.js';
import { LEITE_CONDENSADO_RV, snackAddon, snackById, snacksAt, STREET_SNACKS } from './streetSnacks.js';

describe('praça pipoca', () => {
  it('sells salty popcorn for 5 RV, sweet for 7, and condensed milk only on the sweet one', () => {
    const menu = snacksAt('pipoqueiro');
    expect(menu.map((s) => [s.id, s.price, s.icon])).toEqual([
      ['pipoca_salgada', 5, 'pipoca_salgada'],
      ['pipoca_doce', 7, 'pipoca'],
    ]);
    expect(snackAddon('pipoca_salgada')).toBeUndefined();
    const leite = snackAddon('pipoca_doce');
    expect(leite).toMatchObject({ id: 'pipoca_doce_leite', price: 10, icon: 'pipoca_leite', addonOf: 'pipoca_doce' });
    expect(leite!.price).toBe(7 + LEITE_CONDENSADO_RV);
    expect(STREET_SNACKS.some((s) => s.addonOf === 'pipoca_salgada')).toBe(false);
    expect(snackById('pipoca')?.id).toBe('pipoca_salgada');
    expect(snackById('pipoca_salgada_leite')).toBeUndefined();
  });

  it('keeps coconut water at 7 RV and prints the same prices on the cart board', () => {
    expect(snacksAt('carrinho_coco').map((s) => [s.id, s.price])).toEqual([['agua_de_coco', 7]]);
    const sign = HOTSPOTS.find((h) => h.id === 'pipoqueiro_placa')!;
    expect(sign.pt).toContain('Salgada R$ 5');
    expect(sign.pt).toContain('Doce R$ 7');
    expect(sign.pt).toContain('Leite condensado +R$ 3 (na doce)');
    expect(sign.en).toContain('sweet only');
  });
});
