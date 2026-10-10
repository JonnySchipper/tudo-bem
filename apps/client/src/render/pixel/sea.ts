/**
 * The Praia's moving sea (PRAIA-PLAN.md 1.5): a 3-frame foam strip (`fx/onda_0..2`) on every water tile that meets the sand from below,
 * phase-offset by column so the foam rolls along the shore, up to three crabs that scuttle on the shore row at night, and at golden hour
 * the sun's path on the water (1.4): a column of warm glints that shimmers over the open sea from 16:30 to 18:30, gone in the rain.
 * `shoreTiles` / `crabHomes` / `sunPathAlpha` / `sunPathColumn` are pure (tested); `buildSea` puts sprites on the scene.
 */
import type Phaser from 'phaser';
import type { RoomDef } from '@tudobem/shared';
import type { Manifest } from './manifest';
import { T } from './coords';
import { DEPTH, standingDepth } from './props';

/** At most this many foam strips (the budget in the plan). */
export const FOAM_MAX = 40;
/** Foam frames per second. */
export const FOAM_FPS = 2;
export const CRABS_MAX = 3;

const WATER = 'o';

/** A cheap 0..1 hash of three integers (the glints' shimmer). */
function hashf(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Water tiles whose north neighbour is sand: where a wave breaks. Evenly thinned to `cap`. */
export function shoreTiles(floor: readonly string[], cap = FOAM_MAX): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < floor.length; y++) for (let x = 0; x < floor[y].length; x++) if (floor[y][x] === WATER && floor[y - 1][x] === 's') out.push({ x, y });
  if (out.length <= cap) return out;
  const step = out.length / cap;
  return Array.from({ length: cap }, (_, i) => out[Math.floor(i * step)]);
}

/** Sand tiles right above the sea (not the lagoa: only the longest shore row) where a crab may wander, at most `CRABS_MAX`, spread out. */
export function crabHomes(floor: readonly string[]): { x: number; y: number }[] {
  const rows = new Map<number, number[]>();
  for (const t of shoreTiles(floor, Infinity)) rows.set(t.y - 1, [...(rows.get(t.y - 1) ?? []), t.x]);
  let best: [number, number[]] | null = null;
  for (const r of rows) if (!best || r[1].length > best[1].length) best = r;
  if (!best || best[1].length < 6) return [];
  const xs = best[1];
  return Array.from({ length: CRABS_MAX }, (_, i) => ({ x: xs[Math.floor(((i + 0.5) * xs.length) / CRABS_MAX)], y: best![0] }));
}

/** 0..1 strength of the sun's reflection on the water: in from 16:30, full at 17:30, gone by 18:30 (the grade's golden keyframes). */
export function sunPathAlpha(minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  const from = 16 * 60 + 30, peak = 17 * 60 + 30, to = 18 * 60 + 30;
  if (m <= from || m >= to) return 0;
  const t = m < peak ? (m - from) / (peak - from) : (to - m) / (to - peak);
  return t * t * (3 - 2 * t);
}

/**
 * Where the path lies: the open sea (the widest run of water rows that reach the bottom edge), its column a third of the way in from the
 * west, where the sun goes down. `null` when the room has no sea reaching its bottom edge.
 */
export function sunPathColumn(floor: readonly string[]): { x: number; y0: number; y1: number } | null {
  const rows = floor.length;
  if (!rows) return null;
  const cols = floor[0].length;
  const last = floor[rows - 1];
  let x0 = -1, x1 = -1, best = 0;
  for (let x = 0, run = 0; x <= cols; x++) {
    if (x < cols && last[x] === WATER) run++;
    else {
      if (run > best) {
        best = run;
        x1 = x - 1;
        x0 = x - run;
      }
      run = 0;
    }
  }
  if (best < 6) return null;
  const x = x0 + Math.floor(best / 3);
  let y0 = rows - 1;
  while (y0 > 0 && floor[y0 - 1][x] === WATER) y0--;
  // a ring of sea round a deck is too thin for a path
  if (rows - y0 < 4) return null;
  return { x, y0, y1: rows - 1 };
}

export interface SeaView {
  /** `minute`: the game clock; `sun`: the weather's 0..1 sunshine (the path hides in rain and under cloud) */
  update(dt: number, night: number, minute?: number, sun?: number): void;
}

/** The foam and the crabs of a room with sea (null when it has none or the art is missing). `reg` registers objects for the room's teardown. */
export function buildSea(scene: Phaser.Scene, m: Manifest, def: RoomDef, reg: <O extends Phaser.GameObjects.GameObject>(o: O) => O): SeaView | null {
  const frames = [0, 1, 2].map((k) => m.sprites[`fx/onda_${k}`]).filter(Boolean);
  if (frames.length !== 3) return null;
  const foam = shoreTiles(def.floor).map((t) => {
    const img = reg(scene.add.image(t.x * T, t.y * T - 1, frames[0].atlas, frames[0].frame)).setOrigin(0, 0).setDepth(DEPTH.groundDecal + 5);
    return { img, phase: t.x % 3 };
  });
  const cd = m.sprites['critters/caranguejo'];
  const crabs = cd
    ? crabHomes(def.floor).map((h, i) => {
        const spr = reg(scene.add.sprite(h.x * T + 8, h.y * T + 12, cd.atlas, cd.frame)).setOrigin(cd.ax / cd.w, cd.ay / cd.h).setVisible(false);
        return { spr, home: h.x * T + 8, y: h.y * T + 12, x: h.x * T + 8, dir: i % 2 ? 1 : -1, t: i * 0.7 };
      })
    : [];
  // the sun's path: a column of short warm dashes over the open sea, redrawn a few times a second so it shimmers
  const col = sunPathColumn(def.floor);
  const path = col ? reg(scene.add.graphics()).setDepth(DEPTH.groundDecal + 6).setAlpha(0).setBlendMode(1 /* ADD */) : null;
  let pathFrame = -1;
  const drawPath = (frame: number) => {
    if (!path || !col) return;
    path.clear();
    const cx = col.x * T + 8;
    const h = (col.y1 - col.y0 + 1) * T;
    for (let i = 0; i < h; i += 2) {
      const k = i / h; // 0 at the horizon, 1 at the bottom: the path widens toward the viewer
      const r1 = hashf(i, frame, 1), r2 = hashf(i, frame, 2), r3 = hashf(i, frame, 3);
      if (r1 > 0.4 + k * 0.3) continue;
      const w = 2 + Math.floor(r2 * (3 + k * 6));
      const dx = Math.round((r3 - 0.5) * (6 + k * 26));
      path.fillStyle(r2 < 0.5 ? 0xffd27a : 0xfff0b8, r1 < 0.15 ? 0.9 : 0.55);
      path.fillRect(cx + dx - (w >> 1), col.y0 * T + i, w, 1);
    }
  };
  let clock = 0;
  return {
    update(dt, night, minute = 0, sun = 1) {
      clock += dt / 1000;
      const f = Math.floor(clock * FOAM_FPS);
      for (const w of foam) {
        const d = frames[(f + w.phase) % 3];
        w.img.setFrame(d.frame);
      }
      if (path) {
        const a = sunPathAlpha(minute) * Math.max(0, Math.min(1, sun)) * 0.75;
        path.setAlpha(a);
        const pf = Math.floor(clock * 4);
        if (a > 0 && pf !== pathFrame) {
          pathFrame = pf;
          drawPath(pf);
        }
      }
      const out = night > 0.5;
      for (const c of crabs) {
        c.spr.setVisible(out);
        if (!out || !cd?.anim) continue;
        c.t += dt / 1000;
        // a sideways scuttle, a pause, back the other way, never more than a tile and a half from home
        const moving = c.t % 4 < 1.6;
        if (moving) c.x += c.dir * 10 * (dt / 1000);
        if (Math.abs(c.x - c.home) > 24) c.dir = -c.dir;
        c.spr.setPosition(Math.round(c.x), c.y).setDepth(standingDepth(c.y, 'crab'));
        c.spr.setFrame(cd.anim.frames[moving ? Math.floor(c.t * 6) % cd.anim.frames.length : 0]);
      }
    },
  };
}
