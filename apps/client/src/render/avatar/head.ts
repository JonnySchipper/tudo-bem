import type { FaceStyle, HairStyle } from '@tudobem/shared';
import type { Ctx } from '../draw';
import { mix, rgba, tone, type Tone } from './color';
import type { Look } from './body';
import type { Rig } from './rig';
import { glow, line, paint, ptsBox, rnd, smoothClosed, type P } from './shape';

/** Head-local space: origin = head center, facing +x, ~12.6 wide × 14.6 high. */
const W = 6.3;
const T = 7.4;
const B = 7.2;

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

function headPath(ctx: Ctx, f: FaceSpec, front: boolean) {
  const j = f.jaw;
  const cb = B + f.chin;
  if (front) {
    ctx.moveTo(0.2, -T);
    ctx.bezierCurveTo(3.9, -T, W, -4.8, W, -1.3);
    ctx.bezierCurveTo(W, 1.6, W * 0.94, 3.2, 4.6 * j, 4.8);
    ctx.bezierCurveTo(3.9 * j, 6.2, 2.9, cb, 1.5, cb);
    ctx.bezierCurveTo(-0.4, cb, -2.9, 6.3, -4.3 * j, 4.6);
    ctx.bezierCurveTo(-5.8, 2.8, -W - 0.3, 0.6, -W - 0.3, -1.6);
    ctx.bezierCurveTo(-W - 0.3, -5, -3.6, -T, 0.2, -T);
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

/** Skull + ear + face. Called inside the head transform. */
export function drawHead(ctx: Ctx, r: Rig, k: Look) {
  const f = faceSpec(k.a.face);
  const s = k.skin;
  const front = r.front;
  // Ear sits toward the back of the head (−x) in front view, toward +x from behind.
  const ex = front ? -4.3 : 4.1;
  const ear = () => {
    ctx.ellipse(ex, 1.2, 1.05, 1.7, front ? 0.2 : -0.2, 0, Math.PI * 2);
  };
  paint(ctx, () => headPath(ctx, f, front), s, HEAD_BOX, { L: k.L, rim: k.rim, lw: 0.45, rimA: 0.6, top: 0.08 });
  ctx.save();
  ctx.beginPath();
  headPath(ctx, f, front);
  ctx.clip();
  // Subsurface warmth at the cheek + soft form turn toward the jaw
  if (front) {
    glow(ctx, -1.2, 2.8, 2.2, 1.6, '#e0685c', 0.16);
    glow(ctx, 4.4, 2.4, 1.4, 1.2, '#e0685c', 0.12);
    glow(ctx, -4.8, 3.6, 3.2, 3.4, s.lo, 0.35);
    // Under-cheekbone plane on the shadow side + jaw turn
    glow(ctx, 4.6, 3.6, 1.8, 1.4, s.lo, 0.3);
    glow(ctx, 1.4, 7.4, 3.6, 1.2, s.lo, 0.35);
    glow(ctx, -1.2, -4.8, 3.6, 1.8, '#fff4ea', 0.16);
  } else {
    glow(ctx, 4.8, 2.6, 1.6, 1.4, '#e0685c', 0.1);
  }
  ctx.restore();
  paint(ctx, ear, s, { x0: ex - 1.4, x1: ex + 1.4, y0: -1.2, y1: 3 }, { L: k.L, rim: k.rim, lw: 0, rimA: 0.3 });
  ctx.beginPath();
  ctx.ellipse(ex, 1.2, 1.05, 1.7, front ? 0.2 : -0.2, front ? Math.PI * 0.55 : -Math.PI * 0.45, front ? Math.PI * 1.45 : Math.PI * 0.45);
  ctx.strokeStyle = rgba(s.line, 0.55);
  ctx.lineWidth = 0.3;
  ctx.stroke();
  glow(ctx, ex + (front ? 0.2 : -0.2), 1.3, 0.55, 0.9, s.lo, 0.6);
  if (k.a.extra === 'brincos') {
    ctx.beginPath();
    ctx.arc(ex + (front ? 0.2 : -0.2), 3.5, 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = '#d6a53a';
    ctx.lineWidth = 0.45;
    ctx.stroke();
    glow(ctx, ex - 0.2, 3.1, 0.35, 0.35, '#fff1c0', 0.9);
  }
  if (front) drawFace(ctx, r, k, f);
  else if (k.a.extra === 'barba') {
    ctx.save();
    ctx.beginPath();
    headPath(ctx, f, front);
    ctx.clip();
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
}

function drawFace(ctx: Ctx, r: Rig, k: Look, f: FaceSpec) {
  const s = k.skin;
  const brow = tone(mix(k.hair.base, '#1a1010', 0.28), 'hair');
  const iris = '#2b1a14';
  const nearX = -0.9;
  const farX = 3.55;
  const eyeY = 0.4;
  const happy = r.eyes === 'happy';
  const closed = r.eyes === 'closed';

  // Brow ridge / eye-socket soft shade
  glow(ctx, nearX + 0.1, eyeY - 0.6, 1.9, 1, s.lo, 0.28);
  glow(ctx, farX, eyeY - 0.6, 1.4, 0.9, s.lo, 0.24);

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
    // Sclera → iris → pupil → catchlight, with a heavier upper lid (lash line)
    ctx.beginPath();
    ctx.ellipse(x, eyeY, rx * 1.18, ry * 0.92, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f1ea';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.12, eyeY + 0.05, rx * 0.86, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = iris;
    ctx.fill();
    glow(ctx, x + w * 0.12, eyeY + 0.35, rx * 0.7, ry * 0.5, '#6b4630', 0.7);
    ctx.beginPath();
    ctx.arc(x - 0.28 * w + 0.12, eyeY - 0.38, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, eyeY - 0.08, rx * 1.3, ry * 0.95, 0, Math.PI * 1.08, Math.PI * 1.98);
    ctx.strokeStyle = '#1e1212';
    ctx.lineWidth = 0.55;
    ctx.lineCap = 'round';
    ctx.stroke();
    if (f.lines) {
      line(ctx, [[x - rx * 1.2, eyeY - ry * 1.1], [x, eyeY - ry * 1.45], [x + rx * 1.2, eyeY - ry * 1.05]], rgba(s.line, 0.45), 0.3);
    }
  };
  eye(nearX, 1);
  eye(farX, 0.78);

  // Brows
  const by = eyeY - 2.35 - f.browLift - (r.brows === 'up' ? 0.5 : 0);
  const worried = r.brows === 'worried';
  const soft = r.brows === 'soft';
  const bw = f.brow;
  line(ctx, [[nearX - 1.5, by + (worried ? 0.5 : 0.35)], [nearX - 0.1, by - (soft ? 0.25 : 0.35)], [nearX + 1.2, by + (worried ? -0.45 : 0.05)]], brow.base, bw);
  line(ctx, [[farX - 0.8, by + (worried ? -0.45 : 0.1)], [farX + 0.2, by - (soft ? 0.2 : 0.3)], [farX + 1.2, by + 0.3]], brow.base, bw * 0.85);

  // Nose (3/4): bridge edge, soft side shadow, tip + nostril
  line(ctx, [[2.3, eyeY + 0.2], [2.9, 1.9], [3.35, 2.95]], rgba(s.lo, 0.8), 0.4);
  glow(ctx, 2.2, 2.9, 1.1, 0.7, s.lo, 0.5);
  line(ctx, [[3.35, 2.95], [2.9, 3.35], [2.3, 3.25]], rgba(s.line, 0.75), 0.4);
  glow(ctx, 2.9, 2.35, 0.5, 0.45, '#fff4ea', 0.45);

  if (f.lines) {
    line(ctx, [[0.6, 3.6], [0.1, 4.8], [0.5, 5.8]], rgba(s.lo, 0.55), 0.35);
    line(ctx, [[farX + 1.6, eyeY + 0.1], [farX + 2.1, eyeY + 0.5]], rgba(s.lo, 0.6), 0.25, false);
    line(ctx, [[farX + 1.5, eyeY + 0.8], [farX + 2, eyeY + 1.2]], rgba(s.lo, 0.5), 0.25, false);
  }

  // Facial hair sits under the mouth line
  if (k.a.extra === 'barba') beard(ctx, k, f, true);
  if (k.a.extra === 'bigode' || k.a.extra === 'barba') mustache(ctx, k);

  // Mouth
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
  }

  if (k.a.extra === 'sardas') {
    for (let i = 0; i < 9; i++) {
      const fx = -2.2 + rnd(i, 21) * 6.4;
      const fy = 1.6 + rnd(i, 22) * 1.6;
      ctx.beginPath();
      ctx.arc(fx, fy, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.deep, 0.5);
      ctx.fill();
    }
  }
  if (k.a.extra === 'oculos') glasses(ctx, k, nearX, farX, eyeY);
}

function glasses(ctx: Ctx, k: Look, nx: number, fx: number, ey: number) {
  const frame = '#3a2418';
  ctx.lineWidth = 0.42;
  ctx.strokeStyle = frame;
  ctx.beginPath();
  ctx.roundRect(nx - 1.75, ey - 1.25, 3.5, 2.5, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(fx - 1.2, ey - 1.15, 2.5, 2.35, 0.8);
  ctx.stroke();
  line(ctx, [[nx + 1.75, ey - 0.2], [1.85, ey - 0.6], [fx - 1.2, ey - 0.2]], frame, 0.4);
  line(ctx, [[nx - 1.75, ey - 0.3], [-3.3, -0.2]], frame, 0.4, false);
  line(ctx, [[nx - 1.1, ey + 0.8], [nx - 0.1, ey - 0.6]], rgba('#ffffff', 0.55), 0.35, false);
  line(ctx, [[fx - 0.6, ey + 0.7], [fx + 0.2, ey - 0.5]], rgba('#ffffff', 0.45), 0.3, false);
  void k;
}

function beard(ctx: Ctx, k: Look, f: FaceSpec, front: boolean) {
  const bt = tone(mix(k.hair.base, k.skin.base, 0.12), 'hair');
  ctx.save();
  ctx.beginPath();
  headPath(ctx, f, front);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-4.4, 1.2);
  ctx.bezierCurveTo(-4.6, 4.2, -2, 8.4, 1.6, 8.6);
  ctx.bezierCurveTo(4.6, 8.4, W + 0.4, 4.4, W + 0.4, 1.6);
  ctx.bezierCurveTo(5, 3.2, 4, 3.8, 3.2, 4);
  ctx.bezierCurveTo(2.4, 6.6, 0.4, 6.8, -0.2, 4.6);
  ctx.bezierCurveTo(-1.8, 4.6, -3.2, 3.4, -4.4, 1.2);
  ctx.fillStyle = rgba(bt.base, 0.92);
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    const x = -3.8 + rnd(i, 31) * 9.6;
    const y = 2.6 + rnd(i, 32) * 5.4;
    ctx.fillStyle = rgba(rnd(i, 33) > 0.5 ? bt.hi : bt.deep, 0.35);
    ctx.fillRect(x, y, 0.35, 0.35);
  }
  ctx.restore();
}

function mustache(ctx: Ctx, k: Look) {
  const grey = k.hair.base === 'rgb(156,151,146)' || k.a.hairColor === 5;
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
  /** Extra lift (afro). */
  lift: number;
}

export function hatFit(style: HairStyle): HatFit {
  switch (style) {
    case 'black':
      return { band: -7.4, w: 9.4, lift: 0 };
    case 'cacheado':
      return { band: -4.4, w: 8.1, lift: 0 };
    case 'raspado':
      return { band: -3.2, w: 6.7, lift: 0 };
    case 'coque':
      return { band: -3.4, w: 7, lift: 0 };
    default:
      return { band: -3.5, w: 7.2, lift: 0 };
  }
}

function hairPaint(ctx: Ctx, k: Look, pts: P[], ht: Tone, opts: { sheen?: [number, number, number]; tension?: number } = {}) {
  const b = ptsBox(pts);
  paint(ctx, () => smoothClosed(ctx, pts, opts.tension ?? 1), ht, b, { L: k.L, rim: k.rim, lw: 0.45, rimA: 0.7, top: 0.1 });
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

/** Hair that hangs behind the head/body (drawn before the torso in front view). */
export function drawHairBehind(ctx: Ctx, r: Rig, k: Look) {
  const st = k.a.hair;
  const ht = k.hair;
  if (st === 'black') afro(ctx, k, ht, r.front, 'back');
  if (st === 'longo' && r.front) {
    const pts: P[] = [
      [-6.6, -3],
      [-7.6, 6],
      [-7.2, 14.6],
      [-5.2, 19.6],
      [-1.6, 20.4],
      [2.8, 19],
      [5.2, 14],
      [5.8, 6],
    ];
    hairPaint(ctx, k, pts, tone(ht.lo, 'hair'));
    for (let i = 0; i < 5; i++) line(ctx, [[-5 + i * 2.2, 4], [-5.6 + i * 2.3, 12], [-4.8 + i * 2.1, 19]], rgba(ht.deep, 0.5), 0.35);
  }
  if (st === 'trancas' && r.front) {
    for (let i = 0; i < 7; i++) {
      const x0 = -5.4 + i * 1.7;
      braid(ctx, k, x0, 1.5, x0 - 0.6 + i * 0.1, 20 + (i % 3), tone(ht.lo, 'hair'), i);
    }
  }
  if (st === 'cacheado' && r.front) {
    for (let i = 0; i < 6; i++) curl(ctx, k, -6.4 + i * 1.2, 3.2 + (i % 2) * 1.6, 2.1, tone(ht.lo, 'hair'), i + 40);
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
  // Gold cuff near the tip
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

function afro(ctx: Ctx, k: Look, ht: Tone, front: boolean, layer: 'back' | 'front') {
  const cx = front ? -0.8 : -0.2;
  const cy = -6.6;
  const rx = 10.4;
  const ry = 9.6;
  const n = 22;
  const build = () => {
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
  };
  if (layer === 'back') {
    ctx.beginPath();
    build();
    const g = ctx.createRadialGradient(cx + k.L * 4, cy - 4, 1, cx, cy, rx + 1);
    g.addColorStop(0, ht.hi);
    g.addColorStop(0.35, ht.base);
    g.addColorStop(1, ht.lo);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Coily texture: tiny arcs, lighter toward the key light
    for (let i = 0; i < 90; i++) {
      const a = rnd(i, 1) * Math.PI * 2;
      const d = Math.sqrt(rnd(i, 2));
      const x = cx + Math.cos(a) * rx * d;
      const y = cy + Math.sin(a) * ry * d;
      const lit = (x - cx) * k.L + (cy - y) > 2;
      ctx.beginPath();
      ctx.arc(x, y, 0.55 + rnd(i, 3) * 0.35, rnd(i, 4) * 6, rnd(i, 4) * 6 + 3.6);
      ctx.strokeStyle = rgba(lit ? ht.hi : ht.deep, lit ? 0.55 : 0.45);
      ctx.lineWidth = 0.35;
      ctx.stroke();
    }
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
  } else if (front) {
    // Hairline where the afro meets the forehead: no outline, so it melts into the mass behind.
    const pts: P[] = [
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
    ];
    ctx.beginPath();
    smoothClosed(ctx, pts, 0.9);
    const g = ctx.createRadialGradient(cx + k.L * 4, cy - 4, 1, cx, cy, rx + 1);
    g.addColorStop(0, ht.hi);
    g.addColorStop(0.35, ht.base);
    g.addColorStop(1, ht.lo);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 26; i++) {
      const x = -6 + rnd(i, 81) * 12.4;
      const y = -8.6 + rnd(i, 82) * 5;
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + rnd(i, 83) * 0.3, rnd(i, 84) * 6, rnd(i, 84) * 6 + 3.6);
      ctx.strokeStyle = rgba((x - cx) * k.L + (cy - y) > 2 ? ht.hi : ht.deep, 0.45);
      ctx.lineWidth = 0.35;
      ctx.stroke();
    }
    ctx.restore();
    // Soft shadow the hairline casts on the forehead
    line(ctx, [[-5, -0.6], [-3.4, -2.6], [-0.8, -3.9], [2.4, -4.1], [5, -3.3]], rgba(ht.deep, 0.5), 0.45);
  }
}

/** Hair on top of the head (after the face). */
export function drawHairFront(ctx: Ctx, r: Rig, k: Look, hatted: boolean) {
  const st = k.a.hair;
  const ht = k.hair;
  const f = r.front;
  switch (st) {
    case 'raspado': {
      const pts: P[] = f
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
      ctx.save();
      ctx.globalAlpha = 0.92;
      hairPaint(ctx, k, pts, ht, { tension: 0.9 });
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      smoothClosed(ctx, pts, 0.9);
      ctx.clip();
      for (let i = 0; i < 60; i++) {
        const x = -W + rnd(i, 51) * W * 2;
        const y = -T + rnd(i, 52) * 11;
        ctx.fillStyle = rgba(rnd(i, 53) > 0.5 ? ht.deep : ht.hi, 0.35);
        ctx.fillRect(x, y, 0.3, 0.3);
      }
      glow(ctx, -1.6 * -k.L, -5.4, 3.4, 1.4, ht.hi, 0.35);
      ctx.restore();
      break;
    }
    case 'curto': {
      const pts: P[] = f
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
      if (!hatted) for (let i = 0; i < 4; i++) line(ctx, [[-3.4 + i * 2.4, -T - 0.6], [-2.4 + i * 2.4, -5.2], [-1.2 + i * 2.6, -3.6]], rgba(ht.lo, 0.7), 0.4);
      break;
    }
    case 'cacheado': {
      const base: P[] = f
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
      const ring = f
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
    case 'black': {
      if (f) afro(ctx, k, ht, f, 'front');
      else afro(ctx, k, ht, f, 'back');
      break;
    }
    case 'longo': {
      const pts: P[] = f
        ? [
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
      ctx.save();
      ctx.beginPath();
      smoothClosed(ctx, pts, 0.9);
      ctx.clip();
      for (let i = 0; i < 6; i++) {
        const x = -5 + i * 2;
        line(ctx, [[x + 1.2, -T], [x - 0.4, -2], [x - 0.8, 8], [x - 0.4, 20]], rgba(ht.lo, 0.45), 0.35);
      }
      ctx.restore();
      if (f) {
        // Face-framing strand on the far side
        const s: P[] = [
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
      const pts: P[] = f
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
      // Bun first when hatted so the hat sits over it
      const bun = () => {
        const bx = f ? -2.8 : -1.2;
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
      if (!hatted || !f) bun();
      hairPaint(ctx, k, pts, ht, { sheen: [0, -0.8, 6], tension: 0.9 });
      for (let i = 0; i < 4; i++) line(ctx, [[-3 + i * 2.6, -3.8 + (i === 0 ? 0.4 : 0)], [-2.4 + i * 1.8, -6], [-2.8, -T]], rgba(ht.lo, 0.5), 0.35);
      if (hatted && f) bun();
      break;
    }
    case 'trancas': {
      const pts: P[] = f
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
      // Parting grid
      ctx.save();
      ctx.beginPath();
      smoothClosed(ctx, pts, 0.9);
      ctx.clip();
      for (let i = 0; i < 5; i++) line(ctx, [[-5 + i * 2.4, -T], [-4.6 + i * 2.2, -2]], rgba(k.skin.base, 0.35), 0.3);
      line(ctx, [[-W, -4.4], [W, -4.8]], rgba(k.skin.base, 0.3), 0.3);
      ctx.restore();
      if (f) {
        // Two braids fall in front of the near shoulder
        braid(ctx, k, -5.6, 1.2, -6.4, 19, ht, 1);
        braid(ctx, k, -4.4, 1.8, -4.9, 17.5, ht, 2);
        braid(ctx, k, 5.6, 0, 6, 9, ht, 3);
      } else {
        for (let i = 0; i < 8; i++) braid(ctx, k, -5.2 + i * 1.5, 2, -5.6 + i * 1.6, 20.5 + (i % 3), ht, i + 10);
      }
      break;
    }
  }
}

/** Clip to the skull (brim shadows, hat occlusion). */
export function clipHead(ctx: Ctx, face: FaceStyle | undefined, front: boolean) {
  ctx.beginPath();
  headPath(ctx, faceSpec(face), front);
  ctx.clip();
}
