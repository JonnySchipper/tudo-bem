/**
 * The disclosure ladder (SIMPLIFICATION-REVIEW §3): four player stages, a pure function of the profile, and what the HUD shows at each.
 * Every surface waits for the first stage at which it means something; the HUD, the Escola home and the rest read from here instead of
 * scattering their own conditions.
 *
 *  - S0 Arrival: the arrivals hall, the airport and the bus (the hall or the flight is not done yet).
 *  - S1 Newcomer: in the Vila, has not yet ordered from Seu Carlos.
 *  - S2 Resident: has ordered from Seu Carlos and finished at least one recado.
 *  - S3 Regular: 25 diary words, or 3 recados, or a finished Escola lesson, or a gi.
 */

export type Stage = 'S0' | 'S1' | 'S2' | 'S3';

const ORDER: Record<Stage, number> = { S0: 0, S1: 1, S2: 2, S3: 3 };

/** Is `s` at least `min`? */
export const atLeast = (s: Stage, min: Stage): boolean => ORDER[s] >= ORDER[min];

/** The profile fields the ladder reads (a `PrivateProfile` fits). */
export interface DisclosureProfile {
  desembarqueDone?: boolean;
  arrivalIntroDone?: boolean;
  tutorial?: Partial<Record<string, boolean>>;
  recados?: { done?: readonly string[] };
  /** Recados finished, ever (`recados.done` is only today's). */
  recadosDoneTotal?: number;
  diary?: readonly string[];
  escola?: { lessons?: number };
  giOwned?: boolean;
  hats?: readonly string[];
  hasCamera?: boolean;
  cartela?: { stamps?: number; activityDay?: Partial<Record<string, string>> };
  testUser?: boolean;
}

export const S3_DIARY = 25;
export const S3_RECADOS = 3;

/** Recados finished, ever: the lifetime counter, or today's list on a save from before it. */
export const recadosDone = (p: DisclosureProfile): number => Math.max(p.recadosDoneTotal ?? 0, p.recados?.done?.length ?? 0);

/** Escola lessons finished. */
const lessons = (p: DisclosureProfile): number => p.escola?.lessons ?? 0;

/**
 * The player's stage. A save from before the arrivals hall or the flight has no flag for it: those players already live here (the
 * server sets `false` on every new profile), so only an explicit `false` keeps a player in S0.
 */
export function stage(p: DisclosureProfile): Stage {
  if (p.desembarqueDone === false || p.arrivalIntroDone === false) return 'S0';
  const done = recadosDone(p);
  if ((p.diary?.length ?? 0) >= S3_DIARY || done >= S3_RECADOS || lessons(p) >= 1 || !!p.giOwned) return 'S3';
  if (p.tutorial?.carlos === true && done >= 1) return 'S2';
  return 'S1';
}

/** Where the HUD is: solo builds have no accounts (no friends), and only your own kitnet can be decorated. */
export interface HudRoomCtx {
  solo?: boolean;
  ownKitnet?: boolean;
}

/** One flag per HUD element in the §3 table. */
export interface HudShows {
  stage: Stage;
  /** The RV counter. */
  rv: boolean;
  /** Mapa and Diário buttons. */
  map: boolean;
  diary: boolean;
  /** Câmera: once Célia hands it over. */
  camera: boolean;
  /** Favores button (and its tracker). */
  favores: boolean;
  /** Visual (the look editor). */
  look: boolean;
  /** Chapéus: owns a hat, or the hat step at Nanda's stall is done. */
  hats: boolean;
  /** Amigos: multiplayer only. */
  friends: boolean;
  /** Decorar: own kitnet only. */
  decor: boolean;
  /** The emote row sits open on desktop; before this it waits behind the smiley, as on a phone. */
  emotesOpen: boolean;
  /** Ajustes → Guia, Tutorial, Créditos, Apoiar. */
  gearExtras: boolean;
  /** Ajustes → Fala (feedback): always, as a gear entry. */
  fala: boolean;
  /** The `n/cap aqui · n vizinhos` counts after the room name. */
  roomCounts: boolean;
  /** The Verde nameplate chip: a regular who has been to the Escola. */
  plate: boolean;
  /** The Escola Meta XP chip and streak flame: a regular with a finished lesson. */
  goal: boolean;
  /** The Cartela chip: a regular with a stamp. */
  cartela: boolean;
  /** The belt: once there is a gi. */
  belt: boolean;
}

/** Has the Cartela ever stamped (a stamp on the card now, or any activity's last stamp day)? */
const stamped = (p: DisclosureProfile): boolean => (p.cartela?.stamps ?? 0) > 0 || Object.keys(p.cartela?.activityDay ?? {}).length > 0;

/**
 * What the top bar shows. The arrivals hall and the airport show only what their guided steps teach (money, the Diário, the map, the camera);
 * the Vila adds Favores; the rest arrives as it starts to mean something. Test profiles (admin Testes) see everything out of the arrival.
 */
export function hudShows(p: DisclosureProfile, room: HudRoomCtx | null = null): HudShows {
  const s = stage(p);
  const test = !!p.testUser && s !== 'S0';
  const s1 = atLeast(s, 'S1') || test;
  const s2 = atLeast(s, 'S2') || test;
  const s3 = atLeast(s, 'S3') || test;
  const lesson = lessons(p) >= 1 || test;
  return {
    stage: s,
    rv: true,
    map: true,
    diary: true,
    camera: !!p.hasCamera,
    favores: s1,
    look: s2,
    hats: s2 && ((p.hats?.length ?? 0) > 0 || p.tutorial?.chapeu === true || test),
    friends: s2 && !room?.solo,
    decor: !!room?.ownKitnet,
    emotesOpen: s2,
    gearExtras: s2,
    fala: true,
    roomCounts: s2,
    plate: s3 && lesson,
    goal: s3 && lesson,
    cartela: s3 && (stamped(p) || test),
    belt: !!p.giOwned || !!p.testUser,
  };
}
