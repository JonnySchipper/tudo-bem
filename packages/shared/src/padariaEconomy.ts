/**
 * Padaria ownership RV prices (MASTER PLAN, locked 2026-10-05).
 *
 * Baseline: a 2★ paid Correria shift = 20 RV (inside the 3-per-day cap, counted on the player's own day).
 */

/** Paid Correria shift payout by star grade (uses a daily cap slot even at 1★). */
export const PADARIA_CORRERIA_SHIFT_RV = { one: 10, two: 20, three: 30 } as const;

/** Absolute RV buys (× 2★ shift in the plan). */
export const PADARIA_OWNERSHIP_RV = {
  fundarDoorHatName: 900,
  tier1Brigadeiro: 300,
  tier2BoloCenoura: 400,
  tier3Sonho: 500,
  chapaDaCasa: 60,
  garrafaDaCasa: 60,
  signStyle: 20,
  trim: 40,
  wallDecor: 40,
  counterDecor: 60,
  renameModerated: 200,
} as const;

/** Door plus all three sweet tiers (excludes optional gear and décor). */
export const PADARIA_DOOR_PLUS_TIERS_RV =
  PADARIA_OWNERSHIP_RV.fundarDoorHatName +
  PADARIA_OWNERSHIP_RV.tier1Brigadeiro +
  PADARIA_OWNERSHIP_RV.tier2BoloCenoura +
  PADARIA_OWNERSHIP_RV.tier3Sonho;

/**
 * Padaria SIZE tiers (Jonny lock — ownership v1 ships all three). Separate from sweet tiers.
 * - Balcão (900 RV): starter owned shelf — coffee + pão francês only.
 * - Padaria (1500 RV): full menu like Seu Carlos’s shared counter.
 * - Restaurante (3000 RV): restaurant food on the owner’s counter.
 */
export const PADARIA_SIZE_RV = {
  balcao: 900,
  padaria: 1500,
  restaurante: 3000,
} as const;

/** The padaria door's savings meter and the Fundar copy wait until the player has seen this much RV (SIMPLIFICATION-REVIEW D3). */
export const PADARIA_DOOR_METER_MIN_RV = 300;

/** Does the padaria door show its meter and Fundar copy? Owners always see their own door; everyone else waits for 300 RV. */
export function padariaDoorShowsMeter(coins: number, owned: boolean): boolean {
  return owned || coins >= PADARIA_DOOR_METER_MIN_RV;
}

/**
 * Beta flag (SIMPLIFICATION-REVIEW D3): endgame options kept out of the beta build's menus. The rules and prices stay; only the
 * menus read these. Flip a key to false to bring the option back.
 */
export const BETA_HIDE = {
  /** The Restaurante size (3000 RV) in the owner menu. */
  padariaSize3: true,
  /** House gear (chapa, garrafa) in the owner menu. */
  padariaGear: true,
  /** Sign, trim and décor tiers in the owner menu. */
  padariaDecor: true,
  /** The crest and gi editor of a player academy (its owner sees the team card instead). */
  academyLook: true,
} as const;

export type BetaHide = { readonly [K in keyof typeof BETA_HIDE]: boolean };

/** What the padaria owner menu lists: the size tiers, and whether the gear and décor shelves are drawn. */
export function padariaOwnerMenu(hide: BetaHide = BETA_HIDE): { sizes: readonly (1 | 2 | 3)[]; gear: boolean; decor: boolean } {
  return { sizes: hide.padariaSize3 ? [1, 2] : [1, 2, 3], gear: !hide.padariaGear, decor: !hide.padariaDecor };
}
