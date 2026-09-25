import { HH, HW } from './iso';

export type Ctx = CanvasRenderingContext2D;

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function poly(ctx: Ctx, pts: [number, number][], fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Screen offset for a tile-space delta. */
export const iso = (dx: number, dy: number): [number, number] => [(dx - dy) * HW, (dx + dy) * HH];

/**
 * Isometric box centered on (cx, cy) (floor point), extents in tiles along x/y, height in px.
 * `lift` raises the base.
 */
export function box(ctx: Ctx, cx: number, cy: number, ex: number, ey: number, h: number, color: string, lift = 0, opts: { top?: string; left?: string; right?: string; stroke?: string } = {}) {
  const [ax, ay] = iso(ex / 2, 0);
  const [bx, by] = iso(0, ey / 2);
  const y0 = cy - lift;
  // Base corners: N (−x,−y), E (+x,−y), S (+x,+y), W (−x,+y)
  const N: [number, number] = [cx - ax - bx, y0 - ay - by];
  const E: [number, number] = [cx + ax - bx, y0 + ay - by];
  const S: [number, number] = [cx + ax + bx, y0 + ay + by];
  const W: [number, number] = [cx - ax + bx, y0 - ay + by];
  const up = (p: [number, number]): [number, number] => [p[0], p[1] - h];
  const stroke = opts.stroke ?? 'rgba(0,0,0,0.18)';
  poly(ctx, [W, S, up(S), up(W)], opts.left ?? shade(color, -0.18), stroke);
  poly(ctx, [S, E, up(E), up(S)], opts.right ?? shade(color, -0.32), stroke);
  poly(ctx, [up(N), up(E), up(S), up(W)], opts.top ?? color, stroke);
  return { N, E, S, W, top: [up(N), up(E), up(S), up(W)] as [number, number][] };
}

export function diamond(ctx: Ctx, cx: number, cy: number, ex: number, ey: number, fill?: string, stroke?: string, lw = 1) {
  const [ax, ay] = iso(ex / 2, 0);
  const [bx, by] = iso(0, ey / 2);
  poly(
    ctx,
    [
      [cx - ax - bx, cy - ay - by],
      [cx + ax - bx, cy + ay - by],
      [cx + ax + bx, cy + ay + by],
      [cx - ax + bx, cy - ay + by],
    ],
    fill,
    stroke,
    lw,
  );
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[], fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function shadow(ctx: Ctx, x: number, y: number, rx = 18, ry = 8, a = 0.22) {
  ellipse(ctx, x, y, rx, ry, `rgba(20,10,30,${a})`);
}

/** Deterministic hash noise in [0,1). */
export function hash(x: number, y: number, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const FONT_TITLE = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
export const FONT_BODY = 'Nunito, system-ui, -apple-system, "Segoe UI", sans-serif';

export function wrapText(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
