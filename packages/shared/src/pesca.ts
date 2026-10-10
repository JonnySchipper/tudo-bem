/**
 * Fishing at the Praia (PRAIA-PLAN.md 2.3): the waters, the boat tiers and the player's fishing progress. The fight itself is in
 * `pescaSim.ts`, the species in `fish.ts`, the per-water word lists in `pescaWords.ts`.
 */

/** Where a cast lands. `praia` and `lagoa` are free; the others need a rented boat (or the party boat's roster for `festa`). */
export type WaterId = 'praia' | 'lagoa' | 'remo' | 'pesca' | 'alto_mar' | 'festa';
export const WATER_IDS: readonly WaterId[] = ['praia', 'lagoa', 'remo', 'pesca', 'alto_mar', 'festa'];
export const isWaterId = (v: unknown): v is WaterId => typeof v === 'string' && (WATER_IDS as readonly string[]).includes(v);

/** The rental ladder at Bento's (`festa` is the party boat, paid by its host). */
export type BoatTier = 'remo' | 'pesca' | 'alto_mar' | 'festa';
export const BOAT_TIERS: readonly BoatTier[] = ['remo', 'pesca', 'alto_mar', 'festa'];
export const isBoatTier = (v: unknown): v is BoatTier => typeof v === 'string' && (BOAT_TIERS as readonly string[]).includes(v);
/** The solo boats (one player, one trip). */
export const SOLO_TIERS: readonly BoatTier[] = ['remo', 'pesca', 'alto_mar'];

/** A free water needs nothing; a boat's water needs that tier's trip. */
export const isFreeWater = (w: WaterId): boolean => w === 'praia' || w === 'lagoa';
