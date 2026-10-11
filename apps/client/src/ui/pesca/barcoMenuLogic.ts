/**
 * Seu Bento's menu lists the boats the player can pay for plus the next one up, so a newcomer never reads the price of the party boat
 * (SIMPLIFICATION-REVIEW D3). The tiers above `pesca` stay implemented; they just wait to be in reach.
 */
import type { BarcoTierRow } from '@tudobem/shared';
import { MAX_CONTENT_CHIPS } from '../dialogueLogic';

/**
 * `rows` in price order. Keeps the affordable rows and the first one the player cannot afford yet, at most `max` of them (the box's content
 * chips: 3, or 2 beside "Devolver o barco", so "Agora não" always fits). When that is too many, the cheapest go first: the next boat up and
 * the best ones in reach stay.
 */
export function visibleBoatTiers<T extends Pick<BarcoTierRow, 'canAfford'>>(rows: readonly T[], max = MAX_CONTENT_CHIPS): T[] {
  const out: T[] = [];
  let next = false;
  for (const row of rows) {
    if (row.canAfford) out.push(row);
    else if (!next) {
      out.push(row);
      next = true;
    }
  }
  return max > 0 ? out.slice(-max) : [];
}

/** How many boat chips fit: the content chips less "Devolver o barco" while a trip is running. */
export const boatChipRoom = (trip: boolean): number => MAX_CONTENT_CHIPS - (trip ? 1 : 0);
