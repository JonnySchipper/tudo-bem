/**
 * The Praia's moving sea (PRAIA-PLAN.md 1.5): a 3-frame foam strip (`fx/onda_0..2`) on every water tile that meets the sand from below,
 * phase-offset by column so the foam rolls along the shore, and up to three crabs that scuttle on the shore row at night.
 * `shoreTiles` / `crabHomes` are pure (tested); `buildSea` puts sprites on the scene.
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

export interface SeaView {
  update(dt: number, night: number): void;
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
  let clock = 0;
  return {
    update(dt, night) {
      clock += dt / 1000;
      const f = Math.floor(clock * FOAM_FPS);
      for (const w of foam) {
        const d = frames[(f + w.phase) % 3];
        w.img.setFrame(d.frame);
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
