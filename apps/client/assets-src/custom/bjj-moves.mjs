// BJJ move clips and the standing grip loops (see apps/client/src/render/pixel/bjjClips.ts for the contract).
//
//  - standPair(you, partner, f): the standing idle with each fighter's grips held in the art (a fist on the lapel, a fist on the sleeve).
//  - clipFrames(def, hit): the 8 frames of a move. The mover is always art slot A. A clip starts on its `from` pose and a landed clip ends
//    exactly on its `to` pose (a miss ends back on `from`, or for a submission on the mirrored closed guard with the attacker underneath),
//    so the idle loops before and after are seamless. Frame 4 is the big one (the grip snap, the body in the air), frame 5 the landing.
//    Bodies in the air are turned joint by joint (rotateFighter), never as a tilted bitmap.
import { clonePose, lerpFighter, shiftFighter, rotateFighter, resolve, FX_COL } from './bjj-rig.mjs';
import { F, mirror, positionPose } from './bjj-poses.mjs';
import { CLIPS, CLIP_FRAMES, STAND_GRIPS, STAND_FRAMES } from '../../../client/src/render/pixel/bjjClips.ts';

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mid = (a, b) => lerp2(a, b, 0.5);
const fr = (A, B, top = 'A', fx) => ({ A, B, top, ...(fx?.length ? { fx } : {}) });

/** Authored px -> drawn canvas px (the pair is drawn at 0.84 around (32, 44)), for the baked fx sparks. */
const cvp = (p) => [32 + (p[0] - 32) * 0.84, 44 + (p[1] - 44) * 0.84];

/** New hands (the arms re-solve their elbows); `fists` closes the hands that hold the other's gi. */
function setHands(P, h0, h1, fists) {
  const o = clonePose(P);
  o.hands = [h0 ?? o.hands[0], h1 ?? o.hands[1]];
  o.elbows = undefined;
  if (fists) o.fists = fists;
  return o;
}
/** New feet (the legs re-solve their knees). */
function setFeet(P, f0, f1) {
  const o = clonePose(P);
  o.feet = [f0 ?? o.feet[0], f1 ?? o.feet[1]];
  o.knees = undefined;
  return o;
}
const sh = (P, dx, dy, parts) => shiftFighter(P, dx, dy, parts);
const up = (P, k) => shiftFighter(P, 0, -k);
const rot = (P, pivot, deg) => rotateFighter(P, pivot, deg);
const lf = (a, b, t) => lerpFighter(a, b, t);
const feetMid = (P) => mid(resolve(P).feet[0], resolve(P).feet[1]);
const R = (P) => resolve(P);
const tween = (Fp, Tp, t, liftA = 0, liftB = 0, top) => fr(up(lf(Fp.A, Tp.A, t), liftA), up(lf(Fp.B, Tp.B, t), liftB), top ?? (t < 0.5 ? Fp.top : Tp.top));
const withEyes = (P, eyes) => ({ ...clonePose(P), eyes });

// ------------------------------------------------------------------ fx (drawn space)

const sparks = (p, n = 5) => (cv, put) => {
  const [x, y] = cvp(p).map(Math.round);
  const pts = [[0, 0], [2, -1], [-2, -1], [1, -3], [-1, 2], [3, 1], [-3, 1]].slice(0, n);
  for (const [dx, dy] of pts) put(cv, x + dx, y + dy, dx === 0 && dy === 0 ? FX_COL.w : FX_COL.Y);
};
/** The grip snap: short white ticks around the fist. */
const snapLines = (p) => (cv, put) => {
  const [x, y] = cvp(p).map(Math.round);
  for (const [dx, dy] of [[-2, -2], [-3, -3], [2, -2], [3, -3], [0, -3], [0, -4]]) put(cv, x + dx, y + dy, FX_COL.w);
};
/** Impact lines on the mat under a body that just landed. */
const slam = (a, b) => (cv, put) => {
  const [x0, y0] = cvp(a).map(Math.round), [x1] = cvp(b).map(Math.round);
  for (let x = Math.min(x0, x1) - 2; x <= Math.max(x0, x1) + 2; x += 3) {
    put(cv, x, y0 + 2, FX_COL.y);
    put(cv, x + 1, y0 + 3, FX_COL.Y);
  }
  put(cv, x0 - 4, y0 - 1, FX_COL.w); put(cv, x0 - 5, y0 - 2, FX_COL.w);
  put(cv, x1 + 4, y0 - 1, FX_COL.w); put(cv, x1 + 5, y0 - 2, FX_COL.w);
};
/** The tap: a hand slapping the mat. */
const tapFx = (p, down) => (cv, put) => {
  const [x, y] = cvp(p).map(Math.round);
  const rays = down ? [[-3, 0], [3, 0], [-2, -2], [2, -2], [0, -3]] : [[-2, -1], [2, -1]];
  for (const [dx, dy] of rays) put(cv, x + dx, y + dy, down ? FX_COL.Y : FX_COL.y);
};

// ------------------------------------------------------------------ standing

const STAND = () =>
  F({
    head: [24.5, 19.5], up: [0.1, -1], face: 'profile', side: [1, 0],
    chest: [25, 27.5], hip: [22.5, 34.5], hands: [[0, 0], [0, 0]], feet: [[27, 44], [19, 44]],
    bendL: [-1, -1], bendA: [1, 1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' },
  });

const SWAY_A = [0, 1, 0.4, -0.6], SWAY_B = [0, -0.6, 0.4, 1], BREATH = [0, -0.5, -0.8, -0.5];
const hasC = (g) => g === 'c' || g === 'b';
const hasS = (g) => g === 's' || g === 'b';

/**
 * The two fighters on their feet, A on the left facing right. A held collar is a fist on the other's lapel, a held sleeve a fist on the
 * other's lead forearm; a free hand is up in front, hand-fighting. Being held by the collar pulls your head a little forward.
 */
export function standPair(ga = 'n', gb = 'n', f = 0) {
  let A = STAND();
  let B = { ...mirror(STAND()), z: { arm1: 'under' } };
  A = sh(A, SWAY_A[f], BREATH[f], ['head', 'chest']);
  B = sh(B, SWAY_B[f], BREATH[(f + 2) % 4], ['head', 'chest']);
  if (hasC(gb)) A = sh(A, 0.8, 0.6, ['head']);
  if (hasC(ga)) B = sh(B, -0.8, 0.6, ['head']);
  const lead = (me, other, dir, g) => (hasC(g) ? add(other.chest, [-dir * 1.6, -2.2]) : add(me.chest, [dir * 5.5, 0.5 + (f % 2) * 0.5]));
  const rear = (me, dir) => add(me.chest, [dir * 4, 4.5]);
  A = setHands(A, lead(A, B, 1, ga), rear(A, 1));
  B = setHands(B, lead(B, A, -1, gb), rear(B, -1));
  const forearm = (P) => { const r = R(P); return lerp2(r.elbows[0], r.hands[0], 0.5); };
  const sa = forearm(B), sb = forearm(A);
  if (hasS(ga)) A = setHands(A, null, sa);
  if (hasS(gb)) B = setHands(B, null, sb);
  A.fists = [hasC(ga), hasS(ga)];
  B.fists = [hasC(gb), hasS(gb)];
  if (hasS(ga)) A.z = { ...A.z, arm1: 'over' };
  if (hasS(gb)) B.z = { ...B.z, arm1: 'over' };
  return fr(A, B, 'A');
}

/** Every standing grip loop: [{ you, partner, f, pair }]. */
export function standSet() {
  const out = [];
  for (const a of STAND_GRIPS) for (const b of STAND_GRIPS) for (let f = 0; f < STAND_FRAMES; f++) out.push({ you: a, partner: b, f, pair: standPair(a, b, f) });
  return out;
}

// ------------------------------------------------------------------ roles

/** A position pose with the mover in slot A: on top (A body) or underneath (B body). */
function roles(p, bottom) {
  return bottom ? fr(p.B, p.A, p.top === 'A' ? 'B' : 'A') : fr(p.A, p.B, p.top);
}
const mirrorPair = (p) => fr(mirror(p.A), mirror(p.B), p.top, p.fx);

/** Grips the mover holds when the clip starts (the throws need theirs). */
const START_GRIP = { double_leg: 'c', single_leg: 's', body_lock: 'c', collar_drag: 'c', sleeve_pull: 's', hip_throw: 'b', posture: 'n', sprawl: 'n', collar_tie: 'n', sleeve_grip: 'n' };

function startPose(def) {
  if (def.from === 'de_pe') {
    // Postura answers a collar grip on you: the partner holds it at the start so the strip reads
    return standPair(START_GRIP[def.move] ?? 'n', def.move === 'posture' ? 'c' : 'n', 0);
  }
  return roles(positionPose(def.from), !!def.actorBottom);
}

function endPose(def) {
  const to = def.to ?? def.from;
  if (to === 'de_pe') {
    const g = def.move === 'collar_tie' ? 'c' : def.move === 'sleeve_grip' ? 's' : 'n';
    return standPair(g, 'n', 0);
  }
  const p = roles(positionPose(to), !!def.endBottom);
  return def.mirror ? mirrorPair(p) : p;
}

function missEnd(def, S) {
  if (!def.missTo) return S;
  return mirrorPair(roles(positionPose(def.missTo), true));
}

// ------------------------------------------------------------------ families
// Each returns 8 pairs. S = start, T = end (hit), M = end (miss). Frames 0-2 are shared by the hit and the miss.

function gripClip(def, S, T, hit) {
  const collar = def.move === 'collar_tie';
  const i = collar ? 0 : 1;
  const a0 = S.A, b0 = S.B;
  const target = T.A.hands[i];
  const chamber = add(R(a0).chest, [1, 1.5]);
  const f1 = fr(setHands(sh(a0, -0.6, 0, ['head', 'chest']), i === 0 ? chamber : null, i === 1 ? chamber : null), b0);
  const reach = lerp2(R(a0).hands[i], target, 0.7);
  const a2 = setHands(sh(a0, 1, 0, ['head', 'chest']), i === 0 ? reach : null, i === 1 ? reach : null);
  const f2 = fr(a2, b0);
  if (hit) {
    const fists = collar ? [true, false] : [false, true];
    const a3 = setHands(sh(a0, 1.2, 0, ['head', 'chest']), i === 0 ? target : null, i === 1 ? target : null, fists);
    const f3 = fr(a3, sh(b0, 0.4, -0.3, ['head']));
    // the snap: the grip yanks them in, their posture breaks forward
    const b4 = rot(sh(b0, -1.6, 0.4), feetMid(b0), -7);
    const pull = add(target, [-2, 0.8]);
    const a4 = setHands(sh(a0, -0.8, 0.2, ['head', 'chest']), i === 0 ? pull : null, i === 1 ? pull : null, fists);
    const f4 = fr(a4, b4, 'A', [snapLines(pull)]);
    const b5 = rot(sh(b0, -1, 0.3), feetMid(b0), -4);
    const f5 = fr(setHands(a4, i === 0 ? add(target, [-1.2, 0.5]) : null, i === 1 ? add(target, [-1.2, 0.5]) : null, fists), b5);
    const f6 = tween(fr(f5.A, f5.B), T, 0.6);
    return [S, f1, f2, f3, f4, f5, f6, T];
  }
  // the miss: they swat the reaching hand away and step off; the reach stumbles forward
  const wrist = add(R(a2).hands[i], [1, 0]);
  const b3 = setHands(sh(b0, 0.6, 0), null, wrist, [false, true]);
  const a3 = setHands(sh(a0, 1.4, 0, ['head', 'chest']), i === 0 ? add(R(a0).chest, [4, 5.5]) : null, i === 1 ? add(R(a0).chest, [4, 5.5]) : null);
  const a4 = rot(sh(a0, 1.5, 0.5), feetMid(a0), 9);
  const b4 = sh(b0, 1.6, 0);
  const a5 = rot(sh(a0, 0.8, 0.2), feetMid(a0), 4);
  return [S, f1, f2, fr(a3, b3), fr(a4, b4), fr(a5, sh(b0, 1, 0)), tween(fr(a5, sh(b0, 1, 0)), S, 0.6), S];
}

function postureClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B;
  const theirFist = R(b0).hands[0];
  const a1 = setHands(sh(a0, 0, 1.4, ['head', 'chest', 'hip']), add(theirFist, [0.5, 0.5]), add(theirFist, [0, 2]));
  const a2 = setHands(sh(a0, 0.6, -1.2, ['head', 'chest']), add(theirFist, [0, 1.5]), add(theirFist, [-0.5, 3]));
  const f1 = fr(a1, b0), f2 = fr(a2, b0);
  if (hit) {
    // stand tall and rip the grip off: their arm flies down and they rock back
    const a3 = setHands(sh(a0, 0.6, -1.8, ['head', 'chest']), add(theirFist, [0, 5]), add(theirFist, [-1, 6]));
    const b3 = setHands(rot(sh(b0, 1, 0), feetMid(b0), 8), add(R(b0).chest, [-1.5, 7]), null, [false, false]);
    const a4 = setFeet(setHands(sh(a0, 0, -2, ['head', 'chest']), add(R(a0).chest, [3.5, 6]), add(R(a0).chest, [2.5, 7])), [28.5, 44], [17.5, 44]);
    const b4 = setHands(sh(b0, 2.6, 0), add(R(b0).chest, [-3, 6]), add(R(b0).chest, [1, 6]), [false, false]);
    const a5 = setFeet(setHands(sh(a0, 0, -1, ['head', 'chest']), add(R(a0).chest, [5, 0]), add(R(a0).chest, [4, 3])), [28, 44], [18, 44]);
    const b5 = sh(T.B, 1.5, 0);
    return [S, f1, f2, fr(a3, b3, 'A', [snapLines(add(theirFist, [0, 2]))]), fr(a4, b4, 'A', [sparks(add(theirFist, [0, 4]), 4)]), fr(a5, b5), tween(fr(a5, b5), T, 0.6), T];
  }
  // the grip holds: they yank the posture down
  const b3 = rot(sh(b0, -0.5, 0), feetMid(b0), -4);
  const a3 = rot(sh(a0, 0.8, 0.6), feetMid(a0), 12);
  const a4 = rot(sh(a0, 1.2, 1), feetMid(a0), 16);
  return [S, f1, f2, fr(a3, b3), fr(a4, b3), fr(rot(a0, feetMid(a0), 6), b0), tween(fr(rot(a0, feetMid(a0), 3), b0), S, 0.6), S];
}

/** A sprawl with no shot to stop: the hips fly back and drop, hands on the mat, then back up (Base, the brace). */
function sprawlClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B;
  const a1 = sh(setFeet(a0, [26, 44], [17, 44]), -1, 2, ['head', 'chest', 'hip']);
  const low = F({ head: [29.5, 32.5], up: [0.6, -0.8], face: 'profile', side: [1, 0], chest: [26.5, 36], hip: [20, 39.5], hands: [[33, 44], [31, 44]], feet: [[13, 44], [10.5, 44]], bendL: [1, 1], bendA: [1, 1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' } });
  const flat = F({ ...low, head: [30.5, 35.5], up: [0.85, -0.5], chest: [26.5, 38.5], hip: [19, 41], hands: [[33.5, 44], [31.5, 44]], feet: [[11, 44.5], [8.5, 44.5]] });
  const f2 = fr(low, sh(b0, 0.8, 0)), f3 = fr(flat, sh(b0, 1.2, 0), 'A', hit ? [sparks([33, 44], 3)] : undefined);
  if (hit) return [S, fr(a1, b0), f2, f3, fr(sh(flat, 0, 0.3), sh(b0, 1.4, 0)), fr(lf(flat, a0, 0.35), sh(b0, 1, 0)), tween(fr(lf(flat, a0, 0.7), sh(b0, 0.5, 0)), T, 0.5), T];
  // slow: a knee hits the mat and they scramble back up
  const knee = F({ ...low, head: [27, 30], chest: [25, 34], hip: [21, 39], feet: [[24, 44], [14, 44]], hands: [[30, 40], [28, 41]] });
  return [S, fr(a1, b0), f2, fr(knee, sh(b0, 0.6, 0)), fr(sh(knee, 0, 0.5), b0), fr(lf(knee, a0, 0.5), b0), tween(fr(lf(knee, a0, 0.8), b0), S, 0.5), S];
}

/** Queda, Tornozelo, Abraço: level change, the shot, the lift, the body falling back in the air, the landing. */
function shootClip(def, S, T, hit, M) {
  const a0 = S.A, b0 = S.B;
  const rb = R(b0);
  const lock = def.move === 'body_lock', single = def.move === 'single_leg';
  // level change
  const a1 = setHands(sh(setFeet(a0, [28.5, 44], [18, 44]), 0.5, 3.5, ['head', 'chest', 'hip']), add(R(a0).chest, [4.5, 5]), add(R(a0).chest, [4, 6]));
  const f1 = fr(a1, setHands(b0, add(rb.chest, [-4, 3]), add(rb.chest, [-3, 5])));
  // the shot: a deep step in, head by their ribs, arms around the legs (one leg for Tornozelo, the waist for Abraço)
  const grab = lock ? [add(rb.chest, [1.5, 3.5]), add(rb.hip, [1, -1])] : single ? [add(rb.feet[0], [0.5, -6]), add(rb.feet[0], [1, -3.5])] : [add(rb.hip, [2, 3]), add(rb.hip, [3, 6])];
  const a2base = lock
    ? F({ head: [32, 22.5], up: [0.3, -1], face: 'profile', side: [1, 0], chest: [30.5, 29.5], hip: [26, 35.5], feet: [[31.5, 44], [20, 44]], hands: [[0, 0], [0, 0]], bendL: [-1, -1], bendA: [1, 1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' } })
    : F({ head: [34.5, 30], up: [0.75, -0.65], face: 'profile', side: [1, 0], chest: [29.5, 33], hip: [23, 36], feet: [[32, 44], [16, 44]], hands: [[0, 0], [0, 0]], bendL: [-1, -1], bendA: [1, 1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' } });
  const a2 = setHands(a2base, grab[0], grab[1], [true, true]);
  const b2 = setHands(sh(b0, 0.5, 0), add(R(a2).chest, [1, -3]), add(R(a2).chest, [3, -2]));
  const f2 = fr(a2, b2);
  if (hit) {
    // lift and drive: their feet leave the mat, the body tips back
    const piv = rb.hip;
    const b3 = rot(up(single ? setFeet(b2, add(rb.feet[0], [-3, -7]), null) : b2, 2.5), piv, lock ? 18 : 26);
    const a3 = setHands(sh(a2, 2.5, -1.5, ['head', 'chest']), grab[0] && add(grab[0], [2, -2]), grab[1] && add(grab[1], [2, -2.5]), [true, true]);
    // in the air: nearly flat, falling back, arms flung
    const b4 = setHands(rot(up(b2, 4), piv, 72), null, null);
    const b4b = setHands(b4, add(R(b4).chest, [-2, -6]), add(R(b4).chest, [3, -6]));
    const a4 = lf(a3, T.A, 0.45);
    const fall = R(T.B);
    const f5A = up(T.A, 1.6);
    const f5B = setHands(T.B, add(fall.chest, [-2, -4]), add(fall.chest, [3, -4]));
    return [
      S, f1, f2,
      fr(a3, b3, 'A'),
      fr(a4, b4b, 'A', [sparks(mid(R(a4).head, R(b4b).hip), 4)]),
      fr(f5A, f5B, T.top, [slam(fall.head, fall.hip)]),
      fr(up(T.A, 0.6), T.B, T.top),
      T,
    ];
  }
  // stuffed: they sprawl on top, flatten the shot, and everyone scrambles back up
  const bS = F({ head: [31, 25.5], up: [-0.6, -0.8], face: 'profile', side: [-1, 0], chest: [34, 30.5], hip: [41, 35], feet: [[47.5, 44], [51, 44]], hands: [[27.5, 33], [29.5, 35]], bendL: [1, 1], bendA: [-1, -1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' } });
  const aS = F({ ...a2base, head: [31, 36.5], up: [0.85, -0.5], chest: [26.5, 37.5], hip: [20.5, 39.5], feet: [[24, 44], [14, 44]], hands: [[33, 41], [31, 42]] });
  const f3 = fr(aS, bS, 'B', [sparks([31, 31], 3)]);
  const f4 = fr(sh(aS, 0, 0.6), sh(bS, 0, 0.5), 'B');
  const f5 = fr(lf(aS, a0, 0.4), lf(bS, b0, 0.35), 'B');
  return [S, f1, f2, f3, f4, f5, tween(f5, M, 0.7), M];
}

/** Arremesso: the pull, the turn in under their hips, the lift over the hip, the body upside down in the air, the landing in front. */
function throwClip(def, S, T, hit, M) {
  const a0 = S.A, b0 = S.B;
  const rb = R(b0);
  const piv = feetMid(b0);
  const b1 = rot(b0, piv, -12);
  const a1 = setHands(sh(a0, -1.2, 0, ['head', 'chest']), add(R(b1).chest, [-2, -1]), add(R(a0).chest, [1, 2]), [true, true]);
  // the turn in: back to their belly, hips under theirs, knees bent
  const turn = F({ head: [30.5, 23.5], up: [-0.2, -1], face: 'profile', side: [-1, 0], chest: [32, 30], hip: [35.5, 35.5], feet: [[30, 44], [38.5, 44]], hands: [[0, 0], [0, 0]], bendL: [1, 1], bendA: [-1, -1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' } });
  const b2 = sh(rot(b0, piv, -30), 0, 0.5);
  const a2 = setHands(turn, add(R(b2).chest, [-2, 1]), add(R(turn).chest, [-4, 3]), [true, true]);
  if (hit) {
    const hip = R(a2).hip;
    const b3 = rot(up(b2, 2), add(hip, [0, -2]), -70);
    const a3 = setHands(F({ ...turn, head: [30.5, 27], up: [-0.6, -0.8], chest: [33, 31.5], hip: [37.5, 35.5] }), add(R(b3).chest, [0, 1]), add(R(turn).chest, [-6, 4]), [true, true]);
    const b4 = rot(up(b2, 5), add(hip, [-1, -2]), -150);
    const a4 = setHands(F({ ...turn, head: [28, 30], up: [-0.8, -0.6], chest: [32, 33], hip: [37.5, 36] }), add(R(b4).chest, [1, 1]), add(R(turn).chest, [-7, 6]), [true, true]);
    const fall = R(T.B);
    const a5 = lf(a4, T.A, 0.55);
    return [
      S, fr(a1, b1), fr(a2, b2, 'A'),
      fr(a3, b3, 'B'),
      fr(a4, b4, 'B', [sparks(add(R(b4).hip, [0, -2]), 5)]),
      fr(a5, setHands(T.B, add(fall.chest, [-2, -4]), add(fall.chest, [2, -5])), T.top, [slam(fall.head, fall.hip)]),
      fr(lf(a5, T.A, 0.7), T.B, T.top),
      T,
    ];
  }
  // they drop their hips and the throw stalls on the hip; the turn unwinds
  const b3 = F({ ...clonePose(b2), hip: add(R(b2).hip, [2.5, 3]), chest: add(R(b2).chest, [1.5, 2.5]), head: add(R(b2).head, [1, 2]) });
  const a3 = sh(a2, 0.5, 0.5);
  const a4 = rot(a2, feetMid(a2), 10);
  return [S, fr(a1, b1), fr(a2, b2, 'A'), fr(a3, b3, 'A'), fr(a4, sh(b3, 0.5, -0.5), 'A'), fr(lf(a2, a0, 0.5), lf(b3, b0, 0.5)), tween(fr(lf(a2, a0, 0.8), lf(b3, b0, 0.8)), M, 0.6), M];
}

/** Arrastar: yank the collar, step past, take the back, both sit down with the hooks in. */
function dragClip(def, S, T, hit, M) {
  const a0 = S.A, b0 = S.B;
  const piv = feetMid(b0);
  const b1 = sh(rot(b0, piv, -16), -1, 0);
  const a1 = setHands(sh(a0, -1.4, 0.5, ['head', 'chest']), add(R(b1).chest, [-3, 1.5]), null, [true, false]);
  const b2 = sh(rot(b0, piv, -32), -5, 2);
  const a2 = setHands(sh(STAND(), 9, 0), add(R(b2).chest, [0, 0]), add(R(b2).hip, [0, -1]), [true, true]);
  if (hit) {
    const b3 = sh(rot(b0, piv, -38), -7, 4);
    const a3 = setHands(F({ ...STAND(), head: [39, 22], up: [-0.3, -1], side: [-1, 0], chest: [39.5, 29], hip: [41, 36], feet: [[37, 44], [45, 44]], bendL: [1, 1], bendA: [-1, -1] }), add(R(b3).chest, [1, -2]), add(R(b3).chest, [2, 2]), [true, true]);
    const a4 = up(lf(a3, T.A, 0.55), 3);
    const b4 = lf(b3, T.B, 0.6);
    const landed = R(T.B);
    return [
      S, fr(a1, b1), fr(a2, b2, 'B'),
      fr(a3, b3, 'B'),
      fr(a4, b4, 'B', [sparks(R(a4).hands[0], 4)]),
      fr(up(T.A, 1), T.B, T.top, [slam(landed.hip, R(T.A).hip)]),
      fr(up(T.A, 0.4), T.B, T.top),
      T,
    ];
  }
  // they turn back to face and peel the hand off
  const b3 = setHands(sh(b0, -2, 0), add(R(a2).hands[0], [0.5, 0]), null, [false, true]);
  return [S, fr(a1, b1), fr(a2, b2, 'B'), fr(sh(a2, -2, 0), b3, 'A'), fr(rot(sh(a2, -3, 0), feetMid(a2), -8), sh(b3, 1, 0)), fr(lf(a2, a0, 0.6), lf(b3, b0, 0.6)), tween(fr(lf(a2, a0, 0.85), b0), M, 0.6), M];
}

/** Puxar: sit to the mat on the sleeve, feet to their hips, roll back and pull them down into the closed guard. */
function pullClip(def, S, T, hit, M) {
  const a0 = S.A, b0 = S.B;
  const rb = R(b0);
  const piv = feetMid(b0);
  const sit = F({ head: [24, 27.5], up: [-0.3, -1], face: 'profile', side: [1, 0], chest: [23.5, 34], hip: [21.5, 41], feet: [[29, 44], [33, 38]], hands: [[0, 0], [0, 0]], bendL: [-1, -1], bendA: [1, 1], spread: 0.3, hsp: 0.45, z: { arm1: 'under' } });
  const a1 = setHands(sit, add(rb.chest, [-3, 4]), add(rb.chest, [-4, 2]), [false, true]);
  const b1 = sh(rot(b0, piv, -10), -0.5, 0);
  if (hit) {
    const b2 = sh(rot(b0, piv, -24), -2, 1.5);
    const a2 = setHands(setFeet(lf(sit, T.A, 0.45), add(R(b2).hip, [-1, 1]), add(R(b2).hip, [1, 3])), add(R(b2).chest, [-2, 1]), add(R(b2).chest, [-1, 3]), [true, true]);
    const b3 = sh(rot(b0, piv, -40), -4, 3);
    const a3 = setFeet(lf(sit, T.A, 0.8), add(R(b3).hip, [0, 0]), add(R(b3).hip, [2, 2]));
    const b4 = up(lf(b3, T.B, 0.65), 1.5);
    const a4 = lf(a3, T.A, 0.7);
    return [S, fr(a1, b1), fr(a2, b2, 'B'), fr(a3, b3, 'B'), fr(a4, b4, 'B', [sparks(R(b4).hip, 3)]), fr(T.A, up(T.B, 1), T.top, [slam(R(T.A).head, R(T.A).hip)]), fr(T.A, up(T.B, 0.4), T.top), T];
  }
  // they keep their base and step back: the puller sits alone and gets back up
  const b2 = sh(b0, 2.5, 0);
  return [S, fr(a1, b1), fr(setHands(sit, add(R(b2).chest, [-4, 6]), add(R(sit).chest, [3, 4])), b2), fr(sit, sh(b0, 3, 0)), fr(sh(sit, 0, 0.5), sh(b0, 2.5, 0)), fr(lf(sit, a0, 0.5), sh(b0, 1.5, 0)), tween(fr(lf(sit, a0, 0.8), sh(b0, 0.5, 0)), M, 0.6), M];
}

/** Base in the guard (the sprawl from on top): knees wide, hips low, hands posted on their hips, tall. */
function baseClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B;
  const rb = R(b0);
  const wide = setFeet(sh(a0, 0, 1.5, ['hip']), add(R(a0).feet[0], [2, 0]), add(R(a0).feet[1], [3, 0]));
  const posted = setHands(wide, add(rb.hip, [0.5, -1]), add(rb.hip, [2, -0.5]), [true, true]);
  if (hit) {
    const tall = sh(posted, 0, -1.5, ['head', 'chest']);
    return [S, fr(wide, b0, S.top), fr(posted, b0, S.top), fr(tall, sh(b0, 0, 0.3), S.top, [sparks(add(rb.hip, [1, -2]), 3)]), fr(sh(tall, 0, -0.3, ['head', 'chest']), b0, S.top), fr(tall, b0, S.top), tween(fr(tall, b0, S.top), T, 0.6), T];
  }
  // they break the posture down onto their chest
  const broke = rot(posted, R(posted).hip, -18);
  const pull = setHands(b0, add(R(broke).head, [1, 1]), add(R(broke).head, [2, 2]), [true, true]);
  return [S, fr(wide, b0, S.top), fr(posted, b0, S.top), fr(broke, pull, S.top), fr(rot(posted, R(posted).hip, -22), pull, S.top), fr(lf(broke, a0, 0.5), b0, S.top), tween(fr(lf(broke, a0, 0.8), b0, S.top), S, 0.6), S];
}

/** Passar, Joelho: rise, push the legs aside, travel round in the air, drop into the new pin. */
function passClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B;
  const rb = R(b0);
  const knees = rb.knees.filter(Boolean);
  const pin = knees.length ? knees[0] : rb.hip;
  const a1 = setHands(up(a0, 1.5), add(pin, [0, -0.5]), add(rb.hip, [1, -1]), [true, true]);
  const b1 = b0;
  if (hit) {
    const b2 = lf(b0, T.B, 0.3);
    const f2 = fr(up(lf(a0, T.A, 0.25), 3.5), b2, S.top);
    const f3 = tween(S, T, 0.55, 4, 0, S.top);
    const f4 = tween(S, T, 0.85, 1.6, 0);
    return [S, fr(a1, b1, S.top), f2, f3, fr(f4.A, f4.B, T.top, [sparks(mid(R(f4.A).hip, R(f4.B).chest), 3)]), fr(sh(T.A, 0, 0.6), T.B, T.top), fr(up(T.A, 0.4), T.B, T.top), T];
  }
  // a knee comes up and frames them off: shoved back where they started
  const b2 = setFeet(b0, add(R(a0).hip, [1, -3]), add(R(a0).chest, [2, 2]));
  return [S, fr(a1, b1, S.top), fr(up(lf(a0, T.A, 0.25), 3), b2, S.top), fr(up(lf(a0, T.A, 0.15), 3.5), b2, S.top), fr(up(a0, 2), b2, S.top), fr(up(a0, 0.6), lf(b2, b0, 0.5), S.top), tween(fr(up(a0, 0.3), lf(b2, b0, 0.8), S.top), S, 0.6), S];
}

/** Encaixe: roll them onto their side, slide in behind, hooks in. */
function takeClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B;
  const rb = R(b0);
  const a1 = setHands(up(a0, 1), add(rb.chest, [2, -2]), add(rb.hip, [0, -1.5]), [true, true]);
  if (hit) {
    const b2 = up(lf(b0, T.B, 0.3), 2);
    const f3 = tween(S, T, 0.55, 3.5, 2.5, 'B');
    const f4 = tween(S, T, 0.85, 1.5, 0.8, 'B');
    return [S, fr(a1, b0, S.top), fr(up(lf(a0, T.A, 0.3), 3), b2, S.top), f3, fr(f4.A, f4.B, f4.top, [sparks(R(f4.A).hands[0], 3)]), fr(up(T.A, 0.8), T.B, T.top), fr(up(T.A, 0.3), T.B, T.top), T];
  }
  const b2 = up(lf(b0, T.B, 0.2), 1);
  return [S, fr(a1, b0, S.top), fr(up(lf(a0, T.A, 0.2), 2), b2, S.top), fr(up(lf(a0, T.A, 0.3), 2.5), lf(b0, b2, 0.4), S.top), fr(up(a0, 1.5), b0, S.top), fr(up(a0, 0.6), b0, S.top), tween(fr(up(a0, 0.2), b0, S.top), S, 0.6), S];
}

/** The guard sweeps: load them on the legs, lift them, tip them over and come up on top (the landing is mirrored). */
function sweepClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B; // A underneath (the sweeper), B kneeling in the guard, drawn on top
  const ra = R(a0), rb = R(b0);
  const piv = add(ra.hip, [2, -2]);
  const bump = def.move === 'hip_bump', scissor = def.move === 'scissor_sweep';
  const a1 = bump
    ? setHands(F({ ...clonePose(a0), elbows: undefined, knees: undefined, head: add(ra.head, [4, -5]), up: [0.5, -0.86], chest: add(ra.chest, [3, -4]), face: 'three', side: [1, -0.3] }), add(ra.chest, [-2, 4]), add(rb.chest, [-1, 0]), [false, true])
    : setHands(setFeet(a0, add(rb.hip, [-1, 1]), scissor ? add(rb.chest, [0, -1]) : add(rb.knees?.[0] ?? rb.hip, [0, 1])), add(rb.chest, [-2, 0]), add(rb.chest, [-1, 2]), [true, true]);
  const b1 = rot(up(b0, 1.5), rb.hip, 8);
  if (hit) {
    const b2 = rot(up(b0, 4), piv, 30);
    const a2 = up(lf(a1, T.A, 0.15), 1);
    const b3 = rot(up(b0, 5), piv, 62);
    const a3 = up(lf(a1, T.A, 0.4), 2);
    const b4 = sh(rot(up(b0, 4), piv, 92), 7, 0);
    const a4 = up(lf(a1, T.A, 0.65), 2.5);
    const fall = R(T.B);
    return [
      S, fr(a1, b1, 'B'),
      fr(a2, b2, 'B'),
      fr(a3, b3, 'B'),
      fr(a4, b4, 'A', [sparks(R(b4).hip, 4)]),
      fr(up(T.A, 1.6), setHands(T.B, add(fall.chest, [-2, -4]), add(fall.chest, [3, -4])), T.top, [slam(fall.head, fall.hip)]),
      fr(up(T.A, 0.5), T.B, T.top),
      T,
    ];
  }
  // they post a hand out wide and ride it, then settle back in
  const b2 = rot(up(b0, 2.5), piv, 22);
  const b3 = setHands(rot(up(b0, 1.5), piv, 14), add(rb.hip, [9, 5]), null);
  return [S, fr(a1, b1, 'B'), fr(up(lf(a1, a0, 0.2), 1), b2, 'B'), fr(lf(a1, a0, 0.3), b3, 'B', [sparks(add(rb.hip, [9, 5]), 3)]), fr(lf(a1, a0, 0.6), lf(b3, b0, 0.5), 'B'), fr(lf(a1, a0, 0.85), lf(b3, b0, 0.85), 'B'), tween(fr(a0, b0, 'B'), S, 0.5), S];
}

/** Recuperar from underneath: frame on their hips, shrimp out, knee in, guard back. In the guard: push them off and close again. */
function frameClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B;
  const ra = R(a0), rb = R(b0);
  const framed = setHands(a0, add(rb.hip, [-0.5, 0]), add(rb.chest, [0, 1]), [true, true]);
  const shrimp = sh(framed, -2.5, 0, ['hip', 'feet']);
  if (hit) {
    if (def.from === 'guarda_fechada') {
      const pushed = sh(b0, 3, -1);
      const legs = setFeet(framed, add(R(pushed).hip, [-0.5, 0]), add(R(pushed).chest, [-1, 2]));
      return [S, fr(framed, b0, S.top), fr(legs, pushed, S.top), fr(setFeet(framed, add(R(pushed).hip, [1, 0]), add(R(pushed).chest, [1, 2])), sh(b0, 4.5, -1.5), S.top, [sparks(R(pushed).hip, 3)]), fr(legs, sh(b0, 3.5, -1), S.top), fr(framed, sh(b0, 1.5, -0.5), S.top), tween(fr(a0, b0, S.top), T, 0.6), T];
    }
    const b2 = up(sh(b0, 1, 0), 1.5);
    const a3 = setFeet(shrimp, add(rb.hip, [1, -2]), null);
    const f3 = fr(a3, up(lf(b0, T.B, 0.35), 2.5), S.top);
    const f4 = tween(fr(a3, f3.B, S.top), T, 0.65, 0, 1.5);
    return [S, fr(framed, b0, S.top), fr(shrimp, b2, S.top), f3, fr(f4.A, f4.B, f4.top, [sparks(R(f4.B).hip, 3)]), fr(T.A, up(T.B, 0.8), T.top), fr(T.A, up(T.B, 0.3), T.top), T];
  }
  // they drive their weight back down and flatten the frame
  const heavy = sh(b0, -1, 1);
  return [S, fr(framed, b0, S.top), fr(shrimp, up(b0, 0.8), S.top), fr(sh(a0, -1, 0, ['hip', 'feet']), heavy, S.top), fr(withEyes(a0, 'shut'), sh(b0, -0.6, 0.7), S.top), fr(a0, sh(b0, -0.3, 0.3), S.top), tween(fr(a0, b0, S.top), S, 0.6), S];
}

/** Sair from the back: grab the choking arm, slide the hips out, turn in and come down with them in the guard (mirrored). */
function escapeClip(def, S, T, hit) {
  const a0 = S.A, b0 = S.B; // A sits in front, B behind
  const rb = R(b0);
  const a1 = setHands(a0, add(R(a0).chest, [-0.5, -2]), add(R(a0).chest, [0.5, 0]), [true, true]);
  if (hit) {
    const a2 = rot(a1, R(a0).hip, 18);
    const f3 = tween(fr(a2, b0, S.top), T, 0.4, 2, 1);
    const f4 = tween(fr(a2, b0, S.top), T, 0.75, 1, 0.5);
    return [S, fr(a1, b0, S.top), fr(a2, sh(b0, 0.5, 0), S.top), fr(f3.A, f3.B, 'A'), fr(f4.A, f4.B, 'A', [sparks(R(f4.A).head, 3)]), fr(T.A, up(T.B, 0.6), T.top, [slam(R(T.A).head, R(T.A).hip)]), fr(T.A, up(T.B, 0.2), T.top), T];
  }
  const tight = setHands(b0, add(rb.hands[0], [-1, 0]), add(rb.hands[1], [-1, 0]), [true, true]);
  const a2 = rot(a1, R(a0).hip, 12);
  return [S, fr(a1, b0, S.top), fr(a2, b0, S.top), fr(rot(a1, R(a0).hip, 4), tight, S.top), fr(withEyes(a0, 'shut'), tight, S.top), fr(a0, b0, S.top), fr(a0, b0, S.top), S];
}

/**
 * The finishes. Braço: trap the arm, swing a leg over the head, fall back across them with the arm straight, hips up, the tap.
 * Americana: pin the wrist to the mat, crank, the tap. Pescoço: the arm under the chin, squeeze, the tap. A miss: they pull free and
 * the attacker ends underneath in the closed guard (mirrored).
 */
function subClip(def, S, T, hit, M) {
  const a0 = S.A, b0 = S.B;
  const ra = R(a0), rb = R(b0);
  const top = S.top;
  if (def.move === 'rnc') {
    // from the back: A behind, B in front (drawn over A)
    const choke = setHands(a0, add(rb.head, [0.5, 3]), add(rb.head, [-1, 1]), [true, true]);
    const squeeze = sh(choke, 0.5, -0.5, ['head', 'chest']);
    const bTip = (P) => ({ ...clonePose(P), up: [0.45, -0.9], eyes: 'shut' });
    const pulling = setHands(bTip(b0), add(rb.head, [0, 3.5]), add(rb.head, [-1.5, 6]), [true, false]);
    if (hit) {
      const tapAt = add(rb.hip, [-8, 3]);
      const t0 = setHands(pulling, null, tapAt);
      const t1 = setHands(pulling, null, add(tapAt, [0, -4]));
      return [S, fr(choke, b0, top), fr(squeeze, pulling, top), fr(squeeze, pulling, top, [sparks(add(rb.head, [0, 3]), 3)]), fr(sh(squeeze, 0.4, -0.4, ['head', 'chest']), pulling, top), fr(squeeze, t1, top), fr(squeeze, t0, top, [tapFx(tapAt, true)]), fr(squeeze, t1, top, [tapFx(add(tapAt, [0, -4]), false)])];
    }
    const free = setHands(b0, add(R(choke).hands[0], [0, 1]), add(R(choke).hands[0], [1, 2]), [true, true]);
    return subMiss(S, [fr(choke, b0, top), fr(squeeze, pulling, top), fr(choke, free, top)], M);
  }
  if (def.move === 'americana') {
    const pin = add(rb.head, [-1, -4]);
    const bArm = setHands(b0, pin, null);
    const aPin = setHands(sh(a0, -1.5, 1, ['head', 'chest']), add(pin, [0.5, 0]), add(R(bArm).elbows[0], [0, 0]), [true, true]);
    if (hit) {
      const crank = setHands(sh(aPin, 0, -0.8, ['head', 'chest']), add(pin, [-0.5, 0.8]), add(R(bArm).elbows[0], [0.5, -1]), [true, true]);
      const tapAt = add(rb.hip, [3, 3]);
      const strained = setHands(withEyes(bArm, 'shut'), add(pin, [-0.5, 0.8]), tapAt);
      return [S, fr(setHands(a0, add(rb.chest, [-2, -2]), null, [true, false]), b0, top), fr(aPin, bArm, top), fr(crank, withEyes(bArm, 'shut'), top, [sparks(pin, 3)]), fr(crank, strained, top), fr(crank, setHands(strained, null, add(tapAt, [0, -4])), top), fr(crank, strained, top, [tapFx(tapAt, true)]), fr(crank, setHands(strained, null, add(tapAt, [0, -4])), top, [tapFx(add(tapAt, [0, -4]), false)])];
    }
    const free = setHands(b0, add(rb.chest, [1, -2]), null);
    return subMiss(S, [fr(setHands(a0, add(rb.chest, [-2, -2]), null, [true, false]), b0, top), fr(aPin, bArm, top), fr(sh(aPin, 1, -1), free, top)], M);
  }
  // Braço: the attacker falls back across the chest, lying the other way, the arm straight between the legs
  const armUp = setHands(b0, add(ra.chest, [0.5, -1]), null);
  const trap = setHands(up(a0, 1), add(R(armUp).hands[0], [0, 1]), add(R(armUp).elbows[0], [0, 0]), [true, true]);
  const swing = setFeet(up(trap, 3), add(rb.head, [1, -7]), null);
  const cx = rb.chest[0];
  const across = F({ head: [cx + 15, 40.5], up: [0.95, -0.3], face: 'front', side: [0.3, 0.95], chest: [cx + 9, 41], hip: [cx + 2, 40.5], feet: [[cx - 5, 34], [cx - 1, 31]], hands: [[cx + 1.5, 32], [cx + 3, 33]], bendL: [1, 1], bendA: [-1, -1], spread: 0.8, hsp: 0.6, fists: [true, true] });
  const straight = setHands(b0, [cx + 1.5, 31], null);
  if (hit) {
    const hipsUp = { ...clonePose(across), hip: [cx + 2, 38.5] };
    const tapAt = add(rb.hip, [4, 2]);
    const strained = setHands(withEyes(straight, 'shut'), null, tapAt);
    return [S, fr(trap, armUp, 'A'), fr(swing, armUp, 'A'), fr(across, straight, 'A'), fr(hipsUp, withEyes(straight, 'shut'), 'A', [sparks([cx + 1.5, 31], 4)]), fr(hipsUp, strained, 'A'), fr(hipsUp, setHands(strained, null, add(tapAt, [0, -4])), 'A', [tapFx(add(tapAt, [0, -4]), false)]), fr(hipsUp, strained, 'A', [tapFx(tapAt, true)])];
  }
  const free = setHands(b0, add(rb.chest, [1, -3]), null, [true, false]);
  return subMiss(S, [fr(trap, armUp, 'A'), fr(swing, armUp, 'A'), fr(across, free, 'A')], M);
}

/** A failed finish: three frames of the attempt, then the scramble into the end pose (closed guard, the attacker underneath). */
function subMiss(S, attempt, M) {
  const last = attempt[attempt.length - 1];
  return [S, ...attempt, tween(last, M, 0.35, 2, 1.5, last.top), tween(last, M, 0.7, 1.5, 1, M.top), fr(M.A, up(M.B, 0.4), M.top), M];
}

const FAMILY = { grip: gripClip, posture: postureClip, sprawl: sprawlClip, shoot: shootClip, throw: throwClip, drag: dragClip, pull: pullClip, base: baseClip, pass: passClip, take: takeClip, sweep: sweepClip, frame: frameClip, escape: escapeClip, sub: subClip };

/** The 8 frames of a clip. */
export function clipFrames(def, hit) {
  const S = startPose(def);
  const T = endPose(def);
  const M = missEnd(def, S);
  const out = FAMILY[def.family](def, S, T, hit, M);
  if (out.length !== CLIP_FRAMES) throw new Error(`bjj clip ${def.move}@${def.from} ${hit ? 'hit' : 'miss'}: ${out.length} frames`);
  return out;
}

export { CLIPS };
