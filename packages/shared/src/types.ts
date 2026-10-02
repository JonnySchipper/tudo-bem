import type { DailyMission } from './ambiance.js';
import type { BjjProgress } from './academia.js';
import type { NpcId } from './rooms.js';
import type { NpcActivity } from './schedules.js';
import type { RecadoState } from './recados.js';

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

/** Fluency band. Driven by the student model, never purchasable. Phase 0: everyone is Verde. */
export type Nameplate = 'verde' | 'amarelo' | 'azul' | 'roxo' | 'dourado';

/** Screen-facing: S = toward camera. SE = moving +x, SW = +y, NE = -y, NW = -x. */
export type Dir = 'SE' | 'SW' | 'NE' | 'NW';

export type RoomId = 'praca' | 'padaria' | 'kitnet' | 'academia';

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
  nameplate: Nameplate;
  x: number;
  y: number;
  dir: Dir;
  sitting: boolean;
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
}

export interface PrivateProfile {
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
  friends: string[];
  tutorial: Record<TutorialStep, boolean>;
  tutorialRewarded: boolean;
  createdAt: number;
  /** Today's kiosk mission (the server rolls it over each day). */
  mission?: DailyMission;
  /** Academia BJJ — earned belt progress (never purchased). */
  bjj?: BjjProgress;
  /** Bag: itemId -> count (Phase 8). Defaulted to {} on load. */
  bag?: Record<string, number>;
  /** Recados state: today's offer, the ones in progress, the ones finished today (Phase 8). */
  recados?: RecadoState;
  /** NPC friendship points 0-100 (10 = 1 heart). */
  bond?: Partial<Record<NpcId, number>>;
  /** NPCs whose 6-heart furniture gift was already handed over (once each). */
  bondGifts?: NpcId[];
  /** Caderno de palavras: per card, how often you saw, heard and used it (Phase 7). Defaulted to {} on load. */
  caderno?: Record<string, { seen: number; heard: number; used: number; firstAt: number }>;
  /** Caderno groups whose one-time RV has already been paid. */
  cadernoPaid?: string[];
  /** Feira purchases that paid RV on `date` (real day, YYYY-MM-DD); the reward has a daily limit (Phase 9). */
  feira?: { date: string; n: number };
  /** One short PT line per NPC about your last Conversa (max 200 chars). Never raw chat. */
  npcMemory?: Partial<Record<NpcId, string>>;
}

export interface Bilingual {
  pt: string;
  en: string;
}
