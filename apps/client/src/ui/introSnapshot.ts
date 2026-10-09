/**
 * The title screen's Vila Ipê (Phase 6b): one static snapshot of the real map, drawn once on an offscreen 2D canvas from the same atlas,
 * terrain tiles, props and decals the game uses, graded for 17:30 with the game's own `computeLook`. No Phaser (the intro runs before the
 * WebGL game boots, see DECISIONS "Integration with main"): the intro pans the canvas with CSS transforms.
 *
 * `planSnapshot` is pure (a sorted list of draw ops) and unit tested; `loadSnapshotAssets` / `paintSnapshot` touch the DOM.
 */
import { ROOMS, type RoomDef } from '@tudobem/shared';
import type { Manifest } from '../render/pixel/manifest';
import { pixelBase } from '../render/pixel/manifest';
import { T } from '../render/pixel/coords';
import { DEPTH, fencePieces, propAnchor, propArtKey, propDepth, propSlices, standingDepth } from '../render/pixel/props';
import { sceneryFor } from '../render/pixel/scenery';
import { terrainTiles } from '../render/pixel/terrainPlan';
import { FLOOR_SUBSTITUTE } from '../render/pixel/roomLayout';
import { computeLook } from '../render/pixel/dayNight';
import { WEATHER_PARAMS } from '../render/pixel/weatherLook';

/** The moment the title shows: golden hour. */
export const SNAPSHOT_MINUTE = 17 * 60 + 30;

export type SnapOp =
  | { kind: 'tile'; depth: number; idx: number; x: number; y: number }
  | { kind: 'sprite'; depth: number; frame: string; atlas: string; x: number; y: number; w: number; h: number; alpha: number };

export interface SnapshotPlan {
  width: number;
  height: number;
  ops: SnapOp[];
  /** alpha of the sun-cast shadows at this hour (the game's `look.cast`) */
  cast: number;
  grade: [number, number, number];
  fill: { color: [number, number, number]; alpha: number };
}

/** Everything the snapshot draws, in paint order, graded for `minute` (the title's golden hour by default). */
export function planSnapshot(def: RoomDef, m: Manifest, minute = SNAPSHOT_MINUTE): SnapshotPlan {
  const ops: SnapOp[] = [];
  const look = computeLook({ outdoor: true, roomHour: minute / 60, minutes: minute, weather: WEATHER_PARAMS.sol });
  const push = (key: string | undefined | null, x: number, y: number, depth: number, alpha = 1, origin: 'anchor' | 'tl' = 'anchor') => {
    const d = key ? m.sprites[key] : undefined;
    if (!d) return null;
    const left = origin === 'tl' ? x : Math.round(x) - d.ax;
    const top = origin === 'tl' ? y : Math.round(y) - d.ay;
    ops.push({ kind: 'sprite', depth, frame: d.frame, atlas: d.atlas, x: left, y: top, w: d.w, h: d.h, alpha });
    return d;
  };
  /** a prop's sprite with its contact and cast shadows */
  const standing = (key: string, wx: number, wy: number, depth: number, shadows = true) => {
    const d = push(key, wx, wy, depth);
    if (!d || !shadows) return d;
    if (d.cast) {
      const x = Math.round(wx) - d.cast.ax;
      const y = Math.round(wy) - d.cast.ay;
      ops.push({ kind: 'sprite', depth: DEPTH.shadowCast, frame: d.cast.frame, atlas: d.atlas, x, y, w: d.cast.w, h: d.cast.h, alpha: look.cast });
    }
    const s = d.shadow ? m.sprites[d.shadow] : null;
    if (s) push(d.shadow, wx, wy - 1, DEPTH.shadowContact);
    return d;
  };

  // terrain
  const { tiles } = terrainTiles(def.floor, m.terrain, { outside: def.outdoor ? undefined : 'x', substitute: FLOOR_SUBSTITUTE });
  for (const t of tiles) ops.push({ kind: 'tile', depth: DEPTH.terrain + t.layer, idx: t.idx, x: Math.round((t.i - 0.5) * T), y: Math.round((t.j - 0.5) * T) });

  // ground dressing and the fallen petals under each ipê
  const sc = sceneryFor(def, (k) => !!m.sprites[k]);
  for (const d of sc?.decals ?? []) push(d.key, d.x, d.y, d.depth, 1, d.origin === 'tl' ? 'tl' : 'anchor');
  for (const p of def.props) {
    if (p.kind !== 'ipe') continue;
    const a = propAnchor(p);
    push(p.hero ? 'decals/petals_large' : 'decals/petals_medium', Math.round(a.wx) + 3, Math.round(a.wy) - 1, -4900);
  }

  // props
  for (const p of def.props) {
    const a = propAnchor(p);
    if (p.kind === 'cerca') {
      for (const f of fencePieces(p)) standing(f.key, (f.x + (f.w ?? 1) / 2) * T, (f.y + 1) * T, standingDepth((f.y + 1) * T, `${p.id}:${f.x},${f.y}`), false);
      continue;
    }
    const slices = propSlices(p);
    if (slices) {
      for (const s of slices) standing(s.key, (s.x + 0.5) * T, (s.y + 1) * T, propDepth(p, a.wy));
      continue;
    }
    const key = propArtKey(p);
    if (!key) continue;
    const d = standing(key, a.wx, a.wy, propDepth(p, a.wy));
    if (d && typeof d.overhead === 'string') push(d.overhead, a.wx, a.wy, DEPTH.overhead + Math.round(a.wy) / 1000);
  }

  // the wires between the poles, over everything
  const pole = m.sprites['props/poste_fios'];
  const attachY = pole?.attach?.[1] ?? -51;
  for (const run of sc?.wires ?? []) {
    let wx = run.x;
    for (const k of run.keys) {
      const d = push(k, wx, run.y + attachY, DEPTH.overhead + 200, 0.7);
      if (!d) continue;
      wx += d.w - 1;
    }
  }

  ops.sort((p, q) => p.depth - q.depth);
  return { width: def.cols * T, height: def.rows * T, ops, cast: look.cast, grade: look.grade as [number, number, number], fill: { color: look.fill.color as [number, number, number], alpha: look.fill.alpha } };
}

// ---------------------------------------------------------------- DOM side

interface AtlasJson {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
}

export interface SnapshotAssets {
  manifest: Manifest;
  atlases: Record<string, { img: HTMLImageElement; json: AtlasJson }>;
  tileset: HTMLImageElement;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });

export async function loadSnapshotAssets(base = pixelBase()): Promise<SnapshotAssets> {
  const manifest = (await (await fetch(`${base}manifest.json`)).json()) as Manifest;
  const atlases: SnapshotAssets['atlases'] = {};
  await Promise.all(
    Object.entries(manifest.atlases).filter(([, a]) => !a.lazy).map(async ([name, a]) => {
      const [img, json] = await Promise.all([loadImage(base + a.image), fetch(base + a.data).then((r) => r.json() as Promise<AtlasJson>)]);
      atlases[name] = { img, json };
    }),
  );
  const tileset = await loadImage(base + manifest.terrain.tileset);
  return { manifest, atlases, tileset };
}

const css = (c: readonly number[]) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/** Paint a plan onto a fresh canvas (1 canvas px = 1 art px) and apply the golden-hour grade. */
export function paintSnapshot(plan: SnapshotPlan, a: SnapshotAssets): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  const { margin, spacing, columns } = a.manifest.terrain;
  for (const op of plan.ops) {
    if (op.kind === 'tile') {
      const col = op.idx % columns;
      const row = Math.floor(op.idx / columns);
      ctx.drawImage(a.tileset, margin + col * (T + spacing), margin + row * (T + spacing), T, T, op.x, op.y, T, T);
    } else {
      const at = a.atlases[op.atlas];
      const f = at?.json.frames[op.frame]?.frame;
      if (!at || !f) continue;
      ctx.globalAlpha = op.alpha;
      ctx.drawImage(at.img, f.x, f.y, f.w, f.h, op.x, op.y, f.w, f.h);
      ctx.globalAlpha = 1;
    }
  }
  // the game's grade for this hour: a multiply, then the cool fill lifting the shadows
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = css(plan.grade);
  ctx.fillRect(0, 0, plan.width, plan.height);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = plan.fill.alpha;
  ctx.fillStyle = css(plan.fill.color);
  ctx.fillRect(0, 0, plan.width, plan.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

let cached: Promise<HTMLCanvasElement> | null = null;

/** The Vila Ipê snapshot at 17:30, built once. */
export function vilaSnapshot(): Promise<HTMLCanvasElement> {
  cached ??= loadSnapshotAssets().then((a) => paintSnapshot(planVilaSnapshot(a.manifest), a));
  return cached;
}


/**
 * The title screen shows the whole Vila Ipê as one picture (split into areas): the Rua dos Ipês across the top (its west and east halves side
 * by side, 21 + 19 tiles) and the Praça Central under it, lined up on the brick path that joins them (rua x15-18 = praça x14-17, so the praça sits
 * 1 tile in), with lawn filling the corners either side of the praça. 640 x 640 art px: tall enough for the pan on a phone (zoom 2) without ever
 * showing the void.
 */
export const VILA_SNAPSHOT = { width: 40 * T, height: 40 * T, praca: { x: 1 * T, y: 16 * T } } as const;

export function planVilaSnapshot(m: Manifest): SnapshotPlan {
  const rua = planSnapshot(ROOMS.rua, m);
  const leste = planSnapshot(ROOMS.rua_leste, m);
  const praca = planSnapshot(ROOMS.praca, m);
  const shift = (ops: SnapOp[], dx: number, dy: number): SnapOp[] => ops.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
  // lawn in the corners beside the praça (a room of grass that the game never uses, just for the picture)
  const grassOf = (cols: number): RoomDef => ({ ...ROOMS.praca, id: 'filler' as RoomDef['id'], cols, rows: 24, floor: Array.from({ length: 24 }, () => 'g'.repeat(cols)), props: [], portals: [], npcs: [] });
  const leftCols = VILA_SNAPSHOT.praca.x / T;
  const rightCols = 40 - leftCols - 32;
  const left = planSnapshot(grassOf(leftCols), m);
  const right = planSnapshot(grassOf(rightCols), m);
  const ops = [
    ...shift(left.ops, 0, VILA_SNAPSHOT.praca.y),
    ...shift(right.ops, VILA_SNAPSHOT.praca.x + 32 * T, VILA_SNAPSHOT.praca.y),
    ...rua.ops,
    ...shift(leste.ops, ROOMS.rua.cols * T, 0),
    ...shift(praca.ops, VILA_SNAPSHOT.praca.x, VILA_SNAPSHOT.praca.y),
  ].sort((p, q) => p.depth - q.depth);
  return { width: VILA_SNAPSHOT.width, height: VILA_SNAPSHOT.height, ops, cast: rua.cast, grade: rua.grade, fill: rua.fill };
}
