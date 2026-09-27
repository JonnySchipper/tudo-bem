import type { HatDef } from '@tudobem/shared';
import type { Ctx } from '../draw';
import { mix, rgba, tone, type Tone } from './color';
import { glow, line, paint, ptsBox, rnd, roundPoly, smoothClosed, type P, type PaintOpts } from './shape';

/**
 * Hats are the silhouette heroes. Hat space: origin = band center on the head, +x = facing side,
 * designed for a band half-width of 7.2 (scaled to the hair volume by the caller).
 */
export const HAT_W = 7.2;

export interface HatCtx {
  L: number;
  rim: string;
  front: boolean;
  t: number;
  /** Shop icon: no head, so skip chin straps. */
  icon?: boolean;
  /** 0 = straight-on front (brims point at the camera), 1 = three-quarter. */
  turn?: number;
}

/** How far a hat's brim shades the face below the band (0 = none). */
export function brimShade(shape: HatDef['shape']): number {
  switch (shape) {
    case 'palha':
    case 'sol':
      return 0.32;
    case 'panama':
    case 'bucket':
      return 0.34;
    case 'bone':
    case 'viseira':
      return 0.3;
    default:
      return 0.16;
  }
}

/** Top of the hat above the band (for nameplates). */
export function hatHeight(shape: HatDef['shape']): number {
  switch (shape) {
    case 'cartola':
      return 17.5;
    case 'chef':
      return 8.6;
    case 'gorro':
      return 11;
    case 'capacete':
    case 'bucket':
    case 'panama':
    case 'palha':
    case 'sol':
      return 8;
    default:
      return 7;
  }
}

const o = (h: HatCtx, x: Partial<PaintOpts> = {}): PaintOpts => ({ L: h.L, rim: h.rim, lw: 0.5, rimA: 0.6, ...x });

/** A brim as an ellipse ring seen from the iso camera; `droop` lowers the front edge. */
function brimPts(rx: number, ry: number, cy: number, droop: number, wave = 0, n = 28): P[] {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = wave ? Math.sin(a * 5) * wave : 0;
    const front = Math.max(0, Math.sin(a));
    pts.push([Math.cos(a) * (rx + w) + 0.4, cy + Math.sin(a) * (ry + w * 0.4) + front * droop]);
  }
  return pts;
}

function crownPts(w: number, top: number, taper: number, dent = 0): P[] {
  return [
    [-w, 0.4],
    [-w * taper, top + 2.4],
    [-w * taper * 0.55, top + 0.3],
    [0.3, top + dent],
    [w * taper * 0.6, top + 0.3],
    [w * taper, top + 2.4],
    [w + 0.2, 0.2],
    [0.4, 1.2],
  ];
}

export function drawHat(ctx: Ctx, hat: HatDef, h: HatCtx) {
  const c = tone(hat.color);
  const acc = tone(hat.accent);
  const f = h.front ? 1 : -1;
  switch (hat.shape) {
    case 'bone':
      return cap(ctx, h, c, acc, f);
    case 'palha':
      return straw(ctx, h, c, acc);
    case 'gorro':
      return beanie(ctx, h, c, acc);
    case 'viseira':
      return visor(ctx, h, c, acc, f);
    case 'boina':
      return beret(ctx, h, c, acc);
    case 'sol':
      return sunHat(ctx, h, c, acc);
    case 'bucket':
      return bucket(ctx, h, c, acc);
    case 'capacete':
      return helmet(ctx, h, c, acc, f);
    case 'panama':
      return panama(ctx, h, c, acc);
    case 'flores':
      return flowers(ctx, h, hat);
    case 'chef':
      return chef(ctx, h, c, acc);
    case 'cartola':
      return topHat(ctx, h, c, acc);
  }
}

function capBrim(ctx: Ctx, h: HatCtx, c: Tone, f: number) {
  if ((h.turn ?? 1) < 0.5) {
    // Brim pointing at the camera
    const fp: P[] = [
      [-6.6, -0.8],
      [6.8, -0.8],
      [7.8, 1.2],
      [4.4, 3.4],
      [0.2, 3.9],
      [-4, 3.4],
      [-7.4, 1.2],
    ];
    paint(ctx, () => smoothClosed(ctx, fp, 0.8), c, ptsBox(fp), o(h, { top: 0.22 }));
    line(ctx, [[-6.6, 1.8], [0.2, 3.3], [6.8, 1.8]], rgba(c.deep, 0.8), 0.6);
    ctx.setLineDash([0.6, 0.6]);
    line(ctx, [[-5.6, 0.6], [0.2, 2.2], [5.8, 0.6]], rgba(c.hi, 0.7), 0.3);
    ctx.setLineDash([]);
    return;
  }
  const pts: P[] =
    f > 0
      ? [
          [2.4, -0.9],
          [6.8, -1.1],
          [10.2, 0.2],
          [12.4, 2.2],
          [10.6, 3.2],
          [6.4, 2.4],
          [2.6, 1.2],
        ]
      : [
          [2.6, -1.2],
          [6.8, -2.4],
          [10.6, -3.4],
          [12, -2.2],
          [9.6, -0.4],
          [6, 0.6],
          [2.8, 0.8],
        ];
  const under = tone(c.lo);
  paint(ctx, () => smoothClosed(ctx, pts, 0.8), f > 0 ? c : under, ptsBox(pts), o(h, { top: 0.2 }));
  if (f > 0) {
    line(ctx, [[3.4, 1.4], [7, 2.8], [10.6, 3.2]], rgba(c.deep, 0.8), 0.7);
    ctx.setLineDash([0.6, 0.6]);
    line(ctx, [[3.4, -0.2], [7, -0.2], [10.2, 1], [11.4, 2.2]], rgba(c.hi, 0.7), 0.3);
    ctx.setLineDash([]);
  }
}

function cap(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone, f: number) {
  if (f < 0) capBrim(ctx, h, c, f);
  const dome: P[] = [
    [-7.5, 1],
    [-7.4, -3.6],
    [-3.6, -7.3],
    [1, -7.8],
    [5.2, -6.4],
    [7.7, -2.4],
    [7.6, 0.8],
    [0.4, 1.6],
  ];
  paint(ctx, () => smoothClosed(ctx, dome, 0.9), c, ptsBox(dome), o(h, { top: 0.22, fall: 0.2 }));
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, dome, 0.9);
  ctx.clip();
  for (const sx of [-4.2, 0.9, 5.2]) line(ctx, [[0.8, -7.6], [sx * 0.6 + 0.6, -4], [sx, 1.2]], rgba(c.deep, 0.55), 0.35);
  glow(ctx, -2.2 * -h.L, -5.2, 3.6, 2, c.hi, 0.5);
  if (f > 0) {
    // Front panel emblem: a small ipê flower
    const ex = (h.turn ?? 1) < 0.5 ? 0.3 : 4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      glow(ctx, ex + Math.cos(a) * 0.8, -3.2 + Math.sin(a) * 0.8, 0.8, 0.8, acc.base, 1);
    }
    glow(ctx, ex, -3.2, 0.45, 0.45, acc.deep, 1);
  } else {
    // Snapback opening + strap
    const op: P[] = [
      [-6.6, 1.1],
      [-5.6, -1.8],
      [-3.8, -1.8],
      [-3, 1.2],
    ];
    ctx.beginPath();
    roundPoly(ctx, op, [0.4, 1.4, 1.4, 0.4]);
    ctx.fillStyle = c.deep;
    ctx.fill();
    line(ctx, [[-6.4, 0], [-3.2, 0]], acc.base, 0.8, false);
  }
  ctx.restore();
  glow(ctx, 0.8, -7.6, 0.8, 0.5, c.hi, 0.9);
  ctx.beginPath();
  ctx.arc(0.8, -7.7, 0.75, 0, Math.PI * 2);
  ctx.fillStyle = acc.base;
  ctx.fill();
  if (f > 0) capBrim(ctx, h, c, f);
}

function straw(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  // Worn tipped back so the brim frames the face instead of hiding the eyes
  const brim = brimPts(14.8, 3.4, -1.1, 0.3, 0.18);
  paint(ctx, () => smoothClosed(ctx, brim, 0.9), c, ptsBox(brim), o(h, { top: 0.2 }));
  weave(ctx, brim, c, 14.8, 3.4, -1.1);
  // Underside lip at the front edge
  line(ctx, brim.slice(2, 13).map(([x, y]) => [x, y + 0.2] as P), rgba(c.deep, 0.75), 0.7);
  const crown = crownPts(6.7, -7.4, 0.86, 1.2);
  paint(ctx, () => smoothClosed(ctx, crown, 0.8), tone(mix(c.base, '#fff3dc', 0.06)), ptsBox(crown), o(h, { fall: 0.2 }));
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, crown, 0.8);
  ctx.clip();
  for (let i = 0; i < 7; i++) line(ctx, [[-7, -6.4 + i * 1.1], [0, -5.8 + i * 1.1], [7, -6.4 + i * 1.1]], rgba(c.lo, 0.5), 0.3);
  line(ctx, [[0.3, -6.4], [0.5, -3.6]], rgba(c.deep, 0.6), 0.5);
  ctx.restore();
  // Ribbon band + knot
  const band: P[] = [
    [-6.9, -2.4],
    [0.4, -1.6],
    [7.1, -2.6],
    [7.2, -0.6],
    [0.4, 0.6],
    [-7, -0.4],
  ];
  paint(ctx, () => roundPoly(ctx, band, 0.8), acc, ptsBox(band), o(h, { lw: 0.4 }));
  glow(ctx, -6.2, -1.2, 1.2, 1, acc.hi, 0.9);
}

function weave(ctx: Ctx, brim: P[], c: Tone, rx: number, ry: number, cy: number) {
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, brim, 0.9);
  ctx.clip();
  for (let r = 0.45; r < 1; r += 0.13) {
    ctx.beginPath();
    ctx.ellipse(0.4, cy, rx * r, ry * r, 0, 0, Math.PI * 2);
    ctx.setLineDash([0.9, 0.7]);
    ctx.strokeStyle = rgba(c.lo, 0.45);
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function beanie(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  const dome: P[] = [
    [-7.6, 0],
    [-7.8, -5],
    [-4.8, -9.4],
    [-0.6, -10.4],
    [4, -9.2],
    [7.2, -5.2],
    [7.6, 0],
  ];
  paint(ctx, () => smoothClosed(ctx, dome, 0.9), c, ptsBox(dome), o(h, { top: 0.16 }));
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, dome, 0.9);
  ctx.clip();
  for (const y of [-7.4, -4.2]) {
    ctx.beginPath();
    ctx.ellipse(0, y + 2.4, 9.4, 3.4, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.strokeStyle = acc.base;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Knit texture
  for (let i = 0; i < 40; i++) {
    const x = -7 + rnd(i, 61) * 14;
    const y = -9.4 + rnd(i, 62) * 9;
    line(ctx, [[x - 0.35, y - 0.3], [x, y + 0.2], [x + 0.35, y - 0.3]], rgba(c.lo, 0.4), 0.25, false);
  }
  ctx.restore();
  // Folded cuff (ribbed)
  const cuff: P[] = [
    [-8, -2.4],
    [0.4, -1.4],
    [8, -2.6],
    [8.2, 1],
    [0.4, 2.4],
    [-8.2, 1.2],
  ];
  paint(ctx, () => roundPoly(ctx, cuff, 1.2), c, ptsBox(cuff), o(h, { top: 0.1, fall: 0.25 }));
  for (let i = -7; i <= 7; i++) line(ctx, [[i * 1.05, -2 + Math.abs(i) * 0.02 + (i > 0 ? -0.1 : 0)], [i * 1.08, 1.6 - Math.abs(i) * 0.08]], rgba(c.lo, 0.55), 0.3, false);
  // Pompom
  const px = -1.2;
  const py = -11.2;
  const pom: P[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = 2.9 + rnd(i, 71) * 0.7;
    pom.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr]);
  }
  paint(ctx, () => smoothClosed(ctx, pom, 1.1), acc, ptsBox(pom), o(h, { lw: 0.4, top: 0.25 }));
  for (let i = 0; i < 10; i++) line(ctx, [[px + (rnd(i, 72) - 0.5) * 4, py + (rnd(i, 73) - 0.5) * 4], [px + (rnd(i, 74) - 0.5) * 4.4, py + (rnd(i, 75) - 0.5) * 4.4]], rgba(acc.lo, 0.5), 0.25, false);
}

function visor(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone, f: number) {
  if (f < 0) capBrim(ctx, h, c, f);
  const band: P[] = [
    [-7.5, -2.6],
    [-3.6, -2.2],
    [0.4, -1.6],
    [4.6, -2],
    [7.6, -2.8],
    [7.7, 0.4],
    [0.4, 1.4],
    [-7.6, 0.6],
  ];
  paint(ctx, () => smoothClosed(ctx, band, 0.7), c, ptsBox(band), o(h, { top: 0.2 }));
  line(ctx, [[-7, 0.2], [0.4, 1], [7.2, -0.1]], acc.base, 0.8);
  ctx.beginPath();
  ctx.roundRect(-1.6, -1.6, 3, 1.6, 0.5);
  ctx.fillStyle = acc.base;
  ctx.fill();
  if (f > 0) capBrim(ctx, h, c, f);
}

function beret(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  ctx.save();
  ctx.rotate(-0.14);
  const pts: P[] = [
    [-10, -3],
    [-8.6, -6.6],
    [-3, -8.6],
    [3.8, -8.2],
    [8.6, -5.4],
    [8.8, -2],
    [5, 0],
    [-2, 0.4],
    [-8.2, -0.8],
  ];
  paint(ctx, () => smoothClosed(ctx, pts, 1), c, ptsBox(pts), o(h, { top: 0.18, fall: 0.2 }));
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, pts, 1);
  ctx.clip();
  glow(ctx, -2 * -h.L, -6.4, 5, 2, c.hi, 0.35);
  line(ctx, [[-9.4, -2.4], [-2, -0.4], [7.8, -1.8]], rgba(c.deep, 0.55), 0.7);
  ctx.restore();
  // Head band peeking under the felt
  line(ctx, [[-6.6, 0.4], [0, 1.2], [6.4, 0.4]], acc.base, 1.1);
  // Stalk
  line(ctx, [[-0.6, -8.4], [-0.2, -10]], c.lo, 1, false);
  ctx.restore();
}

function sunHat(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  const wob = Math.sin(h.t * 2) * 0.4;
  const brim = brimPts(16.4, 3.9, -0.9 + wob * 0.3, 0.8 + wob, 0.55, 36);
  paint(ctx, () => smoothClosed(ctx, brim, 0.9), c, ptsBox(brim), o(h, { top: 0.2 }));
  weave(ctx, brim, c, 16.4, 3.9, -0.9);
  line(ctx, brim.slice(3, 16).map(([x, y]) => [x, y + 0.3] as P), rgba(c.deep, 0.7), 0.7);
  const crown = crownPts(6.8, -6.6, 0.9, -0.6);
  paint(ctx, () => smoothClosed(ctx, crown, 0.9), c, ptsBox(crown), o(h, { fall: 0.2, top: 0.12 }));
  const band: P[] = [
    [-6.9, -2.2],
    [0.4, -1.4],
    [7, -2.4],
    [7.1, -0.4],
    [0.4, 0.6],
    [-7, -0.3],
  ];
  paint(ctx, () => roundPoly(ctx, band, 0.8), acc, ptsBox(band), o(h, { lw: 0.4 }));
  // Bow
  for (const s of [-1, 1]) {
    const bp: P[] = [
      [5.6, -1.2],
      [5.6 + s * 1.6 + 1, -3],
      [5.6 + s * 2.4 + 1.2, -0.8],
      [5.6 + s * 1.4 + 0.6, 0.6],
    ];
    paint(ctx, () => smoothClosed(ctx, bp, 0.8), acc, ptsBox(bp), o(h, { lw: 0.35 }));
  }
}

function bucket(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  const brim: P[] = [
    [-7.4, -1.2],
    [0.4, -0.4],
    [7.4, -1.4],
    [11.2, 2.8],
    [6, 5.2],
    [0.4, 5.6],
    [-5.4, 5],
    [-10.6, 2.4],
  ];
  paint(ctx, () => smoothClosed(ctx, brim, 0.7), tone(c.lo), ptsBox(brim), o(h, { top: 0.1 }));
  const brimTop: P[] = [
    [-7.4, -1.2],
    [0.4, -0.4],
    [7.4, -1.4],
    [11, 2.2],
    [6, 3.6],
    [0.4, 4],
    [-5.4, 3.4],
    [-10.4, 1.8],
  ];
  paint(ctx, () => smoothClosed(ctx, brimTop, 0.7), c, ptsBox(brimTop), o(h, { top: 0.16, lw: 0 }));
  ctx.setLineDash([0.7, 0.6]);
  for (const k of [0.45, 0.75]) line(ctx, [[-10.4 + 3 * k, 1.8 - 0.6 * k], [-5.4 + 1.2 * k, 3.4 - 2.6 * k + 1.4], [0.4, 4 - 3.2 * k + 1.2], [6 - 1 * k, 3.6 - 2.8 * k + 1.2], [11 - 3.2 * k, 2.2 - 0.6 * k]], rgba(c.deep, 0.6), 0.3);
  ctx.setLineDash([]);
  const crown: P[] = [
    [-7.2, -0.4],
    [-5.8, -6.6],
    [0.4, -7.6],
    [6.4, -6.8],
    [7.4, -0.6],
    [0.4, 0.4],
  ];
  paint(ctx, () => smoothClosed(ctx, crown, 0.6), c, ptsBox(crown), o(h, { top: 0.2, fall: 0.15 }));
  ctx.beginPath();
  ctx.ellipse(0.4, -6.9, 5.8, 1.2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(c.lo, 0.8);
  ctx.lineWidth = 0.4;
  ctx.stroke();
  line(ctx, [[-7, -1.6], [0.4, -0.8], [7.2, -1.8]], acc.base, 0.9);
  glow(ctx, -3 * -h.L, -4, 2.4, 2.4, c.hi, 0.35);
}

function helmet(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone, f: number) {
  const shell: P[] = [
    [-8.4, 1.4],
    [-8.6, -3.8],
    [-5, -8.4],
    [0.6, -9.2],
    [5.8, -7.4],
    [8.8, -3],
    [9.8, 0.4],
    [7.2, 1.6],
    [0.4, 1],
  ];
  paint(ctx, () => smoothClosed(ctx, shell, 0.8), c, ptsBox(shell), o(h, { top: 0.28, fall: 0.18 }));
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, shell, 0.8);
  ctx.clip();
  // Vents
  for (let i = 0; i < 4; i++) {
    const y = -7.4 + i * 1.9;
    const v: P[] = [
      [-4.6 + i * 0.4, y],
      [4 - i * 0.3, y - 0.5],
      [4.4 - i * 0.3, y + 0.9],
      [-4.4 + i * 0.4, y + 1.2],
    ];
    ctx.beginPath();
    roundPoly(ctx, v, 0.6);
    ctx.fillStyle = c.deep;
    ctx.fill();
  }
  line(ctx, [[-8.2, -1.2], [0, -2.4], [9.2, -1.2]], acc.base, 1.2);
  glow(ctx, -2.4 * -h.L, -7, 3.4, 1.4, '#ffffff', 0.45);
  ctx.restore();
  // Strap from the temple to under the chin
  if (f > 0 && !h.icon && (h.turn ?? 1) < 0.5) {
    for (const s of [-1, 1]) line(ctx, [[s * 6.6, 1.6], [s * 5.4, 6.6], [s * 1.2, 11.2]], '#26252a', 0.55);
  } else if (f > 0 && !h.icon) {
    line(ctx, [[5.8, 1.6], [4.8, 6.6], [3.2, 11.2]], '#26252a', 0.6);
    line(ctx, [[-3.2, 1.8], [-1.6, 7.4], [2.2, 11.4]], '#26252a', 0.55);
    ctx.beginPath();
    ctx.roundRect(1.8, 10.4, 1.8, 1.2, 0.3);
    ctx.fillStyle = '#56545c';
    ctx.fill();
  }
}

function panama(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  const brim = brimPts(11.8, 3.2, -0.4, 0.9, 0.05);
  paint(ctx, () => smoothClosed(ctx, brim, 0.9), c, ptsBox(brim), o(h, { top: 0.22 }));
  weave(ctx, brim, c, 11.8, 3.2, -0.4);
  line(ctx, brim.slice(3, 12).map(([x, y]) => [x, y + 0.2] as P), rgba(c.deep, 0.7), 0.6);
  const crown: P[] = [
    [-6.4, -0.4],
    [-6, -5.4],
    [-3.6, -8.2],
    [-0.6, -7],
    [2.4, -8.4],
    [5.6, -6.2],
    [6.6, -0.6],
    [0.4, 0.6],
  ];
  paint(ctx, () => smoothClosed(ctx, crown, 0.8), c, ptsBox(crown), o(h, { top: 0.2, fall: 0.15 }));
  // Center dent + front pinch
  line(ctx, [[-2.6, -7.4], [0, -6.2], [2.2, -7.6]], rgba(c.deep, 0.65), 0.5);
  line(ctx, [[3.6, -7.4], [4.6, -5], [4.2, -3.4]], rgba(c.lo, 0.7), 0.45);
  const band: P[] = [
    [-6.3, -2.6],
    [0.4, -1.6],
    [6.6, -2.8],
    [6.7, -0.6],
    [0.4, 0.6],
    [-6.4, -0.4],
  ];
  paint(ctx, () => roundPoly(ctx, band, 0.6), acc, ptsBox(band), o(h, { lw: 0.3, rimA: 0.4 }));
  line(ctx, [[-5.4, -1.4], [-4.2, -0.2]], acc.hi, 0.7, false);
}

function flowers(ctx: Ctx, h: HatCtx, hat: HatDef) {
  const cols = [hat.color, hat.accent, '#e8a0b0', '#f4efe6', '#8a64b0', hat.color, '#e07a5f'];
  const leaf = tone('#4f8a4a');
  const ring = (a: number): P => [Math.cos(a) * 7.6 + 0.4, -1.4 + Math.sin(a) * 2.8];
  // Back half first (smaller, shaded), then leaves, then the front flowers
  const draw = (a: number, i: number, back: boolean) => {
    const [x, y] = ring(a);
    const s = back ? 1.25 : 1.6 + (i % 3) * 0.2;
    const col = tone(cols[i % cols.length]);
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2 + i;
      const px = x + Math.cos(pa) * s * 0.85;
      const py = y + Math.sin(pa) * s * 0.7;
      ctx.beginPath();
      ctx.ellipse(px, py, s * 0.75, s * 0.55, pa, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(px - h.L * -0.4, py - 0.4, 0, px, py, s);
      g.addColorStop(0, back ? col.base : col.hi);
      g.addColorStop(1, back ? col.lo : col.base);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(col.line, 0.6);
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
    glow(ctx, x, y, s * 0.45, s * 0.45, '#d4a017', 1);
  };
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    draw(a, i, true);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const [x, y] = ring(a);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + 0.6);
    paint(ctx, () => ctx.ellipse(0, 0, 1.9, 0.8, 0, 0, Math.PI * 2), leaf, { x0: -2, x1: 2, y0: -1, y1: 1 }, o(h, { lw: 0.3, rimA: 0.2 }));
    ctx.restore();
  }
  for (let i = 0; i < 7; i++) {
    const a = 0.15 + (i / 6) * (Math.PI - 0.3);
    draw(a, i + 3, false);
  }
}

function chef(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  // A padaria toque: pleated and soft-topped, kept low so it reads baker, not costume. v2 shortens it
  // again (parked Art #4) so Carlos's face + apron win the silhouette.
  ctx.save();
  ctx.scale(1, 0.68);
  const white = tone('#fbfaf6');
  const shadow = tone('#e6e4de');
  // Pleated body
  const body: P[] = [
    [-7.4, -1.2],
    [-8.9, -6.8],
    [-8.4, -10.4],
    [-4.4, -12.2],
    [0.6, -12.6],
    [5.4, -12],
    [9, -10],
    [9.2, -6.6],
    [7.6, -1.4],
  ];
  paint(ctx, () => smoothClosed(ctx, body, 0.7), white, ptsBox(body), { ...o(h, { top: 0.1 }), rimA: 0.5 });
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, body, 0.7);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    const x = i * 2.3 + 0.4;
    line(ctx, [[x * 0.95, -1.4], [x * 1.14, -7], [x * 1.1, -12.4]], rgba(shadow.lo, 0.7), 0.5);
    line(ctx, [[x * 0.95 + 0.6, -1.4], [x * 1.14 + 0.6, -7], [x * 1.1 + 0.5, -11.8]], rgba('#ffffff', 0.8), 0.35);
  }
  // Soft puffed crown: the pleats gather into a domed top
  for (let i = -3; i <= 3; i++) glow(ctx, i * 2.5 + 0.4, -11.4 + Math.abs(i) * 0.35, 1.5, 1, shadow.lo, 0.35);
  glow(ctx, -2.4, -10.8, 4, 1.6, '#ffffff', 0.7);
  glow(ctx, 6.4 * -h.L * -1, -8, 3, 6, shadow.lo, 0.4);
  ctx.restore();
  const band: P[] = [
    [-7.6, -3.2],
    [0.4, -2.4],
    [7.8, -3.4],
    [7.8, 0.6],
    [0.4, 1.6],
    [-7.6, 0.6],
  ];
  paint(ctx, () => roundPoly(ctx, band, 1), tone(acc.base), ptsBox(band), o(h, { top: 0.12 }));
  line(ctx, [[-7.2, -1.2], [0.4, -0.3], [7.4, -1.4]], rgba(tone(acc.base).lo, 0.6), 0.35);
  ctx.restore();
  void c;
}

function topHat(ctx: Ctx, h: HatCtx, c: Tone, acc: Tone) {
  const brim: P[] = [
    [-10.6, -2],
    [-8.4, -1.2],
    [0.4, -0.2],
    [9.4, -1.4],
    [11.2, -2.6],
    [10.6, 0.6],
    [6, 2.8],
    [0.4, 3.2],
    [-5.6, 2.6],
    [-10, 0.6],
  ];
  paint(ctx, () => smoothClosed(ctx, brim, 0.7), tone(c.lo), ptsBox(brim), o(h, { top: 0.2 }));
  const crown: P[] = [
    [-6, 0.2],
    [-6.6, -16.2],
    [0.4, -17.2],
    [7.2, -16.4],
    [6.4, 0.1],
    [0.4, 1],
  ];
  paint(ctx, () => roundPoly(ctx, crown, [1, 1.6, 3, 1.6, 1, 3]), c, ptsBox(crown), o(h, { top: 0.12 }));
  ctx.save();
  ctx.beginPath();
  roundPoly(ctx, crown, [1, 1.6, 3, 1.6, 1, 3]);
  ctx.clip();
  // Satin sheen stripe
  const sx = -h.L * -3;
  const g = ctx.createLinearGradient(sx - 2, 0, sx + 2, 0);
  g.addColorStop(0, rgba(c.hi, 0));
  g.addColorStop(0.5, rgba(c.hi, 0.6));
  g.addColorStop(1, rgba(c.hi, 0));
  ctx.fillStyle = g;
  ctx.fillRect(sx - 2, -17, 4, 17);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0.4, -16.4, 6.8, 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.hi;
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 0.45;
  ctx.stroke();
  // Sequin band + tucked plume
  const band: P[] = [
    [-6.1, -4.4],
    [0.4, -3.4],
    [6.5, -4.6],
    [6.4, -1],
    [0.4, 0],
    [-6.1, -0.9],
  ];
  paint(ctx, () => roundPoly(ctx, band, 0.5), acc, ptsBox(band), o(h, { lw: 0.35 }));
  const tw = (Math.sin(h.t * 3) + 1) / 2;
  for (let i = 0; i < 7; i++) {
    const x = -5 + i * 1.8;
    const on = (i + Math.round(tw * 3)) % 3 === 0;
    glow(ctx, x, -2.2 + Math.abs(x) * 0.05, on ? 0.9 : 0.5, on ? 0.9 : 0.5, on ? '#fff6d0' : acc.hi, on ? 1 : 0.7);
  }
  const plume: P[] = [
    [5.2, -3.4],
    [7.6, -9],
    [9.6, -12.8],
    [9.4, -9.4],
    [7.4, -4],
  ];
  paint(ctx, () => smoothClosed(ctx, plume, 1), tone('#c9582c'), ptsBox(plume), o(h, { lw: 0.35 }));
  line(ctx, [[5.8, -3.6], [8.4, -9.4], [9.4, -12.4]], rgba('#fff6e6', 0.6), 0.3);
}

/** Shop icon: the hat on an invisible head with a soft shadow, 64×64 box. */
export function drawHatIconArt(ctx: Ctx, hat: HatDef) {
  ctx.save();
  ctx.translate(32, 40);
  const big = hat.shape === 'cartola' || hat.shape === 'chef';
  const s = hat.shape === 'sol' || hat.shape === 'palha' ? 1.62 : big ? 1.75 : 2.05;
  ctx.scale(s, s);
  glow(ctx, 0.4, 3.6, 12, 3, '#3a2216', 0.28);
  ctx.translate(0, big ? 4 : 1.5);
  drawHat(ctx, hat, { L: -1, rim: '#ffcf8c', front: true, t: 0, icon: true });
  ctx.restore();
}
