/**
 * Design mode's pure editing model: history, layers, picking boxes, duplicate / paste, fine nudge, draw order and rotation.
 * No DOM and no Phaser, so it is unit tested (model.test.ts).
 */
import { LAYOUT_DIRS, LAYOUT_MAX_Z, shiftProp, type Dir, type PropDef } from '@tudobem/shared';

/** Art px per tile. */
export const T = 16;

/** What the editor needs to know about a prop's sprite (a manifest entry). */
export interface SpriteInfo {
  w: number;
  h: number;
  ax: number;
  ay: number;
  decal?: boolean;
  overhead?: string | true | null;
  light?: unknown;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Drawing layers. Collision is not a layer of props but an overlay (the `blocks` flag), toggled beside them. */
export type Layer = 'floor' | 'objects' | 'overhead';
export const LAYERS: readonly Layer[] = ['floor', 'objects', 'overhead'];

/** Ground art (decals, the mat) is the floor layer; roofs and canopies drawn above walkers are overhead; everything else is an object. */
export function layerOf(p: PropDef, sprite: SpriteInfo | null | undefined, artKey: string | null): Layer {
  if (p.kind === 'tatame' || sprite?.decal || artKey?.startsWith('decals/')) return 'floor';
  if (sprite?.overhead === true) return 'overhead';
  return 'objects';
}

export const size = (p: PropDef) => ({ w: p.w ?? 1, h: p.h ?? 1 });

export function footprint(p: PropDef): Box {
  const { w, h } = size(p);
  return { x0: p.x * T, y0: p.y * T, x1: (p.x + w) * T, y1: (p.y + h) * T };
}

/** World box a prop covers on screen: its sprite around the anchor (bottom centre of the footprint, plus the fine nudge), and the footprint. */
export function propBox(p: PropDef, sprite: SpriteInfo | null | undefined): Box {
  const foot = footprint(p);
  const ox = p.ox ?? 0;
  const oy = p.oy ?? 0;
  if (!sprite) return { x0: foot.x0 + ox, y0: Math.min(foot.y0, foot.y1 - 2 * T) + oy, x1: foot.x1 + ox, y1: foot.y1 + oy };
  const { w, h } = size(p);
  const wx = (p.x + w / 2) * T + ox;
  const wy = (p.y + h) * T + oy;
  return {
    x0: Math.min(foot.x0, wx - sprite.ax),
    y0: Math.min(foot.y0, wy - sprite.ay),
    x1: Math.max(foot.x1, wx - sprite.ax + sprite.w),
    y1: Math.max(foot.y1, wy - sprite.ay + sprite.h),
  };
}

export const boxesTouch = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
export const inBox = (b: Box, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
export const normBox = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
  x0: Math.min(a.x, b.x),
  y0: Math.min(a.y, b.y),
  x1: Math.max(a.x, b.x),
  y1: Math.max(a.y, b.y),
});

/** Draw order of a standing prop, as the renderer sorts it: the bottom edge in world px plus the design bias. */
export const drawDepth = (p: PropDef) => (p.y + size(p).h) * T + (p.oy ?? 0) + (p.z ?? 0);

/**
 * The prop drawn on top at a world point, skipping `skip` (hidden or locked). Floor art loses to anything standing on it, so a click
 * on a bench on a mosaic picks the bench.
 */
export function pickAt(objects: readonly PropDef[], wx: number, wy: number, boxOf: (p: PropDef) => Box, layer: (p: PropDef) => Layer, skip: (p: PropDef) => boolean): PropDef | null {
  const rank: Record<Layer, number> = { floor: 0, objects: 1, overhead: 2 };
  let best: PropDef | null = null;
  let bestKey = -Infinity;
  for (const p of objects) {
    if (skip(p) || !inBox(boxOf(p), wx, wy)) continue;
    const k = rank[layer(p)] * 1e6 + drawDepth(p);
    if (k >= bestKey) {
      best = p;
      bestKey = k;
    }
  }
  return best;
}

/** Ids of props whose box meets the marquee. */
export function marqueeIds(objects: readonly PropDef[], m: Box, boxOf: (p: PropDef) => Box, skip: (p: PropDef) => boolean): string[] {
  return objects.filter((p) => !skip(p) && boxesTouch(boxOf(p), m)).map((p) => p.id);
}

/** `base`, or `base_2`, `base_3`... whichever is free. Ids stay inside the layout's id pattern. */
export function freshId(base: string, taken: Set<string>): string {
  const stem = base.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_\d+$/, '').slice(0, 56) || 'obj';
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem}_${n}`)) n++;
  return `${stem}_${n}`;
}

/** Copies of `props` moved by (dx, dy) tiles with new ids. Interaction tiles and fence gaps move with them. */
export function cloneProps(props: readonly PropDef[], taken: Set<string>, dx: number, dy: number): PropDef[] {
  const ids = new Set(taken);
  return props.map((p) => {
    const c = structuredClone(p) as PropDef;
    c.id = freshId(p.id, ids);
    ids.add(c.id);
    shiftProp(c, dx, dy);
    return c;
  });
}

/** Copies of clipboard props placed so the top-left of the group lands on `at`. */
export function pasteAt(props: readonly PropDef[], taken: Set<string>, at: { x: number; y: number }): PropDef[] {
  if (!props.length) return [];
  const x0 = Math.min(...props.map((p) => p.x));
  const y0 = Math.min(...props.map((p) => p.y));
  return cloneProps(props, taken, at.x - x0, at.y - y0);
}

/** Fine move in art px: the remainder stays in `ox`/`oy` (0..15), whole tiles move the prop. */
export function nudgePx(p: PropDef, dx: number, dy: number): void {
  let ox = (p.ox ?? 0) + dx;
  let oy = (p.oy ?? 0) + dy;
  const cx = Math.floor(ox / T);
  const cy = Math.floor(oy / T);
  ox -= cx * T;
  oy -= cy * T;
  shiftProp(p, cx, cy);
  if (ox) p.ox = ox;
  else delete p.ox;
  if (oy) p.oy = oy;
  else delete p.oy;
}

/** Snap a prop back onto the grid (drops the fine nudge, rounding to the nearest tile). */
export function snapToGrid(p: PropDef): void {
  const cx = Math.round((p.ox ?? 0) / T);
  const cy = Math.round((p.oy ?? 0) / T);
  shiftProp(p, cx, cy);
  delete p.ox;
  delete p.oy;
}

const clampZ = (z: number) => Math.max(-LAYOUT_MAX_Z, Math.min(LAYOUT_MAX_Z, Math.round(z)));

function setZ(p: PropDef, z: number): void {
  const v = clampZ(z);
  if (v) p.z = v;
  else delete p.z;
}

/**
 * Bring forward (`dir` 1) or send back (-1): just in front of (behind) every overlapping prop that is drawn over (under) it now. A prop with
 * nothing to pass gets one step anyway, so the button always does something visible to the number.
 */
export function restack(objects: PropDef[], ids: ReadonlySet<string>, dir: 1 | -1, boxOf: (p: PropDef) => Box): void {
  for (const p of objects) {
    if (!ids.has(p.id)) continue;
    const box = boxOf(p);
    const mine = drawDepth(p);
    let target = mine + dir;
    for (const q of objects) {
      if (ids.has(q.id) || !boxesTouch(box, boxOf(q))) continue;
      const d = drawDepth(q);
      if (dir === 1 && d >= mine) target = Math.max(target, d + 1);
      if (dir === -1 && d <= mine) target = Math.min(target, d - 1);
    }
    setZ(p, (p.z ?? 0) + (target - mine));
  }
}

/** Order the seat directions turn through (clockwise seen from above). */
const SEAT_TURN: readonly Dir[] = ['SE', 'SW', 'NW', 'NE'];

/** Art keys that come in facings: `<stem>_<n|e|s|w>` or `<stem>_<0|1>`. */
const FACING = /^(.*)_(n|e|s|w|0|1)$/;

/**
 * Turn a prop a quarter: a seat turns its facing (the chair sprite follows it), an art key with facing siblings in the manifest moves to the
 * next one. False when the sprite has no other facings (then the editor offers flip instead).
 */
export function rotateProp(p: PropDef, hasSprite: (key: string) => boolean): boolean {
  if (p.seat) {
    const i = SEAT_TURN.indexOf(p.seat);
    p.seat = SEAT_TURN[(i + 1) % SEAT_TURN.length]!;
    return true;
  }
  const m = p.art ? FACING.exec(p.art) : null;
  if (!m) return false;
  const order = /[01]/.test(m[2]!) ? ['0', '1'] : ['e', 's', 'w', 'n'];
  const at = order.indexOf(m[2]!);
  for (let i = 1; i < order.length; i++) {
    const key = `${m[1]}_${order[(at + i) % order.length]}`;
    if (hasSprite(key)) {
      p.art = key;
      return true;
    }
  }
  return false;
}

export const isDir = (v: string): v is Dir => (LAYOUT_DIRS as readonly string[]).includes(v);

export interface HistoryEntry {
  label: string;
  at: number;
}

/**
 * Unlimited undo / redo for one editing session. Each entry keeps the layout from before the edit (as JSON, so later edits cannot reach in),
 * and its label is the change list's line.
 */
export class EditHistory {
  private past: (HistoryEntry & { state: string })[] = [];
  private future: (HistoryEntry & { state: string })[] = [];

  constructor(private now: () => number = Date.now) {}

  /** Call before changing the layout, with the layout as it is now. */
  record(label: string, before: readonly PropDef[]): void {
    this.past.push({ label, at: this.now(), state: JSON.stringify(before) });
    this.future.length = 0;
  }

  /** Merge into the last entry instead of adding one (a drag that keeps moving, typing in a field). */
  recordOrMerge(label: string, before: readonly PropDef[], mergeKey: string): void {
    const last = this.past.at(-1) as (HistoryEntry & { state: string; key?: string }) | undefined;
    if (last && last.key === mergeKey && this.now() - last.at < 1500) {
      last.at = this.now();
      this.future.length = 0;
      return;
    }
    this.record(label, before);
    (this.past.at(-1) as { key?: string }).key = mergeKey;
  }

  /** The layout before the last edit, or null. `current` goes on the redo stack. */
  undo(current: readonly PropDef[]): PropDef[] | null {
    const e = this.past.pop();
    if (!e) return null;
    this.future.push({ label: e.label, at: e.at, state: JSON.stringify(current) });
    return JSON.parse(e.state) as PropDef[];
  }

  redo(current: readonly PropDef[]): PropDef[] | null {
    const e = this.future.pop();
    if (!e) return null;
    this.past.push({ label: e.label, at: e.at, state: JSON.stringify(current) });
    return JSON.parse(e.state) as PropDef[];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Done edits, oldest first, then the undone ones that redo would bring back. */
  entries(): { done: HistoryEntry[]; undone: HistoryEntry[] } {
    return { done: this.past.map(({ label, at }) => ({ label, at })), undone: [...this.future].reverse().map(({ label, at }) => ({ label, at })) };
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
