/**
 * What you can eat, drink, or throw away from your hand.
 * Hats, birds, and outfits are not in this table, so they never get a Comer / Beber / Jogar fora action.
 */
import type { CarryId, EmptyCarryId } from './types.js';

export type CarryKind = 'food' | 'drink' | 'trash';

export interface CarryDef {
  id: CarryId;
  kind: CarryKind;
  /** What stays in the hand after Comer / Beber. Finger food leaves nothing; empties are not eaten. */
  leaves: EmptyCarryId | null;
  /** Phrase after "Jogou fora" / "Tossed". */
  tossPt: string;
  tossEn: string;
  /** `carry:<tex>` texture, from the `icons/<tex>` art. Empties have their own drawn icon (crumpled bag, drained coconut, cups). */
  tex: string;
}

export interface CarryAction {
  action: 'consume' | 'toss';
  pt: string;
  en: string;
}

const food = (id: CarryId, leaves: EmptyCarryId | null, tossPt: string, tossEn: string): CarryDef => ({
  id,
  kind: 'food',
  leaves,
  tossPt,
  tossEn,
  tex: id,
});

const drink = (id: CarryId, leaves: EmptyCarryId, tossPt: string, tossEn: string): CarryDef => ({
  id,
  kind: 'drink',
  leaves,
  tossPt,
  tossEn,
  tex: id,
});

const trash = (id: EmptyCarryId, tossPt: string, tossEn: string): CarryDef => ({
  id,
  kind: 'trash',
  leaves: null,
  tossPt,
  tossEn,
  tex: id,
});

export const CARRY: Record<CarryId, CarryDef> = {
  pipoca_salgada: food('pipoca_salgada', 'saquinho_vazio', 'a pipoca salgada', 'the salty popcorn'),
  pipoca_doce: food('pipoca_doce', 'saquinho_vazio', 'a pipoca doce', 'the sweet popcorn'),
  pipoca_doce_leite: food('pipoca_doce_leite', 'saquinho_vazio', 'a pipoca com leite condensado', 'the sweet popcorn'),
  pao_de_queijo: food('pao_de_queijo', null, 'o pão de queijo', 'the cheese bread'),
  coxinha: food('coxinha', null, 'a coxinha', 'the coxinha'),
  pao_na_chapa: food('pao_na_chapa', null, 'o pão na chapa', 'the grilled bread'),
  agua_de_coco: drink('agua_de_coco', 'coco_vazio', 'a água de coco', 'the coconut water'),
  cafezinho: drink('cafezinho', 'copinho_vazio', 'o cafezinho', 'the little coffee'),
  cafe: drink('cafe', 'copinho_vazio', 'o café', 'the coffee'),
  cafe_com_leite: drink('cafe_com_leite', 'copinho_vazio', 'o café com leite', 'the coffee with milk'),
  suco_de_laranja: drink('suco_de_laranja', 'copo_vazio', 'o suco de laranja', 'the orange juice'),
  agua: drink('agua', 'copo_vazio', 'a água', 'the water'),
  coco_vazio: trash('coco_vazio', 'o coco vazio', 'the empty coconut'),
  saquinho_vazio: trash('saquinho_vazio', 'o saquinho vazio', 'the empty popcorn bag'),
  copinho_vazio: trash('copinho_vazio', 'o copinho vazio', 'the empty little cup'),
  copo_vazio: trash('copo_vazio', 'o copo vazio', 'the empty cup'),
};

export const CARRY_YUM = { pt: 'Que delícia!', en: 'Delicious!' } as const;
export const CARRY_BIN = { pt: 'Lixo no lixo!', en: 'Trash in the trash!' } as const;

export function carryOf(id: string | null | undefined): CarryDef | undefined {
  if (!id || !Object.hasOwn(CARRY, id)) return undefined;
  return CARRY[id as CarryId];
}

/** The one hand action. Null for cosmetics and for anything you are not holding. */
export function carryAction(id: string | null | undefined): CarryAction | null {
  const held = carryOf(id);
  if (!held) return null;
  if (held.kind === 'food') return { action: 'consume', pt: 'Comer', en: 'Eat' };
  if (held.kind === 'drink') return { action: 'consume', pt: 'Beber', en: 'Drink' };
  return { action: 'toss', pt: 'Jogar fora', en: 'Throw away' };
}

export function carryTossNotice(id: string): { pt: string; en: string } | null {
  const held = carryOf(id);
  if (!held) return null;
  return { pt: `Jogou fora ${held.tossPt}`, en: `Tossed ${held.tossEn}` };
}
