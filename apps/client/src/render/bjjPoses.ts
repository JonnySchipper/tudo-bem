/**
 * Academia BJJ v0 — iso pose silhouettes (Art brief). Family-safe; no pain acting.
 */
import type { BjjPositionId } from '@tudobem/shared';
import { POSITION_LABELS } from '@tudobem/shared';
import { circle, rrect, type Ctx } from './draw';

export type BjjPoseId = BjjPositionId | 'tap' | 'fist_bump';

const GI = '#f5f2ea';
const GI_SHADE = '#d8d2c8';
const BELT = '#f5f5f5';
const SKIN = '#d9a07a';

function figure(ctx: Ctx, x: number, y: number, rot: number, top = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = top ? GI : GI_SHADE;
  rrect(ctx, -7, -18, 14, 20, 4, top ? GI : GI_SHADE);
  circle(ctx, 0, -24, 6, SKIN);
  ctx.fillStyle = BELT;
  rrect(ctx, -6, -6, 12, 3, 1, BELT);
  ctx.restore();
}

function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.strokeStyle = GI_SHADE;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
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
  rrect(ctx, 4, 4, w - 8, h - 8, 10, '#e8f0f4');
  rrect(ctx, 4, 4, w - 8, h - 8, 10, undefined, 'rgba(47,79,111,0.25)', 1);

  const cx = w / 2;
  const cy = h / 2 + 8;

  switch (pose) {
    case 'de_pe':
      figure(ctx, cx - 22, cy, 0);
      figure(ctx, cx + 22, cy, 0);
      break;
    case 'guarda_fechada':
      figure(ctx, cx, cy + 8, 0, false);
      figure(ctx, cx - 4, cy - 10, 0, true);
      limb(ctx, cx - 12, cy - 4, cx + 8, cy - 14);
      limb(ctx, cx + 8, cy - 14, cx + 18, cy - 6);
      break;
    case 'meia_guarda':
      figure(ctx, cx + 10, cy + 6, 0.2, true);
      figure(ctx, cx - 14, cy, -0.35, false);
      limb(ctx, cx - 6, cy + 4, cx + 4, cy - 8);
      break;
    case 'cem_quilos':
      figure(ctx, cx, cy - 6, 0, true);
      figure(ctx, cx - 8, cy + 10, 0, false);
      limb(ctx, cx, cy + 2, cx - 20, cy + 14);
      break;
    case 'joelho':
      figure(ctx, cx, cy - 8, 0, true);
      figure(ctx, cx - 6, cy + 12, 0, false);
      circle(ctx, cx + 2, cy + 2, 5, GI);
      break;
    case 'montada':
      figure(ctx, cx, cy - 12, 0, true);
      figure(ctx, cx - 4, cy + 14, 0, false);
      break;
    case 'costas':
      figure(ctx, cx - 6, cy + 8, 0, false);
      figure(ctx, cx + 8, cy - 6, 0.15, true);
      limb(ctx, cx + 4, cy - 2, cx - 10, cy + 4);
      break;
    case 'tap':
      figure(ctx, cx - 10, cy + 6, 0, false);
      figure(ctx, cx + 12, cy - 8, 0, true);
      circle(ctx, cx - 22, cy - 2, 5, SKIN);
      ctx.fillStyle = '#3a8a5c';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP', cx - 22, cy + 2);
      break;
    case 'fist_bump':
      figure(ctx, cx - 18, cy + 4, 0, false);
      figure(ctx, cx + 18, cy + 4, 0, false);
      circle(ctx, cx - 4, cy - 6, 4, SKIN);
      circle(ctx, cx + 4, cy - 6, 4, SKIN);
      break;
  }
}

export function paintBjjPoseCanvas(canvas: HTMLCanvasElement, pose: BjjPoseId) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 220;
  const h = canvas.clientHeight || 100;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBjjPose(ctx as Ctx, pose, w, h);
}
