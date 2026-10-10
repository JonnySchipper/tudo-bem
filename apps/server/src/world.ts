import {
  DIARY_WORDS,
  ESCOLA_MAX_BOX,
  grantDiaryWord,
  localDay,
  normalizeDiary,
  BODY_TYPES,
  BOTTOM_STYLES,
  buildGrid,
  canPlaceFurniture,
  bakerOnDuty,
  CHAT_RATE,
  CLOTH_COLORS,
  DEFAULT_ROOM_CAP,
  ECONOMY,
  EXTRA_STYLES,
  FACE_STYLES,
  IDLE_POSES,
  findPath,
  feiraCartShown,
  furnitureById,
  HAIR_COLORS,
  HAIR_STYLES,
  hatById,
  isStallHat,
  isPraiaHat,
  npcAvatarId,
  ADMIN_KICKED_COPY,
  BANNED_COPY,
  BLOCK_MAX,
  MUTE_MAX_MINUTES,
  REPORT_RECENT_MS,
  isReportReason,
  mutedCopy,
  IDLE_KICK_MS,
  IDLE_WARN_MS,
  WEATHER_KINDS,
  idleKickedCopy,
  idleWarningCopy,
  type Weather,
  withoutHiddenFeiraCart,
  installRoomProps,
  revertRoomProps,
  isRoomId,
  key,
  MAX_CHAT_LEN,
  pathDuration,
  positionAlong,
  ROOM_AMBIANCE,
  ROOMS,
  SCORE_FEEDBACK,
  TYPED_MISS_HINT,
  scenePayout,
  SHOE_COLORS,
  SKIN_TONES,
  STARTER_FURNITURE,
  STARTER_HATS,
  TOP_STYLES,
  TUTORIAL_STEPS,
  validateName,
  cardById,
  claimGrant,
  viewNode,
  jevNpcReply,
  freshMission,
  gameMinutes,
  gameMinutesExact,
  MS_PER_GAME_MINUTE,
  greetingKind,
  MISSION_COPY,
  MISSION_REWARD,
  MISSION_STEPS,
  frontOf,
  weekday,
  gameDay,
  GAME_DAY_MS,
  profileDay,
  acceptTz,
  feiraBoardDay,
  type DailyMission,
  type MissionStep,
  type Appearance,
  type Bilingual,
  type ClientMsg,
  type NpcId,
  type JevNpcReplyAnswers,
  type SafetyVerdict,
  type Dir,
  type EmoteKind,
  type FriendInfo,
  type PlacedFurniture,
  type PublicAvatar,
  type RoomDef,
  type RoomId,
  type SceneCtx,
  type ServerMsg,
  type Tile,
  talkOpener,
  type TutorialStep,
  normalizeBjj,
  normalizeFounderFlag,
  bubbleAppearance,
  hasPerkAccess,
  isBubbleStyle,
  petNameDecision,
  revokeTestSubscription,
  validatePetName,
  visiblePet,
  activePet,
  ensureLegacyPet,
  homePetSpots,
  renameOwnedPet,
  setActivePet,
  type HomePet,
  GI_ITEM_ID,
  GI_PRICE,
  buyParrotColor,
  ownedParrotColorIds,
  parrotColorById,
  snackById,
  snackPropIds,
  carryOf,
  carryTossNotice,
  CARRY_BIN,
  CARRY_YUM,
  type CarryId,
  type CounterItemId,
  itemById,
  counterOrderLine,
  COUNTER_PRICES,
  counterPrice,
  isCounterItem,
  academyCard,
  academyIdFromInstance,
  academyInstanceId,
  canFoundAcademy,
  isCrestId,
  isGiColorId,
  validateAcademyName,
  type AcademyCard,
  type PlayerAcademy,
  padariaCard,
  padariaDoorState,
  isPadariaDoorRoom,
  padariaIdFromInstance,
  padariaCasaRoom,
  isWalkable,
  padariaInstanceId,
  validatePadariaName,
  PADARIA_FOUNDER_HAT,
  displayFounderHat,
  fundarCostRv,
  checkPadariaUpgrade,
  applyPadariaUpgrade,
  ownedCorreriaMenuIds,
  counterMenuForOwned,
  SWEET_WORD_IDS,
  type PadariaCard,
  type PlayerPadaria,
  type PrivateProfile,
  type FeiraCartSchedule,
  isPraiaMode,
  praiaAllows,
  PRAIA_CLOSED,
  PRAIA_PARTY_PIER,
  PRAIA_DEFAULT,
  weatherAt,
  type FishId,
  type PraiaConfig,
} from '@tudobem/shared';
import type { ChatSafetyCtx, ChatSafetyService, GlossService, ModerationQueue, NpcDialogueService, StudentModelService } from './services/interfaces.js';
import { JEV_CONTEXT_LINES } from './services/jevModel.js';
import { AcademyStore } from './academyStore.js';
import { PadariaStore } from './padariaStore.js';
import { handleAdminTest, isAdminTestAction, type AdminTestHost } from './adminTestes.js';
import { ProfileStore, toPrivate, type StoredProfile } from './store.js';
import { CpuCrowd } from './ambiance.js';
import { readEnv } from './env.js';
import { founderGrantNewEnabled } from './founder.js';
import { NPC_TICK_MS, NpcDirector } from './npcs.js';
import { RecadoTracker, sceneItems } from './recados.js';
import { CadernoTracker } from './caderno.js';
import { DiaryTracker } from './diary.js';
import { PetShopSystem } from './petShop.js';
import { EscolaTracker, escolaOf } from './escola.js';
import { Leaderboards } from './leaderboards.js';
import { FeiraCounter } from './feira.js';
import { FeiraGamesEngine, FeiraGamesStore, type FeiraGameRun } from './feiraGames.js';
import { FeiraCartStore, memoryFeiraCart } from './feiraCart.js';
import { PraiaStore, memoryPraia } from './praiaStore.js';
import { PescaEngine, type PescaCastRun } from './pesca.js';
import { BarcoEngine } from './barco.js';
import { PartyBoats } from './partyBoat.js';
import { PraiaStats, type PraiaAdminView } from './praiaStats.js';
import { CorreriaEngine, CORRERIA_RESUME_MS, type CorreriaRun } from './correria.js';
import { BoutEngine, type BoutSession } from './bout.js';
import { CartelaTracker } from './cartela.js';
import { ADMIN_TOO_MANY, ADMIN_WRONG_PASSWORD, AdminLoginGuard, readAdminAuthConfig } from './adminAuth.js';
import { DevBillingProvider } from './billing/devProvider.js';
import { publishLayoutPullRequest } from './designGithub.js';
import { LayoutStore } from './layoutStore.js';
import { GameConfig } from './gameConfig.js';
import { adminWorldHost, type AdminWorldHost } from './adminWorld.js';
import { CHAT_LOG_LINES, hasBlocked, moderationRows, ReportLimiter, snapshotLines, type ChatLogLine } from './playerModeration.js';
import { FriendRequests } from './friendRequests.js';
import { safeSchedule } from './safeTimer.js';

export interface Services {
  safety: ChatSafetyService;
  gloss: GlossService;
  npc: NpcDialogueService;
  student: StudentModelService;
  moderation: ModerationQueue;
}

export interface WorldOptions {
  roomCap?: number;
  /** Kept so older callers compile; the counter game has no gap between orders. */
  mgGapMs?: number;
  /** TB_TEST_MG: counter-game snapshots carry each customer's order lines (e2e bots read them instead of parsing the text). */
  testMg?: boolean;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
  /** Praça / Academia ambiance CPUs (LIVEOPS_CPU_AMBIANCE). Off unless the host turns it on. */
  ambiance?: boolean;
  rng?: () => number;
  /** When true, bout challenges include `debugCorrect` and the pauses shrink, for CI e2e (TB_TEST_ROLL=1). */
  testRollHints?: boolean;
  /** Feira cart board + medals. The Node server passes the file-backed store; tests and solo omit it. */
  feiraGames?: import('./feiraGames.js').FeiraGamesStore;
  /** Feira cart on/off switch. Omitted stores start with every game off. */
  feiraCart?: FeiraCartStore;
  /** The Praia's open / preview / closed switch. Omitted: an in-memory store, open. */
  praia?: PraiaStore;
  /** TB_TEST_PESCA: every cast rolls the short pinned fish (pescaSim.pinnedRoll), so an e2e can land one in seconds. */
  pescaPin?: boolean;
  /** Bout intro length in ms (default: 4.2 s, 0.5 s in hint mode). Env `TB_TEST_BOUT_INTRO_MS`. */
  boutIntroMs?: number;
  /** Bout pause scale (default 1, 0.35 in hint mode). Env `TB_TEST_BOUT_PACE`: shots want the real pauses with the hints on. */
  boutPace?: number;
  /** Email/password accounts (the Node server). When set, only sockets with a signed-in session can play. Solo mode leaves it unset. */
  accounts?: AccountLink;
  /** No real input for this long → kicked and the seat is freed. Default 15 min. */
  idleKickMs?: number;
  /**
   * Shifts the game clock (the sky, NPC schedules, greetings) by this many real milliseconds without touching timers. Test-only: the Node
   * server reads `TB_TEST_CLOCK_OFFSET_MIN` (game-clock minutes are 2 real seconds each, so this is real minutes) like `TB_TEST_ROLL`.
   */
  clockOffsetMs?: number;
  /**
   * Password for the hidden admin panel (credits easter egg). Omit to resolve via `TB_ADMIN_PASSWORD` / the local default;
   * pass `null` to disable admin on this world.
   */
  adminPassword?: string | null;
  /** Wrong-password throttle for the admin login. app.ts shares one with the HTTP admin checks; omitted = this world's own. */
  adminGuard?: AdminLoginGuard;
  /** Player academies. Omit for an in-memory store (tests, and any caller that does not persist). */
  academies?: AcademyStore;
  /** Player-owned padarias (Fundar). Omit for in-memory only. */
  padarias?: PadariaStore;
  /** When false, owned instances and Fundar UI stay off; shared Correria unchanged. Env: TB_PADARIA_OWNERSHIP=1 */
  padariaOwnership?: boolean;
  /**
   * Solo/shots only: turn this cart game on (`?feiraon=pastel`). The admin flags stay off
   * without it. Ignored unless the id is one this build can start.
   */
  feiraPin?: string;
  /** Saved design-mode layouts. Omit for none (tests). The Node server passes the file-backed store. */
  layouts?: LayoutStore;
  /** GitHub token for "Enviar para o código". Omit to read `TB_GITHUB_TOKEN`. `null` forces it unset. */
  githubToken?: string | null;
  /** Test double for the GitHub REST client. */
  githubFetch?: typeof fetch;
  /** Tunable game variables (gameConfig.ts). The Node server passes the SQLite-backed one; omitted = shipped defaults. */
  config?: GameConfig;
}

/** What the World needs from the account store (kept tiny so world.ts stays browser-safe for solo mode). */
export interface AccountLink {
  profileIdFor(accountId: string): string | undefined;
  linkProfile(accountId: string, profileId: string): void;
}

export type CloseReason = 'replaced' | 'idle' | 'logout' | 'admin' | 'banned';

interface AvatarState {
  from: Tile;
  path: Tile[];
  start: number;
  dir: Dir;
  sitting: boolean;
  sitOnArrive: boolean;
  seq: number;
}

interface SceneState {
  npc: string;
  node: string;
  ctx: SceneCtx;
  scores: number[];
  shownAt: number;
}

export interface Session {
  id: string;
  send: (m: ServerMsg) => void;
  close: (reason: CloseReason) => void;
  /** Signed-in account (from the session cookie on the WebSocket upgrade). */
  accountId?: string;
  /** Client IP of the WebSocket upgrade (admin login throttle). Unset in solo mode and tests. */
  ip?: string;
  lastActiveAt: number;
  idleWarned: boolean;
  profile?: StoredProfile;
  instance?: Instance;
  avatar?: AvatarState;
  scene?: SceneState;
  mg?: CorreriaRun;
  /** Feira cart game in progress (apps/server/src/feiraGames.ts). Separate from Correria so the two never share a slot. */
  feiraGame?: FeiraGameRun;
  /** Browser offset (minutes east of UTC) from the hello. Stored on the profile when it attaches (playerDay.ts). */
  tz?: number;
  /** The cast out at the Praia (pesca.ts): one at a time per session. */
  pesca?: PescaCastRun;
  /** When this session last cast (the 2 s spacing), and the spot it has open. */
  pescaSpot?: { spotId: string; lastCastAt: number };
  /** Treino no tatame: the bout in progress (apps/server/src/bout.ts). */
  bout?: BoutSession;
  chatTimes: number[];
  lastHintAt: number;
  /** Snack, drink, or empty in hand (session only; cleared on disconnect). Never a cosmetic. */
  carry: CarryId | null;
  /** Hidden admin panel unlocked for this socket (password checked server-side). */
  admin?: boolean;
  /**
   * Forwarded into the chat safety classifier (the same object chat and pet names use).
   * Unset in production: the live game is 18+, and the under-13 hold is design-only until a real age path exists.
   * Tests set it so a model-down warn is held instead of accepted.
   */
  under13?: boolean;
}

const INSTANCE_SUFFIX = ['Norte', 'Sul', 'Leste', 'Oeste'];

export class Instance {
  readonly members = new Map<string, Session>();
  /** Ambiance CPUs (Praça, Academia). Not members, so they never take a player seat. */
  crowd?: CpuCrowd;
  /** The last walk of each NPC that was broadcast here (`NpcPose.legId`), so the tick only sends what changed. */
  readonly npcSeen = new Map<NpcId, string>();
  /** The last few delivered chat lines (oldest first): context for the Jev model. */
  readonly recentChat: { playerId: string; text: string }[] = [];
  /** A longer, timestamped tail of delivered lines: what a report snapshots (never the reporter's copy). */
  readonly chatLog: ChatLogLine[] = [];
  constructor(
    readonly id: string,
    readonly def: RoomDef,
    readonly name: string,
    readonly ownerId: string | null,
  ) {}
}

const EMOTES: EmoteKind[] = ['oi', 'dancar', 'rir', 'valeu', 'desculpa'];
/** “oi” / “olá” in chat counts as greeting someone for the kiosk mission. */
const GREETING = /(^|[^\p{L}])(oi|ol[aá])($|[^\p{L}])/iu;

/** How long a dropped connection can reclaim the open Correria shift (alias for older tests). */
export const MG_RESUME_MS = CORRERIA_RESUME_MS;

export class World {
  readonly sessions = new Map<string, Session>();
  private instances = new Map<string, Instance>();
  /** Pending friend requests (persisted on the target's profile). */
  private readonly friendReqs: FriendRequests;
  private readonly reportLimiter = new ReportLimiter();
  /** Room cap from the host (env `ROOM_CAP`). The dashboard's `roomCap` override wins when set. */
  private readonly baseCap: number;
  readonly config: GameConfig;
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => void;
  private readonly ambiance: boolean;
  private readonly rng: () => number;
  private readonly testRollHints: boolean;
  private readonly bouts: BoutEngine;
  private clockOffsetMs: number;
  /** Shared weather pin for every client (`null` = natural roll from the game day). */
  private weatherPin: Weather | null = null;
  /** Server-side admin password, or null when the panel is off. */
  private readonly adminPassword: string | null;
  private readonly adminGuard: AdminLoginGuard;
  /** The neighbours: schedules, positions, walks (pure function of the game clock). */
  private readonly npcs: NpcDirector;
  private npcTicking = false;
  private readonly accounts?: AccountLink;
  private readonly baseIdleKickMs: number;
  private seq = 0;
  /** Recados, bag and bonds (HOWTO Phase 8). The world only reports events to it. */
  private readonly recados: RecadoTracker;
  private readonly cartela: CartelaTracker;
  /** Caderno de palavras: what the player saw, heard and used (Phase 7). */
  private readonly caderno: CadernoTracker;
  /** Language diary: camera, signs, conversation lines, and the escola game. */
  private readonly diary: DiaryTracker;
  /** Pet Shop do Seu Dito: adoption, the lojinha, the pens (#234). */
  private readonly petShop: PetShopSystem;
  /** Dona Lúcia's lessons: spaced repetition over the diary, XP, streak, the nameplate tiers. */
  private readonly escola: EscolaTracker;
  /** Praça dual leaderboards (words learned + escola streak). */
  private readonly leaderboards: Leaderboards;
  /** The feira's prices and payments (Phase 9). */
  private readonly feira: FeiraCounter;
  /** Feira cart games: daily rotation, the board, medals, the crown. */
  private readonly feiraGames: FeiraGamesEngine;
  /** Correria no Balcão: shifts, clocks and parked resume (apps/server/src/correria.ts). */
  private readonly correria: CorreriaEngine;
  /** Named player academies (slice 1). Durable when the host passes a file-backed store. */
  readonly academies: AcademyStore;
  readonly padarias: PadariaStore;
  readonly padariaOwnership: boolean;
  private readonly layouts: LayoutStore;
  /** The Praia's admin switch (PRAIA-PLAN.md 1.2). */
  readonly praia: PraiaStore;
  /** Fishing at the Praia (pesca.ts). */
  private readonly pescaEngine: PescaEngine;
  /** Seu Bento's rentals (barco.ts). */
  private readonly barco: BarcoEngine;
  /** The party boat's trips (partyBoat.ts). */
  readonly parties: PartyBoats;
  /** Today's beach numbers for the dashboard (praiaStats.ts). */
  private readonly praiaStats = new PraiaStats(() => feiraBoardDay(this.now()));
  private readonly githubToken?: string;
  private readonly githubFetch?: typeof fetch;

  constructor(
    readonly store: ProfileStore,
    readonly services: Services,
    opts: WorldOptions = {},
  ) {
    this.config = opts.config ?? new GameConfig();
    this.baseCap = Math.max(1, Math.min(DEFAULT_ROOM_CAP, Number.isFinite(opts.roomCap) ? opts.roomCap! : DEFAULT_ROOM_CAP));
    this.now = opts.now ?? Date.now;
    // guarded: a throw in an NPC tick, walk, bout or Correria clock is logged instead of crashing the world
    this.schedule = opts.schedule ?? safeSchedule;
    this.friendReqs = new FriendRequests(store);
    this.ambiance = !!opts.ambiance;
    this.rng = opts.rng ?? Math.random;
    this.testRollHints = opts.testRollHints ?? readEnv('TB_TEST_ROLL') === '1';
    const envOffset = Number(readEnv('TB_TEST_CLOCK_OFFSET_MIN'));
    this.clockOffsetMs = opts.clockOffsetMs ?? (Number.isFinite(envOffset) ? envOffset * 60_000 : 0);
    if (opts.adminPassword === null) this.adminPassword = null;
    else if (typeof opts.adminPassword === 'string') this.adminPassword = opts.adminPassword;
    else {
      const cfg = readAdminAuthConfig();
      this.adminPassword = cfg.ready && cfg.password ? cfg.password : null;
    }
    this.adminGuard = opts.adminGuard ?? new AdminLoginGuard();
    this.npcs = new NpcDirector(() => this.clockNow());
    this.accounts = opts.accounts;
    this.academies = opts.academies ?? new AcademyStore(null);
    this.padarias = opts.padarias ?? new PadariaStore(null);
    this.padariaOwnership = opts.padariaOwnership ?? readEnv('TB_PADARIA_OWNERSHIP') === '1';
    this.layouts = opts.layouts ?? new LayoutStore();
    this.praia = opts.praia ?? memoryPraia();
    for (const row of this.layouts.overrides()) installRoomProps(row.room, row.objects);
    if (opts.githubToken === null) this.githubToken = undefined;
    else if (typeof opts.githubToken === 'string') this.githubToken = opts.githubToken.trim() || undefined;
    else {
      const fromEnv = readEnv('TB_GITHUB_TOKEN')?.trim();
      this.githubToken = fromEnv || undefined;
    }
    this.githubFetch = opts.githubFetch;
    this.baseIdleKickMs = Math.max(1000, opts.idleKickMs ?? IDLE_KICK_MS);
    this.cartela = new CartelaTracker({
      now: () => this.now(),
      store,
      reward: (s, amount, reason) => this.reward(s, amount, reason),
      pushProfile: (s) => this.pushProfile(s),
    });
    this.recados = new RecadoTracker({
      now: () => this.clockNow(),
      store,
      reward: (s, amount, reason) => this.reward(s, amount, reason),
      pushProfile: (s) => this.pushProfile(s),
      tileOf: (s) => this.currentTile(s).tile,
      npcsIn: (room) => this.npcs.whoIn(room),
      onRead: (s, h) => {
        this.caderno.seen(s, h.pt, h.cards);
        this.diary.onSign(s, h.id);
      },
    });
    this.feira = new FeiraCounter({
      now: () => this.now(),
      store,
      reward: (s, a, r) => this.reward(s, a, r),
      pushProfile: (s) => this.pushProfile(s),
      tileOf: (s) => this.currentTile(s).tile,
      npcsIn: (room) => this.npcs.whoIn(room),
      ordered: (s, npc, items) => this.recados.onEvent(s, { kind: 'ordered', npc, items }),
    });
    this.feiraGames = new FeiraGamesEngine({
      now: () => this.now(),
      store,
      games: opts.feiraGames ?? new FeiraGamesStore(() => null, () => {}, () => this.now()),
      cart: opts.feiraCart ?? memoryFeiraCart(),
      reward: (s, a, r) => this.reward(s, a, r),
      pushProfile: (s) => this.pushProfile(s),
      err: (s, code, pt, en) => this.err(s, code, pt, en),
      tileOf: (s) => {
        if (!s.instance || !s.avatar) return null;
        const t = this.currentTile(s).tile;
        return { x: t.x, y: t.y, room: s.instance.def.id };
      },
      broadcastAll: (m) => {
        for (const sess of this.sessions.values()) sess.send(m);
      },
      broadcastAvatar: (s) => this.broadcastAvatar(s),
      rng: () => this.rng(),
      pin: opts.feiraPin,
    });
    this.caderno = new CadernoTracker({ now: () => this.now(), store, pushProfile: (s) => this.pushProfile(s) });
    this.diary = new DiaryTracker({
      store,
      reward: (s, a, r) => this.reward(s, a, r),
      pushProfile: (s) => this.pushProfile(s),
      pushPhotos: (s) => this.pushPhotos(s),
      err: (s, code, pt, en) => this.err(s, code, pt, en),
      tileOf: (s) => this.currentTile(s).tile,
      roomOf: (s) => s.instance?.def.id ?? null,
      npcsIn: (room) => this.npcs.whoIn(room),
      apartmentOf: (s) => {
        if (s.instance?.def.id !== 'kitnet') return [];
        const owner = s.instance.ownerId;
        return (owner ? this.store.get(owner)?.apartment : undefined) ?? [];
      },
      rng: () => this.rng(),
      now: () => this.now(),
      day: () => gameDay(this.clockNow()),
      onWord: (s, word) => this.escola.onWord(s, word),
    });
    this.petShop = new PetShopSystem({
      store,
      err: (s, code, pt, en) => this.err(s, code, pt, en),
      pushProfile: (s) => this.pushProfile(s),
      broadcastAvatar: (s) => this.broadcastAvatar(s),
      tileOf: (s) => this.currentTile(s).tile,
      roomOf: (s) => s.instance?.def.id ?? null,
      now: () => this.now(),
      day: () => gameDay(this.clockNow()),
      moderateName: (s, raw) => this.moderatePetName(s, raw),
      earnLine: (s, anchor) => this.diary.earnLine(s, anchor),
      homePetsChanged: (ownerId) => this.sendHomePets(ownerId),
    });
    this.pescaEngine = new PescaEngine({
      now: () => this.now(),
      rng: () => this.rng(),
      save: (p) => this.store.save(p.id),
      pushProfile: (s) => this.pushProfile(s as Session),
      err: (s, code, pt, en) => this.err(s as Session, code, pt, en),
      tileOf: (s) => this.currentTile(s as Session).tile,
      reward: (s, rv, reason) => this.reward(s as Session, rv, reason),
      teach: (s, words) => this.diary.teachPesca(s as Session, words),
      weather: () => this.weatherPin ?? weatherAt(this.clockNow()),
      minute: () => gameMinutes(this.clockNow()),
      day: (p) => this.dayOf(p),
      saleCap: () => this.config.get('pescaSaleCapRv'),
      pinned: opts.pescaPin ?? readEnv('TB_TEST_PESCA') === '1',
      aboardParty: (s) => this.aboardParty(s as Session),
      onPartyCatch: (s, fish) => this.parties.onCatch(s as Session, fish),
      onBottle: () => this.praiaStats.bottle(),
      onCaught: (fish) => this.praiaStats.caught(fish),
      onSold: (rv) => this.praiaStats.sold(rv),
    });
    this.barco = new BarcoEngine({
      now: () => this.now(),
      save: (p) => this.store.save(p.id),
      pushProfile: (s) => this.pushProfile(s as Session),
      err: (s, code, pt, en) => this.err(s as Session, code, pt, en),
      tileOf: (s) => this.currentTile(s as Session).tile,
      schedule: (fn, ms) => this.schedule(fn, ms),
      teach: (s, words) => this.diary.teachPesca(s as Session, words),
      price: (tier) => this.config.get(tier === 'remo' ? 'boatRemoRv' : tier === 'pesca' ? 'boatPescaRv' : tier === 'alto_mar' ? 'boatAltoMarRv' : 'boatFestaRv'),
      tripMs: () => this.config.get('tripMinutes') * 60_000,
      partyBoat: () => this.praia.config().partyBoat,
      dropCast: (s) => this.pescaEngine.dropCast(s),
      sessionOf: (id) => this.sessionByProfile(id),
      onRent: (tier) => this.praiaStats.rented(tier),
    });
    const pescaPinned = opts.pescaPin ?? readEnv('TB_TEST_PESCA') === '1';
    this.parties = new PartyBoats({
      now: () => this.now(),
      schedule: (fn, ms) => this.schedule(fn, ms),
      profile: (id) => this.store.get(id),
      save: (...ids) => this.store.save(...ids),
      sessionOf: (id) => this.sessionByProfile(id),
      pushProfile: (s) => this.pushProfile(s as Session),
      err: (s, code, pt, en) => this.err(s as Session, code, pt, en),
      teach: (s, words) => this.diary.teachPesca(s as Session, words),
      board: (s, tripId) => {
        this.join(s as Session, 'barco_festa', { instanceId: tripId });
        return s.instance?.id === tripId;
      },
      ashore: (s) => {
        const sess = s as Session;
        if (this.praiaOpenFor(sess)) this.join(sess, 'praia', {}, { tile: { ...PRAIA_PARTY_PIER }, dir: 'SW' });
        else this.join(sess, 'rua_leste', {}, { tile: { x: 5, y: 13 }, dir: 'SW' });
      },
      nearBoat: (s) => this.barco.nearShack(s as Session),
      busy: (s) => {
        const sess = s as Session;
        return !!sess.bout || !!sess.feiraGame || !!this.correria.shiftOf(sess);
      },
      enabled: () => this.praia.config().partyBoat,
      price: () => this.config.get('boatFestaRv'),
      cap: () => this.config.get('partyBoatCap'),
      tripMs: () => this.config.get('partyTripMinutes') * 60_000,
      companyMs: () => (pescaPinned ? 5_000 : 5 * 60_000),
      minute: () => gameMinutes(this.clockNow()),
      avatarChanged: (s) => this.broadcastAvatar(s as Session),
      onTrip: () => this.praiaStats.rented('festa'),
    });
    this.escola = new EscolaTracker({
      store,
      reward: (s, a, r) => this.reward(s, a, r),
      pushProfile: (s) => this.pushProfile(s),
      tileOf: (s) => this.currentTile(s).tile,
      roomOf: (s) => s.instance?.def.id ?? null,
      npcsIn: (room) => this.npcs.whoIn(room),
      rng: () => this.rng(),
      now: () => this.now(),
      avatarChanged: (s) => this.broadcastAvatar(s),
      tellRoom: (s, pt, en) => {
        if (s.instance) this.broadcast(s.instance, { t: 'notice', level: 'info', pt, en }, s);
      },
      teachLessonWord: (s, gameId) => this.diary.teachLessonWord(s, gameId),
    });
    this.leaderboards = new Leaderboards(store, () => this.rng(), () => this.now());
    this.bouts = new BoutEngine({
      now: () => this.now(),
      schedule: (fn, ms) => this.schedule(fn, ms),
      rng: () => this.rng(),
      store,
      testHints: this.testRollHints,
      pace: opts.boutPace ?? (Number(readEnv('TB_TEST_BOUT_PACE')) > 0 ? Number(readEnv('TB_TEST_BOUT_PACE')) : this.testRollHints ? 0.35 : 1),
      introMs: opts.boutIntroMs ?? (Number.isFinite(Number(readEnv('TB_TEST_BOUT_INTRO_MS'))) && readEnv('TB_TEST_BOUT_INTRO_MS') ? Number(readEnv('TB_TEST_BOUT_INTRO_MS')) : undefined),
      reward: (s, a, r) => this.reward(s, a, r),
      pushProfile: (s) => this.pushProfile(s),
      bond: (s, n) => this.recados.grantBond(s, 'prof', n),
      caderno: {
        seen: (s, text, ids) => this.caderno.seen(s, text, ids),
        used: (s, text) => this.caderno.used(s, text),
        heard: (s, ids) => this.caderno.heard(s, ids),
      },
      err: (s, code, pt, en) => this.err(s, code, pt, en),
      avatarChanged: (s) => this.broadcastAvatar(s),
      onBoutComplete: (s, played) => this.cartela.onBoutEnd(s, played),
    });
    this.correria = new CorreriaEngine({
      now: () => this.now(),
      schedule: (fn, ms) => this.schedule(fn, ms),
      store,
      clock: () => {
        const minute = gameMinutes(this.clockNow());
        return { minute, saturday: weekday(gameDay(this.clockNow())).short === 'Sáb', baker: bakerOnDuty(minute) === 'graca' ? 'graca' : 'carlos' };
      },
      reward: (s, a, r) => this.reward(s, a, r),
      pushProfile: (s) => this.pushProfile(s),
      completeStep: (s) => this.completeStep(s, 'meveum'),
      missionStep: (s) => this.missionStep(s, 'monta'),
      cartelaShift: (s, served) => this.cartela.onCorreriaEnd(s, served),
      shiftWon: (s, items) => this.diary.onCorreriaWin(s, items),
      ordered: (s, items) => this.recados.onEvent(s, { kind: 'ordered', npc: 'carlos', items }),
      bond: (s, npc, n) => this.recados.grantBond(s, npc, n),
      caderno: { seen: (s, text, ids) => this.caderno.seen(s, text, ids), heard: (s, ids) => this.caderno.heard(s, ids) },
      record: (s, itemIds, listening, score, latencyMs) =>
        this.services.student.record({ playerId: s.profile!.id, itemIds, channel: listening ? 'listen' : 'read', score, latencyMs, place: 'padaria', nameplate: s.profile!.nameplate, at: this.now() }),
      err: (s, code, pt, en) => this.err(s, code, pt, en),
      ownedMenu: (s) => this.ownedCorreriaMenu(s),
      ownedName: (s) => this.floorPadaria(s)?.name,
      allowOwnedShift: (s) => this.correriaAllowed(s),
      testHints: opts.testMg ?? readEnv('TB_TEST_MG') === '1',
    });
  }

  private get cap(): number {
    return this.config.isOverridden('roomCap') ? this.config.get('roomCap') : this.baseCap;
  }

  /** No real input for this long and the player is kicked. The dashboard's `idleKickMinutes` override wins when set. */
  get idleKickMs(): number {
    return this.config.isOverridden('idleKickMinutes') ? this.config.get('idleKickMinutes') * 60_000 : this.baseIdleKickMs;
  }

  // ---------- connection lifecycle ----------

  connect(id: string, send: (m: ServerMsg) => void, close: (reason: CloseReason) => void, auth: { accountId?: string; ip?: string } = {}): Session {
    const s: Session = { id, send, close, accountId: auth.accountId, ip: auth.ip, lastActiveAt: this.now(), idleWarned: false, chatTimes: [], lastHintAt: 0, carry: null };
    this.sessions.set(id, s);
    return s;
  }

  disconnect(s: Session) {
    if (this.sessions.get(s.id) !== s) return;
    this.correria.park(s);
    this.escola.drop(s);
    this.leaveInstance(s);
    this.sessions.delete(s.id);
    if (s.profile) {
      s.profile.lastSeen = this.now();
      this.store.save(s.profile.id);
      this.notifyFriendsOfPresence(s.profile.id);
    }
  }

  /**
   * Server-authoritative AFK check (call every few seconds). Only players in the world count: a
   * socket still on the login / avatar screen holds no seat. Client pings don't reset the clock.
   */
  /** Lazy board-day roll (UTC): finalize yesterday's Feira board (medals, clear crown) if the day key rolled. */
  sweepFeiraGames() {
    const { rolled, awards } = this.feiraGames.tick();
    if (rolled) this.feiraGames.pushRolled([...this.sessions.values()], awards);
  }

  sweepIdle() {
    const t = this.now();
    const warnWindow = Math.min(IDLE_WARN_MS, Math.floor(this.idleKickMs / 2));
    const warnAt = this.idleKickMs - warnWindow;
    for (const s of [...this.sessions.values()]) {
      if (!s.profile) continue;
      const idle = t - s.lastActiveAt;
      if (idle >= this.idleKickMs) {
        this.kick(s, 'idle', { t: 'kicked', reason: 'idle', ...idleKickedCopy(this.idleKickMs) });
      } else if (idle >= warnAt && !s.idleWarned) {
        s.idleWarned = true;
        const msLeft = this.idleKickMs - idle;
        // Copy says the nominal window ("1 minuto"); the sweep cadence makes the exact figure wobble.
        s.send({ t: 'idleWarning', msLeft, ...idleWarningCopy(warnWindow) });
      }
    }
    this.parties.sweep();
    this.pruneMemory();
  }

  /** Drop per-player memory nobody can use any more (stats of players who left, expired Correria parks). */
  private pruneMemory() {
    const live = new Set<string>();
    for (const s of this.sessions.values()) if (s.profile) live.add(s.profile.id);
    this.services.student.prune?.(live);
    this.correria.prune();
  }

  /** Close every live socket of an account (used on logout). */
  dropAccount(accountId: string) {
    for (const s of [...this.sessions.values()]) if (s.accountId === accountId) this.kick(s, 'logout');
  }

  /** Account deletion (accountDelete.ts): close its sockets and rebuild the boards that may show its character. */
  forgetAccount(accountId: string, profileId?: string) {
    this.dropAccount(accountId);
    if (profileId) {
      this.friendReqs.forget(profileId);
    }
    this.leaderboards.markDirty();
  }

  private kick(s: Session, reason: CloseReason, last?: ServerMsg) {
    if (last) s.send(last);
    this.disconnect(s);
    s.profile = undefined;
    s.close(reason);
  }

  private markActive(s: Session) {
    s.lastActiveAt = this.now();
    s.idleWarned = false;
  }

  stats() {
    const rooms: Record<string, number> = {};
    const cpus: Record<string, number> = {};
    for (const i of this.instances.values()) {
      rooms[i.id] = i.members.size;
      if (i.crowd) cpus[i.id] = i.crowd.size;
    }
    return { players: [...this.sessions.values()].filter((s) => s.profile).length, instances: rooms, ambiance: this.ambiance ? cpus : 'off', profiles: this.store.count() };
  }

  async handle(s: Session, msg: ClientMsg): Promise<void> {
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
    if (this.sessions.get(s.id) !== s) return;
    if (msg.t === 'ping') return s.send({ t: 'pong' });
    if (isRealInput(msg)) this.markActive(s);
    if (msg.t === 'hello') return this.hello(s, msg.token, msg.tz);
    if (msg.t === 'createProfile') return this.createProfile(s, msg);
    if (!s.profile) return this.err(s, 'no_profile', 'Crie seu avatar primeiro.', 'Create your avatar first.');
    switch (msg.t) {
      case 'active':
        return;
      case 'updateAppearance':
        return this.updateAppearance(s, msg.appearance);
      case 'join':
        return this.join(s, msg.room, { instanceId: msg.instanceId, ownerId: msg.ownerId });
      case 'move':
        return this.move(s, msg.x, msg.y, !!msg.sit);
      case 'stand':
        return this.stand(s);
      case 'emote':
        return this.emote(s, msg.kind);
      case 'chat':
        return this.chat(s, msg.text);
      case 'report':
        return this.report(s, msg.targetId, msg.reason);
      case 'block':
        return this.block(s, msg.action, msg.targetId);
      case 'portal':
        return this.portal(s, msg.portalId);
      case 'scene':
        return this.scene(s, msg);
      case 'mg':
        return this.minigame(s, msg);
      case 'buy':
        return this.buy(s, msg.kind, msg.itemId);
      case 'snack':
        return this.buySnack(s, msg.itemId);
      case 'pesca':
        return this.pescaEngine.handle(s, msg);
      case 'barco':
        return this.barco.handle(s, msg);
      case 'party':
        return this.parties.handle(s, msg);
      case 'padaria':
        return this.buyCounter(s, msg.itemId);
      case 'carry':
        return this.useCarry(s, msg.action);
      case 'equipHat':
        return this.equipHat(s, msg.hatId);
      case 'parrot':
        return this.parrot(s, msg.action, msg.colorId);
      case 'perk':
        return this.perk(s, msg);
      case 'pet':
        return this.petShop.handle(s, msg);
      case 'furniture':
        return this.furniture(s, msg);
      case 'friend':
        return this.friend(s, msg.action, msg.targetId);
      case 'friends':
        return this.sendFriends(s);
      case 'leaderboards':
        return this.leaderboards.sendTo(s);
      case 'mission':
        return this.takeMission(s);
      case 'bout':
        return this.bouts.handle(s, msg);
      case 'give':
        return this.recados.give(s, msg.npc, msg.itemId);
      case 'read':
        return this.recados.read(s, msg.hotspotId);
      case 'recados':
        return this.recados.request(s, msg.action, msg.id);
      case 'feira':
        return msg.action === 'price' ? this.feira.price(s, msg.vendor, msg.itemId) : msg.action === 'pay' ? this.feira.pay(s, msg.vendor, msg.itemId, msg.qty, msg.paid) : undefined;
      case 'feiraGame':
        return this.feiraGames.handle(s, msg);
      case 'heard':
        return this.caderno.heard(s, msg.cardIds);
      case 'arrival':
        if (msg.action === 'landed') return this.landed(s);
        return msg.action === 'replay' ? this.diary.replayArrival(s) : this.diary.finishArrival(s);
      case 'grant':
        return this.giveGrant(s, msg.id);
      case 'diary':
        return this.diary.handle(s, msg);
      case 'escola':
        return this.escola.handle(s, msg);
      case 'talk':
        if (this.recados.talk(s, msg.npc)) this.caderno.seen(s, talkOpener(msg.npc, s.profile?.name, gameMinutes(this.clockNow())) ?? '');
        return;
      case 'papo':
        // a bate-papo talked through (never graded): a talk, a little bond once a day, and the cartela stamp when it was in the praça
        if (this.recados.papoDone(s, msg.npc, msg.id)) this.cartela.onPapoDone(s);
        return;
      case 'admin':
        return this.admin(s, msg);
      case 'academy':
        return this.academy(s, msg);
      case 'padariaOwn':
        return this.padariaOwn(s, msg);
    }
  }

  // ---------- player academies (slice 1) ----------

  private academy(s: Session, msg: Extract<ClientMsg, { t: 'academy' }>) {
    if (msg.action === 'directory') return this.academyDirectory(s);
    if (msg.action === 'found') return this.foundAcademy(s, msg);
    if (msg.action === 'visit') return this.visitAcademy(s, msg.id);
    if (msg.action === 'join') return this.joinAcademy(s, msg.id);
    if (msg.action === 'leave') return this.leaveAcademy(s, msg.id);
    return this.lookAcademy(s, msg);
  }

  private inFlagship(s: Session) {
    return s.instance?.def.id === 'academia';
  }

  private academyDirectory(s: Session) {
    if (!this.inFlagship(s)) return this.err(s, 'academy', 'O elevador fica na Academia do Bairro.', 'The elevator is in Academia do Bairro.');
    const id = s.profile!.id;
    s.send({
      t: 'academy',
      phase: 'directory',
      rows: this.academies.list().map((a) => academyCard(a, this.store.get(a.ownerId)?.name ?? '—', id)),
      canFound: canFoundAcademy(s.profile!.bjj),
      ownedId: this.academies.ownedBy(id)?.id ?? null,
    });
  }

  private foundAcademy(s: Session, msg: Extract<ClientMsg, { t: 'academy'; action: 'found' }>) {
    if (!this.inFlagship(s)) return this.err(s, 'academy', 'O elevador fica na Academia do Bairro.', 'The elevator is in Academia do Bairro.');
    const p = s.profile!;
    if (!canFoundAcademy(p.bjj)) return this.err(s, 'belt', 'Fundar academia é da faixa marrom.', 'Founding an academy takes a brown belt.');
    if (this.academies.ownedBy(p.id)) return this.err(s, 'owned', 'Você já fundou uma academia.', 'You already founded an academy.');
    const named = validateAcademyName(msg.name);
    if (!named.ok) return this.err(s, 'name', named.reason.pt, named.reason.en);
    if (this.academies.byNameKey(named.key)) return this.err(s, 'name', 'Esse nome já é de outra academia.', 'That name already belongs to another academy.');
    if (!isCrestId(msg.crest) || !isGiColorId(msg.giColor) || !isCrestId(msg.giStamp))
      return this.err(s, 'look', 'Escolha um brasão e um kimono.', 'Pick a crest and a gi.');
    const row: PlayerAcademy = {
      id: this.academies.newId(),
      name: named.name,
      nameKey: named.key,
      ownerId: p.id,
      crest: msg.crest,
      giColor: msg.giColor,
      giStamp: msg.giStamp,
      members: [p.id],
      createdAt: this.now(),
    };
    this.academies.add(row);
    this.visitAcademy(s, row.id);
  }

  private visitAcademy(s: Session, id: string) {
    if (!this.academies.get(String(id ?? ''))) return this.err(s, 'academy', 'Essa academia não existe.', 'That academy does not exist.');
    this.join(s, 'andar', { academyId: id });
  }

  private joinAcademy(s: Session, id: string) {
    const row = this.academies.get(String(id ?? ''));
    if (!row) return this.err(s, 'academy', 'Essa academia não existe.', 'That academy does not exist.');
    const pid = s.profile!.id;
    if (!row.members.includes(pid)) {
      row.members.push(pid);
      this.academies.save();
    }
    this.visitAcademy(s, row.id);
    this.pushFloor(row.id);
  }

  private leaveAcademy(s: Session, id: string) {
    const row = this.academies.get(String(id ?? ''));
    if (!row) return this.err(s, 'academy', 'Essa academia não existe.', 'That academy does not exist.');
    const pid = s.profile!.id;
    if (row.ownerId === pid) return this.err(s, 'owner', 'Quem fundou não sai da academia.', 'The founder does not leave the academy.');
    row.members = row.members.filter((m) => m !== pid);
    this.academies.save();
    this.pushFloor(row.id);
    if (this.inFlagship(s)) this.academyDirectory(s);
  }

  private lookAcademy(s: Session, msg: Extract<ClientMsg, { t: 'academy'; action: 'look' }>) {
    const row = this.academies.get(String(msg.id ?? ''));
    if (!row) return this.err(s, 'academy', 'Essa academia não existe.', 'That academy does not exist.');
    if (row.ownerId !== s.profile!.id) return this.err(s, 'owner', 'Só quem fundou muda o brasão e o kimono.', 'Only the founder changes the crest and the gi.');
    if (!isCrestId(msg.crest) || !isGiColorId(msg.giColor) || !isCrestId(msg.giStamp))
      return this.err(s, 'look', 'Escolha um brasão e um kimono.', 'Pick a crest and a gi.');
    row.crest = msg.crest;
    row.giColor = msg.giColor;
    row.giStamp = msg.giStamp;
    this.academies.save();
    this.pushFloor(row.id);
    if (this.inFlagship(s)) this.academyDirectory(s);
  }

  /** Tell everyone on the floor about the crest, the gi, and who is wearing it. */
  private pushFloor(academyId: string) {
    const row = this.academies.get(academyId);
    const inst = this.instances.get(academyInstanceId(academyId));
    if (!row || !inst) return;
    for (const m of inst.members.values()) {
      const id = m.profile?.id;
      if (!id) continue;
      m.send({ t: 'academy', phase: 'floor', academy: academyCard(row, this.store.get(row.ownerId)?.name ?? '—', id) });
    }
    for (const m of inst.members.values()) this.broadcast(inst, { t: 'avatarUpdated', avatar: this.publicAvatar(m) });
  }

  // ---------- player-owned padarias (Fundar) ----------

  private padariaOwn(s: Session, msg: Extract<ClientMsg, { t: 'padariaOwn' }>) {
    if (!this.padariaOwnership) return this.err(s, 'padaria', 'Em breve.', 'Coming soon.');
    if (msg.action === 'door') return this.padariaDoor(s);
    if (msg.action === 'found') return this.foundPadaria(s, msg.name);
    if (msg.action === 'visit') return this.visitPadaria(s, msg.id ?? this.padarias.ownedBy(s.profile!.id)?.id ?? '');
    if (msg.action === 'upgrade') return this.upgradePadaria(s, msg.kind);
    return this.err(s, 'padaria', 'Ação desconhecida.', 'Unknown action.');
  }

  private atPadariaDoor(s: Session) {
    return isPadariaDoorRoom(s.instance?.def.id, s.instance?.id);
  }

  private padariaDoor(s: Session) {
    if (!this.atPadariaDoor(s)) return this.err(s, 'padaria', 'O cofre da porta fica na fachada da padaria.', 'The door fund is at the bakery facade.');
    const p = s.profile!;
    const owned = this.padarias.ownedBy(p.id);
    s.send({
      t: 'padariaOwn',
      phase: 'door',
      enabled: true,
      door: padariaDoorState(p.coins, owned),
      rows: this.padarias.list().map((row) => padariaCard(row, this.store.get(row.ownerId)?.name ?? '—', p.id)),
    });
  }

  private foundPadaria(s: Session, rawName: string) {
    if (!this.atPadariaDoor(s)) return this.err(s, 'padaria', 'Fundar é na porta da padaria.', 'Found your bakery at the door.');
    const p = s.profile!;
    if (this.padarias.ownedBy(p.id)) return this.err(s, 'owned', 'Você já fundou uma padaria.', 'You already founded a bakery.');
    const named = validatePadariaName(rawName);
    if (!named.ok) return this.err(s, 'name', named.reason.pt, named.reason.en);
    if (this.padarias.byNameKey(named.key)) return this.err(s, 'name', 'Esse nome já é de outra padaria.', 'That name already belongs to another bakery.');
    const cost = fundarCostRv();
    if (p.coins < cost) return this.err(s, 'coins', 'Faltam reais virtuais para a porta.', 'Not enough RV for the door yet.');
    p.coins -= cost;
    if (!p.hats.includes(PADARIA_FOUNDER_HAT)) p.hats.push(PADARIA_FOUNDER_HAT);
    p.hat = PADARIA_FOUNDER_HAT;
    const row: PlayerPadaria = {
      id: this.padarias.newId(),
      name: named.name,
      nameKey: named.key,
      ownerId: p.id,
      size: 1,
      sweets: {},
      createdAt: this.now(),
    };
    this.padarias.add(row);
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
    s.send({ t: 'notice', level: 'reward', pt: `${row.name}: porta aberta! Chapéu de padeiro na cabeça.`, en: `${row.name} is open! Baker’s hat on.` });
    this.visitPadaria(s, row.id);
  }

  private visitPadaria(s: Session, id: string) {
    const row = this.padarias.get(String(id ?? ''));
    if (!row) return this.err(s, 'padaria', 'Essa padaria não existe.', 'That bakery does not exist.');
    this.join(s, 'padaria', { padariaId: row.id });
  }

  private upgradePadaria(s: Session, kind: Extract<ClientMsg, { t: 'padariaOwn'; action: 'upgrade' }>['kind']) {
    const row = this.floorPadaria(s);
    if (!row) return this.err(s, 'padaria', 'Compre upgrades na sua padaria.', 'Buy upgrades inside your bakery.');
    if (row.ownerId !== s.profile!.id) return this.err(s, 'owner', 'Só quem fundou compra upgrades.', 'Only the founder buys upgrades.');
    const p = s.profile!;
    const check = checkPadariaUpgrade(row, kind);
    if (!check.ok) return this.err(s, check.code, check.reason.pt, check.reason.en);
    // charge before changing the row: a short owner must not get the upgrade
    if (p.coins < check.cost) return this.err(s, 'coins', `Faltam ${check.cost - p.coins} RV.`, `${check.cost - p.coins} RV short.`);
    p.coins -= check.cost;
    applyPadariaUpgrade(row, kind);
    this.padarias.save();
    this.store.save(p.id);
    this.pushProfile(s);
    // a new size is a bigger room: everyone inside walks into it (the join carries the new card); a sweet only updates the floor
    if (kind === 'size2' || kind === 'size3') this.regrowPadaria(row.id);
    else this.pushPadariaFloor(row.id);
    if (kind === 'size2' || kind === 'size3')
      s.send({ t: 'notice', level: 'reward', pt: `${row.name} cresceu: agora é ${check.label.pt}!`, en: `${row.name} grew: now a ${check.label.en.toLowerCase()}!` });
    else s.send({ t: 'notice', level: 'reward', pt: `${check.label.pt} na vitrine!`, en: `${check.label.en} in the case!` });
  }

  /** The padaria grew: whoever is in it moves into the bigger room, where they stood if that tile is still free, else at the door. */
  private regrowPadaria(padariaId: string) {
    const inst = this.instances.get(padariaInstanceId(padariaId));
    const row = this.padarias.get(padariaId);
    if (!inst || !row) return;
    const grid = buildGrid(padariaCasaRoom(row.size));
    for (const m of [...inst.members.values()]) {
      const here = m.avatar ? this.currentTile(m) : null;
      const stay = here && isWalkable(grid, here.tile.x, here.tile.y) ? { tile: here.tile, dir: here.dir } : undefined;
      this.join(m, 'padaria', { padariaId }, stay);
    }
  }

  private pushPadariaFloor(padariaId: string) {
    const row = this.padarias.get(padariaId);
    const inst = this.instances.get(padariaInstanceId(padariaId));
    if (!row || !inst) return;
    for (const m of inst.members.values()) {
      const id = m.profile?.id;
      if (!id) continue;
      m.send({ t: 'padariaOwn', phase: 'floor', padaria: padariaCard(row, this.store.get(row.ownerId)?.name ?? '—', id) });
    }
  }

  private floorPadaria(s: Session): PlayerPadaria | undefined {
    if (s.instance?.def.id !== 'padaria') return undefined;
    const id = padariaIdFromInstance(s.instance.id);
    return id ? this.padarias.get(id) : undefined;
  }

  private floorPadariaCard(inst: Instance, s: Session): PadariaCard | undefined {
    const id = padariaIdFromInstance(inst.id);
    const row = id ? this.padarias.get(id) : undefined;
    if (!row || !s.profile) return undefined;
    return padariaCard(row, this.store.get(row.ownerId)?.name ?? '—', s.profile.id);
  }

  private ownedCorreriaMenu(s: Session): readonly string[] | undefined {
    const row = this.floorPadaria(s);
    if (!row) return undefined;
    return ownedCorreriaMenuIds(row);
  }

  /** Shared shard only when flag-off or not an owned instance id. */
  private correriaAllowed(s: Session): boolean {
    if (s.instance?.def.id !== 'padaria') return false;
    const ownedId = padariaIdFromInstance(s.instance.id);
    if (!ownedId) return true;
    return this.padariaOwnership;
  }

  // ---------- profile ----------

  private hello(s: Session, token?: string, tz?: unknown) {
    if (typeof tz === 'number' && Number.isFinite(tz)) s.tz = tz;
    // Profiles from before the 18+ policy never confirmed adulthood; they must sign up again.
    const fromToken = this.store.byTokenGet(token);
    const tokenProfile = fromToken?.ageGate18 === true ? fromToken : undefined;
    if (!this.accounts) {
      if (tokenProfile) return this.attachProfile(s, tokenProfile);
      return s.send({ t: 'needProfile' });
    }
    // Multiplayer is account-only: no session, no avatar (the intro's guest path stays in solo builds).
    if (!s.accountId) return s.send({ t: 'authRequired' });
    const owned = this.store.get(this.accounts.profileIdFor(s.accountId) ?? '');
    if (owned) return this.attachProfile(s, owned);
    // First sign-in from a browser that played before accounts: that avatar joins the account, once.
    if (tokenProfile && !tokenProfile.accountId) {
      this.linkAccount(s.accountId, tokenProfile);
      return this.attachProfile(s, tokenProfile);
    }
    s.send({ t: 'needProfile' });
  }

  /** The browser's offset from the hello becomes the profile's one stored offset (`escola.tz`), unless it would move today back. */
  private applyTz(s: Session, p: StoredProfile) {
    if (s.tz === undefined) return;
    const st = escolaOf(p);
    const next = acceptTz(this.now(), st.tz, s.tz);
    if (next === st.tz) return;
    st.tz = next;
    this.store.save(p.id);
  }

  private linkAccount(accountId: string, p: StoredProfile) {
    p.accountId = accountId;
    this.accounts!.linkProfile(accountId, p.id);
    this.store.save(p.id);
  }

  private attachProfile(s: Session, p: StoredProfile) {
    if (p.banned) return this.kick(s, 'banned', { t: 'kicked', reason: 'banned', ...BANNED_COPY });
    for (const other of this.sessions.values()) {
      if (other !== s && other.profile?.id === p.id) {
        other.send({ t: 'notice', level: 'warn', pt: 'Você entrou em outra aba.', en: 'You signed in from another tab.' });
        this.correria.park(other);
        this.leaveInstance(other);
        other.profile = undefined;
        other.close('replaced');
      }
    }
    s.profile = p;
    this.applyTz(s, p);
    p.nameplate = this.services.student.nameplateFor(p);
    p.lastSeen = this.now();
    const layouts = this.layouts.overrides();
    const profile = this.privateProfile(p);
    if (p.replayFlight) {
      delete p.replayFlight;
      this.store.save(p.id);
    }
    s.send({
      t: 'welcome',
      profile,
      token: p.token,
      serverNow: this.personalNow(p),
      weather: this.weatherPin,
      ...(layouts.length ? { layouts } : {}),
    });
    if (p.photos?.length) this.pushPhotos(s);
    // the client starts at the default (open, party boat on): only a changed switch needs telling
    const praia = this.praia.config();
    if (praia.mode !== PRAIA_DEFAULT.mode || praia.partyBoat !== PRAIA_DEFAULT.partyBoat) s.send(this.praiaMsg(s));
    this.notifyFriendsOfPresence(p.id);
    if (this.friendReqs.incoming(p.id).length) this.sendFriends(s);
  }

  private createProfile(s: Session, m: Extract<ClientMsg, { t: 'createProfile' }>) {
    if (s.profile) return this.attachProfile(s, s.profile);
    if (this.accounts) {
      if (!s.accountId) return s.send({ t: 'authRequired' });
      const owned = this.store.get(this.accounts.profileIdFor(s.accountId) ?? '');
      if (owned) return this.attachProfile(s, owned);
    }
    const nameCheck = validateName(String(m.name ?? ''));
    if (!nameCheck.ok) return this.err(s, 'name', nameCheck.reason.pt, nameCheck.reason.en);
    const appearance = sanitizeAppearance(m.appearance);
    const pronoun = m.pronoun === 'ele' || m.pronoun === 'ela' ? m.pronoun : 'nome';
    const tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, false])) as Record<TutorialStep, boolean>;
    const p: StoredProfile = {
      id: this.store.newId(),
      token: this.store.newToken(),
      ageGate18: true,
      name: nameCheck.name,
      pronoun,
      appearance,
      nameplate: 'verde',
      coins: this.config.get('startingCoins'),
      hats: [...STARTER_HATS],
      hat: null,
      furniture: { ...STARTER_FURNITURE },
      apartment: [],
      parrotOwned: false,
      parrotEquipped: false,
      parrotColors: [],
      parrotColor: null,
      giOwned: false,
      friends: [],
      tutorial,
      tutorialRewarded: false,
      createdAt: this.now(),
      daily: { date: profileDay({ escola: { tz: s.tz } }, this.now()), sceneClears: {} },
      lastSeen: this.now(),
      // Set before save: a missing flag is treated as already home, so a new account must say false itself.
      arrivalIntroDone: false,
      // the arrivals hall comes first (the guided tutorial), then the airport
      desembarqueDone: false,
      hasCamera: false,
      diary: [],
      film: 0,
      photos: [],
      founder: founderGrantNewEnabled(),
    };
    this.store.add(p);
    if (this.accounts && s.accountId) this.linkAccount(s.accountId, p);
    this.attachProfile(s, p);
  }

  /** The arrivals hall is done (or skipped): the next login goes on to the airport. Only ever turns the flag on. */
  private landed(s: Session) {
    const p = s.profile!;
    if (p.desembarqueDone !== false) return;
    p.desembarqueDone = true;
    this.store.save(p.id);
    this.pushProfile(s);
  }

  private updateAppearance(s: Session, a: Appearance) {
    s.profile!.appearance = sanitizeAppearance(a);
    this.store.save(s.profile!.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  private pushProfile(s: Session) {
    // Diary grants and escola streak bumps both push the profile; rebuild boards next read.
    this.leaderboards.markDirty();
    if (s.profile) s.send({ t: 'profile', profile: this.privateProfile(s.profile) });
  }

  /** The profile the client sees, plus the padaria this player founded (flag-on only) so the HUD and the door can take them home. */
  private privateProfile(p: StoredProfile): PrivateProfile {
    const out = toPrivate(p, this.dayOf(p));
    const own = this.padariaOwnership ? this.padarias.ownedBy(p.id) : undefined;
    if (own) out.padaria = { id: own.id, name: own.name, size: own.size };
    return out;
  }

  /** A feature that shipped after this player already lived here. Only an owed grant changes the profile. */
  private giveGrant(s: Session, id: unknown) {
    const p = s.profile;
    if (!p || typeof id !== 'string' || id.length > 64) return;
    const result = claimGrant(p, id);
    if (!result.ok) return this.pushProfile(s);
    this.store.save(p.id);
    this.pushProfile(s);
    s.send({ t: 'notice', level: 'info', pt: result.notice.pt, en: result.notice.en });
  }

  /** The diary photos, apart from the profile (they are the heavy part): after welcome and when one is added. */
  private pushPhotos(s: Session) {
    if (s.profile) s.send({ t: 'photos', photos: s.profile.photos ?? [] });
  }

  private reward(s: Session, amount: number, reason: Bilingual) {
    if (amount <= 0 || !s.profile) return;
    s.profile.coins += amount;
    this.store.save(s.profile.id);
    s.send({ t: 'reward', amount, coins: s.profile.coins, reason });
    this.pushProfile(s);
  }

  private completeStep(s: Session, step: TutorialStep) {
    const p = s.profile!;
    if (p.tutorial[step]) return;
    p.tutorial[step] = true;
    this.store.save(p.id);
    s.send({ t: 'tutorial', step });
    this.pushProfile(s);
    if (!p.tutorialRewarded && TUTORIAL_STEPS.every((t) => p.tutorial[t.id])) {
      p.tutorialRewarded = true;
      this.reward(s, this.config.get('tutorialBonus'), { pt: 'Primeiros passos completos! Bem-vindo ao bairro!', en: 'First steps complete! Welcome to the neighborhood!' });
    }
  }

  // ---------- rooms ----------

  private instanceFor(room: RoomId, s: Session, opts: { instanceId?: string; ownerId?: string; academyId?: string; padariaId?: string }): Instance | { error: Bilingual } {
    const def = ROOMS[room];
    // the party deck: only the trip's roster, never a public shard, a full boat is a hard refusal
    if (def.id === 'barco_festa') {
      const id = s.profile!.id;
      const trip = this.parties.tripOf(id);
      const inst = trip ? this.instances.get(trip.id) : undefined;
      const ok = this.parties.admit(id, opts.instanceId, inst?.members.size ?? 0);
      if ('error' in ok) return ok;
      let deck = inst;
      if (!deck) {
        deck = new Instance(ok.trip.id, def, `${def.name} · ${this.store.get(ok.trip.hostId)?.name ?? ''}`.trim(), null);
        this.instances.set(deck.id, deck);
      }
      return deck;
    }
    if (def.id === 'andar') {
      const academyId = opts.academyId ?? academyIdFromInstance(opts.instanceId);
      const academy = academyId ? this.academies.get(academyId) : undefined;
      if (!academy) return { error: { pt: 'Escolha uma academia no elevador.', en: 'Pick an academy in the elevator.' } };
      const id = academyInstanceId(academy.id);
      let inst = this.instances.get(id);
      if (!inst) {
        inst = new Instance(id, def, academy.name, academy.ownerId);
        this.instances.set(id, inst);
      }
      if (inst.members.size >= this.cap) return { error: { pt: 'O andar está lotado!', en: 'This floor is full!' } };
      return inst;
    }
    if (def.id === 'padaria' && this.padariaOwnership) {
      const pid = opts.padariaId ?? padariaIdFromInstance(opts.instanceId);
      if (pid) {
        const row = this.padarias.get(pid);
        if (!row) return { error: { pt: 'Essa padaria não existe.', en: 'That bakery does not exist.' } };
        const id = padariaInstanceId(row.id);
        // a player's padaria is its own room, sized by what the owner bought (not a copy of Seu Carlos's)
        const casa = padariaCasaRoom(row.size);
        let inst = this.instances.get(id);
        // a padaria that grew is a new room: a fresh instance (whoever is inside walks into it, `regrowPadaria`)
        if (!inst || inst.def !== casa) {
          inst = new Instance(id, casa, row.name, row.ownerId);
          this.instances.set(id, inst);
        }
        if (inst.members.size >= this.cap) return { error: { pt: 'A padaria está lotada!', en: 'The bakery is full!' } };
        return inst;
      }
    }
    if (def.private) {
      const ownerId = opts.ownerId ?? s.profile!.id;
      const owner = this.store.get(ownerId);
      if (!owner) return { error: { pt: 'Essa kitnet não existe.', en: 'That apartment doesn’t exist.' } };
      if (ownerId !== s.profile!.id && !owner.friends.includes(s.profile!.id))
        return { error: { pt: 'Só amigos podem visitar essa kitnet.', en: 'Only friends can visit this apartment.' } };
      const id = `kitnet@${ownerId}`;
      let inst = this.instances.get(id);
      if (!inst) {
        inst = new Instance(id, def, `Kitnet de ${owner.name}`, ownerId);
        this.instances.set(id, inst);
      }
      if (inst.members.size >= this.cap) return { error: { pt: 'A kitnet está lotada!', en: 'The apartment is full!' } };
      return inst;
    }
    if (opts.instanceId) {
      const inst = this.instances.get(opts.instanceId);
      if (inst && inst.def.id === room && inst.members.size < this.cap) return inst;
    }
    for (let n = 1; ; n++) {
      const id = `${room}#${n}`;
      let inst = this.instances.get(id);
      if (!inst) {
        const suffix = INSTANCE_SUFFIX[n - 1] ?? String(n);
        inst = new Instance(id, def, `${def.name} · ${suffix}`, null);
        if (this.ambiance && ROOM_AMBIANCE[def.id]) inst.crowd = this.makeCrowd(inst);
        this.instances.set(id, inst);
      }
      if (inst.members.size < this.cap) return inst;
    }
  }

  join(s: Session, room: RoomId, opts: { instanceId?: string; ownerId?: string; academyId?: string; padariaId?: string } = {}, arrive?: { tile: Tile; dir: Dir }) {
    if (!isRoomId(room)) return this.err(s, 'room', 'Sala desconhecida.', 'Unknown room.');
    if ((room === 'praia' || room === 'barco_festa') && !this.praiaOpenFor(s)) {
      // a reconnect that remembered the beach lands at the bus stop it came from instead of nowhere
      if (!s.instance) {
        this.join(s, 'rua_leste', {}, { tile: { x: 5, y: 13 }, dir: 'SW' });
        return;
      }
      return this.err(s, 'praia', PRAIA_CLOSED.pt, PRAIA_CLOSED.en);
    }
    const target = this.instanceFor(room, s, opts);
    if ('error' in target) return this.err(s, 'join', target.error.pt, target.error.en);
    // a rented boat stays at the beach: leaving it hands the boat back
    if (s.instance?.def.id === 'praia' && room !== 'praia') this.barco.end(s, 'left');
    this.leaveInstance(s);
    const def = target.def;
    const tile = arrive?.tile ?? def.spawn;
    s.instance = target;
    s.avatar = { from: tile, path: [], start: this.now(), dir: arrive?.dir ?? 'SE', sitting: false, sitOnArrive: false, seq: 0 };
    // bring the instance's NPC bookkeeping up to date first: whoever is already here hears about any change, the joiner gets the fresh state below
    this.npcSync(target);
    target.members.set(s.id, s);
    const furniture = this.furnitureOf(target);
    s.send({
      t: 'roomState',
      room: def.id,
      instanceId: target.id,
      instanceName: target.name,
      ownerId: target.ownerId,
      ownerName: target.ownerId ? (this.store.get(target.ownerId)?.name ?? null) : null,
      cap: this.cap,
      selfId: s.profile!.id,
      avatars: [...[...target.members.values()].map((m) => this.publicAvatar(m)), ...(target.crowd?.avatars() ?? []), ...(target.def.private || padariaIdFromInstance(target.id) ? [] : this.npcs.avatarsIn(def.id))],
      furniture,
      serverNow: this.personalNow(s.profile),
      ...(target.def.id === 'andar' ? { academy: this.floorCard(target, s) } : {}),
      ...(padariaIdFromInstance(target.id) ? { padaria: this.floorPadariaCard(target, s) } : {}),
      ...(def.id === 'feira' ? { feiraCart: this.feiraGames.cartSnapshot() } : {}),
      ...(def.id === 'kitnet' && target.ownerId ? { homePets: this.homePetsOf(target.ownerId) } : {}),
    });
    // a joiner mid-walk: the avatars above are at the tile each NPC has reached, this sends the rest of each walk
    for (const p of this.npcs.posesIn(def.id)) {
      const moved = this.npcs.moved(p);
      if (moved) s.send(moved);
    }
    this.correria.resume(s);
    this.recados.onEvent(s, { kind: 'entered', room: def.id, tile });
    this.cartela.onEntered(s, def.id);
    if (def.id === 'padaria' && !padariaIdFromInstance(target.id)) {
      const minute = gameMinutes(this.clockNow());
      const baker = bakerOnDuty(minute) === 'graca' ? 'graca' : 'carlos';
      const line = this.leaderboards.maybeMentionStreak(s, baker);
      if (line) s.send({ t: 'notice', level: 'info', pt: line.pt, en: line.en });
    }
    this.broadcast(target, { t: 'avatarJoined', avatar: this.publicAvatar(s) }, s);
    const ownedPid = padariaIdFromInstance(target.id);
    if (ownedPid) {
      const row = this.padarias.get(ownedPid);
      if (row && s.profile) s.send({ t: 'padariaOwn', phase: 'floor', padaria: padariaCard(row, this.store.get(row.ownerId)?.name ?? '—', s.profile.id) });
    }
    target.crowd?.sync();
    this.startNpcTick();
    this.notifyFriendsOfPresence(s.profile!.id);
    this.kitnetGift(s, target);
  }

  /**
   * First time in your own kitnet: the `kitnetGift` RV (gameConfig.ts), so the tutorial's furniture step can always be paid for.
   * Players who already have the chair step done or furniture down (older saves) get nothing.
   */
  private kitnetGift(s: Session, inst: Instance) {
    const p = s.profile;
    if (!p || inst.def.id !== 'kitnet' || inst.ownerId !== p.id || p.kitnetGiftPaid) return;
    p.kitnetGiftPaid = true;
    if (p.tutorial.cadeira || p.apartment.length > 0) return this.store.save(p.id);
    this.reward(s, this.config.get('kitnetGift'), { pt: 'Presente de boas-vindas pra sua kitnet: compre um móvel!', en: 'A welcome gift for your apartment: go buy a piece of furniture!' });
  }

  /** The game clock: real time plus the test offset. Everything the players see as time of day comes from here. */
  private clockNow() {
    return this.now() + this.clockOffsetMs;
  }

  /** This profile's sky: the shared neighborhood clock plus only their Testes offset. */
  private personalNow(p?: { testClockOffsetMs?: number } | null): number {
    return this.clockNow() + (p?.testClockOffsetMs ?? 0);
  }

  /**
   * Today's key for every cap on this profile (playerDay.ts): the player's own calendar day from the offset their browser
   * reported, shifted by a Testes day roll. UTC until an offset arrives.
   */
  private dayOf(p: StoredProfile): string {
    return profileDay(p, this.now());
  }

  /** One calendar day and one game day on this profile. The neighborhood clock and the Feira board stay put. */
  private rollPersonalDay(p: StoredProfile): void {
    p.testDayOffset = (p.testDayOffset ?? 0) + 1;
    p.testClockOffsetMs = (p.testClockOffsetMs ?? 0) + GAME_DAY_MS;
  }

  /** Move only this profile's sky so the game minute reads `minute`. */
  private setPersonalMinute(p: StoredProfile, minute: number): number {
    const target = Math.max(0, Math.min(1439.99, minute));
    const cur = gameMinutesExact(this.personalNow(p));
    p.testClockOffsetMs = (p.testClockOffsetMs ?? 0) + (((target - cur) % 1440) + 1440) % 1440 * MS_PER_GAME_MINUTE;
    return gameMinutes(this.personalNow(p));
  }

  private adminTestHost(): AdminTestHost {
    return {
      now: () => this.now(),
      clockNow: () => this.clockNow(),
      utcDay: () => feiraBoardDay(this.now()),
      dayOf: (p) => this.dayOf(p),
      minuteOf: (p) => gameMinutes(this.personalNow(p)),
      gameDayOf: (p) => gameDay(this.personalNow(p)),
      store: this.store,
      padarias: this.padarias,
      padariaOwnership: this.padariaOwnership,
      findOnline: (id) => this.sessionByProfile(id),
      setPersonalMinute: (p, minute) => this.setPersonalMinute(p, minute),
      rollPersonalDay: (p) => this.rollPersonalDay(p),
      join: (session, room) => this.join(session as Session, room),
      clearFeiraPaid: (id) => this.feiraGames.clearPaid(id),
      pushLive: (session) => this.pushTestAvatar(session as Session),
      pushPersonalClock: (session) => {
        const s = session as Session;
        this.pushSky(s);
        this.recados.sendBoard(s);
      },
      err: (session, pt, en) => this.err(session as Session, 'admin', pt, en),
      notice: (session, pt, en) => session.send({ t: 'notice', level: 'info', pt, en }),
    };
  }

  /** Profile plus the avatar, including the player themselves, so the HUD and the nameplate update together. */
  private pushTestAvatar(s: Session) {
    this.pushProfile(s);
    if (!s.instance || !s.profile) return;
    const msg = { t: 'avatarUpdated' as const, avatar: this.publicAvatar(s) };
    s.send(msg);
    this.broadcast(s.instance, msg, s);
  }

  /**
   * Test only (the server wires it to `/__test/clock` when `TB_TEST_CLOCK_CONTROL=1`): shift the game clock so it reads `minute` (0..1439) right now.
   * Timers and the real day are untouched; connected clients get a sky push, and clients that join afterwards sync to it.
   */
  setClockMinute(minute: number): number {
    const target = Math.max(0, Math.min(1439.99, minute));
    const cur = gameMinutesExact(this.clockNow());
    this.clockOffsetMs += (((target - cur) % 1440) + 1440) % 1440 * MS_PER_GAME_MINUTE;
    // players already in the world follow the jump (their sky and NPC hours), not just the ones who join next
    this.pushSky();
    return gameMinutes(this.clockNow());
  }

  /**
   * Test only (`/__test/escola` when `TB_TEST_CLOCK_CONTROL=1`, for the escola screenshots): an online player gets the first `words` catalog
   * words, `mastered` of them at the top box, the next `ready` one box short and due, and a streak of `streak` days up to yesterday.
   */
  testSeedEscola(name: string, o: { words: number; mastered: number; ready: number; streak: number }): boolean {
    const s = [...this.sessions.values()].find((x) => x.profile?.name === name);
    const p = s?.profile;
    if (!s || !p) return false;
    for (const w of DIARY_WORDS) {
      if (normalizeDiary(p.diary).length >= o.words) break;
      const got = grantDiaryWord(p.diary, w.id, w.source);
      if (got.ok) p.diary = got.earned;
    }
    const st = escolaOf(p);
    const now = this.now();
    normalizeDiary(p.diary).forEach((id, i) => {
      if (i < o.mastered) st.words[id] = { b: ESCOLA_MAX_BOX, due: now + 7 * 86_400_000, last: now - 86_400_000, n: 5, miss: 0 };
      else if (i < o.mastered + o.ready) st.words[id] = { b: ESCOLA_MAX_BOX - 1, due: now - 1000, last: now - 86_400_000, n: 4, miss: 0 };
    });
    if (o.streak > 0) {
      st.streak = o.streak;
      st.best = Math.max(st.best, o.streak);
      st.lastDay = localDay(now - 86_400_000, st.tz);
    }
    this.store.save(p.id);
    this.pushProfile(s);
    return true;
  }

  /** Push the live sky. Each player gets the shared weather and their own clock offset. */
  private pushSky(to?: Session) {
    const send = (s: Session) => {
      if (!s.profile) return;
      s.send({ t: 'sky', serverNow: this.personalNow(s.profile), weather: this.weatherPin });
    };
    if (to) return send(to);
    for (const s of this.sessions.values()) send(s);
  }

  private admin(s: Session, msg: Extract<ClientMsg, { t: 'admin' }>) {
    if (msg.action === 'login') {
      if (!this.adminPassword) {
        return s.send({
          t: 'admin',
          phase: 'disabled',
          pt: 'Admin desligado neste servidor.',
          en: 'Admin is off on this server.',
        });
      }
      const keys = AdminLoginGuard.keys({ ip: s.ip, accountId: s.accountId, socket: s.id });
      const verdict = this.adminGuard.attempt(keys, typeof msg.password === 'string' ? msg.password : '', this.adminPassword, 'ws login');
      if (verdict !== 'ok') {
        s.admin = false;
        s.send({ t: 'admin', phase: 'auth', ok: false, ...(verdict === 'wrong' ? ADMIN_WRONG_PASSWORD : ADMIN_TOO_MANY) });
        // Repeated failures: drop the socket so guessing needs a reconnect (and the IP / account keys still hold).
        if (this.adminGuard.blocked(keys)) this.kick(s, 'admin', { t: 'kicked', reason: 'admin', ...ADMIN_TOO_MANY });
        return;
      }
      s.admin = true;
      s.send({ t: 'admin', phase: 'auth', ok: true });
      return this.adminList(s);
    }
    if (!s.admin) {
      if (isAdminTestAction(msg.action)) console.log(`[admin-testes] rejected ${msg.action} (no admin session)`);
      return s.send({
        t: 'admin',
        phase: 'auth',
        ok: false,
        pt: 'Entre com a senha de admin primeiro.',
        en: 'Sign in with the admin password first.',
      });
    }
    if (msg.action === 'logout') {
      s.admin = false;
      return s.send({ t: 'admin', phase: 'auth', ok: false, pt: 'Modo admin desligado.', en: 'Admin mode off.' });
    }
    if (msg.action === 'list') return this.adminList(s);
    if (msg.action === 'kick') return this.adminKick(s, msg.targetId);
    if (msg.action === 'mute') return this.adminMute(s, msg.targetId, msg.minutes);
    if (msg.action === 'ban') return this.adminBan(s, msg.targetId, true);
    if (msg.action === 'unban') return this.adminBan(s, msg.targetId, false);
    if (msg.action === 'banned') return this.adminBanned(s);
    if (msg.action === 'moderation') return s.send({ t: 'admin', phase: 'moderation', items: moderationRows(this.services.moderation.recent(1000), 100) });
    if (msg.action === 'money') return this.adminMoney(s, msg.amount);
    if (msg.action === 'clock') {
      const minute = this.setClockMinute(msg.minute);
      this.pushSky();
      return s.send({
        t: 'notice',
        level: 'info',
        pt: `Horário do bairro: ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}.`,
        en: `Neighborhood clock set.`,
      });
    }
    if (msg.action === 'feiraCart') return this.adminFeiraCart(s);
    if (msg.action === 'feiraCartSet') return this.adminFeiraCartSet(s, msg.game, msg.mode, msg.schedule);
    if (msg.action === 'praiaSet') {
      if (msg.mode !== undefined && !isPraiaMode(msg.mode)) return this.err(s, 'admin', 'Modo inválido.', 'Invalid mode.');
      if (msg.partyBoat !== undefined && typeof msg.partyBoat !== 'boolean') return this.err(s, 'admin', 'Valor inválido.', 'Invalid value.');
      const cfg = this.setPraia({ ...(msg.mode ? { mode: msg.mode } : {}), ...(msg.partyBoat !== undefined ? { partyBoat: msg.partyBoat } : {}) });
      return s.send({ t: 'notice', level: 'info', pt: `Praia: ${cfg.mode}, barco de festa ${cfg.partyBoat ? 'ligado' : 'desligado'}.`, en: `Beach: ${cfg.mode}, party boat ${cfg.partyBoat ? 'on' : 'off'}.` });
    }
    if (msg.action === 'weather') {
      if (msg.weather !== null && !(WEATHER_KINDS as readonly string[]).includes(msg.weather)) {
        return this.err(s, 'admin', 'Clima inválido.', 'Invalid weather.');
      }
      this.weatherPin = msg.weather;
      this.pushSky();
      return s.send({
        t: 'notice',
        level: 'info',
        pt: msg.weather ? `Clima: ${msg.weather}.` : 'Clima automático de novo.',
        en: msg.weather ? `Weather: ${msg.weather}.` : 'Weather follows the day again.',
      });
    }
    if (msg.action === 'subscribers') return this.adminSubscribers(s);
    if (msg.action === 'grantSub') return this.adminGrantSub(s, msg.targetId);
    if (msg.action === 'revokeSub') return this.adminRevokeSub(s, msg.targetId);
    if (isAdminTestAction(msg.action)) return handleAdminTest(this.adminTestHost(), s, msg);
  }

  private adminSubscribers(s: Session) {
    const online = new Set([...this.sessions.values()].filter((x) => x.profile).map((x) => x.profile!.id));
    const subscribers = this.store
      .all()
      .filter((p) => p.subscription || p.founderBadge || online.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.subscription?.status ?? ('none' as const),
        currentPeriodEnd: p.subscription?.currentPeriodEnd ?? null,
        founderBadge: p.founderBadge === true,
        founderBanner: p.founderBanner === true,
        online: online.has(p.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    s.send({ t: 'admin', phase: 'subscribers', subscribers });
  }

  /** Dev provider: admin only, no payment. Founder marks stick; perks follow the test period. */
  private adminGrantSub(s: Session, targetId: string) {
    const id = String(targetId ?? '');
    const dev = new DevBillingProvider({
      isAdmin: () => s.admin === true,
      now: () => this.now(),
      getProfile: (userId) => this.store.get(userId),
      afterChange: (userId) => {
        this.store.save(userId);
        this.syncEntitlements(userId);
      },
    });
    void dev.createCheckout(id).then(
      () => {
        this.adminSubscribers(s);
        s.send({ t: 'notice', level: 'info', pt: 'Assinatura de teste ligada.', en: 'Test subscription on.' });
      },
      () => this.err(s, 'admin', 'Não achei esse perfil.', 'No profile with that id.'),
    );
  }

  private adminRevokeSub(s: Session, targetId: string) {
    const p = this.store.get(String(targetId ?? ''));
    if (!p) return this.err(s, 'admin', 'Não achei esse perfil.', 'No profile with that id.');
    revokeTestSubscription(p, this.now());
    this.store.save(p.id);
    this.syncEntitlements(p.id);
    this.adminSubscribers(s);
    s.send({ t: 'notice', level: 'info', pt: 'Assinatura de teste encerrada.', en: 'Test subscription ended.' });
  }

  private noteLayout(room: string) {
    if (room === 'feira') this.hiddenFeira = null;
  }

  private broadcastLayout(room: import('@tudobem/shared').RoomId, objects: import('@tudobem/shared').PropDef[] | null) {
    const msg = { t: 'layout' as const, room, objects };
    for (const sess of this.sessions.values()) if (sess.profile) sess.send(msg);
  }

  /** Put a layout live in this process and on every client. The caller has already stored it (designOps.ts). `null`: the code layout. */
  private applyLayout(room: import('@tudobem/shared').RoomId, objects: import('@tudobem/shared').PropDef[] | null) {
    if (objects) installRoomProps(room, objects);
    else revertRoomProps(room);
    this.noteLayout(room);
    this.broadcastLayout(room, objects);
  }

  private adminFeiraCart(s: Session) {
    const view = this.feiraGames.cartView();
    s.send({ t: 'admin', phase: 'feiraCart', day: view.day, featured: view.featured, games: view.games });
  }

  private adminFeiraCartSet(s: Session, game: string, mode: string, schedule: unknown) {
    if (mode !== 'off' && mode !== 'on' && mode !== 'rotation') {
      return this.err(s, 'admin', 'Modo inválido.', 'Invalid mode.');
    }
    if (schedule !== undefined && schedule !== null && (typeof schedule !== 'object' || Array.isArray(schedule))) {
      return this.err(s, 'admin', 'Agenda inválida.', 'Invalid schedule.');
    }
    const ok = this.feiraGames.setCartMode(game, mode, schedule as FeiraCartSchedule | null | undefined);
    if (!ok) return this.err(s, 'admin', 'Jogo desconhecido.', 'Unknown cart game.');
    const msg = this.feiraGames.cartMsg();
    for (const sess of this.sessions.values()) if (sess.profile) sess.send(msg);
    return this.adminFeiraCart(s);
  }

  /** Aboard a party boat trip right now (the `festa` water): a member of the trip, on its deck. */
  private aboardParty(s: Session): boolean {
    return this.parties.aboard(s);
  }

  /** The dashboard's Praia card (PRAIA-PLAN.md 8.5). */
  praiaAdminView(): PraiaAdminView {
    const cfg = this.praia.config();
    const t = this.now();
    const tripsNow: PraiaAdminView['tripsNow'] = {};
    let onBeach = 0;
    for (const s of this.sessions.values()) {
      if (!s.profile) continue;
      if (s.instance?.def.id === 'praia') onBeach++;
      const trip = s.profile.pesca?.trip;
      if (trip && trip.until > t) tripsNow[trip.tier] = (tripsNow[trip.tier] ?? 0) + 1;
    }
    const party = this.parties.stats();
    if (party.active) tripsNow.festa = party.active;
    return { mode: cfg.mode, partyBoat: cfg.partyBoat, onBeach, aboardParty: party.aboard, tripsNow, today: this.praiaStats.view() };
  }

  /** May this session's player be on the beach now (open, or preview with a subscriber's early access)? */
  private praiaOpenFor(s: Session): boolean {
    return praiaAllows(this.praia.config(), s.profile?.subscription, this.now());
  }

  private praiaMsg(s: Session): Extract<ServerMsg, { t: 'praia' }> {
    const cfg = this.praia.config();
    return { t: 'praia', phase: 'mode', mode: cfg.mode, partyBoat: cfg.partyBoat, allowed: this.praiaOpenFor(s) };
  }

  /**
   * The admin switch (socket door and the dashboard): store it, tell every player, and walk anyone the beach is now closed to back to the
   * Vila's bus stop with a notice.
   */
  setPraia(patch: Partial<PraiaConfig>): PraiaConfig {
    const cfg = this.praia.set(patch);
    // the party boat switched off: every trip sails back to the pier now
    if (!cfg.partyBoat) this.parties.endAll('off');
    for (const sess of [...this.sessions.values()]) {
      if (!sess.profile) continue;
      sess.send(this.praiaMsg(sess));
      const here = sess.instance?.def.id;
      if ((here === 'praia' || here === 'barco_festa') && !this.praiaOpenFor(sess)) {
        sess.send({ t: 'notice', level: 'info', pt: 'A praia fechou por agora. O ônibus te trouxe de volta.', en: 'The beach has closed for now. The bus brought you back.' });
        this.join(sess, 'rua_leste', {}, { tile: { x: 5, y: 13 }, dir: 'SW' });
      }
    }
    return cfg;
  }

  private adminList(s: Session) {
    const players = [...this.sessions.values()]
      .filter((x) => x.profile)
      .map((x) => ({
        id: x.profile!.id,
        name: x.profile!.name,
        room: x.instance?.def.id ?? null,
        roomName: x.instance?.name ?? null,
      }));
    s.send({ t: 'admin', phase: 'players', players });
  }

  /** Solo / shot hook: turn one Feira cart game on and tell everyone, the same way the admin switch does. Games ship off. */
  enableFeiraGame(id: string): boolean {
    if (!this.feiraGames.setCartMode(id, 'on')) return false;
    const msg = this.feiraGames.cartMsg();
    for (const sess of this.sessions.values()) if (sess.profile) sess.send(msg);
    return true;
  }

  private adminKick(s: Session, targetId: string) {
    const id = String(targetId ?? '');
    if (!id || id === s.profile?.id) {
      return this.err(s, 'admin', 'Escolha outra pessoa pra liberar a vaga.', 'Pick someone else to remove.');
    }
    const target = this.sessionByProfile(id);
    if (!target?.profile) return this.err(s, 'admin', 'Essa pessoa não está na Praça.', 'That player is not in the Praça.');
    const name = target.profile.name;
    this.kick(target, 'admin', { t: 'kicked', reason: 'admin', ...ADMIN_KICKED_COPY });
    this.adminList(s);
    s.send({ t: 'notice', level: 'info', pt: `${name} saiu da Praça.`, en: `${name} left the square.` });
  }

  private adminMute(s: Session, targetId: string, minutes: number) {
    const target = this.store.get(String(targetId ?? ''));
    if (!target || target.id === s.profile?.id) return this.err(s, 'admin', 'Não achei esse perfil.', 'No profile with that id.');
    const m = Math.floor(Number(minutes));
    if (!Number.isFinite(m) || m < 0 || m > MUTE_MAX_MINUTES)
      return this.err(s, 'admin', `De 0 a ${MUTE_MAX_MINUTES} minutos.`, `0 to ${MUTE_MAX_MINUTES} minutes.`);
    if (m === 0) delete target.mutedUntil;
    else target.mutedUntil = this.now() + m * 60_000;
    this.store.save(target.id);
    const ts = this.sessionByProfile(target.id);
    if (ts && m > 0) ts.send({ t: 'notice', level: 'warn', ...mutedCopy(m * 60_000) });
    s.send({
      t: 'notice',
      level: 'info',
      pt: m ? `${target.name} sem chat por ${m} min.` : `Chat de ${target.name} liberado.`,
      en: m ? `${target.name} muted for ${m} min.` : `${target.name} unmuted.`,
    });
  }

  /** A ban sticks to the profile (so to its account): it is checked every time the profile enters the world. */
  private adminBan(s: Session, targetId: string, ban: boolean) {
    const target = this.store.get(String(targetId ?? ''));
    if (!target || target.id === s.profile?.id) return this.err(s, 'admin', 'Não achei esse perfil.', 'No profile with that id.');
    if (ban) {
      target.banned = { at: this.now() };
      this.store.save(target.id);
      const ts = this.sessionByProfile(target.id);
      if (ts) this.kick(ts, 'banned', { t: 'kicked', reason: 'banned', ...BANNED_COPY });
      this.adminList(s);
    } else {
      delete target.banned;
      this.store.save(target.id);
    }
    this.adminBanned(s);
    s.send({
      t: 'notice',
      level: 'info',
      pt: ban ? `${target.name} foi banido(a).` : `${target.name} pode voltar.`,
      en: ban ? `${target.name} is banned.` : `${target.name} can come back.`,
    });
  }

  private adminBanned(s: Session) {
    const banned = this.store
      .all()
      .filter((p) => p.banned)
      .map((p) => ({ id: p.id, name: p.name, at: p.banned!.at }));
    s.send({ t: 'admin', phase: 'banned', banned });
  }

  private adminMoney(s: Session, amount: number) {
    const n = Math.floor(Number(amount));
    const max = this.config.get('adminGrantMax');
    if (!Number.isFinite(n) || n < 1 || n > max) {
      return this.err(s, 'admin', `Pode adicionar de 1 a ${max} RV por vez.`, `You can add 1 to ${max} RV at a time.`);
    }
    this.reward(s, n, { pt: 'Admin: reais virtuais', en: 'Admin: virtual reais' });
  }

  /** What the admin dashboard (adminApi.ts) may do to the live world. Every caller has already passed the admin cookie check. */
  adminHost(): AdminWorldHost {
    return adminWorldHost({
      sessions: () => this.sessions.values(),
      instances: () => this.instances.values(),
      sessionByProfile: (id) => this.sessionByProfile(id),
      pushProfile: (s) => this.pushProfile(s),
      broadcastAvatar: (s) => this.broadcastAvatar(s),
      kick: (s, reason, last) => this.kick(s, reason, last),
      dropAccount: (accountId) => this.dropAccount(accountId),
      forgetAccount: (accountId, profileId) => this.forgetAccount(accountId, profileId),
      classify: (text, nameplate) => this.services.safety.classify(text, { playerId: 'admin', room: '-', nameplate, recent: [] }),
      praiaView: () => this.praiaAdminView(),
      setPraia: (patch) => this.setPraia(patch),
      feiraCartView: () => this.feiraGames.cartView(),
      setFeiraCart: (game, mode) => {
        if (!this.feiraGames.setCartMode(game, mode)) return false;
        const msg = this.feiraGames.cartMsg();
        for (const sess of this.sessions.values()) if (sess.profile) sess.send(msg);
        return true;
      },
      layoutOverrides: () => this.layouts.overrides().map((o) => ({ room: o.room, objects: o.objects.length })),
      revertLayout: (room) => {
        if (!this.layouts.has(room)) return false;
        this.layouts.publish(room, null, 'dashboard');
        this.applyLayout(room, null);
        return true;
      },
      layouts: () => this.layouts,
      applyLayout: (room, objects) => this.applyLayout(room, objects),
      githubConfigured: () => !!this.githubToken,
      layoutPullRequest: (room, objects) => publishLayoutPullRequest({ token: this.githubToken, room, objects, fetch: this.githubFetch }),
      markBoardsDirty: () => this.leaderboards.markDirty(),
      now: () => this.now(),
      homePetsChanged: (ownerId) => this.sendHomePets(ownerId),
    });
  }

  /** Game minute (0..1439), for the HTTP Conversa flow (it has no session): the NPCs greet by it. */
  gameMinuteNow(): number {
    return gameMinutes(this.clockNow());
  }

  /** Starts the NPC tick if it is not running. It stops itself when nobody is in the world. */
  private startNpcTick() {
    if (this.npcTicking) return;
    this.npcTicking = true;
    this.schedule(() => this.npcTick(), NPC_TICK_MS);
  }

  private npcTick() {
    let anyone = false;
    for (const inst of this.instances.values()) {
      if (!inst.members.size) continue;
      anyone = true;
      try {
        this.npcSync(inst);
      } catch (e) {
        console.error('[world] npc tick failed', inst.id, e);
      }
    }
    if (anyone) this.schedule(() => this.npcTick(), NPC_TICK_MS);
    else this.npcTicking = false;
  }

  /** Tell an instance what changed among the NPCs: one who came in, started a new walk, or left. Same messages as the CPUs use. */
  private npcSync(inst: Instance) {
    if (inst.def.private) return;
    const here = new Set<NpcId>();
    for (const p of this.npcs.posesIn(inst.def.id)) {
      here.add(p.npc);
      const seen = inst.npcSeen.get(p.npc);
      if (seen === p.legId) continue;
      if (seen === undefined) this.broadcast(inst, { t: 'avatarJoined', avatar: this.npcs.avatar(p) });
      const moved = this.npcs.moved(p);
      if (moved) this.broadcast(inst, moved);
      inst.npcSeen.set(p.npc, p.legId);
    }
    for (const id of [...inst.npcSeen.keys()]) {
      if (here.has(id)) continue;
      inst.npcSeen.delete(id);
      this.broadcast(inst, { t: 'avatarLeft', id: npcAvatarId(id) });
    }
  }

  private leaveInstance(s: Session) {
    const inst = s.instance;
    this.correria.clear(s);
    if (s.bout) this.bouts.clear(s);
    s.scene = undefined;
    // a line out on the water does not follow you to another room
    this.pescaEngine.dropCast(s);
    if (!inst) return;
    if (inst.def.id === 'petshop') this.petShop.leftRoom(s);
    inst.members.delete(s.id);
    s.instance = undefined;
    if (s.profile) this.broadcast(inst, { t: 'avatarLeft', id: s.profile.id });
    // Idle overflow instances sleep (are dropped); the first public instance always stays. A padaria that grew has a new instance under
    // the same id by now: only the old one goes.
    if (inst.members.size === 0 && !inst.id.endsWith('#1') && this.instances.get(inst.id) === inst) {
      inst.crowd?.stop();
      this.instances.delete(inst.id);
    } else inst.crowd?.sync();
    // off the party deck (the gangway, another room, a disconnect): a guest leaves the trip, the host ends it
    if (inst.def.id === 'barco_festa' && s.profile) this.parties.onLeftDeck(s.profile.id, inst.id);
  }

  private makeCrowd(inst: Instance) {
    return new CpuCrowd(inst.def, {
      now: this.now,
      schedule: this.schedule,
      rng: this.rng,
      send: (m) => this.broadcast(inst, m),
      reserved: () => this.npcs.reservedIn(inst.def.id),
      minute: () => gameMinutes(this.clockNow()),
      humans: () =>
        [...inst.members.values()]
          .filter((m) => m.avatar)
          .map((m) => {
            const tile = this.currentTile(m).tile;
            return { tile, target: m.avatar!.path.at(-1) ?? tile };
          }),
    });
  }

  /** Anyone else here to greet — a player or an ambiance CPU. */
  private hasCompany(inst: Instance) {
    return inst.members.size > 1 || (inst.crowd?.size ?? 0) > 0;
  }

  private furnitureOf(inst: Instance): PlacedFurniture[] {
    if (inst.def.id !== 'kitnet' || !inst.ownerId) return [];
    return this.store.get(inst.ownerId)?.apartment ?? [];
  }

  /** Feira with the game cart and sign removed. One object: the authored room does not change. */
  private hiddenFeira: RoomDef | null = null;

  /** The room's grid for players: props and furniture, plus the tiles the NPCs are standing on right now (they move, so nothing static blocks them). */
  private grid(inst: Instance) {
    const base = inst.def;
    const def =
      base.id === 'feira' && !feiraCartShown(this.feiraGames.cartSnapshot())
        ? (this.hiddenFeira ??= withoutHiddenFeiraCart(base, false))
        : base;
    return this.npcs.block(base, buildGrid(def, this.furnitureOf(inst)));
  }

  private currentTile(s: Session): { tile: Tile; dir: Dir; moving: boolean } {
    const a = s.avatar!;
    const pos = positionAlong(a.from, a.path, this.now() - a.start, a.dir);
    const tile = pos.moving ? { x: Math.round(pos.x), y: Math.round(pos.y) } : pos.tile;
    return { tile, dir: pos.dir, moving: pos.moving };
  }

  publicAvatar(s: Session): PublicAvatar {
    const p = s.profile!;
    const cur = s.avatar ? this.currentTile(s) : { tile: { x: 0, y: 0 }, dir: 'SE' as Dir, moving: false };
    const a = s.avatar;
    const sitting = !!a && !cur.moving && (a.sitting || a.sitOnArrive);
    const hasFounderHat = p.hats.includes(PADARIA_FOUNDER_HAT);
    const inOwnKitnet = s.instance?.def.id === 'kitnet' && s.instance.ownerId === p.id;
    const hat = displayFounderHat(p.hat, hasFounderHat, s.instance?.def.id, inOwnKitnet);
    return {
      id: p.id,
      name: p.name,
      pronoun: p.pronoun,
      appearance: p.appearance,
      hat,
      parrot: p.parrotOwned && p.parrotEquipped,
      parrotColor: p.parrotOwned && p.parrotEquipped ? p.parrotColor ?? 'verde' : null,
      carry: s.carry,
      ...this.wornGi(s),
      nameplate: p.nameplate,
      founder: normalizeFounderFlag(p.founder),
      founderBadge: p.founderBadge === true,
      ...this.publicPet(p),
      bubbleStyle: bubbleAppearance('', p.bubbleStyle, hasPerkAccess(p.subscription, this.now())).style,
      ...(this.feiraGames.crownId() === p.id ? { feiraCrown: true } : {}),
      x: cur.tile.x,
      y: cur.tile.y,
      dir: sitting && s.instance ? (this.grid(s.instance).seats.get(key(cur.tile.x, cur.tile.y)) ?? cur.dir) : cur.dir,
      sitting,
    };
  }

  /** The pet out with this player, as others see it (#234): species, name, breed, coat, collar and toy; nothing without perk access. */
  private publicPet(p: StoredProfile): Pick<PublicAvatar, 'pet' | 'petName' | 'petBreed' | 'petCoat' | 'petCollar' | 'petToy'> {
    const pet = activePet(p);
    if (!pet || !visiblePet(pet.species, hasPerkAccess(p.subscription, this.now()))) return { pet: null, petName: null };
    return { pet: pet.species, petName: pet.name, petBreed: pet.breed, petCoat: pet.coat, petCollar: pet.collar, petToy: pet.toy };
  }

  /** Personal gi from the vestiário, plus the academy uniform when this player is a member of the floor they are in. */
  private wornGi(s: Session): { gi: boolean; belt?: PublicAvatar['belt']; academyGi?: PublicAvatar['academyGi'] } {
    const p = s.profile!;
    const academy = this.floorAcademy(s);
    const member = !!(academy && academy.members.includes(p.id));
    if (member && academy) return { gi: true, belt: normalizeBjj(p.bjj).belt, academyGi: { color: academy.giColor, stamp: academy.giStamp } };
    if (p.giOwned) return { gi: true, belt: normalizeBjj(p.bjj).belt };
    return { gi: false };
  }

  private floorAcademy(s: Session): PlayerAcademy | undefined {
    if (s.instance?.def.id !== 'andar') return undefined;
    const id = academyIdFromInstance(s.instance.id);
    return id ? this.academies.get(id) : undefined;
  }

  private floorCard(inst: Instance, s: Session): AcademyCard | undefined {
    const id = academyIdFromInstance(inst.id);
    const academy = id ? this.academies.get(id) : undefined;
    if (!academy || !s.profile) return undefined;
    return academyCard(academy, this.store.get(academy.ownerId)?.name ?? '—', s.profile.id);
  }

  private broadcast(inst: Instance, m: ServerMsg, except?: Session) {
    for (const member of inst.members.values()) if (member !== except) member.send(m);
  }

  /** Like `broadcast`, but members who blocked `fromId` don't get it (chat lines, emotes). */
  private broadcastFrom(inst: Instance, fromId: string, m: ServerMsg) {
    for (const member of inst.members.values()) if (!hasBlocked(member.profile, fromId)) member.send(m);
  }

  private broadcastAvatar(s: Session) {
    if (s.instance) this.broadcast(s.instance, { t: 'avatarUpdated', avatar: this.publicAvatar(s) });
  }

  private move(s: Session, x: number, y: number, sit: boolean) {
    const inst = s.instance;
    const a = s.avatar;
    if (!inst || !a) return;
    const g = this.grid(inst);
    const cur = this.currentTile(s);
    const from = cur.tile;
    const path = findPath(g, from, { x, y });
    if (!path) return;
    const wantsSit = sit && g.seats.has(key(x, y));
    a.from = from;
    a.path = path;
    a.start = this.now();
    a.dir = cur.dir;
    a.sitting = false;
    a.sitOnArrive = wantsSit;
    const seq = ++a.seq;
    this.broadcast(inst, { t: 'avatarMoved', id: s.profile!.id, from, path, sit: wantsSit });
    if (wantsSit) inst.crowd?.yieldSeat({ x, y });
    const done = () => {
      if (s.avatar !== a || a.seq !== seq || s.instance !== inst) return;
      // "Ande pela praça": only a walk inside the praça itself counts (not the rua or other areas)
      if (path.length && inst.def.id === 'praca') this.completeStep(s, 'andar');
      // split areas: a walk that ends on a map-edge tile carries you into the next area
      const end = path.at(-1) ?? from;
      const edge = inst.def.portals.find((p) => p.edge && p.x === end.x && p.y === end.y);
      if (edge) return this.join(s, edge.to, {}, { tile: edge.arrive, dir: edge.arriveDir });
      if (wantsSit) {
        a.sitting = true;
        this.completeStep(s, 'sentar');
      }
    };
    const ms = pathDuration(from, path);
    if (ms <= 0) done();
    else this.schedule(done, ms);
  }

  private stand(s: Session) {
    const a = s.avatar;
    if (!a) return;
    const cur = this.currentTile(s);
    a.from = cur.tile;
    a.path = [];
    a.sitting = false;
    a.sitOnArrive = false;
    a.seq++;
    this.broadcastAvatar(s);
  }

  private portal(s: Session, portalId: string) {
    const inst = s.instance;
    if (!inst) return;
    const portal = inst.def.portals.find((p) => p.id === portalId);
    if (!portal) return;
    const cur = this.currentTile(s).tile;
    if (Math.max(Math.abs(cur.x - portal.x), Math.abs(cur.y - portal.y)) > 1)
      return this.err(s, 'far', 'Chegue mais perto da porta.', 'Walk closer to the door.');
    // Leaving a kitnet always goes to the public praça; entering one goes to your own.
    this.join(s, portal.to, {}, { tile: portal.arrive, dir: portal.arriveDir });
  }

  private emote(s: Session, kind: EmoteKind) {
    if (!s.instance || !EMOTES.includes(kind)) return;
    this.broadcastFrom(s.instance, s.profile!.id, { t: 'emote', id: s.profile!.id, kind });
    if (kind !== 'oi') return;
    this.completeStep(s, 'acenar');
    s.instance.crowd?.onWave(this.currentTile(s).tile);
    if (s.instance.def.outdoor && this.hasCompany(s.instance)) this.missionStep(s, 'cumprimenta');
  }

  // ---------- chat ----------

  private async chat(s: Session, raw: string) {
    const inst = s.instance;
    const p = s.profile!;
    if (!inst || typeof raw !== 'string') return;
    const text = raw.slice(0, MAX_CHAT_LEN);
    const now = this.now();
    if (p.mutedUntil && p.mutedUntil > now) return s.send({ t: 'notice', level: 'warn', ...mutedCopy(p.mutedUntil - now) });
    s.chatTimes = s.chatTimes.filter((t) => now - t < CHAT_RATE.windowMs);
    if (s.chatTimes.length >= CHAT_RATE.max)
      return s.send({ t: 'notice', level: 'warn', pt: 'Calma! Uma mensagem de cada vez.', en: 'Easy! Too many messages — wait a few seconds.' });
    s.chatTimes.push(now);
    const verdict = await this.services.safety.classify(text, this.safetyCtx(s));
    if (verdict.action === 'block' || verdict.action === 'escalate') {
      this.flag(s, 'chat', verdict, text);
      return s.send({ t: 'notice', level: 'block', pt: verdict.note?.pt ?? 'Mensagem bloqueada.', en: verdict.note?.en ?? 'Message blocked.' });
    }
    if (s.instance !== inst) return;
    if (verdict.action === 'warn') this.flag(s, 'chat', verdict, text);
    // Delivered verbatim: player chat is never rewritten (CEO-LOCKS §3).
    const { gloss, lang } = await this.services.gloss.gloss(verdict.text);
    this.broadcastFrom(inst, p.id, { t: 'chat', id: p.id, name: p.name, text: verdict.text, gloss, lang, action: verdict.action });
    inst.recentChat.push({ playerId: p.id, text: verdict.text });
    if (inst.recentChat.length > JEV_CONTEXT_LINES) inst.recentChat.shift();
    inst.chatLog.push({ playerId: p.id, text: verdict.text, at: this.now() });
    if (inst.chatLog.length > CHAT_LOG_LINES) inst.chatLog.shift();
    if (verdict.action === 'warn' && verdict.note) s.send({ t: 'notice', level: 'warn', pt: verdict.note.pt, en: verdict.note.en });
    this.completeStep(s, 'conversar');
    this.caderno.used(s, verdict.text);
    if (inst.def.outdoor && GREETING.test(verdict.text) && this.hasCompany(inst)) this.missionStep(s, 'cumprimenta');
    if (greetingKind(verdict.text)) this.recados.onEvent(s, { kind: 'greeted', text: verdict.text, minute: gameMinutes(this.clockNow()), company: this.hasCompany(inst) });
  }

  /**
   * The context chat and pet names share, so both hit the word filter first and then the moderation model,
   * including the under-13 hold when `session.under13` is set.
   */
  private safetyCtx(s: Session): ChatSafetyCtx {
    const p = s.profile!;
    return {
      playerId: p.id,
      room: s.instance?.id ?? '-',
      nameplate: p.nameplate,
      recent: s.instance?.recentChat.slice() ?? [],
      ...(s.under13 ? { under13: true } : {}),
    };
  }

  /** Log a non-allow Jev verdict; escalations are queued for human review. */
  private flag(s: Session, surface: 'chat' | 'npc_reply' | 'profile', verdict: SafetyVerdict, text: string) {
    const p = s.profile!;
    this.services.moderation.push({
      kind: verdict.action as 'warn' | 'block' | 'escalate',
      surface,
      playerId: p.id,
      playerName: p.name,
      room: s.instance?.id ?? '-',
      text,
      labels: verdict.labels,
      rules: verdict.rules,
      toxicity: verdict.toxicity,
      ...(verdict.jev ? { jev: verdict.jev } : {}),
      ...(verdict.action === 'escalate' ? { status: 'pending' as const } : {}),
      at: this.now(),
    });
  }

  private report(s: Session, rawTarget: string, rawReason?: unknown) {
    const p = s.profile!;
    const targetId = String(rawTarget ?? '').slice(0, 64);
    const target = targetId && targetId !== p.id ? this.store.get(targetId) : undefined;
    const now = this.now();
    // Only someone online now or seen in the last little while: no reports against ids picked out of thin air.
    if (!target || (!this.sessionByProfile(target.id) && now - (target.lastSeen ?? 0) > REPORT_RECENT_MS))
      return this.err(s, 'report', 'Não encontramos essa pessoa por aqui.', "We couldn't find that player around here.");
    const verdict = this.reportLimiter.check(p.id, target.id, now);
    if (verdict === 'dupe') return s.send({ t: 'notice', level: 'info', pt: 'Você já denunciou essa pessoa. Nossa equipe vai olhar.', en: 'You already reported this player. Our team will look.' });
    if (verdict !== 'ok') return s.send({ t: 'notice', level: 'warn', pt: 'Muitas denúncias seguidas. Tente de novo mais tarde.', en: 'Too many reports in a row. Try again later.' });
    this.reportLimiter.record(p.id, target.id, now);
    const reason = isReportReason(rawReason) ? rawReason : 'outro';
    // The evidence is what the server delivered in the reporter's room, never text the client sends.
    const lines = snapshotLines(s.instance?.chatLog ?? [], target.id, now);
    this.services.moderation.push({
      kind: 'report',
      surface: 'profile',
      playerId: p.id,
      playerName: p.name,
      room: s.instance?.id ?? '-',
      text: lines.at(-1) ?? '',
      labels: [reason],
      targetId: target.id,
      targetName: target.name,
      reason,
      lines,
      status: 'pending',
      at: now,
    });
    s.send({ t: 'notice', level: 'info', pt: 'Obrigado! Nossa equipe vai dar uma olhada.', en: 'Thanks! Our safety team will take a look.' });
  }

  /** Block / unblock: the blocker stops getting the other player's chat, emotes and friend requests. */
  private block(s: Session, action: 'block' | 'unblock', rawTarget: string) {
    const p = s.profile!;
    const targetId = String(rawTarget ?? '').slice(0, 64);
    if (!targetId || targetId === p.id) return;
    const list = (p.blocked ??= []);
    if (action === 'unblock') {
      p.blocked = list.filter((id) => id !== targetId);
      this.store.save(p.id);
      this.pushProfile(s);
      return s.send({ t: 'notice', level: 'info', pt: 'Desbloqueado.', en: 'Unblocked.' });
    }
    if (action !== 'block') return;
    const target = this.store.get(targetId);
    if (!target) return;
    if (!list.includes(target.id)) {
      if (list.length >= BLOCK_MAX) return this.err(s, 'block', 'Sua lista de bloqueio está cheia.', 'Your block list is full.');
      list.push(target.id);
    }
    // A block ends the friendship and drops pending requests both ways.
    this.friendReqs.delete(p.id, target.id);
    this.friendReqs.delete(target.id, p.id);
    if (p.friends.includes(target.id) || target.friends.includes(p.id)) {
      p.friends = p.friends.filter((f) => f !== target.id);
      target.friends = target.friends.filter((f) => f !== p.id);
      const ts = this.sessionByProfile(target.id);
      if (ts) {
        this.pushProfile(ts);
        this.sendFriends(ts);
      }
    }
    this.store.save(p.id, target.id);
    this.pushProfile(s);
    this.sendFriends(s);
    this.parties.onBlock(p.id, target.id);
    s.send({ t: 'notice', level: 'info', pt: `Você bloqueou ${target.name}.`, en: `You blocked ${target.name}.` });
  }

  // ---------- Seu Carlos scene ----------
  // Test-only: no client sends `scene` (the Pedido rápido UI was deleted). Kept because the server tests (world, caderno, npcs, recados)
  // drive the Carlos scene through it to check accept-list grading, the safety gate on typed replies, payouts and `pedir` steps.

  private async scene(s: Session, m: Extract<ClientMsg, { t: 'scene' }>) {
    const p = s.profile!;
    if (m.action === 'close') {
      s.scene = undefined;
      return;
    }
    if (m.action === 'start') {
      // D12: the padaria's breakfast scene is with the baker on duty (Seu Carlos by day, Dona Graça at night), same authored graph
      if ((m.npc !== 'carlos' && m.npc !== 'graca') || s.instance?.def.id !== 'padaria')
        return this.err(s, 'scene', 'O café da manhã é no balcão da padaria.', 'Breakfast is at the bakery counter.');
      if (s.mg) return this.err(s, 'busy', 'Termine o jogo primeiro.', 'Finish the game first.');
      const ctx: SceneCtx = { name: p.name, pronoun: p.pronoun, minute: gameMinutes(this.clockNow()) };
      const view = this.services.npc.start('carlos', ctx);
      s.scene = { npc: 'carlos', node: view.nodeId, ctx, scores: [], shownAt: this.now() };
      this.recados.onEvent(s, { kind: 'talked', npc: bakerOnDuty(gameMinutes(this.clockNow())) });
      this.caderno.seen(s, view.line.pt);
      return s.send({ t: 'scene', view });
    }
    const sc = s.scene;
    if (!sc) return;
    if (m.action === 'choose') return this.applyChoice(s, sc, Math.floor(Number(m.chip)), 3, 'chip');

    // Free-typed reply: same safety stack as chat, then accept-list scoring onto the chips.
    const text = String(m.text ?? '').slice(0, MAX_CHAT_LEN).trim();
    if (!text) return;
    const verdict = await this.services.safety.classify(text, { playerId: p.id, room: s.instance?.id ?? '-', nameplate: p.nameplate });
    if (verdict.action === 'block' || verdict.action === 'escalate') {
      this.flag(s, 'npc_reply', verdict, text);
      return s.send({ t: 'notice', level: 'block', pt: verdict.note?.pt ?? 'Mensagem bloqueada.', en: verdict.note?.en ?? 'Message blocked.' });
    }
    if (s.scene !== sc) return;
    const current = viewNode(sc.node, sc.ctx);
    if (verdict.action === 'warn') {
      this.flag(s, 'npc_reply', verdict, text);
      const note = verdict.note ?? { pt: 'Essa mensagem segue com um aviso.', en: 'That message goes through with a warning.' };
      if (current) {
        s.send({
          t: 'scene',
          view: current,
          said: { pt: text, en: '' },
          fillTicket: false,
          notice: { level: 'warn', pt: note.pt, en: note.en },
        });
      }
      return;
    }
    const jev = jevNpcReply(current?.line.pt ?? '', text);
    const scored = this.services.npc.scoreTyped(sc.npc, sc.node, text, sc.ctx);
    if (scored.chip === null) {
      this.services.student.record({ playerId: p.id, itemIds: [], channel: 'type', score: 0, latencyMs: this.now() - sc.shownAt, place: 'padaria', nameplate: p.nameplate, at: this.now(), jev });
      if (current) s.send({ t: 'scene', view: current, lastScore: 0, feedback: TYPED_MISS_HINT, said: { pt: text, en: '' } });
      return;
    }
    return this.applyChoice(s, sc, scored.chip, scored.task_success, 'type', text, jev);
  }


  private applyChoice(s: Session, sc: SceneState, chip: number, cap: 0 | 1 | 2 | 3, channel: 'chip' | 'type', typed?: string, jev?: JevNpcReplyAnswers) {
    const p = s.profile!;
    const res = this.services.npc.choose(sc.npc, sc.node, chip, sc.ctx, cap);
    if (!res) return;
    this.services.student.record({
      playerId: p.id,
      itemIds: res.cards,
      channel,
      score: res.score,
      latencyMs: this.now() - sc.shownAt,
      place: 'padaria',
      nameplate: p.nameplate,
      at: this.now(),
      ...(jev ? { jev } : {}),
    });
    if (typed) this.caderno.used(s, typed); // accepted typed answer (the accept list matched a chip)
    this.caderno.seen(s, res.view.line.pt);
    sc.scores.push(res.score);
    sc.node = res.view.nodeId;
    sc.ctx = res.ctx;
    sc.shownAt = this.now();
    let payout: number | undefined;
    let dailyBlocked = false;
    if (res.view.end) {
      this.rollDaily(p);
      s.scene = undefined;
      this.completeStep(s, 'carlos');
      this.missionStep(s, 'pede');
      this.recados.onEvent(s, { kind: 'ordered', npc: 'carlos', items: sceneItems(sc.ctx) });

      // Pedido rápido RV: once per player day (fixes double-dip after Missão/prior Pedido)
      const grantDay = this.dayOf(p);
      const lastGrant = p.daily.pedidoRvGranted?.[sc.npc];
      if (lastGrant === grantDay) {
        dailyBlocked = true;
        payout = 0;
      } else {
        payout = scenePayout(sc.scores, 0);
        if (!p.daily.pedidoRvGranted) p.daily.pedidoRvGranted = {};
        p.daily.pedidoRvGranted[sc.npc] = grantDay;
        if (payout > 0) this.reward(s, payout, { pt: 'Café da manhã com o Seu Carlos', en: 'Breakfast with Seu Carlos' });
      }
      this.store.save(p.id);
    }
    const said = typed ? { pt: typed, en: res.said.pt } : res.said;
    s.send({ t: 'scene', view: res.view, lastScore: res.score, feedback: SCORE_FEEDBACK[res.score], said, payout, dailyBlocked });
  }

  private rollDaily(p: StoredProfile) {
    const day = this.dayOf(p);
    if (p.daily.date !== day) p.daily = { date: day, sceneClears: {} };
  }

  /** Push the stored profile to a connected player. */
  pushProfileById(playerId: string) {
    const s = this.sessionByProfile(playerId);
    if (s) this.pushProfile(s);
  }

  /** Profile + avatar after a billing event, so pets, bubbles and the badge update live. */
  syncEntitlements(userId: string) {
    const s = this.sessionByProfile(userId);
    if (!s?.profile) return;
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  private async perk(s: Session, msg: Extract<ClientMsg, { t: 'perk' }>) {
    if (msg.action === 'petName') {
      if (msg.pet !== 'dog' && msg.pet !== 'cat') return;
      return this.namePet(s, msg.pet, typeof msg.name === 'string' ? msg.name : '');
    }
    const p = s.profile!;
    const active = hasPerkAccess(p.subscription, this.now());
    if (msg.action === 'pet') {
      // the compatibility shim (Apoiar's Nenhum / Cachorro / Gato, #234): the first pet of that species goes out (a subscriber with none gets
      // the caramelo or the orange cat, as before the pet shop); null sends everyone home
      if (msg.pet !== null && msg.pet !== 'dog' && msg.pet !== 'cat') return;
      if (msg.pet && !active) {
        return this.err(s, 'perk', 'Pets de assinante ficam disponíveis enquanto a assinatura está ativa.', 'Subscriber pets are available while the subscription is active.');
      }
      if (msg.pet) {
        const pet = ensureLegacyPet(p, msg.pet, this.now());
        if (!pet) return this.err(s, 'perk', 'Adote um no Pet Shop do Seu Dito.', 'Adopt one at Seu Dito’s pet shop.');
        setActivePet(p, pet.id);
      } else setActivePet(p, null);
      this.sendHomePets(p.id);
    } else {
      if (!isBubbleStyle(msg.style)) return;
      if (msg.style !== 'classic' && !active) {
        return this.err(s, 'perk', 'Esses balões são de quem assina.', 'Those bubbles are for subscribers.');
      }
      p.bubbleStyle = msg.style;
    }
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  /**
   * Name one pet. Shape first, then the same classifier as chat (word filter, then the moderation model).
   * A name that is not `allow` is refused with the classifier's note. The profile keeps the trimmed
   * text the player typed, or nothing — never a censored or substituted string.
   */
  private async namePet(s: Session, pet: 'dog' | 'cat', raw: string) {
    const p = s.profile!;
    if (!hasPerkAccess(p.subscription, this.now())) {
      return this.err(s, 'petName', 'Pets de assinante ficam disponíveis enquanto a assinatura está ativa.', 'Subscriber pets are available while the subscription is active.');
    }
    const name = await this.moderatePetName(s, raw);
    if (name === null || s.profile !== p) return;
    // the old message names the pet of that species that is out, else the first one (the caramelo / orange cat when there is none yet)
    const out = activePet(p);
    const target = out?.species === pet ? out : ensureLegacyPet(p, pet, this.now());
    if (!target) return this.err(s, 'petName', 'Adote um no Pet Shop do Seu Dito.', 'Adopt one at Seu Dito’s pet shop.');
    renameOwnedPet(p, target.id, name);
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
    this.sendHomePets(p.id);
  }

  /**
   * A pet name the player typed: shape first, then the same classifier as chat (word filter, then the moderation model). A name that is not
   * `allow` is refused with the classifier's note (error code `petName`) and flagged; null then. Never a censored or substituted string.
   */
  private async moderatePetName(s: Session, raw: string): Promise<string | null> {
    const p = s.profile!;
    const shape = validatePetName(raw);
    if (!shape.ok) {
      this.err(s, 'petName', shape.reason.pt, shape.reason.en);
      return null;
    }
    const verdict = await this.services.safety.classify(shape.name, this.safetyCtx(s));
    if (this.sessions.get(s.id) !== s || s.profile !== p) return null;
    const decision = petNameDecision(shape.name, verdict);
    if (!decision.ok) {
      this.flag(s, 'profile', verdict, decision.name);
      this.err(s, 'petName', decision.reason.pt, decision.reason.en);
      return null;
    }
    return decision.name;
  }

  /** The pets resting in a kitnet (not the one out with its owner): what everyone in that kitnet sees. */
  private homePetsOf(ownerId: string): HomePet[] {
    const owner = this.store.get(ownerId);
    if (!owner) return [];
    const resting = (owner.pets ?? []).filter((q) => q.id !== owner.activePetId);
    const blocked = new Set((owner.apartment ?? []).filter((f) => !furnitureById(f.itemId)?.walkable).map((f) => `${f.x},${f.y}`));
    return homePetSpots(owner.apartment ?? [], resting, (x, y) => blocked.has(`${x},${y}`));
  }

  /** Re-send a kitnet's resting pets to everyone in it (a pet went out or came home, a bed moved, a collar changed). */
  private sendHomePets(ownerId: string) {
    const inst = this.instances.get(`kitnet@${ownerId}`);
    if (!inst || inst.members.size === 0) return;
    this.broadcast(inst, { t: 'homePets', pets: this.homePetsOf(ownerId) });
  }

  // ---------- Correria no Balcão (the padaria counter game; apps/server/src/correria.ts) ----------

  private minigame(s: Session, m: Extract<ClientMsg, { t: 'mg' }>) {
    this.correria.handle(s, m);
  }

  /** Test hook: the order the customer at the counter wants now (lines and mods; the client never gets them outside TB_TEST_MG). */
  debugOrder(s: Session) {
    const sh = this.correria.shiftOf(s);
    const f = sh && frontOf(sh);
    return f ? f.order : undefined;
  }

  /** Test hook: the shift in progress. */
  debugShift(s: Session) {
    return this.correria.shiftOf(s);
  }

  // ---------- daily kiosk (Missão do dia) ----------

  private missionOf(p: StoredProfile): DailyMission {
    const day = this.dayOf(p);
    if (p.mission?.date !== day) p.mission = freshMission(day);
    return p.mission;
  }

  private takeMission(s: Session) {
    if (s.instance?.def.id !== 'praca') return this.err(s, 'mission', 'O quiosque de missões fica na praça.', 'The mission kiosk is in the square.');
    const m = this.missionOf(s.profile!);
    if (!m.taken) {
      m.taken = true;
      this.store.save(s.profile!.id);
    }
    this.pushProfile(s);
  }

  private missionStep(s: Session, step: MissionStep) {
    const p = s.profile;
    if (!p) return;
    const m = this.missionOf(p);
    if (!m.taken || m.steps[step]) return;
    m.steps[step] = true;
    const def = MISSION_STEPS.find((x) => x.id === step)!;
    s.send({ t: 'notice', level: 'info', pt: `✓ ${def.pt}`, en: def.en });
    if (!m.rewarded && MISSION_STEPS.every((x) => m.steps[x.id])) {
      m.rewarded = true;
      this.reward(s, this.config.get('missionReward'), MISSION_COPY.done);
    } else {
      this.store.save(p.id);
      this.pushProfile(s);
    }
  }

  // ---------- shop ----------

  private buy(s: Session, kind: 'hat' | 'furniture' | 'parrot' | 'gi', itemId: string) {
    const p = s.profile!;
    if (kind === 'gi') {
      if (itemId !== GI_ITEM_ID) return;
      if (s.instance?.def.id !== 'academia') return this.err(s, 'shop', 'O kimono se compra no vestiário da academia.', 'Buy the gi at the academy changing area.');
      const prop = s.instance.def.props.find((q) => q.id === 'vestiario');
      if (!prop?.interact) return;
      const cur = this.currentTile(s);
      const spot = prop.interact;
      const d = Math.max(Math.abs(cur.tile.x - spot.x), Math.abs(cur.tile.y - spot.y));
      if (d > 2) return this.err(s, 'shop', 'Chega mais perto do vestiário.', 'Get closer to the changing area.');
      if (p.giOwned) return this.err(s, 'owned', 'Você já tem kimono.', 'You already own a gi.');
      if (p.coins < GI_PRICE) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
      p.coins -= GI_PRICE;
      p.giOwned = true;
      p.bjj = normalizeBjj({ ...(p.bjj ?? {}), belt: 'branca', stripes: 0, wins: p.bjj?.wins ?? 0 });
      this.store.save(p.id);
      s.send({
        t: 'notice',
        level: 'reward',
        pt: 'Kimono comprado! Professora Bia te deu a faixa branca.',
        en: 'Gi purchased! Professora Bia gave you the white belt.',
      });
      this.pushProfile(s);
      this.broadcastAvatar(s);
      return;
    }
    if (kind === 'parrot') {
      if (!parrotColorById(itemId)) return;
      if (s.instance?.def.id !== 'praca') return this.err(s, 'shop', 'O puleiro fica na praça.', 'The bird perch is in the square.');
      const result = buyParrotColor(p, itemId);
      if (result === 'unknown') return;
      if (result === 'coins') return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
      if (result === 'equipped') return this.equipParrotColor(s, itemId);
      const color = parrotColorById(itemId)!;
      this.store.save(p.id);
      s.send({ t: 'notice', level: 'reward', pt: `${color.pt} no ombro!`, en: `${color.en} on your shoulder!` });
      this.pushProfile(s);
      this.broadcastAvatar(s);
      return;
    }
    if (kind === 'hat') {
      const hat = hatById(itemId);
      // Nanda's stall sells hers in the praça; Jô's beach rack sells the beach ones at the Praia; earned hats are never sold
      const praiaRack = !!hat && isPraiaHat(hat.id);
      if (!hat || !(isStallHat(hat.id) || praiaRack)) return;
      if (praiaRack && s.instance?.def.id !== 'praia') return this.err(s, 'shop', 'Esse chapéu só a Jô vende, lá na praia.', 'Only Jô sells this hat, at the beach.');
      if (!praiaRack && s.instance?.def.id !== 'praca') return this.err(s, 'shop', 'A barraca da Nanda fica na praça.', 'Nanda’s stall is in the square.');
      if (p.hats.includes(hat.id)) return this.err(s, 'owned', 'Você já tem esse chapéu.', 'You already own this hat.');
      if (p.coins < hat.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV yet: play “Correria no Balcão” at the bakery, or do a favor (Favores).');
      p.coins -= hat.price;
      p.hats.push(hat.id);
      this.store.save(p.id);
      const seller = praiaRack ? 'Jô' : 'Nanda';
      s.send({ t: 'notice', level: 'reward', pt: `${seller}: “${hat.pt}? Fica bem em você!”`, en: `${seller}: “${hat.en}? Looks good on you!”` });
      this.pushProfile(s);
      return this.equipHat(s, hat.id);
    }
    const item = furnitureById(itemId);
    // earned pieces are never sold, and the pet shop's beds and food bag are sold at its lojinha only (`pet` buy)
    if (!item || item.earned || item.shop) return;
    if (s.instance?.def.id !== 'kitnet' || s.instance.ownerId !== p.id) return this.err(s, 'shop', 'Compre móveis na sua kitnet.', 'Buy furniture from inside your own apartment.');
    if (p.coins < item.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
    p.coins -= item.price;
    p.furniture[item.id] = (p.furniture[item.id] ?? 0) + 1;
    this.store.save(p.id);
    s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${item.pt}`, en: `Bought: ${item.en}` });
    this.pushProfile(s);
  }

  private equipHat(s: Session, hatId: string | null) {
    const p = s.profile!;
    if (hatId !== null && !p.hats.includes(hatId)) return;
    p.hat = hatId;
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
    if (hatId) this.completeStep(s, 'chapeu');
  }

  private buySnack(s: Session, itemId: string) {
    const snack = snackById(itemId);
    const p = s.profile!;
    if (!snack) return;
    // the cart (or the airport café) has to be in the room you are standing in
    const sellers = snackPropIds(snack);
    const prop = s.instance?.def.props.find((q) => sellers.includes(q.id));
    if (!prop) return this.err(s, 'shop', 'Compre na praça.', 'Buy this in the square.');
    const cur = this.currentTile(s);
    const spot = prop.interact ?? { x: prop.x, y: prop.y };
    const d = Math.max(Math.abs(cur.tile.x - spot.x), Math.abs(cur.tile.y - spot.y));
    if (d > 2) return this.err(s, 'shop', 'Chega mais perto do carrinho.', 'Get closer to the cart.');
    if (p.coins < snack.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
    p.coins -= snack.price;
    s.carry = snack.id;
    this.store.save(p.id);
    // the water cooler gives, it does not sell
    if (snack.price === 0) s.send({ t: 'notice', level: 'info', pt: `Pegou: ${snack.pt}`, en: `Picked up: ${snack.en}` });
    else s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${snack.pt}`, en: `Bought: ${snack.en}` });
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  /** The padaria counter: pay the baker on duty (shared) or the case (owned), carry it out, and it counts as ordered for the recados. */
  private buyCounter(s: Session, itemId: string) {
    const p = s.profile!;
    if (s.instance?.def.id !== 'padaria') return;
    const owned = this.floorPadaria(s);
    if (owned) {
      const menu = counterMenuForOwned(owned);
      if (!menu.includes(itemId)) return;
      const balcao = s.instance!.def.props.find((q) => q.id === 'balcao');
      const spot = balcao ? { x: balcao.x + 2, y: balcao.y + 1 } : s.instance!.def.spawn;
      const cur = this.currentTile(s).tile;
      if (Math.max(Math.abs(cur.x - spot.x), Math.abs(cur.y - spot.y)) > 3) return this.err(s, 'far', 'Chegue mais perto do balcão.', 'Walk closer to the counter.');
      const price = COUNTER_PRICES[itemId] ?? counterPrice(isCounterItem(itemId) ? itemId : 'cafe');
      if (p.coins < price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
      p.coins -= price;
      s.carry = itemId as CounterItemId;
      this.rollDaily(p);
      const card = cardById(`lex.padaria.${itemId}`);
      if (card) this.caderno.seen(s, card.form, [card.id]);
      if (itemId === 'brigadeiro' || itemId === 'bolo_de_cenoura' || itemId === 'sonho') {
        const wid = SWEET_WORD_IDS[itemId as keyof typeof SWEET_WORD_IDS];
        if (wid) this.caderno.seen(s, cardById(wid)?.form ?? itemId, [wid]);
      }
      // a visitor's reais go into the owner's till (a transfer, never new RV)
      const owner = owned.ownerId !== p.id ? this.store.get(owned.ownerId) : undefined;
      if (owner) {
        owner.coins += price;
        const os = this.sessionByProfile(owner.id);
        if (os) {
          this.pushProfile(os);
          os.send({ t: 'notice', level: 'reward', pt: `${p.name} comprou ${card?.form ?? itemId} na ${owned.name}: +${price} RV`, en: `${p.name} bought ${card?.gloss_en ?? itemId} at ${owned.name}: +${price} RV` });
        }
      }
      this.store.save(...(owner ? [p.id, owner.id] : [p.id]));
      s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${card?.form ?? itemId}`, en: `Bought: ${card?.gloss_en ?? itemId}` });
      this.pushProfile(s);
      this.broadcastAvatar(s);
      return;
    }
    if (!isCounterItem(itemId)) return;
    const baker = this.npcs.whoIn('padaria').find((n) => n.id === 'carlos' || n.id === 'graca');
    if (!baker) return;
    const cur = this.currentTile(s).tile;
    const d = Math.min(...[baker.interact, baker.tile].map((t) => Math.max(Math.abs(cur.x - t.x), Math.abs(cur.y - t.y))));
    const name = baker.id === 'graca' ? 'Dona Graça' : 'Seu Carlos';
    if (d > 2) return this.err(s, 'far', `Chegue mais perto de ${name}.`, `Walk closer to ${name}.`);
    const price = counterPrice(itemId);
    if (p.coins < price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
    p.coins -= price;
    s.carry = itemId;
    this.rollDaily(p);
    // saying the order counts as using the words, like a typed answer in a scene
    this.caderno.used(s, counterOrderLine(itemId).pt);
    this.completeStep(s, 'carlos');
    this.missionStep(s, 'pede');
    // ordering at the counter is talking to the baker (friendship, `falar` steps), as the breakfast scene used to be
    this.recados.onEvent(s, { kind: 'talked', npc: baker.id });
    this.recados.onEvent(s, { kind: 'ordered', npc: 'carlos', items: [{ itemId, qty: 1 }] });
    this.store.save(p.id);
    const item = itemById(itemId);
    s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${item?.name.pt ?? itemId}`, en: `Bought: ${item?.name.en ?? itemId}` });
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  /** Eat, drink, or toss the snack in hand. Cosmetics are not carry items, so they never match. */
  private useCarry(s: Session, action: string) {
    const held = carryOf(s.carry);
    if (!held) return;
    if (action === 'consume') {
      if (held.kind === 'trash') return;
      s.carry = held.leaves;
      s.send({ t: 'notice', level: 'reward', pt: CARRY_YUM.pt, en: CARRY_YUM.en });
      this.broadcastAvatar(s);
      return;
    }
    if (action !== 'toss') return;
    const tossed = carryTossNotice(held.id);
    if (!tossed) return;
    const note = this.nearLixeira(s) ? CARRY_BIN : tossed;
    s.carry = null;
    s.send({ t: 'notice', level: 'info', pt: note.pt, en: note.en });
    this.broadcastAvatar(s);
  }

  /** Chebyshev distance, same reach as buying at a cart (~2 tiles). */
  private nearLixeira(s: Session): boolean {
    if (!s.instance || !s.avatar) return false;
    const { x, y } = this.currentTile(s).tile;
    return s.instance.def.props.some((p) => p.kind === 'lixeira' && Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= 2);
  }

  private equipParrotColor(s: Session, colorId: string) {
    const p = s.profile!;
    const colors = ownedParrotColorIds(p);
    if (!colors.includes(colorId)) return;
    p.parrotColors = colors;
    p.parrotOwned = true;
    p.parrotColor = colorId;
    p.parrotEquipped = true;
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  private parrot(s: Session, action: 'adopt' | 'toggle' | 'hint' | 'color', colorId?: string) {
    const p = s.profile!;
    if (action === 'color') {
      if (!colorId) return;
      return this.equipParrotColor(s, colorId);
    }
    if (action === 'adopt') {
      if (p.parrotOwned) return;
      if (s.instance?.def.id !== 'praca') return;
      p.parrotOwned = true;
      p.parrotEquipped = true;
      p.parrotColors = ownedParrotColorIds(p);
      if (!p.parrotColors.includes('verde')) p.parrotColors = ['verde', ...p.parrotColors];
      p.parrotColor = 'verde';
      s.send({ t: 'notice', level: 'reward', pt: 'Um papagaio agora é seu amigo! Ele sussurra palavras.', en: 'A parrot is now your buddy! It whispers study words (hint).' });
    } else if (action === 'toggle') {
      if (!p.parrotOwned) return;
      p.parrotEquipped = !p.parrotEquipped;
    } else {
      if (!p.parrotOwned || !p.parrotEquipped) return;
      const now = this.now();
      const cooldownMs = this.config.get('parrotHintCooldownSec') * 1000;
      if (now - s.lastHintAt < cooldownMs) {
        const wait = Math.ceil((cooldownMs - (now - s.lastHintAt)) / 1000);
        return s.send({ t: 'notice', level: 'info', pt: `O papagaio está descansando (${wait}s).`, en: `Your parrot is resting (${wait}s).` });
      }
      s.lastHintAt = now;
      const [id] = this.services.student.scheduled(p.id, s.instance?.def.id ?? 'praca', 1);
      const card = cardById(id);
      if (card) s.send({ t: 'parrotHint', word: { pt: card.form, en: card.gloss_en } });
      return;
    }
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  // ---------- kitnet furniture ----------

  private furniture(s: Session, m: Extract<ClientMsg, { t: 'furniture' }>) {
    const p = s.profile!;
    const inst = s.instance;
    if (!inst || inst.def.id !== 'kitnet' || inst.ownerId !== p.id) return this.err(s, 'furniture', 'Só dá pra decorar a sua kitnet.', 'You can only decorate your own apartment.');
    const room = inst.def;
    const rot: 0 | 1 = 'rot' in m && m.rot === 1 ? 1 : 0;
    if (m.action === 'place') {
      const def = furnitureById(m.itemId);
      if (!def || (p.furniture[def.id] ?? 0) <= 0) return;
      if (!canPlaceFurniture(room, p.apartment, m.x, m.y) || this.occupied(inst, m.x, m.y))
        return this.err(s, 'place', 'Não cabe aí.', 'That spot is taken.');
      p.furniture[def.id]--;
      if (p.furniture[def.id] <= 0) delete p.furniture[def.id];
      p.apartment.push({ uid: `${def.id}-${this.store.newId()}`, itemId: def.id, x: m.x, y: m.y, rot });
      if (def.seat) this.completeStep(s, 'cadeira');
    } else if (m.action === 'move') {
      const f = p.apartment.find((x) => x.uid === m.uid);
      if (!f) return;
      const same = f.x === m.x && f.y === m.y;
      if (!same && (!canPlaceFurniture(room, p.apartment, m.x, m.y, f.uid) || this.occupied(inst, m.x, m.y)))
        return this.err(s, 'place', 'Não cabe aí.', 'That spot is taken.');
      f.x = m.x;
      f.y = m.y;
      f.rot = rot;
    } else {
      const idx = p.apartment.findIndex((x) => x.uid === m.uid);
      if (idx < 0) return;
      const [f] = p.apartment.splice(idx, 1);
      p.furniture[f.itemId] = (p.furniture[f.itemId] ?? 0) + 1;
    }
    this.store.save(p.id);
    this.pushProfile(s);
    this.broadcast(inst, { t: 'furnitureState', furniture: p.apartment });
    // a bed or a rug moved: the resting pets settle again
    if ((p.pets?.length ?? 0) > 0) this.sendHomePets(p.id);
  }

  private occupied(inst: Instance, x: number, y: number) {
    for (const m of inst.members.values()) {
      const t = this.currentTile(m).tile;
      if (t.x === x && t.y === y) return true;
    }
    return false;
  }

  // ---------- friends ----------

  private sessionByProfile(id: string) {
    for (const s of this.sessions.values()) if (s.profile?.id === id) return s;
    return undefined;
  }

  private friend(s: Session, action: 'request' | 'accept' | 'decline' | 'remove', targetId: string): void {
    const p = s.profile!;
    const target = this.store.get(String(targetId));
    if (!target || target.id === p.id) return;
    if (action === 'request') {
      if (p.friends.includes(target.id)) return this.err(s, 'friend', 'Vocês já são amigos!', 'You’re already friends!');
      // A crossed request is an accept.
      if (this.friendReqs.has(p.id, target.id)) return this.friend(s, 'accept', target.id);
      if (hasBlocked(p, target.id)) return this.err(s, 'friend', 'Desbloqueie essa pessoa primeiro.', 'Unblock this player first.');
      // Blocked by the target: it looks sent, but nothing reaches them.
      if (hasBlocked(target, p.id)) return s.send({ t: 'notice', level: 'info', pt: `Pedido de amizade enviado para ${target.name}.`, en: `Friend request sent to ${target.name}.` });
      this.friendReqs.add(target.id, p.id);
      const ts = this.sessionByProfile(target.id);
      ts?.send({ t: 'friendRequest', fromId: p.id, fromName: p.name });
      if (ts) this.sendFriends(ts);
      return s.send({ t: 'notice', level: 'info', pt: `Pedido de amizade enviado para ${target.name}.`, en: `Friend request sent to ${target.name}.` });
    }
    if (action === 'accept') {
      if (!this.friendReqs.has(p.id, target.id)) return;
      this.friendReqs.delete(p.id, target.id);
      if (!p.friends.includes(target.id)) p.friends.push(target.id);
      if (!target.friends.includes(p.id)) target.friends.push(p.id);
      this.store.save(p.id, target.id);
      const ts = this.sessionByProfile(target.id);
      ts?.send({ t: 'notice', level: 'reward', pt: `${p.name} aceitou sua amizade!`, en: `${p.name} accepted your friend request!` });
      if (ts) {
        this.pushProfile(ts);
        this.sendFriends(ts);
      }
    } else if (action === 'decline') {
      this.friendReqs.delete(p.id, target.id);
    } else {
      p.friends = p.friends.filter((f) => f !== target.id);
      target.friends = target.friends.filter((f) => f !== p.id);
      this.store.save(p.id, target.id);
      const ts = this.sessionByProfile(target.id);
      if (ts) {
        this.pushProfile(ts);
        this.sendFriends(ts);
      }
    }
    this.pushProfile(s);
    this.sendFriends(s);
  }

  private sendFriends(s: Session) {
    const p = s.profile!;
    const friends: FriendInfo[] = p.friends
      .map((id) => this.store.get(id))
      .filter((f): f is StoredProfile => !!f)
      .map((f) => {
        const fs = this.sessionByProfile(f.id);
        return {
          id: f.id,
          name: f.name,
          online: !!fs,
          room: fs?.instance?.def.id ?? null,
          roomName: fs?.instance?.name ?? null,
          instanceId: fs?.instance?.id ?? null,
          nameplate: f.nameplate,
        };
      });
    const incoming = this.friendReqs
      .incoming(p.id)
      .map((id) => this.store.get(id))
      .filter((f): f is StoredProfile => !!f)
      .map((f) => ({ id: f.id, name: f.name }));
    const blocked = (p.blocked ?? []).map((id) => ({ id, name: this.store.get(id)?.name ?? '?' }));
    s.send({ t: 'friends', friends, incoming, blocked });
  }

  private notifyFriendsOfPresence(profileId: string) {
    const p = this.store.get(profileId);
    if (!p) return;
    for (const fid of p.friends) {
      const fs = this.sessionByProfile(fid);
      if (fs) this.sendFriends(fs);
    }
  }

  private err(s: Session, code: string, pt: string, en: string) {
    s.send({ t: 'error', code, pt, en });
  }
}

/** Client timers fire these on their own (reconnect hello, order/duel timeouts), so they don't prove anyone is there. */
function isRealInput(msg: ClientMsg): boolean {
  if (msg.t === 'hello') return false;
  return true;
}

function pickIdx(v: unknown, len: number, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 && n < len ? n : fallback;
}

function pickOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback;
}

export function sanitizeAppearance(a: Partial<Appearance> | undefined): Appearance {
  const x = a ?? {};
  return {
    body: pickOf(x.body, BODY_TYPES, 'medio'),
    skin: pickIdx(x.skin, SKIN_TONES.length, 3),
    hair: pickOf(x.hair, HAIR_STYLES, 'curto'),
    hairColor: pickIdx(x.hairColor, HAIR_COLORS.length, 0),
    top: pickOf(x.top, TOP_STYLES, 'camiseta'),
    topColor: pickIdx(x.topColor, CLOTH_COLORS.length, 0),
    bottom: pickOf(x.bottom, BOTTOM_STYLES, 'calca'),
    bottomColor: pickIdx(x.bottomColor, CLOTH_COLORS.length, 2),
    shoes: pickIdx(x.shoes, SHOE_COLORS.length, 0),
    face: pickOf(x.face, FACE_STYLES, 'suave'),
    extra: pickOf(x.extra, EXTRA_STYLES, 'nenhum'),
    idle: pickOf(x.idle, IDLE_POSES, 'solto'),
  };
}
