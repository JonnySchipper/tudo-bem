// NPC dialogue portraits (art2): 64x64, 4 expressions each (neutro, feliz, surpreso, pensativo), hand-authored.
// A bust in a small framed card. Skin, hair and cloth use LimeZu ramps (Body_*/Hairstyles palettes, exteriors Palette.png) and the
// brand colors; light comes from the upper left; outlines are the pack navy against empty space and a tinted dark against parts.
// The LimeZu Interiors pack ships no face art (UI_16x16 has only speech bubbles and emotes), so these are original.
import { blank, put, shape, flat, grid, line, over, ell, box, or, sub, and, profile, hwAt, mx, mix, h2, fillRect, hoop, NAVY, alphaAt } from './paint.mjs';

export const EXPRESSIONS = ['neutro', 'feliz', 'surpreso', 'pensativo'];
export const NPCS = ['carlos', 'nanda', 'julia', 'graca', 'tia_lu', 'prof', 'ze', 'chico', 'rosa'];

// ------------------------------------------------------------------ palettes ([dark, shade, base, hi])
const SKIN = {
  tan: ['#cb794d', '#e6976d', '#f0ae80', '#f5c796'],
  light: ['#e58078', '#f69784', '#ffb893', '#ffcca8'],
  brown: ['#a85f46', '#b77455', '#c98b62', '#dca277'],
  deep: ['#7a3f30', '#96513a', '#b0603f', '#c87a55'],
  warm: ['#93513a', '#a9614a', '#bd7a55', '#d29468'],
};
const HAIR = {
  black: ['#2e2a3c', '#453a4c', '#5c4a55', '#7a6268'],
  chestnut: ['#6b3f2c', '#8a5233', '#a9683d', '#c98a55'],
  grey: ['#8b8bab', '#b2aecb', '#d8d0e0', '#ebe4f2'],
  saltpepper: ['#54506a', '#76728f', '#9a96b2', '#c6c2d6'],
};
const CLOTH = {
  cream: ['#b2aecb', '#d8d0e0', '#ebe4f2', '#f8f8f8'],
  terracotta: ['#a13a30', '#b35e3f', '#c45c26', '#dc8446'],
  mustard: ['#a8700f', '#c48f16', '#d4a017', '#eabd3a'],
  sky: ['#6f8fa8', '#8fb0c4', '#a8c5d4', '#cfe2ea'],
  green: ['#2a575b', '#32675a', '#46756a', '#689183'],
  plum: ['#3f3358', '#54467f', '#76689e', '#968bab'],
  red: ['#a82b2d', '#cb2a2a', '#e63f38', '#ff8575'],
  straw: ['#a9764f', '#c78c59', '#daa463', '#f1ce8e'],
  denim: ['#3d56d2', '#4280dd', '#4995e3', '#50a7e8'],
  orange: ['#c46823', '#ed931e', '#f2b22b', '#ffe57b'],
};
const IRIS = { carlos: '#573c2c', nanda: '#453a4c', julia: '#4280dd', graca: '#573c2c', tia_lu: '#573c2c', prof: '#453a4c', ze: '#573c2c', chico: '#3a2820', rosa: '#573c2c' };
/** Four-shade ramp from a brand hex (dark → hi). */
const ramp4 = (hex, dk = '#2a2218') => [mix(hex, dk, 0.42), mix(hex, dk, 0.2), hex, mix(hex, '#ffffff', 0.26)];
const ZE_SKIN = ramp4('#c68a5f');
const OLIVE_SHIRT = ramp4('#66753f');
const KHAKI = ramp4('#b89a6c');
const CHICO_SKIN = ramp4('#8a5433');
const CHICO_HAIR = ramp4('#1d1716', '#0a0808');
const CHICO_TEE = ramp4('#eee6d9', '#8a8070');
const JEANS = ramp4('#3d5d8f');
const ROSA_SKIN = ramp4('#d9a07a');
const ROSA_HAIR = ramp4('#9a5f30', '#4a3018');
const ROSA_BLOUSE = ramp4('#d98a9b');
const PLUM_SKIRT = ramp4('#6e4e8f');
const PANAMA = ramp4('#efe3c4', '#6a5e48');
const BUCKET = ramp4('#e8b634', '#6a5010');
const WHITE = '#f0ecf6';
const LIP_DARK = '#7f3034';
const MOUTH_IN = '#4a1a24';
const TONGUE = '#d56868';

// ------------------------------------------------------------------ geometry
const CX = 32;
/** Face half-widths by row. Variants tweak jaw/cheek width. */
const faceKp = (k = {}) => {
  const cheek = k.cheek ?? 15, jaw = k.jaw ?? 12, chin = k.chin ?? 46;
  return [[8, 9], [11, 13], [14, cheek - 0.6], [19, cheek], [28, cheek], [34, cheek - 1], [38, jaw], [41, jaw - 2.6], [chin - 2.5, jaw - 6], [chin - 1, 3.4], [chin, 0.8], [chin + 0.4, 0]];
};
const TORSO_HW = (y) => (y < 47 ? 0 : 29 * Math.sqrt(Math.max(0, 1 - ((y - 68) / 21) ** 2)));
const torsoPred = (x, y) => y >= 47 && Math.abs(x - CX) <= TORSO_HW(y);

// ------------------------------------------------------------------ backgrounds (inside the 2 px card frame)
function backdrop(img, bg) {
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    // soft light from the upper left: a diagonal band of lighter tone with a dithered edge
    const d = (x + y) / 2;
    const dither = (x + y) % 2 === 0;
    let c = bg.base;
    if (d < 15) c = bg.hi;
    else if (d < 19 && dither) c = bg.hi;
    else if (d > 50 && d < 53 && dither) c = bg.lo;
    else if (d >= 53) c = bg.lo;
    put(img, x, y, c);
  }
  bg.deco?.(img);
}

function frame(img, f) {
  const R = (x, y, c) => put(img, x, y, c);
  // 2 px frame: navy outer edge, wood ring (lit top/left, shaded bottom/right)
  for (let i = 0; i < 64; i++) {
    for (const [x, y] of [[i, 0], [i, 63], [0, i], [63, i]]) R(x, y, NAVY);
    const lit = f.hi, dk = f.lo;
    if (i >= 1 && i <= 62) {
      R(i, 1, lit); R(1, i, lit); R(i, 62, dk); R(62, i, dk);
    }
  }
  R(62, 1, f.mid); R(1, 62, f.mid);
  // round the corners
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [63, 0], [62, 0], [63, 1], [0, 63], [1, 63], [0, 62], [63, 63], [62, 63], [63, 62]]) img.data[(y * 64 + x) * 4 + 3] = 0;
  R(1, 1, NAVY); R(62, 1, NAVY); R(1, 62, NAVY); R(62, 62, NAVY);
}

// ------------------------------------------------------------------ body parts
function neck(img, skin) {
  shape(img, and(box(24, 40, 40, 51), (x, y) => Math.abs(x - CX) <= 6.6), [CX, 44, 7, 8], [skin[0], skin[0], skin[1], skin[1]], { ol: skin[0], t: [2, 2, -9] });
}

function torso(img, ramp, o = {}) {
  shape(img, torsoPred, [CX, 60, 29, 14], ramp, { ol: o.ol ?? ramp[0], t: [0.9, 0.44, 0.0] });
  // sleeve/arm crease shading hints
  for (const s of [-1, 1]) for (let y = 55; y < 64; y++) put(img, Math.round(CX + s * (22 + (y - 55) * 0.35)), y, ramp[0]);
}

function head(img, skin, kp, o = {}) {
  const face = profile(CX, kp);
  // ears
  for (const s of [-1, 1]) {
    const ex = CX + s * (hwAt(kp, 29) + 0.6);
    shape(img, ell(ex, 29.5, 2.4, 3.6), [ex, 29.5, 2.4, 3.6], [skin[0], skin[1], skin[2], skin[2]], { ol: skin[0] });
    put(img, Math.round(ex - 0.5 + s * -0.3), 29, skin[0]); put(img, Math.round(ex - 0.5 + s * -0.3), 30, skin[0]);
  }
  // clean cel shading: a lit patch upper-left, a shade crescent on the right cheek and under the jaw
  shape(img, face, [CX, 27, 16, 20], skin, {
    ol: skin[0],
    pattern: (x, y) => {
      const hw = Math.max(4, hwAt(kp, y));
      const nx = (x + 0.5 - CX) / hw, ny = (y - 27) / 19;
      const v = 0.85 * nx + 0.7 * ny;
      if (v > 1.05) return 0;
      if (v > 0.5) return 1;
      if (v < -0.62 && ny < 0.35 && ny > -0.5) return 3;
      return 2;
    },
  });
  return face;
}

function nose(img, skin, wide = 0) {
  const x = 31;
  put(img, x, 32, skin[3]); // bridge highlight
  put(img, x + 0, 33, skin[3]);
  put(img, x + 1, 33, skin[1]);
  for (let i = 0; i <= 1 + wide; i++) put(img, x - wide + i - 1 + 1, 34, skin[0]);
  put(img, x + 2 + wide, 34, skin[0]);
  put(img, x + 1, 34, skin[0]);
  put(img, x, 34, skin[1]);
  put(img, x + 2, 33, skin[1]);
}

// ------------------------------------------------------------------ eyes, brows, mouths
// Eye grids in final orientation (the highlight `h` sits in the upper-left of the iris for both eyes; the light is upper-left).
const EYE_L = {
  neutro: ['.oooo.', 'oihiio', '.oiio.'],
  feliz: ['..oo..', '.o..o.', 'o....o'],
  surpreso: ['.oooo.', 'owwwwo', 'owhiwo', 'owiiwo', '.owwo.'],
  pensativo: ['oooooo', 'oihiww', '.wwww.'],
};
const EYE_R = { ...EYE_L, pensativo: ['oooooo', 'wihiwo', '.wwww.'] };
function eye(img, x0, y0, expr, side, npc, opts = {}) {
  const pal = { o: NAVY, w: WHITE, i: IRIS[npc], h: '#ffffff' };
  grid(img, (side === 'r' ? EYE_R : EYE_L)[expr], pal, x0, y0, false);
  if (opts.lash) {
    // long lashes: a flick outside the outer corner
    const x = side === 'r' ? x0 + 6 : x0 - 1;
    put(img, x, y0, NAVY);
    put(img, x, y0 - 1, NAVY);
  }
}

const BROW = {
  neutro: [['BBBBBB', '.BBBB.'], ['BBBBBB', '.BBBB.']],
  feliz: [['.BBBB.', 'BB..BB'], ['.BBBB.', 'BB..BB']],
  surpreso: [['.BBBB.', 'BB..BB'], ['.BBBB.', 'BB..BB']],
  pensativo: [['BBB...', '..BBBB'], ['.BBBB.', 'B....B']],
};
const BROW_DY = { neutro: 0, feliz: -2, surpreso: -3, pensativo: 0 };
function brows(img, expr, color, y0, o = {}) {
  const pal = { B: color };
  const [l, r] = BROW[expr];
  // left brow (viewer's left) and right brow
  grid(img, l, pal, 23 + (o.dx ?? 0), y0 + BROW_DY[expr] + (o.rowL ?? 0), false);
  grid(img, r, pal, 35 - (o.dx ?? 0), y0 + BROW_DY[expr] + (expr === 'pensativo' ? -2 : 0) + (o.rowR ?? 0), true);
}

function mouth(img, expr, skin, o = {}) {
  const lip = o.lip ?? LIP_DARK;
  const pal = { d: lip, w: WHITE, p: TONGUE, D: MOUTH_IN, l: o.lipHi ?? '#b95d72' };
  const y = o.y ?? 38;
  if (expr === 'neutro') {
    grid(img, ['.dddd.', ], pal, 29, y + 1);
    put(img, 28, y, skin[1]); put(img, 35, y, skin[1]);
  } else if (expr === 'feliz') {
    grid(img, ['dddddddd', 'dwwwwwwd', '.dwwwwd.', '..dppd..', '...dd...'], pal, 28, y - 1);
  } else if (expr === 'surpreso') {
    grid(img, ['.dddd.', 'dDDDDd', 'dDDDDd', 'dDppDd', '.dddd.'], pal, 29, y - 1);
  } else {
    // pensativo: small mouth pulled to one side, corner up
    grid(img, ['.....dd', '.dddd..', 'dd.....'], pal, 28, y);
    put(img, 27, y + 1, skin[1]);
  }
}

function blush(img, skin, strength = 1) {
  const c = mix(skin[2], '#e07070', 0.45);
  for (const [x, y] of [[23, 33], [24, 33], [25, 33], [24, 34], [40, 33], [39, 33], [38, 33], [39, 34]]) put(img, x, y, c);
  if (strength > 1) for (const [x, y] of [[22, 34], [41, 34]]) put(img, x, y, c);
}

// ------------------------------------------------------------------ characters
function faceSet(img, npc, expr, skin, o = {}) {
  brows(img, expr, o.brow, o.browY ?? 21, o.browOpts);
  const ey = expr === 'surpreso' ? 24 : 25;
  const l = 23, r = 35;
  if (expr === 'feliz') { eye(img, l, ey + 1, expr, 'l', npc, o); eye(img, r, ey + 1, expr, 'r', npc, o); }
  else { eye(img, l, ey, expr, 'l', npc, o); eye(img, r, ey, expr, 'r', npc, o); }
  nose(img, skin, o.noseWide ?? 0);
  if (expr === 'feliz') blush(img, skin, o.blush ?? 1);
  if (o.cheeks) o.cheeks(img, expr);
  mouth(img, expr, skin, o.mouth);
}

const RENDER = {};

RENDER.carlos = (img, expr) => {
  const skin = ramp4('#c68a5f'), kp = faceKp({ cheek: 15.5, jaw: 13.5 });
  // shirt and apron
  torso(img, CLOTH.terracotta, { ol: '#7f3034' });
  neck(img, skin);
  // collar V of the shirt
  flat(img, (x, y) => y >= 47 && y < 52 && Math.abs(x - CX) <= 8 - (y - 47) * 1.1 && Math.abs(x - CX) > 4.6 - (y - 47) * 1.0, CLOTH.terracotta[3], { ol: '#7f3034' });
  // apron bib (cream) + straps over the shoulders
  const bib = (x, y) => y >= 52 && Math.abs(x - CX) <= 13.5 - Math.max(0, 56 - y) * 0.6 && Math.abs(x - CX) <= TORSO_HW(y) - 3;
  shape(img, bib, [CX, 58, 14, 8], CLOTH.cream, { ol: '#7a7a95', t: [0.9, 0.35, -0.2] });
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    const x = CX + s * (9 - i * 0.2), y = 47 + i * 1.0;
    fillRect(img, Math.round(x - 1.5 + (s > 0 ? 0.5 : 0)), Math.round(y), 3, 1, CLOTH.cream[2 + (s < 0 ? 1 : 0)]);
  }
  // pocket
  fillRect(img, 27, 57, 10, 1, CLOTH.cream[1]); fillRect(img, 27, 58, 1, 4, CLOTH.cream[1]); fillRect(img, 36, 58, 1, 4, CLOTH.cream[0]); fillRect(img, 27, 62, 10, 1, CLOTH.cream[0]);
  put(img, 32, 59, CLOTH.terracotta[1]); put(img, 33, 59, CLOTH.terracotta[1]);
  head(img, skin, kp);
  // graying sideburns
  for (const s of [-1, 1]) for (let y = 22; y < 30; y++) { const x0 = Math.round(CX + s * (hwAt(kp, y) - 0.5) - (s > 0 ? 0 : 0.5)); put(img, x0, y, HAIR.saltpepper[y < 26 ? 2 : 1]); if (y < 27) put(img, x0 - s, y, HAIR.saltpepper[1]); }
  faceSet(img, 'carlos', expr, skin, {
    brow: HAIR.saltpepper[0], browY: 21, noseWide: 1, browOpts: { dx: -1 },
    mouth: { y: 39, lip: LIP_DARK },
    cheeks: (im) => { for (const s of [-1, 1]) { put(im, s < 0 ? 21 : 42, 31, skin[1]); put(im, s < 0 ? 20 : 43, 30, skin[1]); put(im, s < 0 ? 22 : 41, 22, skin[1]); } },
  });
  // mustache: thick, grey-black, over the mouth (drawn above the mouth top)
  const mustache = (x, y) => {
    const dx = Math.abs(x - CX);
    if (y >= 35 && y < 36) return dx <= 6.5;
    if (y >= 36 && y < 37) return dx <= 9;
    if (y >= 37 && y < 38) return dx >= 1.2 && dx <= 9.6;
    if (y >= 38 && y < 39) return dx >= 5.2 && dx <= 9.6;
    return false;
  };
  shape(img, mustache, [CX, 37, 10, 2], ['#3f3b55', '#54506a', '#76728f', '#9a96b2'], { outline: false, t: [0.96, 0.15, -0.8] });
  put(img, 31, 35, '#3f3b55'); put(img, 32, 35, '#3f3b55');
  // baker's cap: puffed crown, band, side folds
  const crown = or(ell(CX, 8.5, 17.5, 7), box(15, 9, 49, 13));
  shape(img, crown, [CX, 8, 17.5, 7], CLOTH.cream, { ol: '#7a7a95', t: [0.85, 0.3, -0.15] });
  const bandR = (x, y) => y >= 11 && y < 16.5 && Math.abs(x - CX) <= 16.4 - Math.max(0, y - 14.5) * 1.2;
  shape(img, bandR, [CX, 14, 17, 3], CLOTH.cream, { ol: '#7a7a95', t: [0.95, 0.4, -0.3] });
  for (const [x, y] of [[21, 4], [22, 5], [27, 3], [28, 4], [33, 3], [34, 4], [40, 4], [41, 5], [24, 8], [37, 8], [30, 7], [44, 8]]) put(img, x, y, CLOTH.cream[1]);
  fillRect(img, 17, 15, 30, 1, CLOTH.cream[1]);
};

/** curly hair texture: bubbly clumps lit from the upper-left, dark gaps between them */
const curly = (x, y, idx) => {
  const row = Math.floor(y / 4.6), off = row % 2 ? 2.5 : 0;
  const ccx = Math.floor((x + off) / 5) * 5 + 2.5 - off, ccy = row * 4.6 + 2.3;
  const dx = x - ccx, dy = y - ccy;
  const d = Math.hypot(dx, dy);
  if (d > 2.6) return 0;
  if (dx + dy < -1.1) return 3;
  if (dx + dy < 0.8) return 2;
  return 1;
};

RENDER.nanda = (img, expr) => {
  const skin = SKIN.brown, kp = faceKp({ cheek: 14.5, jaw: 11.5 });
  // long dark curls behind the shoulders
  shape(img, or(ell(CX, 30, 22, 19), box(10, 30, 54, 50)), [CX, 32, 22, 20], HAIR.black, { ol: '#231f2e', pattern: (x, y, i) => curly(x, y, i) });
  torso(img, CLOTH.mustache ?? CLOTH.mustard, { ol: '#7a520a' });
  // scoop neckline showing skin
  shape(img, and(ell(CX, 46, 10.5, 8.5), (x, y) => y >= 47), [CX, 47, 11, 8], [skin[0], skin[1], skin[1], skin[2]], { ol: '#7a520a', t: [1.5, 0.3, -0.5] });
  for (const [x, y] of [[26, 50], [27, 51], [37, 51], [38, 50]]) put(img, x, y, skin[0]);
  // a thin gold chain
  for (let i = 0; i < 12; i++) put(img, 26 + i, 50 + Math.round(Math.sin((i / 11) * Math.PI) * 4), '#f8d239');
  put(img, 32, 55, '#ed931e'); put(img, 31, 55, '#f8d239'); put(img, 32, 54, '#fff59a');
  neck(img, skin);
  head(img, skin, kp);
  // brim shadow across the forehead
  for (let x = 17; x < 47; x++) if (profile(CX, kp)(x + 0.5, 17.5)) put(img, x, 17, skin[0]);
  for (let x = 18; x < 46; x++) if (profile(CX, kp)(x + 0.5, 18.5)) put(img, x, 18, skin[1]);
  faceSet(img, 'nanda', expr, skin, { brow: HAIR.black[0], browY: 21, lash: true, mouth: { y: 38, lip: '#a83c46' }, blush: 1 });
  // curls falling over the shoulders in front of the ears
  for (const s of [-1, 1]) shape(img, ell(CX + s * 19.5, 34, 4.6, 13.5), [CX + s * 19.5, 34, 5, 14], HAIR.black, { ol: '#231f2e', pattern: curly });
  // gold hoops
  for (const s of [-1, 1]) hoop(img, CX + s * 17.2, 42.5, 2.7);
  // straw hat: brim first, then the crown with a terracotta band
  const brim = ell(CX, 11.6, 29, 5.6);
  shape(img, brim, [CX, 11.6, 29, 6], CLOTH.straw, {
    ol: '#7b5b3a',
    pattern: (x, y) => {
      const r = Math.hypot((x - CX) / 29, (y - 11.6) / 5.6);
      const ring = Math.floor(r * 13);
      const lit = (x - CX) + (y - 11.6) * 1.5 < -6 ? 3 : 2;
      if (r > 0.9) return 1;
      return ring % 2 ? (lit === 3 ? 2 : 1) : lit;
    },
  });
  const crown = or(ell(CX, 6.6, 12.5, 7.4), box(19.5, 7, 44.5, 12.5));
  shape(img, crown, [CX, 7, 12.5, 7.4], CLOTH.straw, {
    ol: '#7b5b3a',
    pattern: (x, y, idx) => {
      const weave = (Math.floor(x / 2) + y) % 3 === 0;
      return weave ? Math.max(0, idx - 1) : idx;
    },
  });
  fillRect(img, 20, 9, 24, 3, CLOTH.terracotta[2]); fillRect(img, 20, 9, 24, 1, CLOTH.terracotta[3]); fillRect(img, 20, 11, 24, 1, CLOTH.terracotta[0]);
  put(img, 32, 10, '#f8d239'); put(img, 33, 10, '#f8d239');
};

RENDER.julia = (img, expr) => {
  // Praça guide: high ponytail and a market tote. Cream blouse, no apron, no baker's cap.
  const skin = ramp4('#eec1a0'), kp = faceKp({ cheek: 14, jaw: 11 });
  const hair = ramp4('#9a5f30', '#4a3018');
  const tote = ramp4('#f4ede2', '#7a7570');
  torso(img, CLOTH.cream, { ol: '#7a7a95' });
  neck(img, skin);
  head(img, skin, kp);
  faceSet(img, 'julia', expr, skin, { brow: hair[0], browY: 21, lash: true, mouth: { y: 38, lip: '#d56868' }, blush: 1 });
  // hairline only. A wide cap here turns the tail into a hat, so the brown on the scalp stays below the forehead.
  shape(img, and(ell(CX, 20, 16.4, 7), (x, y) => y >= 16 && y <= 19), [CX, 17, 16, 3], hair, { ol: '#43261b', t: [0.8, 0.28, -0.1] });
  for (const s of [-1, 1]) for (let y = 17; y < 24; y++) {
    const x0 = Math.round(CX + s * (hwAt(kp, y) - 1.2));
    put(img, x0, y, hair[0]); put(img, x0 - s, y, hair[y < 20 ? 2 : 1]);
  }
  // high ponytail: a puff, a neck thinner than the head, a coral scrunchie on that neck alone
  shape(img, ell(32, 5, 6.2, 3.8), [32, 5, 6, 3.6], hair, { ol: '#43261b', t: [0.82, 0.3, -0.12] });
  for (let y = 8; y <= 16; y++) {
    for (let x = 30; x <= 33; x++) put(img, x, y, x < 32 ? hair[2] : hair[1]);
    put(img, 29, y, '#43261b'); put(img, 34, y, '#43261b');
  }
  for (let x = 28; x <= 35; x++) { put(img, x, 14, '#f0a090'); put(img, x, 15, '#c45c26'); }
  put(img, 28, 14, '#43261b'); put(img, 35, 15, '#43261b');
  for (const [x, y] of [[30, 3], [31, 4], [33, 4], [34, 5], [32, 7], [31, 9]]) put(img, x, y, hair[3]);
  // market tote in front of the shoulder: two handles, a cloth bag, a leaf, a terracotta stripe
  for (let i = 0; i < 12; i++) { put(img, 44, 42 + i, tote[0]); put(img, 45, 42 + i, tote[2]); put(img, 58, 42 + i, tote[1]); put(img, 59, 42 + i, tote[0]); }
  shape(img, box(42, 50, 62, 63), [52, 56, 10, 7], tote, { ol: '#7a7570', t: [0.9, 0.35, -0.2] });
  shape(img, (x, y) => {
    const t = (y - 46) / 8;
    if (t < 0 || t > 1) return false;
    return Math.abs(x - 50 - (y - 50) * 0.15) <= Math.sin(t * Math.PI) * 2.4;
  }, [50, 50, 3, 4], ramp4('#3d8a4e', '#1a3120'), { ol: '#1a3120' });
  fillRect(img, 43, 56, 18, 2, '#c45c26');
  fillRect(img, 43, 56, 18, 1, '#e07a5f');
};

RENDER.graca = (img, expr) => {
  const skin = SKIN.deep, kp = faceKp({ cheek: 14.5, jaw: 12.5 });
  const hair = HAIR.grey;
  // grey bun on top
  shape(img, ell(CX, 6.5, 7.5, 5.2), [CX, 6.5, 8, 5.5], hair, { ol: '#6c6e85', t: [0.8, 0.3, -0.1], pattern: (x, y, i) => ((x + y * 2) % 5 === 0 ? Math.max(0, i - 1) : i) });
  torso(img, CLOTH.plum, { ol: '#2a2140' });
  // collar and apron (pale blue with a cream trim)
  const bib = (x, y) => y >= 51 && Math.abs(x - CX) <= 12 - Math.max(0, 55 - y) * 0.8 && Math.abs(x - CX) <= TORSO_HW(y) - 3;
  shape(img, bib, [CX, 58, 13, 8], CLOTH.sky, { ol: '#4e6f86', t: [0.9, 0.35, -0.2] });
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) fillRect(img, Math.round(CX + s * (8.5 - i * 0.3) - (s < 0 ? 1.5 : 0.5)), 47 + i, 2, 1, CLOTH.sky[2 + (s < 0 ? 1 : 0)]);
  fillRect(img, 21, 55, 22, 1, CLOTH.cream[2]);
  for (let x = 22; x < 42; x += 3) put(img, x, 58, CLOTH.sky[1]);
  fillRect(img, 28, 60, 8, 3, CLOTH.sky[1]); fillRect(img, 28, 60, 8, 1, CLOTH.sky[3]);
  neck(img, skin);
  head(img, skin, kp);
  // wrinkles: forehead, crow's feet, nasolabial
  for (const [x, y] of [[26, 18], [27, 18], [36, 18], [37, 18], [22, 33], [21, 34], [41, 33], [42, 34]]) put(img, x, y, skin[1]);
  for (const s of [-1, 1]) { put(img, s < 0 ? 24 : 39, 31, skin[1]); put(img, s < 0 ? 26 : 37, 31, skin[1]); put(img, s < 0 ? 25 : 38, 31, skin[1]); }
  faceSet(img, 'graca', expr, skin, { brow: HAIR.grey[0], browY: 21, mouth: { y: 39, lip: '#5a1c26' }, blush: 1 });
  // pulled-back hair: cap over the crown, hairline, side sweeps above the ears
  shape(img, and(ell(CX, 14, 16.8, 11.5), (x, y) => y < 18 + Math.abs(x - CX) * -0.12 + (Math.abs(x - CX) > 12 ? (Math.abs(x - CX) - 12) * 3.5 : 0)), [CX, 12, 17, 12], hair, { ol: '#6c6e85', t: [0.75, 0.25, -0.1] });
  for (let i = 0; i < 4; i++) { put(img, 25 + i, 9 + Math.round(i * 0.7), hair[3]); }
  put(img, 32, 13, hair[1]); put(img, 32, 14, hair[1]); put(img, 32, 15, hair[1]);
  for (const s of [-1, 1]) for (let y = 19; y < 24; y++) { const x = Math.round(CX + s * (hwAt(kp, y) - 1)); put(img, x, y, hair[1]); }
  // round glasses (slate frames, a glint on each lens)
  for (const [cx, cy] of [[26, 27.5], [38, 27.5]]) {
    for (let a = 0; a < 40; a++) { const r = 4.9; put(img, Math.floor(cx + Math.cos((a / 40) * 6.2832) * r), Math.floor(cy + Math.sin((a / 40) * 6.2832) * r), '#565972'); }
    put(img, Math.floor(cx) - 2, Math.floor(cy) - 3, '#d8d0e0'); put(img, Math.floor(cx) - 3, Math.floor(cy) - 2, '#d8d0e0');
  }
  fillRect(img, 31, 26, 2, 1, '#565972');
};

RENDER.tia_lu = (img, expr) => {
  const skin = SKIN.warm, kp = faceKp({ cheek: 16.2, jaw: 14, chin: 46 });
  torso(img, CLOTH.green, { ol: '#1f4046' });
  // orange apron with straps
  const bib = (x, y) => y >= 51 && Math.abs(x - CX) <= 14 - Math.max(0, 55 - y) * 0.7 && Math.abs(x - CX) <= TORSO_HW(y) - 3;
  shape(img, bib, [CX, 58, 14, 8], CLOTH.orange, { ol: '#a8600f', t: [0.9, 0.35, -0.2] });
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) fillRect(img, Math.round(CX + s * (9.5 - i * 0.3) - (s < 0 ? 1.5 : 0.5)), 47 + i, 2, 1, CLOTH.orange[2 + (s < 0 ? 1 : 0)]);
  fillRect(img, 26, 58, 12, 1, CLOTH.orange[1]); fillRect(img, 26, 59, 1, 4, CLOTH.orange[1]); fillRect(img, 37, 59, 1, 4, CLOTH.orange[0]); fillRect(img, 26, 63, 12, 1, CLOTH.orange[0]);
  put(img, 30, 60, '#e63f38'); put(img, 31, 60, '#ff8575'); put(img, 34, 61, '#9bc246'); put(img, 33, 61, '#b8d040'); // painted fruit
  neck(img, skin);
  // bead necklace
  const beads = ['#e63f38', '#f8d239', '#4995e3', '#f8d239', '#e63f38'];
  for (let i = 0; i < 11; i++) put(img, 26 + i, 48 + Math.round(Math.sin((i / 10) * Math.PI) * 4), beads[i % beads.length]);
  head(img, skin, kp);
  // smile lines and cheek roundness
  for (const [x, y] of [[21, 26], [21, 28], [42, 26], [42, 28], [23, 36], [22, 37], [40, 36], [41, 37]]) put(img, x, y, skin[1]);
  faceSet(img, 'tia_lu', expr, skin, { brow: HAIR.black[0], browY: 22, lash: true, mouth: { y: 38, lip: '#b0303a' }, blush: 2, noseWide: 1 });
  // headscarf (lenço): red with cream dots, a rolled band on the forehead, a bow on top
  const dome = and(ell(CX, 14, 18.6, 12), (x, y) => y < 20.5);
  shape(img, dome, [CX, 13, 19, 12], CLOTH.red, { ol: '#7a1c20' });
  // dots need a cream color: repaint them
  for (let y = 3; y < 21; y++) for (let x = 12; x < 52; x++) if (dome(x + 0.5, y + 0.5) && (Math.floor(y / 3) % 2 ? x + 2 : x) % 5 === 0 && y % 3 === 1 && Math.abs(x - CX) < 17) put(img, x, y, '#f8ecd0');
  fillRect(img, 14, 17, 36, 3, CLOTH.red[1]);
  for (let x = 14; x < 50; x += 3) { put(img, x, 17, CLOTH.red[3]); put(img, x + 1, 18, CLOTH.red[3]); put(img, x + 1, 19, CLOTH.red[0]); }
  for (const s of [-1, 1]) shape(img, ell(CX + s * 6.5, 5.6, 6, 3.4), [CX + s * 6.5, 5.6, 6, 3.5], CLOTH.red, { ol: '#7a1c20', t: [0.8, 0.3, -0.1] });
  shape(img, ell(CX, 6.5, 2.6, 2.6), [CX, 6.5, 3, 3], CLOTH.red, { ol: '#7a1c20', t: [0.7, 0.2, -0.2] });
  for (const [x, y] of [[22, 5], [25, 6], [39, 5], [42, 6]]) put(img, x, y, '#f8ecd0');
  // big hoops
  for (const s of [-1, 1]) hoop(img, CX + s * 17.9, 36.6, 2.9);
};

RENDER.prof = (img, expr) => {
  // Professora Bia: a woman in her 30s, warm brown skin, short dark hair, a white BJJ gi whose crossed lapels open on a dark rashguard
  const skin = SKIN.warm, kp = faceKp({ cheek: 14.2, jaw: 11.5 });
  const hair = HAIR.black;
  // the nape and sides of the short hair, behind the head
  shape(img, profile(CX, [[8, 10], [11, 15.5], [16, 18], [24, 18.8], [30, 18.4], [35, 16.2], [38, 11]]), [CX, 26, 19, 16], hair, { ol: '#231f2e', t: [0.8, 0.3, -0.1] });
  torso(img, CLOTH.cream, { ol: '#7a7a95' });
  neck(img, skin);
  // rashguard in the V, then the two lapels crossing, each a thick diagonal with a shaded edge
  flat(img, (x, y) => y >= 47 && y < 57 && Math.abs(x - CX) < 9.5 - (y - 47) * 0.95, '#2e2a3c', { outline: false });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const x = CX + s * (10 - i * 0.98), y = 47 + i * 1.0;
      fillRect(img, Math.round(x - (s < 0 ? 1 : 2)), Math.round(y), 4, 1, i < 4 ? CLOTH.cream[3] : CLOTH.cream[s < 0 ? 3 : 2]);
      put(img, Math.round(x + (s < 0 ? 3 : -3)), Math.round(y), CLOTH.cream[0]);
      put(img, Math.round(x - (s < 0 ? 2 : 3)), Math.round(y), '#8b8bab');
    }
  }
  // stitched rib line down each lapel and a small patch on the shoulder
  for (const s of [-1, 1]) for (let i = 1; i < 10; i += 2) put(img, Math.round(CX + s * (10 - i * 0.98) - s * 0.2), 47 + i, CLOTH.cream[1]);
  fillRect(img, 14, 58, 6, 3, '#3d56d2'); fillRect(img, 14, 58, 6, 1, '#4995e3'); put(img, 16, 59, '#f8f8f8'); put(img, 17, 59, '#f8f8f8');
  head(img, skin, kp);
  faceSet(img, 'prof', expr, skin, { brow: hair[0], browY: 21, lash: true, mouth: { y: 38, lip: '#9a3a44' }, blush: 1 });
  // short hair: a cap with a side-swept fringe, clean sides over the tops of the ears, a few shine streaks
  const hairline = (x) => (x < 36 ? 16.2 + (36 - x) * 0.3 : 16 + (x - 36) * 0.5);
  shape(img, and(ell(CX, 13, 18.2, 13.8), (x, y) => y < hairline(x)), [CX - 3, 11, 18, 13], hair, {
    ol: '#231f2e', t: [0.78, 0.3, -0.1],
    pattern: (x, y, i) => ((Math.floor(x + y * 0.5) % 5 === 0) ? Math.min(3, i + 1) : (Math.floor(x + y * 0.5) % 5 === 2 ? Math.max(0, i - 1) : i)),
  });
  for (const s of [-1, 1]) for (let y = 17; y < 27; y++) { const x0 = Math.round(CX + s * (hwAt(kp, y) - 1.2) - (s < 0 ? 0 : 1)); put(img, x0, y, hair[y < 22 ? 1 : 0]); put(img, x0 + (s < 0 ? 1 : -1), y, hair[y < 22 ? 2 : 1]); }
  for (let i = 0; i < 8; i++) put(img, 36 - Math.round(i * 0.2), 6 + i, hair[0]);
  for (const [x, y] of [[23, 8], [24, 8], [25, 9], [26, 9], [21, 11], [22, 11], [23, 12], [16, 22], [16, 23]]) put(img, x, y, hair[3]);
};

RENDER.ze = (img, expr) => {
  const skin = ZE_SKIN, kp = faceKp({ cheek: 16.2, jaw: 14.2, chin: 46 });
  torso(img, OLIVE_SHIRT, { ol: OLIVE_SHIRT[0] });
  flat(img, (x, y) => y >= 60 && torsoPred(x, y), KHAKI[2], { ol: KHAKI[0] });
  neck(img, skin);
  flat(img, (x, y) => y >= 47 && y < 52 && Math.abs(x - CX) <= 8 - (y - 47) * 1.0 && Math.abs(x - CX) > 4.2 - (y - 47) * 0.9, OLIVE_SHIRT[3], { ol: OLIVE_SHIRT[0] });
  // verduras: pointed leaves and one dark olive with a catchlight. No apron — that would make him a second baker.
  const leaf = (cx, cy, h, w, lean) => (x, y) => {
    const t = (y - (cy - h / 2)) / h;
    if (t < 0 || t > 1) return false;
    const half = Math.sin(t * Math.PI) * w;
    return Math.abs(x - cx - (y - cy) * lean) <= half;
  };
  shape(img, leaf(47, 52, 14, 3.2, -0.15), [47, 52, 4, 7], ramp4('#3d8a4e', '#1a3120'), { ol: '#1a3120' });
  shape(img, leaf(56, 51, 13, 2.8, 0.2), [56, 51, 4, 7], ramp4('#5cb85c', '#243018'), { ol: '#243018' });
  shape(img, leaf(51, 48, 12, 2.4, 0.02), [51, 48, 3, 6], ramp4('#7aaa38', '#2a4018'), { ol: '#2a4018' });
  shape(img, ell(52, 58, 4.2, 3.1), [52, 58, 4, 3], ['#1a2010', '#2a3318', '#3d4a22', '#5a6a30'], { ol: '#0e1408' });
  put(img, 50, 57, '#d5e2a0'); put(img, 51, 57, '#eef6c8');
  head(img, skin, kp);
  const scalp = and(profile(CX, kp), (x, y) => y < 24);
  const zeHair = CHICO_HAIR;
  for (let y = 15; y < 23; y++) for (let x = 18; x < 46; x++) if (scalp(x + 0.5, y + 0.5) && h2(x, y, 3) > 0.35) put(img, x, y, zeHair[y < 19 ? 2 : 1]);
  faceSet(img, 'ze', expr, skin, { brow: zeHair[0], browY: 21, noseWide: 1, mouth: { y: 39, lip: LIP_DARK } });
  // thin dark mustache plus cheek stubble — not Carlos's solid grey bar
  const mustache = (x, y) => {
    const dx = Math.abs(x - CX);
    if (y === 36) return dx >= 2 && dx <= 5;
    if (y === 37) return dx >= 1.5 && dx <= 7;
    return false;
  };
  shape(img, mustache, [CX, 37, 8, 1.5], CHICO_HAIR, { outline: false, t: [0.96, 0.15, -0.8] });
  for (const [x, y] of [[22, 33], [23, 35], [24, 37], [21, 36], [41, 33], [40, 35], [39, 37], [42, 36], [26, 40], [37, 40]]) put(img, x, y, CHICO_HAIR[1]);
  const brim = ell(CX, 13.2, 27, 5.2);
  shape(img, brim, [CX, 13, 27, 5.5], PANAMA, { ol: '#6a5e48', t: [0.88, 0.35, -0.12] });
  const crown = or(ell(CX, 8.2, 14.5, 7.2), box(17, 9, 47, 14));
  shape(img, crown, [CX, 8, 14.5, 7], PANAMA, { ol: '#6a5e48', t: [0.85, 0.32, -0.15] });
  fillRect(img, 18, 11, 28, 2, '#2a2a33'); fillRect(img, 18, 11, 28, 1, '#3a3a50');
  for (const [x, y] of [[22, 5], [28, 4], [34, 4], [40, 5], [25, 7], [38, 7]]) put(img, x, y, PANAMA[1]);
};

RENDER.chico = (img, expr) => {
  const skin = CHICO_SKIN, hair = CHICO_HAIR, kp = faceKp({ cheek: 14.8, jaw: 12.5 });
  shape(img, or(ell(CX, 32, 21, 18), box(11, 30, 53, 48)), [CX, 32, 21, 19], hair, { ol: '#0a0808', t: [0.8, 0.3, -0.1], pattern: (x, y, i) => (Math.floor(x * 0.7 + y) % 4 === 0 ? Math.max(0, i - 1) : i) });
  torso(img, CHICO_TEE, { ol: CHICO_TEE[0] });
  flat(img, (x, y) => y >= 58 && torsoPred(x, y), JEANS[2], { ol: JEANS[0] });
  neck(img, skin);
  // a pastel: the dome of a fried half-moon (flat crimped edge on the bottom) over a paper corner. No white apron.
  shape(img, and(ell(50, 56, 10, 8), (x, y) => y <= 56), [50, 52, 10, 6], ramp4('#e8b634', '#6a5010'), { ol: '#6a5010', t: [0.9, 0.4, -0.15] });
  for (let i = 0; i < 9; i++) put(img, 42 + i * 2, 56 + (i % 2), '#a07818');
  fillRect(img, 44, 57, 12, 3, '#f4ede2');
  fillRect(img, 44, 59, 12, 1, '#d8d0c4');
  head(img, skin, kp);
  faceSet(img, 'chico', expr, skin, { brow: hair[0], browY: 21, mouth: { y: 38, lip: '#7a3034' }, blush: 1 });
  const beard = (x, y) => {
    const hw = hwAt(kp, y);
    if (y < 37 || y > 43) return false;
    const dx = Math.abs(x - CX);
    if (y < 40) return dx >= hw - 4.5 && dx <= hw + 0.5 && dx > 3;
    return dx >= 4 && dx <= 11.5;
  };
  shape(img, beard, [CX, 40, 12, 4], hair, { ol: '#0a0808', t: [0.75, 0.28, -0.1] });
  shape(img, and(ell(CX, 13.5, 17.5, 12), (x, y) => y < 19), [CX, 12, 17, 12], hair, { ol: '#0a0808', t: [0.78, 0.3, -0.1] });
  const bucketCrown = (x, y) => y >= 4 && y < 14 && Math.abs(x - CX) <= 14.5 - Math.max(0, y - 10) * 0.8;
  shape(img, bucketCrown, [CX, 9, 14, 6], BUCKET, { ol: '#a07818', t: [0.88, 0.38, -0.15] });
  const bucketBrim = (x, y) => y >= 12 && y < 16.5 && Math.abs(x - CX) <= 16 - (y - 12) * 0.5;
  shape(img, bucketBrim, [CX, 14, 16, 3], BUCKET, { ol: '#a07818', t: [0.92, 0.4, -0.2] });
  fillRect(img, 20, 13, 24, 1, BUCKET[0]);
};

RENDER.rosa = (img, expr) => {
  const skin = ROSA_SKIN, hair = ROSA_HAIR, kp = faceKp({ cheek: 13.8, jaw: 11, chin: 47 });
  const wavePat = (x, y, i) => (Math.sin((x + y * 0.4) * 0.55) > 0.2 ? Math.min(3, i + 1) : (Math.sin((x - y * 0.3) * 0.5) < -0.35 ? Math.max(0, i - 1) : i));
  shape(img, profile(CX, [[8, 11], [12, 17], [18, 19.5], [28, 20.5], [40, 20], [48, 18], [54, 14]]), [CX, 33, 22, 22], hair, { ol: '#4a3018', t: [0.78, 0.3, -0.1], pattern: wavePat });
  torso(img, ROSA_BLOUSE, { ol: '#9a5a68' });
  flat(img, (x, y) => y >= 57 && torsoPred(x, y), PLUM_SKIRT[2], { ol: PLUM_SKIRT[0] });
  neck(img, skin);
  // bouquet: three blooms, a few leaves, a short paper wrap. The crown and the hoops are already on the head.
  shape(img, ell(46, 50, 4.2, 3.4), [46, 50, 4, 3.2], ramp4('#e63f38'), { ol: '#7a1c20' });
  shape(img, ell(55, 49, 4.2, 3.4), [55, 49, 4, 3.2], ramp4('#f2c230', '#8a6a10'), { ol: '#6a5010' });
  shape(img, ell(50, 46, 3.6, 3.2), [50, 46, 3.4, 3], ramp4('#e07a5f', '#8a4030'), { ol: '#7a3030' });
  put(img, 46, 50, '#f8d239'); put(img, 55, 49, '#fff59a'); put(img, 50, 46, '#f8d239');
  for (const [x, y] of [[44, 53], [48, 52], [52, 53], [56, 52], [50, 54]]) put(img, x, y, '#3d8a4e');
  shape(img, box(45, 55, 57, 63), [51, 59, 6, 4], ramp4('#f4ede2', '#7a7570'), { ol: '#7a7570' });
  head(img, skin, kp);
  faceSet(img, 'rosa', expr, skin, { brow: hair[0], browY: 21, lash: true, mouth: { y: 38, lip: '#b95d72' }, blush: 1 });
  shape(img, and(ell(CX, 14.5, 18.5, 13), (x, y) => y < 20 + Math.sin(x * 0.45) * 1.2), [CX, 13, 18, 13], hair, { ol: '#4a3018', t: [0.76, 0.28, -0.1], pattern: wavePat });
  for (const s of [-1, 1]) for (let y = 20; y < 38; y++) { const x0 = Math.round(CX + s * (hwAt(kp, y) - 1.8)); put(img, x0, y, hair[1 + (y % 3 === 0 ? 1 : 0)]); }
  for (const s of [-1, 1]) hoop(img, CX + s * 17.4, 36.2, 2.8);
  const bloom = (cx, cy, petal, center) => {
    for (let a = 0; a < 6; a++) shape(img, ell(cx + Math.cos(a * 1.05) * 2.2, cy + Math.sin(a * 1.05) * 2, 2.1, 1.6), [cx, cy, 2.5, 2], petal, { outline: false });
    shape(img, ell(cx, cy, 1.4, 1.4), [cx, cy, 1.5, 1.5], center, { outline: false });
  };
  for (const [x, y, c] of [[20, 10, '#e63f38'], [28, 7, '#f8d239'], [36, 7, '#ff8575'], [44, 10, '#e63f38'], [24, 12, '#9bc246'], [40, 12, '#9bc246']]) {
    bloom(x, y, ramp4(c === '#9bc246' ? '#7aaa38' : c, '#3a1818'), ramp4('#f8d239'));
  }
  for (const [x, y] of [[22, 9], [30, 8], [38, 8], [42, 11]]) put(img, x, y, '#5a8a32');
};

export function renderPortrait(npc, expr, bgFn) {
  const img = blank(64, 64);
  const fg = blank(64, 64);
  RENDER[npc](fg, expr);
  const b = BG[npc];
  backdrop(img, b);
  over(img, fg);
  frame(img, FRAME);
  return img;
}

const FRAME = { hi: '#daa463', mid: '#c78c59', lo: '#8a5a38' };
const BG = {
  carlos: { base: '#e9c9a0', hi: '#f2dcb8', lo: '#d3ae86' },
  nanda: { base: '#b5d0d9', hi: '#cfe2ea', lo: '#96b4c3' },
  julia: { base: '#b9d3a0', hi: '#d0e2b8', lo: '#9ab887' },
  graca: { base: '#7c78a8', hi: '#948fbc', lo: '#635f8c' },
  tia_lu: { base: '#f0c0a4', hi: '#f8d6bf', lo: '#dea488' },
  prof: { base: '#8ea6d6', hi: '#a9bde6', lo: '#6f88bd' },
  ze: { base: '#b8c878', hi: '#d0dea0', lo: '#9aab62' },
  chico: { base: '#f0d890', hi: '#f8e8b0', lo: '#d8c070' },
  rosa: { base: '#e8b8c8', hi: '#f5d0dc', lo: '#d098a8' },
};

export async function portraitParts() {
  const parts = [];
  for (const npc of NPCS) for (const expr of EXPRESSIONS) if (RENDER[npc]) parts.push({ key: `portraits/${npc}_${expr}`, img: renderPortrait(npc, expr) });
  return parts;
}

/** scratch preview hook for scripts/_prev.mjs: preview('carlos') -> 4 expressions */
export async function preview(...npcs) {
  const out = [];
  for (const n of npcs.length ? npcs : NPCS) for (const e of EXPRESSIONS) if (RENDER[n]) out.push(renderPortrait(n, e));
  return out;
}
