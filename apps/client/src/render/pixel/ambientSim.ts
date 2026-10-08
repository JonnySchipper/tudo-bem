/**
 * The pure half of the ambient life (Phase 6b): traffic and the bus as a function of time, the vira-lata's day, the pigeons' scatter rule,
 * cloud shadows and the small-creature gates. No Phaser, so all of it is unit tested and deterministic: two players with the same server
 * clock see the same vehicles on the same street.
 *
 * Time. Movement runs on the server-synced wall clock `t` (ms), never on the (possibly frozen or sped-up) game clock, so a `?time=` pin
 * for screenshots does not stop the cars. Gates that follow the day (no traffic 01:00-05:00, the dog's naps) use the game minute.
 */
import { CLOCK_OFFSET_MS } from '@tudobem/shared';
import { hash2 } from './terrain';
import { T } from './coords';
import type { AmbientRoom, BusRoute, Heading, Street } from './ambientData';

/** 1 game minute = 2 real seconds. */
export const MS_PER_GAME_MIN = 2000;
const MIN_PER_DAY = 1440;

const unit = (a: number, b: number, c: number): number => hash2(a, b, c) / 4294967296;
const wrapMin = (m: number) => ((m % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;

// ---------------------------------------------------------------- traffic

export interface VehicleType {
  id: string;
  /** manifest sprite key by heading */
  e: string;
  w: string;
  /** px per second */
  speed: number;
  /** body length, px (for the gap to the vehicle ahead) */
  len: number;
  weight: number;
  /** wheels roll (anim) */
  headlights: boolean;
}

export const VEHICLE_TYPES: VehicleType[] = [
  { id: 'car_red', e: 'vehicles/car_red_r', w: 'vehicles/car_red_l', speed: 46, len: 61, weight: 24, headlights: true },
  { id: 'car_blue', e: 'vehicles/car_blue_r', w: 'vehicles/car_blue_l', speed: 44, len: 61, weight: 24, headlights: true },
  { id: 'kombi', e: 'vehicles/kombi_e', w: 'vehicles/kombi_w', speed: 38, len: 68, weight: 16, headlights: true },
  { id: 'fusca', e: 'vehicles/fusca_e', w: 'vehicles/fusca_w', speed: 42, len: 60, weight: 18, headlights: true },
  { id: 'moto', e: 'vehicles/moto_e', w: 'vehicles/moto_w', speed: 66, len: 44, weight: 18, headlights: true },
];

export const BUS = { e: 'vehicles/onibus_e', w: 'vehicles/onibus_w', speed: 36, len: 112 };

/** A new traffic slot every 4 real seconds per lane. */
export const SLOT_MS = 4000;
/** Bus every 6 game hours; it reaches the stop at 05:30, 11:30, 17:30 and 23:30 game time (at normal clock speed). */
export const BUS_PERIOD_MS = 360 * MS_PER_GAME_MIN;
export const BUS_DWELL_MS = 8000;
/** Braking and pulling away take this long. */
export const BUS_EASE_MS = 1800;
const GAP = 14;
/** Longest a vehicle can be on the road, with the bus's dwell and a queue behind it. */
const WINDOW_MS = 80000;

/** Traffic thins out at the edges of the day and stops from 01:00 to 05:00. */
export function trafficChance(minute: number): number {
  const m = wrapMin(minute);
  if (m >= 60 && m < 300) return 0;
  if (m < 60 || m >= 1320) return 0.07;
  if (m < 360) return 0.1;
  if (m >= 1140) return 0.16;
  return 0.22;
}

export interface Vehicle {
  /** stable across frames while the vehicle exists */
  id: string;
  type: string;
  street: string;
  laneY: number;
  dir: Heading;
  /** anchor x, world px */
  x: number;
  key: string;
  bus: boolean;
  /** wheels turn */
  moving: boolean;
  headlights: boolean;
  len: number;
}

export interface TrafficOptions {
  /** an extra bus arrival at this wall-clock time (the `__tb.ambient.bus()` hook) */
  forcedBusAt?: number;
  /** switch the ordinary traffic off (screenshots of the bus alone) */
  noCars?: boolean;
}

/** Wall-clock times of the bus arrivals around `t`. */
export function busArrivals(t: number, forced?: number): number[] {
  // arrival = 05:30 game time: (t + CLOCK_OFFSET) mod BUS_PERIOD == 330 min
  const phase = (((330 * MS_PER_GAME_MIN - CLOCK_OFFSET_MS) % BUS_PERIOD_MS) + BUS_PERIOD_MS) % BUS_PERIOD_MS;
  const k0 = Math.floor((t - phase - WINDOW_MS) / BUS_PERIOD_MS);
  const out: number[] = [];
  for (let k = k0; k <= k0 + 2; k++) {
    const at = k * BUS_PERIOD_MS + phase;
    if (at > t - WINDOW_MS && at < t + WINDOW_MS) out.push(at);
  }
  if (forced !== undefined && forced > t - WINDOW_MS && forced < t + WINDOW_MS) out.push(forced);
  return out;
}

/** Distance still to go before the stop at time offset `dt` from the arrival (ms): positive before, 0 while standing, negative after. */
export function busRemaining(dt: number, speed = BUS_SPEED_PX_MS): number {
  const tb = BUS_EASE_MS;
  if (dt < -tb) return (speed * tb) / 2 + speed * (-dt - tb);
  if (dt < 0) return ((speed * tb) / 2) * (dt / tb) ** 2;
  if (dt <= BUS_DWELL_MS) return 0;
  const u = dt - BUS_DWELL_MS;
  if (u < tb) return -((speed * tb) / 2) * (u / tb) ** 2;
  return -((speed * tb) / 2 + speed * (u - tb));
}
const BUS_SPEED_PX_MS = BUS.speed / 1000;

/** How long before its arrival the bus is at the street's west end. */
export function busEntryMs(route: BusRoute, x0: number): number {
  const v = BUS_SPEED_PX_MS;
  return BUS_EASE_MS + (route.stopX - x0 - (v * BUS_EASE_MS) / 2) / v;
}

export function busMoving(dt: number): boolean {
  return dt < 0 || dt > BUS_DWELL_MS;
}

/** x of the bus at offset dt from its arrival at the stop. */
export const busX = (route: BusRoute, dt: number): number => route.stopX - busRemaining(dt);

function pickType(h: number): VehicleType {
  const total = VEHICLE_TYPES.reduce((s, v) => s + v.weight, 0);
  let r = h * total;
  for (const v of VEHICLE_TYPES) {
    r -= v.weight;
    if (r < 0) return v;
  }
  return VEHICLE_TYPES[0];
}

interface Raw {
  id: string;
  t0: number;
  type: string;
  len: number;
  speed: number;
  bus: boolean;
  /** progress along the heading: x for eastbound, -x for westbound */
  free: number;
  key: string;
  headlights: boolean;
  moving: boolean;
}

/**
 * Every vehicle on a street at wall-clock time `t`. `minute` is the current game minute (fractional is fine): a vehicle's spawn gate uses
 * the game minute it would have entered at (`minute` minus its age), so a vehicle never vanishes when 01:00 strikes mid-street.
 */
export function vehiclesAt(room: AmbientRoom, t: number, minute: number, opts: TrafficOptions = {}): Vehicle[] {
  const out: Vehicle[] = [];
  room.streets.forEach((street, si) => {
    street.lanes.forEach((lane, li) => {
      const raws: Raw[] = [];
      const first = Math.floor((t - WINDOW_MS) / SLOT_MS);
      const last = Math.floor(t / SLOT_MS);
      if (!opts.noCars) {
        for (let slot = first; slot <= last; slot++) {
          if (unit(slot, si * 2 + li, 1) >= trafficChance(minute - ((t - slot * SLOT_MS) / MS_PER_GAME_MIN)) * street.density) continue;
          const t0 = slot * SLOT_MS + Math.floor(unit(slot, si * 2 + li, 2) * SLOT_MS);
          if (t0 > t) continue;
          const vt = pickType(unit(slot, si * 2 + li, 3));
          const speed = vt.speed * (0.94 + 0.12 * unit(slot, si * 2 + li, 4));
          const travelled = ((t - t0) / 1000) * speed;
          const start = lane.dir === 'e' ? street.x0 : -street.x1;
          raws.push({ id: `${street.id}:${li}:${slot}`, t0, type: vt.id, len: vt.len, speed, bus: false, free: start + travelled, key: vt[lane.dir], headlights: vt.headlights, moving: true });
        }
      }
      // the bus: Rua dos Ipês, eastbound lane, stops at the shelter
      if (room.bus && street.id === room.bus.street && lane.dir === 'e') {
        for (const at of busArrivals(t, opts.forcedBusAt)) {
          const x = busX(room.bus, t - at);
          raws.push({ id: `bus:${at}`, t0: at - busEntryMs(room.bus, street.x0), type: 'onibus', len: BUS.len, speed: BUS.speed, bus: true, free: x, key: BUS.e, headlights: true, moving: busMoving(t - at) });
        }
      }
      // car following: nobody passes; a vehicle queues behind the one that entered before it
      raws.sort((a, b) => a.t0 - b.t0);
      const sgn = lane.dir === 'e' ? 1 : -1;
      for (let i = 0; i < raws.length; i++) {
        const r = raws[i];
        let prog = r.free;
        let moving = r.moving;
        if (i > 0) {
          const lead = raws[i - 1];
          const cap = lead.free - (lead.len / 2 + r.len / 2 + GAP);
          if (prog > cap) {
            prog = cap;
            moving = lead.moving;
          }
          // the leader's clamped position is what counts, so the whole queue keeps its order
          r.free = prog;
        }
        const x = sgn * prog;
        if (x < street.x0 - 10 || x > street.x1 + 10) continue;
        out.push({ id: r.id, type: r.type, street: street.id, laneY: lane.y, dir: lane.dir, x, key: r.key, bus: r.bus, moving, headlights: r.headlights, len: r.len });
      }
    });
  });
  return out;
}

// ---------------------------------------------------------------- traffic that yields

/** Gap a car keeps from a person standing or walking in its lane, px (nose to feet). */
export const PERSON_GAP = 10;
/** A person blocks a lane when their feet are within this band of the lane's feet line (lanes are 19 px apart). */
const LANE_BAND_UP = 9;
const LANE_BAND_DOWN = 5;
/** Braking: the speed allowed is the obstacle's speed plus this per px of free distance (1/s), so a car eases to a halt. */
const BRAKE_GAIN = 1.6;
/** Comfortable pull-away and braking, px/s^2. */
const ACCEL = 45;
const DECEL = 110;
/** Below this speed (px/s) a car counts as standing (wheels stop). */
const STANDING = 1.5;
/** Largest simulated step; a longer gap (a hidden tab) re-seeds the traffic from the clock instead. */
const MAX_STEP_S = 0.1;
const RESEED_MS = 1500;

interface Car extends Vehicle {
  t0: number;
  /** progress of the centre along the heading (x for eastbound, -x for westbound) */
  prog: number;
  /** current speed, px/s */
  v: number;
  /** top speed, px/s */
  vmax: number;
  /** just entered: not yet placed behind whatever is ahead */
  fresh: boolean;
}

/**
 * Traffic as a small stateful sim. The clock still decides WHEN each vehicle enters (the same slots, types and speeds as `vehiclesAt`, so
 * every viewer sees the same stream), but from then on a car drives itself: it keeps its lane, follows the car ahead, and brakes for any
 * person in front of it or any stopped car, then pulls away when the way clears. The bus keeps its timetable but is held (never reversed)
 * when a person is in front of it. A person-sized obstacle is a `Pt` of feet coordinates (`f.people`).
 */
export class TrafficSim {
  private lanes = new Map<string, Car[]>();
  private lastT = -Infinity;
  private out: Vehicle[] = [];

  /** Forget everything (room change). */
  reset(): void {
    this.lanes.clear();
    this.lastT = -Infinity;
  }

  step(room: AmbientRoom, t: number, minute: number, people: readonly Pt[], opts: TrafficOptions = {}): readonly Vehicle[] {
    if (t < this.lastT || t - this.lastT > RESEED_MS) this.lanes.clear();
    const dt = Math.min(MAX_STEP_S, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    const out = this.out;
    out.length = 0;
    room.streets.forEach((street, si) => {
      street.lanes.forEach((lane, li) => {
        const key = `${street.id}:${li}`;
        let cars = this.lanes.get(key);
        if (!cars) this.lanes.set(key, (cars = []));
        const sgn = lane.dir === 'e' ? 1 : -1;
        const start = lane.dir === 'e' ? street.x0 : -street.x1;
        // 1. entries, by the clock
        if (!opts.noCars) {
          const first = Math.floor((t - WINDOW_MS) / SLOT_MS);
          const last = Math.floor(t / SLOT_MS);
          for (let slot = first; slot <= last; slot++) {
            if (unit(slot, si * 2 + li, 1) >= trafficChance(minute - (t - slot * SLOT_MS) / MS_PER_GAME_MIN) * street.density) continue;
            const t0 = slot * SLOT_MS + Math.floor(unit(slot, si * 2 + li, 2) * SLOT_MS);
            if (t0 > t) continue;
            const id = `${street.id}:${li}:${slot}`;
            if (hasCar(cars, id)) continue;
            const vt = pickType(unit(slot, si * 2 + li, 3));
            const vmax = vt.speed * (0.94 + 0.12 * unit(slot, si * 2 + li, 4));
            const free = start + ((t - t0) / 1000) * vmax;
            if (free > (lane.dir === 'e' ? street.x1 : -street.x0) + 10) continue; // already gone (or it left while we were away)
            cars.push({ id, type: vt.id, street: street.id, laneY: lane.y, dir: lane.dir, x: sgn * free, key: vt[lane.dir], bus: false, moving: true, headlights: vt.headlights, len: vt.len, t0, prog: free, v: vmax, vmax, fresh: true });
          }
        }
        if (room.bus && street.id === room.bus.street && lane.dir === 'e') {
          for (const at of busArrivals(t, opts.forcedBusAt)) {
            const id = `bus:${at}`;
            const free = busX(room.bus, t - at);
            const known = findCar(cars, id);
            if (known) known.vmax = free; // the timetable position rides in `vmax` for the bus
            else if (free >= start && free <= street.x1 + 10) {
              cars.push({ id, type: 'onibus', street: street.id, laneY: lane.y, dir: lane.dir, x: free, key: BUS.e, bus: true, moving: busMoving(t - at), headlights: true, len: BUS.len, t0: at, prog: free, v: 0, vmax: free, fresh: false });
            }
          }
        }
        // 2. front to back, so every car sees where the one ahead really is
        cars.sort((a, b) => b.prog - a.prog);
        for (let i = 0; i < cars.length; i++) {
          const c = cars[i];
          // the nearest thing ahead: the car in front, or a person in the lane
          let limit = Infinity;
          let vObst = c.vmax;
          if (i > 0) {
            const lead = cars[i - 1];
            limit = lead.prog - (lead.len / 2 + c.len / 2 + GAP);
            vObst = lead.v;
          }
          for (let k = 0; k < people.length; k++) {
            const p = people[k];
            const dy = p.y - lane.y;
            if (dy < -LANE_BAND_UP || dy > LANE_BAND_DOWN) continue;
            const pp = sgn * p.x;
            if (pp < c.prog + c.len / 2 - 2) continue; // behind the nose or alongside the body: not in front
            const lim = pp - c.len / 2 - PERSON_GAP;
            if (lim < limit) {
              limit = lim;
              vObst = 0;
            }
          }
          if (c.bus) {
            // timetable position, held (never reversed) when something is in front
            const goal = Math.max(c.prog, Math.min(c.vmax, limit));
            c.v = dt > 0 ? (goal - c.prog) / dt : 0;
            c.prog = goal;
            c.moving = c.v > STANDING || busMoving(t - c.t0);
            if (c.v < STANDING && limit < c.vmax) c.moving = false;
          } else {
            if (c.fresh) {
              c.fresh = false;
              if (c.prog > limit) c.prog = limit; // an entry never starts inside the car ahead (or on a person)
            }
            const d = Math.max(0, limit - c.prog);
            const target = Math.min(c.vmax, vObst + d * BRAKE_GAIN);
            c.v = c.v < target ? Math.min(target, c.v + ACCEL * dt) : Math.max(target, c.v - DECEL * dt);
            const next = Math.min(c.prog + c.v * dt, Math.max(limit, c.prog));
            if (dt > 0) c.v = Math.min(c.v, (next - c.prog) / dt);
            c.prog = next;
            c.moving = c.v > STANDING;
          }
          c.x = sgn * c.prog;
        }
        // 3. leave (iterate backwards so the splice is safe)
        for (let i = cars.length - 1; i >= 0; i--) {
          const c = cars[i];
          if (c.x < street.x0 - 10 || c.x > street.x1 + 10) {
            if (c.prog > start + 20) cars.splice(i, 1);
          }
        }
        for (let i = 0; i < cars.length; i++) {
          const c = cars[i];
          if (c.x >= street.x0 - 10 && c.x <= street.x1 + 10) out.push(c);
        }
      });
    });
    return out;
  }
}

function findCar(cars: readonly Car[], id: string): Car | undefined {
  for (let i = 0; i < cars.length; i++) if (cars[i].id === id) return cars[i];
  return undefined;
}
const hasCar = (cars: readonly Car[], id: string): boolean => findCar(cars, id) !== undefined;

/** Is a person standing at these feet coordinates inside a vehicle? `slack` widens the body (px). */
export function vehicleAt(list: readonly Vehicle[], x: number, y: number, slack = 2): Vehicle | null {
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (y < v.laneY - LANE_BAND_UP + 2 - slack || y > v.laneY + 3 + slack) continue;
    if (Math.abs(x - v.x) < v.len / 2 + slack) return v;
  }
  return null;
}

// ---------------------------------------------------------------- the vira-lata

export type DogMode = 'sleep' | 'wander';

/** Sleeps 12:00-15:00 and 22:00-06:00; awake the rest of the day. */
export function dogModeAt(minute: number): DogMode {
  const m = wrapMin(minute);
  if (m >= 720 && m < 900) return 'sleep';
  if (m >= 1320 || m < 360) return 'sleep';
  return 'wander';
}

export interface TilePos {
  x: number;
  y: number;
}
const tk = (x: number, y: number) => `${x},${y}`;

/** Walkable tiles reachable from `home` on foot within `radius` tiles (euclidean from home): the dog's whole world. */
export function roamTiles(home: TilePos, radius: number, walkable: (x: number, y: number) => boolean): TilePos[] {
  const ok = (x: number, y: number) => (x === home.x && y === home.y) || (walkable(x, y) && (x - home.x) ** 2 + (y - home.y) ** 2 <= radius * radius);
  const seen = new Set<string>([tk(home.x, home.y)]);
  const q: TilePos[] = [home];
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (seen.has(tk(x, y)) || !ok(x, y)) continue;
      seen.add(tk(x, y));
      q.push({ x, y });
    }
  }
  return q;
}

/** Shortest 4-connected path from a to b inside `tiles` (both included), or [] when there is none. */
export function pathWithin(tiles: readonly TilePos[], a: TilePos, b: TilePos): TilePos[] {
  const set = new Set(tiles.map((p) => tk(p.x, p.y)));
  if (!set.has(tk(a.x, a.y)) || !set.has(tk(b.x, b.y))) return [];
  const prev = new Map<string, TilePos | null>([[tk(a.x, a.y), null]]);
  const q: TilePos[] = [a];
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (p.x === b.x && p.y === b.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = tk(n.x, n.y);
      if (prev.has(k) || !set.has(k)) continue;
      prev.set(k, p);
      q.push(n);
    }
  }
  if (!prev.has(tk(b.x, b.y))) return [];
  const path: TilePos[] = [];
  for (let p: TilePos | null | undefined = b; p; p = prev.get(tk(p.x, p.y))) path.push(p);
  return path.reverse();
}

/** A waypoint for wander number `n`: a seeded pick, at least 2 tiles from `from` when the world is big enough. */
export function pickWaypoint(tiles: readonly TilePos[], n: number, from?: TilePos): TilePos {
  const far = from ? tiles.filter((p) => Math.abs(p.x - from.x) + Math.abs(p.y - from.y) >= 2) : tiles;
  const pool = far.length ? far : tiles;
  return pool[Math.floor(unit(n, 77, 5) * pool.length) % pool.length];
}

export type DogAnim = 'sleep' | 'idle' | 'walk';

export interface DogState {
  /** feet, world px (the sprite anchor is bottom-centre) */
  x: number;
  y: number;
  facing: Heading;
  anim: DogAnim;
}

export const DOG_SPEED = 15;

/** The vira-lata: asleep at its corner in its nap hours, otherwise a slow wander inside `roamTiles`. Stateful but Phaser-free. */
export class DogSim {
  x: number;
  y: number;
  facing: Heading = 'e';
  anim: DogAnim = 'sleep';
  private path: TilePos[] = [];
  private idleLeft = 0;
  private wanders = 0;
  private readonly tiles: TilePos[];

  constructor(
    private readonly home: TilePos,
    tiles: TilePos[],
    seed = 0,
  ) {
    this.tiles = tiles;
    this.x = (home.x + 0.5) * T;
    this.y = (home.y + 1) * T;
    this.wanders = seed * 1000;
  }

  private tile(): TilePos {
    return { x: Math.floor(this.x / T), y: Math.floor((this.y - 1) / T) };
  }

  get state(): DogState {
    return { x: this.x, y: this.y, facing: this.facing, anim: this.anim };
  }

  private atHome(): boolean {
    const t = this.tile();
    return t.x === this.home.x && t.y === this.home.y && Math.abs(this.x - (this.home.x + 0.5) * T) < 1 && Math.abs(this.y - (this.home.y + 1) * T) < 1;
  }

  update(dt: number, minute: number): DogState {
    const mode = dogModeAt(minute);
    if (mode === 'sleep') {
      if (this.atHome()) {
        this.anim = 'sleep';
        this.path = [];
        return this.state;
      }
      if (!this.path.length || this.path[this.path.length - 1].x !== this.home.x || this.path[this.path.length - 1].y !== this.home.y) {
        this.path = pathWithin(this.tiles, this.tile(), this.home);
        if (!this.path.length) {
          // no way home (the tile was fenced in since): sleep where we stand
          this.anim = 'sleep';
          return this.state;
        }
        this.path.shift();
      }
      this.walk(dt);
      return this.state;
    }
    // awake
    if (this.anim === 'sleep') {
      this.anim = 'idle';
      this.idleLeft = 1.5 + unit(this.wanders, 1, 6) * 2;
    }
    if (this.path.length) {
      this.walk(dt);
      return this.state;
    }
    this.anim = 'idle';
    this.idleLeft -= dt;
    if (this.idleLeft <= 0) {
      this.wanders++;
      const to = pickWaypoint(this.tiles, this.wanders, this.tile());
      const p = pathWithin(this.tiles, this.tile(), to);
      p.shift();
      this.path = p;
      this.idleLeft = 5 + unit(this.wanders, 2, 6) * 9;
    }
    return this.state;
  }

  private walk(dt: number): void {
    let left = DOG_SPEED * dt;
    while (left > 0 && this.path.length) {
      const n = this.path[0];
      const tx = (n.x + 0.5) * T;
      const ty = (n.y + 1) * T;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) this.facing = dx > 0 ? 'e' : 'w';
      if (d <= left) {
        this.x = tx;
        this.y = ty;
        left -= d;
        this.path.shift();
      } else {
        this.x += (dx / d) * left;
        this.y += (dy / d) * left;
        left = 0;
      }
    }
    this.anim = this.path.length ? 'walk' : 'idle';
  }
}

/** Sprite key of the dog's current pose. */
export function dogKey(s: DogState): string {
  return `critters/vira_lata_${s.anim}_${s.facing}`;
}

// ---------------------------------------------------------------- pigeons

/** Tiles: a pigeon takes off when somebody walks this close. */
export const SCARE_TILES = 2;
export const SCARE_PX = SCARE_TILES * T;

export interface Pt {
  x: number;
  y: number;
}

/** True when any of `people` (feet, world px) is within the scare radius of the bird at (x, y). */
export function scares(bird: Pt, people: readonly Pt[], radius = SCARE_PX): Pt | null {
  let best: Pt | null = null;
  let bd = radius * radius;
  for (const p of people) {
    const d = (p.x - bird.x) ** 2 + (p.y - bird.y) ** 2;
    if (d <= bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

export type PigeonMode = 'ground' | 'flying' | 'away' | 'returning';

export interface Pigeon {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  /** height above the ground, px */
  z: number;
  vx: number;
  mode: PigeonMode;
  /** seconds in the current mode */
  t: number;
  /** seconds to wait before reacting (the flock does not leave in one frame) */
  delay: number;
  /** away: seconds until it comes back */
  back: number;
}

const FLY_S = 1.8;
const FLY_FADE_S = 0.6;
const RETURN_S = 1.4;

export function makeFlock(cx: number, cy: number, n: number, seed: number): Pigeon[] {
  const out: Pigeon[] = [];
  for (let i = 0; i < n; i++) {
    const a = unit(seed, i, 11) * Math.PI * 2;
    const r = 6 + unit(seed, i, 12) * 16;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r * 0.6);
    out.push({ homeX: x, homeY: y, x, y, z: 0, vx: 0, mode: 'ground', t: 0, delay: 0, back: 0 });
  }
  return out;
}

/**
 * One step of a flock. The first bird somebody comes close to takes the whole flock off, each bird a moment apart, flying away from
 * that person and up; after a while they fade out of sight, then drop back to their spots once nobody is near.
 */
export function stepFlock(flock: Pigeon[], dt: number, people: readonly Pt[], seed = 0): void {
  let trigger: Pt | null = null;
  for (const p of flock) if (p.mode === 'ground' && !trigger) trigger = scares(p, people);
  for (let i = 0; i < flock.length; i++) {
    const p = flock[i];
    p.t += dt;
    if (p.mode === 'ground') {
      if (trigger) {
        p.mode = 'flying';
        p.t = 0;
        p.delay = i * 0.02 + unit(seed, i, 21) * 0.06;
        const dx = p.x - trigger.x;
        const dy = p.y - trigger.y;
        const d = Math.hypot(dx, dy) || 1;
        // away from the person, with a little spread; always leaving sideways so the birds cross the screen
        p.vx = (dx / d) * (70 + unit(seed, i, 22) * 40) + (unit(seed, i, 23) - 0.5) * 60;
        p.back = 18 + unit(seed, i, 24) * 22;
      }
    } else if (p.mode === 'flying') {
      if (p.t > p.delay) {
        const u = p.t - p.delay;
        p.x += p.vx * dt;
        p.z += (30 + u * 50) * dt; // gentle climb
        if (u > FLY_S) {
          p.mode = 'away';
          p.t = 0;
        }
      }
    } else if (p.mode === 'away') {
      if (p.t > p.back && !scares({ x: p.homeX, y: p.homeY }, people, SCARE_PX * 2)) {
        p.mode = 'returning';
        p.t = 0;
        p.x = p.homeX + (unit(seed, i, 25) < 0.5 ? -1 : 1) * 60;
        p.z = 46;
      }
    } else {
      const u = Math.min(1, p.t / RETURN_S);
      p.x += (p.homeX - p.x) * Math.min(1, dt * 3.2);
      p.z = 46 * (1 - u) * (1 - u);
      if (p.t >= RETURN_S) {
        p.mode = 'ground';
        p.x = p.homeX;
        p.y = p.homeY;
        p.z = 0;
        p.t = 0;
      }
    }
  }
}

/** Alpha of a bird in its current mode (fades as it leaves, and as it arrives). */
export function pigeonAlpha(p: Pigeon): number {
  if (p.mode === 'away') return 0;
  if (p.mode === 'flying') return Math.max(0, 1 - Math.max(0, p.t - p.delay - (FLY_S - FLY_FADE_S)) / FLY_FADE_S);
  if (p.mode === 'returning') return Math.min(1, p.t / 0.35);
  return 1;
}

// ---------------------------------------------------------------- small things and gates

/** Butterflies by day (07:00-18:30), and not in rain. */
export function butterfliesActive(minute: number, rain: number): boolean {
  const m = wrapMin(minute);
  return m >= 420 && m < 1110 && rain < 0.25;
}

/** Fireflies at night (from 19:00 to 05:30). */
export function firefliesActive(minute: number): boolean {
  const m = wrapMin(minute);
  return m >= 1140 || m < 330;
}

/** 0..1 how visible the cloud shadows are: sunny days only (`sun` is the weather's direct-sun share), fading at dusk. */
export function cloudShadowAlpha(sun: number, dark: number): number {
  const s = Math.max(0, (sun - 0.55) / 0.45);
  return s * Math.max(0, 1 - dark * 2.4);
}

/** Cloud shadow drift, px per second. */
export const CLOUD_SPEED = 6;

/**
 * Regions of fx/cloud_shadow.png (512x256) sampled for one shadow each: [x, y, w, h].
 * The noise runs through these rectangles, so the sprite multiplies by `cloudSpriteMask` and the edge goes to nothing
 * instead of showing the cut.
 */
export const CLOUD_CROPS: readonly [number, number, number, number][] = [
  [150, 0, 120, 92],
  [14, 146, 214, 110],
  [206, 196, 140, 60],
  [268, 14, 150, 128],
  [60, 0, 60, 50],
];

/** How long a cloud takes to fade in after an area loads, seconds. */
export const CLOUD_FADE_SEC = 0.4;

export interface CloudBlob {
  /** index into CLOUD_CROPS */
  crop: number;
  /** world px of the sprite's top-left corner */
  x: number;
  y: number;
}

/** Where a cloud is standing when the area loads, before it drifts. */
export interface CloudHome {
  x: number;
  y: number;
}

export interface CloudView {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const smooth01 = (t: number): number => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};

/**
 * 0 on the rectangle's edge, 1 in the body. The crop is a hard slice of a bigger blob; this window is what makes the
 * sprite a whole cloud instead of one cut in half.
 */
export function cloudSpriteMask(x: number, y: number, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return 0;
  const nx = ((x + 0.5) / w) * 2 - 1;
  const ny = ((y + 0.5) / h) * 2 - 1;
  const r = Math.hypot(nx, ny);
  const inner = 0.55;
  if (r >= 1) return 0;
  if (r <= inner) return 1;
  return smooth01((1 - r) / (1 - inner));
}

/** 0 at the moment an area loads, 1 after `CLOUD_FADE_SEC`. */
export function cloudEnterAlpha(ageSec: number): number {
  return smooth01(ageSec / CLOUD_FADE_SEC);
}

/**
 * 1 while the whole sprite is inside the map, fading to 0 as it crosses either side so a camera clamped to the map
 * never slices an opaque edge. Fully off the map: 0.
 */
export function cloudCrossFade(x: number, spriteW: number, mapW: number): number {
  if (spriteW <= 0) return 0;
  if (x + spriteW <= 0 || x >= mapW) return 0;
  const band = Math.min(36, spriteW * 0.3);
  let fade = 1;
  if (x < 0) fade = Math.min(fade, smooth01((x + spriteW) / band));
  if (x + spriteW > mapW) fade = Math.min(fade, smooth01((mapW - x) / band));
  return fade;
}

/** A slot along `map` that holds `size`, preferring the part the camera can see. */
function placedAlong(u: number, size: number, map: number, view0?: number, view1?: number): number {
  let lo = 0;
  let hi = map - size;
  if (view0 !== undefined && view1 !== undefined) {
    lo = Math.max(lo, view0);
    hi = Math.min(map, view1) - size;
  }
  if (hi >= lo) return lo + (hi - lo) * (0.12 + 0.76 * u);
  const mid = view0 !== undefined && view1 !== undefined ? (Math.max(0, view0) + Math.min(map, view1)) / 2 : map / 2;
  return mid - size / 2;
}

/** Homes for the clouds on an area: each sprite sits whole inside the map, and inside `view` when it fits. */
export function cloudHome(count: number, mapW: number, mapH: number, view?: CloudView): CloudHome[] {
  const out: CloudHome[] = [];
  for (let i = 0; i < Math.min(count, CLOUD_CROPS.length); i++) {
    const c = CLOUD_CROPS[i];
    out.push({
      x: placedAlong(unit(i, 3, 33), c[2], mapW, view?.x0, view?.x1),
      y: placedAlong(unit(i, 3, 32), c[3], mapH, view?.y0, view?.y1),
    });
  }
  return out;
}

const posMod = (n: number, m: number): number => (m <= 0 ? 0 : ((n % m) + m) % m);

/**
 * Eastward drift from `home`. The run ends with the sprite fully past the right side of the map and resumes fully
 * past the left, so the wrap itself is off-screen.
 */
export function cloudX(homeX: number, spriteW: number, mapW: number, tSec: number): number {
  const period = mapW + spriteW;
  const d = posMod(tSec * CLOUD_SPEED, period);
  const exit = mapW - homeX;
  return d < exit ? homeX + d : -spriteW + (d - exit);
}

/** Up to 5 blobs (3-5 in use) drifting east at 6 px/s. Pass `home` to keep the positions chosen when the area loaded. */
export function cloudBlobs(count: number, tSec: number, w: number, h: number, home?: readonly CloudHome[]): CloudBlob[] {
  const starts = home ?? cloudHome(count, w, h);
  const out: CloudBlob[] = [];
  for (let i = 0; i < Math.min(count, starts.length, CLOUD_CROPS.length); i++) {
    const c = CLOUD_CROPS[i];
    out.push({ crop: i, x: cloudX(starts[i].x, c[2], w, tSec), y: starts[i].y });
  }
  return out;
}

/** Budget of the ambient particles (petals, butterflies, fireflies) so that rain (238 max) plus these stay under the 300 cap. */
export function petalBudget(lowfx: boolean, reduced: boolean): number {
  return reduced ? 6 : lowfx ? 12 : 26;
}
