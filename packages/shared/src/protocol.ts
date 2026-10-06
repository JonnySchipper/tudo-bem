import type {
  Appearance,
  Bilingual,
  EmoteKind,
  FriendInfo,
  PlacedFurniture,
  PrivateProfile,
  Pronoun,
  PublicAvatar,
  RoomId,
  Tile,
  TutorialStep,
} from './types.js';
import type { SceneView } from './carlos.js';
import type { CAct, CEvent, CorreriaSnap, UnlockId } from './correria.js';
import type { SafetyAction } from './safety.js';
import type { NpcId } from './rooms.js';
import type { ConversaGrade, ConversaMeter, ConversaScores, ConversaSubject } from './conversa.js';
import type { BjjPositionId, BjjProgress, BoutReason, BoutWinner, Belt, PartnerId } from './academia.js';
import type { AcademyCard, CrestId, GiColorId, GiStampId } from './playerAcademy.js';
import type { PadariaCard, PadariaDoorState, PadariaUpgradeKind } from './playerPadaria.js';
import type { BoutAnswer, ChallengeView } from './challenges.js';
import type { ExchangeEvent, IntentId, RefSignal, Score } from './bout.js';
import type { RecadoActiveView, RecadoOfferView } from './recados.js';
import type { CartelaActivity } from './cartela.js';
import type { PriceOption, VendorId } from './feira.js';
import type { Weather } from './weather.js';

/** Client → server messages. JSON over a single WebSocket at /ws. */
export type ClientMsg =
  | { t: 'hello'; token?: string }
  | { t: 'createProfile'; name: string; pronoun: Pronoun; appearance: Appearance }
  /** Real player input (pointer / key / touch) since the last report. Resets the server idle clock; `ping` never does. */
  | { t: 'active' }
  | { t: 'updateAppearance'; appearance: Appearance }
  | { t: 'join'; room: RoomId; instanceId?: string; ownerId?: string; padariaId?: string }
  | { t: 'move'; x: number; y: number; sit?: boolean }
  | { t: 'stand' }
  | { t: 'emote'; kind: EmoteKind }
  | { t: 'chat'; text: string }
  | { t: 'report'; targetId: string; text?: string }
  | { t: 'portal'; portalId: string }
  | { t: 'scene'; action: 'start'; npc: NpcId }
  | { t: 'scene'; action: 'choose'; chip: number }
  | { t: 'scene'; action: 'type'; text: string }
  | { t: 'scene'; action: 'close' }
  | { t: 'conversa'; action: 'start'; npc: NpcId; subjectId?: string }
  | { t: 'conversa'; action: 'say'; text: string }
  | { t: 'conversa'; action: 'chip'; chip: number }
  | { t: 'conversa'; action: 'close' }
  | { t: 'mg'; action: 'start' }
  /** One step at the counter (Correria no Balcão): grab, grill, pour, pack, serve, answer… the server judges it. */
  | { t: 'mg'; action: 'act'; act: CAct }
  | { t: 'mg'; action: 'quit' }
  | { t: 'mg'; action: 'sync' }
  | { t: 'buy'; kind: 'hat' | 'furniture' | 'parrot' | 'gi'; itemId: string }
  | { t: 'snack'; action: 'buy'; itemId: string }
  /** Order at the padaria counter (the baker on duty): pay, carry it, and it goes in the bag. */
  | { t: 'padaria'; action: 'buy'; itemId: string }
  | { t: 'equipHat'; hatId: string | null }
  | { t: 'parrot'; action: 'adopt' | 'toggle' | 'hint' | 'color'; colorId?: string }
  | { t: 'furniture'; action: 'place'; itemId: string; x: number; y: number; rot: 0 | 1 }
  | { t: 'furniture'; action: 'move'; uid: string; x: number; y: number; rot: 0 | 1 }
  | { t: 'furniture'; action: 'pickup'; uid: string }
  | { t: 'friend'; action: 'request' | 'accept' | 'decline' | 'remove'; targetId: string }
  | { t: 'friends' }
  | { t: 'mission'; action: 'take' }
  /** Hand one recado's worth of an item from the bag to an NPC standing next to you. */
  | { t: 'give'; npc: NpcId; itemId: string }
  /** Read a sign (a hotspot id from HOTSPOTS), within 3 tiles. */
  | { t: 'read'; hotspotId: string }
  /** The player opened the greeting dialogue with an NPC that has no Conversa (Nanda, Júlia): fires the recado engine's `talked` event. */
  | { t: 'talk'; npc: NpcId }
  | { t: 'recados'; action: 'accept' | 'list'; id?: string }
  /** The feira (Phase 9): ask a vendor the price of one good, then pay for a quantity with tray pieces (centavos: 50, 100, 200, 500, 1000, 2000). */
  | { t: 'feira'; action: 'price'; vendor: VendorId; itemId: string }
  | { t: 'feira'; action: 'pay'; vendor: VendorId; itemId: string; qty: number; paid: number[] }
  /** The player played 🔊 for these cards (Caderno). At most 10 known card ids; rate-limited per session. */
  | { t: 'heard'; cardIds: string[] }
  /**
   * Finish the plane arrival: Júlia gives the camera and the cartela, and the card's own words go into the diary. Once.
   * `replay` watches it again (accounts from before the intro never saw it): only the card's missing words.
   */
  | { t: 'arrival'; action: 'finish' | 'replay' }
  /**
   * Claim a catch-up grant: a feature that shipped after this player already lived here.
   * The server hands it over only when the profile is still owed it (`owedGrants`).
   */
  | { t: 'grant'; id: string }
  /**
   * Take a photo. `anchors` are the camera objects inside the viewfinder (props, wall spots, placed furniture); every camera word they
   * teach is given, in the order named. `image` is a small jpeg of the frame. Every shot spends one film, except one in the airport
   * hall (`hall`: a postcard of the arrival, free, only its own objects).
   */
  | { t: 'diary'; action: 'photo'; anchor?: string; anchors?: string[]; image?: string; hall?: boolean }
  /** Read a sign in the airport hall of the arrival. */
  | { t: 'diary'; action: 'sign'; anchor: string }
  /** Buy a pack of film from Júlia. Virtual RV only. */
  | { t: 'diary'; action: 'buyFilm' }
  /** Heard an NPC line (`npc.node`) that can teach a conversation word. */
  | { t: 'diary'; action: 'line'; anchor: string }
  /** Start the practice game in the room you're in (the escola). */
  | { t: 'diary'; action: 'practice' }
  /** Answer the practice round the server just dealt. */
  | { t: 'diary'; action: 'answer'; choice: string }
  /**
   * Treino no tatame (the Academia bout), protocol version 1. The server owns the bout: the client only picks an intent and answers
   * the challenge the server issued (`seq` must match the prompt on screen); timers and results are the server's.
   */
  | { t: 'bout'; v: 1; action: 'open' }
  | { t: 'bout'; v: 1; action: 'start'; partner: PartnerId; listen?: boolean; rematch?: boolean }
  | { t: 'bout'; v: 1; action: 'intent'; seq: number; intent: string }
  | { t: 'bout'; v: 1; action: 'answer'; seq: number; answer: BoutAnswer }
  | { t: 'bout'; v: 1; action: 'quit' }
  /**
   * Hidden ops panel (credits easter egg). The server checks the password once per socket; later actions need that flag.
   * `list` refreshes the online player roster; `kick` removes another player; `money` pays the caller; `clock` / `weather` pin the shared sky.
   */
  | { t: 'admin'; action: 'login'; password: string }
  | { t: 'admin'; action: 'logout' }
  | { t: 'admin'; action: 'list' }
  | { t: 'admin'; action: 'kick'; targetId: string }
  | { t: 'admin'; action: 'money'; amount: number }
  | { t: 'admin'; action: 'clock'; minute: number }
  | { t: 'admin'; action: 'weather'; weather: Weather | null }
  /**
   * Player academies (slice 1). The elevator in Academia do Bairro asks for `directory`.
   * `found` takes a first-come name (brown belt). `visit` loads the empty floor without joining.
   * `join` / `leave` are a free membership flag (no dues). `look` sets the crest and gi (owner).
   */
  | { t: 'academy'; action: 'directory' }
  | { t: 'academy'; action: 'found'; name: string; crest: CrestId; giColor: GiColorId; giStamp: GiStampId }
  | { t: 'academy'; action: 'visit'; id: string }
  | { t: 'academy'; action: 'join'; id: string }
  | { t: 'academy'; action: 'leave'; id: string }
  | { t: 'academy'; action: 'look'; id: string; crest: CrestId; giColor: GiColorId; giStamp: GiStampId }
  /**
   * Player-owned padaria (Fundar). `door` opens the savings meter UI at the praça facade or shared padaria exit.
   * `found` spends 900 RV once. `visit` loads your room. `upgrade` buys size 2/3 or sweets (owner, in-room).
   */
  | { t: 'padariaOwn'; action: 'door' }
  | { t: 'padariaOwn'; action: 'found'; name: string }
  | { t: 'padariaOwn'; action: 'visit'; id?: string }
  | { t: 'padariaOwn'; action: 'upgrade'; kind: PadariaUpgradeKind }
  | { t: 'ping' };

/** One online player row for the admin panel. */
export interface AdminPlayerRow {
  id: string;
  name: string;
  room: RoomId | null;
  roomName: string | null;
}

/** One new word of a shot, as the card shows it. A shot that teaches several words sends one of these for each, in the order to show them. */
export interface DiaryMoment {
  pt: string;
  en: string;
  areaPt: string;
  progress: string;
  /** Which source taught it (a photo's words are all camera and leave this out). */
  source?: string;
}

export interface RoomStateMsg {
  t: 'roomState';
  room: RoomId;
  instanceId: string;
  instanceName: string;
  ownerId: string | null;
  ownerName: string | null;
  cap: number;
  selfId: string;
  avatars: PublicAvatar[];
  furniture: PlacedFurniture[];
  /** Server `Date.now()` when sent; the client derives `skew = serverNow - Date.now()` for the game clock. */
  serverNow?: number;
  /** Set on a player academy floor (`andar`). Absent in every public room, including Academia do Bairro. */
  academy?: AcademyCard;
  /** Set in a player-owned padaria instance (`padaria@…`). */
  padaria?: PadariaCard;
}

export type NoticeLevel = 'info' | 'warn' | 'block' | 'reward' | 'error';

/** Correria no Balcão end card: stars, RV, Caderno words and unlocks for this shift. */
export interface CorreriaEnd {
  served: number;
  perfect: number;
  second: number;
  left: number;
  points: number;
  tips: number;
  bestCombo: number;
  stars: number;
  /** RV paid (0 when the daily limit was used or nobody was served). */
  coins: number;
  /** The shift would have paid but today's paid shifts are used up. */
  dailyBlocked: boolean;
  askRight: number;
  askTotal: number;
  /** Words met in this shift that were new to the Caderno. */
  words: Bilingual[];
  newUnlocks: { id: UnlockId; pt: string; en: string }[];
  /** Total stars after this shift and the level (0-3) it opens next time. */
  totalStars: number;
  level: number;
  regulars: string[];
}

export type MgServerMsg =
  | { t: 'mg'; phase: 'state'; snap: CorreriaSnap; ev: CEvent[]; resync?: boolean; /** test hint (TB_TEST_MG) */ debug?: boolean }
  /** `lost`: the server has no shift for this player (restart, or the resume window ran out). Nothing is paid. */
  | { t: 'mg'; phase: 'end'; end: CorreriaEnd; carlos: Bilingual; lost?: boolean };

/**
 * Conversa (GDD §5.6). Only ever sent to the player having the conversation — never broadcast.
 * `mode` is 'ai' for generative turns, 'authored' for the Carlos graph fallback.
 */
export type ConversaServerMsg =
  | {
      t: 'conversa';
      phase: 'open';
      npc: NpcId;
      npcName: string;
      subject: ConversaSubject;
      mode: 'ai' | 'authored';
      offline: boolean;
      line: Bilingual;
      chips: Bilingual[];
      turn: number;
      maxTurns: number;
    }
  | { t: 'conversa'; phase: 'said'; text: string; turn: number; maxTurns: number }
  | { t: 'conversa'; phase: 'rejected'; pt: string; en: string }
  | {
      t: 'conversa';
      phase: 'turn';
      mode: 'ai' | 'authored';
      offline: boolean;
      line: Bilingual;
      chips: Bilingual[];
      scores: ConversaScores;
      meter: ConversaMeter;
      tip: Bilingual | null;
      turn: number;
      maxTurns: number;
    }
  | {
      t: 'conversa';
      phase: 'end';
      mode: 'ai' | 'authored';
      offline: boolean;
      line: Bilingual;
      scores: ConversaScores;
      meter: ConversaMeter;
      tip: Bilingual | null;
      grade: ConversaGrade;
      gradeLabel: Bilingual;
      payout: number;
      reason: 'natural' | 'cap' | 'early';
      turn: number;
      maxTurns: number;
    }
  | { t: 'conversa'; phase: 'blocked'; reason: 'daily' | 'unavailable'; pt: string; en: string };

/** The bout as the client draws it (everything derived from `BoutState`, plus the position it names). */
export interface BoutSnapshot {
  rung: number;
  momentum: number;
  points: Score;
  adv: Score;
  pegada: number;
  pegadaB: number;
  /** game ms left on the 5:00 clock */
  clockMs: number;
  exchange: number;
  position: BjjPositionId;
  ahead: 'you' | 'partner' | null;
  streak: number;
}

export interface BoutPartnerCard {
  id: PartnerId;
  name: string;
  style: Bilingual;
  bio: Bilingual;
  unlocked: boolean;
  unlockLevel: number;
  /** 1..5 */
  stars: number;
}

export interface BoutIntentOut {
  id: string;
  pt: string;
  en: string;
  risk: 1 | 2 | 3;
  /** Shown before the player confirms. Omitted for Hold, which always works. */
  percent?: number;
}

export type BoutRole = 'exchange' | 'finish' | 'escape';

/** Server → client for the bout (`t: 'bout'`, `v: 1`). Every prompt carries the `seq` the answer must echo. */
export type BoutServerMsg =
  | { t: 'bout'; v: 1; phase: 'lobby'; partners: BoutPartnerCard[]; bjj: BjjProgress; level: number; suggested: PartnerId }
  | {
      t: 'bout';
      v: 1;
      phase: 'intro';
      partner: { id: PartnerId; name: string; style: Bilingual };
      st: BoutSnapshot;
      introMs: number;
      level: number;
      line: Bilingual;
      signal: RefSignal;
    }
  | {
      t: 'bout';
      v: 1;
      phase: 'intent';
      seq: number;
      st: BoutSnapshot;
      /** Legal this position. These are the ones the player can confirm. */
      intents: BoutIntentOut[];
      /** Owned moves, including ones this position cannot play yet, so the bar can show their percent. */
      owned?: BoutIntentOut[];
      finish: boolean;
      pickMs: number;
    }
  | {
      t: 'bout';
      v: 1;
      phase: 'drill';
      seq: number;
      st: BoutSnapshot;
      move: { id: string; pt: string; en: string };
      line: Bilingual;
      /** Pose the demonstration starts from, before `st` (the landing). */
      from: BjjPositionId;
      aheadFrom: 'you' | 'partner' | null;
    }
  | {
      t: 'bout';
      v: 1;
      phase: 'challenge';
      seq: number;
      st: BoutSnapshot;
      role: BoutRole;
      intent: IntentId | null;
      /** finalização in several steps: 1-based step and the step count */
      step: number;
      steps: number;
      challenge: ChallengeView;
      limitMs: number;
    }
  | {
      t: 'bout';
      v: 1;
      phase: 'resolve';
      seq: number;
      st: BoutSnapshot;
      intent: string;
      /** Whose move just resolved. */
      actor?: 'you' | 'partner';
      /** The move that just played, so the mat can run that gag's cartoon before the pose changes. */
      move?: string;
      /** Placeholder tone. Missing audio must not stop the match. */
      sound?: 'hit' | 'whoosh' | 'mount' | 'sub' | 'none';
      say?: Bilingual;
      yours: { correct: boolean; speed: number; fast: boolean; timeout: boolean };
      partner: { intent: string; correct: boolean };
      /** net momentum push (positive: toward you) */
      delta: number;
      events: ExchangeEvent[];
      /** how long the beat lasts on screen (ms) */
      holdMs: number;
    }
  | { t: 'bout'; v: 1; phase: 'finish_end'; kind: 'finalizacao' | 'escape'; success: boolean; st: BoutSnapshot; line: Bilingual; signal: RefSignal | null; holdMs: number }
  | {
      t: 'bout';
      v: 1;
      phase: 'end';
      winner: BoutWinner | 'none';
      reason: BoutReason;
      st: BoutSnapshot;
      rv: number;
      bjj: BjjProgress;
      belt: Belt;
      stripeUp: boolean;
      beltUp: boolean;
      bond: number;
      line: Bilingual;
      thanks: Bilingual;
      signal: RefSignal | null;
      /** After a loss, one-tap rematch the same guard position (and bot memory). */
      rematchSamePosition?: boolean;
      /** The one new diary word this win taught, or omitted when a loss or an exhausted list taught nothing. */
      word?: Bilingual | null;
    };

/** Server → client messages. */
export type ServerMsg =
  | { t: 'welcome'; profile: PrivateProfile; token: string; serverNow?: number; weather?: import('./weather.js').Weather | null }
  /**
   * The diary photos (small jpegs). Sent after `welcome` and whenever a photo is added, never inside `profile`: a dozen images in every
   * profile push made each reward, step and stamp carry ~100 KB.
   */
  | { t: 'photos'; photos: import('./diary.js').DiaryPhoto[] }
  | { t: 'needProfile' }
  /** Multiplayer needs an email + password account; this socket has no valid session cookie. */
  | { t: 'authRequired' }
  | { t: 'idleWarning'; msLeft: number; pt: string; en: string }
  /** Sent right before the server closes the socket (idle = 4001, admin = 4003) to free the seat. */
  | { t: 'kicked'; reason: 'idle' | 'admin'; pt: string; en: string }
  | { t: 'profile'; profile: PrivateProfile }
  | RoomStateMsg
  /** Live sky sync: game-clock stamp and optional weather pin (`null` clears the pin). Sent on admin changes and with welcome. */
  | { t: 'sky'; serverNow: number; weather: Weather | null }
  | { t: 'admin'; phase: 'auth'; ok: true }
  | { t: 'admin'; phase: 'auth'; ok: false; pt: string; en: string }
  | { t: 'admin'; phase: 'players'; players: AdminPlayerRow[] }
  | { t: 'admin'; phase: 'disabled'; pt: string; en: string }
  | { t: 'avatarJoined'; avatar: PublicAvatar }
  | { t: 'avatarLeft'; id: string }
  | { t: 'avatarMoved'; id: string; from: Tile; path: Tile[]; sit: boolean }
  | { t: 'avatarUpdated'; avatar: PublicAvatar }
  | { t: 'emote'; id: string; kind: EmoteKind }
  | { t: 'chat'; id: string; name: string; text: string; gloss: string | null; lang: 'pt' | 'en' | 'mix'; action: SafetyAction }
  /** `tag` marks notices the client presents in its own way: a recado step, the giver's thanks, a friendship milestone. */
  | { t: 'notice'; level: NoticeLevel; pt: string; en: string; tag?: 'recado_step' | 'recado_thanks' | 'bond' }
  | { t: 'reward'; amount: number; coins: number; reason: Bilingual }
  /** Cartela stamp earned or card paid out (HUD toast / banner). */
  | { t: 'cartela'; stamps: number; todayCount: number; activity: CartelaActivity; paid: boolean }
  | {
      t: 'scene';
      view: SceneView;
      lastScore?: 0 | 1 | 2 | 3;
      feedback?: Bilingual;
      said?: Bilingual;
      /** False when Gate A warned — echo only, do not slot-parse into the Pedido ticket. */
      fillTicket?: boolean;
      /** Gate A backstop toast when the client did not already show one. */
      notice?: { level: 'warn' | 'block'; pt: string; en: string };
      payout?: number;
      dailyBlocked?: boolean;
    }
  | MgServerMsg
  | ConversaServerMsg
  | BoutServerMsg
  | { t: 'furnitureState'; furniture: PlacedFurniture[] }
  | { t: 'friends'; friends: FriendInfo[]; incoming: { id: string; name: string }[] }
  | { t: 'friendRequest'; fromId: string; fromName: string }
  | { t: 'parrotHint'; word: Bilingual }
  | { t: 'tutorial'; step: TutorialStep }
  /** The recados board: offered (not yet accepted), in progress, and ids finished today. Sent on `recados` requests, on join and after every change. */
  | { t: 'recados'; day: number; offered: RecadoOfferView[]; active: RecadoActiveView[]; done: string[] }
  /** The feira's answer to `price`: what the vendor says and what each offered quantity costs (centavos). */
  | { t: 'feira'; phase: 'price'; vendor: VendorId; itemId: string; options: PriceOption[]; line: Bilingual }
  /**
   * The answer to `pay`. `short`: nothing is bought (the tray stays as it was on the client). `exact` and `change`: the goods are in the bag;
   * `rv` is the little reward (0 once the day's limit is reached).
   */
  | {
      t: 'feira';
      phase: 'pay';
      vendor: VendorId;
      itemId: string;
      qty: number;
      price: number;
      paid: number;
      result: 'exact' | 'change' | 'short';
      change?: number;
      missing?: number;
      line: Bilingual;
      rv: number;
    }
  /** Language diary: a photo, a practice round, or its result. The profile push carries the earned ids. */
  | { t: 'diary'; phase: 'photo'; ok: true; pt: string; en: string; source: string; areaPt: string; progress: string; film: number; words?: DiaryMoment[] }
  | { t: 'diary'; phase: 'photo'; ok: false; pt: string; en: string; film: number; empty?: boolean }
  /** A word went into the diary another way (a sign read, a line heard, a game won): the client makes the same moment of it as a photo. */
  | { t: 'diary'; phase: 'word'; pt: string; en: string; source: string; areaPt: string; progress: string }
  /** Several words went in at once (the arrival card's): shown one after another, each counting up in its area. */
  | { t: 'diary'; phase: 'words'; words: DiaryMoment[] }
  | { t: 'diary'; phase: 'practice'; ok: true; host: string; en: string; options: string[] }
  | { t: 'diary'; phase: 'practice'; ok: false; host: string; pt: string; en: string }
  | { t: 'diary'; phase: 'result'; correct: boolean; host: string; line: Bilingual; granted: { pt: string; en: string } | null }
  | { t: 'error'; code: string; pt: string; en: string }
  | { t: 'pong' }
  /** Elevator directory. `canFound` is this player's belt. `ownedId` is the academy they founded, if any. */
  | { t: 'academy'; phase: 'directory'; rows: AcademyCard[]; canFound: boolean; ownedId: string | null }
  /** Crest / gi / membership changed on the floor you are standing in. */
  | { t: 'academy'; phase: 'floor'; academy: AcademyCard }
  | { t: 'padariaOwn'; phase: 'door'; enabled: boolean; door: PadariaDoorState; rows: PadariaCard[] }
  | { t: 'padariaOwn'; phase: 'floor'; padaria: PadariaCard };
