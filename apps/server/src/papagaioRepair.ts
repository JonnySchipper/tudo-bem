import { normalizeEmail, ownedParrotColorIds, parrotColorById } from '@tudobem/shared';
import type { ProfileStore, StoredProfile } from './store.js';

/**
 * Support repairs for poleiro purchases that were lost before the colour list was fixed.
 * Idempotent: missing colours are added, and a bird they are already wearing stays on the shoulder.
 */
export const PAPAGAIO_REPAIRS: readonly { email: string; colors: readonly string[]; equip: string }[] = [
  { email: 'rafaellaschipper@gmail.com', colors: ['verde', 'azul'], equip: 'azul' },
];

export function repairPapagaios(
  profileIdForEmail: (email: string) => string | undefined,
  store: Pick<ProfileStore, 'get' | 'save' | 'flush'>,
): string[] {
  const fixed: string[] = [];
  for (const row of PAPAGAIO_REPAIRS) {
    const p = store.get(profileIdForEmail(normalizeEmail(row.email)) ?? '');
    if (!p || !grantPapagaio(p, row.colors, row.equip)) continue;
    fixed.push(row.email);
  }
  if (fixed.length) {
    store.save();
    store.flush();
  }
  return fixed;
}

/** Add `colors` and, when nothing valid is worn, equip `equip`. Returns whether the profile changed. */
export function grantPapagaio(p: StoredProfile, colors: readonly string[], equip: string): boolean {
  const owned = ownedParrotColorIds(p);
  for (const id of colors) if (!owned.includes(id)) owned.push(id);
  const wearingId = parrotColorById(p.parrotColor)?.id;
  const wearing = !!wearingId && owned.includes(wearingId);
  const nextColor = wearing ? wearingId : equip;
  const nextEquipped = wearing ? p.parrotEquipped : true;
  const same =
    p.parrotOwned === true &&
    p.parrotEquipped === nextEquipped &&
    p.parrotColor === nextColor &&
    Array.isArray(p.parrotColors) &&
    p.parrotColors.length === owned.length &&
    owned.every((id, i) => p.parrotColors![i] === id);
  if (same) return false;
  p.parrotColors = owned;
  p.parrotOwned = true;
  p.parrotColor = nextColor;
  p.parrotEquipped = nextEquipped;
  return true;
}
