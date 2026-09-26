import type { Appearance, BodyType, EmoteKind, IdlePose, NpcId } from '@tudobem/shared';

/**
 * Skeleton for the paper-doll. Local space: feet at y=0, up is −y, the figure faces +x (the caller
 * mirrors for SW/NW). ~6 heads tall (crown ≈ −88, head ≈ 14.6 high), per character brief v1.
 */
export interface Metrics {
  /** Half-widths. */
  sh: number;
  ch: number;
  wa: number;
  hp: number;
  belly: number;
  /** Limb radii. */
  arm: number;
  fore: number;
  wrist: number;
  thigh: number;
  knee: number;
  calf: number;
  ankle: number;
  neck: number;
  hand: number;
}

export const BODY: Record<BodyType, Metrics> = {
  esguio: { sh: 8.1, ch: 7.1, wa: 5.7, hp: 6.5, belly: 0, arm: 1.95, fore: 1.65, wrist: 1.2, thigh: 3.3, knee: 2.25, calf: 2.5, ankle: 1.4, neck: 1.75, hand: 1 },
  medio: { sh: 9.1, ch: 8.1, wa: 6.7, hp: 7.3, belly: 0.4, arm: 2.2, fore: 1.85, wrist: 1.3, thigh: 3.75, knee: 2.5, calf: 2.8, ankle: 1.55, neck: 1.95, hand: 1.05 },
  forte: { sh: 10.5, ch: 9.9, wa: 9, hp: 8.7, belly: 1.9, arm: 2.7, fore: 2.25, wrist: 1.55, thigh: 4.3, knee: 2.95, calf: 3.2, ankle: 1.8, neck: 2.45, hand: 1.15 },
};

export const Y = {
  ankle: -3.4,
  hip: -41.5,
  waist: -50.5,
  chest: -58.5,
  sh: -65.8,
  neck: -67.8,
  head: -78.4,
};
export const HEAD = { rx: 6.3, top: 7.4, chin: 7.2 };
export const THIGH = 19.2;
export const SHIN = 19.4;
export const UPPER_ARM = 12.4;
export const FOREARM = 11.4;
/** Sitting lowers the hips from −41.5 to ≈ −18 (bench/chair seat height). */
export const SIT_DROP = 23.5;
/** Seat surface height the default drop is tuned for. */
export const SEAT_H = 17;
export const sitDrop = (seatH = SEAT_H) => SIT_DROP - (seatH - SEAT_H);

export interface J {
  x: number;
  y: number;
}

export type HandKind = 'relaxed' | 'open' | 'fist' | 'thumb' | 'point' | 'pocket' | 'hold' | 'hip';

export interface Leg {
  hip: J;
  knee: J;
  ankle: J;
  /** Foot pitch: >0 toe down (push-off), <0 heel strike. */
  pitch: number;
  lift: number;
}

export interface Arm {
  sh: J;
  el: J;
  wr: J;
  hand: HandKind;
  /** Draw in front of the torso even when it is the far arm (crossed arms, gestures). */
  over: boolean;
}

export type Held = 'cup' | 'phone' | 'map' | 'hat' | 'towel' | null;

export interface Rig {
  m: Metrics;
  front: boolean;
  sitting: boolean;
  /** Far leg/arm first (drawn behind), near second. */
  legs: [Leg, Leg];
  arms: [Arm, Arm];
  /** Upper-body offset (bob, sway, breath). */
  bx: number;
  by: number;
  hipY: number;
  waistY: number;
  chestY: number;
  shY: number;
  neck: J;
  head: J & { tilt: number };
  /** Where the far hand's held item sits, if any. */
  held: [Held, Held];
  hipSway: number;
  skirtSwing: number;
  mouth: 'smile' | 'open' | 'laugh' | 'small' | 'calm' | 'grin';
  brows: 'rest' | 'up' | 'worried' | 'soft';
  eyes: 'open' | 'closed' | 'happy';
}

export interface RigState {
  a: Appearance;
  front: boolean;
  moving: boolean;
  sitting: boolean;
  /** Walk phase in radians. */
  phase: number;
  /** 0..1 breathing. */
  breath: number;
  blink: boolean;
  emote: EmoteKind | null;
  age: number;
  npc?: NpcId;
  /** 0..1 progress through an NPC's periodic gesture (Júlia points, Nanda shows a hat). */
  gesture: number;
  /** Seat surface height when sitting (bench ≈ 17, counter stool 28). */
  seatH?: number;
}

/** Two-bone IK; `bend` = which side of the root→target line the middle joint falls on (+x / −x). */
export function ik(root: J, target: J, l1: number, l2: number, bend: number): { mid: J; end: J } {
  let dx = target.x - root.x;
  let dy = target.y - root.y;
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.05;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  let px = -uy;
  let py = ux;
  if (px * bend < 0 || (px === 0 && py * bend > 0)) {
    px = -px;
    py = -py;
  }
  return { mid: { x: root.x + ux * a + px * h, y: root.y + uy * a + py * h }, end: { x: root.x + dx, y: root.y + dy } };
}

const smooth = (x: number) => x * x * (3 - 2 * x);
/** Ease in → hold → ease out over 0..1. */
const bell = (p: number) => (p <= 0 || p >= 1 ? 0 : p < 0.25 ? smooth(p / 0.25) : p > 0.8 ? smooth((1 - p) / 0.2) : 1);

export function buildRig(s: RigState): Rig {
  const m = BODY[s.a.body] ?? BODY.medio;
  const f = s.front ? 1 : -1;
  const idle: IdlePose = s.a.idle ?? 'solto';
  let bx = 0;
  let by = 0;
  let hipSway = 0;
  let skirtSwing = 0;
  let tilt = 0;
  let mouth: Rig['mouth'] = s.npc === 'carlos' ? 'calm' : 'smile';
  let brows: Rig['brows'] = 'rest';
  let eyes: Rig['eyes'] = s.blink ? 'closed' : 'open';

  const walkS = s.moving ? Math.sin(s.phase) : 0;
  if (s.moving) {
    by += Math.abs(walkS) * 1.3 - 0.4;
    bx += 0.5;
    skirtSwing = walkS;
  } else if (!s.sitting) {
    by -= s.breath * 0.35;
    if (!s.emote) hipSway = 0.9;
  }
  const e = s.emote;
  if (e === 'dancar') {
    by -= Math.abs(Math.sin(s.age * 9)) * 3.4;
    hipSway = Math.sin(s.age * 9) * 2.2;
    bx += hipSway * 0.5;
    mouth = 'open';
    eyes = 'happy';
  } else if (e === 'rir') {
    bx += Math.sin(s.age * 30) * 0.6;
    tilt = -0.1;
    mouth = 'laugh';
    eyes = 'happy';
    brows = 'up';
  } else if (e === 'oi') {
    mouth = 'open';
    brows = 'up';
  } else if (e === 'valeu') {
    mouth = 'grin';
    eyes = 'happy';
  } else if (e === 'desculpa') {
    mouth = 'small';
    brows = 'worried';
    tilt = 0.09;
    by -= 0.8;
  }
  if (!e && s.npc === 'carlos') brows = 'soft';

  const drop = s.sitting ? sitDrop(s.seatH) : 0;
  const hipY = Y.hip + drop + by * 0.6;
  const upper = drop + by;
  const waistY = Y.waist + upper;
  const chestY = Y.chest + upper - s.breath * 0.2;
  const shY = Y.sh + upper - (e === 'desculpa' ? 1.2 : 0);

  // ---- legs
  const hipX = [m.hp * 0.46, -m.hp * 0.5];
  const legs = [0, 1].map((i): Leg => {
    const hip = { x: hipX[i] + hipSway * 0.4, y: hipY + (i === 1 && !s.moving && !s.sitting && !e ? 0.7 : 0) };
    if (s.sitting) {
      const thigh = s.front ? { x: 15.4, y: 4.4 } : { x: 14.6, y: -4 };
      const spread = i === 0 ? 1.2 : -0.6;
      const knee = { x: hip.x + thigh.x + spread, y: hip.y + thigh.y + (i === 0 ? -0.6 : 0.6) };
      const ankle = { x: knee.x + 1.6, y: knee.y + SHIN * 0.93 };
      return { hip, knee, ankle, pitch: 0, lift: 0 };
    }
    const sgn = i === 0 ? 1 : -1;
    const sw = s.moving ? Math.sin(s.phase + (i === 0 ? Math.PI : 0)) : 0;
    const cw = s.moving ? Math.cos(s.phase + (i === 0 ? Math.PI : 0)) : 0;
    const lift = s.moving ? Math.max(0, cw) * 3.2 : 0;
    // Relaxed stance: weight on the far leg, the near foot eased forward with a soft knee.
    const easy = !s.moving && !e && i === 1 ? 1 : 0;
    const stance = idle === 'cintura' && easy ? -1.2 : 0;
    const baseX = sgn * m.hp * 0.44 + stance + easy * 1.6;
    const ax = baseX + sw * 6.4 + (e === 'dancar' ? hipSway * 0.3 : 0);
    const ay = Y.ankle + sw * 1.1 * f - lift + easy * 0.9 * f;
    const k = ik(hip, { x: ax, y: ay }, THIGH, SHIN, 1);
    return { hip, knee: k.mid, ankle: k.end, pitch: s.moving ? -sw * 0.35 + (cw < 0 ? 0 : cw * 0.25) : 0, lift };
  }) as [Leg, Leg];

  // ---- arms
  const shoulders: J[] = [
    { x: m.sh - m.arm * 0.95 + bx, y: shY + 2.5 },
    { x: -m.sh + m.arm * 0.95 + bx, y: shY + 2.5 },
  ];
  const held: [Held, Held] = [null, null];
  const arm = (i: 0 | 1, target: J, bend: number, hand: HandKind, over = false): Arm => {
    const sh = shoulders[i];
    const k = ik(sh, target, UPPER_ARM, FOREARM, bend);
    return { sh, el: k.mid, wr: k.end, hand, over };
  };
  const hang = (i: 0 | 1, swing: number, out: number): Arm => {
    const sh = shoulders[i];
    const len = UPPER_ARM + FOREARM - 0.9;
    const a = swing + out;
    return arm(i, { x: sh.x + Math.sin(a) * len, y: sh.y + Math.cos(a) * len }, -1, 'relaxed');
  };

  const sw = s.moving ? Math.sin(s.phase) * 0.46 : 0;
  let far = hang(0, sw, 0.1);
  let near = hang(1, -sw, -0.15);
  const hipAt = (i: 0 | 1): J => ({ x: (i === 0 ? m.hp + 0.6 : -m.hp - 0.6) + bx, y: hipY - 4.5 });
  const chestFront = (dx: number, dy = 0): J => ({ x: 2.6 + dx + bx, y: chestY + 4 + dy });

  if (s.sitting && !e) {
    far = arm(0, { x: legs[0].knee.x - 4, y: legs[0].knee.y - 3.2 }, -1, 'relaxed');
    near = arm(1, { x: legs[1].knee.x - 6, y: legs[1].knee.y - 2.6 }, -1, 'relaxed');
  } else if (!e) {
    const still = !s.moving;
    switch (idle) {
      case 'bolsos':
        near = arm(1, { x: -m.hp + 1.4 + bx, y: hipY + 0.5 }, -1, 'pocket');
        far = arm(0, { x: m.hp - 0.4 + bx, y: hipY + 0.5 }, -1, 'pocket');
        break;
      case 'bracos':
        if (still) {
          near = arm(1, chestFront(3.8, 1.5), -1, 'fist', true);
          far = arm(0, chestFront(-4.4, 0.3), -1, 'fist', true);
        }
        break;
      case 'celular':
        near = arm(1, chestFront(2.6, 1.8), -1, 'hold', true);
        held[1] = 'phone';
        if (still) tilt = 0.12;
        break;
      case 'cafe':
        near = arm(1, chestFront(3.4, 0.6), -1, 'hold', true);
        held[1] = 'cup';
        break;
      case 'cintura':
        if (still) far = arm(0, hipAt(0), 1, 'hip');
        break;
      case 'bolsa':
        if (still) near = arm(1, { x: -m.hp - 2 + bx, y: hipY - 3.6 }, -1, 'fist');
        break;
    }
    if (s.npc === 'carlos') held[0] = 'towel';
    if (s.npc === 'julia') {
      held[1] = 'map';
      near = arm(1, chestFront(1.2, 4.2), -1, 'hold', true);
      const p = bell(s.gesture);
      if (p > 0 && still) {
        const sh = shoulders[0];
        const reach = { x: sh.x + 17 * p + 5 * (1 - p), y: sh.y + 22 - 30 * p };
        far = arm(0, reach, 1, p > 0.5 ? 'point' : 'relaxed', true);
        brows = 'up';
        mouth = 'open';
      }
    }
    if (s.npc === 'nanda') {
      held[1] = 'hat';
      const p = bell(s.gesture);
      near = arm(1, chestFront(4.8, 3.4 - p * 9), -1, 'hold', true);
      if (still) far = arm(0, hipAt(0), 1, 'hip');
      if (p > 0.3) mouth = 'grin';
    }
  } else {
    const shN = shoulders[1];
    const shF = shoulders[0];
    if (e === 'oi') {
      const wv = Math.sin(s.age * 14);
      far = arm(0, { x: shF.x + 10.5 + wv * 3, y: shF.y - 17.5 }, 1, 'open', true);
    } else if (e === 'valeu') {
      near = arm(1, { x: shN.x + 10, y: shN.y + 7.5 }, -1, 'thumb', true);
    } else if (e === 'rir') {
      near = arm(1, { x: 1.5 + bx, y: waistY + 2.5 }, -1, 'open', true);
      far = arm(0, { x: m.hp + 2 + bx, y: waistY + 1 }, -1, 'open', true);
    } else if (e === 'desculpa') {
      near = arm(1, { x: shN.x + 9.5, y: waistY - 0.5 }, -1, 'open', true);
      far = arm(0, { x: shF.x + 6, y: waistY - 1.5 }, -1, 'open', true);
    } else if (e === 'dancar') {
      const q = Math.sin(s.age * 9);
      near = arm(1, { x: shN.x - 7 + q * 2.5, y: shN.y - 15 - q * 4 }, -1, 'open', true);
      far = arm(0, { x: shF.x + 8.5 - q * 2.5, y: shF.y - 15 + q * 4 }, 1, 'open', true);
    }
    if (s.sitting) {
      if (e !== 'oi' && e !== 'dancar' && e !== 'valeu') far = arm(0, { x: legs[0].knee.x - 4, y: legs[0].knee.y - 3.2 }, -1, 'relaxed');
    }
  }

  const neck = { x: 0.5 + bx * 0.9, y: Y.neck + upper - s.breath * 0.25 };
  const head = { x: 0.8 + bx + (s.moving ? 0.4 : 0), y: Y.head + upper - s.breath * 0.3 + (tilt > 0.1 ? 0.7 : 0), tilt };
  return { m, front: s.front, sitting: s.sitting, legs, arms: [far, near], bx, by, hipY, waistY, chestY, shY, neck, head, held, hipSway, skirtSwing, mouth, brows, eyes };
}
