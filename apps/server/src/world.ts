import {
  ageFrom,
  BODY_TYPES,
  BOTTOM_STYLES,
  buildGrid,
  canPlaceFurniture,
  CHAT_RATE,
  CLOTH_COLORS,
  checkTray,
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
  isRoomId,
  key,
  makeOrder,
  MAX_CHAT_LEN,
  MG_ROUNDS,
  mgPayout,
  MIN_AGE,
  mulberry32,
  pathDuration,
  pointsFor,
  positionAlong,
  ROOMS,
  sanitizeTray,
  SCORE_FEEDBACK,
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
  type TutorialStep,
} from '@tudobem/shared';
import type { ChatSafetyService, GlossService, ModerationQueue, NpcDialogueService, StudentModelService } from './services/interfaces.js';
import { ProfileStore, today, toPrivate, type StoredProfile } from './store.js';
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
  /** Praça ambiance CPUs (LIVEOPS_CPU_AMBIANCE). Off unless the host turns it on. */
  ambiance?: boolean;
  rng?: () => number;
}

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
  repeated: boolean;
  points: number;
  streak: number;
  perfect: number;
  waiting: boolean;
  token: number;
  /** Authored tickets already served this shift (no repeats). */
  served: string[];
}

export interface Session {
  id: string;
  send: (m: ServerMsg) => void;
  close: () => void;
  profile?: StoredProfile;
  instance?: Instance;
  avatar?: AvatarState;
  scene?: SceneState;
  mg?: MgState;
  chatTimes: number[];
  lastHintAt: number;
}

const INSTANCE_SUFFIX = ['Norte', 'Sul', 'Leste', 'Oeste'];

export class Instance {
  readonly members = new Map<string, Session>();
  /** Praça ambiance CPUs. Not members, so they never take a player seat. */
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

const MG_LINES: Record<MgOutcome | 'repita' | 'combo', Bilingual> = {
  perfeito: { pt: 'Isso mesmo! Cliente feliz!', en: 'That’s it! Happy customer!' },
  combo: { pt: 'Que rapidez! Tá pegando o jeito!', en: 'So fast! You’re getting the hang of it!' },
  segunda: { pt: 'Agora sim! Muito bem.', en: 'Now you got it! Well done.' },
  repita: { pt: 'Opa, não é bem isso. Vou repetir devagar…', en: 'Oops, not quite. I’ll repeat it slowly…' },
  errou: { pt: 'Tudo bem, acontece! Próximo cliente.', en: 'It’s fine, it happens! Next customer.' },
  tempo: { pt: 'Ih, o cliente cansou de esperar! Próximo.', en: 'Oh no, the customer got tired of waiting! Next.' },
};

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
  private seq = 0;

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
  }

  // ---------- connection lifecycle ----------

  connect(id: string, send: (m: ServerMsg) => void, close: () => void): Session {
    const s: Session = { id, send, close, chatTimes: [], lastHintAt: 0 };
    this.sessions.set(id, s);
    return s;
  }

  disconnect(s: Session) {
    this.leaveInstance(s);
    this.sessions.delete(s.id);
    if (s.profile) {
      s.profile.lastSeen = this.now();
      this.store.save();
      this.notifyFriendsOfPresence(s.profile.id);
    }
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
    if (msg.t === 'ping') return s.send({ t: 'pong' });
    if (msg.t === 'hello') return this.hello(s, msg.token);
    if (msg.t === 'createProfile') return this.createProfile(s, msg);
    if (!s.profile) return this.err(s, 'no_profile', 'Crie seu avatar primeiro.', 'Create your avatar first.');
    switch (msg.t) {
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
    }
  }

  // ---------- profile ----------

  private hello(s: Session, token?: string) {
    const p = this.store.byTokenGet(token);
    // Profiles from before the 18+ policy never confirmed adulthood; they must sign up again.
    if (!p || p.ageGate18 !== true) return s.send({ t: 'needProfile' });
    this.attachProfile(s, p);
  }

  private attachProfile(s: Session, p: StoredProfile) {
    for (const other of this.sessions.values()) {
      if (other !== s && other.profile?.id === p.id) {
        other.send({ t: 'notice', level: 'warn', pt: 'Você entrou em outra aba.', en: 'You signed in from another tab.' });
        this.leaveInstance(other);
        other.profile = undefined;
        other.close();
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
    const year = Math.floor(Number(m.birthYear));
    const month = Math.floor(Number(m.birthMonth));
    if (!(year > 1900 && year <= new Date().getFullYear() && month >= 1 && month <= 12))
      return this.err(s, 'age', 'Data inválida.', 'Please enter a valid birth month and year.');
    if (ageFrom(year, month) < MIN_AGE)
      return this.err(s, 'age_gate', `Tudo Bem é só para maiores de ${MIN_AGE} anos.`, `Tudo Bem is for adults (${MIN_AGE}+) only.`);
    if (m.confirm18 !== true)
      return this.err(s, 'age_confirm', `Confirme que você tem ${MIN_AGE} anos ou mais.`, `Please confirm you are ${MIN_AGE} or older.`);
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
      daily: { date: today(), sceneClears: {} },
      lastSeen: this.now(),
    };
    this.store.add(p);
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
        if (this.ambiance && def.id === 'praca') inst.crowd = this.makeCrowd(inst);
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
    this.broadcast(target, { t: 'avatarJoined', avatar: this.publicAvatar(s) }, s);
    target.crowd?.sync();
    this.notifyFriendsOfPresence(s.profile!.id);
  }

  private leaveInstance(s: Session) {
    const inst = s.instance;
    if (s.mg) s.mg = undefined;
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
    if (verdict.action === 'warn') this.flag(s, 'npc_reply', verdict, text);
    const current = viewNode(sc.node, sc.ctx);
    const jev = jevNpcReply(current?.line.pt ?? '', text);
    const scored = this.services.npc.scoreTyped(sc.npc, sc.node, text, sc.ctx);
    if (scored.chip === null) {
      this.services.student.record({ playerId: p.id, itemIds: [], channel: 'type', score: 0, latencyMs: this.now() - sc.shownAt, place: 'padaria', nameplate: p.nameplate, at: this.now(), jev });
      if (current) s.send({ t: 'scene', view: current, lastScore: 0, feedback: SCORE_FEEDBACK[0], said: { pt: text, en: '' } });
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
    if (res.view.end) {
      this.rollDaily(p);
      const clears = p.daily.sceneClears[sc.npc] ?? 0;
      payout = scenePayout(sc.scores, clears);
      p.daily.sceneClears[sc.npc] = clears + 1;
      s.scene = undefined;
      this.completeStep(s, 'carlos');
      this.missionStep(s, 'pede');
      if (payout > 0) this.reward(s, payout, { pt: 'Café da manhã com o Seu Carlos', en: 'Breakfast with Seu Carlos' });
      else s.send({ t: 'notice', level: 'info', pt: 'Seu Carlos: “Você já me ajudou muito hoje!”', en: 'Seu Carlos: “You’ve already helped me a lot today!” (daily cap reached)' });
    }
    const said = typed ? { pt: typed, en: res.said.pt } : res.said;
    s.send({ t: 'scene', view: res.view, lastScore: res.score, feedback: SCORE_FEEDBACK[res.score], said, payout });
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
      s.mg = { rng, round: 0, order, orderAt: this.now(), repeated: false, points: 0, streak: 0, perfect: 0, waiting: false, token: ++this.seq, served: [order.pt] };
      return this.sendOrder(s);
    }
    const mg = s.mg;
    if (!mg) return;
    if (m.action === 'quit') {
      s.mg = undefined;
      return s.send({ t: 'notice', level: 'info', pt: 'Até a próxima, ajudante!', en: 'See you next time, helper!' });
    }
    if (mg.waiting) return;
    const elapsed = this.now() - mg.orderAt;
    let ok = false;
    let timedOut = false;
    if (m.action === 'timeout') {
      if (elapsed < mg.order.timeMs - 750) return;
      timedOut = true;
    } else {
      timedOut = elapsed > mg.order.timeMs + 1500;
      ok = !timedOut && checkTray(mg.order, sanitizeTray(m.tray), sanitizeMods(m.mods)).ok;
    }
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
    if (!ok && !mg.repeated) {
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
      if (s.mg?.token !== token) return;
      mg.waiting = false;
      mg.order = makeOrder(mg.rng, mg.round, mg.served);
      mg.served.push(mg.order.pt);
      mg.repeated = false;
      mg.orderAt = this.now();
      this.sendOrder(s);
    };
    if (this.mgGapMs <= 0) next();
    else this.schedule(next, this.mgGapMs);
  }

  private sendOrder(s: Session) {
    const mg = s.mg!;
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
    });
  }

  /** Test hook: peek the current order (the client never receives item ids). */
  debugOrder(s: Session) {
    return s.mg?.order;
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
