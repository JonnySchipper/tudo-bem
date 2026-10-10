/**
 * Seu Bento's menu lists the boats the player can pay for plus the next one up, so a newcomer never reads the price of the party boat
 * (SIMPLIFICATION-REVIEW D3). The tiers above `pesca` stay implemented; they just wait to be in reach.
 */
import type { BarcoTierRow } from '@tudobem/shared';

/** `rows` in price order. Keeps every affordable row, and the first one the player cannot afford yet. */
export function visibleBoatTiers<T extends Pick<BarcoTierRow, 'canAfford'>>(rows: readonly T[]): T[] {
  const out: T[] = [];
  let next = false;
  for (const row of rows) {
    if (row.canAfford) out.push(row);
    else if (!next) {
      out.push(row);
      next = true;
    }
  }
  return out;
}
