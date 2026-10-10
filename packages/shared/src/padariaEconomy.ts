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
