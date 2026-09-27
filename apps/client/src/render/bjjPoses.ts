/**
 * Academia BJJ v0 — side-view pose cards for the roll UI (Art brief). Two jointed figures (white gi vs
 * blue gi) with a charcoal silhouette edge, so every position reads by shape alone at ~100 px tall:
 * standing pair, upright guard, low wedge half guard, kneeling side control, tall knee-on-belly,
 * seated mount, stacked back take. Family-safe: grips and hugs only, no pain acting.
 */
import type { BjjPositionId } from '@tudobem/shared';
import { POSITION_LABELS } from '@tudobem/shared';
import { TB } from '../art/palette';
import { circle, rrect, type Ctx } from './draw';

export type BjjPoseId = BjjPositionId | 'tap' | 'fist_bump';

type P = [number, number];

interface Fig {
  head: P;
  neck: P;
  hip: P;
  /** Near (viewer-side) and far limbs: [elbow|knee, hand|foot]. */
  armN: [P, P];
  armF: [P, P];
  legN: [P, P];
  legF: [P, P];
  gi: 'white' | 'blue';
  /** Which side of the head the face is on, relative to the neck→head axis: 1 = right-hand, -1 = left-hand. */
  face: 1 | -1;
  hair?: string;
}

type Part = 'armN' | 'armF' | 'legN' | 'legF' | 'body';

/** Design space; the card scales it to fit the canvas. */
const VW = 240;
const VH = 120;

const INK = 'rgba(44,44,44,0.92)';
const GI = {
  white: { near: '#fbf8f1', far: '#ddd5c7' },
  blue: { near: '#3f6ea8', far: '#2e5584' },
} as const;
const BELT = '#f7f4ec';
const SKIN = ['#d9a07a', '#b97a52'] as const;

const W_TORSO = 17;
const W_THIGH = 10.5;
const W_SHIN = 8.5;
const W_UPPER = 8;
const W_FORE = 7;
const R_HEAD = 8.5;
const EDGE = 3;

function seg(ctx: Ctx, a: P, b: P, c: P | null, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  if (c) ctx.lineTo(c[0], c[1]);
  ctx.stroke();
}

function limb(ctx: Ctx, f: Fig, part: Exclude<Part, 'body'>, edge: boolean) {
  const leg = part === 'legN' || part === 'legF';
  const far = part === 'armF' || part === 'legF';
  const root = leg ? f.hip : f.neck;
  const [mid, end] = f[part];
  const skin = SKIN[f.gi === 'white' ? 0 : 1];
  if (edge) {
    seg(ctx, root, mid, null, (leg ? W_THIGH : W_UPPER) + EDGE, INK);
    seg(ctx, mid, end, null, (leg ? W_SHIN : W_FORE) + EDGE, INK);
    circle(ctx, end[0], end[1], (leg ? 4.2 : 3.8) + EDGE / 2, INK);
    return;
  }
  const col = far ? GI[f.gi].far : GI[f.gi].near;
  seg(ctx, root, mid, null, leg ? W_THIGH : W_UPPER, col);
  seg(ctx, mid, end, null, leg ? W_SHIN : W_FORE, col);
  circle(ctx, end[0], end[1], leg ? 4.2 : 3.8, skin);
}

function body(ctx: Ctx, f: Fig, edge: boolean) {
  const skin = SKIN[f.gi === 'white' ? 0 : 1];
  if (edge) {
    seg(ctx, f.neck, f.hip, null, W_TORSO + EDGE, INK);
    circle(ctx, f.head[0], f.head[1], R_HEAD + EDGE / 2, INK);
    return;
  }
  seg(ctx, f.neck, f.hip, null, W_TORSO, GI[f.gi].near);
  // Lapel V from the neck toward the belt.
  const dx = f.hip[0] - f.neck[0];
  const dy = f.hip[1] - f.neck[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  ctx.strokeStyle = f.gi === 'white' ? 'rgba(120,110,95,0.55)' : 'rgba(20,40,70,0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(f.neck[0] - uy * 4, f.neck[1] + ux * 4);
  ctx.lineTo(f.neck[0] + ux * len * 0.45, f.neck[1] + uy * len * 0.45);
  ctx.lineTo(f.neck[0] + uy * 4, f.neck[1] - ux * 4);
  ctx.stroke();
  // Belt band across the torso near the hip, inked at both edges so it reads on a white gi too.
  const hw = W_TORSO / 2;
  const nx = -uy * hw;
  const ny = ux * hw;
  const b0: P = [f.neck[0] + ux * len * 0.76, f.neck[1] + uy * len * 0.76];
  const b1: P = [f.neck[0] + ux * len * 0.88, f.neck[1] + uy * len * 0.88];
  ctx.fillStyle = BELT;
  ctx.beginPath();
  ctx.moveTo(b0[0] + nx, b0[1] + ny);
  ctx.lineTo(b1[0] + nx, b1[1] + ny);
  ctx.lineTo(b1[0] - nx, b1[1] - ny);
  ctx.lineTo(b0[0] - nx, b0[1] - ny);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (const b of [b0, b1]) {
    ctx.moveTo(b[0] + nx, b[1] + ny);
    ctx.lineTo(b[0] - nx, b[1] - ny);
  }
  ctx.stroke();
  // Head: skin, then a hair cap on the back of the skull so facing reads.
  circle(ctx, f.head[0], f.head[1], R_HEAD, skin);
  const hx = f.head[0] - f.neck[0];
  const hy = f.head[1] - f.neck[1];
  const hl = Math.hypot(hx, hy) || 1;
  const up: P = [hx / hl, hy / hl];
  const faceV: P = [-up[1] * f.face, up[0] * f.face];
  const a = Math.atan2(up[1] * 0.75 - faceV[1] * 0.85, up[0] * 0.75 - faceV[0] * 0.85);
  ctx.fillStyle = f.hair ?? '#3b2618';
  ctx.beginPath();
  ctx.arc(f.head[0], f.head[1], R_HEAD, a - 1.75, a + 1.75);
  ctx.closePath();
  ctx.fill();
  // Ear dot + eye dot on the face side.
  circle(ctx, f.head[0] + faceV[0] * 5.2 + up[0] * 1.2, f.head[1] + faceV[1] * 5.2 + up[1] * 1.2, 1.1, '#2C2C2C');
}

/** Whole figure as one silhouette: every edge pass first, then fills (far limbs behind the torso). */
function figure(ctx: Ctx, f: Fig, skip: Part[] = []) {
  const parts: Part[] = (['armF', 'legF', 'body', 'legN', 'armN'] as Part[]).filter((p) => !skip.includes(p));
  for (const edge of [true, false]) {
    for (const p of parts) {
      if (p === 'body') body(ctx, f, edge);
      else limb(ctx, f, p, edge);
    }
  }
}

/** A single limb drawn later so it wraps over the partner (guard legs, seatbelt arm, hooks). */
function overlay(ctx: Ctx, f: Fig, part: Exclude<Part, 'body'>) {
  limb(ctx, f, part, true);
  limb(ctx, f, part, false);
}

function mirror(f: Fig): Fig {
  const m = (p: P): P => [VW - p[0], p[1]];
  return {
    ...f,
    head: m(f.head),
    neck: m(f.neck),
    hip: m(f.hip),
    armN: [m(f.armN[0]), m(f.armN[1])],
    armF: [m(f.armF[0]), m(f.armF[1])],
    legN: [m(f.legN[0]), m(f.legN[1])],
    legF: [m(f.legF[0]), m(f.legF[1])],
    face: (f.face * -1) as 1 | -1,
  };
}

/** Bottom player flat on their back, head to the left, knees up unless overridden. */
function lying(gi: Fig['gi'], over: Partial<Fig> = {}): Fig {
  return {
    head: [40, 95],
    neck: [52, 95],
    hip: [98, 96],
    armN: [[66, 104], [82, 104]],
    armF: [[64, 100], [78, 99]],
    legN: [[124, 76], [144, 101]],
    legF: [[120, 79], [138, 102]],
    gi,
    face: -1,
    hair: '#5a3a22',
    ...over,
  };
}

function mat(ctx: Ctx, w: number, h: number, floorY: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fbf1e2');
  g.addColorStop(1, TB.creamWall);
  rrect(ctx, 2, 2, w - 4, h - 4, 12, g);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 12);
  ctx.clip();
  // Wood wainscot + terracotta trim behind the mat.
  ctx.fillStyle = 'rgba(139,94,60,0.18)';
  ctx.fillRect(0, floorY - h * 0.2, w, h * 0.2);
  ctx.fillStyle = TB.terracotta;
  ctx.fillRect(0, floorY - h * 0.2 - 2, w, 2);
  // Tan tatame with a lit front lip; seams every panel.
  const tg = ctx.createLinearGradient(0, floorY, 0, h);
  tg.addColorStop(0, '#e7c983');
  tg.addColorStop(1, '#d4ad62');
  ctx.fillStyle = tg;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = 'rgba(255,248,225,0.7)';
  ctx.fillRect(0, floorY, w, 1.5);
  ctx.strokeStyle = 'rgba(140,100,40,0.35)';
  ctx.lineWidth = 1;
  for (let x = -20; x < w + 40; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x - 18, h);
    ctx.stroke();
  }
  ctx.restore();
  rrect(ctx, 2, 2, w - 4, h - 4, 12, undefined, 'rgba(44,44,44,0.35)', 1.2);
}

/** Soft contact shadow on the mat under a pose. */
function contact(ctx: Ctx, x: number, w: number) {
  ctx.fillStyle = 'rgba(90,60,20,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, 107, w, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPose(ctx: Ctx, pose: BjjPoseId) {
  switch (pose) {
    case 'de_pe': {
      // Grip fight: both upright in a staggered stance, hands on collar + sleeve.
      const a: Fig = {
        head: [101, 24],
        neck: [99, 35],
        hip: [93, 66],
        armN: [[108, 48], [120, 42]],
        armF: [[106, 54], [118, 58]],
        legN: [[99, 85], [104, 104]],
        legF: [[86, 85], [78, 104]],
        gi: 'white',
        face: 1,
      };
      const b = { ...mirror(a), gi: 'blue' as const, hair: '#1f1a17' };
      contact(ctx, 120, 56);
      figure(ctx, b);
      figure(ctx, a);
      break;
    }
    case 'guarda_fechada': {
      // Bottom on their back, legs locked around the kneeling partner's waist (crossed ankles behind).
      const bottom = lying('blue', {
        head: [50, 95],
        neck: [62, 95],
        hip: [110, 94],
        armN: [[88, 80], [114, 60]],
        armF: [[84, 86], [110, 66]],
        legN: [[134, 64], [156, 74]],
        legF: [[130, 68], [154, 80]],
      });
      const top: Fig = {
        head: [124, 34],
        neck: [128, 45],
        hip: [138, 80],
        armN: [[120, 66], [106, 86]],
        armF: [[124, 70], [112, 90]],
        legN: [[122, 101], [164, 104]],
        legF: [[128, 100], [168, 101]],
        gi: 'white',
        face: -1,
      };
      contact(ctx, 110, 74);
      figure(ctx, bottom, ['legN', 'legF']);
      figure(ctx, top);
      overlay(ctx, bottom, 'legF');
      overlay(ctx, bottom, 'legN');
      break;
    }
    case 'meia_guarda': {
      // Low wedge: top chest-down with hips high, one leg trapped between the bottom player's legs.
      const bottom = lying('blue', {
        head: [44, 94],
        neck: [56, 95],
        hip: [104, 97],
        armN: [[74, 84], [88, 74]],
        legN: [[130, 88], [150, 98]],
        legF: [[128, 100], [154, 90]],
      });
      const top: Fig = {
        head: [66, 76],
        neck: [78, 78],
        hip: [130, 64],
        armN: [[68, 90], [52, 88]],
        armF: [[92, 90], [100, 100]],
        legN: [[138, 90], [162, 103]],
        legF: [[158, 82], [182, 102]],
        gi: 'white',
        face: -1,
      };
      contact(ctx, 112, 84);
      figure(ctx, bottom, ['legN', 'legF']);
      figure(ctx, top, ['legN']);
      overlay(ctx, top, 'legN');
      overlay(ctx, bottom, 'legF');
      overlay(ctx, bottom, 'legN');
      break;
    }
    case 'cem_quilos': {
      // Side control: top kneels beside the flat partner, chest pressed across their chest, head low.
      const bottom = lying('blue', {
        armN: [[62, 84], [70, 72]],
        legN: [[126, 78], [148, 102]],
        legF: [[122, 82], [142, 103]],
      });
      const top: Fig = {
        head: [52, 72],
        neck: [64, 76],
        hip: [104, 76],
        armN: [[48, 88], [36, 100]],
        armF: [[80, 92], [94, 100]],
        legN: [[106, 100], [130, 108]],
        legF: [[116, 96], [138, 104]],
        gi: 'white',
        face: 1,
      };
      contact(ctx, 96, 80);
      figure(ctx, bottom);
      figure(ctx, top);
      break;
    }
    case 'joelho': {
      // Knee on belly: top tall and upright, shin across the belly, far leg posted wide, arm up for balance.
      const bottom = lying('blue', { armN: [[64, 86], [76, 76]] });
      const top: Fig = {
        head: [100, 21],
        neck: [102, 32],
        hip: [112, 62],
        armN: [[92, 52], [80, 72]],
        armF: [[122, 42], [134, 30]],
        legN: [[92, 84], [118, 90]],
        legF: [[136, 80], [148, 104]],
        gi: 'white',
        face: -1,
      };
      contact(ctx, 100, 70);
      figure(ctx, bottom);
      figure(ctx, top);
      break;
    }
    case 'montada': {
      // Mount: top sits upright on the partner's belly, knees on the mat on both sides, hands on chest.
      const bottom = lying('blue', {
        armN: [[60, 84], [68, 74]],
        armF: [[58, 88], [62, 78]],
        legN: [[124, 97], [150, 101]],
        legF: [[120, 100], [146, 103]],
      });
      const top: Fig = {
        head: [80, 36],
        neck: [82, 47],
        hip: [88, 82],
        armN: [[72, 64], [62, 88]],
        armF: [[78, 68], [66, 91]],
        legN: [[68, 102], [94, 106]],
        legF: [[108, 98], [100, 104]],
        gi: 'white',
        face: -1,
      };
      contact(ctx, 94, 70);
      figure(ctx, bottom);
      figure(ctx, top, ['legN']);
      overlay(ctx, top, 'legN');
      break;
    }
    case 'costas': {
      // Back control: both seated facing right, the back-taker behind with hooks in and a seatbelt hug.
      const front: Fig = {
        head: [132, 50],
        neck: [128, 61],
        hip: [118, 96],
        armN: [[140, 80], [152, 90]],
        armF: [[136, 84], [148, 94]],
        legN: [[146, 84], [170, 102]],
        legF: [[142, 88], [164, 104]],
        gi: 'blue',
        face: 1,
        hair: '#1f1a17',
      };
      const back: Fig = {
        head: [112, 44],
        neck: [108, 56],
        hip: [94, 96],
        armN: [[126, 66], [140, 78]],
        armF: [[114, 84], [130, 86]],
        legN: [[122, 86], [140, 94]],
        legF: [[118, 90], [136, 98]],
        gi: 'white',
        face: 1,
      };
      contact(ctx, 132, 58);
      figure(ctx, back, ['armN', 'legN']);
      figure(ctx, front);
      overlay(ctx, back, 'legN');
      overlay(ctx, back, 'armN');
      break;
    }
    case 'tap': {
      // Mount with the bottom player's free hand tapping the mat — the respectful "that's enough".
      const bottom = lying('blue', {
        armN: [[46, 106], [30, 110]],
        armF: [[58, 88], [62, 78]],
        legN: [[124, 97], [150, 101]],
        legF: [[120, 100], [146, 103]],
      });
      const top: Fig = {
        head: [80, 36],
        neck: [82, 47],
        hip: [88, 82],
        armN: [[72, 64], [62, 88]],
        armF: [[92, 62], [100, 76]],
        legN: [[68, 102], [94, 106]],
        legF: [[108, 98], [100, 104]],
        gi: 'white',
        face: -1,
      };
      contact(ctx, 90, 72);
      figure(ctx, bottom);
      figure(ctx, top, ['legN']);
      overlay(ctx, top, 'legN');
      ctx.strokeStyle = '#3a8a5c';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (const [r, a0, a1] of [[9, -2.4, -0.9], [15, -2.5, -0.8]] as const) {
        ctx.beginPath();
        ctx.arc(30, 110, r, a0, a1);
        ctx.stroke();
      }
      rrect(ctx, 14, 58, 38, 19, 6, '#3a8a5c', INK, 1.4);
      ctx.fillStyle = '#fff';
      ctx.font = '900 12px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TAP', 33, 68);
      break;
    }
    case 'fist_bump': {
      // Both standing tall after the roll, fists meeting in the middle.
      const a: Fig = {
        head: [98, 22],
        neck: [98, 33],
        hip: [98, 66],
        armN: [[108, 46], [117, 40]],
        armF: [[92, 50], [94, 62]],
        legN: [[102, 85], [106, 104]],
        legF: [[92, 85], [88, 104]],
        gi: 'white',
        face: 1,
      };
      const b = { ...mirror(a), gi: 'blue' as const, hair: '#1f1a17' };
      contact(ctx, 120, 50);
      figure(ctx, b);
      figure(ctx, a);
      ctx.strokeStyle = TB.mustard;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i - 2.5) * 0.42;
        ctx.beginPath();
        ctx.moveTo(120 + Math.cos(ang) * 8, 38 + Math.sin(ang) * 8);
        ctx.lineTo(120 + Math.cos(ang) * 14, 38 + Math.sin(ang) * 14);
        ctx.stroke();
      }
      break;
    }
  }
}

export function bjjPoseIdFromPt(positionPt: string): BjjPositionId {
  for (const [id, labels] of Object.entries(POSITION_LABELS) as [BjjPositionId, { pt: string }][]) {
    if (labels.pt === positionPt) return id;
  }
  if (/de pé/i.test(positionPt)) return 'de_pe';
  return 'de_pe';
}

export function drawBjjPose(ctx: Ctx, pose: BjjPoseId, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w / VW, h / VH);
  mat(ctx, w, h, h - (VH - 86) * s);
  ctx.save();
  ctx.translate((w - VW * s) / 2, h - VH * s);
  ctx.scale(s, s);
  drawPose(ctx, pose);
  ctx.restore();
}

export function paintBjjPoseCanvas(canvas: HTMLCanvasElement, pose: BjjPoseId) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 120;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBjjPose(ctx as Ctx, pose, w, h);
  canvas.dataset.pose = pose;
}
