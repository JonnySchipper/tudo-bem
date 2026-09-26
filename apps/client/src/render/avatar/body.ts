import type { Appearance, NpcId } from '@tudobem/shared';
import type { Ctx } from '../draw';
import { mix, rgba, tone, type Tone } from './color';
import { type Arm, type J, type Leg, type Rig } from './rig';
import { glow, limbBox, limbShape, line, paint, ptsBox, rnd, roundPoly, type LimbPt, type P, type PaintOpts } from './shape';

export interface Look {
  a: Appearance;
  skin: Tone;
  top: Tone;
  bottom: Tone;
  shoe: Tone;
  hair: Tone;
  /** Key-light side in local x. */
  L: number;
  rim: string;
  npc?: NpcId;
  front: boolean;
}

const po = (k: Look, extra: Partial<PaintOpts> = {}): PaintOpts => ({ L: k.L, rim: k.rim, ...extra });

export const APRON = '#a15e38';
const LEATHER = '#8e4a2a';
const GOLD = '#d6a53a';

// ---------------------------------------------------------------- legs + shoes

function legPts(leg: Leg, r: Record<'hip' | 'mid' | 'knee' | 'calf' | 'ankle', number>): LimbPt[] {
  const { hip, knee, ankle } = leg;
  const mid = { x: hip.x + (knee.x - hip.x) * 0.5, y: hip.y + (knee.y - hip.y) * 0.5 };
  const calf = { x: knee.x + (ankle.x - knee.x) * 0.3, y: knee.y + (ankle.y - knee.y) * 0.3 };
  return [
    { ...hip, r: r.hip },
    { ...mid, r: r.mid },
    { ...knee, r: r.knee },
    { ...calf, r: r.calf },
    { ...ankle, r: r.ankle },
  ];
}

const lerp = (a: J, b: J, t: number): J => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function drawLeg(ctx: Ctx, r: Rig, leg: Leg, i: number, k: Look) {
  const m = r.m;
  const b = k.a.bottom;
  const pants = b === 'calca';
  if (pants) drawShoe(ctx, leg, k, i);
  const skinPts = legPts(leg, { hip: m.thigh, mid: m.thigh * 0.9, knee: m.knee, calf: m.calf, ankle: m.ankle });
  if (!pants) {
    paint(ctx, () => limbShape(ctx, skinPts), k.skin, limbBox(skinPts), po(k, { lw: 0.45, rimA: 0.5 }));
    // Knee + calf form
    glow(ctx, leg.knee.x + 0.4, leg.knee.y + 0.6, 1.6, 1.1, k.skin.lo, 0.35);
    // Ankle socks
    const s = lerp(leg.ankle, leg.knee, 0.1);
    const sock = tone(k.a.shoes === 0 ? '#e6e2da' : '#f1ede4');
    const sp = [
      { ...leg.ankle, r: m.ankle + 0.35 },
      { ...s, r: m.ankle + 0.3 },
    ];
    paint(ctx, () => limbShape(ctx, sp), sock, limbBox(sp), po(k, { lw: 0.35, rimA: 0.3 }));
    drawShoe(ctx, leg, k, i);
  }
  if (pants) {
    const pts = legPts(leg, { hip: m.thigh + 0.6, mid: m.thigh + 0.3, knee: m.knee + 0.95, calf: m.knee + 1.05, ankle: m.ankle + 1.35 });
    paint(ctx, () => limbShape(ctx, pts), k.bottom, limbBox(pts), po(k, { lw: 0.5, rimA: 0.5 }));
    ctx.save();
    ctx.beginPath();
    limbShape(ctx, pts);
    ctx.clip();
    // Jeans fade on the thigh + knee break creases
    if (k.a.bottomColor === 2) glow(ctx, leg.hip.x * 0.6 + leg.knee.x * 0.4 + k.L * 0.8, (leg.hip.y + leg.knee.y) / 2, 2.2, 5.5, '#dfe8f5', 0.28);
    const kx = leg.knee.x;
    const ky = leg.knee.y;
    line(ctx, [[kx - 2.4, ky - 0.6], [kx - 0.2, ky + 0.8], [kx + 2.2, ky - 0.2]], k.bottom.lo, 0.5);
    line(ctx, [[kx - 1.6, ky + 3.2], [kx + 0.4, ky + 3.9], [kx + 2.3, ky + 3.1]], rgba(k.bottom.lo, 0.7), 0.4);
    line(ctx, [[leg.ankle.x - 2, leg.ankle.y - 3.4], [leg.ankle.x + 0.2, leg.ankle.y - 2.6], [leg.ankle.x + 2.6, leg.ankle.y - 3.6]], rgba(k.bottom.lo, 0.6), 0.4);
    // Outer seam (stitch)
    const seamSide = i === 0 ? 1 : -1;
    ctx.setLineDash([0.7, 0.6]);
    line(ctx, [[leg.hip.x + seamSide * (m.thigh - 0.2), leg.hip.y + 1], [kx + seamSide * (m.knee + 0.5), ky], [leg.ankle.x + seamSide * (m.ankle + 0.9), leg.ankle.y - 2]], rgba(k.bottom.hi, 0.55), 0.3);
    ctx.setLineDash([]);
    ctx.restore();
    // Rolled cuff
    const c1 = lerp(leg.ankle, leg.knee, 0.02);
    const c2 = lerp(leg.ankle, leg.knee, 0.1);
    const cuff = [
      { ...c1, r: m.ankle + 1.55 },
      { ...c2, r: m.ankle + 1.5 },
    ];
    paint(ctx, () => limbShape(ctx, cuff), tone(mix(k.bottom.base, '#fff6e6', 0.14)), limbBox(cuff), po(k, { lw: 0.4, rimA: 0.3 }));
  } else if (b === 'bermuda') {
    const end = lerp(leg.hip, leg.knee, 0.8);
    const pts = [
      { ...leg.hip, r: m.thigh + 0.75 },
      { ...lerp(leg.hip, leg.knee, 0.45), r: m.thigh + 0.55 },
      { ...end, r: m.knee + 1.35 },
    ];
    paint(ctx, () => limbShape(ctx, pts), k.bottom, limbBox(pts), po(k, { lw: 0.5 }));
    const a = lerp(leg.hip, leg.knee, 0.74);
    line(ctx, [[a.x - m.knee - 1.1, a.y + 0.2], [a.x + m.knee + 1.1, a.y - 0.3]], rgba(k.bottom.lo, 0.8), 0.45, false);
    const mid = lerp(leg.hip, leg.knee, 0.45);
    line(ctx, [[mid.x - 1.4, mid.y + 1], [mid.x + 0.6, mid.y + 2.2], [mid.x + 2, mid.y + 1.2]], rgba(k.bottom.lo, 0.6), 0.4);
  }
}

/** Sneaker (foot-local: x toward the toe, y down), rotated to the leg's heading. */
function drawShoe(ctx: Ctx, leg: Leg, k: Look, i: number) {
  const ang = (k.front ? 0.3 : -0.28) + leg.pitch + (i === 0 ? -0.05 : 0.05);
  const upper = k.shoe;
  const white = k.a.shoes === 0;
  const sole = tone(white ? '#dcd7ce' : '#f3efe6');
  ctx.save();
  ctx.translate(leg.ankle.x, leg.ankle.y);
  ctx.rotate(ang);
  const s = 1.06;
  ctx.scale(s, s);
  const up: P[] = [
    [-2.7, 2.3],
    [-2.8, -0.4],
    [-1.4, -1.5],
    [0.8, -1.3],
    [3.4, 0.2],
    [5.5, 1.3],
    [6, 2.4],
  ];
  paint(ctx, () => roundPoly(ctx, up, [1, 1.2, 0.8, 1.4, 1.6, 1.4, 0.6]), upper, ptsBox(up), po(k, { lw: 0.45, top: 0.18, rimA: 0.45 }));
  // Laces + collar + side panel
  line(ctx, [[-1.3, -1.2], [0.8, -1]], rgba(upper.deep, 0.7), 0.5);
  for (let n = 0; n < 3; n++) line(ctx, [[0.6 + n * 1.05, -0.9 + n * 0.55], [1.6 + n * 1.05, -0.3 + n * 0.55]], white ? '#b9b3aa' : rgba('#fff6e6', 0.85), 0.35, false);
  line(ctx, [[-2.2, 1.2], [0.4, 0.5], [2.8, 1.3]], white ? rgba('#8f887f', 0.55) : rgba('#fff6e6', 0.55), 0.55);
  // Sole
  const so: P[] = [
    [-3, 2.1],
    [6.1, 2.2],
    [6.2, 3.4],
    [-3, 3.5],
  ];
  paint(ctx, () => roundPoly(ctx, so, [0.8, 0.9, 0.9, 0.8]), sole, ptsBox(so), po(k, { lw: 0.4, rimA: 0.2 }));
  line(ctx, [[-2.6, 2.9], [5.8, 2.9]], rgba(sole.lo, 0.8), 0.3, false);
  ctx.restore();
}

// ---------------------------------------------------------------- bottoms (pelvis, skirt)

export function drawPelvis(ctx: Ctx, r: Rig, k: Look) {
  const m = r.m;
  const x = r.bx * 0.5 + r.hipSway * 0.4;
  if (k.a.bottom === 'saia') {
    drawSkirt(ctx, r, k);
    return;
  }
  const pts: P[] = [
    [-m.wa - 0.3 + x, r.waistY + 1],
    [m.wa + m.belly * 0.6 + 0.3 + x, r.waistY + 1],
    [m.hp + 0.9 + x, r.hipY + 0.5],
    [m.hp * 0.2 + x, r.hipY + 4.6],
    [-m.hp - 0.9 + x, r.hipY + 0.5],
  ];
  paint(ctx, () => roundPoly(ctx, pts, [2, 2, 2.6, 2, 2.6]), k.bottom, ptsBox(pts), po(k, { lw: 0.45, rimA: 0.4 }));
  if (r.front) {
    // Front pocket curves + fly
    line(ctx, [[-m.hp + 0.6 + x, r.hipY - 4.8], [-m.hp + 2.6 + x, r.hipY - 2.2], [-m.hp + 2.1 + x, r.hipY + 0.6]], rgba(k.bottom.lo, 0.8), 0.4);
    line(ctx, [[1.6 + x, r.waistY + 3.6], [1.9 + x, r.hipY + 2.4]], rgba(k.bottom.lo, 0.7), 0.35);
  } else {
    line(ctx, [[-4 + x, r.hipY - 3.8], [-1 + x, r.hipY - 3], [-1.4 + x, r.hipY]], rgba(k.bottom.lo, 0.7), 0.4);
    line(ctx, [[4.4 + x, r.hipY - 3.8], [1.6 + x, r.hipY - 3], [1.9 + x, r.hipY]], rgba(k.bottom.lo, 0.7), 0.4);
  }
}

function drawSkirt(ctx: Ctx, r: Rig, k: Look) {
  const m = r.m;
  const x = r.bx * 0.5 + r.hipSway * 0.5;
  const t = k.bottom;
  let pts: P[];
  if (r.sitting) {
    const [far, near] = r.legs;
    pts = [
      [-m.wa - 0.5 + x, r.waistY + 0.6],
      [m.wa + 0.6 + x, r.waistY + 0.6],
      [far.knee.x + 2.4, far.knee.y - 2.6],
      [near.knee.x + 2.6, near.knee.y + 2.8],
      [-m.hp - 1.8 + x, r.hipY + 3.2],
    ];
  } else {
    const sw = r.skirtSwing * 1.3;
    const hemY = -19.5;
    const wide = m.hp + 4.6;
    pts = [
      [-m.wa - 0.4 + x, r.waistY + 0.6],
      [m.wa + m.belly * 0.5 + 0.4 + x, r.waistY + 0.6],
      [wide + 0.4 + sw + x * 0.3, hemY - 0.6],
      [1.2 + sw, hemY + (r.front ? 2.2 : 0.6)],
      [-wide + sw * 0.6 + x * 0.3, hemY - 0.2],
    ];
  }
  paint(ctx, () => roundPoly(ctx, pts, [1.6, 1.6, 2.2, 5, 2.2]), t, ptsBox(pts), po(k, { lw: 0.5, fall: 0.25, rimA: 0.5 }));
  ctx.save();
  ctx.beginPath();
  roundPoly(ctx, pts, [1.6, 1.6, 2.2, 5, 2.2]);
  ctx.clip();
  const top = r.waistY + 2.5;
  const bot = pts[3][1];
  // Soft pleats
  for (const [fx, w] of [[-4.2, 0.55], [0.4, 0.5], [4.8, 0.55]] as const) {
    const hx = fx * 1.45 + (r.sitting ? 6 : r.skirtSwing * 1.1);
    line(ctx, [[fx * 0.7 + x, top], [fx + x * 0.6 + (hx - fx) * 0.5, (top + bot) / 2], [hx, bot + 1]], rgba(t.lo, 0.75), w);
    line(ctx, [[fx * 0.7 + x + 0.9, top + 1], [hx + 1, bot + 1]], rgba(t.hi, 0.45), 0.45, false);
  }
  ctx.restore();
  // Waistband
  const wb: P[] = [
    [-m.wa - 0.5 + x, r.waistY + 0.2],
    [m.wa + m.belly * 0.5 + 0.5 + x, r.waistY + 0.2],
    [m.wa + m.belly * 0.5 + 0.6 + x, r.waistY + 2],
    [-m.wa - 0.6 + x, r.waistY + 2],
  ];
  paint(ctx, () => roundPoly(ctx, wb, 0.8), tone(t.lo), ptsBox(wb), po(k, { lw: 0.35, rimA: 0.2 }));
}

// ---------------------------------------------------------------- torso + tops

function torsoPts(r: Rig, bulk: number, hemY: number, front: boolean): P[] {
  const m = r.m;
  const x = r.bx;
  const s = r.shY;
  const c = r.chestY;
  const w = r.waistY;
  const nx = r.neck.x;
  const hx = x * 0.5 + r.hipSway * 0.3;
  return [
    [-m.sh + 2 + x, s - 1.2 - bulk * 0.35],
    [-m.sh - 0.3 - bulk + x, s + 2.6],
    [-m.ch - bulk * 0.8 + x, c + 2.6],
    [-m.wa - bulk + x * 0.8, w + 0.6],
    [-m.hp - 0.8 - bulk + hx, hemY],
    [m.hp + 0.8 + bulk + m.belly * 0.4 + hx, hemY + (front ? 0.3 : -0.2)],
    [m.wa + bulk + m.belly + x * 0.8, w + 0.6],
    [m.ch + bulk * 0.8 + m.belly * 0.4 + x, c + 2.6],
    [m.sh + 0.3 + bulk + x, s + 2.6],
    [m.sh - 2 + x, s - 1.2 - bulk * 0.35],
    [nx + (front ? 3.1 : 2.6), s - 2.6],
    [nx + (front ? 0.9 : 0.2), s + (front ? 0.4 : -1.9)],
    [nx - 2.5, s - 2.5],
  ];
}

const TORSO_R = [3.2, 3, 3, 3, 1.4, 1.4, 3, 3, 3, 3.2, 1.2, 1.8, 1.2];

export function drawNeck(ctx: Ctx, r: Rig, k: Look) {
  const n = r.neck;
  const h = r.head;
  const w = r.m.neck + 0.45;
  const pts = [
    { x: n.x, y: r.shY + 1, r: w + 0.8 },
    { x: (n.x + h.x) / 2 - 0.2, y: (r.shY + h.y + 4.5) / 2, r: w },
    { x: h.x - 0.2, y: h.y + 4.2, r: w },
  ];
  paint(ctx, () => limbShape(ctx, pts), k.skin, limbBox(pts), po(k, { lw: 0.4, rimA: 0.35 }));
  // Chin occlusion
  if (r.front) glow(ctx, h.x + 0.6, h.y + 6.8, 3.4, 1.9, k.skin.deep, 0.55);
  else glow(ctx, h.x - 0.4, h.y + 5.4, 3.2, 1.6, k.skin.deep, 0.35);
}

export function drawTorso(ctx: Ctx, r: Rig, k: Look) {
  const m = r.m;
  const style = k.a.top;
  const t = k.top;
  const f = r.front;
  const x = r.bx;
  const cx = r.neck.x + (f ? 1.5 : -0.6);

  // Hem occlusion onto the bottoms
  const hemY = r.hipY + (style === 'moletom' ? 4.8 : style === 'camisa' ? 3.4 : 2.9);
  if (k.a.bottom !== 'saia' || !r.sitting) glow(ctx, x * 0.5 + 0.6, hemY + 0.8, m.hp + 2.2, 1.9, k.bottom.deep, 0.45);

  if (style === 'regata') {
    // Skin shoulders + upper chest under the tank
    const sk = torsoPts(r, 0, r.chestY + 4, f);
    paint(ctx, () => roundPoly(ctx, sk.slice(0, 3).concat(sk.slice(7)), TORSO_R.slice(0, 3).concat(TORSO_R.slice(7))), k.skin, ptsBox(sk), po(k, { lw: 0.45 }));
    glow(ctx, cx - 0.4, r.shY + 4.4, 3, 1.4, k.skin.lo, 0.3);
    const tank: P[] = [
      [-m.sh + 4.6 + x, r.shY - 0.4],
      [-m.sh + 2.6 + x, r.shY - 0.2],
      [-m.ch + 0.4 + x, r.chestY + 3.6],
      [-m.wa - 0.2 + x * 0.8, r.waistY + 0.6],
      [-m.hp - 0.8 + x * 0.5, hemY],
      [m.hp + 0.8 + m.belly * 0.4 + x * 0.5, hemY + 0.3],
      [m.wa + m.belly + 0.2 + x * 0.8, r.waistY + 0.6],
      [m.ch - 0.4 + m.belly * 0.4 + x, r.chestY + 3.6],
      [m.sh - 2.6 + x, r.shY - 0.2],
      [m.sh - 4.6 + x, r.shY - 0.4],
      [cx + (f ? 1.2 : 0.4), r.shY + (f ? 4.6 : 1.4)],
    ];
    paint(ctx, () => roundPoly(ctx, tank, [0.6, 0.6, 3, 3, 1.4, 1.4, 3, 3, 0.6, 0.6, 3.4]), t, ptsBox(tank), po(k, { lw: 0.5, fall: 0.18, top: 0.1 }));
    line(ctx, [[-m.sh + 4.4 + x, r.shY + 0.2], [cx + (f ? 1.2 : 0.4), r.shY + (f ? 4 : 1)], [m.sh - 4.4 + x, r.shY + 0.2]], rgba(t.lo, 0.8), 0.6);
    folds(ctx, r, k, hemY);
    return;
  }

  const bulk = style === 'moletom' ? 1.2 : style === 'camisa' ? 0.55 : 0.3;
  const pts = torsoPts(r, bulk, hemY, f);
  if (style === 'camisa') {
    // Shirt tail dips in the middle
    pts[4] = [pts[4][0], hemY - 0.8];
    pts[5] = [pts[5][0], hemY - 0.6];
    pts.splice(5, 0, [cx + 0.2, hemY + 1.1]);
  }
  const radii = style === 'camisa' ? [...TORSO_R.slice(0, 5), 3, ...TORSO_R.slice(5)] : TORSO_R;
  paint(ctx, () => roundPoly(ctx, pts, radii), t, ptsBox(pts), po(k, { lw: 0.55, fall: 0.2, top: 0.12, rimA: 0.6 }));
  ctx.save();
  ctx.beginPath();
  roundPoly(ctx, pts, radii);
  ctx.clip();
  folds(ctx, r, k, hemY);

  if (style === 'camiseta') {
    // Crew-neck rib
    const nx = r.neck.x;
    line(ctx, [[nx - 2.6, r.shY - 2.3], [nx + (f ? 0.9 : 0.2), r.shY + (f ? 0.9 : -1.4)], [nx + 3.2, r.shY - 2.4]], t.lo, 0.9);
    line(ctx, [[nx - 2.2, r.shY - 1.5], [nx + (f ? 0.9 : 0.2), r.shY + (f ? 1.5 : -0.8)], [nx + 2.8, r.shY - 1.6]], rgba(t.hi, 0.5), 0.35);
    if (!f) line(ctx, [[-m.sh + 2 + x, r.shY + 1.5], [m.sh - 2 + x, r.shY + 1.5]], rgba(t.lo, 0.35), 0.4);
  } else if (style === 'moletom') {
    // Ribbed hem band + kangaroo pocket
    const band: P[] = [
      [-m.hp - 1.6 + x * 0.5, hemY - 2.6],
      [m.hp + 1.6 + m.belly * 0.4 + x * 0.5, hemY - 2.4],
      [m.hp + 1.8 + m.belly * 0.4 + x * 0.5, hemY + 1],
      [-m.hp - 1.8 + x * 0.5, hemY + 1],
    ];
    paint(ctx, () => roundPoly(ctx, band, 0.8), tone(t.lo), ptsBox(band), po(k, { lw: 0, rimA: 0.2 }));
    for (let i = -3; i <= 4; i++) line(ctx, [[i * 1.9 + x * 0.5, hemY - 2.2], [i * 1.9 + x * 0.5 + 0.1, hemY + 0.6]], rgba(t.deep, 0.35), 0.3, false);
    if (f) {
      const pk: P[] = [
        [cx - 5.2, r.waistY + 1.2],
        [cx + 5.4, r.waistY + 1.2],
        [cx + 6.6, hemY - 2.8],
        [cx - 6.2, hemY - 2.8],
      ];
      ctx.beginPath();
      roundPoly(ctx, pk, [2, 2, 1, 1]);
      ctx.fillStyle = rgba(t.lo, 0.35);
      ctx.fill();
      ctx.strokeStyle = rgba(t.line, 0.6);
      ctx.lineWidth = 0.45;
      ctx.stroke();
      line(ctx, [[cx - 5, r.waistY + 1.8], [cx - 6.2, hemY - 3.2]], rgba(t.hi, 0.4), 0.4, false);
    } else {
      // Hood hanging on the back
      const hd: P[] = [
        [r.neck.x - 5.2, r.shY - 1.6],
        [r.neck.x + 4.6, r.shY - 1.6],
        [r.neck.x + 3.4, r.chestY + 1.5],
        [r.neck.x - 0.6, r.chestY + 4],
        [r.neck.x - 4.4, r.chestY + 1.2],
      ];
      paint(ctx, () => roundPoly(ctx, hd, [2.4, 2.4, 3, 3, 3]), t, ptsBox(hd), po(k, { lw: 0.5, top: 0.12 }));
      line(ctx, [[r.neck.x - 0.2, r.shY - 1], [r.neck.x - 0.6, r.chestY + 3.4]], rgba(t.lo, 0.8), 0.5);
    }
  } else if (style === 'camisa') {
    if (f) {
      // Placket + buttons + chest pocket
      line(ctx, [[cx, r.shY + 1.6], [cx + 0.15, hemY + 0.6]], rgba(t.lo, 0.9), 0.5, false);
      line(ctx, [[cx + 0.7, r.shY + 2], [cx + 0.85, hemY + 0.4]], rgba(t.hi, 0.6), 0.35, false);
      for (let i = 0; i < 4; i++) {
        const by = r.shY + 4 + i * 5.4;
        ctx.beginPath();
        ctx.arc(cx + 0.35, by, 0.45, 0, Math.PI * 2);
        ctx.fillStyle = t.deep;
        ctx.fill();
      }
      const pk: P[] = [
        [cx - 5.4, r.chestY - 2.2],
        [cx - 1.8, r.chestY - 2.2],
        [cx - 1.9, r.chestY + 1.8],
        [cx - 3.6, r.chestY + 2.6],
        [cx - 5.3, r.chestY + 1.8],
      ];
      ctx.beginPath();
      roundPoly(ctx, pk, 0.5);
      ctx.strokeStyle = rgba(t.lo, 0.9);
      ctx.lineWidth = 0.4;
      ctx.stroke();
    } else {
      line(ctx, [[-m.sh + 1.6 + x, r.shY + 3.6], [r.neck.x, r.shY + 4.6], [m.sh - 1.6 + x, r.shY + 3.6]], rgba(t.lo, 0.7), 0.45);
      line(ctx, [[r.neck.x - 0.5, r.shY + 5], [r.neck.x - 0.3, r.waistY]], rgba(t.lo, 0.45), 0.8);
    }
  }
  ctx.restore();

  if (style === 'camisa') collar(ctx, r, k);
  if (style === 'moletom' && f) {
    // Hood collar around the neck + drawstrings
    const nx = r.neck.x;
    const hc: P[] = [
      [nx - 5.4, r.shY + 0.6],
      [nx - 3.6, r.shY - 2.6],
      [nx + 4.4, r.shY - 2.6],
      [nx + 5.8, r.shY + 0.8],
      [nx + 1.6, r.shY + 4.2],
    ];
    paint(ctx, () => roundPoly(ctx, hc, [2, 2.4, 2.4, 2, 1.4]), t, ptsBox(hc), po(k, { lw: 0.5, top: 0.16 }));
    const inner: P[] = [
      [nx - 2.6, r.shY - 0.4],
      [nx + 3.4, r.shY - 0.4],
      [nx + 1.4, r.shY + 2.8],
    ];
    ctx.beginPath();
    roundPoly(ctx, inner, 1);
    ctx.fillStyle = t.deep;
    ctx.fill();
    const cord = '#efe6d6';
    line(ctx, [[nx - 0.4, r.shY + 2.6], [nx - 0.9, r.chestY + 3.5]], cord, 0.55, false);
    line(ctx, [[nx + 2.6, r.shY + 2.4], [nx + 3.1, r.chestY + 3.2]], cord, 0.55, false);
    for (const [ax, ay] of [[nx - 0.9, r.chestY + 3.5], [nx + 3.1, r.chestY + 3.2]]) line(ctx, [[ax, ay], [ax, ay + 1.2]], '#b9ad98', 0.7, false);
  }
}

function folds(ctx: Ctx, r: Rig, k: Look, hemY: number) {
  const m = r.m;
  const t = k.top;
  const x = r.bx;
  const shadowSide = -k.L;
  // Drag folds from the armpit on the shadow side, a softer one on the lit side, and hem wrinkles.
  line(ctx, [[shadowSide * (m.ch - 1.2) + x, r.chestY + 3.2], [shadowSide * (m.wa * 0.55) + x, r.waistY + 1.4], [shadowSide * 1.4 + x, hemY - 3]], rgba(t.lo, 0.6), 0.6);
  line(ctx, [[-shadowSide * (m.ch - 1.4) + x, r.chestY + 3.8], [-shadowSide * (m.wa * 0.5) + x, r.waistY + 1.8]], rgba(t.lo, 0.35), 0.5);
  line(ctx, [[-shadowSide * (m.ch - 1) + x, r.chestY + 3], [-shadowSide * (m.wa * 0.45) + x - 0.6 * shadowSide, r.waistY + 0.8]], rgba(t.hi, 0.35), 0.45);
  line(ctx, [[shadowSide * 2.2 + x, hemY - 1.6], [shadowSide * 4.8 + x, hemY - 2.4], [shadowSide * 6.4 + x, hemY - 1.2]], rgba(t.lo, 0.45), 0.45);
  if (m.belly > 1) line(ctx, [[-3 + x, r.waistY - 1], [1 + x, r.waistY + 0.4], [5 + m.belly + x, r.waistY - 0.8]], rgba(t.hi, 0.3), 0.6);
}

function collar(ctx: Ctx, r: Rig, k: Look) {
  const t = k.top;
  const nx = r.neck.x;
  const s = r.shY;
  const hi = tone(mix(t.base, '#fff6e6', 0.18));
  if (r.front) {
    const lft: P[] = [
      [nx - 3.2, s - 2.8],
      [nx - 0.6, s - 1.6],
      [nx + 0.9, s + 2.4],
      [nx - 3.8, s + 0.4],
    ];
    const rgt: P[] = [
      [nx + 3.8, s - 2.9],
      [nx + 1.4, s - 1.6],
      [nx + 1.1, s + 2.4],
      [nx + 4.6, s + 0.2],
    ];
    paint(ctx, () => roundPoly(ctx, lft, 0.6), hi, ptsBox(lft), po(k, { lw: 0.45, rimA: 0.2 }));
    paint(ctx, () => roundPoly(ctx, rgt, 0.6), hi, ptsBox(rgt), po(k, { lw: 0.45, rimA: 0.3 }));
  } else {
    const band: P[] = [
      [nx - 3.6, s - 3.2],
      [nx + 3.2, s - 3.2],
      [nx + 3.8, s - 0.8],
      [nx - 4, s - 0.8],
    ];
    paint(ctx, () => roundPoly(ctx, band, 0.8), hi, ptsBox(band), po(k, { lw: 0.45, rimA: 0.2 }));
  }
}

// ---------------------------------------------------------------- arms + hands

export function drawArm(ctx: Ctx, r: Rig, arm: Arm, i: number, k: Look) {
  const m = r.m;
  const style = k.a.top;
  const { sh, el, wr } = arm;
  const mid = lerp(el, wr, 0.45);
  const skinPts = [
    { ...sh, r: m.arm },
    { ...lerp(sh, el, 0.55), r: m.arm * 0.92 },
    { ...el, r: m.fore + 0.2 },
    { ...mid, r: m.fore },
    { ...wr, r: m.wrist },
  ];
  if (arm.hand !== 'pocket') drawHand(ctx, arm, k, i);
  const skinVisible = !(style === 'moletom');
  if (skinVisible) paint(ctx, () => limbShape(ctx, skinPts), k.skin, limbBox(skinPts), po(k, { lw: 0.45, rimA: 0.5 }));
  if (k.npc === 'carlos' && arm.hand !== 'pocket') {
    // Flour dust on the forearms, a watch on the near wrist
    for (let n = 0; n < 5; n++) glow(ctx, mid.x + (rnd(n, i) - 0.5) * 2.6, mid.y + (rnd(n, 7 + i) - 0.5) * 5, 0.9, 0.7, '#ffffff', 0.35);
    if (i === 1) {
      const w1 = lerp(wr, el, 0.1);
      const w2 = lerp(wr, el, 0.16);
      const band = [
        { ...w1, r: m.wrist + 0.2 },
        { ...w2, r: m.wrist + 0.3 },
      ];
      paint(ctx, () => limbShape(ctx, band), tone('#5a3a28'), limbBox(band), po(k, { lw: 0.25, rimA: 0.2 }));
      const wc = lerp(w1, w2, 0.5);
      ctx.beginPath();
      ctx.arc(wc.x + 0.5, wc.y, 0.75, 0, Math.PI * 2);
      ctx.fillStyle = '#e9e4d8';
      ctx.fill();
      ctx.strokeStyle = '#b5ab96';
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  }
  if (k.npc === 'nanda' && i === 1) {
    const cols = ['#d6a53a', '#c9582c', '#2e8a86'];
    cols.forEach((c, n) => {
      const p = lerp(wr, el, 0.1 + n * 0.07);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, m.wrist + 0.5, 0.55, Math.atan2(wr.y - el.y, wr.x - el.x) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });
  }
  const t = k.top;
  if (style === 'camiseta') {
    const end = lerp(sh, el, 0.5);
    const sl = [
      { ...sh, r: m.arm + 0.8 },
      { ...end, r: m.arm + 0.75 },
    ];
    paint(ctx, () => limbShape(ctx, sl), t, limbBox(sl), po(k, { lw: 0.5, top: 0.1 }));
    const hem = lerp(sh, el, 0.44);
    line(ctx, [[hem.x - m.arm, hem.y + 0.2], [hem.x + m.arm, hem.y - 0.2]], rgba(t.lo, 0.8), 0.45, false);
  } else if (style === 'moletom') {
    const sl = [
      { ...sh, r: m.arm + 1 },
      { ...lerp(sh, el, 0.5), r: m.arm + 0.95 },
      { ...el, r: m.fore + 1.25 },
      { ...lerp(el, wr, 0.6), r: m.fore + 1.05 },
      { ...lerp(el, wr, 0.9), r: m.wrist + 1.2 },
    ];
    paint(ctx, () => limbShape(ctx, sl), t, limbBox(sl), po(k, { lw: 0.5, top: 0.1 }));
    const c1 = lerp(el, wr, 0.8);
    const c2 = lerp(el, wr, 0.95);
    const cuff = [
      { ...c1, r: m.wrist + 1 },
      { ...c2, r: m.wrist + 0.9 },
    ];
    paint(ctx, () => limbShape(ctx, cuff), tone(t.lo), limbBox(cuff), po(k, { lw: 0.35, rimA: 0.2 }));
    line(ctx, [[el.x - 1.6, el.y - 1.2], [el.x + 0.4, el.y + 0.2], [el.x + 1.6, el.y - 0.8]], rgba(t.lo, 0.8), 0.45);
  } else if (style === 'camisa') {
    const sl = [
      { ...sh, r: m.arm + 0.6 },
      { ...lerp(sh, el, 0.6), r: m.arm + 0.5 },
      { ...lerp(sh, el, 0.96), r: m.fore + 0.7 },
    ];
    paint(ctx, () => limbShape(ctx, sl), t, limbBox(sl), po(k, { lw: 0.5, top: 0.1 }));
    const r1 = lerp(sh, el, 0.8);
    const r2 = lerp(sh, el, 1.02);
    const roll = [
      { ...r1, r: m.arm + 0.8 },
      { ...r2, r: m.fore + 0.9 },
    ];
    paint(ctx, () => limbShape(ctx, roll), tone(mix(t.base, '#fff6e6', 0.14)), limbBox(roll), po(k, { lw: 0.45, rimA: 0.3 }));
  }
}

function drawHand(ctx: Ctx, arm: Arm, k: Look, i: number) {
  const { el, wr } = arm;
  const ang = Math.atan2(wr.y - el.y, wr.x - el.x);
  const s = k.a.body === 'forte' ? 1.1 : k.a.body === 'esguio' ? 0.94 : 1;
  const t = k.skin;
  ctx.save();
  ctx.translate(wr.x, wr.y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  // Thumb faces forward (+x world): in hand space that's −y for a hanging arm.
  const th = Math.cos(ang) > 0.2 ? 1 : -1;
  const o = po(k, { lw: 0.4, rimA: 0.4 });
  const box = { x0: -1, x1: 4.5, y0: -2.6, y1: 2.6 };
  switch (arm.hand) {
    case 'open': {
      paint(ctx, () => ctx.ellipse(2.4, 0, 2.5, 1.75, 0, 0, Math.PI * 2), t, box, o);
      paint(ctx, () => ctx.ellipse(1.5, -th * 1.9, 1.2, 0.65, -th * 0.7, 0, Math.PI * 2), t, box, o);
      for (const fy of [-0.8, 0.1, 1]) line(ctx, [[3.4, fy], [4.6, fy * 1.25]], rgba(t.lo, 0.7), 0.3, false);
      break;
    }
    case 'thumb':
    case 'point':
    case 'fist':
    case 'hip':
    case 'hold': {
      paint(ctx, () => ctx.ellipse(1.9, 0, 1.95, 1.65, 0, 0, Math.PI * 2), t, box, o);
      line(ctx, [[2.9, -1], [3.2, 0.2], [2.9, 1.1]], rgba(t.lo, 0.8), 0.35);
      if (arm.hand === 'thumb') {
        ctx.rotate(-ang);
        paint(ctx, () => ctx.ellipse(0.9, -2.6, 0.75, 1.5, 0.15, 0, Math.PI * 2), t, box, o);
      } else if (arm.hand === 'point') {
        paint(ctx, () => ctx.ellipse(4.2, -0.5, 1.9, 0.6, 0, 0, Math.PI * 2), t, box, o);
      } else {
        paint(ctx, () => ctx.ellipse(1.6, -th * 1.45, 1.1, 0.6, -th * 0.5, 0, Math.PI * 2), t, box, o);
      }
      break;
    }
    default: {
      paint(ctx, () => ctx.ellipse(2.1, 0, 2.2, 1.5, 0, 0, Math.PI * 2), t, box, o);
      paint(ctx, () => ctx.ellipse(1.3, -th * 1.35, 1.15, 0.6, -th * 0.45, 0, Math.PI * 2), t, box, o);
      line(ctx, [[3.3, -0.7], [3.9, -0.8]], rgba(t.lo, 0.6), 0.3, false);
      line(ctx, [[3.4, 0.4], [4, 0.45]], rgba(t.lo, 0.6), 0.3, false);
    }
  }
  ctx.restore();
  void i;
}

// ---------------------------------------------------------------- held props

export function drawHeld(ctx: Ctx, r: Rig, i: 0 | 1, k: Look, drawHatAt: (ctx: Ctx, id: string, x: number, y: number, s: number, rot: number) => void) {
  const what = r.held[i];
  const arm = r.arms[i];
  if (!what || what === 'towel') return;
  const { wr, el } = arm;
  const ang = Math.atan2(wr.y - el.y, wr.x - el.x);
  const hx = wr.x + Math.cos(ang) * 2;
  const hy = wr.y + Math.sin(ang) * 2;
  const o = po(k, { lw: 0.4, rimA: 0.4 });
  if (what === 'cup') {
    // Copo americano with pingado
    const glass = tone('#e9eef0');
    const pts: P[] = [
      [hx - 1.5, hy - 4.6],
      [hx + 1.5, hy - 4.6],
      [hx + 1.2, hy - 0.2],
      [hx - 1.2, hy - 0.2],
    ];
    paint(ctx, () => roundPoly(ctx, pts, 0.4), glass, ptsBox(pts), o);
    const fill: P[] = [
      [hx - 1.35, hy - 3.6],
      [hx + 1.35, hy - 3.6],
      [hx + 1.1, hy - 0.5],
      [hx - 1.1, hy - 0.5],
    ];
    ctx.beginPath();
    roundPoly(ctx, fill, 0.3);
    ctx.fillStyle = '#b98555';
    ctx.fill();
    for (let n = -1; n <= 1; n++) line(ctx, [[hx + n * 0.75, hy - 3.9], [hx + n * 0.65, hy - 0.6]], rgba('#ffffff', 0.45), 0.25, false);
    ctx.beginPath();
    ctx.ellipse(hx, hy - 3.6, 1.35, 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e0c29a';
    ctx.fill();
    // Steam
    line(ctx, [[hx - 0.4, hy - 5.4], [hx + 0.4, hy - 6.6], [hx - 0.2, hy - 8]], rgba('#ffffff', 0.4), 0.35);
  } else if (what === 'phone') {
    ctx.save();
    ctx.translate(hx, hy - 1.2);
    ctx.rotate(-0.25);
    const pts: P[] = [
      [-1.3, -2.4],
      [1.3, -2.4],
      [1.3, 2.4],
      [-1.3, 2.4],
    ];
    paint(ctx, () => roundPoly(ctx, pts, 0.6), tone(k.a.topColor === 3 ? '#2e8a86' : '#c9582c'), ptsBox(pts), o);
    ctx.beginPath();
    ctx.arc(-0.5, -1.5, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#26252a';
    ctx.fill();
    ctx.restore();
  } else if (what === 'map') {
    ctx.save();
    ctx.translate(hx + 0.4, hy - 0.8);
    ctx.rotate(-0.18);
    const paper = tone('#f6eedc');
    const pts: P[] = [
      [-2.6, -2.2],
      [2.8, -2.6],
      [3, 2],
      [-2.4, 2.4],
    ];
    paint(ctx, () => roundPoly(ctx, pts, 0.3), paper, ptsBox(pts), o);
    line(ctx, [[0.2, -2.4], [0.3, 2.2]], rgba(paper.lo, 0.9), 0.3, false);
    line(ctx, [[-2, 1.2], [-0.6, -0.4], [1.2, 0.6], [2.4, -1.4]], '#c9582c', 0.4);
    line(ctx, [[-1.8, -1.2], [2.2, 1.2]], '#3a8a5c', 0.35, false);
    ctx.restore();
  } else if (what === 'hat') {
    drawHatAt(ctx, 'chapeu_palha', hx + 1.8, hy - 0.4, 0.62, -0.35);
  }
}

// ---------------------------------------------------------------- NPC signature layers

export function drawSignature(ctx: Ctx, r: Rig, k: Look) {
  const m = r.m;
  const x = r.bx;
  const f = r.front;
  const cx = r.neck.x + (f ? 1.5 : -0.6);
  if (k.npc === 'carlos') {
    const ap = tone(APRON);
    if (f) {
      // Bib apron: neck strap, waist tie, pocket with a pencil, flour dust.
      line(ctx, [[cx - 3, r.chestY - 3.4], [r.neck.x - 2.4, r.shY - 0.6]], ap.lo, 0.9, false);
      line(ctx, [[cx + 3.4, r.chestY - 3.4], [r.neck.x + 2.8, r.shY - 0.6]], ap.lo, 0.9, false);
      const pts: P[] = [
        [cx - 3.6, r.chestY - 3.6],
        [cx + 3.9, r.chestY - 3.6],
        [m.wa + m.belly + 0.4 + x * 0.8, r.waistY + 0.8],
        [m.hp + 2.2 + x * 0.5, r.hipY + 11.5],
        [-m.hp - 1.8 + x * 0.5, r.hipY + 11.2],
        [-m.wa - 0.3 + x * 0.8, r.waistY + 0.8],
      ];
      paint(ctx, () => roundPoly(ctx, pts, [0.8, 0.8, 3, 1.2, 1.2, 3]), ap, ptsBox(pts), po(k, { lw: 0.55, fall: 0.22, top: 0.12 }));
      ctx.save();
      ctx.beginPath();
      roundPoly(ctx, pts, [0.8, 0.8, 3, 1.2, 1.2, 3]);
      ctx.clip();
      ctx.setLineDash([0.8, 0.7]);
      line(ctx, pts.concat([pts[0]]).map(([px, py]) => [px + (px > cx ? -0.9 : 0.9), py + (py > r.waistY ? -0.9 : 0.9)] as P), rgba('#e0ae3c', 0.7), 0.3, false);
      ctx.setLineDash([]);
      line(ctx, [[cx - 0.4, r.waistY + 3], [cx + 0.9, r.hipY + 9]], rgba(ap.lo, 0.8), 0.6);
      line(ctx, [[cx + 4.6, r.waistY + 4], [cx + 5.8, r.hipY + 9]], rgba(ap.lo, 0.6), 0.5);
      for (let n = 0; n < 14; n++) glow(ctx, cx - 5 + rnd(n, 3) * 11, r.hipY - 4 + rnd(n, 9) * 14, 0.9 + rnd(n, 5), 0.6 + rnd(n, 5) * 0.6, '#fffaf0', 0.28);
      ctx.restore();
      const pk: P[] = [
        [cx - 4.6, r.hipY - 2.2],
        [cx + 5, r.hipY - 2.2],
        [cx + 5.2, r.hipY + 3.2],
        [cx - 4.8, r.hipY + 3.2],
      ];
      paint(ctx, () => roundPoly(ctx, pk, 0.8), tone(mix(APRON, '#2a1624', 0.12)), ptsBox(pk), po(k, { lw: 0.45, rimA: 0.3 }));
      line(ctx, [[cx + 0.2, r.hipY - 2], [cx + 0.2, r.hipY + 3]], rgba(ap.deep, 0.6), 0.35, false);
      line(ctx, [[cx + 2.6, r.hipY - 1.9], [cx + 3.4, r.hipY - 5.6]], '#e0b23a', 0.8, false);
      line(ctx, [[cx + 3.3, r.hipY - 5.3], [cx + 3.5, r.hipY - 6.1]], '#3a2a20', 0.8, false);
      // Waist tie on the far side
      line(ctx, [[m.wa + m.belly + x * 0.8, r.waistY + 1.6], [m.wa + m.belly + 2.2 + x, r.waistY + 5.4]], ap.lo, 0.8);
      line(ctx, [[m.wa + m.belly + x * 0.8, r.waistY + 1.6], [m.wa + m.belly + 1 + x, r.waistY + 6.2]], ap.lo, 0.7);
    } else {
      line(ctx, [[-m.wa - 0.4 + x, r.waistY + 1.4], [m.wa + m.belly + 0.4 + x, r.waistY + 1.4]], ap.base, 1.2, false);
      line(ctx, [[r.neck.x - 3, r.shY - 0.4], [r.neck.x + 2.6, r.shY - 0.4]], ap.base, 0.9, false);
      const bow = r.neck.x - 0.4;
      glow(ctx, bow, r.waistY + 1.4, 1.4, 0.9, ap.lo, 0.9);
      line(ctx, [[bow, r.waistY + 1.4], [bow - 1.2, r.waistY + 5]], ap.base, 0.8);
      line(ctx, [[bow, r.waistY + 1.4], [bow + 1, r.waistY + 5.4]], ap.base, 0.8);
    }
    // Pano de prato over the far shoulder
    const tw = tone('#f4efe6');
    const sx = m.sh - 3.2 + x;
    const pts: P[] = f
      ? [
          [sx - 1.8, r.shY - 1.6],
          [sx + 2.2, r.shY - 1.2],
          [sx + 2.6, r.chestY + 6.5],
          [sx - 1, r.chestY + 7],
        ]
      : [
          [sx - 2, r.shY - 1.6],
          [sx + 2, r.shY - 1.3],
          [sx + 1.8, r.chestY + 5],
          [sx - 1.8, r.chestY + 5.4],
        ];
    paint(ctx, () => roundPoly(ctx, pts, [1.4, 1.4, 0.4, 0.4]), tw, ptsBox(pts), po(k, { lw: 0.45, top: 0.1 }));
    const yb = pts[2][1] - 2.4;
    line(ctx, [[pts[3][0] + 0.2, yb], [pts[2][0] - 0.2, yb - 0.3]], '#b03a46', 0.8, false);
    line(ctx, [[pts[3][0] + 0.2, yb - 1.4], [pts[2][0] - 0.2, yb - 1.7]], '#3d5d8f', 0.45, false);
  } else if (k.npc === 'julia') {
    if (f) {
      // Lanyard + host badge
      const badge = { x: cx + 0.4, y: r.chestY + 3.2 };
      line(ctx, [[r.neck.x - 2.2, r.shY - 0.6], [badge.x - 0.6, badge.y - 2.4]], '#d6a53a', 0.6);
      line(ctx, [[r.neck.x + 2.8, r.shY - 0.6], [badge.x + 0.6, badge.y - 2.4]], '#d6a53a', 0.6);
      const b: P[] = [
        [badge.x - 1.9, badge.y - 2.4],
        [badge.x + 1.9, badge.y - 2.4],
        [badge.x + 1.9, badge.y + 2.4],
        [badge.x - 1.9, badge.y + 2.4],
      ];
      paint(ctx, () => roundPoly(ctx, b, 0.5), tone('#f6eedc'), ptsBox(b), po(k, { lw: 0.4, rimA: 0.3 }));
      ctx.fillStyle = '#2F5D50';
      ctx.fillRect(badge.x - 1.9, badge.y - 2.4, 3.8, 1.4);
      glow(ctx, badge.x, badge.y + 0.9, 0.8, 0.8, '#3f8a4a', 0.95);
      // Crossbody strap to a small leather bag on the far hip
      line(ctx, [[-m.sh + 2.8 + x, r.shY - 0.4], [m.wa + 1.2 + x, r.hipY - 4.5]], tone(LEATHER).lo, 1, false);
      line(ctx, [[-m.sh + 2.8 + x, r.shY - 0.8], [m.wa + 1.2 + x, r.hipY - 5]], rgba(tone(LEATHER).hi, 0.6), 0.35, false);
    } else {
      line(ctx, [[m.sh - 2.6 + x, r.shY - 0.4], [-m.wa - 1 + x, r.hipY - 4.5]], tone(LEATHER).lo, 1, false);
    }
    const bx = f ? m.wa + 1.2 + x : -m.wa - 1 + x;
    const bag: P[] = [
      [bx - 2.6, r.hipY - 6],
      [bx + 2.8, r.hipY - 6],
      [bx + 3, r.hipY - 1.2],
      [bx - 2.8, r.hipY - 1.2],
    ];
    paint(ctx, () => roundPoly(ctx, bag, [1.2, 1.2, 1.6, 1.6]), tone(LEATHER), ptsBox(bag), po(k, { lw: 0.45, top: 0.18 }));
    line(ctx, [[bx - 2.6, r.hipY - 3.8], [bx + 2.8, r.hipY - 3.8]], rgba(tone(LEATHER).deep, 0.8), 0.4, false);
    glow(ctx, bx + 0.1, r.hipY - 3.6, 0.6, 0.6, GOLD, 1);
  } else if (k.npc === 'nanda') {
    // Pochete across the waist
    const pc = tone('#66753f');
    line(ctx, [[-m.wa - 0.6 + x, r.waistY + 1.8], [m.wa + 0.6 + x, r.waistY + 1.4]], pc.lo, 1.1, false);
    if (f) {
      const px = cx - 1.6;
      const pts: P[] = [
        [px - 3.4, r.waistY - 0.6],
        [px + 3.4, r.waistY - 0.8],
        [px + 3.8, r.waistY + 3.8],
        [px - 3.6, r.waistY + 4],
      ];
      paint(ctx, () => roundPoly(ctx, pts, [2, 2, 1.4, 1.4]), pc, ptsBox(pts), po(k, { lw: 0.45, top: 0.16 }));
      line(ctx, [[px - 3, r.waistY + 0.8], [px + 3.2, r.waistY + 0.6]], '#c9c4b8', 0.35, false);
      glow(ctx, px + 2.6, r.waistY + 0.7, 0.55, 0.55, GOLD, 1);
      const patch: P[] = [
        [px - 1, r.waistY + 1.8],
        [px + 1.2, r.waistY + 1.8],
        [px + 1.2, r.waistY + 3.2],
        [px - 1, r.waistY + 3.2],
      ];
      ctx.beginPath();
      roundPoly(ctx, patch, 0.3);
      ctx.fillStyle = '#e0ae3c';
      ctx.fill();
    }
  }
}
