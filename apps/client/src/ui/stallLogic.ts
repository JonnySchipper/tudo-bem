/**
 * Market-stall panels (Nanda's hats, the Puleiro dos Pássaros): which goods are yours and which are for sale, and which ones you just got,
 * so the card can celebrate it. Pure, so the split and the buy moment are unit tested; the DOM side is `panels.ts`.
 */

export interface StallGood {
  id: string;
  price: number;
}

/** Catalog order kept inside each group: what you own first, then what is still for sale. */
export function splitStall<T extends StallGood>(goods: readonly T[], owned: readonly string[]): { owned: T[]; sale: T[] } {
  const mine = new Set(owned);
  return { owned: goods.filter((g) => mine.has(g.id)), sale: goods.filter((g) => !mine.has(g.id)) };
}

/** Ids owned now that were not owned before (`prev` null: the panel just opened, nothing is new). */
export function newlyOwned(prev: ReadonlySet<string> | null, now: readonly string[]): string[] {
  if (!prev) return [];
  return now.filter((id) => !prev.has(id));
}

/** RV still missing to buy `price` (0 when it is affordable). */
export const shortBy = (coins: number, price: number): number => Math.max(0, price - coins);
