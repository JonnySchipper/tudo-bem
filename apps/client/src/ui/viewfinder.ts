/**
 * The camera's viewfinder maths. Pure (no DOM, no Phaser), so it is unit tested.
 *
 * One rectangle drives everything: the frame drawn on screen, the pixels cropped into the print, and the objects the shot names. The frame is
 * a rect in client (CSS) px, kept wholly on screen; it becomes a rect in world (art) px through the camera as it was drawn, and an object is in
 * the picture when its drawn art, not the floor tiles it stands on, is mostly inside that world rect.
 */

/** The viewfinder in CSS px (diary.css `#camera-frame` has the same size). */
export const FRAME_W = 220;
export const FRAME_H = 148;

export interface ClientRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The frame centred on a pointer, slid back inside the window (`vw` x `vh`) so the print never has a blank edge. A window smaller than the
 * frame centres it on that axis.
 */
export function cameraFrameAt(x: number, y: number, vw = Infinity, vh = Infinity): ClientRect {
  const clamp = (v: number, size: number, view: number) => (view <= size ? view / 2 : Math.min(view - size / 2, Math.max(size / 2, v)));
  const cx = clamp(x, FRAME_W, vw);
  const cy = clamp(y, FRAME_H, vh);
  return { x: cx - FRAME_W / 2, y: cy - FRAME_H / 2, w: FRAME_W, h: FRAME_H };
}

/**
 * The camera as it was drawn: the world point at the centre of the canvas, device px per world px, and the canvas backing store in device px.
 * (Phaser: `scrollX + width / 2`, `scrollY + height / 2`, `zoom`, and the canvas' `width` / `height`.)
 */
export interface DrawnView {
  cx: number;
  cy: number;
  zoom: number;
  w: number;
  h: number;
}

/**
 * A client-px rect into world px. `canvas` is the canvas' on-screen box (getBoundingClientRect). Client px go to device px by the canvas'
 * own displayed scale (its backing store over its box), the same mapping the print's crop uses, so the shot names what the print shows.
 */
export function clientRectToWorld(r: ClientRect, canvas: ClientRect, view: DrawnView): WorldRect {
  const sx = view.w / canvas.w;
  const sy = view.h / canvas.h;
  const wx = (px: number) => view.cx + ((px - canvas.x) * sx - view.w / 2) / view.zoom;
  const wy = (py: number) => view.cy + ((py - canvas.y) * sy - view.h / 2) / view.zoom;
  return { x0: wx(r.x), y0: wy(r.y), x1: wx(r.x + r.w), y1: wy(r.y + r.h) };
}

/** The part of the canvas backing store (device px) a client-px rect covers: the crop of the print. */
export function clientRectToCanvas(r: ClientRect, canvas: ClientRect, buffer: { w: number; h: number }): ClientRect {
  const sx = buffer.w / canvas.w;
  const sy = buffer.h / canvas.h;
  return { x: (r.x - canvas.x) * sx, y: (r.y - canvas.y) * sy, w: r.w * sx, h: r.h * sy };
}

const area = (r: WorldRect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);

function overlap(a: WorldRect, b: WorldRect): WorldRect | null {
  const o = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return o.x1 > o.x0 && o.y1 > o.y0 ? o : null;
}

/** An object is in the shot when at least this much of its art is inside the frame... */
export const IN_SHOT_OF_THING = 0.5;
/** ...or when it fills at least this much of the frame (a building front, a tree or the runway, bigger than the frame itself). */
export const IN_SHOT_OF_FRAME = 0.35;

/**
 * How much of `art` (world rects of what is drawn for one object; several for a long counter or a stall with its canopy) is in the frame:
 * the share of the art inside it and the share of the frame it fills, and the centre of the visible part.
 */
export function framedShare(frame: WorldRect, art: readonly WorldRect[]): { ofThing: number; ofFrame: number; at: { x: number; y: number } } | null {
  let inside = 0;
  let total = 0;
  let mx = 0;
  let my = 0;
  for (const r of art) {
    total += area(r);
    const o = overlap(frame, r);
    if (!o) continue;
    const a = area(o);
    inside += a;
    mx += ((o.x0 + o.x1) / 2) * a;
    my += ((o.y0 + o.y1) / 2) * a;
  }
  const fa = area(frame);
  if (!inside || !total || !fa) return null;
  return { ofThing: inside / total, ofFrame: inside / fa, at: { x: mx / inside, y: my / inside } };
}

export const inShot = (s: { ofThing: number; ofFrame: number } | null): boolean => !!s && (s.ofThing >= IN_SHOT_OF_THING || s.ofFrame >= IN_SHOT_OF_FRAME);

/**
 * The objects in the picture, nearest the reticle (the frame's centre) first, so the cards come in the order the player aimed. Each candidate
 * is an id and the world rects of its art; an id named twice (two of the same furniture) counts once, at its best placement.
 */
export function framedIds(frame: WorldRect, candidates: readonly { id: string; art: readonly WorldRect[] }[], max = 24): string[] {
  const aim = { x: (frame.x0 + frame.x1) / 2, y: (frame.y0 + frame.y1) / 2 };
  const best = new Map<string, number>();
  for (const c of candidates) {
    const s = framedShare(frame, c.art);
    if (!s || !inShot(s)) continue;
    const d = Math.hypot(s.at.x - aim.x, s.at.y - aim.y);
    const had = best.get(c.id);
    if (had === undefined || d < had) best.set(c.id, d);
  }
  return [...best.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
    .slice(0, max);
}
