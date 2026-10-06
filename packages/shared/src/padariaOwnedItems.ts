/**
 * Correria / counter items sold only in player-owned padarias (not on Seu Carlos’s shared shelf).
 * needs_br: true on every new Portuguese string.
 */
import { cardById, type Card } from './cards.js';
import { registerOwnedMgLookup, type MgItem } from './meveum.js';

export const OWNED_SHELF = [
  'brigadeiro',
  'bolo_de_cenoura',
  'sonho',
  'prato_feito',
  'arroz_feijao',
  'bife_acebolado',
  'salada',
  'feijoada',
  'pudim',
] as const;

export type OwnedShelfId = (typeof OWNED_SHELF)[number];

function ownedCard(id: OwnedShelfId): Card {
  const c = cardById(`lex.padaria.${id}`);
  if (!c) throw new Error(`Owned padaria item without card: ${id}`);
  return c;
}

export const OWNED_MG_ITEMS: MgItem[] = OWNED_SHELF.map((id) => ({ id, card: ownedCard(id) }));

export const ownedMgItemById = (id: string): MgItem | undefined => OWNED_MG_ITEMS.find((i) => i.id === id);

registerOwnedMgLookup(ownedMgItemById);

/** Diary word ids stamped when a guest orders the sweet (ordering flow, not Correria-only). */
export const SWEET_WORD_IDS: Record<'brigadeiro' | 'bolo_de_cenoura' | 'sonho', string> = {
  brigadeiro: 'lex.padaria.brigadeiro',
  bolo_de_cenoura: 'lex.padaria.bolo_de_cenoura',
  sonho: 'lex.padaria.sonho',
};
