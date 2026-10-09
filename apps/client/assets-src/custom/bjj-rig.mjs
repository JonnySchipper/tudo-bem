// BJJ pair sprites: a tiny pixel "puppet" renderer. Each fighter is a head disc, a torso capsule, two arms and two legs (two-bone IK
// from shoulder / hip to a hand / foot target), drawn as outlined stickers (navy outline, light from the upper left) in key colors:
// skin / hair from KEY_RAMPS (fighter A) or skin2 / hair2 (fighter B), gi white (A) or blue (B), belt key ramp (A) or a black belt (B).
// The gi is a real gi: a jacket with a thick collar and crossed lapels (a V of chest under them), a skirt below the belt with the
// jacket's opening edge, loose sleeves with a dark cuff at the wrist, pants with a cuff at the ankle, the belt knot and its two tails.
// Each head also carries the optional hair pieces of bjjKeys.ts (volume, bun, beard), switched on or off by the runtime swap.
// Poses are plain objects (see bjj-poses.mjs); transitions interpolate poses; struggle loops jiggle them.
import { blank, setPx, hexPx } from '../../../../scripts/lib/pixel/img.mjs';
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';
import { HAIR_KEYS } from '../../../client/src/render/pixel/bjjKeys.ts';

export const W = 64;
export const H = 48;
export const OL = '#3a3a50';
/** Gi fabric ramps, deep -> light. */
export const GI_WHITE = ['#a9a18e', '#c9c1ae', '#e8e2d4', '#fbf7ee'];
export const GI_BLUE = ['#284676', '#355c98', '#4a78b8', '#6f9ad8'];
/** Fighter B's (fixed) black belt, deep -> light. */
export const BELT_BLACK = ['#1c1c28', '#2c2c3e', '#464660'];
/** Small FX colors (tap marks, sweat): the LimeZu yellow ramp and white. */
export const FX_COL = { y: '#ffe57b', Y: '#fff59a', o: '#f8d239', w: '#ffffff' };
/** Every non-key color the pair sprites may use. */
export const GI_PALETTE = [OL, ...GI_WHITE, ...GI_BLUE, ...BELT_BLACK, ...Object.values(FX_COL)];

export const FIGHTERS = {
  A: { gi: GI_WHITE, skin: KEY_RAMPS.skin, hair: KEY_RAMPS.hair, belt: KEY_RAMPS.belt, extra: HAIR_KEYS.A },
  /** Professora Bia (referee): white gi, black belt, skin / hair on the standard key ramps, no optional hair pieces. */
  R: { gi: GI_WHITE, skin: KEY_RAMPS.skin, hair: KEY_RAMPS.hair, belt: BELT_BLACK, extra: null },
  B: { gi: GI_BLUE, skin: KEY_RAMPS.skin2, hair: KEY_RAMPS.hair2, belt: BELT_BLACK, extra: HAIR_KEYS.B },
};

const LIGHT = [-0.7071, -0.7071];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const perp = (a) => [-a[1], a[0]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Canvas of hex strings. `ox`, `oy` offset every write (a bigger canvas around the same authored coordinates, for the move clips). */
export function canvas(w = W, h = H, ox = 0, oy = 0) {
  return { px: new Array(w * h).fill(null), w, h, ox, oy };
}
export const put = (cv, x, y, hex) => {
  const X = x + (cv.ox ?? 0), Y = y + (cv.oy ?? 0);
  if (X >= 0 && Y >= 0 && X < cv.w && Y < cv.h) cv.px[Y * cv.w + X] = hex;
};
const get = (cv, x, y) => {
  const X = x + (cv.ox ?? 0), Y = y + (cv.oy ?? 0);
  return X >= 0 && Y >= 0 && X < cv.w && Y < cv.h ? cv.px[Y * cv.w + X] : undefined;
};

/** Stamps a group of capsules/discs as one outlined sticker. segs: [{a,b,ra,rb,mat}] ; color(pixel) -> hex. */
function maskOf(segs) {
  const m = new Map();
  for (const s of segs) {
    const r = Math.max(s.ra, s.rb);
    const x0 = Math.floor(Math.min(s.a[0], s.b[0]) - r - 1), x1 = Math.ceil(Math.max(s.a[0], s.b[0]) + r + 1);
    const y0 = Math.floor(Math.min(s.a[1], s.b[1]) - r - 1), y1 = Math.ceil(Math.max(s.a[1], s.b[1]) + r + 1);
    const ab = sub(s.b, s.a), l2 = dot2(ab, ab) || 1e-6;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = [x + 0.5, y + 0.5];
        const t = Math.max(0, Math.min(1, dot2(sub(p, s.a), ab) / l2));
        const q = add(s.a, mul(ab, t));
        const rr = lerp(s.ra, s.rb, t);
        const o = sub(p, q);
        const d = len(o);
        if (d > rr) continue;
        const key = y * 256 + x;
        const prev = m.get(key);
        // `pri` lets a short trim segment (a cuff) win the pixels it shares with the limb it sits on
        const score = d / rr - (s.pri ?? 0);
        if (!prev || score < prev.score) m.set(key, { x, y, score, nx: o[0] / rr, ny: o[1] / rr, seg: s });
      }
    }
  }
  return m;
}

const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function stamp(cv, segs, color, outline = OL) {
  const m = maskOf(segs);
  if (outline) {
    for (const { x, y } of m.values()) {
      for (const [dx, dy] of NEIGH) {
        const k = (y + dy) * 256 + (x + dx);
        if (!m.has(k)) put(cv, x + dx, y + dy, outline);
      }
    }
  }
  for (const v of m.values()) put(cv, v.x, v.y, color(v));
  return m;
}

const litOf = (v) => v.nx * LIGHT[0] + v.ny * LIGHT[1];
const rankOf = (lit, far) => {
  let r = lit > 0.45 ? 3 : lit > -0.25 ? 2 : lit > -0.75 ? 1 : 0;
  if (far) r = Math.max(0, r - 1);
  return r;
};

// ------------------------------------------------------------------ IK

export function twoBone(s, target, l1, l2, bend) {
  let d = sub(target, s);
  let dist = len(d);
  const dir = norm(d);
  const maxR = l1 + l2 - 0.05, minR = Math.abs(l1 - l2) + 0.3;
  const dd = Math.max(minR, Math.min(maxR, dist));
  const end = add(s, mul(dir, dd));
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pv = [-dir[1], dir[0]];
  const elbow = add(add(s, mul(dir, a)), mul(pv, h * bend));
  return { elbow, end };
}

// ------------------------------------------------------------------ fighter drawing

export function resolve(P) {
  const axis = norm(sub(P.hip, P.chest));
  const pr = perp(axis);
  const spread = P.spread ?? 0.7, hsp = P.hsp ?? 0.5;
  const o = clonePose(P);
  o.knees = [null, null]; o.elbows = [null, null];
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? 1 : -1;
    const hipJ = add(P.hip, mul(pr, sgn * hsp * AUTH.rt));
    if (P.knees?.[i]) { o.knees[i] = P.knees[i]; o.feet[i] = P.feet[i]; }
    else { const r = twoBone(hipJ, P.feet[i], AUTH.leg[0], AUTH.leg[1], P.bendL?.[i] ?? 1); o.knees[i] = r.elbow; o.feet[i] = r.end; }
    const sh = add(P.chest, mul(pr, sgn * spread * AUTH.rt));
    if (P.elbows?.[i]) { o.elbows[i] = P.elbows[i]; o.hands[i] = P.hands[i]; }
    else { const r = twoBone(sh, P.hands[i], AUTH.arm[0], AUTH.arm[1], P.bendA?.[i] ?? 1); o.elbows[i] = r.elbow; o.hands[i] = r.end; }
  }
  return o;
}

/** Authoring dimensions (poses are authored on a ~27 px figure) and the drawn dimensions (LimeZu chibi: a big head, short body). */
export const AUTH = { rt: 3.4, arm: [4.4, 4.4], leg: [5.0, 5.0] };
export const SCALE = 0.84;
export const DIM = { rt: 3.2, rh: 5.0, arm: [3.7, 3.7], leg: [4.2, 4.2] };
const PIV = [32, 44];
const sc = (p) => [PIV[0] + (p[0] - PIV[0]) * SCALE, PIV[1] + (p[1] - PIV[1]) * SCALE];
export function scalePose(P) {
  const o = resolve(P);
  for (const k of ['head', 'chest', 'hip']) o[k] = sc(o[k]);
  o.hands = o.hands.map(sc); o.feet = o.feet.map(sc); o.knees = o.knees.map(sc); o.elbows = o.elbows.map(sc);
  return o;
}

/**
 * Pose fields (all points in canvas px, y down):
 *   head, up (unit-ish vector chin -> crown), face ('front' | 'three' | 'profile' | 'back'), side (vector the face looks toward, profile/three),
 *   chest, hip, hands [h0,h1], feet [f0,f1], bendA [±1,±1], bendL [±1,±1], spread (shoulder), hsp (hip),
 *   fists [bool, bool] (a hand closed on the other's gi: a bigger fist), eyes ('shut'), back (the torso shows its back),
 *   z: { arm0, arm1, leg0, leg1, torso, head: 'under' | 'far' | 'over' | number }
 */
export function fighterParts(P, who) {
  const parts = [];
  const axis = norm(sub(P.hip, P.chest));
  const pr = perp(axis);
  const spread = P.spread ?? 0.7, hsp = P.hsp ?? 0.5;
  const zOf = (name, dflt) => {
    const o = P.z?.[name];
    if (o === 'under') return -200 + dflt;
    if (o === 'over') return 200 + dflt;
    if (o === 'far') return dflt - 4;
    if (typeof o === 'number') return o;
    return dflt;
  };

  // legs: loose gi pants, a cuff at the ankle, a bare foot
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? 1 : -1;
    const hipJ = add(P.hip, mul(pr, sgn * hsp * DIM.rt));
    const { elbow: knee, end } = P.knees?.[i] ? { elbow: P.knees[i], end: P.feet[i] } : twoBone(hipJ, P.feet[i], DIM.leg[0], DIM.leg[1], P.bendL?.[i] ?? 1);
    const far = P.z?.['leg' + i] === 'far';
    const dir = norm(sub(end, knee));
    const segs = [
      { a: hipJ, b: knee, ra: 2.05, rb: 1.85, mat: 'gi' },
      { a: knee, b: end, ra: 1.85, rb: 1.7, mat: 'gi' },
      { a: add(end, mul(dir, -0.35)), b: add(end, mul(dir, 0.2)), ra: 1.75, rb: 1.75, mat: 'cuff', pri: 0.25 },
      { a: add(end, mul(dir, 1.0)), b: add(end, mul(dir, 1.6)), ra: 1.5, rb: 1.3, mat: 'skin' },
    ];
    parts.push({ z: zOf('leg' + i, 1 + i * 0.1), segs, far, name: 'leg' });
  }
  // torso: the jacket (lapels, belt and skirt are shaded per pixel, see torsoColor)
  const tsegs = [{ a: P.chest, b: P.hip, ra: DIM.rt, rb: DIM.rt - 0.25, mat: 'gi' }];
  parts.push({ z: zOf('torso', 3), segs: tsegs, torso: { axis, pr, chest: P.chest, hip: P.hip, back: !!P.back, side: P.side ?? [1, 0], face: P.face ?? 'profile' }, name: 'torso' });
  // belt tails, hanging from the knot
  const bp = lerp2(P.chest, P.hip, BELT_AT);
  const tailBase = add(bp, mul(pr, 0.7));
  const tail1 = add(tailBase, add(mul(axis, 3.0), mul(pr, 1.3)));
  const tail2 = add(tailBase, add(mul(axis, 2.5), mul(pr, -0.6)));
  parts.push({ z: zOf('torso', 3) + 0.5, segs: [{ a: tailBase, b: tail1, ra: 0.85, rb: 0.75, mat: 'belt' }, { a: tailBase, b: tail2, ra: 0.85, rb: 0.75, mat: 'belt' }], name: 'tails' });
  // head
  parts.push({ z: zOf('head', 5), segs: [{ a: P.head, b: P.head, ra: P.rh ?? DIM.rh, rb: P.rh ?? DIM.rh, mat: 'head' }], head: P, name: 'head' });
  // arms: loose sleeves to the wrist, a dark cuff, the hand (a bigger fist when it holds the other's gi)
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? 1 : -1;
    const sh = add(P.chest, mul(pr, sgn * spread * DIM.rt));
    const { elbow, end } = P.elbows?.[i] ? { elbow: P.elbows[i], end: P.hands[i] } : twoBone(sh, P.hands[i], DIM.arm[0], DIM.arm[1], P.bendA?.[i] ?? 1);
    const dirW = norm(sub(end, elbow));
    const far = P.z?.['arm' + i] === 'far';
    const fist = !!P.fists?.[i];
    const segs = [
      { a: sh, b: elbow, ra: 1.45, rb: 1.35, mat: 'gi' },
      { a: elbow, b: end, ra: 1.35, rb: 1.3, mat: 'gi' },
      { a: add(end, mul(dirW, -0.25)), b: add(end, mul(dirW, 0.15)), ra: 1.4, rb: 1.4, mat: 'cuff', pri: 0.25 },
      { a: add(end, mul(dirW, 0.75)), b: add(end, mul(dirW, fist ? 1.3 : 1.2)), ra: fist ? 1.5 : 1.3, rb: fist ? 1.45 : 1.2, mat: 'skin' },
    ];
    parts.push({ z: zOf('arm' + i, 7 + i * 0.1), segs, far, name: 'arm' });
  }
  return parts;
}

/** Where the belt sits down the torso (0 chest .. 1 hip). */
const BELT_AT = 0.74;

function colorFor(part, pal) {
  if (part.name === 'torso') return torsoColor(part, pal);
  return (v) => {
    const far = part.far;
    const lit = litOf(v);
    const m = v.seg.mat;
    if (m === 'skin') return pal.skin[Math.min(3, Math.max(1, rankOf(lit, far)))];
    if (m === 'belt') return pal.belt[Math.min(2, Math.max(0, rankOf(lit, far) - 1))];
    // the cuff is the dark inside of the sleeve / pant opening
    if (m === 'cuff') return pal.gi[Math.max(0, Math.min(1, rankOf(lit, far) - 1))];
    return pal.gi[rankOf(lit, far)];
  };
}

/**
 * The jacket, one pixel at a time. Front: a thick collar that runs down as two lapels crossing at the sternum (the chest shows in the V
 * above), the lapel's edge carrying on to the belt; the belt band with its knot; the skirt under the belt with the jacket's opening.
 * Back: the collar band across the neck and the centre seam.
 */
function torsoColor(part, pal) {
  const { axis, pr, chest, hip, back, side, face } = part.torso;
  const L = len(sub(hip, chest)) || 1;
  const beltU0 = BELT_AT * L - 0.7, beltU1 = beltU0 + 1.5;
  // in profile the V sits toward the side the fighter faces
  const facing = face === 'front' ? 0 : clamp(dot2(norm(side), pr), -1, 1);
  const c0 = facing * 1.3;
  const wScale = 1 - 0.35 * Math.abs(facing);
  const apexU = 0.42 * L;
  return (v) => {
    const lit = litOf(v);
    const rank = rankOf(lit, false);
    const p = [v.x + 0.5, v.y + 0.5];
    const o = sub(p, chest);
    const u = dot2(o, axis);
    const s = dot2(o, pr);
    if (u >= beltU0 && u < beltU1) {
      if (Math.abs(s - c0 * 0.6 - 0.6) < 0.75 && !back) return pal.belt[2];
      return pal.belt[u < beltU0 + 0.75 ? 1 : 0];
    }
    if (back) {
      if (u < -DIM.rt + 1.6) return pal.gi[Math.max(2, rank)];
      if (Math.abs(s) < 0.5 && u < beltU0) return pal.gi[Math.max(0, rank - 1)];
      return pal.gi[rank];
    }
    if (u < apexU) {
      const w = 2.1 * wScale * clamp((apexU - u) / (apexU + DIM.rt), 0, 1);
      const d = Math.abs(s - c0 * clamp((apexU - u) / apexU, 0, 1)) - w;
      if (d < -1.05) return u < apexU * 0.3 ? pal.skin[rank >= 2 ? 2 : 1] : pal.gi[Math.max(0, rank - 1)];
      if (d < 0.15) return pal.gi[rank >= 2 ? 3 : 2];
      if (d < 0.95) return pal.gi[Math.max(0, Math.min(1, rank - 1))];
      return pal.gi[rank];
    }
    // below the crossing: the top lapel's edge runs on down to the belt, and the skirt opens under it
    const edge = lerp(0, 1.4, clamp((u - apexU) / Math.max(0.1, beltU0 - apexU), 0, 1)) + c0 * 0.3;
    if (u < beltU0 && Math.abs(s - edge) < 0.55) return pal.gi[Math.max(0, Math.min(1, rank - 1))];
    if (u >= beltU1 && Math.abs(s - 1.0 - c0 * 0.3) < 0.5) return pal.gi[Math.max(0, Math.min(1, rank - 1))];
    return pal.gi[rank];
  };
}

function drawHead(cv, part, pal) {
  const P = part.head;
  const c = P.head, up = norm(P.up ?? [0, -1]);
  const face = P.face ?? 'profile';
  const side = norm(P.side ?? [1, 0]);
  const rh = P.rh ?? DIM.rh;
  const hairLine = P.hairLine ?? 0.25;
  const ex = pal.extra;
  const m = stamp(cv, part.segs, (v) => {
    const lit = litOf(v);
    const o = [v.x + 0.5 - c[0], v.y + 0.5 - c[1]];
    const bu = dot2(o, up) / rh;
    const sa = dot2(o, side) / rh;
    let hair = false;
    if (face === 'back') hair = true;
    else if (bu > hairLine) hair = true;
    else if (face === 'profile' && sa < -0.3 && bu > -0.55) hair = true;
    else if (face === 'three' && sa < -0.55 && bu > -0.3) hair = true;
    if (hair) {
      const r = lit > 0.35 ? 3 : lit > -0.3 ? 2 : lit > -0.7 ? 1 : 0;
      return pal.hair[r];
    }
    const r = lit > 0.45 ? 3 : lit > -0.5 ? 2 : 1;
    // the lower face: a beard key over the skin (the runtime turns it back into skin for a clean-shaven fighter)
    if (ex && face !== 'back' && bu < -0.2 && (face === 'front' ? Math.abs(sa) < 0.85 : sa > -0.1)) return ex.beard[r - 1];
    return pal.skin[r];
  });
  // face details
  const px = (p, hex) => {
    const x = Math.floor(p[0]), y = Math.floor(p[1]);
    if (m.has(y * 256 + x)) put(cv, x, y, hex);
  };
  const at = (su, ss) => add(c, add(mul(up, su), mul(side, ss)));
  const eye = (su, ss, gz) => {
    if (P.eyes === 'shut') { px(at(su, ss), OL); px(at(su, ss + gz), OL); return; }
    px(at(su, ss), OL); px(at(su, ss - gz), '#ffffff');
  };
  if (face === 'front') {
    { const k = rh * 0.34; eye(-0.5, -k, 1); eye(-0.5, k, -1); }
    px(at(-2.6, 0.4), pal.skin[1]);
  } else if (face === 'three') {
    eye(-0.5, 0.6, 1); eye(-0.5, 2.7, 1);
    px(at(-2.6, 1.8), pal.skin[1]);
  } else if (face === 'profile') {
    eye(-0.5, 2.6, 1);
    px(at(-2.6, 3.0), pal.skin[1]);
  }
  if (ex) hairPieces(cv, m, P, c, up, side, face, rh, ex);
}

/**
 * The optional hair pieces, drawn only where the canvas is still empty (so a piece never eats a pixel another part needs when it is
 * switched off): the volume is a ring around the crown and the back of the head, the bun a knot on top of the crown at the back.
 * The head's own outline under the volume becomes the seam key (hair when the volume is on, outline when it is off).
 */
function hairPieces(cv, headMask, P, c, up, side, face, rh, ex) {
  const back = face === 'front' ? [0, 0] : face === 'back' ? [0, 0] : mul(side, -1);
  const put1 = (x, y, hex) => { if (get(cv, x, y) === null) put(cv, x, y, hex); };
  const shade = (o) => {
    const l = norm(o);
    const lit = l[0] * LIGHT[0] + l[1] * LIGHT[1];
    return lit > 0.35 ? 2 : lit > -0.35 ? 1 : 0;
  };
  // volume: a ring 1.6 px thick around the crown, wider toward the back of the head, never over the face
  const vol = new Set();
  const R = Math.ceil(rh + 3);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = Math.floor(c[0]) + dx, y = Math.floor(c[1]) + dy;
    const o = [x + 0.5 - c[0], y + 0.5 - c[1]];
    const d = len(o);
    const dir = norm(o);
    const bu = dot2(dir, up), bs = dot2(dir, back);
    if (bu < -0.25 && bs < 0.5) continue;
    if (face !== 'back' && face !== 'front' && dot2(dir, side) > 0.35 && bu < 0.55) continue;
    const thick = 1.3 + 0.9 * Math.max(0, bs) + 0.3 * Math.max(0, bu);
    if (d <= rh || d > rh + thick) continue;
    if (headMask.has(y * 256 + x)) continue;
    if (get(cv, x, y) !== null) continue;
    vol.add(y * 256 + x);
  }
  for (const k of vol) {
    const x = k % 256, y = Math.floor(k / 256);
    put(cv, x, y, ex.vol[shade([x + 0.5 - c[0], y + 0.5 - c[1]])]);
  }
  for (const k of vol) {
    const x = k % 256, y = Math.floor(k / 256);
    for (const [dx, dy] of NEIGH) {
      const nk = (y + dy) * 256 + (x + dx);
      if (vol.has(nk) || headMask.has(nk)) continue;
      const cur = get(cv, x + dx, y + dy);
      if (cur === null) put(cv, x + dx, y + dy, ex.volOl);
      else if (cur === OL) put(cv, x + dx, y + dy, ex.volSeam);
    }
  }
  // bun: a small knot up and back from the crown
  const bc = add(c, add(mul(up, rh + 0.4), mul(back, rh * 0.45)));
  const bun = new Set();
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = Math.floor(bc[0]) + dx, y = Math.floor(bc[1]) + dy;
    const o = [x + 0.5 - bc[0], y + 0.5 - bc[1]];
    if (len(o) > 1.9) continue;
    if (headMask.has(y * 256 + x)) continue;
    const cur = get(cv, x, y);
    if (cur !== null && !ex.vol.includes(cur) && cur !== ex.volOl && cur !== OL) continue;
    bun.add(y * 256 + x);
  }
  for (const k of bun) {
    const x = k % 256, y = Math.floor(k / 256);
    if (get(cv, x, y) !== null) continue; // only on empty pixels: the bun is optional
    put(cv, x, y, ex.bun[shade([x + 0.5 - bc[0], y + 0.5 - bc[1]])]);
  }
  for (const k of bun) {
    const x = k % 256, y = Math.floor(k / 256);
    for (const [dx, dy] of NEIGH) if (!bun.has((y + dy) * 256 + x + dx) && get(cv, x + dx, y + dy) === null) put(cv, x + dx, y + dy, ex.bunOl);
  }
}

/** Draws one fighter into the canvas parts list (caller sorts all parts by z). */
export function drawFighterAll(cv, items) {
  items.sort((a, b) => a.z - b.z);
  for (const it of items) {
    const pal = FIGHTERS[it.who];
    const part = it.part;
    if (part.name === 'head') drawHead(cv, part, pal);
    else stamp(cv, part.segs, colorFor(part, pal));
  }
}

/**
 * Renders a pair pose { A: fighterPose, B: fighterPose, top: 'A'|'B', fx?: [...] } to a hex canvas.
 */
export function renderPair(pair, size) {
  const cv = size ? canvas(size.w, size.h, size.ox, size.oy) : canvas();
  const items = [];
  for (const who of ['A', 'B']) {
    const P = pair[who];
    if (!P) continue;
    const baseZ = pair.top === who ? 40 : 20;
    for (const part of fighterParts(scalePose(P), who)) items.push({ who, part, z: baseZ + part.z });
  }
  drawFighterAll(cv, items);
  for (const fx of pair.fx ?? []) fx(cv, put);
  return cv;
}

/** The poses are authored on a floor line at y = 44; the image sits 1 px lower (anchor = bottom centre of the 64 x 48 frame). */
export const FLOOR_DY = 1;
export function toImage(cv, dy = FLOOR_DY) {
  const img = blank(cv.w, cv.h);
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    const hex = cv.px[y * cv.w + x];
    if (hex) setPx(img, x, y + dy, hexPx(hex));
  }
  return img;
}

// ------------------------------------------------------------------ pose helpers

const POINT_KEYS = ['head', 'chest', 'hip'];
export function clonePose(P) {
  const o = { ...P };
  for (const k of POINT_KEYS) o[k] = [...P[k]];
  o.up = [...(P.up ?? [0, -1])];
  o.side = [...(P.side ?? [1, 0])];
  o.hands = P.hands.map((h) => [...h]);
  o.feet = P.feet.map((h) => [...h]);
  if (P.knees) o.knees = P.knees.map((h) => (h ? [...h] : h));
  if (P.elbows) o.elbows = P.elbows.map((h) => (h ? [...h] : h));
  if (P.fists) o.fists = [...P.fists];
  if (P.z) o.z = { ...P.z };
  return o;
}

export function lerpFighter(a0, b0, t) {
  const a = resolve(a0), b = resolve(b0);
  const o = clonePose(t < 0.5 ? a : b);
  for (const k of POINT_KEYS) o[k] = lerp2(a[k], b[k], t);
  o.up = norm(lerp2(a.up ?? [0, -1], b.up ?? [0, -1], t));
  o.side = norm(lerp2(a.side ?? [1, 0], b.side ?? [1, 0], t));
  o.hands = a.hands.map((h, i) => lerp2(h, b.hands[i], t));
  o.feet = a.feet.map((h, i) => lerp2(h, b.feet[i], t));
  o.knees = a.knees.map((p, i) => lerp2(p, b.knees[i], t));
  o.elbows = a.elbows.map((p, i) => lerp2(p, b.elbows[i], t));
  o.spread = lerp(a.spread ?? 0.7, b.spread ?? 0.7, t);
  o.hsp = lerp(a.hsp ?? 0.5, b.hsp ?? 0.5, t);
  return o;
}

export function lerpPair(a, b, t) {
  return { A: lerpFighter(a.A, b.A, t), B: lerpFighter(a.B, b.B, t), top: t < 0.5 ? a.top : b.top };
}

export function shiftFighter(P, dx, dy, parts = ['head', 'chest', 'hip', 'hands', 'feet']) {
  const o = clonePose(P);
  const mv = (p) => [p[0] + dx, p[1] + dy];
  if (parts.includes('head')) o.head = mv(o.head);
  if (parts.includes('chest')) o.chest = mv(o.chest);
  if (parts.includes('hip')) o.hip = mv(o.hip);
  if (parts.includes('hands')) o.hands = o.hands.map(mv);
  if (parts.includes('feet')) o.feet = o.feet.map(mv);
  if (parts.includes('feet') && o.knees) o.knees = o.knees.map((p) => (p ? mv(p) : p));
  if (parts.includes('hands') && o.elbows) o.elbows = o.elbows.map((p) => (p ? mv(p) : p));
  return o;
}

/**
 * Turns a whole fighter about `pivot` by `deg` (y down, positive = clockwise on screen): every joint and the head's up / side vectors,
 * so a thrown body is redrawn upside down with its own light and outline (not a rotated bitmap).
 */
export function rotateFighter(P, pivot, deg) {
  const o = resolve(P);
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const rp = (p) => { const d = sub(p, pivot); return [pivot[0] + d[0] * ca - d[1] * sa, pivot[1] + d[0] * sa + d[1] * ca]; };
  const rv = (v) => [v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca];
  for (const k of POINT_KEYS) o[k] = rp(o[k]);
  o.hands = o.hands.map(rp); o.feet = o.feet.map(rp); o.knees = o.knees.map(rp); o.elbows = o.elbows.map(rp);
  o.up = rv(o.up ?? [0, -1]); o.side = rv(o.side ?? [1, 0]);
  return o;
}

/** One standalone fighter (the referee sprites) on a w x h canvas; the pose is given in drawn space (no pair scaling). */
export function renderSingle(P, who = 'R', w = 16, h = 32, fx = []) {
  const cv = canvas(w, h);
  const items = fighterParts(resolve(P), who).map((part) => ({ who, part, z: part.z }));
  drawFighterAll(cv, items);
  for (const f of fx) f(cv, put);
  return cv;
}

/** Stamps an ASCII pattern with a navy outline: s skin, S highlight, d shade, y fx yellow. (x, y) = top-left of the pattern. */
export function stampPattern(cv, x, y, rows, skin) {
  const col = { s: skin[2], S: skin[3], d: skin[1], y: FX_COL.y, w: FX_COL.w };
  const m = new Set();
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') m.add((y + j) * 256 + x + i); }));
  for (const k of m) {
    const px = k % 256, py = Math.floor(k / 256);
    for (const [dx, dy] of NEIGH) if (!m.has(k + dy * 256 + dx)) put(cv, px + dx, py + dy, OL);
  }
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') put(cv, x + i, y + j, col[c]); }));
}
