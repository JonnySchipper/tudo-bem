// BJJ pair sprites: a tiny pixel "puppet" renderer. Each fighter is a head disc, a torso capsule, two arms and two legs (two-bone IK
// from shoulder / hip to a hand / foot target), drawn as outlined stickers (navy outline, light from the upper left) in key colors:
// skin / hair from KEY_RAMPS (fighter A) or skin2 / hair2 (fighter B), gi white (A) or blue (B), belt key ramp (A) or a black belt (B).
// Poses are plain objects (see bjj-poses.mjs); transitions interpolate poses; struggle loops jiggle them.
import { blank, setPx, hexPx } from '../../../../scripts/lib/pixel/img.mjs';
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';

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
  A: { gi: GI_WHITE, skin: KEY_RAMPS.skin, hair: KEY_RAMPS.hair, belt: KEY_RAMPS.belt },
  /** Professora Bia (referee): white gi, black belt, skin / hair on the standard key ramps. */
  R: { gi: GI_WHITE, skin: KEY_RAMPS.skin, hair: KEY_RAMPS.hair, belt: BELT_BLACK },
  B: { gi: GI_BLUE, skin: KEY_RAMPS.skin2, hair: KEY_RAMPS.hair2, belt: BELT_BLACK },
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

/** Canvas of hex strings. */
export function canvas(w = W, h = H) {
  return { px: new Array(w * h).fill(null), w, h };
}
export const put = (cv, x, y, hex) => { if (x >= 0 && y >= 0 && x < cv.w && y < cv.h) cv.px[y * cv.w + x] = hex; };

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
        const score = d / rr;
        if (!prev || score < prev.score) m.set(key, { x, y, score, nx: o[0] / rr, ny: o[1] / rr, seg: s });
      }
    }
  }
  return m;
}

function stamp(cv, segs, color, outline = OL) {
  const m = maskOf(segs);
  if (outline) {
    for (const { x, y } of m.values()) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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
 *   z: { arm0, arm1, leg0, leg1, torso, head: 'under' | 'far' | 'over' | number }
 */
export function fighterParts(P, who) {
  const pal = FIGHTERS[who];
  const parts = [];
  const axis = norm(sub(P.hip, P.chest));
  const pr = perp(axis);
  const spread = P.spread ?? 0.7, hsp = P.hsp ?? 0.5;
  const base = 0; // fighter z base is added by the caller
  const zOf = (name, dflt) => {
    const o = P.z?.[name];
    if (o === 'under') return -200 + dflt;
    if (o === 'over') return 200 + dflt;
    if (o === 'far') return dflt - 4;
    if (typeof o === 'number') return o;
    return dflt;
  };

  // legs
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? 1 : -1;
    const hipJ = add(P.hip, mul(pr, sgn * hsp * DIM.rt));
    const { elbow: knee, end } = P.knees?.[i] ? { elbow: P.knees[i], end: P.feet[i] } : twoBone(hipJ, P.feet[i], DIM.leg[0], DIM.leg[1], P.bendL?.[i] ?? 1);
    const far = P.z?.['leg' + i] === 'far';
    const segs = [
      { a: hipJ, b: knee, ra: 1.95, rb: 1.8, mat: 'gi' },
      { a: knee, b: end, ra: 1.8, rb: 1.55, mat: 'gi' },
      { a: add(end, mul(norm(sub(end, knee)), 1.0)), b: add(end, mul(norm(sub(end, knee)), 1.6)), ra: 1.5, rb: 1.3, mat: 'skin' },
    ];
    parts.push({ z: zOf('leg' + i, 1 + i * 0.1), segs, far, name: 'leg' });
  }
  // torso
  const tsegs = [{ a: P.chest, b: P.hip, ra: DIM.rt, rb: DIM.rt - 0.3, mat: 'gi' }];
  parts.push({ z: zOf('torso', 3), segs: tsegs, torso: { axis, pr, chest: P.chest, hip: P.hip, back: !!P.back }, name: 'torso' });
  // belt tails
  const bp = lerp2(P.chest, P.hip, 0.8);
  const tailBase = add(bp, mul(pr, 0.6));
  const tail1 = add(tailBase, add(mul(axis, 2.6), mul(pr, 1.2)));
  const tail2 = add(tailBase, add(mul(axis, 2.2), mul(pr, -0.9)));
  parts.push({ z: zOf('torso', 3) + 0.5, segs: [{ a: tailBase, b: tail1, ra: 0.8, rb: 0.7, mat: 'belt' }, { a: tailBase, b: tail2, ra: 0.8, rb: 0.7, mat: 'belt' }], name: 'tails' });
  // head
  parts.push({ z: zOf('head', 5), segs: [{ a: P.head, b: P.head, ra: P.rh ?? DIM.rh, rb: P.rh ?? DIM.rh, mat: 'head' }], head: P, name: 'head' });
  // arms
  for (let i = 0; i < 2; i++) {
    const sgn = i === 0 ? 1 : -1;
    const sh = add(P.chest, mul(pr, sgn * spread * DIM.rt));
    const { elbow, end } = P.elbows?.[i] ? { elbow: P.elbows[i], end: P.hands[i] } : twoBone(sh, P.hands[i], DIM.arm[0], DIM.arm[1], P.bendA?.[i] ?? 1);
    const dirW = norm(sub(end, elbow));
    const far = P.z?.['arm' + i] === 'far';
    const segs = [
      { a: sh, b: elbow, ra: 1.3, rb: 1.2, mat: 'gi' },
      { a: elbow, b: end, ra: 1.2, rb: 1.1, mat: 'gi' },
      { a: add(end, mul(dirW, 0.7)), b: add(end, mul(dirW, 1.2)), ra: 1.3, rb: 1.2, mat: 'skin' },
    ];
    parts.push({ z: zOf('arm' + i, 7 + i * 0.1), segs, far, name: 'arm' });
  }
  void base;
  return parts;
}

function colorFor(part, pal) {
  return (v) => {
    const far = part.far;
    const lit = litOf(v);
    if (part.name === 'head') return null; // handled elsewhere
    const m = v.seg.mat;
    if (m === 'skin') return pal.skin[Math.min(3, Math.max(1, rankOf(lit, far)))];
    if (m === 'belt') return pal.belt[Math.min(2, Math.max(0, rankOf(lit, far) - 1))];
    return pal.gi[rankOf(lit, far)];
  };
}

function drawHead(cv, part, pal) {
  const P = part.head;
  const c = P.head, up = norm(P.up ?? [0, -1]);
  const face = P.face ?? 'profile';
  const side = norm(P.side ?? [1, 0]);
  const hairLine = P.hairLine ?? 0.25;
  const m = stamp(cv, part.segs, (v) => {
    const lit = litOf(v);
    const o = [v.x + 0.5 - c[0], v.y + 0.5 - c[1]];
    const bu = dot2(o, up) / (P.rh ?? DIM.rh);
    const sa = dot2(o, side) / (P.rh ?? DIM.rh);
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
    { const k = (P.rh ?? DIM.rh) * 0.34; eye(-0.5, -k, 1); eye(-0.5, k, -1); }
    px(at(-2.6, 0.4), pal.skin[1]);
  } else if (face === 'three') {
    eye(-0.5, 0.6, 1); eye(-0.5, 2.7, 1);
    px(at(-2.6, 1.8), pal.skin[1]);
  } else if (face === 'profile') {
    eye(-0.5, 2.6, 1);
    px(at(-2.6, 3.0), pal.skin[1]);
  }
}

function drawTorsoDetail(cv, part, pal) {
  const { axis, pr, chest, hip } = part.torso;
  const neck = add(chest, mul(axis, -1.4));
  const apex = lerp2(chest, hip, 0.62);
  const line = (a, b, hex) => {
    let [x0, y0] = [Math.floor(a[0]), Math.floor(a[1])];
    const [x1, y1] = [Math.floor(b[0]), Math.floor(b[1])];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(cv, x0, y0, hex);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  if (!part.torso.back) line(add(neck, mul(pr, 1.8)), apex, pal.gi[1]);
  if (!part.torso.back) line(add(neck, mul(pr, -1.8)), apex, pal.gi[1]);
  // belt band across the torso at 80%
  const bp = lerp2(chest, hip, 0.8);
  for (let t = -3; t <= 3; t += 0.5) {
    const p = add(bp, mul(pr, t));
    const x = Math.floor(p[0]), y = Math.floor(p[1]);
    put(cv, x, y, pal.belt[1]);
    const p2 = add(p, mul(axis, 1));
    put(cv, Math.floor(p2[0]), Math.floor(p2[1]), pal.belt[0]);
  }
  // knot
  const kp = add(bp, mul(pr, 0.5));
  put(cv, Math.floor(kp[0]), Math.floor(kp[1]), pal.belt[2]);
}

/** Draws one fighter into the canvas parts list (caller sorts all parts by z). */
export function drawFighterAll(cv, items) {
  items.sort((a, b) => a.z - b.z);
  for (const it of items) {
    const pal = FIGHTERS[it.who];
    const part = it.part;
    if (part.name === 'head') drawHead(cv, part, pal);
    else {
      stamp(cv, part.segs, colorFor(part, pal));
      if (part.name === 'torso') drawTorsoDetail(cv, part, pal);
    }
  }
}

/**
 * Renders a pair pose { A: fighterPose, B: fighterPose, top: 'A'|'B', fx?: [...] } to a hex canvas.
 */
export function renderPair(pair) {
  const cv = canvas();
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
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!m.has(k + dy * 256 + dx)) put(cv, px + dx, py + dy, OL);
  }
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') put(cv, x + i, y + j, col[c]); }));
}
