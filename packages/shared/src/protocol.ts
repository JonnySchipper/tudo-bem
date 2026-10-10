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
import type { CAct, CEvent, CorreriaSnap, MenuLadderView, UnlockId } from './correria.js';
import type { SafetyAction } from './safety.js';
import type { NpcId, PropDef } from './rooms.js';
import type { BjjPositionId, BjjProgress, BoutReason, BoutWinner, Belt, PartnerId } from './academia.js';
import type { AcademyCard, CrestId, GiColorId, GiStampId } from './playerAcademy.js';
import type { PadariaCard, PadariaDoorState, PadariaUpgradeKind } from './playerPadaria.js';
import type { ExchangeEvent, RefSignal, Score } from './bout.js';
import type { MatAttack, MatCardKind, MatCommand, MatDefense, TapGrade } from './matFight.js';
import type { RecadoActiveView, RecadoOfferView } from './recados.js';
import type { CartelaActivity } from './cartela.js';
import type { PriceOption, VendorId } from './feira.js';
import type { Weather } from './weather.js';
import type { FeiraBoardRow, FeiraCartAdminGame, FeiraCartMode, FeiraCartSchedule, FeiraGameId, FeiraMedalTally, FeiraOrderOutcome } from './feiraGames.js';
import type { BoardRow } from './leaderboards.js';
import type { PraiaMode } from './praia.js';
import type { BoatTier, WaterId } from './pesca.js';
import type { FishId } from './fish.js';
import type { PescaEvent, PescaOutcome, PescaRoll } from './pescaSim.js';
import type { AdminTestSnapshot } from './adminTestes.js';
import type { AdminBannedRow, ModerationRow, ReportReason } from './moderation.js';

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
  /** `text` is ignored: the server snapshots the target's recent lines itself. */
  | { t: 'report'; targetId: string; reason?: ReportReason; text?: string }
  /** Hide a player's chat, emotes and friend requests from you (and undo it). Persisted on your profile. */
  | { t: 'block'; action: 'block' | 'unblock'; targetId: string }
  | { t: 'portal'; portalId: string }
  | { t: 'scene'; action: 'start'; npc: NpcId }
  | { t: 'scene'; action: 'choose'; chip: number }
  | { t: 'scene'; action: 'type'; text: string }
  | { t: 'scene'; action: 'close' }
  | { t: 'mg'; action: 'start' }
  /** One step at the counter (Correria no Balcão): grab, grill, pour, pack, serve, answer… the server judges it. */
  | { t: 'mg'; action: 'act'; act: CAct }
  | { t: 'mg'; action: 'quit' }
  | { t: 'mg'; action: 'sync' }
  | { t: 'buy'; kind: 'hat' | 'furniture' | 'parrot' | 'gi'; itemId: string }
  | { t: 'snack'; action: 'buy'; itemId: string }
  /** Order at the padaria counter (the baker on duty): pay, carry it, and it goes in the bag. */
  | { t: 'padaria'; action: 'buy'; itemId: string }
  /** Eat or drink what you're holding, or toss it (an empty coconut, an empty bag, or the snack itself). */
  | { t: 'carry'; action: 'consume' | 'toss' }
  | { t: 'equipHat'; hatId: string | null }
  | { t: 'parrot'; action: 'adopt' | 'toggle' | 'hint' | 'color'; colorId?: string }
  | { t: 'furniture'; action: 'place'; itemId: string; x: number; y: number; rot: 0 | 1 }
  | { t: 'furniture'; action: 'move'; uid: string; x: number; y: number; rot: 0 | 1 }
  | { t: 'furniture'; action: 'pickup'; uid: string }
  | { t: 'friend'; action: 'request' | 'accept' | 'decline' | 'remove'; targetId: string }
  | { t: 'friends' }
  /** Dual Praça leaderboards (words learned + escola streak). */
  | { t: 'leaderboards' }
  | { t: 'mission'; action: 'take' }
  /** Hand one recado's worth of an item from the bag to an NPC standing next to you. */
  | { t: 'give'; npc: NpcId; itemId: string }
  /** Read a sign (a hotspot id from HOTSPOTS), within 3 tiles. */
  | { t: 'read'; hotspotId: string }
  /** The player opened the greeting dialogue with an NPC (Nanda, Júlia…): fires the recado engine's `talked` event. */
  | { t: 'talk'; npc: NpcId }
  /** A bate-papo (`PAPOS` id) with the NPC next to you was talked through to the end. Never graded. */
  | { t: 'papo'; npc: NpcId; id: string }
  | { t: 'recados'; action: 'accept' | 'drop' | 'list'; id?: string }
  /** The feira (Phase 9): ask a vendor the price of one good, then pay for a quantity with tray pieces (centavos: 50, 100, 200, 500, 1000, 2000). */
  | { t: 'feira'; action: 'price'; vendor: VendorId; itemId: string }
  | { t: 'feira'; action: 'pay'; vendor: VendorId; itemId: string; qty: number; paid: number[] }
  /** The player played 🔊 for these cards (Caderno). At most 10 known card ids; rate-limited per session. */
  | { t: 'heard'; cardIds: string[] }
  /**
   * Finish the arrival: at the airport's information desk Célia hands over the camera, the cartela and Júlia's note, whose words go into the
   * diary. Once. `replay` (a visit to the airport from the diary's Chegada area): only the note's missing words. `landed`: the arrivals hall
   * (`ROOMS.desembarque`) is done or skipped, so the next login goes to the airport instead.
   */
  | { t: 'arrival'; action: 'finish' | 'replay' | 'landed' }
  /**
   * Claim a catch-up grant: a feature that shipped after this player already lived here.
   * The server hands it over only when the profile is still owed it (`owedGrants`).
   */
  | { t: 'grant'; id: string }
  /**
   * Take a photo. `anchors` are the camera objects inside the viewfinder (props, wall spots, placed furniture); every camera word they
   * teach is given, in the order named. `image` is a small jpeg of the frame. Every shot spends one film, except in the airport (the
   * arrival tutorial's first photos are free). `frame` is the viewfinder in world px (photoFrame.ts): with it the server checks each object
   * against the frame the player aimed, not against a fixed radius around the player.
   */
  | { t: 'diary'; action: 'photo'; anchor?: string; anchors?: string[]; image?: string; frame?: import('./photoFrame.js').PhotoFrame }
  /** Buy a pack of film from Júlia. Virtual RV only. */
  | { t: 'diary'; action: 'buyFilm' }
  /** Heard an NPC line (`npc.node`) that can teach a conversation word. */
  | { t: 'diary'; action: 'line'; anchor: string }
  /**
   * Dona Lúcia's lessons (the escola desk). `start` deals a lesson from the player's diary (`area`: one unit of the path; `tz`: minutes east
   * of UTC, so the streak follows the player's own calendar day). `answer` answers the exercise on screen; `pair` is one tap of the match
   * race; `next` deals the next exercise (or ends the lesson); `quit` leaves (what was answered still counts); `goal` sets the daily XP goal.
   */
  | { t: 'escola'; action: 'start'; area?: string; tz?: number }
  | { t: 'escola'; action: 'answer'; choice?: string; text?: string; order?: number[] }
  | { t: 'escola'; action: 'pair'; pt: number; en: number }
  | { t: 'escola'; action: 'next' }
  | { t: 'escola'; action: 'quit' }
  | { t: 'escola'; action: 'goal'; goal: number; tz?: number }
  /**
   * Treino no tatame (the Academia bout), protocol version 2 (Tatame v3 "Comando"). The server owns the bout and its clock: the client
   * picks a card (`pick`), taps the commands of the chain it was sent (`tap`, one per command, `step` 0-based, `ms` since that command
   * appeared) and answers the partner's attack (`defend`, `step` for the escape mash). `seq` must match the beat on screen.
   */
  | { t: 'bout'; v: 2; action: 'open' }
  | { t: 'bout'; v: 2; action: 'start'; partner: PartnerId; listen?: boolean; rematch?: boolean }
  | { t: 'bout'; v: 2; action: 'pick'; seq: number; move: string }
  | { t: 'bout'; v: 2; action: 'tap'; seq: number; step: number; cmd: string; ms: number }
  | { t: 'bout'; v: 2; action: 'defend'; seq: number; cmd: string; ms: number; step?: number }
  | { t: 'bout'; v: 2; action: 'quit' }
  /**
   * Hidden ops panel (credits easter egg). The server checks the password once per socket; later actions need that flag.
   * `list` refreshes the online player roster; `kick` removes another player; `money` pays the caller; `clock` / `weather` pin the shared sky.
   * `feiraCart` / `feiraCartSet` turn the Feira cart games on and off (persisted, no redeploy).
   */
  | { t: 'admin'; action: 'login'; password: string }
  | { t: 'admin'; action: 'logout' }
  | { t: 'admin'; action: 'list' }
  | { t: 'admin'; action: 'kick'; targetId: string }
  /** Pause a player's chat for `minutes` (0 lifts it). */
  | { t: 'admin'; action: 'mute'; targetId: string; minutes: number }
  | { t: 'admin'; action: 'ban'; targetId: string }
  | { t: 'admin'; action: 'unban'; targetId: string }
  | { t: 'admin'; action: 'banned' }
  | { t: 'admin'; action: 'moderation' }
  | { t: 'admin'; action: 'money'; amount: number }
  | { t: 'admin'; action: 'clock'; minute: number }
  | { t: 'admin'; action: 'weather'; weather: Weather | null }
  /** Feira cart games switch. `feiraCart` reads the list; `feiraCartSet` turns one game off, on, or (later) onto a schedule. */
  | { t: 'admin'; action: 'feiraCart' }
  | { t: 'admin'; action: 'feiraCartSet'; game: string; mode: FeiraCartMode; schedule?: FeiraCartSchedule | null }
  /** The Praia: open / preview / closed, and the party boat on or off (either field may be left out). */
  | { t: 'admin'; action: 'praiaSet'; mode?: PraiaMode; partyBoat?: boolean }
  /**
   * Fishing (PRAIA-PLAN.md 2.4, 7.1). `open` a spot, `cast` from it (how far: 0..1), send the `result` as taps and holds (never a fish or
   * a size), `quit`; at Jô's: `tray` (what she would pay) and `sell` (one species, or everything).
   */
  | { t: 'pesca'; action: 'open'; spotId: string }
  | { t: 'pesca'; action: 'cast'; spotId: string; power: number }
  | { t: 'pesca'; action: 'result'; seq: number; events: PescaEvent[] }
  | { t: 'pesca'; action: 'quit' }
  | { t: 'pesca'; action: 'tray' }
  | { t: 'pesca'; action: 'sell'; fish?: FishId }
  /** Seu Bento's boats (PRAIA-PLAN.md 3.3): the menu, rent a solo boat for one trip, hand it back. */
  | { t: 'barco'; action: 'menu' }
  | { t: 'barco'; action: 'rent'; tier: BoatTier }
  | { t: 'barco'; action: 'return' }
  /**
   * The party boat (PRAIA-PLAN.md 5.3): the host `create`s a trip at Bento's (pays the festa price) and invites online friends; a guest
   * `accept`s from anywhere in the Vila (fast travel) or `decline`s; anyone aboard may `leave`; the host may `remove` a guest or `end` it.
   */
  | { t: 'party'; action: 'create' }
  | { t: 'party'; action: 'invite'; targetId: string }
  | { t: 'party'; action: 'accept' | 'decline'; tripId: string }
  | { t: 'party'; action: 'leave' }
  | { t: 'party'; action: 'remove'; targetId: string }
  | { t: 'party'; action: 'end' }
  /** Subscriber list for the Assinaturas section. */
  | { t: 'admin'; action: 'subscribers' }
  /** Dev/test subscription (no payment). Admin socket only. */
  | { t: 'admin'; action: 'grantSub'; targetId: string }
  | { t: 'admin'; action: 'revokeSub'; targetId: string }
  /**
   * Testes (admin socket only). `username` omitted means the signed-in admin.
   * Each action is refused until the admin password has unlocked this socket.
   */
  | { t: 'admin'; action: 'testes'; username?: string }
  | { t: 'admin'; action: 'testBelt'; username?: string; belt?: Belt; stripes?: number; wins?: number; deltaWins?: number }
  | { t: 'admin'; action: 'testCoins'; username?: string; coins: number }
  | { t: 'admin'; action: 'testProgress'; username?: string; xp?: number; goal?: number; verde?: boolean; tz?: number }
  | { t: 'admin'; action: 'testEscola'; username?: string; streak?: number; words?: number; tz?: number }
  | { t: 'admin'; action: 'testTeleport'; username?: string; room: RoomId }
  | { t: 'admin'; action: 'testClock'; minute?: number; rollDay?: boolean }
  | { t: 'admin'; action: 'testCaps'; username?: string }
  | { t: 'admin'; action: 'testTutorial'; username?: string; mode: 'reset' | 'skip' }
  | { t: 'admin'; action: 'testPadaria'; username?: string; menu?: number; stage?: 0 | 1 | 2 | 3 }
  | { t: 'admin'; action: 'testPerk'; username?: string; grant?: boolean; revoke?: boolean; pet?: 'dog' | 'cat' | null; bubble?: import('./subscription.js').BubbleStyle }
  | { t: 'admin'; action: 'testReset'; username?: string; confirm?: boolean }
  /** Subscriber pet and chat-bubble appearance. The server ignores a perk the subscription does not currently allow. */
  | { t: 'perk'; action: 'pet'; pet: 'dog' | 'cat' | null }
  | { t: 'perk'; action: 'bubble'; style: import('./subscription.js').BubbleStyle }
  /** Name the dog or the cat. The server trims, checks the shape, then runs chat moderation. It never rewrites the name. */
  | { t: 'perk'; action: 'petName'; pet: 'dog' | 'cat'; name: string }
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
  /**
   * Feira cart games. `start` asks to play today's featured game at the cart.
   * `finish` sends compact per-order outcomes; the server recomputes the score.
   * `board` asks for the live top 3 and all-time medals (the Feira sign).
   */
  | { t: 'feiraGame'; action: 'start' }
  | { t: 'feiraGame'; action: 'finish'; outcomes: FeiraOrderOutcome[] }
  | { t: 'feiraGame'; action: 'quit' }
  | { t: 'feiraGame'; action: 'board'; open?: 'cart' | 'sign' }
  | { t: 'ping' };

/** One online player row for the admin panel. */
export interface AdminPlayerRow {
  id: string;
  name: string;
  room: RoomId | null;
  roomName: string | null;
}

/** One row in the admin Assinaturas list. */
export interface AdminSubscriberRow {
  id: string;
  name: string;
  status: 'active' | 'cancelled' | 'expired' | 'none';
  currentPeriodEnd: number | null;
  founderBadge: boolean;
  founderBanner: boolean;
  online: boolean;
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
  /** Feira room only: whether the cart games are on, so the closed sign is there on enter. */
  feiraCart?: { closed: boolean; game: FeiraGameId | null };
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
  /** Words met in this shift that were new to the Caderno. */
  words: Bilingual[];
  newUnlocks: { id: UnlockId; pt: string; en: string }[];
  /** Total stars after this shift and the level (0-3) it opens next time. */
  totalStars: number;
  level: number;
  regulars: string[];
  /** Set when this shift's menu just grew: "+1 item no cardápio: pagamento +6%". */
  menuNote?: Bilingual | null;
  /** The ladder for the next shift (counting this one): `fresh` opens next time, else `next` opens in `nextIn` shifts. */
  ladder?: MenuLadderView;
}

export type MgServerMsg =
  | { t: 'mg'; phase: 'state'; snap: CorreriaSnap; ev: CEvent[]; resync?: boolean; /** test hint (TB_TEST_MG) */ debug?: boolean }
  /** `lost`: the server has no shift for this player (restart, or the resume window ran out). Nothing is paid. */
  | { t: 'mg'; phase: 'end'; end: CorreriaEnd; carlos: Bilingual; lost?: boolean };


/** The bout as the client draws it (everything derived from the mat state, plus the pose it names). */
export interface BoutSnapshot {
  rung: number;
  points: Score;
  adv: Score;
  /** game ms left on the 2:00 clock (7.5 s an exchange) */
  clockMs: number;
  /** exchanges played, both fighters (the match is {@link turns}) */
  exchange: number;
  turns?: number;
  position: BjjPositionId;
  ahead: 'you' | 'partner' | null;
  /** The control meter, -100 (partner) .. 100 (you). */
  meter?: number;
  /** The grips each fighter holds, drawn on the fighters and in the HUD. `age` is own turns held (it slips at 3). */
  grips?: { you: BoutGrips; partner: BoutGrips };
  /** A defense waiting for the other fighter's next move. */
  brace?: { you: 'postura' | 'base' | 'recuperar' | null; partner: 'postura' | 'base' | 'recuperar' | null };
  /** Your all-Perfeito chains in a row (Ritmo: three are a Vantagem). */
  ritmo?: number;
}

export interface BoutGrips {
  collar: boolean;
  sleeve: boolean;
  age: { collar: number; sleeve: number };
}

/** The partner's telegraphed next move. `answers` are your cards that counter it. */
export interface BoutPlanOut {
  kind: string;
  move: string;
  line: Bilingual;
  answers: string[];
}

/** A grip or defense moment of a resolved move, for the mat (grip snap, strip, slip, brace, a block, a defense, a Ritmo). */
export type BoutGripEvent =
  | { kind: 'grip'; side: 'you' | 'partner'; grip: 'collar' | 'sleeve' }
  | { kind: 'strip'; side: 'you' | 'partner'; grips: ('collar' | 'sleeve')[] }
  | { kind: 'slip'; side: 'you' | 'partner'; grips: ('collar' | 'sleeve')[] }
  | { kind: 'brace'; side: 'you' | 'partner'; brace: 'postura' | 'base' | 'recuperar' }
  | { kind: 'blocked'; side: 'you' | 'partner' }
  | { kind: 'defended'; side: 'you' | 'partner'; adv: boolean }
  | { kind: 'ritmo'; side: 'you' | 'partner' };

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

/** One move card of the pick (at most four). No percentages: the chevrons are the chain length. */
export interface BoutCardOut {
  id: string;
  pt: string;
  en: string;
  kind: MatCardKind;
  /** commands to tap */
  chain: number;
  points: number;
  /** what it does if it lands, in plain words (+2 · você por cima, Protege você, Vale a vitória!) */
  does: Bilingual;
  /** a finish that misses leaves you on the bottom */
  risk?: Bilingual;
  /** this card answers the partner's telegraph */
  answers?: boolean;
}

/** Why a move did or did not land, for the resolve beat. */
export type BoutHow = 'landed' | 'missed' | 'late' | 'wrong' | 'defended' | 'blocked' | 'botched' | 'hold' | 'drill';

/** Server → client for the bout (`t: 'bout'`, `v: 2`). Every beat carries the `seq` its answer must echo. */
export type BoutServerMsg =
  | { t: 'bout'; v: 2; phase: 'lobby'; partners: BoutPartnerCard[]; bjj: BjjProgress; level: number; suggested: PartnerId }
  | {
      t: 'bout';
      v: 2;
      phase: 'intro';
      partner: { id: PartnerId; name: string; style: Bilingual };
      st: BoutSnapshot;
      introMs: number;
      level: number;
      line: Bilingual;
      signal: RefSignal;
      /** A first-ever match (wins 0): longer windows and Bia's three coach notes. */
      first: boolean;
      turns: number;
    }
  | {
      t: 'bout';
      v: 2;
      phase: 'pick';
      seq: number;
      st: BoutSnapshot;
      /** At most four, ranked (the answer to the telegraph first). */
      cards: BoutCardOut[];
      pickMs: number;
      /** What the partner will do next, shown before you choose. */
      plan?: BoutPlanOut;
    }
  | {
      t: 'bout';
      v: 2;
      phase: 'chain';
      seq: number;
      st: BoutSnapshot;
      move: { id: string; pt: string; en: string };
      /** The commands to tap, in order, and each one's window (ms from when it appears). The drill's windows are 0: no timer. */
      cmds: MatCommand[];
      windowMs: number[];
      /** The pose the move starts from (the clip to drive). */
      from: BjjPositionId;
      aheadFrom: 'you' | 'partner' | null;
      /** A finish: the partner's escape bar fills over the whole chain. */
      sub: boolean;
      /** The professor's drill: no timer, Bia calls each command slowly. */
      drill?: boolean;
      line?: Bilingual;
    }
  | {
      t: 'bout';
      v: 2;
      phase: 'defend';
      seq: number;
      st: BoutSnapshot;
      move: { id: string; pt: string; en: string };
      attack: MatAttack;
      /** The right defense, called by Bia at white belt (a listening task). Omitted from blue belt: read the telegraph. */
      call?: MatDefense;
      /** "Mateus vai tentar a queda." (what is coming, in words) */
      line: Bilingual;
      /** The partner's wind-up before the pad appears, then each window. */
      leadMs: number;
      windowMs: number;
      /** Taps in a row (three or four Sai! against a finish; one otherwise). */
      count: number;
      from: BjjPositionId;
      aheadFrom: 'you' | 'partner' | null;
    }
  | {
      t: 'bout';
      v: 2;
      phase: 'resolve';
      seq: number;
      st: BoutSnapshot;
      /** Whose move just resolved. */
      actor: 'you' | 'partner';
      move: string;
      landed: boolean;
      how: BoutHow;
      /** Your grade per command tapped (the chain), or per defense tap. */
      grades?: TapGrade[];
      /** The chain broke at this step (0-based). */
      step?: number;
      cmds?: MatCommand[];
      points: number;
      /** Placeholder tone. Missing audio must not stop the match. */
      sound?: 'hit' | 'whoosh' | 'mount' | 'sub' | 'none';
      say?: Bilingual;
      events: ExchangeEvent[];
      /** how long the beat lasts on screen (ms) */
      holdMs: number;
      grip?: BoutGripEvent[];
      meterFrom?: number;
      meterTo?: number;
      /** The pose before the move (the clip it played from). */
      from: BjjPositionId;
      aheadFrom: 'you' | 'partner' | null;
      /** The partner's move was not the one it telegraphed. */
      feint?: boolean;
      /** The partner dropped its telegraphed move because your move broke it. */
      replanned?: boolean;
    }
  | {
      t: 'bout';
      v: 2;
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
      /** After a loss, one-tap rematch the same partner. */
      rematchSamePosition?: boolean;
      /** The one new diary word this win taught, or omitted when a loss or an exhausted list taught nothing. */
      word?: Bilingual | null;
      /** Palavras de hoje: the commands you used this match (PT with EN). */
      words?: Bilingual[];
      /** Comandos perfeitos: commands tapped Perfeito this match. */
      perfect?: number;
    };

/** Server → client messages. */
export type ServerMsg =
  | { t: 'welcome'; profile: PrivateProfile; token: string; serverNow?: number; weather?: import('./weather.js').Weather | null; layouts?: { room: RoomId; objects: PropDef[] }[] }
  /**
   * The diary photos (small jpegs). Sent after `welcome` and whenever a photo is added, never inside `profile`: a dozen images in every
   * profile push made each reward, step and stamp carry ~100 KB.
   */
  | { t: 'photos'; photos: import('./diary.js').DiaryPhoto[] }
  | { t: 'needProfile' }
  /** Multiplayer needs an email + password account; this socket has no valid session cookie. */
  | { t: 'authRequired' }
  | { t: 'idleWarning'; msLeft: number; pt: string; en: string }
  /** Sent right before the server closes the socket (idle = 4001, admin = 4003, banned = 4004) to free the seat. */
  | { t: 'kicked'; reason: 'idle' | 'admin' | 'banned'; pt: string; en: string }
  | { t: 'profile'; profile: PrivateProfile }
  | RoomStateMsg
  /** Live sky sync: game-clock stamp and optional weather pin (`null` clears the pin). Sent on admin changes and with welcome. */
  | { t: 'sky'; serverNow: number; weather: Weather | null }
  | { t: 'admin'; phase: 'auth'; ok: true }
  | { t: 'admin'; phase: 'auth'; ok: false; pt: string; en: string }
  | { t: 'admin'; phase: 'players'; players: AdminPlayerRow[] }
  | { t: 'admin'; phase: 'subscribers'; subscribers: AdminSubscriberRow[] }
  | { t: 'admin'; phase: 'moderation'; items: ModerationRow[] }
  | { t: 'admin'; phase: 'banned'; banned: AdminBannedRow[] }
  | { t: 'admin'; phase: 'testes'; state: AdminTestSnapshot }
  | { t: 'admin'; phase: 'disabled'; pt: string; en: string }
  /** Feira cart switches. `featured` is today's playable game, or null when the cart is closed. */
  | { t: 'admin'; phase: 'feiraCart'; day: string; featured: FeiraGameId | null; games: FeiraCartAdminGame[] }
  /** Live layout (design mode publishes through `/api/admin/design/*`, see designOps.ts). `objects: null` means this room is back to the layout shipped in the repo. */
  | { t: 'layout'; room: RoomId; objects: PropDef[] | null }
  | { t: 'avatarJoined'; avatar: PublicAvatar }
  | { t: 'avatarLeft'; id: string }
  | { t: 'avatarMoved'; id: string; from: Tile; path: Tile[]; sit: boolean }
  | { t: 'avatarUpdated'; avatar: PublicAvatar }
  | { t: 'emote'; id: string; kind: EmoteKind }
  | { t: 'chat'; id: string; name: string; text: string; gloss: string | null; lang: 'pt' | 'en' | 'mix'; action: SafetyAction }
  /** `tag` marks notices the client presents in its own way: a recado step, the giver's thanks, a friendship milestone. */
  | { t: 'notice'; level: NoticeLevel; pt: string; en: string; tag?: 'recado_step' | 'recado_thanks' | 'recado_accept' | 'recado_bonus' | 'bond' }
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
  | BoutServerMsg
  | { t: 'furnitureState'; furniture: PlacedFurniture[] }
  /** `blocked`: the people this player blocked, for the unblock list. */
  | { t: 'friends'; friends: FriendInfo[]; incoming: { id: string; name: string }[]; blocked?: { id: string; name: string }[] }
  | { t: 'friendRequest'; fromId: string; fromName: string }
  | { t: 'parrotHint'; word: Bilingual }
  | { t: 'tutorial'; step: TutorialStep }
  /** The recados board: offered (not yet accepted), in progress, and ids finished today. Sent on `recados` requests, on join and after every change. */
  | { t: 'recados'; day: number; offered: RecadoOfferView[]; active: RecadoActiveView[]; done: string[]; /** today's "Vizinho do dia" bonus was paid */ bonus?: boolean }
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
  /** The escola: an exercise dealt (never with its answer), the verdict on a try, one pair of the match race, the end of the lesson. */
  | { t: 'escola'; phase: 'exercise'; ex: import('./escola.js').ExerciseView; index: number; total: number; combo: number; lessonXp: number; retry: boolean }
  | {
      t: 'escola';
      phase: 'checked';
      correct: boolean;
      almost?: import('./escola.js').Almost;
      reveal: { pt: string; en: string; line?: string };
      /** XP this answer earned. */
      xp: number;
      combo: number;
      lessonXp: number;
      /** A miss that comes back at the end of the lesson. */
      retry: boolean;
      line: Bilingual;
    }
  | { t: 'escola'; phase: 'pair'; pt: number; en: number; ok: boolean }
  | { t: 'escola'; phase: 'done'; summary: import('./escola.js').EscolaSummary }
  /** The lesson could not start (an empty diary, too far from the desk). */
  | { t: 'escola'; phase: 'closed'; line: Bilingual }
  /** Dual Praça leaderboards. `words` = diary length; `streak` = Escola currentStreak. */
  | { t: 'leaderboards'; words: BoardRow[]; streak: BoardRow[]; at: number }
  | { t: 'error'; code: string; pt: string; en: string }
  | { t: 'pong' }
  /** Elevator directory. `canFound` is this player's belt. `ownedId` is the academy they founded, if any. */
  | { t: 'academy'; phase: 'directory'; rows: AcademyCard[]; canFound: boolean; ownedId: string | null }
  /** Crest / gi / membership changed on the floor you are standing in. */
  | { t: 'academy'; phase: 'floor'; academy: AcademyCard }
  | { t: 'padariaOwn'; phase: 'door'; enabled: boolean; door: PadariaDoorState; rows: PadariaCard[] }
  | { t: 'padariaOwn'; phase: 'floor'; padaria: PadariaCard }
  /**
   * Feira cart game. `start` deals today's run (seed + orders live in shared code; the client regenerates them).
   * `end` is the settled result. `board` is the sign. `crown` is the live Fada da Feira (null after midnight).
   */
  | { t: 'feiraGame'; phase: 'start'; game: FeiraGameId; seed: number; startedAt: number; day: string }
  | {
      t: 'feiraGame';
      phase: 'end';
      game: FeiraGameId;
      score: number;
      coins: number;
      dailyBlocked: boolean;
      served: number;
      perfect: number;
      left: number;
      bestToday: number;
      place: number;
      crown: boolean;
      line: Bilingual;
    }
  | {
      t: 'feiraGame';
      phase: 'board';
      day: string;
      /** Null when no cart game is on. */
      game: FeiraGameId | null;
      closed: boolean;
      top: FeiraBoardRow[];
      medals: FeiraMedalTally[];
      crownId: string | null;
    }
  /** Live switch. Broadcast when an admin changes it, and included on the Feira room enter. */
  | { t: 'feiraGame'; phase: 'cart'; closed: boolean; game: FeiraGameId | null }
  | { t: 'feiraGame'; phase: 'crown'; id: string | null }
  /** The Praia's admin switch (PRAIA-PLAN.md 1.2): sent on sign-in and broadcast on change. `allowed`: may this player go to the beach now. */
  | { t: 'praia'; phase: 'mode'; mode: PraiaMode; partyBoat: boolean; allowed: boolean }
  /** A spot opened: which water, and whether you may cast here now (a boat's water needs its trip). */
  | { t: 'pesca'; phase: 'spot'; spotId: string; water: WaterId; canCast: boolean; reason?: Bilingual }
  /** The cast is on: the seed the client rolls the same fish from (`pinned`: a test roll), and everything the roll depends on. */
  | { t: 'pesca'; phase: 'cast'; seq: number; seed: number; water: WaterId; weather: Weather; minute: number; power: number; firstCatches: number; pinned?: PescaRoll }
  /** What the server judged: the outcome, a first of a species, a new record, the words it taught and a line from Dona Neide. */
  | { t: 'pesca'; phase: 'result'; seq: number; outcome: PescaOutcome; newSpecies: boolean; record: boolean; words: Bilingual[]; line?: Bilingual & { speaker: NpcId }; bottle?: Bilingual }
  /** Someone else aboard the party boat landed a fish: everyone hears its name (and learns it). `by` is a display name. */
  | { t: 'pesca'; phase: 'aboard'; by: string; fish: FishId; pt: string; en: string }
  /** Jô's tray: the fish in your bucket and what she pays for each, and how much more RV she can pay you today. */
  | { t: 'pesca'; phase: 'tray'; fish: PescaTrayRow[]; capLeft: number }
  | { t: 'pesca'; phase: 'sold'; rv: number; coins: number; fish: PescaTrayRow[]; capLeft: number }
  /** Bento's menu: each tier with its live price (a server tunable) and its new fish in words; the trip you have, if any. */
  | { t: 'barco'; phase: 'menu'; tiers: BarcoTierRow[]; trip: { tier: BoatTier; until: number } | null; partyBoat: boolean }
  /** A trip started (or is still running); `until` is server time. */
  | { t: 'barco'; phase: 'trip'; tier: BoatTier; until: number }
  /** The boat went back to Bento: handed back, the time ran out, or you left the beach. */
  | { t: 'barco'; phase: 'ended'; tier: BoatTier; why: 'returned' | 'time' | 'left' }
  /** A friend asks you aboard their party boat (90 s to answer). */
  | { t: 'party'; phase: 'invite'; tripId: string; fromId: string; fromName: string; expiresAt: number }
  /** The trip you are on, sent to every member on any change. `endsAt` is server time; the HUD shows it as words, never a countdown. */
  | { t: 'party'; phase: 'state'; tripId: string; hostId: string; members: { id: string; name: string }[]; endsAt: number; cap: number; music: boolean }
  /**
   * Your trip is over for you: the time ran out, the host ended it (or left), you left, the host sent you ashore, or the boat was switched
   * off. `summary` is the trip's card (display names only); none when you were sent ashore.
   */
  | { t: 'party'; phase: 'ended'; why: PartyEndWhy; summary?: PartySummary };

export type PartyEndWhy = 'time' | 'host' | 'left' | 'removed' | 'off';

/** The party boat's trip card: what was caught aboard and by whom, the words everyone shared, who sailed, what this player earned. */
export interface PartySummary {
  fish: { fish: FishId; by: string }[];
  words: Bilingual[];
  members: string[];
  /** earned items (hat and furniture ids) granted to this player at the end of this trip */
  earned: string[];
}

/** One chip of Bento's rental menu. */
export interface BarcoTierRow {
  tier: BoatTier;
  pt: string;
  en: string;
  price: number;
  canAfford: boolean;
  /** the fish this boat adds, as words (never a count) */
  newFish: Bilingual[];
}

/** One species in the bucket, as Jô's tray shows it. */
export interface PescaTrayRow {
  id: FishId;
  pt: string;
  en: string;
  n: number;
  price: number;
}
