import type { FaceStyle, HairStyle } from '@tudobem/shared';
import type { Ctx } from '../draw';
import { mix, rgba, tone, type Tone } from './color';
import type { Look } from './body';
import type { Rig } from './rig';
import { glow, line, paint, ptsBox, rnd, smoothClosed, type P } from './shape';

/**
 * Head-local space: origin = head center, facing +x, ~12.6 wide × 14.6 high (scaled by HEAD_S).
 * Three views: `q` three-quarter front (in game), `b` three-quarter back, `f` straight-on front
 * (creator). Layer order (TB Art lock): skull + ears → hair → face → hat.
 */
const W = 6.3;
const T = 7.4;
const B = 7.2;

export type View = 'q' | 'b' | 'f';
export const viewOf = (r: Rig): View => (!r.front ? 'b' : r.turn < 0.5 ? 'f' : 'q');

interface FaceSpec {
  jaw: number;
  chin: number;
  eyeRy: number;
  eyeRx: number;
  brow: number;
  browLift: number;
  lines: boolean;
}

const FACES: Record<FaceStyle, FaceSpec> = {
  suave: { jaw: 0.9, chin: 0, eyeRy: 1.02, eyeRx: 0.88, brow: 0.55, browLift: 0, lines: false },
  marcante: { jaw: 1.02, chin: 0.25, eyeRy: 0.86, eyeRx: 0.92, brow: 0.78, browLift: -0.25, lines: false },
  doce: { jaw: 0.82, chin: -0.4, eyeRy: 1.14, eyeRx: 0.92, brow: 0.45, browLift: 0.35, lines: false },
  maduro: { jaw: 0.98, chin: 0.1, eyeRy: 0.84, eyeRx: 0.9, brow: 0.62, browLift: -0.15, lines: true },
};

function headPath(ctx: Ctx, f: FaceSpec, v: View) {
  const j = f.jaw;
  const cb = B + f.chin;
  if (v === 'q') {
    ctx.moveTo(0.2, -T);
    ctx.bezierCurveTo(3.9, -T, W, -4.8, W, -1.3);
    ctx.bezierCurveTo(W, 1.6, W * 0.94, 3.2, 4.6 * j, 4.8);
    ctx.bezierCurveTo(3.9 * j, 6.2, 2.9, cb, 1.5, cb);
    ctx.bezierCurveTo(-0.4, cb, -2.9, 6.3, -4.3 * j, 4.6);
    ctx.bezierCurveTo(-5.8, 2.8, -W - 0.3, 0.6, -W - 0.3, -1.6);
    ctx.bezierCurveTo(-W - 0.3, -5, -3.6, -T, 0.2, -T);
  } else if (v === 'f') {
    ctx.moveTo(0, -T);
    ctx.bezierCurveTo(3.9, -T, W, -4.7, W, -1.2);
    ctx.bezierCurveTo(W, 1.9, W * 0.92, 3.6, 4.2 * j, 5.2);
    ctx.bezierCurveTo(3.2 * j, 6.6, 1.7, cb, 0, cb);
    ctx.bezierCurveTo(-1.7, cb, -3.2 * j, 6.6, -4.2 * j, 5.2);
    ctx.bezierCurveTo(-W * 0.92, 3.6, -W, 1.9, -W, -1.2);
    ctx.bezierCurveTo(-W, -4.7, -3.9, -T, 0, -T);
  } else {
    ctx.moveTo(-0.4, -T);
    ctx.bezierCurveTo(3.6, -T, W + 0.2, -4.6, W + 0.1, -1.2);
    ctx.bezierCurveTo(W, 2, 5.2, 4.2, 3.6 * j, 6);
    ctx.bezierCurveTo(2.6, 6.8, 0.6, 6.6, -1.6, 6.4);
    ctx.bezierCurveTo(-4.2, 5.8, -W - 0.4, 2.8, -W - 0.4, -1.4);
    ctx.bezierCurveTo(-W - 0.4, -5, -3.8, -T, -0.4, -T);
  }
  ctx.closePath();
}

const HEAD_BOX = { x0: -W - 0.5, x1: W + 0.3, y0: -T, y1: B + 0.5 };

export function faceSpec(face: FaceStyle | undefined) {
  return FACES[face ?? 'suave'] ?? FACES.suave;
}

/** Mirror a right-half outline (top center → … → center) into a closed symmetric shape. */
function sym(half: P[]): P[] {
  const mid = half.slice(1, -1).reverse().map(([x, y]) => [-x, y] as P);
  return [...half, ...mid];
}

function ears(v: View): number[] {
  return v === 'q' ? [-4.3] : v === 'b' ? [4.1] : [-6.05, 6.05];
}

function drawEar(ctx: Ctx, k: Look, ex: number, v: View) {
  const s = k.skin;
  const tilt = v === 'f' ? (ex < 0 ? 0.12 : -0.12) : v === 'q' ? 0.2 : -0.2;
  const rx = v === 'f' ? 0.95 : 1.05;
  paint(ctx, () => ctx.ellipse(ex, 1.2, rx, 1.7, tilt, 0, Math.PI * 2), s, { x0: ex - 1.4, x1: ex + 1.4, y0: -1.2, y1: 3 }, { L: k.L, rim: k.rim, lw: v === 'f' ? 0.35 : 0, rimA: 0.3 });
  const inner = v === 'f' ? (ex < 0 ? -1 : 1) : v === 'q' ? -1 : 1;
  ctx.beginPath();
  ctx.ellipse(ex, 1.2, rx, 1.7, tilt, inner < 0 ? Math.PI * 0.55 : -Math.PI * 0.45, inner < 0 ? Math.PI * 1.45 : Math.PI * 0.45);
  ctx.strokeStyle = rgba(s.line, 0.55);
  ctx.lineWidth = 0.3;
  ctx.stroke();
  glow(ctx, ex - inner * 0.2, 1.3, 0.5, 0.9, s.lo, 0.6);
}

/** Skull + ears (body/skin layer). Called inside the head transform. */
export function drawHead(ctx: Ctx, r: Rig, k: Look) {
  const f = faceSpec(k.a.face);
  const s = k.skin;
  const v = viewOf(r);
  // Front view: ears stick out past the skull, so they go first.
  if (v === 'f') for (const ex of ears(v)) drawEar(ctx, k, ex, v);
  paint(ctx, () => headPath(ctx, f, v), s, HEAD_BOX, { L: k.L, rim: k.rim, lw: 0.45, rimA: 0.6, top: 0.08 });
  ctx.save();
  ctx.beginPath();
  headPath(ctx, f, v);
  ctx.clip();
  const sh = -k.L;
  if (v === 'q') {
    // Subsurface warmth at the cheek, soft form turn toward the jaw, cheekbone plane
    glow(ctx, -1.2, 2.8, 2.2, 1.6, '#e0685c', 0.16);
    glow(ctx, 4.4, 2.4, 1.4, 1.2, '#e0685c', 0.12);
    glow(ctx, -4.8, 3.6, 3.2, 3.4, s.lo, 0.35);
    glow(ctx, 4.6, 3.6, 1.8, 1.4, s.lo, 0.3);
    glow(ctx, 1.4, 7.4, 3.6, 1.2, s.lo, 0.35);
    glow(ctx, -1.2, -4.8, 3.6, 1.8, '#fff4ea', 0.16);
  } else if (v === 'f') {
    glow(ctx, -3.1, 2.8, 1.9, 1.4, '#e0685c', 0.16);
    glow(ctx, 3.1, 2.8, 1.9, 1.4, '#e0685c', 0.16);
    glow(ctx, sh * 4.9, 3.2, 2.4, 3.6, s.lo, 0.35);
    glow(ctx, 0, 7.6, 4, 1.2, s.lo, 0.35);
    glow(ctx, -sh * 1.8, -4.8, 3.4, 1.8, '#fff4ea', 0.18);
  } else {
    glow(ctx, 4.8, 2.6, 1.6, 1.4, '#e0685c', 0.1);
  }
  ctx.restore();
  if (v !== 'f') for (const ex of ears(v)) drawEar(ctx, k, ex, v);
}

/** Face features, glasses, facial hair and earrings (face layer, above the hair). */
export function drawFace(ctx: Ctx, r: Rig, k: Look) {
  const f = faceSpec(k.a.face);
  const v = viewOf(r);
  if (k.a.extra === 'brincos') {
    for (const ex of ears(v)) {
      const lx = ex + (v === 'q' ? 0.2 : v === 'b' ? -0.2 : 0);
      ctx.beginPath();
      ctx.arc(lx, 3.5, 0.75, 0, Math.PI * 2);
      ctx.strokeStyle = '#d6a53a';
      ctx.lineWidth = 0.45;
      ctx.stroke();
      glow(ctx, lx - 0.4, 3.1, 0.35, 0.35, '#fff1c0', 0.9);
    }
  }
  if (v === 'b') {
    if (k.a.extra === 'barba') {
      ctx.save();
      clipHead(ctx, k.a.face, 'b');
      const bt = tone(mix(k.hair.base, k.skin.base, 0.15), 'hair');
      ctx.beginPath();
      ctx.moveTo(W + 1, 0.4);
      ctx.bezierCurveTo(W, 4, 3, 7.4, -1, 7);
      ctx.lineTo(1.6, 3.6);
      ctx.bezierCurveTo(3.4, 3.4, 4.6, 1.8, W + 1, 0.4);
      ctx.fillStyle = rgba(bt.base, 0.9);
      ctx.fill();
      ctx.restore();
    }
    return;
  }
  features(ctx, r, k, f, v);
}

function features(ctx: Ctx, r: Rig, k: Look, f: FaceSpec, v: View) {
  const s = k.skin;
  const brow = tone(mix(k.hair.base, '#1a1010', 0.28), 'hair');
  const iris = '#2b1a14';
  const q = v === 'q';
  // [x, width, brow inner-end direction]
  const eyesAt: [number, number, number][] = q
    ? [
        [-0.9, 1, 1],
        [3.55, 0.78, -1],
      ]
    : [
        [-2.3, 0.95, 1],
        [2.3, 0.95, -1],
      ];
  const gaze = q ? 0.12 : 0;
  const mouthX = q ? 0 : -1.55;
  const eyeY = 0.4;
  const happy = r.eyes === 'happy';
  const closed = r.eyes === 'closed';

  for (const [x, w] of eyesAt) glow(ctx, x + 0.05, eyeY - 0.6, 1.9 * w, 1, s.lo, 0.26);

  const eye = (x: number, w: number) => {
    const rx = f.eyeRx * w;
    const ry = f.eyeRy;
    if (closed || happy) {
      ctx.beginPath();
      if (happy) ctx.arc(x, eyeY + 0.7, rx * 1.1, Math.PI * 1.1, Math.PI * 1.9);
      else ctx.ellipse(x, eyeY + 0.2, rx * 1.1, 0.35, 0, 0, Math.PI);
      ctx.strokeStyle = s.line;
      ctx.lineWidth = 0.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }
    // Sclera → iris (with a warm lower ring) → pupil catchlight → soft upper lid / lash line
    ctx.beginPath();
    ctx.ellipse(x, eyeY, rx * 1.18, ry * 0.92, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f1ea';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * gaze, eyeY + 0.05, rx * 0.86, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = iris;
    ctx.fill();
    glow(ctx, x + w * gaze, eyeY + 0.35, rx * 0.7, ry * 0.5, '#6b4630', 0.7);
    ctx.beginPath();
    ctx.arc(x - 0.28 * w + gaze, eyeY - 0.38, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Lid shade + lash line
    ctx.beginPath();
    ctx.ellipse(x, eyeY - 0.3, rx * 1.2, ry * 0.7, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = rgba(s.lo, 0.5);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, eyeY - 0.08, rx * 1.3, ry * 0.95, 0, Math.PI * 1.08, Math.PI * 1.98);
    ctx.strokeStyle = '#1e1212';
    ctx.lineWidth = 0.55;
    ctx.lineCap = 'round';
    ctx.stroke();
    if (f.lines) line(ctx, [[x - rx * 1.2, eyeY - ry * 1.1], [x, eyeY - ry * 1.45], [x + rx * 1.2, eyeY - ry * 1.05]], rgba(s.line, 0.45), 0.3);
  };
  for (const [x, w] of eyesAt) eye(x, w);

  // Brows carry the emotion
  const by = eyeY - 2.35 - f.browLift - (r.brows === 'up' ? 0.5 : 0);
  const worried = r.brows === 'worried';
  const soft = r.brows === 'soft';
  for (const [x, w, d] of eyesAt) {
    const outer = x - d * 1.45 * w;
    const inner = x + d * 1.2 * w;
    line(ctx, [[outer, by + (worried ? 0.5 : 0.35)], [x - d * 0.1, by - (soft ? 0.25 : 0.35)], [inner, by + (worried ? -0.45 : 0.05)]], brow.base, f.brow * (w < 0.9 ? 0.85 : 1));
  }

  // Nose: soft planes, never a triangle
  if (q) {
    line(ctx, [[2.3, eyeY + 0.2], [2.9, 1.9], [3.35, 2.95]], rgba(s.lo, 0.8), 0.4);
    glow(ctx, 2.2, 2.9, 1.1, 0.7, s.lo, 0.5);
    line(ctx, [[3.35, 2.95], [2.9, 3.35], [2.3, 3.25]], rgba(s.line, 0.75), 0.4);
    glow(ctx, 2.9, 2.35, 0.5, 0.45, '#fff4ea', 0.45);
  } else {
    const sd = -k.L;
    line(ctx, [[sd * 0.55, eyeY + 0.4], [sd * 0.8, 1.9], [sd * 0.95, 2.8]], rgba(s.lo, 0.6), 0.35);
    glow(ctx, 0, 3.05, 1.25, 0.65, s.lo, 0.42);
    line(ctx, [[-1.05, 3.05], [-0.35, 3.45]], rgba(s.line, 0.6), 0.35, false);
    line(ctx, [[0.35, 3.45], [1.05, 3.05]], rgba(s.line, 0.6), 0.35, false);
    glow(ctx, -sd * 0.2, 2.3, 0.5, 0.45, '#fff4ea', 0.5);
  }

  if (f.lines) {
    const sides = q ? [1] : [-1, 1];
    for (const sd of sides) {
      if (q) line(ctx, [[0.6, 3.6], [0.1, 4.8], [0.5, 5.8]], rgba(s.lo, 0.55), 0.35);
      else line(ctx, [[sd * 1.7, 3.6], [sd * 2.2, 4.8], [sd * 1.9, 5.8]], rgba(s.lo, 0.5), 0.35);
    }
    const outer = eyesAt.map(([x, w, d]) => x - d * 1.6 * w);
    for (const ox of q ? [outer[1] + 0.3] : outer) {
      const d = ox > 0 ? 1 : -1;
      line(ctx, [[ox, eyeY + 0.1], [ox + d * 0.5, eyeY + 0.5]], rgba(s.lo, 0.6), 0.25, false);
      line(ctx, [[ox - d * 0.1, eyeY + 0.8], [ox + d * 0.4, eyeY + 1.2]], rgba(s.lo, 0.5), 0.25, false);
    }
  }

  ctx.save();
  ctx.translate(mouthX, 0);
  if (k.a.extra === 'barba') beard(ctx, k, f, v, mouthX);
  if (k.a.extra === 'bigode' || k.a.extra === 'barba') mustache(ctx, k);

  // Mouth with a soft lower-lip value
  const my = 4.85 + f.chin * 0.3;
  const lip = mix(s.base, '#7a2230', 0.42);
  const lipLine = mix(s.base, '#3a0e16', 0.62);
  ctx.lineCap = 'round';
  switch (r.mouth) {
    case 'open':
    case 'laugh': {
      const h = r.mouth === 'laugh' ? 2.1 : 1.6;
      ctx.beginPath();
      ctx.moveTo(0.1, my - 0.3);
      ctx.quadraticCurveTo(1.6, my - 0.7, 3.1, my - 0.35);
      ctx.quadraticCurveTo(2.2, my + h, 0.9, my + h * 0.8);
      ctx.quadraticCurveTo(0.1, my + h * 0.4, 0.1, my - 0.3);
      ctx.fillStyle = '#5a1a22';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#fbf6f0';
      ctx.fillRect(0, my - 0.8, 3.2, 0.95);
      glow(ctx, 1.6, my + h, 1.3, 0.8, '#c9505a', 0.9);
      ctx.restore();
      break;
    }
    case 'small':
      line(ctx, [[0.9, my + 0.3], [1.6, my + 0.05], [2.4, my + 0.3]], lipLine, 0.45);
      break;
    case 'calm':
      line(ctx, [[0.3, my - 0.05], [1.5, my + 0.5], [2.9, my - 0.05]], lipLine, 0.45);
      glow(ctx, 1.5, my + 1.1, 1, 0.45, lip, 0.35);
      break;
    case 'grin':
      line(ctx, [[0, my - 0.4], [1.5, my + 0.8], [3.1, my - 0.35]], lipLine, 0.55);
      line(ctx, [[0.5, my + 0.05], [1.5, my + 0.55], [2.6, my + 0.05]], '#fbf6f0', 0.35);
      break;
    default:
      line(ctx, [[0.15, my - 0.3], [1.5, my + 0.65], [3, my - 0.25]], lipLine, 0.48);
      glow(ctx, 1.55, my + 1.2, 1, 0.45, lip, 0.4);
      glow(ctx, 0, my - 0.4, 0.4, 0.4, s.lo, 0.5);
      if (!q) glow(ctx, 3.1, my - 0.4, 0.4, 0.4, s.lo, 0.5);
  }
  ctx.restore();

  if (k.a.extra === 'sardas') {
    for (let i = 0; i < 10; i++) {
      const fx = q ? -2.2 + rnd(i, 21) * 6.4 : (rnd(i, 23) > 0.5 ? 1 : -1) * (0.9 + rnd(i, 21) * 3);
      const fy = 1.6 + rnd(i, 22) * 1.6;
      ctx.beginPath();
      ctx.arc(fx, fy, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.deep, 0.5);
      ctx.fill();
    }
  }
  if (k.a.extra === 'oculos') glasses(ctx, eyesAt, eyeY, q);
}

function glasses(ctx: Ctx, eyes: [number, number, number][], ey: number, q: boolean) {
  const frame = '#3a2418';
  ctx.lineWidth = 0.42;
  ctx.strokeStyle = frame;
  for (const [x, w] of eyes) {
    ctx.beginPath();
    ctx.roundRect(x - 1.75 * w, ey - 1.25, 3.5 * w, 2.5, 0.9);
    ctx.stroke();
    line(ctx, [[x - 1.1 * w, ey + 0.8], [x - 0.1 * w, ey - 0.6]], rgba('#ffffff', 0.55), 0.35, false);
  }
  const [a, b] = eyes;
  line(ctx, [[a[0] + 1.75 * a[1], ey - 0.2], [(a[0] + b[0]) / 2, ey - 0.6], [b[0] - 1.75 * b[1], ey - 0.2]], frame, 0.4);
  if (q) line(ctx, [[a[0] - 1.75, ey - 0.3], [-3.3, -0.2]], frame, 0.4, false);
}

function beard(ctx: Ctx, k: Look, f: FaceSpec, v: View, mouthX: number) {
  const bt = tone(mix(k.hair.base, k.skin.base, 0.12), 'hair');
  ctx.save();
  ctx.translate(-mouthX, 0);
  clipHead(ctx, k.a.face, v);
  ctx.beginPath();
  if (v === 'q') {
    ctx.moveTo(-4.4, 1.2);
    ctx.bezierCurveTo(-4.6, 4.2, -2, 8.4, 1.6, 8.6);
    ctx.bezierCurveTo(4.6, 8.4, W + 0.4, 4.4, W + 0.4, 1.6);
    ctx.bezierCurveTo(5, 3.2, 4, 3.8, 3.2, 4);
    ctx.bezierCurveTo(2.4, 6.6, 0.4, 6.8, -0.2, 4.6);
    ctx.bezierCurveTo(-1.8, 4.6, -3.2, 3.4, -4.4, 1.2);
  } else {
    ctx.moveTo(-W - 0.4, 0.6);
    ctx.bezierCurveTo(-W, 5, -3, 8.8, 0, 8.8);
    ctx.bezierCurveTo(3, 8.8, W, 5, W + 0.4, 0.6);
    ctx.bezierCurveTo(4.6, 3, 3.2, 3.9, 1.8, 4);
    ctx.bezierCurveTo(1.2, 6.6, -1.2, 6.6, -1.8, 4);
    ctx.bezierCurveTo(-3.2, 3.9, -4.6, 3, -W - 0.4, 0.6);
  }
  ctx.fillStyle = rgba(bt.base, 0.92);
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    const x = -3.8 + rnd(i, 31) * 9.6 - (v === 'f' ? 1 : 0);
    const y = 2.6 + rnd(i, 32) * 5.4;
    ctx.fillStyle = rgba(rnd(i, 33) > 0.5 ? bt.hi : bt.deep, 0.35);
    ctx.fillRect(x, y, 0.35, 0.35);
  }
  ctx.restore();
}

function mustache(ctx: Ctx, k: Look) {
  const grey = k.a.hairColor === 5;
  const mt = tone(grey ? '#8f8a86' : mix(k.hair.base, '#2a1a14', 0.1), 'hair');
  // Full chevron mustache: thick over the lip, tapering past the mouth corners
  const pts: P[] = [
    [-0.7, 4.9],
    [-0.2, 3.9],
    [0.8, 3.3],
    [1.9, 3.4],
    [2.9, 3.3],
    [3.7, 3.9],
    [3.9, 4.8],
    [3.1, 4.7],
    [1.9, 4.3],
    [0.7, 4.8],
  ];
  paint(ctx, () => smoothClosed(ctx, pts), mt, ptsBox(pts), { L: k.L, rim: k.rim, lw: 0.35, rimA: 0.35, top: 0.15 });
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, pts);
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const x = -0.4 + i * 0.5;
    line(ctx, [[x + 0.2, 3.5], [x - 0.1, 4.7]], rgba(i % 2 ? mt.hi : mt.deep, 0.55), 0.25, false);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- hair

export interface HatFit {
  /** Hat band line + width in head-local space. */
  band: number;
  w: number;
}

/** Hats sit on the skull above the hair volume (TB Art lock), scaled to the hair's width. */
export function hatFit(style: HairStyle): HatFit {
  switch (style) {
    case 'black':
      return { band: -7.4, w: 9.4 };
    case 'cacheado':
      return { band: -4.4, w: 8.1 };
    case 'raspado':
      return { band: -3.2, w: 6.7 };
    case 'undercut':
      return { band: -4.1, w: 7.2 };
    case 'coque':
      return { band: -3.4, w: 7 };
    case 'ondulado':
      return { band: -3.6, w: 7.5 };
    default:
      return { band: -3.5, w: 7.2 };
  }
}

/** Extra height of each hair silhouette above the skull (for plates). */
export const HAIR_TOP: Record<HairStyle, number> = { raspado: 0.3, curto: 1.4, undercut: 3.2, cacheado: 2.8, black: 10, ondulado: 1.3, longo: 1.2, coque: 5.4, trancas: 1 };

function hairPaint(ctx: Ctx, k: Look, pts: P[], ht: Tone, opts: { sheen?: [number, number, number]; tension?: number; lw?: number } = {}) {
  const b = ptsBox(pts);
  paint(ctx, () => smoothClosed(ctx, pts, opts.tension ?? 1), ht, b, { L: k.L, rim: k.rim, lw: opts.lw ?? 0.45, rimA: 0.7, top: 0.1 });
  if (k.a.hairColor === 5) {
    // Salt-and-pepper: darker strands through the grey
    ctx.save();
    ctx.beginPath();
    smoothClosed(ctx, pts, opts.tension ?? 1);
    ctx.clip();
    for (let i = 0; i < 40; i++) {
      const x = b.x0 + rnd(i, 61) * (b.x1 - b.x0);
      const y = b.y0 + rnd(i, 62) * (b.y1 - b.y0);
      line(ctx, [[x, y], [x + 0.5, y + 0.9]], rgba('#3e3834', 0.4), 0.3, false);
    }
    ctx.restore();
  }
  if (opts.sheen) {
    const [cx, cy, rr] = opts.sheen;
    ctx.save();
    ctx.beginPath();
    smoothClosed(ctx, pts, opts.tension ?? 1);
    ctx.clip();
    // Broken sheen band (reads as clumps catching the key light)
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI * (1.12 + i * 0.12);
      ctx.beginPath();
      ctx.arc(cx, cy, rr + (i % 2) * 0.5, a0, a0 + 0.08 + rnd(i, 3) * 0.06);
      ctx.strokeStyle = rgba(ht.hi, 0.75);
      ctx.lineWidth = 0.9 + (i % 3) * 0.2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Clump separations inside a hair mass (2–3 value clumps). */
function strands(ctx: Ctx, pts: P[], ht: Tone, paths: P[][], tension = 0.9) {
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, pts, tension);
  ctx.clip();
  paths.forEach((p, i) => {
    line(ctx, p, rgba(ht.lo, 0.55), 0.4);
    line(ctx, p.map(([x, y]) => [x + 0.55, y + 0.1] as P), rgba(ht.hi, i % 2 ? 0.3 : 0.18), 0.35);
  });
  ctx.restore();
}

/** Degradê: the hair fades into skin toward the nape and sides. */
function fade(ctx: Ctx, pts: P[], k: Look, from = -3.6, to = 2.6) {
  ctx.save();
  ctx.beginPath();
  smoothClosed(ctx, pts, 0.9);
  ctx.clip();
  const g = ctx.createLinearGradient(0, from, 0, to);
  g.addColorStop(0, rgba(k.skin.base, 0));
  g.addColorStop(1, rgba(k.skin.base, 0.72));
  ctx.fillStyle = g;
  ctx.fillRect(-W - 2, from, W * 2 + 4, to - from + 2);
  for (let i = 0; i < 60; i++) {
    const x = -W + rnd(i, 51) * W * 2;
    const y = -T + rnd(i, 52) * 11;
    ctx.fillStyle = rgba(rnd(i, 53) > 0.5 ? k.hair.deep : k.hair.hi, 0.3);
    ctx.fillRect(x, y, 0.3, 0.3);
  }
  ctx.restore();
}

const wavy = (x0: number, y0: number, y1: number, amp: number, n = 4): P[] =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + Math.sin(i * 1.7) * amp, y0 + ((y1 - y0) * i) / n] as P);

/** Hair that hangs behind the head/body (drawn before the torso in the front-facing views). */
export function drawHairBehind(ctx: Ctx, r: Rig, k: Look) {
  const st = k.a.hair;
  const ht = k.hair;
  const v = viewOf(r);
  const back = tone(ht.lo, 'hair');
  if (st === 'black') afro(ctx, k, ht, v, 'back');
  if (v === 'b') return;
  if (st === 'longo') {
    const pts: P[] =
      v === 'q'
        ? [
            [-6.6, -3],
            [-7.6, 6],
            [-7.2, 14.6],
            [-5.2, 19.6],
            [-1.6, 20.4],
            [2.8, 19],
            [5.2, 14],
            [5.8, 6],
          ]
        : sym([
            [0, -6],
            [6.6, -3],
            [7.8, 6],
            [7.4, 15],
            [5.6, 20.4],
            [0, 21],
          ]);
    hairPaint(ctx, k, pts, back);
    for (let i = 0; i < 5; i++) line(ctx, [[-5 + i * 2.2, 4], [-5.6 + i * 2.3, 12], [-4.8 + i * 2.1, 19]], rgba(ht.deep, 0.5), 0.35);
  }
  if (st === 'ondulado') {
    const pts: P[] =
      v === 'q'
        ? [
            [-6.6, -3],
            [-8.2, 3],
            [-8.6, 9],
            [-7, 12.6],
            [-3.4, 13.4],
            [0.6, 12.4],
            [4.4, 11.6],
            [6.2, 8],
            [5.8, 2],
          ]
        : sym([
            [0, -6],
            [6.8, -3],
            [8.6, 4],
            [9, 9.6],
            [7.2, 12.8],
            [3.2, 13.4],
            [0, 12.8],
          ]);
    hairPaint(ctx, k, pts, back);
  }
  if (st === 'trancas') {
    if (v === 'q') for (let i = 0; i < 7; i++) braid(ctx, k, -5.4 + i * 1.7, 1.5, -6 + i * 1.8, 20 + (i % 3), back, i);
    else for (let i = 0; i < 6; i++) braid(ctx, k, -5.4 + i * 2.15, 1.5, -5.8 + i * 2.3, 19 + (i % 2), back, i);
  }
  if (st === 'cacheado') {
    const at: P[] = v === 'q' ? Array.from({ length: 6 }, (_, i) => [-6.4 + i * 1.2, 3.2 + (i % 2) * 1.6] as P) : [[-7, 3.2], [-5.8, 4.8], [7, 3.2], [5.8, 4.8], [-7.6, 0.6], [7.6, 0.6]];
    at.forEach(([x, y], i) => curl(ctx, k, x, y, 2.1, back, i + 40));
  }
}

function braid(ctx: Ctx, k: Look, x0: number, y0: number, x1: number, y1: number, ht: Tone, seed: number) {
  const n = Math.max(4, Math.round((y1 - y0) / 1.5));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = x0 + (x1 - x0) * t + Math.sin(i * 1.3 + seed) * 0.15;
    const y = y0 + (y1 - y0) * t;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.78, 0.95, (i % 2 ? 0.5 : -0.5) + k.L * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = ht.base;
    ctx.fill();
    ctx.strokeStyle = rgba(ht.line, 0.8);
    ctx.lineWidth = 0.28;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + k.L * 0.25, y - 0.2, 0.3, 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(ht.hi, 0.5);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.roundRect(x1 - 0.75, y1 - 1.6, 1.5, 1, 0.3);
  ctx.fillStyle = '#d6a53a';
  ctx.fill();
}

function curl(ctx: Ctx, k: Look, x: number, y: number, rr: number, ht: Tone, seed: number) {
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x + k.L * rr * 0.4, y - rr * 0.4, 0, x, y, rr);
  g.addColorStop(0, ht.hi);
  g.addColorStop(0.45, ht.base);
  g.addColorStop(1, ht.lo);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(ht.line, 0.7);
  ctx.lineWidth = 0.35;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 0.2, y + 0.1, rr * 0.45, Math.PI * (0.2 + rnd(seed, 2)), Math.PI * (1.3 + rnd(seed, 2)));
  ctx.strokeStyle = rgba(ht.deep, 0.6);
  ctx.lineWidth = 0.35;
  ctx.stroke();
}

function afro(ctx: Ctx, k: Look, ht: Tone, v: View, layer: 'back' | 'front') {
  const cx = v === 'q' ? -0.8 : v === 'f' ? 0 : -0.2;
  const cy = -6.6;
  const rx = 10.4;
  const ry = 9.6;
  const n = 22;
  const grad = () => {
    const g = ctx.createRadialGradient(cx + k.L * 4, cy - 4, 1, cx, cy, rx + 1);
    g.addColorStop(0, ht.hi);
    g.addColorStop(0.35, ht.base);
    g.addColorStop(1, ht.lo);
    return g;
  };
  const coils = (count: number, x0: number, w: number, y0: number, h: number, seed: number) => {
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd(i, seed) * w;
      const y = y0 + rnd(i, seed + 1) * h;
      const lit = (x - cx) * k.L + (cy - y) > 2;
      ctx.beginPath();
      ctx.arc(x, y, 0.55 + rnd(i, seed + 2) * 0.35, rnd(i, seed + 3) * 6, rnd(i, seed + 3) * 6 + 3.6);
      ctx.strokeStyle = rgba(lit ? ht.hi : ht.deep, lit ? 0.55 : 0.45);
      ctx.lineWidth = 0.35;
      ctx.stroke();
    }
  };
  if (layer === 'back') {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bump = 0.55 + rnd(i, 9) * 0.4;
      const x = cx + Math.cos(a) * (rx + bump);
      const y = cy + Math.sin(a) * (ry + bump) * (Math.sin(a) > 0.2 ? 0.86 : 1);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const am = ((i - 0.5) / n) * Math.PI * 2;
        ctx.quadraticCurveTo(cx + Math.cos(am) * (rx + 1.6), cy + Math.sin(am) * (ry + 1.6) * (Math.sin(am) > 0.2 ? 0.86 : 1), x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = grad();
    ctx.fill();
    ctx.save();
    ctx.clip();
    coils(90, cx - rx, rx * 2, cy - ry, ry * 2, 1);
    const rg = ctx.createLinearGradient(cx + k.L * rx, 0, cx - k.L * rx, 0);
    rg.addColorStop(0, rgba(k.rim, 0));
    rg.addColorStop(0.7, rgba(k.rim, 0));
    rg.addColorStop(1, rgba(k.rim, 0.55));
    ctx.strokeStyle = rg;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = ht.line;
    ctx.lineWidth = 0.45;
    ctx.stroke();
    return;
  }
  // Hairline where the afro meets the forehead: no outline, so it melts into the mass behind.
  const pts: P[] =
    v === 'q'
      ? [
          [W + 0.8, -0.6],
          [5.2, -3.6],
          [2.4, -4.4],
          [-0.8, -4.2],
          [-3.6, -3],
          [-5.4, -0.4],
          [-6.8, -4],
          [-4, -9],
          [2, -9.6],
          [6.8, -6],
        ]
      : sym([
          [0, -9.6],
          [4.8, -8.8],
          [7.2, -5.6],
          [7, -0.6],
          [6.2, -0.4],
          [5.4, -2.6],
          [3.2, -4.1],
          [0, -4.4],
        ]);
  ctx.beginPath();
  smoothClosed(ctx, pts, 0.9);
  ctx.fillStyle = grad();
  ctx.fill();
  ctx.save();
  ctx.clip();
  coils(26, -6, 12.4, -8.6, 5, 81);
  ctx.restore();
  const edge: P[] = v === 'q' ? [[-5, -0.6], [-3.4, -2.6], [-0.8, -3.9], [2.4, -4.1], [5, -3.3]] : [[-5.4, -1.8], [-3.2, -3.8], [0, -4.3], [3.2, -3.8], [5.4, -1.8]];
  line(ctx, edge, rgba(ht.deep, 0.5), 0.45);
}

/** Hair on the head, above the skull and below the face features (TB Art layer lock). */
export function drawHairFront(ctx: Ctx, r: Rig, k: Look, hatted: boolean) {
  const st = k.a.hair;
  const ht = k.hair;
  const v = viewOf(r);
  const q = v === 'q';
  const f = v === 'f';
  const fadeCap = (): P[] =>
    q
      ? [
          [W + 0.1, -1.6],
          [4.6, -6],
          [0, -T - 0.25],
          [-4.8, -6],
          [-W - 0.5, -1.4],
          [-5.4, 3.2],
          [-4, 1.6],
          [-3.6, -1.6],
          [-1, -3.8],
          [3, -3.8],
        ]
      : f
        ? sym([
            [0, -T - 0.3],
            [4.4, -6.9],
            [6.55, -3.8],
            [6.7, -0.3],
            [6.1, 0.3],
            [5.5, -1.7],
            [3.4, -3.3],
            [0, -3.9],
          ])
        : [
            [W + 0.3, -1],
            [4.4, -6.2],
            [0, -T - 0.25],
            [-4.8, -6],
            [-W - 0.6, -1],
            [-5.6, 4.2],
            [-1.6, 6],
            [2.6, 3.8],
            [3, 1.4],
          ];
  switch (st) {
    case 'raspado': {
      const pts = fadeCap();
      hairPaint(ctx, k, pts, ht, { tension: 0.9 });
      fade(ctx, pts, k);
      ctx.save();
      ctx.beginPath();
      smoothClosed(ctx, pts, 0.9);
      ctx.clip();
      glow(ctx, 1.6 * k.L, -5.4, 3.4, 1.4, ht.hi, 0.35);
      ctx.restore();
      break;
    }
    case 'undercut': {
      // Faded sides + a long, side-parted top swept toward the face
      const cap = fadeCap();
      hairPaint(ctx, k, cap, ht, { tension: 0.9 });
      fade(ctx, cap, k, -4.6, 1.6);
      const top: P[] = q
        ? [
            [-3.6, -6.6],
            [-3, -8.4],
            [-0.6, -10.4],
            [3.2, -10.4],
            [6.2, -8.6],
            [7.6, -5.6],
            [7, -3.8],
            [5.2, -3.6],
            [3, -4.4],
            [0.6, -5.2],
            [-1.8, -5.8],
          ]
        : f
          ? [
              [-3.4, -6.4],
              [-2.8, -8.2],
              [-1, -10.2],
              [2.4, -10.6],
              [5.6, -9],
              [7, -6.4],
              [6.6, -4.4],
              [5, -3.8],
              [3.2, -4.6],
              [1, -5.4],
              [-1.2, -5.9],
            ]
          : [
              [-4.2, -7.2],
              [-2.4, -9.4],
              [1.2, -10.4],
              [4.8, -9.4],
              [7, -7],
              [6.8, -5.4],
              [3.6, -6.2],
              [0, -6.6],
              [-2.6, -6.8],
            ];
      hairPaint(ctx, k, top, ht, { sheen: [1.6, -4.2, 5.4], tension: 0.85 });
      strands(ctx, top, ht, [
        [
          [-2.4, -8.4],
          [1.2, -9.4],
          [5.2, -7.6],
          [6.8, -4.6],
        ],
        [
          [-2, -6.6],
          [1.6, -7.4],
          [4.6, -6],
          [5.8, -4.2],
        ],
      ]);
      if (v !== 'b') line(ctx, [[q ? -2.9 : -2.7, -6.1], [q ? -2.5 : -2.3, -8.3]], rgba(k.skin.base, 0.55), 0.35, false);
      break;
    }
    case 'curto': {
      const pts: P[] = q
        ? [
            [W + 0.5, -1.2],
            [W + 0.9, -5.2],
            [3, -T - 1.3],
            [-2.2, -T - 1.1],
            [-W - 0.9, -4.6],
            [-W - 0.8, -0.2],
            [-5.2, 3.6],
            [-4.2, 1.2],
            [-3.8, -1.6],
            [-1.6, -2.4],
            [-0.2, -3.9],
            [1.6, -2.6],
            [2.8, -4],
            [4.2, -2.6],
            [5.2, -3.6],
          ]
        : f
          ? sym([
              [0, -8.7],
              [3.6, -8.4],
              [6.3, -6.3],
              [7.1, -2.8],
              [6.9, 0.4],
              [6.1, 0.5],
              [5.7, -1.7],
              [4.4, -2.7],
              [3.4, -2.1],
              [2.4, -3.5],
              [1.1, -2.9],
              [0, -3.9],
            ])
          : [
              [W + 0.6, -1.4],
              [W + 0.6, -5.4],
              [2.6, -T - 1.2],
              [-2.6, -T - 1],
              [-W - 0.9, -4.4],
              [-W - 0.8, 0.6],
              [-5, 4.6],
              [-1.4, 5.8],
              [2.4, 4],
              [3.2, 1],
            ];
      hairPaint(ctx, k, pts, ht, { sheen: [0, -1.4, 6.2], tension: 0.85 });
      if (!hatted)
        strands(
          ctx,
          pts,
          ht,
          [0, 1, 2, 3].map((i) => [
            [-3.4 + i * 2.4, -T - 0.6],
            [-2.4 + i * 2.4, -5.2],
            [-1.2 + i * 2.6, -3.6],
          ]),
          0.85,
        );
      break;
    }
    case 'cacheado': {
      const base: P[] = q
        ? [
            [W + 0.6, -1.4],
            [W + 1.2, -6],
            [2, -T - 2.4],
            [-3.4, -T - 2.2],
            [-W - 1.8, -5],
            [-W - 1.8, 0.8],
            [-5.6, 4],
            [-4, 1.2],
            [-3.2, -2],
            [0, -3.2],
            [3.6, -2.8],
          ]
        : f
          ? sym([
              [0, -9.8],
              [4.4, -9.4],
              [7.6, -6.2],
              [8.2, -1.6],
              [7.4, 2.4],
              [6.2, 2.2],
              [5.6, -1.4],
              [3.4, -3.1],
              [0, -3.4],
            ])
          : [
              [W + 1, -1],
              [W + 1.2, -6],
              [2, -T - 2.4],
              [-3.4, -T - 2.2],
              [-W - 1.8, -5],
              [-W - 1.8, 1.4],
              [-4.8, 5.8],
              [-0.6, 6.4],
              [3, 4.2],
              [3.8, 1],
            ];
      hairPaint(ctx, k, base, tone(ht.lo, 'hair'));
      const half: P[] = [
        [1.2, -9.4],
        [4, -8.6],
        [6.4, -6.6],
        [7.6, -3.6],
        [7.6, -0.4],
        [6.8, 2.4],
        [1.6, -3.6],
        [4, -3.6],
        [2.4, -6.6],
        [5.2, -5.2],
      ];
      const ring: P[] = q
        ? [
            [5.6, -2.4],
            [5.8, -5.4],
            [3.8, -7.9],
            [0.8, -9],
            [-2.4, -8.8],
            [-5.2, -7.2],
            [-6.9, -4.4],
            [-7.2, -1.2],
            [-6.4, 1.8],
            [-4.8, 3.6],
            [-1.8, -3.2],
            [1.4, -3.9],
            [3.8, -3.4],
            [-0.6, -6.4],
            [2.6, -6.2],
            [-3.6, -5.6],
          ]
        : f
          ? [...half, ...half.map(([x, y]) => [-x, y] as P), [0, -6.4]]
          : [
              [6, -1.6],
              [5.6, -5.4],
              [3.4, -8],
              [0.2, -9],
              [-3, -8.6],
              [-5.8, -6.6],
              [-7.2, -3.4],
              [-7, 0],
              [-5.8, 3.4],
              [-3, 5.4],
              [0.4, 5.6],
              [3.2, 3.6],
              [-1, -5],
              [2.6, -4.2],
              [-4, -2],
              [0.6, 0.4],
              [3.8, -0.6],
              [-2.4, 2.4],
            ];
      ring.forEach(([x, y], i) => {
        if (hatted && y < -5) return;
        curl(ctx, k, x, y, 2.05 + rnd(i, 7) * 0.4, ht, i);
      });
      break;
    }
    case 'black':
      afro(ctx, k, ht, v, v === 'b' ? 'back' : 'front');
      break;
    case 'longo':
    case 'ondulado': {
      const waves = st === 'ondulado';
      const pts: P[] = q
        ? waves
          ? [
              [W + 0.6, -0.6],
              [W + 1, -5.4],
              [2.6, -T - 1.2],
              [-3, -T - 1],
              [-W - 1.4, -4],
              [-W - 2, 2.4],
              [-7, 6.4],
              [-8, 9.6],
              [-6.6, 11.8],
              [-5, 10.6],
              [-5.4, 7.4],
              [-4.4, 4.4],
              [-4.2, 1.4],
              [-3.8, -1.2],
              [-2.2, -2.8],
              [1.2, -4.2],
              [3.6, -3.2],
              [5.2, -2],
            ]
          : [
              [W + 0.5, -0.4],
              [W + 1, -5.4],
              [2.6, -T - 1.2],
              [-3, -T - 1],
              [-W - 1.2, -4],
              [-W - 1.6, 3],
              [-6.8, 10],
              [-6.2, 16.4],
              [-4.6, 15.6],
              [-4.4, 8],
              [-3.8, 1.2],
              [-2.2, -2.6],
              [1.4, -4.2],
              [3.6, -3],
              [5.2, -1.8],
            ]
        : f
          ? sym(
              waves
                ? [
                    [0, -8.5],
                    [3.8, -8.3],
                    [6.8, -5.6],
                    [7.8, -1],
                    [8.4, 3],
                    [7.6, 6.2],
                    [8.6, 9.4],
                    [7.2, 11.8],
                    [5.6, 10.6],
                    [6, 7.4],
                    [5.2, 4.2],
                    [5.5, 1],
                    [5.2, -1.2],
                    [3.4, -3.3],
                    [1, -3.9],
                    [0, -3.4],
                  ]
                : [
                    [0, -8.4],
                    [3.8, -8.2],
                    [6.8, -5.4],
                    [7.6, -0.6],
                    [7.8, 8],
                    [7.6, 16],
                    [6.2, 16.8],
                    [5.4, 15.2],
                    [5.3, 6],
                    [5.2, -0.8],
                    [3.6, -3.2],
                    [1.2, -4],
                    [0, -3.5],
                  ],
            )
          : waves
            ? [
                [W + 0.8, -1],
                [W + 1, -5.6],
                [2.4, -T - 1.2],
                [-3, -T - 1],
                [-W - 1.2, -4],
                [-W - 2, 3],
                [-8.2, 8],
                [-7, 12.4],
                [-3.6, 13.2],
                [0, 12.4],
                [3.6, 13.2],
                [6.6, 11.6],
                [7.4, 6],
                [7, 2],
              ]
            : [
                [W + 0.8, -1],
                [W + 1, -5.6],
                [2.4, -T - 1.2],
                [-3, -T - 1],
                [-W - 1.2, -4],
                [-W - 1.6, 4],
                [-7, 13],
                [-5.4, 19],
                [-1, 20.4],
                [3.8, 18.6],
                [5.8, 12],
                [6.8, 4],
              ];
      hairPaint(ctx, k, pts, ht, { sheen: [0, -1, 6.6], tension: 0.9 });
      const len = waves ? 12 : 19;
      const xs = f ? [-6.8, -5.6, 5.6, 6.8, -2.4, 2.4] : v === 'b' ? [-6.4, -4.2, -2, 0.2, 2.4, 4.6, 6.2] : [-5, -3, -1, 1, 3, 5];
      strands(
        ctx,
        pts,
        ht,
        xs.map((x) => (waves ? [[x * 0.6, -T], ...wavy(x, -2, len, 0.7)] : [[x + 1.2, -T], [x - 0.4, -2], [x - 0.8, 8], [x - 0.4, 20]])),
      );
      if (f) line(ctx, [[0.3, -3.6], [0.1, -8.2]], rgba(k.skin.base, 0.45), 0.35, false);
      if (q) {
        // Face-framing strand on the far side
        const s: P[] = waves
          ? [
              [5.4, -2.6],
              [6.8, 0.6],
              [6.2, 4.4],
              [7.2, 7.6],
              [6, 9.8],
              [5, 7.6],
              [5.4, 4.2],
              [5, 0.4],
            ]
          : [
              [5.4, -2.6],
              [6.5, 0.8],
              [6.4, 6.4],
              [5.4, 8.8],
              [5.1, 4.2],
              [5, -0.4],
            ];
        hairPaint(ctx, k, s, ht, { tension: 0.9 });
      }
      break;
    }
    case 'coque': {
      const pts: P[] = q
        ? [
            [W + 0.4, -1.3],
            [5, -6],
            [0.6, -T - 0.8],
            [-4.4, -6.6],
            [-W - 0.8, -2],
            [-5.6, 3.2],
            [-4.1, 1.2],
            [-3.6, -1.6],
            [-0.8, -3.8],
            [3.2, -3.6],
          ]
        : f
          ? sym([
              [0, -8.1],
              [4.4, -7.2],
              [6.6, -3.6],
              [6.7, 0.4],
              [6, 0.6],
              [5.5, -1.8],
              [3.2, -3.5],
              [0, -3.9],
            ])
          : [
              [W + 0.6, -1],
              [5, -6.2],
              [0.4, -T - 0.8],
              [-4.8, -6.4],
              [-W - 0.8, -1],
              [-5.4, 4.6],
              [-1.4, 6],
              [2.6, 4.2],
              [3.2, 1],
            ];
      const bun = () => {
        const bx = q ? -2.8 : f ? 0 : -1.2;
        const by = hatted ? -6.2 : -T - 2.6;
        const bp: P[] = [
          [bx + 3.6, by],
          [bx + 2.4, by - 3],
          [bx - 0.6, by - 3.8],
          [bx - 3.4, by - 2],
          [bx - 3.4, by + 1.4],
          [bx, by + 2.6],
          [bx + 3, by + 1.8],
        ];
        hairPaint(ctx, k, bp, ht, { sheen: [bx, by + 0.4, 2.6] });
        line(ctx, [[bx - 2.6, by - 0.8], [bx, by - 2.2], [bx + 2.6, by - 0.4]], rgba(ht.lo, 0.8), 0.4);
        line(ctx, [[bx - 2.4, by + 0.9], [bx + 0.4, by - 0.6], [bx + 2.8, by + 1]], rgba(ht.lo, 0.7), 0.35);
        const sc: P[] = [
          [bx - 3.2, by + 1.4],
          [bx + 3.2, by + 1.6],
          [bx + 3.4, by + 3],
          [bx - 3.2, by + 2.8],
        ];
        paint(ctx, () => smoothClosed(ctx, sc, 0.6), tone('#c9582c'), ptsBox(sc), { L: k.L, rim: k.rim, lw: 0.35 });
      };
      // Bun sits behind the cap in the front-facing views (and under any hat)
      if (v !== 'b' || hatted) bun();
      hairPaint(ctx, k, pts, ht, { sheen: [0, -0.8, 6], tension: 0.9 });
      strands(
        ctx,
        pts,
        ht,
        [0, 1, 2, 3].map((i) => [
          [-3 + i * 2.6, -3.8],
          [-2.4 + i * 1.8, -6],
          [f ? 0 : -2.8, -T],
        ]),
      );
      if (v === 'b' && !hatted) bun();
      break;
    }
    case 'trancas': {
      const pts: P[] = q
        ? [
            [W + 0.5, -1.2],
            [W + 0.8, -5.4],
            [2.4, -T - 1],
            [-3, -T - 0.8],
            [-W - 1, -4],
            [-W - 1, 1],
            [-4.4, 2.2],
            [-3.6, -1.6],
            [-0.6, -3.8],
            [3.4, -3.6],
          ]
        : f
          ? sym([
              [0, -8.4],
              [3.8, -8.2],
              [6.6, -5.6],
              [7.2, -1.6],
              [7, 1.6],
              [6.1, 1.2],
              [5.6, -1.8],
              [3.2, -3.6],
              [0, -3.9],
            ])
          : [
              [W + 0.7, -1],
              [W + 0.8, -5.4],
              [2.4, -T - 1],
              [-3, -T - 0.8],
              [-W - 1, -4],
              [-W - 1, 2.4],
              [-1.4, 3.6],
              [3.2, 2.2],
            ];
      hairPaint(ctx, k, pts, ht, { sheen: [0, -1, 6.4], tension: 0.9 });
      ctx.save();
      ctx.beginPath();
      smoothClosed(ctx, pts, 0.9);
      ctx.clip();
      for (let i = 0; i < 5; i++) line(ctx, [[-5 + i * 2.4, -T], [-4.6 + i * 2.2, -2]], rgba(k.skin.base, 0.35), 0.3);
      line(ctx, [[-W, -4.4], [W, -4.8]], rgba(k.skin.base, 0.3), 0.3);
      ctx.restore();
      if (q) {
        braid(ctx, k, -5.6, 1.2, -6.4, 19, ht, 1);
        braid(ctx, k, -4.4, 1.8, -4.9, 17.5, ht, 2);
        braid(ctx, k, 5.6, 0, 6, 9, ht, 3);
      } else if (f) {
        for (const s of [-1, 1]) {
          braid(ctx, k, s * 6.4, 1.4, s * 7, 18, ht, s + 4);
          braid(ctx, k, s * 5.2, 2, s * 5.8, 16.5, ht, s + 7);
        }
      } else {
        for (let i = 0; i < 8; i++) braid(ctx, k, -5.2 + i * 1.5, 2, -5.6 + i * 1.6, 20.5 + (i % 3), ht, i + 10);
      }
      break;
    }
  }
}

/** Clip to the skull (brim shadows, hat occlusion). */
export function clipHead(ctx: Ctx, face: FaceStyle | undefined, v: View) {
  ctx.beginPath();
  headPath(ctx, faceSpec(face), v);
  ctx.clip();
}
