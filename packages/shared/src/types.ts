import type { DailyMission } from './ambiance.js';
import type { CartelaState } from './cartela.js';
import type { StreetSnackId } from './streetSnacks.js';
import type { CounterItemId } from './padaria.js';
import type { BjjProgress, Belt } from './academia.js';
import type { AcademyCard, AcademyGi } from './playerAcademy.js';
import type { PadariaSize } from './playerPadaria.js';
import type { NpcId } from './rooms.js';
import type { NpcActivity } from './schedules.js';
import type { RecadoState } from './recados.js';

/** Left in the hand after you finish a snack or a drink. Not edible. */
export type EmptyCarryId = 'coco_vazio' | 'saquinho_vazio' | 'copinho_vazio' | 'copo_vazio' | 'palito_vazio' | 'palito_picole' | 'sabugo';
/**
 * In hand this session: a praça snack, a padaria order, or the empty it leaves.
 * Hats, birds, and outfits are never carry ids.
 */
export type CarryId = StreetSnackId | CounterItemId | EmptyCarryId;

export type Pronoun = 'ele' | 'ela' | 'nome';
export type BodyType = 'esguio' | 'medio' | 'forte';
export type HairStyle = 'curto' | 'raspado' | 'cacheado' | 'black' | 'longo' | 'coque' | 'trancas' | 'ondulado' | 'undercut';
export type TopStyle = 'camiseta' | 'regata' | 'moletom' | 'camisa' | 'blusa';
export type BottomStyle = 'calca' | 'bermuda' | 'saia';
export type FaceStyle = 'suave' | 'marcante' | 'doce' | 'maduro';
export type ExtraStyle = 'nenhum' | 'oculos' | 'barba' | 'bigode' | 'brincos' | 'sardas';
/** Resting posture. Players stand relaxed; CPUs and NPCs get their own so a crowd never reads as clones. */
export type IdlePose = 'solto' | 'bolsos' | 'bracos' | 'celular' | 'cafe' | 'cintura' | 'bolsa';

export interface Appearance {
  body: BodyType;
  skin: number;
  hair: HairStyle;
  hairColor: number;
  top: TopStyle;
  topColor: number;
  bottom: BottomStyle;
  bottomColor: number;
  shoes: number;
  /** Optional so saves from before the character redesign still load (default suave / nenhum / solto). */
  face?: FaceStyle;
  extra?: ExtraStyle;
  idle?: IdlePose;
  /** Neighbourhood pieces for CPU neighbours only (jersey, backpack, flip-flops...; ids joined by '+', see GARB_IDS). Players never carry one: sanitizeAppearance drops it. */
  garb?: string;
}

/**
 * Nameplate colour: a status earned in the escola by words mastered (verde → amarelo → azul → roxo → dourado, see escola.ts), never
 * purchasable. Only a colour: English help is the player's own setting and does not change with the plate (DECISIONS.md).
 */
export type Nameplate = 'verde' | 'amarelo' | 'azul' | 'roxo' | 'dourado';

/** Screen-facing: S = toward camera. SE = moving +x, SW = +y, NE = -y, NW = -x. */
export type Dir = 'SE' | 'SW' | 'NE' | 'NW';

export type RoomId = 'praca' | 'rua' | 'rua_leste' | 'feira' | 'padaria' | 'kitnet' | 'academia' | 'escola' | 'andar' | 'aeroporto' | 'desembarque' | 'petshop' | 'praia' | 'barco_festa';

export type EmoteKind = 'oi' | 'dancar' | 'rir' | 'valeu' | 'desculpa';

export interface Tile {
  x: number;
  y: number;
}

export interface PublicAvatar {
  id: string;
  name: string;
  pronoun: Pronoun;
  appearance: Appearance;
  hat: string | null;
  parrot: boolean;
  /** Companion tint id when `parrot` is true (defaults to verde). */
  parrotColor?: string | null;
  /** In hand this session: a snack, a drink, or the empty it leaves. Not saved, and never a cosmetic. */
  carry?: CarryId | null;
  /** Wears the academia gi (and belt) in every room after buying at the vestiário. */
  gi?: boolean;
  /**
   * Academy uniform worn on that academy's floor, and only by a member.
   * Guests keep their own look. The personal belt stays on `belt`.
   */
  academyGi?: AcademyGi;
  nameplate: Nameplate;
  x: number;
  y: number;
  dir: Dir;
  sitting: boolean;
  /** The belt earned in the academia (never bought): shown on the profile card and on the gi when worn. Players only. */
  belt?: Belt;
  /** Beta founder chip beside the nameplate. */
  founder?: boolean;
  /** Subscription founder badge (permanent). Separate from belts, nameplates and stripes. */
  founderBadge?: boolean;
  /** Which subscriber pet is out. Absent or null when none is following. */
  pet?: 'dog' | 'cat' | null;
  /** Name on that pet's collar tag. Present only while the pet is out and has a name. */
  petName?: string | null;
  /** The pet's breed and coat (petBreeds.ts ids), its collar and toy (PET_ITEMS ids): set with `pet`, hidden with it (#234). */
  petBreed?: string;
  petCoat?: string;
  petCollar?: string | null;
  petToy?: string | null;
  /** Chat bubble appearance. Classic for anyone without an active subscription. */
  bubbleStyle?: import('./subscription.js').BubbleStyle;
  /**
   * Live "Fada da Feira" crown: today's top Feira-cart score. A display overlay only —
   * it is not a belt, a nameplate tier, or a stripe, and it clears when the board day (UTC) rolls.
   */
  feiraCrown?: boolean;
  /** Praça ambiance CPU (scripted scenery, outside the player cap, never chats). */
  cpu?: boolean;
  /** A neighbour (Seu Carlos, Nanda...) walking its schedule: id is `npc-<id>`, broadcast like a CPU but flagged with its NpcId. */
  npc?: NpcId;
  /** NPC only: where to stand to talk to it (the interact tile of the slot it is on or heading for). */
  npcInteract?: Tile;
  /** NPC only: what it is doing. */
  activity?: NpcActivity;
}

export const NPC_AVATAR_PREFIX = 'npc-';
export const npcAvatarId = (id: NpcId): string => `${NPC_AVATAR_PREFIX}${id}`;
export const isNpcAvatarId = (id: string): boolean => id.startsWith(NPC_AVATAR_PREFIX);

export interface PlacedFurniture {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  rot: 0 | 1;
}

export type TutorialStep =
  | 'andar'
  | 'sentar'
  | 'acenar'
  | 'conversar'
  | 'carlos'
  | 'meveum'
  | 'chapeu'
  | 'cadeira';

export interface FriendInfo {
  id: string;
  name: string;
  online: boolean;
  room: RoomId | null;
  roomName: string | null;
  instanceId: string | null;
  /** Their earned nameplate colour. */
  nameplate?: Nameplate;
}

/** The padaria counter game's progress. Stars unlock tools and set the level; they are earned by playing, never bought. The counter menu grows from completed shifts, not from stars. */
export interface CorreriaProgress {
  stars: number;
  shifts: number;
  best: number;
  /** The player day (YYYY-MM-DD, playerDay.ts `profileDay`) `paid` counts shifts of: only the first few shifts a day pay RV. */
  date?: string;
  paid?: number;
  /** Lesson ids already shown (item ids, plus `where`). Server-owned; a missing list on an old save means they already played the wide counter. */
  taught?: string[];
}

/** One adopted pet (#234, petShop.ts). */
export interface OwnedPet {
  /** `p<base36 time><2 random>`, or `legacy_dog` / `legacy_cat` for the pets an old save had: stable, never reused. */
  id: string;
  species: 'dog' | 'cat';
  /** BreedDef id (petBreeds.ts). */
  breed: string;
  /** CoatOption id of that breed. */
  coat: string;
  /** Moderated like the old pet names (petName.ts), 16 chars max. */
  name: string | null;
  /** PET_ITEMS id of kind `coleira`, or none (the mustard default). */
  collar: string | null;
  /** PET_ITEMS id of kind `brinquedo`. */
  toy: string | null;
  /** Server clock, unix ms. */
  adoptedAt: number;
  /** Migrated from `pet` / `petNames`. */
  legacy?: true;
}

export interface PrivateProfile {
  /** The padaria this player founded (derived by the server from padarias.json each push, never stored on the profile). */
  padaria?: { id: string; name: string; size: PadariaSize };
  id: string;
  name: string;
  pronoun: Pronoun;
  appearance: Appearance;
  nameplate: Nameplate;
  coins: number;
  hats: string[];
  hat: string | null;
  /** Unplaced furniture inventory: itemId -> count */
  furniture: Record<string, number>;
  apartment: PlacedFurniture[];
  parrotOwned: boolean;
  parrotEquipped: boolean;
  /** Owned parrot colour ids (poleiro shop). */
  parrotColors?: string[];
  /** Which colour is out on your shoulder. */
  parrotColor?: string | null;
  /** Bought the kimono at the Academia vestiário; enables the gi look everywhere. */
  giOwned?: boolean;
  friends: string[];
  /** Players this profile blocked: their chat, emotes and friend requests never reach it. Missing on older saves. */
  blocked?: string[];
  tutorial: Record<TutorialStep, boolean>;
  tutorialRewarded: boolean;
  /** The one-time RV gift for first entering your own kitnet has been paid. Missing on older saves. */
  kitnetGiftPaid?: boolean;
  createdAt: number;
  /** Today's kiosk mission (the server rolls it over each day). */
  mission?: DailyMission;
  /** Academia BJJ — earned belt progress (never purchased). */
  bjj?: BjjProgress;
  /** Correria no Balcão progress (stars, shifts, best score, today's paid shifts). Optional and defaulted on load. */
  correria?: CorreriaProgress;
  /** Bag: itemId -> count (Phase 8). Defaulted to {} on load. */
  bag?: Record<string, number>;
  /** Recados state: today's offer, the ones in progress, the ones finished today (Phase 8). */
  recados?: RecadoState;
  /** Recados finished, ever (`recados.done` is only today's): the disclosure ladder reads it. Defaulted on load from today's list. */
  recadosDoneTotal?: number;
  /** NPC friendship points 0-100 (10 = 1 heart). */
  bond?: Partial<Record<NpcId, number>>;
  /** NPCs whose 6-heart furniture gift was already handed over (once each). */
  bondGifts?: NpcId[];
  /** Caderno de palavras: per card, how often you saw, heard and used it (Phase 7). Defaulted to {} on load. */
  caderno?: Record<string, { seen: number; heard: number; used: number; firstAt: number }>;
  /** Caderno groups whose one-time RV has already been paid. */
  cadernoPaid?: string[];
  /** Feira purchases that paid RV on `date` (player day, YYYY-MM-DD, `profileDay`); the reward has a daily limit (Phase 9). */
  feira?: { date: string; n: number };
  /** Bate-papos (pre-made conversations, papos.ts) talked through to the end, by id. Defaulted to [] on load. */
  papos?: string[];
  /**
   * Plane arrival with Júlia. Missing on saves from before the intro means they already live here.
   * New profiles set this false and see the intro once.
   */
  arrivalIntroDone?: boolean;
  /**
   * The arrivals hall (`desembarque`, the guided tutorial before the airport) is done or skipped. Missing on saves from before the hall:
   * those players are never sent there. New profiles set this false.
   */
  desembarqueDone?: boolean;
  /** An admin reset the flight in: the next sign-in plays the plane cutscene again. The server clears it once it has sent it. */
  replayFlight?: boolean;
  /** Júlia's camera. Photographs tagged things into the language diary. */
  hasCamera?: boolean;
  /** Language-diary word ids earned once. */
  diary?: string[];
  /** Fishing at the Praia (PRAIA-PLAN.md 8.1). Missing means "never fished"; `normalizePesca` on load. */
  pesca?: import('./pescaProgress.js').PescaProgress;
  /** Escola: per-word strength (spaced repetition), XP, streak, daily goal and the earned nameplate tier. Defaulted on load. */
  escola?: import('./escola.js').EscolaState;
  /** Film rolls left in the camera. Júlia sells more. */
  film?: number;
  /** Photos taken with the camera, newest first. */
  photos?: { id: string; at: number; image: string; wordId?: string; wordIds?: string[] }[];
  /** Cartela de carimbos do bairro (seven stamps pay RV; persists across sessions). */
  cartela?: CartelaState;
  /** Beta founder badge on the overhead nameplate. Absent on old saves until normalized (treated as true). */
  founder?: boolean;
  /**
   * Permanent Feira medals (gold / silver / bronze), newest last. Written by the server when a board day
   * finalizes; the diary lists them. Absent on saves from before the cart games.
   */
  feiraMedals?: { day: string; game: string; medal: 'gold' | 'silver' | 'bronze'; score: number }[];
  /**
   * Feira cart runs the server accepted, per game id (`tapioca`, `pastel`, `caldo`). The cart games stage their
   * rules on it (Pastel combos from the 3rd run, no burnt block or fire in the 1st; Caldo's short flavour list in the
   * 1st) and the Tapioca practice is skipped once a run is on it. Absent means none.
   */
  feiraRuns?: Partial<Record<string, number>>;
  /** Permanent subscription founder badge. Absent means false. Never revoked. */
  founderBadge?: boolean;
  /** Permanent founders banner already granted. The item itself lives in `furniture`. */
  founderBanner?: boolean;
  /**
   * Species of the active pet: a mirror of `activePet(p)` kept for one release (older clients, scripts). Shown only while the
   * subscription is active.
   */
  pet?: 'dog' | 'cat' | null;
  /** First named dog / cat: a mirror of `pets` kept for one release (the names live on `OwnedPet.name`). */
  petNames?: { dog?: string; cat?: string };
  /** Adopted pets (#234, petShop.ts). Kept forever, also when the subscription lapses. Old saves migrate from `pet` / `petNames`. */
  pets?: OwnedPet[];
  /** The pet out with you (null: everyone is home in the kitnet). */
  activePetId?: string | null;
  /** Collars and toys bought at the lojinha (PET_ITEMS ids, one of each). */
  petItems?: string[];
  /** Subscriber chat-bubble appearance. Reverts to classic when the subscription ends. */
  bubbleStyle?: import('./subscription.js').BubbleStyle;
  /** Support subscription. Absent means never subscribed. */
  subscription?: import('./subscription.js').PlayerSubscription | null;
  /**
   * Set when an admin Testes action changes this profile. Public words, streak, and Feira boards skip it.
   * Absent means a normal player.
   */
  testUser?: boolean;
  /**
   * Calendar days added only when this profile's daily cap keys are computed.
   * Absent means 0. It does not move the shared clock or anyone else's day.
   */
  testDayOffset?: number;
  /**
   * Milliseconds added only to this profile's sky and errand clock.
   * Absent means 0. The neighborhood clock (`clockOffsetMs`) stays put.
   */
  testClockOffsetMs?: number;
  /**
   * Feira cart runs that paid RV on `day` (player day, YYYY-MM-DD, `profileDay`). Every profile counts its own;
   * the public board only ranks scores. Absent means none today.
   */
  feiraPaid?: { day: string; n: number };
  /**
   * Admin test: the HUD plate and the overhead nameplate stay Verde.
   * The earned escola tier is kept and comes back when this is off.
   */
  verdeMode?: boolean;
}

export interface Bilingual {
  pt: string;
  en: string;
}
