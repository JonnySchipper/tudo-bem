import {
  BODY_TYPES,
  BOTTOM_STYLES,
  buildGrid,
  canPlaceFurniture,
  CHAT_RATE,
  CLOTH_COLORS,
  checkBuild,
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
  IDLE_KICK_MS,
  IDLE_WARN_MS,
  idleKickedCopy,
  idleWarningCopy,
  isRoomId,
  key,
  makeOrder,
  MAX_CHAT_LEN,
  MG_ROUNDS,
  mgPayout,
  mulberry32,
  pathDuration,
  pointsFor,
  positionAlong,
  ROOM_AMBIANCE,
  ROOMS,
  sanitizeTray,
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
  mgItemById,
  cardById,
  sanitizeMods,
  viewNode,
  jevNpcReply,
  freshMission,
  MISSION_COPY,
  MISSION_REWARD,
  MISSION_STEPS,
  type DailyMission,
  type MissionStep,
  type Appearance,
  type Bilingual,
  type ClientMsg,
  type JevNpcReplyAnswers,
  type SafetyVerdict,
  type Dir,
  type EmoteKind,
  type FriendInfo,
  type MgOrder,
  type MgOutcome,
  type PlacedFurniture,
  type PublicAvatar,
  type RoomDef,
  type RoomId,
  type Rng,
  type SceneCtx,
  type ServerMsg,
  type Tile,
  type Tray,
  type TutorialStep,
  ROLL_MAX_DUELS,
  ROLL_QUEUE_MS_DEFAULT,
  ROLL_RV_LOSS,
  ROLL_RV_WIN,
  checkRollAnswer,
  cpuGetsIt,
  decisaoWinner,
  displayPosition,
  makeRollPuzzle,
  normalizeBjj,
  rollBow,
  rollDecisaoLine,
  rollFistBump,
  rollPuzzleTimeMs,
  rollTapLine,
  resolveDuel,
  stripesForWins,
  toPuzzleView,
  type RollAnswer,
  type RollPuzzle,
} from '@tudobem/shared';
import type { ChatSafetyService, GlossService, ModerationQueue, NpcDialogueService, StudentModelService } from './services/interfaces.js';
import { ProfileStore, today, todaySaoPaulo, toPrivate, type StoredProfile } from './store.js';
import { CpuCrowd } from './ambiance.js';

export interface Services {
  safety: ChatSafetyService;
  gloss: GlossService;
  npc: NpcDialogueService;
  student: StudentModelService;
  moderation: ModerationQueue;
}

export interface WorldOptions {
  roomCap?: number;
  /** Delay between minigame orders (ms). Tests set 0. */
  mgGapMs?: number;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
  /** Praça / Academia ambiance CPUs (LIVEOPS_CPU_AMBIANCE). Off unless the host turns it on. */
  ambiance?: boolean;
  rng?: () => number;
  /** Open-mat CPU match wait (ms). Env `ROLL_QUEUE_MS` overrides default 12s. */
  rollQueueMs?: number;
  /** When true, duel messages include `debugCorrect` for CI e2e (TB_TEST_ROLL=1). */
  testRollHints?: boolean;
  /** Email/password accounts (the Node server). When set, only sockets with a signed-in session can play. Solo mode leaves it unset. */
  accounts?: AccountLink;
  /** No real input for this long → kicked and the seat is freed. Default 15 min. */
  idleKickMs?: number;
}

/** What the World needs from the account store (kept tiny so world.ts stays browser-safe for solo mode). */
export interface AccountLink {
  profileIdFor(accountId: string): string | undefined;
  linkProfile(accountId: string, profileId: string): void;
}

export type CloseReason = 'replaced' | 'idle' | 'logout';

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

interface MgState {
  rng: Rng;
  round: number;
  order: MgOrder;
  orderAt: number;
  /** When this round's first attempt started. A retry resets `orderAt` but not this. */
  roundStartedAt?: number;
  /** Bumped each time the attempt clock starts, so a stale deadline cannot close the next ticket. */
  attempt?: number;
  repeated: boolean;
  points: number;
  streak: number;
  perfect: number;
  waiting: boolean;
  token: number;
  /** Authored tickets already served this shift (no repeats). Missing history must not throw. */
  served?: string[];
  /** Tray signature last judged, so an accidental echo of that tray can be ignored. */
  lastSig?: string;
}

interface RollState {
  rng: Rng;
  token: number;
  phase: 'queue' | 'match';
  queueAt: number;
  playerIdx: number;
  cpuIdx: number;
  round: number;
  used: string[];
  puzzle?: RollPuzzle;
  puzzleAt: number;
  timeMs: number;
  playerAnswered: boolean;
  cpuAnswered: boolean;
  playerCorrect: boolean;
  cpuCorrect: boolean;
  resolving: boolean;
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
  mg?: MgState;
  roll?: RollState;
  chatTimes: number[];
  lastHintAt: number;
}

const INSTANCE_SUFFIX = ['Norte', 'Sul', 'Leste', 'Oeste'];

export class Instance {
  readonly members = new Map<string, Session>();
  /** Ambiance CPUs (Praça, Academia). Not members, so they never take a player seat. */
  crowd?: CpuCrowd;
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

/** After Carlos repeats, an identical or empty tray in this window is an echo (double-click / Enter repeat), not the retry. */
const MG_REPEAT_GRACE_MS = 700;
/** If the client never reports the empty bar, close the attempt this long after `timeMs`. */
const MG_DEADLINE_SLACK_MS = 2_000;
/** First attempt plus one full retry. After this, another miss cannot restart the clock. */
const MG_ROUND_BUDGET_SLACK_MS = 3_000;
/** How long a dropped connection can reclaim the open Me vê um ticket. */
export const MG_RESUME_MS = 20_000;

function traySig(tray: Tray, mods: string[]): string {
  const items = Object.entries(tray)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, n]) => `${id}:${n}`)
    .join(',');
  return `${items}|${[...mods].sort().join(',')}`;
}

const MG_LINES: Record<MgOutcome | 'repita' | 'combo', Bilingual> = {
  perfeito: { pt: 'Isso mesmo! Cliente feliz!', en: 'That’s it! Happy customer!' },
  combo: { pt: 'Que rapidez! Tá pegando o jeito!', en: 'So fast! You’re getting the hang of it!' },
  segunda: { pt: 'Agora sim! Muito bem.', en: 'Now you got it! Well done.' },
  repita: { pt: 'Opa, não é bem isso. Vou repetir devagar…', en: 'Oops, not quite. I’ll repeat it slowly…' },
  errou: { pt: 'Tudo bem, acontece! Próximo cliente.', en: 'It’s fine, it happens! Next customer.' },
  tempo: { pt: 'Ih, o cliente cansou de esperar! Próximo.', en: 'Oh no, the customer got tired of waiting! Next.' },
};
const MG_LOST: Bilingual = { pt: 'Ih, perdi a comanda! Bora começar um turno novo?', en: 'Oops, I lost the order slip! Shall we start a fresh shift?' };
const MG_BYE: Bilingual = { pt: 'Até a próxima, ajudante!', en: 'See you next time, helper!' };

export class World {
  readonly sessions = new Map<string, Session>();
  private instances = new Map<string, Instance>();
  private incomingFriendReqs = new Map<string, Set<string>>();
  private readonly cap: number;
  private readonly mgGapMs: number;
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => void;
  private readonly ambiance: boolean;
  private readonly rng: () => number;
  private readonly rollQueueMs: number;
  private readonly testRollHints: boolean;
  private readonly accounts?: AccountLink;
  readonly idleKickMs: number;
  private seq = 0;
  /** Mid-order Me vê um state kept across a socket drop so reconnect can resync the same ticket. */
  private parkedMg = new Map<string, { mg: MgState; room: RoomId; at: number }>();

  constructor(
    readonly store: ProfileStore,
    readonly services: Services,
    opts: WorldOptions = {},
  ) {
    this.cap = Math.max(1, Math.min(DEFAULT_ROOM_CAP, opts.roomCap ?? DEFAULT_ROOM_CAP));
    this.mgGapMs = opts.mgGapMs ?? 1600;
    this.now = opts.now ?? Date.now;
    this.schedule = opts.schedule ?? ((fn, ms) => void (setTimeout(fn, ms) as unknown as { unref?: () => void }).unref?.());
    this.ambiance = !!opts.ambiance;
    this.rng = opts.rng ?? Math.random;
    const envQueue = Number(process.env.ROLL_QUEUE_MS);
    this.rollQueueMs = opts.rollQueueMs ?? (Number.isFinite(envQueue) && envQueue >= 0 ? envQueue : ROLL_QUEUE_MS_DEFAULT);
    this.testRollHints = opts.testRollHints ?? process.env.TB_TEST_ROLL === '1';
    this.accounts = opts.accounts;
    this.idleKickMs = Math.max(1000, opts.idleKickMs ?? IDLE_KICK_MS);
  }

  // ---------- connection lifecycle ----------

  connect(id: string, send: (m: ServerMsg) => void, close: (reason: CloseReason) => void, auth: { accountId?: string } = {}): Session {
    const s: Session = { id, send, close, accountId: auth.accountId, lastActiveAt: this.now(), idleWarned: false, chatTimes: [], lastHintAt: 0 };
    this.sessions.set(id, s);
    return s;
  }

  disconnect(s: Session) {
    if (this.sessions.get(s.id) !== s) return;
    this.rememberMg(s);
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
      case 'equipHat':
        return this.equipHat(s, msg.hatId);
      case 'parrot':
        return this.parrot(s, msg.action);
      case 'furniture':
        return this.furniture(s, msg);
      case 'friend':
        return this.friend(s, msg.action, msg.targetId);
      case 'friends':
        return this.sendFriends(s);
      case 'mission':
        return this.takeMission(s);
      case 'roll':
        return this.rollGame(s, msg);
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
        this.rememberMg(other);
        this.leaveInstance(other);
        other.profile = undefined;
        other.close('replaced');
      }
    }
    s.profile = p;
    p.nameplate = this.services.student.nameplateFor(p);
    p.lastSeen = this.now();
    s.send({ t: 'welcome', profile: toPrivate(p), token: p.token });
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
      friends: [],
      tutorial,
      tutorialRewarded: false,
      createdAt: this.now(),
      bjj: { belt: 'branca', stripes: 0, wins: 0 },
      daily: { date: today(), sceneClears: {} },
      lastSeen: this.now(),
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
      avatars: [...[...target.members.values()].map((m) => this.publicAvatar(m)), ...(target.crowd?.avatars() ?? [])],
      furniture,
    });
    this.maybeResumeMg(s);
    this.broadcast(target, { t: 'avatarJoined', avatar: this.publicAvatar(s) }, s);
    target.crowd?.sync();
    this.notifyFriendsOfPresence(s.profile!.id);
  }

  private leaveInstance(s: Session) {
    const inst = s.instance;
    if (s.mg) s.mg = undefined;
    if (s.roll) s.roll = undefined;
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

  private grid(inst: Instance) {
    return buildGrid(inst.def, this.furnitureOf(inst));
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
    if (s.instance.def.id === 'praca' && this.hasCompany(s.instance)) this.missionStep(s, 'cumprimenta');
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
    if (inst.def.id === 'praca' && GREETING.test(verdict.text) && this.hasCompany(inst)) this.missionStep(s, 'cumprimenta');
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
      if (m.npc !== 'carlos' || s.instance?.def.id !== 'padaria')
        return this.err(s, 'scene', 'Seu Carlos está na padaria.', 'Seu Carlos is in the bakery.');
      if (s.mg) return this.err(s, 'busy', 'Termine o jogo primeiro.', 'Finish the game first.');
      const ctx: SceneCtx = { name: p.name, pronoun: p.pronoun };
      const view = this.services.npc.start('carlos', ctx);
      s.scene = { npc: 'carlos', node: view.nodeId, ctx, scores: [], shownAt: this.now() };
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

  /** Push the stored profile to a connected player (after Conversa RV lands on the file store). */
  pushProfileById(playerId: string) {
    const s = this.sessionByProfile(playerId);
    if (s) this.pushProfile(s);
  }

  // ---------- Me vê um… ----------

  private minigame(s: Session, m: Extract<ClientMsg, { t: 'mg' }>) {
    const p = s.profile!;
    if (m.action === 'start') {
      if (s.instance?.def.id !== 'padaria') return this.err(s, 'mg', 'O jogo fica no balcão da padaria.', 'The game is at the bakery counter.');
      s.scene = undefined;
      const rng = mulberry32((this.now() ^ (Math.random() * 1e9)) >>> 0);
      const order = makeOrder(rng, 0);
      const t0 = this.now();
      s.mg = { rng, round: 0, order, orderAt: t0, roundStartedAt: t0, repeated: false, points: 0, streak: 0, perfect: 0, waiting: false, token: ++this.seq, served: [order.pt] };
      return this.sendOrder(s);
    }
    const mg = s.mg;
    if (!mg) return this.noOpenShift(s, m.action);
    if (m.action === 'quit') return this.abandonMinigame(s);
    if (m.action === 'sync') {
      if (mg.waiting) return this.releaseMgGap(s);
      return this.sendOrder(s, true);
    }
    if (mg.waiting) return;
    const elapsed = this.now() - mg.orderAt;
    const overBudget = this.now() - (mg.roundStartedAt ?? mg.orderAt) > mg.order.timeMs * 2 + MG_ROUND_BUDGET_SLACK_MS;
    let ok = false;
    let timedOut = false;
    if (m.action === 'timeout') {
      // Client clock ahead of the server: don't drop the message (the UI locks until we answer).
      // Once the round has already had a full attempt and a full retry, stop resyncing a dead bar.
      if (!overBudget && elapsed < mg.order.timeMs - 750) return this.sendOrder(s, true);
      timedOut = true;
    } else if (m.action === 'submit') {
      const tray = sanitizeTray(m.tray);
      const mods = sanitizeMods(m.mods);
      const signature = traySig(tray, mods);
      if (mg.repeated && elapsed < MG_REPEAT_GRACE_MS && (signature === mg.lastSig || signature === '|')) {
        return this.sendOrder(s, true);
      }
      mg.lastSig = signature;
      timedOut = elapsed > mg.order.timeMs + 1500;
      const build = checkBuild(mg.order, tray, mods, m.built, { requireBuilt: true });
      ok = !timedOut && build.ok;
    } else return;
    const cards = mg.order.lines.map((l) => mgItemById(l.itemId)!.card.id);
    this.services.student.record({
      playerId: p.id,
      itemIds: [...cards, 'lex.padaria.me_ve'],
      channel: 'read',
      score: ok ? (mg.repeated ? 2 : 3) : 0,
      latencyMs: elapsed,
      place: 'padaria',
      nameplate: p.nameplate,
      at: this.now(),
    });
    if (!ok && !mg.repeated && !overBudget) {
      mg.repeated = true;
      mg.streak = 0;
      s.send({ t: 'mg', phase: 'result', round: mg.round, outcome: 'repita', carlos: MG_LINES.repita, points: mg.points, streak: 0 });
      mg.orderAt = this.now();
      return this.sendOrder(s);
    }
    if (ok) this.missionStep(s, 'monta');
    let outcome: MgOutcome;
    if (ok) {
      outcome = mg.repeated ? 'segunda' : 'perfeito';
      mg.streak = outcome === 'perfeito' ? mg.streak + 1 : 0;
      if (outcome === 'perfeito') mg.perfect++;
    } else {
      outcome = timedOut ? 'tempo' : 'errou';
      mg.streak = 0;
    }
    mg.points += pointsFor(outcome, mg.streak);
    const line = outcome === 'perfeito' && mg.streak >= 2 ? MG_LINES.combo : MG_LINES[outcome];
    s.send({ t: 'mg', phase: 'result', round: mg.round, outcome, carlos: line, expected: ok ? undefined : mg.order.lines, expectedMods: ok ? undefined : mg.order.mods, points: mg.points, streak: mg.streak });
    mg.round++;
    if (mg.round >= MG_ROUNDS) {
      const coins = mgPayout(mg.points);
      s.mg = undefined;
      s.send({
        t: 'mg',
        phase: 'end',
        points: mg.points,
        coins,
        perfect: mg.perfect,
        rounds: MG_ROUNDS,
        carlos: { pt: `Valeu pela ajuda! Aqui estão ${coins} reais virtuais.`, en: `Thanks for the help! Here are ${coins} RV coins.` },
      });
      this.reward(s, coins, { pt: '“Me vê um…” no balcão', en: '“Me vê um…” at the counter' });
      this.completeStep(s, 'meveum');
      return;
    }
    mg.waiting = true;
    const token = mg.token;
    const next = () => {
      // Same session only. A reconnect parks this object on a new session; this timer must not also advance it.
      if (s.mg?.token !== token) return;
      this.releaseMgGap(s);
    };
    if (this.mgGapMs <= 0) next();
    else this.schedule(next, this.mgGapMs);
  }

  /** Closing the panel mid-shift settles what was already served. A fresh Pedido 1/6 with 0 RV is only for a shift that never scored. */
  private abandonMinigame(s: Session) {
    const mg = s.mg;
    if (!mg) return;
    const progressed = mg.points > 0 || mg.round > 0;
    s.mg = undefined;
    if (!progressed) return s.send({ t: 'notice', level: 'info', ...MG_BYE });
    const coins = mg.points > 0 ? mgPayout(mg.points) : 0;
    s.send({
      t: 'mg',
      phase: 'end',
      points: mg.points,
      coins,
      perfect: mg.perfect,
      rounds: MG_ROUNDS,
      carlos:
        coins > 0
          ? {
              pt: `Turno encerrado. Aqui estão ${coins} reais virtuais pelo que você já serviu.`,
              en: `Shift closed. Here are ${coins} RV for what you already served.`,
            }
          : {
              pt: 'Turno encerrado. Dessa vez não deu RV — pode começar de novo quando quiser.',
              en: 'Shift closed. No RV this time — you can start again whenever you want.',
            },
    });
    if (coins > 0) this.reward(s, coins, { pt: 'Turno encerrado no balcão', en: 'Shift closed at the counter' });
  }

  /** The between-orders gap ended (timer, or a reconnect that orphaned the timer). */
  private releaseMgGap(s: Session) {
    const mg = s.mg;
    if (!mg?.waiting) return;
    mg.waiting = false;
    if (!Array.isArray(mg.served)) mg.served = mg.order.pt ? [mg.order.pt] : [];
    mg.lastSig = undefined;
    mg.order = makeOrder(mg.rng, mg.round, mg.served);
    mg.served.push(mg.order.pt);
    mg.repeated = false;
    mg.orderAt = this.now();
    mg.roundStartedAt = mg.orderAt;
    this.sendOrder(s);
  }

  /** Park before leaveInstance clears s.mg. A later disconnect of the old socket must not drop this. */
  private rememberMg(s: Session) {
    if (!s.profile || !s.mg || !s.instance) return;
    this.parkedMg.set(s.profile.id, { mg: s.mg, room: s.instance.def.id, at: this.now() });
  }

  /** The parked shift this player can still reclaim. An expired one is dropped. */
  private freshParkedMg(s: Session) {
    const id = s.profile?.id;
    if (!id) return undefined;
    const park = this.parkedMg.get(id);
    if (!park) return undefined;
    if (this.now() - park.at > MG_RESUME_MS) {
      this.parkedMg.delete(id);
      return undefined;
    }
    return park;
  }

  /**
   * The client still holds a ticket this session has no shift for. Its tray is locked waiting on
   * this reply, so never drop it: resume a parked shift, or end in the open with nothing paid.
   * State is memory-only, so a restart lands here with no park.
   */
  private noOpenShift(s: Session, action: Extract<ClientMsg, { t: 'mg' }>['action']) {
    const park = this.freshParkedMg(s);
    if (park) {
      if (action === 'quit') {
        this.parkedMg.delete(s.profile!.id);
        s.mg = park.mg;
        return this.abandonMinigame(s);
      }
      // Before the rejoin lands (e.g. the 2 s resync right after hello), the join itself resumes it.
      if (s.instance?.def.id === park.room) this.maybeResumeMg(s);
      return;
    }
    if (action === 'quit') return s.send({ t: 'notice', level: 'info', ...MG_BYE });
    s.send({ t: 'mg', phase: 'end', points: 0, coins: 0, perfect: 0, rounds: MG_ROUNDS, carlos: MG_LOST, lost: true });
  }

  private maybeResumeMg(s: Session) {
    if (!s.instance) return;
    const park = this.freshParkedMg(s);
    if (!park || park.room !== s.instance.def.id) return;
    this.parkedMg.delete(s.profile!.id);
    s.mg = park.mg;
    if (s.mg.waiting) this.releaseMgGap(s);
    else {
      this.sendOrder(s, true);
      const left = s.mg.order.timeMs - (this.now() - s.mg.orderAt);
      this.armMgDeadline(s, Math.max(0, left) + MG_DEADLINE_SLACK_MS);
    }
  }

  /** Close this attempt if the client never reports the empty bar. A new attempt id cancels the previous timer. */
  private armMgDeadline(s: Session, waitMs?: number) {
    const mg = s.mg;
    if (!mg) return;
    const token = mg.token;
    const attempt = mg.attempt ?? 0;
    const wait = waitMs ?? mg.order.timeMs + MG_DEADLINE_SLACK_MS;
    this.schedule(() => {
      const cur = s.mg;
      if (!cur || cur.token !== token || (cur.attempt ?? 0) !== attempt || cur.waiting) return;
      this.minigame(s, { t: 'mg', action: 'timeout' });
    }, wait);
  }

  private sendOrder(s: Session, resync = false) {
    const mg = s.mg;
    if (!mg) return;
    if (!resync) {
      mg.attempt = (mg.attempt ?? 0) + 1;
      this.armMgDeadline(s);
    }
    s.send({
      t: 'mg',
      phase: 'order',
      round: mg.round,
      rounds: MG_ROUNDS,
      customer: mg.order.customer,
      pt: mg.order.pt,
      en: mg.order.en,
      timeMs: mg.order.timeMs,
      repeat: mg.repeated,
      points: mg.points,
      streak: mg.streak,
      mods: mg.order.mods,
      lines: mg.order.lines,
      ...(resync ? { resync: true } : {}),
    });
  }

  /** Test hook: peek the current order (the client never receives item ids). */
  debugOrder(s: Session) {
    return s.mg?.order;
  }

  // ---------- Academia BJJ roll ----------

  private clearRoll(s: Session) {
    if (s.roll) s.roll = undefined;
  }

  private rollGame(s: Session, m: Extract<ClientMsg, { t: 'roll' }>): void {
    const p = s.profile!;
    if (m.action === 'queue') {
      if (s.instance?.def.id !== 'academia')
        return this.err(s, 'roll', 'A fila do tatame fica na academia.', 'The open-mat queue is in the academy.');
      if (s.roll) return;
      s.scene = undefined;
      s.mg = undefined;
      const rng = mulberry32((this.now() ^ (this.rng() * 1e9)) >>> 0);
      const token = ++this.seq;
      s.roll = {
        rng,
        token,
        phase: 'queue',
        queueAt: this.now(),
        playerIdx: 0,
        cpuIdx: 0,
        round: 0,
        used: [],
        puzzleAt: 0,
        timeMs: 0,
        playerAnswered: false,
        cpuAnswered: false,
        playerCorrect: false,
        cpuCorrect: false,
        resolving: false,
      };
      s.send({ t: 'roll', phase: 'queue', waitMs: this.rollQueueMs, opponent: 'cpu' });
      this.schedule(() => this.rollStartMatch(s, token), this.rollQueueMs);
      return;
    }
    const roll = s.roll;
    if (!roll) return;
    if (m.action === 'cancel' || m.action === 'quit') {
      this.clearRoll(s);
      return s.send({ t: 'notice', level: 'info', pt: 'Saiu da fila. Até a próxima rola!', en: 'Left the queue. See you on the mat!' });
    }
    if (m.action === 'rematch') {
      this.clearRoll(s);
      return this.rollGame(s, { t: 'roll', action: 'queue' });
    }
    if (roll.phase === 'queue') return;
    if (roll.resolving) return;
    const puzzle = roll.puzzle;
    if (!puzzle) return;

    if (m.action === 'timeout') {
      const elapsed = this.now() - roll.puzzleAt;
      if (elapsed < roll.timeMs - 750) return;
      if (!roll.playerAnswered) roll.playerCorrect = false;
      roll.playerAnswered = true;
      if (!roll.cpuAnswered) {
        roll.cpuCorrect = cpuGetsIt(roll.rng);
        roll.cpuAnswered = true;
      }
      return this.rollResolveDuel(s);
    }

    if (m.action === 'answer') {
      let answer: RollAnswer;
      if ('order' in m && Array.isArray(m.order)) answer = { kind: 'reorder', order: m.order.map((n) => Math.floor(Number(n))) };
      else answer = { kind: 'choice', index: Math.floor(Number((m as { choice: number }).choice)) };
      if (!roll.playerAnswered) {
        roll.playerAnswered = true;
        roll.playerCorrect = checkRollAnswer(puzzle, answer);
      }
      if (roll.cpuAnswered) return this.rollResolveDuel(s);
      return;
    }
  }

  private rollStartMatch(s: Session, token: number) {
    const roll = s.roll;
    if (!roll || roll.token !== token || roll.phase !== 'queue') return;
    roll.phase = 'match';
    s.send({ t: 'roll', phase: 'bow', line: rollBow() });
    this.schedule(() => this.rollBeginDuel(s, token), 1400);
  }

  private rollBeginDuel(s: Session, token: number) {
    const roll = s.roll;
    if (!roll || roll.token !== token) return;
    if (roll.round >= ROLL_MAX_DUELS) return this.rollFinish(s, 'decisao');
    roll.round++;
    roll.resolving = false;
    roll.playerAnswered = false;
    roll.cpuAnswered = false;
    roll.playerCorrect = false;
    roll.cpuCorrect = false;
    const used = new Set(roll.used);
    roll.puzzle = makeRollPuzzle(roll.rng, used);
    roll.used.push(roll.puzzle.id);
    roll.timeMs = rollPuzzleTimeMs(roll.rng);
    roll.puzzleAt = this.now();
    const view = toPuzzleView(roll.rng, roll.puzzle);
    const pos = displayPosition(roll.playerIdx, roll.cpuIdx);
    const debug = this.rollDebugHint(roll.puzzle);
    s.send({
      t: 'roll',
      phase: 'duel',
      round: roll.round,
      maxRounds: ROLL_MAX_DUELS,
      puzzle: view,
      timeMs: roll.timeMs,
      playerIdx: roll.playerIdx,
      cpuIdx: roll.cpuIdx,
      positionPt: pos.label.pt,
      positionEn: pos.label.en,
      submissionPt: pos.submissionHint?.pt ?? null,
      submissionEn: pos.submissionHint?.en ?? null,
      ...(debug !== undefined ? { debugCorrect: debug } : {}),
    });
    const puzzleId = roll.puzzle.id;
    const cpuDelay = Math.min(roll.timeMs - 400, 1200 + Math.floor(roll.rng() * (roll.timeMs - 1600)));
    this.schedule(() => {
      const r = s.roll;
      if (!r || r.token !== token || r.puzzle?.id !== puzzleId || r.resolving) return;
      r.cpuAnswered = true;
      r.cpuCorrect = cpuGetsIt(r.rng);
      if (r.playerAnswered) this.rollResolveDuel(s);
    }, Math.max(800, cpuDelay));
    this.schedule(() => {
      const r = s.roll;
      if (!r || r.token !== token || r.puzzle?.id !== puzzleId || r.resolving) return;
      if (!r.playerAnswered) {
        r.playerAnswered = true;
        r.playerCorrect = false;
      }
      if (!r.cpuAnswered) {
        r.cpuAnswered = true;
        r.cpuCorrect = cpuGetsIt(r.rng);
      }
      this.rollResolveDuel(s);
    }, roll.timeMs + 200);
  }

  private rollDebugHint(puzzle: RollPuzzle): number | number[] | undefined {
    if (!this.testRollHints) return undefined;
    if (puzzle.kind === 'reorder' && puzzle.correctOrder) return puzzle.correctOrder;
    return puzzle.correct;
  }

  private rollResolveDuel(s: Session) {
    const roll = s.roll;
    if (!roll || roll.resolving || !roll.playerAnswered || !roll.cpuAnswered) return;
    roll.resolving = true;
    const res = resolveDuel(roll.playerCorrect, roll.cpuCorrect, roll.playerIdx, roll.cpuIdx);
    roll.playerIdx = res.playerIdx;
    roll.cpuIdx = res.cpuIdx;
    const pos = displayPosition(roll.playerIdx, roll.cpuIdx);
    const scrambleLine: Bilingual =
      res.advance === 'player'
        ? { pt: 'Você passou a guarda!', en: 'You passed the guard!' }
        : res.advance === 'cpu'
          ? { pt: 'Eles avançaram — segura!', en: 'They advanced — hang on!' }
          : { pt: 'Empate no scramble — mesma posição.', en: 'Scramble tie — same position.' };
    s.send({
      t: 'roll',
      phase: 'scramble',
      advance: res.advance,
      line: scrambleLine,
      playerIdx: roll.playerIdx,
      cpuIdx: roll.cpuIdx,
      positionPt: pos.label.pt,
      positionEn: pos.label.en,
    });
    if (res.submission) {
      this.schedule(() => this.rollFinish(s, 'submission', res.submission!), 1200);
      return;
    }
    if (roll.round >= ROLL_MAX_DUELS) {
      this.schedule(() => this.rollFinish(s, 'decisao'), 1200);
      return;
    }
    this.schedule(() => this.rollBeginDuel(s, roll.token), 1500);
  }

  private rollFinish(s: Session, reason: 'submission' | 'decisao', submissionWinner?: 'player' | 'cpu') {
    const roll = s.roll;
    const p = s.profile!;
    if (!roll) return;
    let winner: 'player' | 'cpu' | 'draw';
    if (reason === 'submission' && submissionWinner) winner = submissionWinner;
    else {
      const d = decisaoWinner(roll.playerIdx, roll.cpuIdx);
      winner = d === 'draw' ? 'draw' : d;
    }
    const playerWon = winner === 'player';
    const rv = playerWon ? ROLL_RV_WIN : winner === 'draw' ? ROLL_RV_LOSS : ROLL_RV_LOSS;
    const bjj = normalizeBjj(p.bjj);
    if (playerWon) {
      bjj.wins++;
      bjj.stripes = Math.max(bjj.stripes, stripesForWins(bjj.wins));
    }
    p.bjj = bjj;
    this.store.save();
    const line =
      reason === 'submission' && winner !== 'draw'
        ? rollTapLine(winner as 'player' | 'cpu')
        : rollDecisaoLine(winner);
    s.send({
      t: 'roll',
      phase: 'end',
      winner,
      reason,
      rv,
      bjj,
      line,
      fistBump: rollFistBump(),
    });
    this.reward(s, rv, {
      pt: playerWon ? 'Duelo de português — vitória!' : 'Duelo de português na academia',
      en: playerWon ? 'Portuguese duel — win!' : 'Academy Portuguese duel',
    });
    this.pushProfile(s);
    this.clearRoll(s);
  }

  /** Test hook: current roll puzzle (answers stay server-side unless TB_TEST_ROLL). */
  debugRollPuzzle(s: Session) {
    return s.roll?.puzzle;
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

  private buy(s: Session, kind: 'hat' | 'furniture', itemId: string) {
    const p = s.profile!;
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

  private parrot(s: Session, action: 'adopt' | 'toggle' | 'hint') {
    const p = s.profile!;
    if (action === 'adopt') {
      if (p.parrotOwned) return;
      if (s.instance?.def.id !== 'praca') return;
      p.parrotOwned = true;
      p.parrotEquipped = true;
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
  if ((msg.t === 'mg' || msg.t === 'roll') && msg.action === 'timeout') return false;
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
