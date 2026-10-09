// BJJ pair poses (see bjj-rig.mjs). Fighter A (white gi, the player) is always the dominant / upright one on the ground; B (blue gi) is the partner.
// Canvas 64 x 48, floor line y = 44, pair centred on x = 32. y is down.
import { clonePose, lerpPair, resolve, shiftFighter } from './bjj-rig.mjs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const F = (o) => ({ up: [0, -1], side: [1, 0], face: 'profile', spread: 0.7, hsp: 0.5, bendA: [1, 1], bendL: [-1, -1], z: {}, ...o });

/** Mirrors a fighter pose about x = 32 (bend signs flip, vectors flip in x). */
export function mirror(P, cx = 32) {
  const o = clonePose(P);
  const mx = (p) => [2 * cx - p[0], p[1]];
  o.head = mx(o.head); o.chest = mx(o.chest); o.hip = mx(o.hip);
  o.hands = o.hands.map(mx); o.feet = o.feet.map(mx);
  if (o.knees) o.knees = o.knees.map((p) => (p ? mx(p) : p));
  if (o.elbows) o.elbows = o.elbows.map((p) => (p ? mx(p) : p));
  o.up = [-o.up[0], o.up[1]]; o.side = [-o.side[0], o.side[1]];
  o.bendA = o.bendA.map((b) => -b); o.bendL = o.bendL.map((b) => -b);
  return o;
}

const POS = {};

// ---- de pé: both standing in a low stance, gripping collar and sleeve
POS.de_pe = () => {
  const A = F({
    head: [25, 19.5], up: [0.1, -1], face: 'profile', side: [1, 0],
    chest: [25.5, 27.5], hip: [23, 34.5],
    hands: [[0, 0], [0, 0]], feet: [[27.5, 44], [19.5, 44]], bendL: [-1, -1], bendA: [1, 1], spread: 0.3, hsp: 0.45,
    z: { arm1: 'under' },
  });
  const B = F({ ...mirror(A), z: { arm1: 'under' } });
  A.hands = [add(B.chest, [-2.5, -1.5]), add(B.chest, [-2, 5.5])];
  B.hands = [add(A.chest, [2.5, -1.5]), add(A.chest, [2, 5.5])];
  return { A, B, top: 'A' };
};

// Supine head: tilted a little so the face reads from the camera (the ¾ view shows a lying head almost upright).
const LYING = { up: [-0.5, -0.86], side: [0.86, -0.5], face: 'front' };

// ---- guarda fechada: B on the back, legs closed around A, A kneeling upright between them
POS.guarda_fechada = () => {
  const B = F({
    ...LYING, head: [12, 39.5],
    chest: [19.5, 41], hip: [27, 41],
    hands: [[28.5, 38], [30, 41.5]], elbows: [[25, 37.5], [27, 43.5]],
    feet: [[37, 39], [38.5, 36.5]], knees: [[31, 35], [32.5, 38]], spread: 0.8, hsp: 0.6,
    z: { leg0: 'over', leg1: 'under', arm0: 'under', arm1: 'under' },
  });
  const A = F({
    head: [29.5, 24.5], up: [0.2, -1], face: 'profile', side: [-1, 0],
    chest: [31, 31.5], hip: [33, 38.5], hands: [[26, 38.5], [24.5, 37]], elbows: [[30, 37.5], [28, 34.5]],
    feet: [[40.5, 43.5], [42, 43]], knees: [[35.5, 43], [37, 42.5]], spread: 0.5, hsp: 0.4,
    z: { arm1: 'under' },
  });
  return { A, B, top: 'A' };
};

// ---- meia guarda: A chest-down on B, one of A's legs trapped between B's legs
POS.meia_guarda = () => {
  const B = F({
    ...LYING, head: [11.5, 40.5],
    chest: [19, 41.5], hip: [27, 41.5],
    hands: [[22.5, 36], [24.5, 38]], elbows: [[20, 37.5], [21.5, 41]],
    feet: [[35.5, 41], [37.5, 43.5]], knees: [[32, 36], [32.5, 42.5]], spread: 0.8, hsp: 0.6,
    z: { leg0: 'over', arm0: 'over', arm1: 'over' },
  });
  const A = F({
    head: [19, 31.5], up: [-0.6, -0.8], face: 'three', side: [-1, 0.2],
    chest: [24.5, 34], hip: [31.5, 36], hands: [[14.5, 38.5], [28, 41.5]], elbows: [[18.5, 36], [24, 39.5]],
    feet: [[40.5, 43.5], [38, 42.5]], knees: [[35.5, 40], [35, 38]], spread: 0.6, hsp: 0.5, back: true,
    z: { arm1: 'under', leg1: 'under' },
  });
  return { A, B, top: 'A' };
};

// ---- cem quilos (side control): A lies across B's chest, a T seen from above
POS.cem_quilos = () => {
  const B = F({
    ...LYING, head: [10.5, 38],
    chest: [17.5, 39], hip: [25.5, 39],
    hands: [[20, 33], [25, 34]], elbows: [[17, 36], [27.5, 38]],
    feet: [[34, 40.5], [35, 37.5]], knees: [[30, 42], [30, 36]], spread: 0.8, hsp: 0.6,
    z: { arm0: 'over', arm1: 'over' },
  });
  const A = F({
    head: [20.5, 26.5], up: [0.1, -1], face: 'profile', side: [-1, 0],
    chest: [21.5, 32.5], hip: [23, 40.5], hands: [[12.5, 37], [30, 37.5]], elbows: [[15, 32.5], [28, 32]],
    feet: [[19.5, 45], [26.5, 45]], knees: [[19.5, 43], [26, 43]], spread: 0.9, hsp: 0.7, back: true,
  });
  return { A, B, top: 'A' };
};

// ---- joelho na barriga: A upright over B, a knee driven into B's belly
POS.joelho = () => {
  const B = F({
    ...LYING, head: [10, 40.5],
    chest: [17, 41], hip: [25, 41],
    hands: [[22, 35.5], [20, 36]], elbows: [[19, 39], [17.5, 38.5]],
    feet: [[34.5, 43], [34, 39]], knees: [[30, 40], [30, 37.5]], spread: 0.8, hsp: 0.6,
    z: { arm0: 'over', arm1: 'over' },
  });
  const A = F({
    head: [17, 18.5], up: [0.25, -1], face: 'three', side: [-1, 0.4],
    chest: [20, 26], hip: [25.5, 32], hands: [[15, 35.5], [26.5, 39]], elbows: [[16, 29.5], [27, 33.5]],
    feet: [[21, 44], [36, 44]], knees: [[21.5, 37.5], [32, 35]], spread: 0.7, hsp: 0.5,
    z: { leg1: 'under', arm1: 'under' },
  });
  return { A, B, top: 'A' };
};

// ---- montada: A sits on B's torso, knees at B's ribs
POS.montada = () => {
  const B = F({
    ...LYING, head: [10.5, 40],
    chest: [17.5, 41], hip: [25.5, 41],
    hands: [[21.5, 33.5], [24, 35]], elbows: [[18, 36.5], [22, 39]],
    feet: [[35, 42.5], [35.5, 39]], knees: [[30.5, 43], [30.5, 38]], spread: 0.8, hsp: 0.6,
    z: { arm0: 'over', arm1: 'over' },
  });
  const A = F({
    head: [20.5, 22], up: [0.1, -1], face: 'three', side: [-1, 0.3],
    chest: [22, 28.5], hip: [24.5, 35.5], hands: [[16, 36], [19, 38.5]], elbows: [[17.5, 31], [20, 34]],
    feet: [[28.5, 44], [29.5, 41]], knees: [[26, 41.5], [28.5, 37.5]], spread: 0.7, hsp: 0.7,
    z: { arm1: 'over', leg0: 'over', leg1: 'under' },
  });
  return { A, B, top: 'A' };
};

// ---- costas: A behind B, hooks in, arms around B's neck and chest (both reclined)
POS.costas = () => {
  const B = F({
    head: [33.5, 26.5], up: [0.35, -1], face: 'profile', side: [-1, 0],
    chest: [34.5, 33.5], hip: [31.5, 40], hands: [[38, 32.5], [39, 36]], feet: [[21.5, 43.5], [22.5, 42]], bendL: [-1, 1], bendA: [1, -1], spread: 0.3, hsp: 0.5,
    z: { arm1: 'under', arm0: 'under' },
  });
  const A = F({
    head: [40, 26.5], up: [0.1, -1], face: 'front', side: [1, 0],
    chest: [42, 34], hip: [38.5, 40.5], hands: [[32.5, 31], [33, 35]], feet: [[30.5, 42.5], [29.5, 40.5]], bendL: [-1, 1], bendA: [1, 1], spread: 0.6, hsp: 0.6,
    z: { leg0: 'over', arm0: 'over', arm1: 'over', head: 'under' },
  });
  return { A, B, top: 'B' };
};

export const POSITION_IDS = ['de_pe', 'guarda_fechada', 'meia_guarda', 'cem_quilos', 'joelho', 'montada', 'costas'];

/**
 * The ground positions are authored leaning left (the bottom fighter's head near the frame's edge): each one is shifted so the pair's
 * own width is centred on the anchor (x = 32), so the fight sits in the middle of the mat whichever way it faces.
 */
function centreDx(p) {
  const xs = [];
  for (const P of [p.A, p.B]) {
    const r = resolve(P);
    xs.push(r.head[0] - 5.5, r.head[0] + 5.5);
    for (const q of [r.chest, r.hip, ...r.hands, ...r.feet, ...r.knees, ...r.elbows]) xs.push(q[0] - 2, q[0] + 2);
  }
  return Math.round(32 - (Math.min(...xs) + Math.max(...xs)) / 2);
}

/** How far a position's authored pose is shifted to sit centred (0 standing). */
export const centreShift = (id) => (id === 'de_pe' ? 0 : centreDx(POS[id]()));
export const shiftPair = (p, dx) => ({ ...p, A: shiftFighter(p.A, dx, 0), B: shiftFighter(p.B, dx, 0) });
/** The pose as authored (not centred), for sets that edit it with absolute coordinates (the tap). */
export const rawPose = (id) => POS[id]();
export const positionPose = (id) => shiftPair(POS[id](), centreShift(id));
export { lerpPair, shiftFighter };
