/**
 * Academia BJJ v0 — side-view pose cards for the roll UI (Art brief). Two jointed figures (white gi vs
 * blue gi) with a charcoal silhouette edge, so every position reads by shape alone at ~100 px tall:
 * standing pair, upright guard, low wedge half guard, kneeling side control, tall knee-on-belly,
 * seated mount, stacked back take. Family-safe: grips and hugs only, no pain acting.
 */
import type { BjjPositionId } from '@tudobem/shared';
import { TB } from '../art/palette';
import { circle, rrect, type Ctx } from './canvas2d';

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
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 12);
  ctx.fillStyle = g;
  ctx.fill();
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

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (a: P, b: P, t: number): P => [lerpN(a[0], b[0], t), lerpN(a[1], b[1], t)];

function lerpFig(a: Fig, b: Fig, t: number): Fig {
  return {
    head: lerpP(a.head, b.head, t),
    neck: lerpP(a.neck, b.neck, t),
    hip: lerpP(a.hip, b.hip, t),
    armN: [lerpP(a.armN[0], b.armN[0], t), lerpP(a.armN[1], b.armN[1], t)],
    armF: [lerpP(a.armF[0], b.armF[0], t), lerpP(a.armF[1], b.armF[1], t)],
    legN: [lerpP(a.legN[0], b.legN[0], t), lerpP(a.legN[1], b.legN[1], t)],
    legF: [lerpP(a.legF[0], b.legF[0], t), lerpP(a.legF[1], b.legF[1], t)],
    gi: t < 0.5 ? a.gi : b.gi,
    face: t < 0.5 ? a.face : b.face,
    hair: t < 0.5 ? a.hair : b.hair,
  };
}

type PositionPair = { blue: Fig; white: Fig; contactX: number; contactW: number };

function positionPair(id: BjjPositionId): PositionPair {
  switch (id) {
    case 'de_pe': {
      const white: Fig = {
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
      const blue = { ...mirror(white), gi: 'blue' as const, hair: '#1f1a17' };
      return { blue, white, contactX: 120, contactW: 56 };
    }
    case 'guarda_fechada': {
      const blue = lying('blue', {
        head: [50, 95],
        neck: [62, 95],
        hip: [110, 94],
        armN: [[88, 80], [114, 60]],
        armF: [[84, 86], [110, 66]],
        legN: [[134, 64], [156, 74]],
        legF: [[130, 68], [154, 80]],
      });
      const white: Fig = {
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
      return { blue, white, contactX: 110, contactW: 74 };
    }
    case 'meia_guarda': {
      const blue = lying('blue', {
        head: [42, 96],
        neck: [54, 96],
        hip: [100, 97],
        armN: [[72, 82], [92, 66]],
        legN: [[124, 82], [148, 98]],
        legF: [[126, 101], [150, 86]],
      });
      const white: Fig = {
        head: [60, 78],
        neck: [71, 74],
        hip: [128, 44],
        armN: [[54, 90], [40, 86]],
        armF: [[84, 90], [90, 104]],
        legN: [[134, 76], [160, 98]],
        legF: [[168, 70], [204, 104]],
        gi: 'white',
        face: -1,
      };
      return { blue, white, contactX: 122, contactW: 92 };
    }
    case 'cem_quilos': {
      const blue = lying('blue', {
        armN: [[62, 106], [48, 110]],
        armF: [[60, 88], [74, 82]],
        legN: [[126, 96], [152, 101]],
        legF: [[122, 99], [148, 103]],
      });
      const white: Fig = {
        head: [40, 80],
        neck: [52, 82],
        hip: [100, 88],
        armN: [[34, 96], [24, 104]],
        armF: [[88, 98], [110, 102]],
        legN: [[112, 110], [140, 114]],
        legF: [[118, 104], [146, 108]],
        gi: 'white',
        face: 1,
      };
      return { blue, white, contactX: 94, contactW: 92 };
    }
    case 'joelho': {
      const blue = lying('blue', { armN: [[64, 86], [76, 76]] });
      const white: Fig = {
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
      return { blue, white, contactX: 100, contactW: 70 };
    }
    case 'montada': {
      const blue = lying('blue', {
        armN: [[60, 84], [68, 74]],
        armF: [[58, 88], [62, 78]],
        legN: [[124, 97], [150, 101]],
        legF: [[120, 100], [146, 103]],
      });
      const white: Fig = {
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
      return { blue, white, contactX: 94, contactW: 70 };
    }
    case 'costas': {
      const blue: Fig = {
        head: [134, 47],
        neck: [129, 59],
        hip: [136, 98],
        armN: [[154, 92], [160, 84]],
        armF: [[150, 94], [156, 88]],
        legN: [[158, 84], [182, 102]],
        legF: [[154, 88], [178, 104]],
        gi: 'blue',
        face: 1,
        hair: '#1f1a17',
      };
      const white: Fig = {
        head: [102, 38],
        neck: [104, 50],
        hip: [106, 100],
        armN: [[122, 70], [146, 84]],
        armF: [[124, 92], [144, 88]],
        legN: [[136, 80], [152, 92]],
        legF: [[130, 88], [148, 98]],
        gi: 'white',
        face: 1,
      };
      return { blue, white, contactX: 140, contactW: 62 };
    }
    default:
      return positionPair('de_pe');
  }
}

function renderPositionPair(ctx: Ctx, id: BjjPositionId, blue: Fig, white: Fig, decorT = 1) {
  switch (id) {
    case 'de_pe':
      figure(ctx, blue);
      figure(ctx, white);
      break;
    case 'guarda_fechada':
      figure(ctx, blue, ['legN', 'legF']);
      figure(ctx, white);
      overlay(ctx, blue, 'legF');
      overlay(ctx, blue, 'legN');
      break;
    case 'meia_guarda':
      figure(ctx, blue, ['legN', 'legF']);
      figure(ctx, white, ['legN']);
      overlay(ctx, white, 'legN');
      overlay(ctx, blue, 'legF');
      overlay(ctx, blue, 'legN');
      if (decorT > 0.35) ring(ctx, 146, 92, 13 * Math.min(1, decorT));
      break;
    case 'cem_quilos':
      figure(ctx, blue);
      figure(ctx, white);
      break;
    case 'joelho':
      figure(ctx, blue);
      figure(ctx, white);
      break;
    case 'montada':
      figure(ctx, blue);
      figure(ctx, white, ['legN']);
      overlay(ctx, white, 'legN');
      break;
    case 'costas':
      figure(ctx, white, ['armN', 'legN']);
      figure(ctx, blue, []);
      overlay(ctx, white, 'legN');
      overlay(ctx, white, 'armN');
      break;
    default:
      figure(ctx, blue);
      figure(ctx, white);
  }
}

function drawTweenedPosition(ctx: Ctx, from: BjjPositionId, to: BjjPositionId, t: number) {
  const a = positionPair(from);
  const b = positionPair(to);
  const blue = lerpFig(a.blue, b.blue, t);
  const white = lerpFig(a.white, b.white, t);
  contact(ctx, lerpN(a.contactX, b.contactX, t), lerpN(a.contactW, b.contactW, t));
  const recipe = t < 0.5 ? from : to;
  renderPositionPair(ctx, recipe, blue, white, t);
}

export type BjjGroundFx = 'gain' | 'loss' | 'hold';

function groundFx(ctx: Ctx, w: number, h: number, fx: BjjGroundFx, strength: number) {
  if (fx === 'hold' || strength <= 0) return;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  const c = fx === 'gain' ? 'rgba(58,138,92,' : 'rgba(180,72,52,';
  const a = strength * 0.22;
  if (fx === 'gain') {
    g.addColorStop(0, `${c}${a})`);
    g.addColorStop(0.35, 'rgba(0,0,0,0)');
  } else {
    g.addColorStop(0.65, 'rgba(0,0,0,0)');
    g.addColorStop(1, `${c}${a})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Soft contact shadow on the mat under a pose. */
function contact(ctx: Ctx, x: number, w: number) {
  ctx.fillStyle = 'rgba(90,60,20,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, 107, w, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Dashed mustard ring calling out the trapped leg in half guard. */
function ring(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.strokeStyle = TB.mustard;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Tap cue: motion arcs + a mustard burst at the tapping hand and a big green TAP chip. */
function tapAccent(ctx: Ctx, hx: number, hy: number, chipX: number, chipY: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = TB.mustard;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI + 0.35 + i * 0.6;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a) * 7, hy + Math.sin(a) * 7);
    ctx.lineTo(hx + Math.cos(a) * 12, hy + Math.sin(a) * 12);
    ctx.stroke();
  }
  ctx.strokeStyle = '#3a8a5c';
  ctx.lineWidth = 2.4;
  for (const r of [16, 22]) {
    ctx.beginPath();
    ctx.arc(hx, hy, r, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  }
  rrect(ctx, chipX, chipY, 46, 22, 7, '#3a8a5c', INK, 1.6);
  ctx.fillStyle = '#fff';
  ctx.font = '900 14px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TAP', chipX + 23, chipY + 11.5);
}

/**
 * Back control: both seated facing right, the front partner leaning back into the back-taker, whose
 * white shins hook over the blue thighs and whose arms cross the chest in a seatbelt hug (never the neck).
 */
function backControl(ctx: Ctx, tapping: boolean) {
  const front: Fig = {
    head: [134, 47],
    neck: [129, 59],
    hip: [136, 98],
    armN: tapping ? [[152, 96], [188, 108]] : [[154, 92], [160, 84]],
    armF: [[150, 94], [156, 88]],
    legN: [[158, 84], [182, 102]],
    legF: [[154, 88], [178, 104]],
    gi: 'blue',
    face: 1,
    hair: '#1f1a17',
  };
  const back: Fig = {
    head: [102, 38],
    neck: [104, 50],
    hip: [106, 100],
    armN: [[122, 70], [146, 84]],
    armF: [[124, 92], [144, 88]],
    legN: [[136, 80], [152, 92]],
    legF: [[130, 88], [148, 98]],
    gi: 'white',
    face: 1,
  };
  contact(ctx, 140, 62);
  figure(ctx, back, ['armN', 'legN']);
  figure(ctx, front, tapping ? ['armN'] : []);
  overlay(ctx, back, 'legN');
  overlay(ctx, back, 'armN');
  if (tapping) overlay(ctx, front, 'armN');
}

function drawPose(ctx: Ctx, pose: BjjPoseId, tapFrom: BjjPositionId | undefined) {
  switch (pose) {
    case 'de_pe':
    case 'guarda_fechada':
    case 'meia_guarda':
    case 'cem_quilos':
    case 'joelho':
    case 'montada':
    case 'costas': {
      const { blue, white, contactX, contactW } = positionPair(pose);
      contact(ctx, contactX, contactW);
      renderPositionPair(ctx, pose, blue, white, 1);
      break;
    }
    case 'tap': {
      if (tapFrom === 'costas') {
        // Back take finish: the front partner taps the mat beside their own knee.
        backControl(ctx, true);
        tapAccent(ctx, 188, 108, 150, 40);
        break;
      }
      // Mount finish: the bottom partner's free hand taps the mat — the respectful "that's enough".
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
      tapAccent(ctx, 30, 110, 12, 50);
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

export interface BjjPoseOpts {
  /** Position the submission is finished from (tap card): back control or mount. */
  tapFrom?: BjjPositionId;
  /** End-card ribbon: how the roll was won. */
  badge?: 'finalizacao' | 'decisao';
  /** Scramble tween between two mat positions (progress 0→1). */
  tween?: { from: BjjPositionId; to: BjjPositionId; progress: number };
  /** Ground gained / lost accent during scramble tween. */
  groundFx?: BjjGroundFx;
  fxStrength?: number;
}

/** Ribbon drawn in canvas px (not design space) so it stays legible on the small phone end card. */
function badge(ctx: Ctx, kind: NonNullable<BjjPoseOpts['badge']>, h: number) {
  const size = Math.max(9, Math.min(12, h * 0.1));
  const text = kind === 'finalizacao' ? 'FINAL' : 'DECISÃO';
  ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
  const tw = ctx.measureText(text).width;
  const icon = kind === 'finalizacao' ? size * 1.2 : 0;
  const bw = tw + icon + size * 1.4;
  const bh = size * 1.8;
  const x = 8;
  const y = 8;
  rrect(ctx, x, y, bw, bh, bh / 2, kind === 'finalizacao' ? TB.terracotta : TB.spGreen, INK, 1.2);
  if (icon) {
    const sx = x + size * 0.7 + icon / 2 - 1;
    const sy = y + bh / 2;
    ctx.fillStyle = TB.mustard;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? size * 0.25 : size * 0.55;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = TB.creamWall;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size * 0.7 + icon, y + bh / 2 + 0.5);
}

export function drawBjjPose(ctx: Ctx, pose: BjjPoseId, w: number, h: number, opts: BjjPoseOpts = {}) {
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w / VW, h / VH);
  mat(ctx, w, h, h - (VH - 86) * s);
  // Narrow cards (the phone end card) slide the figures right so the ribbon doesn't sit on their heads.
  const nudge = opts.badge && w < 220 ? Math.min(w * 0.2, 36) : 0;
  ctx.save();
  ctx.translate((w - VW * s) / 2 + nudge, h - VH * s);
  ctx.scale(s, s);
  if (opts.tween) drawTweenedPosition(ctx, opts.tween.from, opts.tween.to, opts.tween.progress);
  else drawPose(ctx, pose, opts.tapFrom);
  ctx.restore();
  if (opts.groundFx) groundFx(ctx, w, h, opts.groundFx, opts.fxStrength ?? 0.65);
  if (opts.badge) badge(ctx, opts.badge, h);
}

/** Ease-in-out scramble tween; respects prefers-reduced-motion. */
export function animateBjjPoseCanvas(
  canvas: HTMLCanvasElement,
  from: BjjPositionId,
  to: BjjPositionId,
  ms: number,
  opts: BjjPoseOpts = {},
): Promise<void> {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || ms <= 0 || from === to) {
    paintBjjPoseCanvas(canvas, to, opts);
    return Promise.resolve();
  }
  const fx = opts.groundFx ?? 'hold';
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - t0) / ms);
      const ease = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      const pulse = 1 - Math.abs(0.5 - ease) * 1.6;
      paintBjjPoseCanvas(canvas, to, {
        ...opts,
        tween: { from, to, progress: ease },
        groundFx: fx,
        fxStrength: Math.max(0, pulse),
      });
      if (raw < 1) requestAnimationFrame(tick);
      else {
        paintBjjPoseCanvas(canvas, to, opts);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

export function paintBjjPoseCanvas(canvas: HTMLCanvasElement, pose: BjjPoseId, opts: BjjPoseOpts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, globalThis.devicePixelRatio ?? 1);
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 120;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBjjPose(ctx as Ctx, pose, w, h, opts);
  canvas.dataset.pose = opts.tapFrom ? `${pose}:${opts.tapFrom}` : opts.badge ? `${pose}:${opts.badge}` : pose;
}
