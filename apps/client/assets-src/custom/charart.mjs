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
    S: P(10, [T(3, 'p...........p'.slice(0, 1) + '.'.repeat(8) + 'p'), T(2, 'p.p......p.p'), T(4, 'p......p')]),
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
// waving hand: an outlined 2x2 hand beside the cheek on the right, forearm below; frame B is 1 px higher with the fingers spread
const wave = (b) => ({
  S: P(b ? -16 : -15, [
    T(13, b ? 'o.o' : 'ooo'),
    T(12, 'orso'),
    T(12, 'orro'),
    T(13, 'ooo'),
    T(14, 'or'), T(14, 'or'), T(14, 'or'), T(14, 'or'),
  ]),
});
// thumbs-up: an outlined fist with the thumb straight up, at cheek height
const thumb = {
  S: P(-13, [T(14, 'o'), T(13, 'oro'), T(13, 'oro'), T(12, 'orro'), T(12, 'orro'), T(12, 'orso'), T(13, 'ooo')]),
};
// dancing: both hands up beside the head (2 wide, outlined on top), 1 px arms down to the sleeves
const handsUp = (len, side = 'LR') => {
  const L = side.includes('L');
  const R = side.includes('R');
  const row = (l, r) => (L ? l : '..') + DOTS(12) + (R ? r : '..');
  const arm = (ch) => (L ? ch : '.') + DOTS(14) + (R ? ch : '.');
  return {
    S: P(-18, [
      row('oo', 'oo'), row('rr', 'rr'), row('sr', 'rs'), row('or', 'ro'),
      ...Array.from({ length: len }, () => arm('q')),
    ]),
  };
};
const armsUp = (n) => handsUp(n === 2 ? 3 : 7);
const oneArmUp = (side) => handsUp(6, side === 'L' ? 'L' : 'R');
const laugh = (open) => ({
  S: P(-10, open ? [T(6, 'wwww'), T(6, 'KRRK')] : [T(6, 'K..K'), T(7, 'KK')]),
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
    S: P(-9, [T(14, 'W'), T(13, 'oBo'), T(13, 'owo'), T(13, 'oWo'), T(14, 'o')]),
    E: P(-9, [T(12, 'W'), T(11, 'oBo'), T(11, 'owo'), T(11, 'oWo'), T(12, 'o')]),
    N: NONE.S,
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
