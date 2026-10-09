/**
 * Whether this profile has already heard Júlia say who she is.
 * Friendship points live on the profile. The browser flag covers the same profile before that save is what the next talk reads.
 */
import { juliaAlreadyMet, juliaMetKey } from '@tudobem/shared';
import { game } from '../state';

function remembered(profileId: string | undefined): boolean {
  if (!profileId || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(juliaMetKey(profileId)) === '1';
  } catch {
    return false;
  }
}

/** True once this profile has met her: bond already saved, or the intro was shown on this browser. */
export function profileMetJulia(): boolean {
  const p = game.profile;
  return juliaAlreadyMet({ bond: p?.bond?.julia, remembered: remembered(p?.id) });
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
