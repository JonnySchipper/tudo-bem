import {
  ambianceNavGrid,
  CPU_ID_PREFIX,
  CPU_NAMES,
  CPU_SITTER_SHARE,
  cpuArchetype,
  cpuLook,
  cpuTarget,
  feiraOpen,
  findPath,
  isWalkable,
  key,
  pathDuration,
  positionAlong,
  ROOM_AMBIANCE,
  seatTiles,
  type Appearance,
  type Dir,
  type PublicAvatar,
  type RoomDef,
  type RoomGrid,
  type ServerMsg,
  type Tile,
} from '@tudobem/shared';

export const CPU_TICK_MS = 1000;
const SENIOR_ARCHETYPES = new Set(['aposentado', 'tia_do_bairro']);
/** Gap between CPUs walking in when the crowd needs to grow. */
const SPAWN_GAP_MS = 4000;
const APPROACH_WAVE_COOLDOWN_MS = 20_000;
const WAVE_BACK_COOLDOWN_MS = 8_000;

export interface HumanSpot {
  tile: Tile;
  /** Where the player's current walk ends (their tile when idle). */
  target: Tile;
}

export interface CrowdHost {
  now(): number;
  schedule(fn: () => void, ms: number): void;
  rng(): number;
  /** Broadcast to every player in the instance. */
  send(m: ServerMsg): void;
  humans(): HumanSpot[];
  /** Tiles the CPUs must stay off (the NPCs' spots). */
  reserved?(): Tile[];
  /** The game minute (0..1439): during the feira (06:00-13:00) walkers browse the stalls. */
  minute?(): number;
}

interface Cpu {
  id: string;
  name: string;
  appearance: Appearance;
  hat: string | null;
  role: 'sitter' | 'walker';
  from: Tile;
  path: Tile[];
  start: number;
  dir: Dir;
  sit: boolean;
  /** Tile key this CPU is standing on or walking to. */
  dest: string;
  leg: number;
  nextAt: number;
  leaving: boolean;
  lastWave: number;
  humanNear: boolean;
}

let nextCpu = 0;
const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Scripted Praça / Academia ambiance for one instance. CPUs live here, not in `Instance.members`,
 * so they are outside the player cap. They only ever emit avatarJoined / avatarMoved / avatarLeft / emote(oi).
 */
export class CpuCrowd {
  private cpus = new Map<string, Cpu>();
  private bag: string[] = [];
  private ticking = false;
  private stopped = false;
  private nextSpawnAt = 0;
  private readonly grid: RoomGrid;
  private readonly seats: { tile: Tile; dir: Dir; senior: boolean }[];

  private readonly map: { spots: Tile[]; doorSpots: Tile[]; entries: Tile[]; feiraSpots?: Tile[] };

  constructor(
    private readonly room: RoomDef,
    private readonly host: CrowdHost,
  ) {
    const map = ROOM_AMBIANCE[room.id];
    if (!map) throw new Error(`No ambiance map for room ${room.id}`);
    this.map = map;
    this.grid = ambianceNavGrid(room);
    // V2: the stools of the domino and chess tables (`banquinho_*`) are the seniors' seats: only a senior CPU takes one (see `spawn`)
    this.seats = seatTiles(room).map((s) => ({ tile: { x: s.x, y: s.y }, dir: s.dir, senior: s.prop.id.startsWith('banquinho') }));
  }

  /** CPUs currently in the room (including any walking out). */
  get size() {
    return this.cpus.size;
  }

  avatars(): PublicAvatar[] {
    return [...this.cpus.values()].map((c) => this.publicOf(c));
  }

  /** Players joined or left the instance. */
  sync() {
    if (this.stopped) return;
    const humans = this.host.humans();
    if (!humans.length) return;
    const active = this.active();
    const target = cpuTarget(humans.length, this.room.id);
    if (!active.length) for (let i = 0; i < target; i++) this.spawn(true);
    else if (active.length > target) {
      const byWalkersFirst = active.sort((a, b) => (a.role === 'walker' ? 0 : 1) - (b.role === 'walker' ? 0 : 1));
      for (const c of byWalkersFirst.slice(0, active.length - target)) this.leave(c);
    }
    if (!this.ticking) {
      this.ticking = true;
      this.host.schedule(() => this.tick(), CPU_TICK_MS);
    }
  }

  /** A player is heading to sit on `t`: any CPU there gets up and moves on. */
  yieldSeat(t: Tile) {
    const k = key(t.x, t.y);
    for (const c of this.cpus.values()) {
      if (c.dest !== k || c.leaving) continue;
      const seat = c.role === 'sitter' ? this.freeSeat(k) : null;
      if (!(seat && this.walk(c, seat.tile, true))) this.walk(c, this.freeSpot(this.map.spots), false);
      c.nextAt = this.host.now() + this.travel(c) + this.dwell(c);
    }
  }

  /** A player waved (Oi): the nearest CPU within 3 tiles waves back. */
  onWave(from: Tile) {
    const now = this.host.now();
    const near = [...this.cpus.values()]
      .filter((c) => !c.leaving && now - c.lastWave > WAVE_BACK_COOLDOWN_MS)
      .map((c) => ({ c, pos: this.pos(c) }))
      .filter(({ pos }) => cheb(pos.tile, from) <= 3)
      .sort((a, b) => cheb(a.pos.tile, from) - cheb(b.pos.tile, from))[0];
    if (!near) return;
    near.c.lastWave = now;
    this.host.schedule(() => this.cpus.has(near.c.id) && !this.stopped && this.wave(near.c), 700);
  }

  stop() {
    this.stopped = true;
    this.ticking = false;
  }

  // ---------------------------------------------------------------- loop

  private tick() {
    if (this.stopped) return;
    const humans = this.host.humans();
    if (!humans.length) {
      this.ticking = false;
      return;
    }
    const now = this.host.now();
    if (this.active().length < cpuTarget(humans.length, this.room.id) && now >= this.nextSpawnAt) {
      this.spawn(false);
      this.nextSpawnAt = now + SPAWN_GAP_MS;
    }
    for (const c of [...this.cpus.values()]) {
      const p = this.pos(c);
      if (c.leaving) {
        if (!p.moving) this.remove(c);
        continue;
      }
      if (p.moving) continue;
      const near = humans.some((h) => cheb(h.tile, p.tile) <= 1);
      if (near && !c.humanNear && now - c.lastWave > APPROACH_WAVE_COOLDOWN_MS && this.host.rng() < 0.6) this.wave(c);
      c.humanNear = near;
      if (now >= c.nextAt) this.act(c);
    }
    this.host.schedule(() => this.tick(), CPU_TICK_MS);
  }

  private act(c: Cpu) {
    const rng = this.host.rng;
    const sittingNow = c.sit && this.seats.some((s) => key(s.tile.x, s.tile.y) === c.dest);
    if (c.role === 'sitter') {
      // a senior at a game table stays put; everyone else drifts to another bench now and then
      const atTable = sittingNow && !!this.seats.find((s) => key(s.tile.x, s.tile.y) === c.dest)?.senior;
      if (!sittingNow || (!atTable && rng() < 0.25)) {
        const seat = this.freeSeat(c.dest);
        if (seat) this.walk(c, seat.tile, true);
      }
    } else {
      c.leg = (c.leg + 1) % 3;
      const seat = c.leg === 2 ? this.freeSeat(c.dest) : null;
      // while the feira is open the walkers shop: most legs end in front of a stall
      if (seat) this.walk(c, seat.tile, true);
      else if (this.shopping() && c.leg !== 1) this.walk(c, this.freeSpot(this.map.feiraSpots!), false);
      else this.walk(c, this.freeSpot(c.leg === 1 ? this.map.doorSpots : this.map.spots), false);
    }
    c.nextAt = this.host.now() + this.travel(c) + this.dwell(c);
  }

  // ---------------------------------------------------------------- crowd changes

  private spawn(instant: boolean) {
    const rng = this.host.rng;
    const active = this.active();
    const sitters = active.filter((c) => c.role === 'sitter').length;
    // fewer sitters while the feira is open: the crowd goes shopping
    const role: Cpu['role'] = sitters < Math.round((active.length + 1) * (this.shopping() ? CPU_SITTER_SHARE * 0.6 : CPU_SITTER_SHARE)) ? 'sitter' : 'walker';
    // the first sitters take the game tables when a stool is free: a senior neighbour sits there (checked before anyone else gets a seat)
    // (at most one senior per senior look, so the square never shows two of the same look)
    const seniors = role === 'sitter' && rng() < 0.85 ? this.seniorNames() : [];
    const seniorSeat = seniors.length ? this.freeSeat(null, true) : null;
    const seat = role === 'sitter' ? seniorSeat ?? this.freeSeat(null) : null;
    const dest = seat?.tile ?? this.freeSpot(this.shopping() ? this.map.feiraSpots! : this.map.spots);
    const pick = <T>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
    const entry = pick(this.map.entries);
    const name = seniorSeat ? seniors[Math.floor(rng() * seniors.length)] : this.nextName();
    const look = cpuLook(name);
    const c: Cpu = {
      id: `${CPU_ID_PREFIX}${++nextCpu}`,
      name,
      appearance: look.appearance,
      hat: look.hat,
      role: seat ? 'sitter' : 'walker',
      from: instant ? dest : entry,
      path: [],
      start: this.host.now(),
      dir: seat?.dir ?? 'SE',
      sit: instant && !!seat,
      dest: key(dest.x, dest.y),
      leg: 0,
      nextAt: 0,
      leaving: false,
      lastWave: -Infinity,
      humanNear: false,
    };
    this.cpus.set(c.id, c);
    this.host.send({ t: 'avatarJoined', avatar: this.publicOf(c) });
    if (!instant) this.walk(c, dest, !!seat);
    c.nextAt = this.host.now() + this.travel(c) + this.dwell(c) * (instant ? rng() : 1);
  }

  private leave(c: Cpu) {
    c.leaving = true;
    const here = this.pos(c).tile;
    const exit = [...this.map.entries].sort((a, b) => cheb(a, here) - cheb(b, here))[0];
    if (!this.walk(c, exit, false)) this.remove(c);
  }

  private remove(c: Cpu) {
    this.cpus.delete(c.id);
    this.host.send({ t: 'avatarLeft', id: c.id });
  }

  private wave(c: Cpu) {
    c.lastWave = this.host.now();
    this.host.send({ t: 'emote', id: c.id, kind: 'oi' });
  }

  // ---------------------------------------------------------------- helpers

  /** The feira is open and this room has stalls to browse. */
  private shopping(): boolean {
    const m = this.host.minute?.();
    return !!this.map.feiraSpots?.length && m !== undefined && feiraOpen(m);
  }

  private active() {
    return [...this.cpus.values()].filter((c) => !c.leaving);
  }

  /** Next name from a shuffled bag, skipping ahead to one whose look isn't already on the square. */
  private nextName() {
    const inUse = new Set([...this.cpus.values()].map((c) => c.name));
    if (!this.bag.length) {
      this.bag = CPU_NAMES.filter((n) => !inUse.has(n));
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.host.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const worn = new Set([...this.cpus.values()].map((c) => cpuArchetype(c.name)));
    for (let i = this.bag.length - 1; i >= 0; i--) {
      if (!inUse.has(this.bag[i]) && !worn.has(cpuArchetype(this.bag[i]))) return this.bag.splice(i, 1)[0];
    }
    return this.bag.pop()!;
  }

  /** Names whose look is an older neighbour (the retiree, the tia do bairro) and is not on the square yet. */
  private seniorNames() {
    const inUse = new Set([...this.cpus.values()].map((c) => c.name));
    const worn = new Set([...this.cpus.values()].map((c) => cpuArchetype(c.name)));
    return CPU_NAMES.filter((n) => !inUse.has(n) && SENIOR_ARCHETYPES.has(cpuArchetype(n)) && !worn.has(cpuArchetype(n)));
  }

  private taken(except: string | null) {
    const out = new Set<string>();
    for (const c of this.cpus.values()) if (c.dest !== except) out.add(c.dest);
    for (const h of this.host.humans()) {
      out.add(key(h.tile.x, h.tile.y));
      out.add(key(h.target.x, h.target.y));
    }
    for (const t of this.host.reserved?.() ?? []) out.add(key(t.x, t.y));
    return out;
  }

  /** A free seat; `senior` asks for a game-table stool, otherwise those stools are left to the seniors. */
  private freeSeat(except: string | null, senior = false) {
    const taken = this.taken(except);
    const free = this.seats.filter((s) => {
      const k = key(s.tile.x, s.tile.y);
      return s.senior === senior && k !== except && !taken.has(k);
    });
    return free.length ? free[Math.floor(this.host.rng() * free.length)] : null;
  }

  private freeSpot(from: Tile[]) {
    const taken = this.taken(null);
    const open = from.filter((t) => isWalkable(this.grid, t.x, t.y));
    const poolFrom = open.length ? open : from;
    const free = poolFrom.filter((t) => !taken.has(key(t.x, t.y)));
    const pool = free.length ? free : poolFrom;
    return pool[Math.floor(this.host.rng() * pool.length)];
  }

  private pos(c: Cpu) {
    return positionAlong(c.from, c.path, this.host.now() - c.start, c.dir);
  }

  private travel(c: Cpu) {
    return Math.max(0, pathDuration(c.from, c.path) - (this.host.now() - c.start));
  }

  private dwell(c: Cpu) {
    const r = this.host.rng();
    return c.role === 'sitter' ? 30_000 + r * 40_000 : c.sit ? 12_000 + r * 13_000 : 5_000 + r * 7_000;
  }

  private walk(c: Cpu, to: Tile, sit: boolean): boolean {
    const p = this.pos(c);
    const from = p.moving ? { x: Math.round(p.x), y: Math.round(p.y) } : p.tile;
    const path = findPath(this.grid, from, to);
    if (!path) return false;
    c.from = from;
    c.path = path;
    c.start = this.host.now();
    c.dir = p.dir;
    c.sit = sit;
    c.dest = key(to.x, to.y);
    this.host.send({ t: 'avatarMoved', id: c.id, from, path, sit });
    return true;
  }

  private publicOf(c: Cpu): PublicAvatar {
    const p = this.pos(c);
    const sitting = !p.moving && c.sit;
    const seatDir = sitting ? this.seats.find((s) => s.tile.x === p.tile.x && s.tile.y === p.tile.y)?.dir : undefined;
    return {
      id: c.id,
      name: c.name,
      pronoun: 'nome',
      appearance: c.appearance,
      hat: c.hat,
      parrot: false,
      nameplate: 'verde',
      x: p.tile.x,
      y: p.tile.y,
      dir: seatDir ?? p.dir,
      sitting,
      cpu: true,
    };
  }
}
