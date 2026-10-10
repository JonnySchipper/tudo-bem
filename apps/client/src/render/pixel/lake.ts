/**
 * The Lagoa do Jerivá's life: what makes the still water feel alive.
 *
 * - capybaras (a family on the south sand, one on the west bank) amble along their bit of bank, stop to graze, and lie down at night;
 * - egrets stand in the shallows by day, pecking now and then, a ring of ripple round their legs;
 * - three whistling ducks paddle a slow loop round the open water in a line, by day;
 * - dragonflies dart and hover over the reeds on sunny days;
 * - a fish rises somewhere on the open water every few seconds: a ring spreads and fades;
 * - fireflies blink over the banks at night.
 *
 * Where they live is data per room (`LAKE_LIFE`); `openWater` / `duckAt` / `fireflyBlink` / `lakeLifeFits` are pure (tested); `buildLake` puts
 * the sprites on the scene. Nothing here is walkable or clickable: the server never hears about any of it.
 */
import type Phaser from 'phaser';
import type { RoomDef } from '@tudobem/shared';
import type { Manifest, SpriteDef } from './manifest';
import { T } from './coords';
import { DEPTH, standingDepth } from './props';
import type { Light } from './lightingRig';

/** The lagoon's water char (`rooms.ts` FLOOR_CHARS `w`). */
const WATER = 'w';

export interface LakeLife {
  /** capybaras: a home tile on the bank (they keep to its row) and how far (tiles) they wander east and west of it */
  capivaras: { x: number; y: number; r: number; pup?: boolean }[];
  /** egrets: where each stands in the shallows (a water tile next to the bank) */
  garcas: { x: number; y: number }[];
  /** the ducks' loop: an ellipse on open water (tiles), and how many follow it */
  ducks: { cx: number; cy: number; rx: number; ry: number; n: number };
  /** reed clumps the dragonflies hover over (tiles) */
  libelulas: { x: number; y: number }[];
}

export const LAKE_LIFE: Partial<Record<RoomDef['id'], LakeLife>> = {
  lagoa: {
    capivaras: [
      { x: 11, y: 22, r: 2.5 },
      { x: 13, y: 21, r: 1.5, pup: true },
      { x: 16, y: 22, r: 2, pup: true },
      { x: 6, y: 19, r: 1.5 },
    ],
    garcas: [
      { x: 4, y: 12 },
      { x: 12, y: 11 },
      { x: 24, y: 8 },
    ],
    ducks: { cx: 14.5, cy: 12, rx: 3.5, ry: 2.5, n: 3 },
    libelulas: [
      { x: 5, y: 10 },
      { x: 22, y: 18 },
      { x: 25, y: 10 },
    ],
  },
};

/** How many fireflies blink over the banks at night. */
export const FIREFLIES = 26;
/** The first this many of them are real (tiny) lights, so they glow through the night grade; the rest are the specks between. */
export const FIREFLY_LIGHTS = 20;
/** At most this many fish rings spread at once. */
export const RINGS_MAX = 3;

/** A cheap 0..1 hash of three integers. */
function hashf(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const isWater = (floor: readonly string[], x: number, y: number) => floor[y]?.[x] === WATER;

/** Water tiles with water all round (8 neighbours): where a fish may rise without a ring spilling onto the bank. */
export function openWater(floor: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < floor.length - 1; y++)
    for (let x = 1; x < floor[y].length - 1; x++) {
      let all = true;
      for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!isWater(floor, x + dx, y + dy)) all = false;
      if (all) out.push({ x, y });
    }
  return out;
}

/** Bank tiles (not water, a water tile within 2): where the fireflies hang about. */
export function bankTiles(floor: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < floor.length - 1; y++)
    for (let x = 1; x < floor[y].length - 1; x++) {
      if (isWater(floor, x, y)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (isWater(floor, x + dx, y + dy)) near = true;
      if (near) out.push({ x, y });
    }
  return out;
}

/** Where duck `i` of `n` is on the loop at time `t` (s), in tiles, and which way it swims (+1 east, -1 west). One lap takes 90 s. */
export function duckAt(d: LakeLife['ducks'], i: number, t: number): { x: number; y: number; dir: 1 | -1 } {
  const a = (t / 90) * Math.PI * 2 - i * 0.32;
  // counter-clockwise on screen: east along the bottom of the loop, west along the top
  return { x: d.cx + Math.cos(a) * d.rx, y: d.cy + Math.sin(a) * d.ry, dir: -Math.sin(a) >= 0 ? -1 : 1 };
}

/** 0..1 brightness of a firefly at time `t` (s): a short soft blink every few seconds, each fly on its own beat. */
export function fireflyBlink(t: number, seed: number): number {
  const period = 2.2 + hashf(seed, 1, 7) * 2.4;
  const ph = (t / period + hashf(seed, 2, 7)) % 1;
  // lit for the first quarter of its beat: up and down like a breath
  if (ph > 0.25) return 0;
  return Math.sin((ph / 0.25) * Math.PI) ** 2;
}

/** Everything in `life` sits where it should on this floor: ducks and egrets on water, capybaras on dry ground (for the tests and a guard). */
export function lakeLifeFits(floor: readonly string[], life: LakeLife): string[] {
  const bad: string[] = [];
  for (const c of life.capivaras)
    for (let x = Math.floor(c.x - c.r); x <= Math.ceil(c.x + c.r); x++) if (isWater(floor, x, c.y) || floor[c.y]?.[x] === undefined) bad.push(`capivara ${c.x},${c.y} at ${x}`);
  for (const g of life.garcas) if (!isWater(floor, g.x, g.y)) bad.push(`garça ${g.x},${g.y}`);
  for (let k = 0; k < 72; k++) {
    const p = duckAt(life.ducks, 0, (k / 72) * 90);
    if (!isWater(floor, Math.floor(p.x + 0.5), Math.floor(p.y + 0.5))) bad.push(`duck loop at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return bad;
}

export interface LakeView {
  /** `night` 0..1 (the look), `sun` 0..1 (the weather's sunshine), `rain` 0..1 */
  update(dt: number, night: number, sun: number, rain: number): void;
}

type Capi = { spr: Phaser.GameObjects.Sprite; d: SpriteDef; home: number; r: number; y: number; x: number; tx: number; dir: 1 | -1; state: 'walk' | 'graze' | 'idle'; until: number; t: number };

/**
 * The lagoon's life (null for a room without a lake, or when the art is missing). `reg` registers objects for the room's teardown; the
 * fireflies' lights go into `lights` (the rig's list: the caller syncs it).
 */
export function buildLake(scene: Phaser.Scene, m: Manifest, def: RoomDef, reg: <O extends Phaser.GameObjects.GameObject>(o: O) => O, lights: Light[] = []): LakeView | null {
  const life = LAKE_LIFE[def.id];
  if (!life) return null;
  const sd = (k: string) => m.sprites[k];
  const capiD = sd('lagoa/capivara');
  const pupD = sd('lagoa/capivara_filhote');
  const garcaD = sd('lagoa/garca');
  const duckD = sd('lagoa/marreca');
  const flyD = sd('lagoa/libelula');
  if (!capiD?.anim || !pupD?.anim || !garcaD?.anim || !duckD?.anim || !flyD?.anim) return null;
  const sprite = (d: SpriteDef, x: number, y: number) => reg(scene.add.sprite(x, y, d.atlas, d.frame)).setOrigin(d.ax / d.w, d.ay / d.h);

  // ---- capybaras
  const capis: Capi[] = life.capivaras.map((c, i) => {
    const d = c.pup ? pupD : capiD;
    const y = c.y * T + 13;
    const x = c.x * T + 8;
    return { spr: sprite(d, x, y).setDepth(standingDepth(y, `capi${i}`)), d, home: x, r: c.r * T, y, x, tx: x, dir: i % 2 ? -1 : 1, state: 'idle', until: 1 + i * 0.8, t: 0 };
  });

  // ---- egrets, each with a ring round its legs
  const legRings = reg(scene.add.graphics()).setDepth(DEPTH.groundDecal + 7);
  const egrets = life.garcas.map((g, i) => {
    const x = g.x * T + 8;
    const y = g.y * T + 12;
    return { spr: sprite(garcaD, x, y).setDepth(standingDepth(y, `garca${i}`)).setFlipX(i % 2 === 1), x, y, pose: 0, until: 2 + i * 1.3 };
  });

  // ---- ducks
  const ducks = Array.from({ length: life.ducks.n }, (_, i) => sprite(duckD, 0, 0).setDepth(DEPTH.groundDecal + 8 + i * 0.01));

  // ---- dragonflies
  const flies = life.libelulas.map((l, i) => {
    const hx = l.x * T + 8;
    const hy = l.y * T - 6;
    return { spr: sprite(flyD, hx, hy).setDepth(DEPTH.overhead - 10 + i * 0.01), hx, hy, x: hx, y: hy, tx: hx, ty: hy, next: i * 0.6 };
  });

  // ---- fish rings on the open water
  const open = openWater(def.floor);
  const ringG = reg(scene.add.graphics()).setDepth(DEPTH.groundDecal + 6);
  const rings: { x: number; y: number; age: number }[] = [];
  let nextRing = 1.5;

  // ---- fireflies over the banks (drawn above the night grade so they glow)
  const banks = bankTiles(def.floor);
  const fireG = reg(scene.add.graphics()).setDepth(DEPTH.lighting + 20).setBlendMode(1 /* ADD */);
  const fireflies = banks.length
    ? Array.from({ length: FIREFLIES }, (_, i) => {
        const b = banks[Math.floor(hashf(i, 3, 11) * banks.length)];
        const light: Light | null = i < FIREFLY_LIGHTS ? { x: 0, y: 0, r: 9, color: 0xb8ff60, squash: 1, kind: 'lamp', glow: 0.9, live: 0 } : null;
        if (light) lights.push(light);
        return { x: b.x * T + hashf(i, 4, 11) * T, y: b.y * T + hashf(i, 5, 11) * T - 6, ax: 6 + hashf(i, 6, 11) * 10, ay: 3 + hashf(i, 7, 11) * 6, w: 0.2 + hashf(i, 8, 11) * 0.3, seed: i, light };
      })
    : [];

  let clock = 0;
  const frameOf = (d: SpriteDef, i: number) => d.anim!.frames[Math.min(i, d.anim!.frames.length - 1)];

  return {
    update(dt, night, sun, rain) {
      const s = dt / 1000;
      clock += s;
      const day = night < 0.5;

      // capybaras: walk a little, graze a while, stand; all lie down at night
      for (const c of capis) {
        c.t += s;
        if (!day) {
          c.spr.setFrame(frameOf(c.d, 6));
          continue;
        }
        c.until -= s;
        if (c.state === 'walk') {
          const step = c.dir * 9 * s;
          c.x += step;
          if ((c.dir > 0 && c.x >= c.tx) || (c.dir < 0 && c.x <= c.tx)) {
            c.x = c.tx;
            c.state = hashf(Math.floor(c.t * 10), c.home, 1) < 0.6 ? 'graze' : 'idle';
            c.until = 3 + hashf(Math.floor(c.t * 10), c.home, 2) * 6;
          }
          c.spr.setFrame(frameOf(c.d, Math.floor(c.t * 6) % 4));
        } else {
          c.spr.setFrame(frameOf(c.d, c.state === 'graze' ? 4 + (Math.floor(c.t * 2) % 2) : 0));
          if (c.until <= 0) {
            const k = Math.floor(c.t * 10);
            c.tx = c.home + (hashf(k, c.home, 3) * 2 - 1) * c.r;
            c.dir = c.tx >= c.x ? 1 : -1;
            c.state = Math.abs(c.tx - c.x) < 3 ? 'graze' : 'walk';
            c.until = 4;
          }
        }
        c.spr.setFlipX(c.dir < 0).setPosition(Math.round(c.x), c.y).setDepth(standingDepth(c.y, `capi${c.home}`));
      }

      // egrets: by day, mostly still; a peck (two frames), a look back
      legRings.clear();
      for (const g of egrets) {
        g.spr.setVisible(day);
        if (!day) continue;
        g.until -= s;
        if (g.until <= 0) {
          const r = hashf(Math.floor(clock * 7), g.x, 4);
          g.pose = g.pose !== 0 ? 0 : r < 0.55 ? 1 : r < 0.8 ? 3 : 0;
          g.until = g.pose === 1 ? 0.5 : g.pose === 3 ? 1.6 : 2.5 + r * 4;
        }
        const f = g.pose === 1 ? (g.until < 0.25 ? 2 : 1) : g.pose;
        g.spr.setFrame(frameOf(garcaD, f));
        const wob = Math.sin(clock * 1.7 + g.x) * 0.5;
        legRings.lineStyle(1, 0xc9e6dc, 0.55);
        legRings.strokeEllipse(g.x, g.y - 1, 12 + wob, 4);
      }

      // ducks: by day, round the loop
      for (let i = 0; i < ducks.length; i++) {
        const dk = ducks[i];
        dk.setVisible(day);
        if (!day) continue;
        const p = duckAt(life.ducks, i, clock);
        dk.setPosition(Math.round(p.x * T + 8), Math.round(p.y * T + 10)).setFlipX(p.dir < 0);
        dk.setFrame(frameOf(duckD, Math.floor(clock * 3 + i) % 2));
      }

      // dragonflies: sunny days only, darting from one hover to the next over their reeds
      const flying = day && rain < 0.3 && sun > 0.3;
      for (const f of flies) {
        f.spr.setVisible(flying);
        if (!flying) continue;
        f.next -= s;
        if (f.next <= 0) {
          const k = Math.floor(clock * 5);
          f.tx = f.hx + (hashf(k, f.hx, 5) * 2 - 1) * 26;
          f.ty = f.hy + (hashf(k, f.hy, 6) * 2 - 1) * 12;
          f.next = 0.8 + hashf(k, f.hx, 7) * 1.6;
        }
        const ease = 1 - Math.exp(-s * 9);
        const dx = (f.tx - f.x) * ease;
        f.x += dx;
        f.y += (f.ty - f.y) * ease;
        const jitter = Math.sin(clock * 23 + f.hx) * 0.6;
        f.spr.setPosition(Math.round(f.x), Math.round(f.y + jitter)).setFlipX(dx < -0.05 ? true : dx > 0.05 ? false : f.spr.flipX);
        f.spr.setFrame(frameOf(flyD, Math.floor(clock * 14) % 2));
      }

      // a fish rises: a ring spreads over 1.8 s and fades (more of them in the rain: the drops)
      ringG.clear();
      nextRing -= s * (1 + rain * 2);
      if (nextRing <= 0 && open.length && rings.length < RINGS_MAX) {
        const k = Math.floor(clock * 13);
        const w = open[Math.floor(hashf(k, 9, 9) * open.length)];
        rings.push({ x: w.x * T + 4 + hashf(k, 10, 9) * 8, y: w.y * T + 4 + hashf(k, 11, 9) * 8, age: 0 });
        nextRing = 2.5 + hashf(k, 12, 9) * 3.5;
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += s;
        const u = r.age / 1.8;
        if (u >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const rad = 2 + u * 11;
        ringG.lineStyle(1, 0xc9e6dc, 0.7 * (1 - u));
        ringG.strokeEllipse(r.x, r.y, rad * 2, rad * 0.9);
        if (u > 0.25) {
          ringG.lineStyle(1, 0x86bcad, 0.5 * (1 - u));
          ringG.strokeEllipse(r.x, r.y, rad * 1.1, rad * 0.5);
        }
      }

      // fireflies: night, not in a downpour
      fireG.clear();
      const glow = Math.max(0, Math.min(1, (night - 0.35) / 0.4)) * (1 - Math.min(1, rain * 1.4));
      for (const f of fireflies) {
        const b = glow > 0.01 ? fireflyBlink(clock, f.seed) * glow : 0;
        if (f.light) f.light.live = b;
        if (b < 0.02) continue;
        {
          const x = Math.round(f.x + Math.sin(clock * f.w + f.seed) * f.ax);
          const y = Math.round(f.y + Math.sin(clock * f.w * 1.3 + f.seed * 2) * f.ay);
          if (f.light) {
            f.light.x = x;
            f.light.y = y;
          }
          fireG.fillStyle(0x9cff5a, 0.28 * b);
          fireG.fillRect(x - 2, y - 1, 5, 3);
          fireG.fillRect(x - 1, y - 2, 3, 5);
          fireG.fillStyle(0xeaffa0, 0.95 * b);
          fireG.fillRect(x, y, 1, 1);
        }
      }
    },
  };
}
