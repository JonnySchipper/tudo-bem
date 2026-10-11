/**
 * Whether this profile has already heard Júlia say who she is.
 * Friendship points live on the profile. The browser flag covers the same profile before that save is what the next talk reads.
 */
import { juliaAlreadyMet, juliaMetKey } from '@tudobem/shared';
import { game } from '../state';
import { atLeast, stage, type DisclosureProfile } from './disclosure';

function remembered(profileId: string | undefined): boolean {
  if (!profileId || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(juliaMetKey(profileId)) === '1';
  } catch {
    return false;
  }
}

/** The profile fields that show Júlia was met. */
export type JuliaMetProfile = DisclosureProfile & { bond?: Partial<Record<string, number>> };

/**
 * Pure: met once the bond is saved or this browser played the intro, and also on a profile that is plainly past her (a resident, a recado
 * ever finished, or Seu Carlos done), so a veteran on a new browser is not sent back to her.
 */
export function metJulia(p: JuliaMetProfile | null | undefined, rememberedHere: boolean): boolean {
  if (juliaAlreadyMet({ bond: p?.bond?.julia, remembered: rememberedHere })) return true;
  if (!p) return false;
  return atLeast(stage(p), 'S2') || (p.recadosDoneTotal ?? 0) > 0 || p.tutorial?.carlos === true;
}

/** True once this profile has met her (`metJulia` on the current profile and this browser's flag). */
export function profileMetJulia(): boolean {
  const p = game.profile;
  return metJulia(p, remembered(p?.id));
}

/** Call when the introduction is about to play, so the next talk on this profile skips it. */
export function rememberJuliaMet(): void {
  const id = game.profile?.id;
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(juliaMetKey(id), '1');
  } catch {
    /* private mode: the saved bond still counts on the next visit */
  }
}
