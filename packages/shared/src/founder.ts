/**
 * Beta founder badge (free beta). Shown on the nameplate in the world; granted on profile create while enabled,
 * and backfilled for saves that predate the field. Disabling new grants does not remove existing founders.
 */

import type { Bilingual } from './types.js';

/** needs_br: true */
export const FOUNDER_BADGE: Bilingual = { pt: 'Fundador', en: 'Founder' };

/** Legacy profiles without the field count as founders; explicit false is only for accounts created after grants were turned off. */
export function normalizeFounderFlag(founder: boolean | undefined): boolean {
  return founder !== false;
}
