import type { Ctx } from '../draw';
import { rgba, type Tone } from './color';

export type P = [number, number];
export interface LimbPt {
  x: number;
  y: number;
  r: number;
}

/** Closed Catmull-Rom spline through `pts` (adds a subpath; caller begins/fills). */
export function smoothClosed(ctx: Ctx, pts: P[], k = 1) {
  const n = pts.length;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k, p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k, p2[0], p2[1]);
  }
  ctx.closePath();
}

/** Open Catmull-Rom spline (continues the current subpath unless `move`). */
export function smoothOpen(ctx: Ctx, pts: P[], move = true, k = 1) {
  const n = pts.length;
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k, p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k, p2[0], p2[1]);
  }
}

/** Polygon with per-corner rounding (arcTo), for tailored cloth shapes. */
export function roundPoly(ctx: Ctx, pts: P[], r: number | number[]) {
  const n = pts.length;
  const rad = (i: number) => (Array.isArray(r) ? r[i % r.length] : r);
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.arcTo(p[0], p[1], q[0], q[1], rad(i));
  }
  ctx.closePath();
}

/** Variable-width limb outline through joints (one clean silhouette, round caps). */
export function limbShape(ctx: Ctx, pts: LimbPt[]) {
  const n = pts.length;
  const tan = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return [(b.x - a.x) / d, (b.y - a.y) / d] as P;
  });
  const left = pts.map((p, i): P => [p.x - tan[i][1] * p.r, p.y + tan[i][0] * p.r]);
  const right = pts.map((p, i): P => [p.x + tan[i][1] * p.r, p.y - tan[i][0] * p.r]);
  smoothOpen(ctx, left, true);
  const e = pts[n - 1];
  const ae = Math.atan2(tan[n - 1][1], tan[n - 1][0]);
  ctx.arc(e.x, e.y, e.r, ae + Math.PI / 2, ae - Math.PI / 2, true);
  smoothOpen(ctx, right.slice().reverse(), false);
  const s = pts[0];
  const as = Math.atan2(tan[0][1], tan[0][0]);
  ctx.arc(s.x, s.y, s.r, as - Math.PI / 2, as + Math.PI / 2, true);
  ctx.closePath();
}

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface PaintOpts {
  /** Side of the key light in local x (-1 = left). */
  L: number;
  rim: string;
  /** Rim strength 0..1. */
  rimA?: number;
  /** Colored line width (0 = none). */
  lw?: number;
  /** Vertical falloff toward the bottom (occlusion near the floor / under a hem). */
  fall?: number;
  /** Top-light sheen strength. */
  top?: number;
}

/**
 * Form-shaded fill: a lit-side → shadow-side ramp, soft top light, rim on the shadow edge and a
 * colored (never black) line. `build` must add the path (without beginPath).
 */
export function paint(ctx: Ctx, build: () => void, t: Tone, b: Box, o: PaintOpts) {
  const lit = o.L < 0 ? b.x0 : b.x1;
  const dark = o.L < 0 ? b.x1 : b.x0;
  ctx.beginPath();
  build();
  // 2–3 value bands: light plane → body tone → a tighter core-shadow step → reflected shadow
  const g = ctx.createLinearGradient(lit, 0, dark, 0);
  g.addColorStop(0, t.hi);
  g.addColorStop(0.24, t.base);
  g.addColorStop(0.6, t.base);
  g.addColorStop(0.72, t.lo);
  g.addColorStop(1, t.lo);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (o.top) {
    const v = ctx.createLinearGradient(0, b.y0, 0, b.y0 + (b.y1 - b.y0) * 0.45);
    v.addColorStop(0, rgba('#fff6e6', o.top));
    v.addColorStop(1, rgba('#fff6e6', 0));
    ctx.fillStyle = v;
    ctx.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2);
  }
  if (o.fall) {
    const v = ctx.createLinearGradient(0, b.y0 + (b.y1 - b.y0) * 0.55, 0, b.y1);
    v.addColorStop(0, rgba(t.deep, 0));
    v.addColorStop(1, rgba(t.deep, o.fall));
    ctx.fillStyle = v;
    ctx.fillRect(b.x0 - 1, b.y0 - 1, b.x1 - b.x0 + 2, b.y1 - b.y0 + 2);
  }
  const ra = o.rimA ?? 0.55;
  if (ra > 0) {
    const rg = ctx.createLinearGradient(lit, 0, dark, 0);
    rg.addColorStop(0, rgba(o.rim, 0));
    rg.addColorStop(0.62, rgba(o.rim, 0));
    rg.addColorStop(1, rgba(o.rim, ra));
    ctx.strokeStyle = rg;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
  if (o.lw !== 0) {
    ctx.strokeStyle = t.line;
    ctx.lineWidth = o.lw ?? 0.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Soft stroke along a polyline (folds, seams, strands). */
export function line(ctx: Ctx, pts: P[], color: string, w: number, smooth = true) {
  ctx.beginPath();
  if (smooth && pts.length > 2) smoothOpen(ctx, pts);
  else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Radial soft spot (blush, AO, glints). */
export function glow(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, a: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Bounds of a set of limb points (for shading ramps). */
export function limbBox(pts: LimbPt[]): Box {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x - p.r);
    x1 = Math.max(x1, p.x + p.r);
    y0 = Math.min(y0, p.y - p.r);
    y1 = Math.max(y1, p.y + p.r);
  }
  return { x0, x1, y0, y1 };
}

export function ptsBox(pts: P[]): Box {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

/** Deterministic noise in [0,1). */
export function rnd(i: number, seed = 0) {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
