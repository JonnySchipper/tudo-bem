import {
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
  furnitureById,
  HAIR_COLORS,
  HAIR_STYLES,
  hatById,
  npcAvatarId,
  ADMIN_KICKED_COPY,
  IDLE_KICK_MS,
  IDLE_WARN_MS,
  WEATHER_KINDS,
  idleKickedCopy,
  idleWarningCopy,
  type Weather,
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
  type DailyMission,
  type MissionStep,
  type Appearance,
  type Bilingual,
  type ClientMsg,
  type ConversaGrade,
  type ConversaOrder,
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
  GI_ITEM_ID,
  GI_PRICE,
  PARROT_COLORS,
  parrotColorById,
  snackById,
  snackForProp,
  type StreetSnackId,
  type CounterItemId,
  itemById,
  counterOrderLine,
  counterPrice,
  isCounterItem,
} from '@tudobem/shared';
import type { ChatSafetyService, GlossService, ModerationQueue, NpcDialogueService, StudentModelService } from './services/interfaces.js';
import { ProfileStore, today, todaySaoPaulo, toPrivate, type StoredProfile } from './store.js';
import { CpuCrowd } from './ambiance.js';
import { readEnv } from './env.js';
import { NPC_TICK_MS, NpcDirector } from './npcs.js';
import { RecadoTracker, sceneItems } from './recados.js';
import { CadernoTracker } from './caderno.js';
import { DiaryTracker } from './diary.js';
import { FeiraCounter } from './feira.js';
import { CorreriaEngine, CORRERIA_RESUME_MS, type CorreriaRun } from './correria.js';
import { BoutEngine, type BoutSession } from './bout.js';
import { CartelaTracker } from './cartela.js';
import { ADMIN_MONEY_MAX, readAdminAuthConfig } from './adminAuth.js';

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
}

/** What the World needs from the account store (kept tiny so world.ts stays browser-safe for solo mode). */
export interface AccountLink {
  profileIdFor(accountId: string): string | undefined;
  linkProfile(accountId: string, profileId: string): void;
}

export type CloseReason = 'replaced' | 'idle' | 'logout' | 'admin';

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
  lastActiveAt: number;
  idleWarned: boolean;
  profile?: StoredProfile;
  instance?: Instance;
  avatar?: AvatarState;
  scene?: SceneState;
  mg?: CorreriaRun;
  /** Treino no tatame: the bout in progress (apps/server/src/bout.ts). */
  bout?: BoutSession;
  /** Last tatame loss: rematch same partner and guard position. */
  boutRematch?: { partner: import('@tudobem/shared').PartnerId; position: import('@tudobem/shared').BjjPositionId; weakSpot?: import('@tudobem/shared').GripSpot };
  chatTimes: number[];
  lastHintAt: number;
  /** Street snack in hand (session only; cleared on disconnect). */
  carry: StreetSnackId | CounterItemId | null;
  /** Hidden admin panel unlocked for this socket (password checked server-side). */
  admin?: boolean;
}

const INSTANCE_SUFFIX = ['Norte', 'Sul', 'Leste', 'Oeste'];

export class Instance {
  readonly members = new Map<string, Session>();
  /** Ambiance CPUs (Praça, Academia). Not members, so they never take a player seat. */
  crowd?: CpuCrowd;
  /** The last walk of each NPC that was broadcast here (`NpcPose.legId`), so the tick only sends what changed. */
  readonly npcSeen = new Map<NpcId, string>();
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
  private incomingFriendReqs = new Map<string, Set<string>>();
  private readonly cap: number;
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
  /** The neighbours: schedules, positions, walks (pure function of the game clock). */
  private readonly npcs: NpcDirector;
  private npcTicking = false;
  private readonly accounts?: AccountLink;
  readonly idleKickMs: number;
  private seq = 0;
  /** Recados, bag and bonds (HOWTO Phase 8). The world only reports events to it. */
  private readonly recados: RecadoTracker;
  private readonly cartela: CartelaTracker;
  /** Caderno de palavras: what the player saw, heard and used (Phase 7). */
  private readonly caderno: CadernoTracker;
  /** Language diary: camera, signs, conversation lines, and the escola game. */
  private readonly diary: DiaryTracker;
  /** The feira's prices and payments (Phase 9). */
  private readonly feira: FeiraCounter;
  /** Correria no Balcão: shifts, clocks and parked resume (apps/server/src/correria.ts). */
  private readonly correria: CorreriaEngine;

  constructor(
    readonly store: ProfileStore,
    readonly services: Services,
    opts: WorldOptions = {},
  ) {
    this.cap = Math.max(1, Math.min(DEFAULT_ROOM_CAP, opts.roomCap ?? DEFAULT_ROOM_CAP));
    this.now = opts.now ?? Date.now;
    this.schedule = opts.schedule ?? ((fn, ms) => void (setTimeout(fn, ms) as unknown as { unref?: () => void }).unref?.());
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
    this.npcs = new NpcDirector(() => this.clockNow());
    this.accounts = opts.accounts;
    this.idleKickMs = Math.max(1000, opts.idleKickMs ?? IDLE_KICK_MS);
    this.cartela = new CartelaTracker({
      now: () => this.now(),
      store,
      reward: (s, amount, reason) => this.reward(s, amount, reason),
      pushProfile: (s) => this.pushProfile(s),
    });
    this.recados = new RecadoTracker({
      now: () => this.now(),
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
    this.caderno = new CadernoTracker({ now: () => this.now(), store, reward: (s, a, r) => this.reward(s, a, r), pushProfile: (s) => this.pushProfile(s) });
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
        const owner = s.instance?.ownerId;
        return (owner ? this.store.get(owner)?.apartment : undefined) ?? [];
      },
      rng: () => this.rng(),
      now: () => this.now(),
      day: () => gameDay(this.clockNow()),
    });
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
      testHints: opts.testMg ?? readEnv('TB_TEST_MG') === '1',
    });
  }

  // ---------- connection lifecycle ----------

  connect(id: string, send: (m: ServerMsg) => void, close: (reason: CloseReason) => void, auth: { accountId?: string } = {}): Session {
    const s: Session = { id, send, close, accountId: auth.accountId, lastActiveAt: this.now(), idleWarned: false, chatTimes: [], lastHintAt: 0, carry: null };
    this.sessions.set(id, s);
    return s;
  }

  disconnect(s: Session) {
    if (this.sessions.get(s.id) !== s) return;
    this.correria.park(s);
    this.leaveInstance(s);
    this.sessions.delete(s.id);
    if (s.profile) {
      s.profile.lastSeen = this.now();
      this.store.save();
      this.notifyFriendsOfPresence(s.profile.id);
    }
  }

  /**
   * Server-authoritative AFK check (call every few seconds). Only players in the world count: a
   * socket still on the login / avatar screen holds no seat. Client pings don't reset the clock.
   */
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
  }

  /** Close every live socket of an account (used on logout). */
  dropAccount(accountId: string) {
    for (const s of [...this.sessions.values()]) if (s.accountId === accountId) this.kick(s, 'logout');
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
    if (msg.t === 'hello') return this.hello(s, msg.token);
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
        return this.report(s, msg.targetId, msg.text);
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
      case 'padaria':
        return this.buyCounter(s, msg.itemId);
      case 'equipHat':
        return this.equipHat(s, msg.hatId);
      case 'parrot':
        return this.parrot(s, msg.action, msg.colorId);
      case 'furniture':
        return this.furniture(s, msg);
      case 'friend':
        return this.friend(s, msg.action, msg.targetId);
      case 'friends':
        return this.sendFriends(s);
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
      case 'heard':
        return this.caderno.heard(s, msg.cardIds);
      case 'arrival':
        return msg.action === 'replay' ? this.diary.replayArrival(s) : this.diary.finishArrival(s);
      case 'diary':
        return this.diary.handle(s, msg);
      case 'talk':
        if (this.recados.talk(s, msg.npc)) this.caderno.seen(s, talkOpener(msg.npc, s.profile?.name, gameMinutes(this.clockNow())) ?? '');
        return;
      case 'admin':
        return this.admin(s, msg);
    }
  }

  // ---------- profile ----------

  private hello(s: Session, token?: string) {
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

  private linkAccount(accountId: string, p: StoredProfile) {
    p.accountId = accountId;
    this.accounts!.linkProfile(accountId, p.id);
    this.store.save();
  }

  private attachProfile(s: Session, p: StoredProfile) {
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
    p.nameplate = this.services.student.nameplateFor(p);
    p.lastSeen = this.now();
    s.send({ t: 'welcome', profile: toPrivate(p), token: p.token, serverNow: this.clockNow(), weather: this.weatherPin });
    if (p.photos?.length) this.pushPhotos(s);
    this.notifyFriendsOfPresence(p.id);
    const incoming = this.incomingFriendReqs.get(p.id);
    if (incoming?.size) this.sendFriends(s);
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
      coins: ECONOMY.startingCoins,
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
      daily: { date: today(), sceneClears: {} },
      lastSeen: this.now(),
      // Set before save: a missing flag is treated as already home, so a new account must say false itself.
      arrivalIntroDone: false,
      hasCamera: false,
      diary: [],
      film: 0,
      photos: [],
    };
    this.store.add(p);
    if (this.accounts && s.accountId) this.linkAccount(s.accountId, p);
    this.attachProfile(s, p);
  }

  private updateAppearance(s: Session, a: Appearance) {
    s.profile!.appearance = sanitizeAppearance(a);
    this.store.save();
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  private pushProfile(s: Session) {
    if (s.profile) s.send({ t: 'profile', profile: toPrivate(s.profile) });
  }

  /** The diary photos, apart from the profile (they are the heavy part): after welcome and when one is added. */
  private pushPhotos(s: Session) {
    if (s.profile) s.send({ t: 'photos', photos: s.profile.photos ?? [] });
  }

  private reward(s: Session, amount: number, reason: Bilingual) {
    if (amount <= 0 || !s.profile) return;
    s.profile.coins += amount;
    this.store.save();
    s.send({ t: 'reward', amount, coins: s.profile.coins, reason });
    this.pushProfile(s);
  }

  private completeStep(s: Session, step: TutorialStep) {
    const p = s.profile!;
    if (p.tutorial[step]) return;
    p.tutorial[step] = true;
    this.store.save();
    s.send({ t: 'tutorial', step });
    this.pushProfile(s);
    if (!p.tutorialRewarded && TUTORIAL_STEPS.every((t) => p.tutorial[t.id])) {
      p.tutorialRewarded = true;
      this.reward(s, ECONOMY.tutorialBonus, { pt: 'Primeiros passos completos! Bem-vindo ao bairro!', en: 'First steps complete! Welcome to the neighborhood!' });
    }
  }

  // ---------- rooms ----------

  private instanceFor(room: RoomId, s: Session, opts: { instanceId?: string; ownerId?: string }): Instance | { error: Bilingual } {
    const def = ROOMS[room];
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

  join(s: Session, room: RoomId, opts: { instanceId?: string; ownerId?: string } = {}, arrive?: { tile: Tile; dir: Dir }) {
    if (!isRoomId(room)) return this.err(s, 'room', 'Sala desconhecida.', 'Unknown room.');
    const target = this.instanceFor(room, s, opts);
    if ('error' in target) return this.err(s, 'join', target.error.pt, target.error.en);
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
      avatars: [...[...target.members.values()].map((m) => this.publicAvatar(m)), ...(target.crowd?.avatars() ?? []), ...(target.def.private ? [] : this.npcs.avatarsIn(def.id))],
      furniture,
      serverNow: this.clockNow(),
    });
    // a joiner mid-walk: the avatars above are at the tile each NPC has reached, this sends the rest of each walk
    for (const p of this.npcs.posesIn(def.id)) {
      const moved = this.npcs.moved(p);
      if (moved) s.send(moved);
    }
    this.correria.resume(s);
    this.recados.onEvent(s, { kind: 'entered', room: def.id, tile });
    this.cartela.onEntered(s, def.id);
    this.broadcast(target, { t: 'avatarJoined', avatar: this.publicAvatar(s) }, s);
    target.crowd?.sync();
    this.startNpcTick();
    this.notifyFriendsOfPresence(s.profile!.id);
  }

  /** The game clock: real time plus the test offset. Everything the players see as time of day comes from here. */
  private clockNow() {
    return this.now() + this.clockOffsetMs;
  }

  /**
   * Test only (the server wires it to `/__test/clock` when `TB_TEST_CLOCK_CONTROL=1`): shift the game clock so it reads `minute` (0..1439) right now.
   * Timers and the real day are untouched; clients that join afterwards sync to it.
   */
  setClockMinute(minute: number): number {
    const target = Math.max(0, Math.min(1439.99, minute));
    const cur = gameMinutesExact(this.clockNow());
    this.clockOffsetMs += (((target - cur) % 1440) + 1440) % 1440 * MS_PER_GAME_MINUTE;
    return gameMinutes(this.clockNow());
  }

  /** Push the live sky (clock stamp + weather pin) to one session or every connected player. */
  private pushSky(to?: Session) {
    const msg = { t: 'sky' as const, serverNow: this.clockNow(), weather: this.weatherPin };
    if (to) return to.send(msg);
    for (const s of this.sessions.values()) if (s.profile) s.send(msg);
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
      if (msg.password !== this.adminPassword) {
        s.admin = false;
        return s.send({
          t: 'admin',
          phase: 'auth',
          ok: false,
          pt: 'Senha incorreta.',
          en: 'Wrong password.',
        });
      }
      s.admin = true;
      s.send({ t: 'admin', phase: 'auth', ok: true });
      return this.adminList(s);
    }
    if (!s.admin) {
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
    s.send({ t: 'notice', level: 'info', pt: `${name} saiu da Praça.`, en: `${name} left the Praça.` });
  }

  private adminMoney(s: Session, amount: number) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1 || n > ADMIN_MONEY_MAX) {
      return this.err(s, 'admin', `Pode adicionar de 1 a ${ADMIN_MONEY_MAX} RV por vez.`, `You can add 1 to ${ADMIN_MONEY_MAX} RV at a time.`);
    }
    this.reward(s, n, { pt: 'Admin: reais virtuais', en: 'Admin: virtual reais' });
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
      this.npcSync(inst);
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
    if (!inst) return;
    inst.members.delete(s.id);
    s.instance = undefined;
    if (s.profile) this.broadcast(inst, { t: 'avatarLeft', id: s.profile.id });
    // Idle overflow instances sleep (are dropped); the first public instance always stays.
    if (inst.members.size === 0 && !inst.id.endsWith('#1')) {
      inst.crowd?.stop();
      this.instances.delete(inst.id);
    } else inst.crowd?.sync();
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
    if (!inst.ownerId) return [];
    return this.store.get(inst.ownerId)?.apartment ?? [];
  }

  /** The room's grid for players: props and furniture, plus the tiles the NPCs are standing on right now (they move, so nothing static blocks them). */
  private grid(inst: Instance) {
    return this.npcs.block(inst.def, buildGrid(inst.def, this.furnitureOf(inst)));
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
    return {
      id: p.id,
      name: p.name,
      pronoun: p.pronoun,
      appearance: p.appearance,
      hat: p.hat,
      parrot: p.parrotOwned && p.parrotEquipped,
      parrotColor: p.parrotOwned && p.parrotEquipped ? p.parrotColor ?? 'verde' : null,
      carry: s.carry,
      gi: !!p.giOwned,
      belt: p.giOwned ? normalizeBjj(p.bjj).belt : undefined,
      nameplate: p.nameplate,
      x: cur.tile.x,
      y: cur.tile.y,
      dir: sitting && s.instance ? (this.grid(s.instance).seats.get(key(cur.tile.x, cur.tile.y)) ?? cur.dir) : cur.dir,
      sitting,
    };
  }

  private broadcast(inst: Instance, m: ServerMsg, except?: Session) {
    for (const member of inst.members.values()) if (member !== except) member.send(m);
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
      if (path.length) this.completeStep(s, 'andar');
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
    this.broadcast(s.instance, { t: 'emote', id: s.profile!.id, kind });
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
    s.chatTimes = s.chatTimes.filter((t) => now - t < CHAT_RATE.windowMs);
    if (s.chatTimes.length >= CHAT_RATE.max)
      return s.send({ t: 'notice', level: 'warn', pt: 'Calma! Uma mensagem de cada vez.', en: 'Easy! Too many messages — wait a few seconds.' });
    s.chatTimes.push(now);
    const verdict = await this.services.safety.classify(text, { playerId: p.id, room: inst.id, nameplate: p.nameplate });
    if (verdict.action === 'block' || verdict.action === 'escalate') {
      this.flag(s, 'chat', verdict, text);
      return s.send({ t: 'notice', level: 'block', pt: verdict.note?.pt ?? 'Mensagem bloqueada.', en: verdict.note?.en ?? 'Message blocked.' });
    }
    if (s.instance !== inst) return;
    if (verdict.action === 'warn') this.flag(s, 'chat', verdict, text);
    // Delivered verbatim: player chat is never rewritten (CEO-LOCKS §3).
    const { gloss, lang } = await this.services.gloss.gloss(verdict.text);
    this.broadcast(inst, { t: 'chat', id: p.id, name: p.name, text: verdict.text, gloss, lang, action: verdict.action });
    if (verdict.action === 'warn' && verdict.note) s.send({ t: 'notice', level: 'warn', pt: verdict.note.pt, en: verdict.note.en });
    this.completeStep(s, 'conversar');
    this.caderno.used(s, verdict.text);
    if (inst.def.outdoor && GREETING.test(verdict.text) && this.hasCompany(inst)) this.missionStep(s, 'cumprimenta');
    if (greetingKind(verdict.text)) this.recados.onEvent(s, { kind: 'greeted', text: verdict.text, minute: gameMinutes(this.clockNow()), company: this.hasCompany(inst) });
  }

  /** Log a non-allow Jev verdict; escalations are queued for human review. */
  private flag(s: Session, surface: 'chat' | 'npc_reply', verdict: SafetyVerdict, text: string) {
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
      ...(verdict.action === 'escalate' ? { status: 'pending' as const } : {}),
      at: this.now(),
    });
  }

  private report(s: Session, targetId: string, text?: string) {
    const p = s.profile!;
    this.services.moderation.push({
      kind: 'report',
      surface: 'profile',
      playerId: p.id,
      playerName: p.name,
      room: s.instance?.id ?? '-',
      text: String(text ?? '').slice(0, 200),
      labels: [],
      targetId: String(targetId).slice(0, 32),
      status: 'pending',
      at: this.now(),
    });
    s.send({ t: 'notice', level: 'info', pt: 'Obrigado! Nossa equipe vai dar uma olhada.', en: 'Thanks! Our safety team will take a look.' });
  }

  // ---------- Seu Carlos scene ----------

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

      // Pedido rápido RV: once per America/São_Paulo calendar day (fixes double-dip after Missão/prior Pedido)
      const spDate = todaySaoPaulo();
      const lastGrant = p.daily.pedidoRvGranted?.[sc.npc];
      if (lastGrant === spDate) {
        dailyBlocked = true;
        payout = 0;
      } else {
        payout = scenePayout(sc.scores, 0);
        if (!p.daily.pedidoRvGranted) p.daily.pedidoRvGranted = {};
        p.daily.pedidoRvGranted[sc.npc] = spDate;
        if (payout > 0) this.reward(s, payout, { pt: 'Café da manhã com o Seu Carlos', en: 'Breakfast with Seu Carlos' });
      }
      this.store.save();
    }
    const said = typed ? { pt: typed, en: res.said.pt } : res.said;
    s.send({ t: 'scene', view: res.view, lastScore: res.score, feedback: SCORE_FEEDBACK[res.score], said, payout, dailyBlocked });
  }

  private rollDaily(p: StoredProfile) {
    if (p.daily.date !== today()) {
      const { conversaClears, conversaRvGranted } = p.daily;
      p.daily = {
        date: today(),
        sceneClears: {},
        ...(conversaClears ? { conversaClears } : {}),
        ...(conversaRvGranted ? { conversaRvGranted } : {}),
      };
    }
  }

  /** A Conversa (HTTP flow) finished for this player: counts as a talk, may carry an order, a 'pass' earns bond. */
  conversaEnded(playerId: string, npc: NpcId, grade: ConversaGrade, order?: ConversaOrder) {
    const s = this.sessionByProfile(playerId);
    if (s) {
      this.recados.onConversaEnd(s, npc, grade, order);
      this.cartela.onConversaEnd(s, grade);
    }
  }

  /** A Conversa line moved between the player and an NPC (HTTP flow): the NPC's line is seen, the player's is used. */
  conversaLine(playerId: string, who: 'npc' | 'player', pt: string) {
    const s = this.sessionByProfile(playerId);
    if (s) who === 'npc' ? this.caderno.seen(s, pt) : this.caderno.used(s, pt);
  }

  /** Push the stored profile to a connected player (after Conversa RV lands on the file store). */
  pushProfileById(playerId: string) {
    const s = this.sessionByProfile(playerId);
    if (s) this.pushProfile(s);
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
    if (p.mission?.date !== today()) p.mission = freshMission(today());
    return p.mission;
  }

  private takeMission(s: Session) {
    if (s.instance?.def.id !== 'praca') return this.err(s, 'mission', 'O quiosque de missões fica na praça.', 'The mission kiosk is in the square.');
    const m = this.missionOf(s.profile!);
    if (!m.taken) {
      m.taken = true;
      this.store.save();
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
      this.reward(s, MISSION_REWARD, MISSION_COPY.done);
    } else {
      this.store.save();
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
      this.store.save();
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
      const color = parrotColorById(itemId);
      if (!color || color.id !== itemId) return;
      if (s.instance?.def.id !== 'praca') return this.err(s, 'shop', 'O poleiro fica na praça.', 'The parrot perch is in the square.');
      if (!p.parrotColors) p.parrotColors = [];
      if (p.parrotColors.includes(color.id)) return this.equipParrotColor(s, color.id);
      if (p.coins < color.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
      p.coins -= color.price;
      p.parrotColors.push(color.id);
      p.parrotOwned = true;
      p.parrotEquipped = true;
      p.parrotColor = color.id;
      this.store.save();
      s.send({ t: 'notice', level: 'reward', pt: `Papagaio ${color.pt}!`, en: `${color.en} parrot!` });
      this.pushProfile(s);
      this.broadcastAvatar(s);
      return;
    }
    if (kind === 'hat') {
      const hat = hatById(itemId);
      if (!hat) return;
      if (s.instance?.def.id !== 'praca') return this.err(s, 'shop', 'A barraca da Nanda fica na praça.', 'Nanda’s stall is in the square.');
      if (p.hats.includes(hat.id)) return this.err(s, 'owned', 'Você já tem esse chapéu.', 'You already own this hat.');
      if (p.coins < hat.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet — play “Me vê um…” or talk to Seu Carlos.');
      p.coins -= hat.price;
      p.hats.push(hat.id);
      this.store.save();
      s.send({ t: 'notice', level: 'reward', pt: `Nanda: “${hat.pt}? Fica bem em você!”`, en: `Nanda: “${hat.en}? Looks good on you!”` });
      this.pushProfile(s);
      return this.equipHat(s, hat.id);
    }
    const item = furnitureById(itemId);
    if (!item) return;
    if (s.instance?.ownerId !== p.id) return this.err(s, 'shop', 'Compre móveis na sua kitnet.', 'Buy furniture from inside your own apartment.');
    if (p.coins < item.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
    p.coins -= item.price;
    p.furniture[item.id] = (p.furniture[item.id] ?? 0) + 1;
    this.store.save();
    s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${item.pt}`, en: `Bought: ${item.en}` });
    this.pushProfile(s);
  }

  private equipHat(s: Session, hatId: string | null) {
    const p = s.profile!;
    if (hatId !== null && !p.hats.includes(hatId)) return;
    p.hat = hatId;
    this.store.save();
    this.pushProfile(s);
    this.broadcastAvatar(s);
    if (hatId) this.completeStep(s, 'chapeu');
  }

  private buySnack(s: Session, itemId: string) {
    const snack = snackById(itemId);
    const p = s.profile!;
    if (!snack) return;
    if (s.instance?.def.id !== 'praca') return this.err(s, 'shop', 'Compre na praça.', 'Buy this in the square.');
    const prop = s.instance.def.props.find((q) => q.id === snack.propId);
    if (!prop) return;
    const cur = this.currentTile(s);
    const spot = prop.interact ?? { x: prop.x, y: prop.y };
    const d = Math.max(Math.abs(cur.tile.x - spot.x), Math.abs(cur.tile.y - spot.y));
    if (d > 2) return this.err(s, 'shop', 'Chega mais perto do carrinho.', 'Get closer to the cart.');
    if (p.coins < snack.price) return this.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
    p.coins -= snack.price;
    s.carry = snack.id;
    this.store.save();
    s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${snack.pt}`, en: `Bought: ${snack.en}` });
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  /** The padaria counter: pay the baker on duty, carry it out, and it counts as ordered for the recados (it goes in the bag). */
  private buyCounter(s: Session, itemId: string) {
    const p = s.profile!;
    if (!isCounterItem(itemId) || s.instance?.def.id !== 'padaria') return;
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
    this.store.save();
    const item = itemById(itemId);
    s.send({ t: 'notice', level: 'reward', pt: `Comprou: ${item?.name.pt ?? itemId}`, en: `Bought: ${item?.name.en ?? itemId}` });
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  private equipParrotColor(s: Session, colorId: string) {
    const p = s.profile!;
    if (!p.parrotColors?.includes(colorId)) return;
    p.parrotColor = colorId;
    p.parrotEquipped = true;
    this.store.save();
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
      if (!p.parrotColors) p.parrotColors = [];
      if (!p.parrotColors.includes('verde')) p.parrotColors.push('verde');
      p.parrotColor = 'verde';
      s.send({ t: 'notice', level: 'reward', pt: 'Um papagaio agora é seu amigo! Ele sussurra palavras.', en: 'A parrot is now your buddy! It whispers study words (hint).' });
    } else if (action === 'toggle') {
      if (!p.parrotOwned) return;
      p.parrotEquipped = !p.parrotEquipped;
    } else {
      if (!p.parrotOwned || !p.parrotEquipped) return;
      const now = this.now();
      if (now - s.lastHintAt < ECONOMY.parrotHintCooldownMs) {
        const wait = Math.ceil((ECONOMY.parrotHintCooldownMs - (now - s.lastHintAt)) / 1000);
        return s.send({ t: 'notice', level: 'info', pt: `O papagaio está descansando (${wait}s).`, en: `Your parrot is resting (${wait}s).` });
      }
      s.lastHintAt = now;
      const [id] = this.services.student.scheduled(p.id, s.instance?.def.id ?? 'praca', 1);
      const card = cardById(id);
      if (card) s.send({ t: 'parrotHint', word: { pt: card.form, en: card.gloss_en } });
      return;
    }
    this.store.save();
    this.pushProfile(s);
    this.broadcastAvatar(s);
  }

  // ---------- kitnet furniture ----------

  private furniture(s: Session, m: Extract<ClientMsg, { t: 'furniture' }>) {
    const p = s.profile!;
    const inst = s.instance;
    if (!inst || inst.ownerId !== p.id) return this.err(s, 'furniture', 'Só dá pra decorar a sua kitnet.', 'You can only decorate your own apartment.');
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
    this.store.save();
    this.pushProfile(s);
    this.broadcast(inst, { t: 'furnitureState', furniture: p.apartment });
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
      if (this.incomingFriendReqs.get(p.id)?.has(target.id)) return this.friend(s, 'accept', target.id);
      let set = this.incomingFriendReqs.get(target.id);
      if (!set) this.incomingFriendReqs.set(target.id, (set = new Set()));
      set.add(p.id);
      const ts = this.sessionByProfile(target.id);
      ts?.send({ t: 'friendRequest', fromId: p.id, fromName: p.name });
      if (ts) this.sendFriends(ts);
      return s.send({ t: 'notice', level: 'info', pt: `Pedido de amizade enviado para ${target.name}.`, en: `Friend request sent to ${target.name}.` });
    }
    if (action === 'accept') {
      const set = this.incomingFriendReqs.get(p.id);
      if (!set?.has(target.id)) return;
      set.delete(target.id);
      if (!p.friends.includes(target.id)) p.friends.push(target.id);
      if (!target.friends.includes(p.id)) target.friends.push(p.id);
      this.store.save();
      const ts = this.sessionByProfile(target.id);
      ts?.send({ t: 'notice', level: 'reward', pt: `${p.name} aceitou sua amizade!`, en: `${p.name} accepted your friend request!` });
      if (ts) {
        this.pushProfile(ts);
        this.sendFriends(ts);
      }
    } else if (action === 'decline') {
      this.incomingFriendReqs.get(p.id)?.delete(target.id);
    } else {
      p.friends = p.friends.filter((f) => f !== target.id);
      target.friends = target.friends.filter((f) => f !== p.id);
      this.store.save();
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
        };
      });
    const incoming = [...(this.incomingFriendReqs.get(p.id) ?? [])]
      .map((id) => this.store.get(id))
      .filter((f): f is StoredProfile => !!f)
      .map((f) => ({ id: f.id, name: f.name }));
    s.send({ t: 'friends', friends, incoming });
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
