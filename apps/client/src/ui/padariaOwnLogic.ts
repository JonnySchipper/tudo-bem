/** The owned padaria's house counter, pure: what goes on its menu board and in what order. */
import { COUNTER_PRICES, MG_ITEMS, OWNED_SHELF, cardById, counterMenuForOwned, type PadariaCard } from '@tudobem/shared';

export interface HouseCounterPick {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Only the shared shelf has bag icons; the house specials are drawn as text. */
  icon?: string;
}

/** Every item the house counter sells (the server's `counterMenuForOwned`), the house specials first, then the everyday menu. */
export function houseCounterPicks(card: Pick<PadariaCard, 'size' | 'sweets'>): HouseCounterPick[] {
  const all = counterMenuForOwned(card);
  const special = (id: string) => (OWNED_SHELF as readonly string[]).includes(id);
  return [...all.filter(special), ...all.filter((id) => !special(id))].map((id) => {
    const c = cardById(`lex.padaria.${id}`);
    return {
      id,
      pt: c?.form ?? id,
      en: c?.gloss_en ?? id,
      price: COUNTER_PRICES[id] ?? 0,
      ...(MG_ITEMS.some((i) => i.id === id) ? { icon: id } : {}),
    };
  });
}
