/**
 * Padaria ownership RV prices (MASTER PLAN, locked 2026-10-05). Future slices spend these;
 * Slice 1 has no purchase UI — constants only for shared economy work later.
 *
 * Baseline: a 2★ paid Correria shift = 20 RV (inside the 3-per-day UTC cap).
 */

/** Paid Correria shift payout by star grade (uses a daily cap slot even at 1★). */
export const PADARIA_CORRERIA_SHIFT_RV = { one: 10, two: 20, three: 30 } as const;

/** Absolute RV buys (× 2★ shift in the plan). Fundar and tiers are not in Slice 1. */
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
 * Padaria SIZE tiers (Jonny addendum — not Slice 1; no RV numbers locked yet).
 * Separate from sweet tiers (brigadeiro / bolo / sonho). Future ownership buys only:
 * - Size 1 (starter after Fundar): shelf is coffee + pão francês only.
 * - Size 2 (expensive RV upgrade): full menu like Seu Carlos’s shared counter.
 * - Size 3 (very expensive): restaurant food unlocked on the owner’s counter.
 */
export const PADARIA_SIZE_TIERS_NOTE = 'size-1-starter | size-2-full-counter | size-3-restaurant' as const;
