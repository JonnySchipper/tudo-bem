// BJJ pair animation: 4-frame struggle loops, transitions between adjacent ladder positions, and the finish / win / bump / face-off sets.
import { clonePose, lerpPair, lerpFighter, shiftFighter, FX_COL, W, H } from './bjj-rig.mjs';
import { F, mirror, positionPose, rawPose, centreShift, shiftPair } from './bjj-poses.mjs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const pair = (A, B, top = 'A', fx) => ({ A, B, top, ...(fx ? { fx } : {}) });

// ------------------------------------------------------------------ struggle loops

const BREATH = [0, -0.7, -1.2, -0.7];
const BREATH_B = [-1.2, -0.7, 0, -0.7];
const SWAY = [0, 0.8, 0, -0.8];
const WRIGGLE = [0, -1.1, 0, 0.9];

/** Per-position struggle tuning: standing positions sway, ground positions breathe and wriggle. */
const STRUGGLE = {
  de_pe: { swayA: [0, 1, 0.4, -0.6], swayB: [0, -0.6, 0.4, 1], breath: 0.4, tug: [0, 1, 0, -1], wr: 0 },
  guarda_fechada: { swayA: SWAY, swayB: [0, 0, 0, 0], breath: 1, tug: [0, -1, 0, 1], wr: 0.8 },
  meia_guarda: { swayA: [0, 0.6, 0, -0.6], swayB: [0, 0, 0.5, 0], breath: 0.7, tug: [0, 1, 0, -1], wr: 1 },
  cem_quilos: { swayA: [0, 0.5, 0, -0.5], swayB: [0, 0, 0, 0], breath: 0.7, tug: [0, 1, 0, -1], wr: 1 },
  joelho: { swayA: [0, 0.6, 0, -0.6], swayB: [0, 0, 0, 0], breath: 1, tug: [0, -1, 0, 1], wr: 1 },
  montada: { swayA: SWAY, swayB: [0, 0, 0, 0], breath: 1, tug: [0, 1, 0, -1], wr: 0.8 },
  costas: { swayA: [0, 0.5, 0, -0.5], swayB: [0, -0.4, 0, 0.4], breath: 0.7, tug: [0, 1, 0, -1], wr: 0.7 },
};

/** Frame f (0..3) of the position's idle struggle: breathing, a little sway, hands changing grip, the bottom fighter's legs wriggling. */
export function struggle(id, f) {
  const base = positionPose(id);
  const S = STRUGGLE[id];
  let A = base.A, B = base.B;
  A = shiftFighter(A, S.swayA[f], BREATH[f] * S.breath, ['head', 'chest']);
  A = shiftFighter(A, S.swayA[f] * 0.5, BREATH[f] * S.breath * 0.6, ['hands']);
  A = shiftFighter(A, S.tug[f] * 0.7, 0, ['hands']);
  B = shiftFighter(B, S.swayB[f], BREATH_B[f] * S.breath * 0.7, ['head', 'chest']);
  if (S.wr) {
    const p = clonePose(B);
    p.feet = p.feet.map((q, i) => [q[0] + (i ? -1 : 1) * WRIGGLE[f] * 0.6 * S.wr, q[1] + (i ? 1 : -1) * WRIGGLE[f] * 0.4 * S.wr]);
    if (p.knees) p.knees = p.knees.map((q, i) => (q ? [q[0], q[1] + (i ? 1 : -1) * WRIGGLE[f] * 0.5 * S.wr] : q));
    B = p;
  }
  B = shiftFighter(B, -S.tug[f] * 0.5, 0, ['hands']);
  return pair(A, B, base.top);
}

// ------------------------------------------------------------------ transitions

export const LADDER = [
  ['de_pe', 'guarda_fechada'], ['de_pe', 'meia_guarda'],
  ['guarda_fechada', 'cem_quilos'], ['meia_guarda', 'cem_quilos'],
  ['cem_quilos', 'joelho'], ['joelho', 'montada'], ['joelho', 'costas'], ['montada', 'costas'],
];
export const TRANSITIONS = LADDER.flatMap(([a, b]) => [[a, b], [b, a]]);

const T_FRAMES = [0.17, 0.4, 0.64, 0.86];

/** Per-step arc: how much each fighter rises (px) at mid transition, and an optional tweak(pair, t). */
const LIFT = {
  'de_pe|guarda_fechada': { A: 1.5, B: 3 },
  'de_pe|meia_guarda': { A: 2, B: 2.5 },
  'guarda_fechada|cem_quilos': { A: 4, B: 1 },
  'meia_guarda|cem_quilos': { A: 2.5, B: 1 },
  'cem_quilos|joelho': { A: 4, B: 0 },
  'joelho|montada': { A: 4, B: 0 },
  'joelho|costas': { A: 2.5, B: 1 },
  'montada|costas': { A: 3.5, B: 3 },
};

export function transition(from, to, k) {
  const a = positionPose(from), b = positionPose(to);
  const t = T_FRAMES[k];
  const lift = LIFT[`${from}|${to}`] ?? LIFT[`${to}|${from}`] ?? { A: 2, B: 1 };
  const hump = Math.sin(Math.PI * t);
  const p = lerpPair(a, b, easeT(t));
  const up = (P, amt) => shiftFighter(P, 0, -amt * hump);
  return pair(up(p.A, lift.A), up(p.B, lift.B), p.top);
}
const easeT = (t) => t * t * (3 - 2 * t) * 0.35 + t * 0.65;

// ------------------------------------------------------------------ standing sets (win / bump / face-off)

const stand = (cx, dir, o = {}) => F({
  head: [cx, 20.5], up: [0, -1], face: 'profile', side: [dir, 0],
  chest: [cx, 28.5], hip: [cx - dir * 0.5, 35.5], feet: [[cx + dir * 3.5, 44], [cx - dir * 3.5, 44]],
  hands: [[cx + dir * 5, 33], [cx - dir * 3, 34]], bendL: [dir > 0 ? -1 : 1, dir > 0 ? -1 : 1], bendA: [1, 1], spread: 0.3, hsp: 0.4, ...o,
});

/** Front-facing standing fighter (the win pose). */
const front = (cx, o = {}) => F({
  head: [cx, 20.5], up: [0, -1], face: 'front', side: [1, 0],
  chest: [cx, 28.5], hip: [cx, 35.5], feet: [[cx + 3, 44], [cx - 3, 44]],
  hands: [[cx + 6, 34], [cx - 6, 34]], bendL: [-1, 1], bendA: [-1, 1], spread: 1.0, hsp: 0.55, ...o,
});

const spark = (x, y, n) => (cv, put) => {
  const pts = [[0, 0], [2, -1], [-2, -1], [0, -3], [3, 1], [-3, 1]].slice(0, n);
  for (const [dx, dy] of pts) put(cv, Math.round(x + dx), Math.round(y + dy), dx === 0 && dy === 0 ? FX_COL.w : FX_COL.y);
};

export function faceOff(f) {
  const bob = [0, -1][f];
  const A = stand(19.5, 1, { hands: [[27, 28.5 + bob * 0.5], [26, 33]], bendA: [1, 1] });
  const B = F({ ...mirror(A) });
  return pair(shiftFighter(A, 0, bob * 0.8, ['head', 'chest']), shiftFighter(B, 0, -bob * 0.8, ['head', 'chest']), 'A');
}

export function fistbump(f) {
  // hands rise and meet in the middle, a spark, then back
  const hx = [[27, 34], [29.5, 31.5], [31, 30.5], [30.5, 31.5]][f];
  const lean = [0, 0.6, 1.2, 0.8][f];
  const A = stand(20.5 + lean * 0.5, 1, { hands: [[hx[0], hx[1]], [17, 35]], bendA: [1, 1], head: [20.5 + lean, 20.5], z: { arm1: 'under' } });
  const B = F({ ...mirror(stand(20.5 + lean * 0.5, 1, { hands: [[hx[0], hx[1]], [17, 35]], bendA: [1, 1], head: [20.5 + lean, 20.5], z: { arm1: 'under' } })) });
  const fx = f >= 2 ? [spark(32, 29, f === 2 ? 3 : 6)] : [];
  return pair(A, B, 'A', fx);
}

export function winRaise(f) {
  const AX = 19, BX = 47;
  const up = [[AX + 8.5, 27], [AX + 7.5, 18], [AX + 6.2, 11.5]][f];
  const el = [[AX + 7, 29], [AX + 8, 23], [AX + 7.4, 20]][f];
  const hop = [0, -1, 0][f];
  const A = front(AX, { hands: [[AX - 6, 34], [up[0], up[1]]], elbows: [[AX - 6.5, 31], el], head: [AX, 20.5 + hop], chest: [AX, 28.5 + hop], hip: [AX, 35.5 + hop * 0.4], z: { arm1: 'over' } });
  const bow = [0.6, 1, 1.4][f];
  const B = front(BX, { head: [BX, 21 + bow], chest: [BX, 28.8 + bow * 0.4], hands: [[BX - 5.5, 34.5], [BX + 5.5, 34.5]], feet: [[BX + 3, 44], [BX - 3, 44]] });
  const fx = f === 2 ? [spark(AX + 9, 8, 6)] : [];
  return pair(A, B, 'A', fx);
}

// ------------------------------------------------------------------ finish: rear choke, B taps the mat

export function finishTap(f) {
  const dx = centreShift('costas');
  const p = finishTapRaw(f);
  return { ...shiftPair(p, dx), fx: p.fx.map((fx) => (cv, put) => fx(cv, (c, x, y, hex) => put(c, x + Math.round(dx * 0.84), y, hex))) };
}

function finishTapRaw(f) {
  const base = rawPose('costas');
  const A = clonePose(base.A), B = clonePose(base.B);
  // A: arm cinched around B's neck
  A.hands = [[31.5, 29.5], [32.5, 33.5]];
  A.elbows = [[36.5, 33], [37.5, 37]];
  A.z = { ...A.z };
  // B: head tipped back onto A's shoulder, eyes shut; one hand pulls at the choking arm, the other taps the mat
  B.head = [33.8, 26.7]; B.up = [0.5, -0.85]; B.eyes = 'shut';
  B.hands = [[34.5, 31], [24.5, 35]];
  B.elbows = [[37, 33], [31, 41.5]];
  B.z = { arm0: 'over', arm1: 'over' };
  const tap = [[24, 35.5], [24.5, 30], [24, 35.5], [24.5, 30]][f];
  B.hands[1] = tap;
  B.elbows[1] = [29, f % 2 === 0 ? 37.5 : 34];
  const fx = [(cv, put) => {
    const down = f % 2 === 0;
    const rays = down ? [[-3, 0], [-4, 2], [-3, -3], [0, 3], [-2, 4]] : [[-3, 0], [-2, 3]];
    for (const [dx, dy] of rays) put(cv, Math.round(tap[0] + dx), Math.round(tap[1] + dy), down ? FX_COL.Y : FX_COL.y);
    if (down) put(cv, Math.round(tap[0]), Math.round(tap[1] - 2), FX_COL.w);
  }];
  return pair(A, B, 'B', fx);
}

export { W, H, lerpFighter };
