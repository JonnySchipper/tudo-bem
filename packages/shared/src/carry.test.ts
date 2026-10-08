import { describe, expect, it } from 'vitest';
import { COUNTER_MENU } from './padaria.js';
import { STREET_SNACKS } from './streetSnacks.js';
import { CARRY, carryAction, carryOf, carryTossNotice } from './carry.js';

describe('carry', () => {
  it('classifies every snack and counter item, and the empty it leaves', () => {
    expect(STREET_SNACKS.map((s) => s.id).every((id) => carryOf(id) && carryOf(id)!.kind !== 'trash')).toBe(true);
    expect(COUNTER_MENU.every((id) => carryOf(id) && carryOf(id)!.kind !== 'trash')).toBe(true);

    expect(carryOf('pipoca_salgada')).toMatchObject({ kind: 'food', leaves: 'saquinho_vazio' });
    expect(carryOf('pipoca_doce')?.leaves).toBe('saquinho_vazio');
    expect(carryOf('pipoca_doce_leite')?.leaves).toBe('saquinho_vazio');
    expect(carryOf('agua_de_coco')).toMatchObject({ kind: 'drink', leaves: 'coco_vazio' });
    expect(carryOf('cafezinho')?.leaves).toBe('copinho_vazio');
    expect(carryOf('cafe')?.leaves).toBe('copinho_vazio');
    expect(carryOf('cafe_com_leite')?.leaves).toBe('copinho_vazio');
    expect(carryOf('suco_de_laranja')?.leaves).toBe('copo_vazio');
    expect(carryOf('agua')?.leaves).toBe('copo_vazio');
    expect(carryOf('pao_de_queijo')).toMatchObject({ kind: 'food', leaves: null });
    expect(carryOf('coxinha')).toMatchObject({ kind: 'food', leaves: null });
    expect(carryOf('pao_na_chapa')).toMatchObject({ kind: 'food', leaves: null });

    for (const id of ['coco_vazio', 'saquinho_vazio', 'copinho_vazio', 'copo_vazio'] as const) {
      expect(carryOf(id)).toMatchObject({ kind: 'trash', leaves: null });
      expect(carryAction(id)).toEqual({ action: 'toss', pt: 'Jogar fora', en: 'Throw away' });
    }
    expect(Object.keys(CARRY)).toHaveLength(16);
  });

  it('labels Comer, Beber, and Jogar fora, and ignores cosmetics', () => {
    expect(carryAction('coxinha')).toEqual({ action: 'consume', pt: 'Comer', en: 'Eat' });
    expect(carryAction('pao_de_queijo')).toEqual({ action: 'consume', pt: 'Comer', en: 'Eat' });
    expect(carryAction('agua')).toEqual({ action: 'consume', pt: 'Beber', en: 'Drink' });
    expect(carryAction('agua_de_coco')).toEqual({ action: 'consume', pt: 'Beber', en: 'Drink' });
    expect(carryAction('cafezinho')).toEqual({ action: 'consume', pt: 'Beber', en: 'Drink' });
    expect(carryTossNotice('coco_vazio')).toEqual({ pt: 'Jogou fora o coco vazio', en: 'Tossed the empty coconut' });
    expect(carryTossNotice('saquinho_vazio')).toEqual({ pt: 'Jogou fora o saquinho vazio', en: 'Tossed the empty popcorn bag' });

    for (const id of ['bone_verde', 'parrot', 'camiseta', 'calca', 'gi', 'moletom', null, '']) {
      expect(carryOf(id)).toBeUndefined();
      expect(carryAction(id)).toBeNull();
    }
  });

  it('points empties at an icon that is already on a full item', () => {
    expect(carryOf('coco_vazio')?.tex).toBe('agua_de_coco');
    expect(carryOf('saquinho_vazio')?.tex).toBe('pipoca_salgada');
    expect(carryOf('copinho_vazio')?.tex).toBe('cafezinho');
    expect(carryOf('copo_vazio')?.tex).toBe('agua');
    expect(carryOf('pipoca_doce')?.tex).toBe('pipoca_doce');
  });
});
