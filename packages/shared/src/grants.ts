/**
 * Catch-up grants. A feature new arrivals receive on their first day is listed here so someone who
 * already lives in Vila Ipê still gets it: the next time they sign in, a popup offers it.
 * Add a row when a feature ships. `owed` is true only for a profile that missed it; claiming clears that.
 * New arrivals keep their own first-time path (`owed` stays false until they are already home).
 */
import type { Bilingual } from './types.js';
import { FILM, normalizeFilm } from './diary.js';

/** The slice of a profile a catch-up grant reads and writes. */
export interface GrantProfile {
  arrivalIntroDone?: boolean;
  hasCamera?: boolean;
  film?: number;
}

export interface CatchupGrant {
  id: string;
  title: Bilingual;
  body: Bilingual;
  accept: Bilingual;
  later: Bilingual;
  /** True when this profile already lives here and still doesn't have the feature. */
  owed: (p: GrantProfile) => boolean;
  /** Hand the feature over. Called only when `owed` is true. */
  give: (p: GrantProfile) => void;
  notice: Bilingual;
}

/**
 * Júlia's camera and the starter roll. A second call does not add film.
 * The arrival scene and the catch-up popup both go through here.
 */
export function handCamera(p: GrantProfile): void {
  if (p.hasCamera === true) return;
  p.hasCamera = true;
  p.film = Math.min(99, normalizeFilm(p.film) + FILM.starter);
}

// needs_br: true
const CAMERA_GRANT: CatchupGrant = {
  id: 'camera',
  title: { pt: 'Uma câmera pra você', en: 'A camera for you' },
  body: {
    pt: `Você já mora no bairro, então a câmera chega agora. Vêm ${FILM.starter} filmes.`,
    en: `You already live in the neighborhood, so the camera arrives now. It comes with ${FILM.starter} shots of film.`,
  },
  accept: { pt: 'Pegar a câmera', en: 'Take the camera' },
  later: { pt: 'Depois', en: 'Later' },
  owed: (p) => p.arrivalIntroDone === true && p.hasCamera !== true,
  give: handCamera,
  notice: {
    pt: `Júlia te entrega a câmera e ${FILM.starter} filmes.`,
    en: `Júlia hands you the camera and ${FILM.starter} shots of film.`,
  },
};

/** Features a resident can still be missing. One row per feature that shipped after some profiles were saved. */
export const CATCHUP_GRANTS: readonly CatchupGrant[] = [CAMERA_GRANT];

/** What this profile should be offered on the next sign-in, in catalog order. */
export function owedGrants(p: GrantProfile | null | undefined): CatchupGrant[] {
  if (!p) return [];
  return CATCHUP_GRANTS.filter((g) => g.owed(p));
}

/** Give one owed feature. Unknown ids and features they already have change nothing. */
export function claimGrant(p: GrantProfile, id: string): { ok: true; notice: Bilingual } | { ok: false; reason: 'unknown' | 'have' } {
  const grant = CATCHUP_GRANTS.find((g) => g.id === id);
  if (!grant) return { ok: false, reason: 'unknown' };
  if (!grant.owed(p)) return { ok: false, reason: 'have' };
  grant.give(p);
  return { ok: true, notice: grant.notice };
}
