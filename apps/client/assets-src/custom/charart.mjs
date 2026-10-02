// Authored character pieces (Phase 3): face variants, extras, hair add-ons, emote gestures, idle-pose props, NPC pieces.
// Patterns use the shared legend of charedit.mjs and are stamped per frame onto the body / head anchors, so they follow the walk bob,
// the sit poses and the bow. Coordinates are frame pixels of the reference frame (16 wide, feet at row 31, head top at row 10).
import { R, T } from './hats.mjs';

const P = (y0, rows, x0 = 0) => ({ y0, rows, x0 });

// ---- face styles: brows / lines / blush over the pack's 1 px eyes (eyes are at y 20-21; x 5 and 10 seen from the front)
export const FACE_ART = {
  suave: null,
  // strong, angled brows
  marcante: {
    S: P(8, [T(4, 'hh....hh'), T(6, 'h..h')]),
    E: P(8, [T(10, 'hhh'), T(12, 'h')]),
  },
  // sweet: short raised brows and blush
  doce: {
    S: P(8, [T(5, 'j....j'), '.'.repeat(16), '.'.repeat(16), '.'.repeat(16), T(3, 'PP......PP'), T(3, 'PP......PP')]),
    E: P(8, [T(11, 'j'), '.'.repeat(16), '.'.repeat(16), '.'.repeat(16), T(9, 'PP'), T(9, 'PP')]),
  },
  // mature: thin brows and smile lines
  maduro: {
    S: P(8, [T(4, 'iii..iii'), '.'.repeat(16), '.'.repeat(16), '.'.repeat(16), T(3, 'p......p'.slice(0, 1) + '.'.repeat(8) + 'p')]),
    E: P(8, [T(10, 'iii'), '.'.repeat(16), '.'.repeat(16), '.'.repeat(16), T(12, 'p')]),
  },
};
export const FACE_ALPHA = { P: 150 };

// ---- extras (head anchored)
export const EXTRA_ART = {
  brincos: {
    S: P(9, [T(0, 'Y' + '.'.repeat(14) + 'Y'), T(0, 'y' + '.'.repeat(14) + 'y')]),
    E: P(9, [T(5, 'Y'), T(5, 'y')]),
  },
  sardas: {
    S: P(10, [T(3, 'q' + '.'.repeat(8) + 'q'), T(2, 'q.q......q.q'), T(4, 'q......q')]),
    E: P(10, [T(9, 'p'), T(10, 'p.p'), T(11, 'p')]),
  },
};

// ---- hair add-ons over the short bob (hair ramp letters h i j k)
export const HAIR_ADDON = {
  coque: {
    S: P(-5, [T(5, 'oooooo'), T(4, 'ojjkkjo'), T(4, 'ojkkjjo'), T(4, 'oijjiio'), T(5, 'oiiiio')]),
    E: P(-5, [T(3, 'oooooo'), T(2, 'ojjkkjo'), T(2, 'ojkkjjo'), T(2, 'oijjiio'), T(3, 'oiiiio')]),
  },
  trancas: {
    // two braids hanging beside the face (front), one long braid down the back (N), one at the back of the head (E/W)
    S: P(12, [
      T(0, 'oio' + '.'.repeat(10) + 'oio'),
      T(0, 'oio' + '.'.repeat(10) + 'oio'),
      T(0, 'ojo' + '.'.repeat(10) + 'ojo'),
      T(0, 'oko' + '.'.repeat(10) + 'oko'),
      T(0, 'ojo' + '.'.repeat(10) + 'ojo'),
      T(0, 'oko' + '.'.repeat(10) + 'oko'),
      T(0, 'ojo' + '.'.repeat(10) + 'ojo'),
      T(0, 'oio' + '.'.repeat(10) + 'oio'),
      T(0, 'ohO' + '.'.repeat(10) + 'Oho'),
    ].map((r) => r)),
    N: P(12, [
      T(6, 'oiio'), T(6, 'ojko'), T(6, 'okjo'), T(6, 'ojko'), T(6, 'okjo'), T(6, 'ojko'), T(6, 'okjo'), T(6, 'oiio'), T(7, 'oo'),
    ]),
    E: P(12, [
      T(1, 'oio'), T(1, 'ojo'), T(1, 'oko'), T(1, 'ojo'), T(1, 'oko'), T(1, 'ojo'), T(1, 'oio'), T(1, 'ohO'),
    ]),
  },
};

// ---- emote gestures (body anchored, canonical rows 12-16; frames are the emote's frames)
const NONE = { S: P(0, []) };
const DOTS = (n) => '.'.repeat(n);
// Wave 2: the gestures are big enough to read at 1x: a hand of 5-6 px with a navy outline, an outlined forearm, drawn over the head's side (the
// face stays clear: the hand sits above the eye row). The pop-up icons (fx/emote_*) say the same thing in a bubble above the head.
/** body-anchored pattern from absolute frame rows (the reference frame has its feet on row 31): { 12: [x, 'chars'], ... } */
const PA = (spec) => {
  const ys = Object.keys(spec).map(Number);
  const y0 = Math.min(...ys);
  const rows = [];
  for (let y = y0; y <= Math.max(...ys); y++) rows.push(spec[y] ? T(spec[y][0], spec[y][1]) : '.'.repeat(16));
  return P(y0 - 31, rows);
};
const arm = (from, to, x = 13) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, [x, 'oso']]));
// waving hand: a flat open hand with a shaded palm and four fingers; frame B is 1 px higher with the fingers spread
const wave = (b) => ({
  S: PA(
    b
      ? { 10: [11, 'o.o.o'], 11: [10, 'osssso'], 12: [10, 'osssro'], 13: [10, 'orrrro'], 14: [11, 'orrro'], 15: [12, 'orro'], ...arm(16, 23) }
      : { 11: [11, 'oooo'], 12: [10, 'osssso'], 13: [10, 'osssro'], 14: [10, 'orrrro'], 15: [11, 'orrro'], 16: [12, 'orro'], ...arm(17, 23) },
  ),
});
// thumbs-up: a fist (4 rows, shaded) with the thumb pointing straight up, forearm below
const thumb = {
  S: PA({ 9: [12, 'oo'], 10: [11, 'osso'], 11: [11, 'osro'], 12: [10, 'oossso'], 13: [10, 'osssro'], 14: [10, 'osrrro'], 15: [10, 'orrrro'], 16: [11, 'oooo'], ...arm(17, 23) }),
};
// dancing: both hands up beside the head (4 wide, outlined), arms down to the sleeves
const handsUp = (len, side = 'LR') => {
  const L = side.includes('L');
  const R = side.includes('R');
  const row = (l, r) => (L ? l : '....') + DOTS(8) + (R ? r : '....');
  const armRow = () => (L ? '.rr.' : '....') + DOTS(8) + (R ? '.rr.' : '....');
  return {
    S: P(-18, [
      row('oooo', 'oooo'), row('orro', 'orro'), row('orso', 'osro'), row('oooo', 'oooo'),
      ...Array.from({ length: len }, () => armRow()),
    ]),
  };
};
const armsUp = (n) => handsUp(n === 2 ? 3 : 7);
const oneArmUp = (side) => handsUp(6, side === 'L' ? 'L' : 'R');
// laugh: eyes squeezed shut (a dash instead of the dot), mouth wide open / a broad smile; skin is painted over the eye whites
const laugh = (open) => ({
  S: PA(
    open
      ? { 20: [5, 'KK..KK'], 21: [5, 'rK..Kr'], 22: [5, 'KRRRRK'] }
      : { 20: [5, 'KK..KK'], 21: [5, 'rr..rr'], 22: [6, 'KKKK'] },
  ),
});

/** rows of the emote layer: row 12 oi (6 frames), 13 dancar (6), 14 rir (4), 15 valeu (4), 16 desculpa (none) */
export const GESTURE_FRAMES = {
  12: [wave(false), wave(true), wave(false), wave(true), wave(false), wave(true)],
  13: [armsUp(7), armsUp(2), oneArmUp('R'), armsUp(7), armsUp(2), oneArmUp('L')],
  14: [laugh(true), laugh(false), laugh(true), laugh(false)],
  15: [thumb, thumb, thumb, thumb],
};

// ---- idle-pose props (body anchored, idle rows 0-3)
export const POSE_ART = {
  cafe: {
    S: P(-9, [T(13, 'W'), T(12, 'oBBo'), T(12, 'owwo'), T(12, 'oWWo'), T(13, 'oo')]),
    E: P(-9, [T(11, 'W'), T(10, 'oBBo'), T(10, 'owwo'), T(10, 'oWWo'), T(11, 'oo')]),
    N: NONE.S,
  },
  // hands in the pockets: the hands are covered by sleeve-colored cuffs and the pants get pocket slits
  bolsos: {
    S: P(-7, [T(0, 'o' + DOTS(14) + 'o'), T(0, 'u' + DOTS(14) + 'u'), T(0, 'u' + DOTS(14) + 'u'), T(0, DOTS(4) + 'O' + DOTS(6) + 'O'), '.'.repeat(16)].map((r) => r.padEnd(16, '.'))),
    E: P(-6, [T(5, 'u'), T(5, 'u'), T(5, 'O')]),
    N: NONE.S,
  },
  // hands on the hips: fists at the waist, elbows out
  cintura: {
    S: P(-5, [T(2, 'or' + DOTS(8) + 'ro'), T(3, 'r' + DOTS(8) + 'r')]),
    E: P(-5, [T(4, 'or'), T(4, 'r')]),
    N: P(-5, [T(2, 'or' + DOTS(8) + 'ro'), T(3, 'r' + DOTS(8) + 'r')]),
  },
  bolsa: {
    S: P(-6, [T(0, '.oo.'), T(0, 'oBBo'), T(0, 'oyBo'), T(0, 'oyyo'), T(0, '.oo.')]),
    E: P(-6, [T(3, '.oo.'), T(3, 'oBBo'), T(3, 'oyBo'), T(3, 'oyyo'), T(3, '.oo.')]),
    N: P(-6, [T(12, '.oo.'), T(12, 'oBBo'), T(12, 'oyBo'), T(12, 'oyyo'), T(12, '.oo.')]),
  },
  bracos: {
    S: P(-7, [T(2, 'ouuuuuuuuuuo'), T(2, 'ouvvvvvvvvuo'), T(3, 'orruuuurro'.slice(0, 10)), ]),
    E: P(-7, [T(4, 'ouuuuuuo'), T(4, 'ouvvvvuo'), T(5, 'orrrro')]),
  },
};

// ---- NPC pieces
export const APRON_ART = {
  S: P(-7, [T(5, 'b....b'), T(5, 'bccccb'), T(5, 'cccccc'), T(5, 'cccccc'), T(5, 'cccccc'), T(5, 'bbbbbb')]),
  E: P(-7, [T(6, 'bbbb'), T(9, 'ccb'), T(9, 'ccb'), T(9, 'ccb'), T(9, 'ccb'), T(9, 'bbb')]),
  N: P(-7, [T(5, 'b....b'), '.'.repeat(16), T(6, 'bbbb'), T(5, 'bcbbcb'), T(6, 'b..b'), '.'.repeat(16)]),
};
