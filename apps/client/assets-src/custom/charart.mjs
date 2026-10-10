// Authored character pieces (Phase 3): eyes and face variants, extras, hair add-ons, emote gestures, idle-pose props, NPC pieces.
// Patterns use the shared legend of charedit.mjs and are stamped per frame onto the body / head anchors, so they follow the walk bob,
// the sit poses and the bow. Coordinates are frame pixels of the reference frame (16 wide, feet at row 31, head top at row 10).
import { R, T } from './hats.mjs';

const P = (y0, rows, x0 = 0) => ({ y0, rows, x0 });

// ---- eyes (wave 3): authored per face style, 2 px wide (the pack's were one lash pixel over one iris pixel), head anchored. Front: the
// left eye is x 5-6, the right 9-10, the iris on the outer side and the white on the inner side (the pack's layout, so the portraits still
// find them). Side: x 10-11, the iris in front. suave: a soft 2x2; doce: a tall 2x3 with lashes flicking outward (the face that reads as
// a girl's); marcante: a long lash flicking outward; maduro: 2x2 with its amber iris. The blink frame closes them to a lid line one row down.
const EYES = (iris, { tall = false, flick = false } = {}) => ({
  S: tall
    ? P(9, [flick ? T(4, 'ooo..ooo') : T(5, 'oo..oo'), T(5, `${iris}N..N${iris}`), T(5, `${iris}N..N${iris}`)])
    : P(10, [flick ? T(4, 'ooo..ooo') : T(5, 'oo..oo'), T(5, `${iris}N..N${iris}`)]),
  E: tall ? P(9, [T(10, flick ? 'ooo' : 'oo'), T(10, `N${iris}`), T(10, `N${iris}`)]) : P(10, [T(10, flick ? 'ooo' : 'oo'), T(10, `N${iris}`)]),
});
export const EYE_ART = {
  suave: EYES('D'),
  marcante: EYES('S', { flick: true }),
  doce: EYES('H', { tall: true, flick: true }),
  maduro: EYES('A'),
};
/** closed eyes, one idle frame in six */
export const BLINK_ART = { S: P(11, [T(5, 'oo..oo')]), E: P(11, [T(10, 'oo')]) };

// ---- face styles: brows, mouth, nose and blush over the eyes (eyes at y 19-21 from the front; the mouth on the jaw row 22)
const E16 = '.'.repeat(16);
export const FACE_ART = {
  // soft: light brows in the hair colour, a small calm mouth
  suave: {
    S: P(8, [T(5, 'jj..jj'), E16, E16, E16, T(7, 'MM')]),
    E: P(8, [T(10, 'jj'), E16, E16, E16, T(11, 'M')]),
  },
  // strong: heavy brows angled by their shade (one row, so the long lashes under them stay their own line), a nose shadow
  marcante: {
    S: P(8, [T(4, 'hhi..ihh'), E16, E16, T(8, 'q'), T(7, 'MM')]),
    E: P(8, [T(10, 'hhi'), E16, E16, T(12, 'q'), T(11, 'M')]),
  },
  // sweet: short raised brows, a soft blush on the cheeks beside the eyes (not on the jaw, where it read as stubble), a small rosy mouth
  doce: {
    S: P(8, [T(5, 'j....j'), E16, E16, T(3, 'P........P'), T(7, 'MM')]),
    E: P(8, [T(11, 'j'), E16, E16, T(9, 'P'), T(11, 'M')]),
  },
  // mature: thin brows, a nose shadow, smile lines beside the mouth
  maduro: {
    S: P(8, [T(4, 'iii..iii'), E16, E16, T(8, 'q'), T(3, 'p...MM...p')]),
    E: P(8, [T(10, 'iii'), E16, E16, T(12, 'q'), T(11, 'Mp')]),
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
  // long hair: from the jaw it falls over both shoulders to the chest (front), in one sheet down the back (N), and down behind the neck
  // (sides). Without it the pack's long style stops at the chin and reads as short hair from the front.
  longo: {
    S: P(10, [
      T(1, 'oio' + '.'.repeat(6) + 'oio'),
      T(0, 'oiio' + '.'.repeat(8) + 'oiio'),
      T(0, 'oijo' + '.'.repeat(8) + 'ojio'),
      T(0, 'ojjo' + '.'.repeat(8) + 'ojjo'),
      T(0, 'ojko' + '.'.repeat(8) + 'okjo'),
      T(0, 'ojko' + '.'.repeat(8) + 'okjo'),
      T(0, 'okko' + '.'.repeat(8) + 'okko'),
      T(1, 'oo' + '.'.repeat(10) + 'oo'),
    ].map((r) => r.slice(0, 16))),
    N: P(10, [
      T(1, 'oiiiiiiiiiiiio'),
      T(1, 'oijjiiiiiijjio'),
      T(1, 'oijjjiiiijjjio'),
      T(1, 'ojjjjjjjjjjjjo'),
      T(1, 'ojkjjjjjjjjkjo'),
      T(2, 'ojkjjjjjjjkjo'),
      T(2, 'okkkjjjjjkkko'),
      T(3, 'ooooooooooo'),
    ]),
    E: P(10, [T(2, 'oiio'), T(2, 'oiio'), T(2, 'ojjo'), T(2, 'ojko'), T(2, 'ojko'), T(2, 'okko'), T(2, 'okko'), T(3, 'oo')]),
  },
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
const armL = (from, to, x = 4) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, [x, 'oso']]));
// oi: friendly wave on the character's right (viewer's left), open palm + forearm tied to the shoulder line
const wave = (raised) => ({
  S: PA(
    raised
      ? { 9: [2, 'o.o.o'], 10: [1, 'ossso'], 11: [1, 'orsso'], 12: [2, 'osso'], 13: [3, 'osso'], ...armL(14, 22, 4) }
      : { 10: [2, 'oooo'], 11: [1, 'ossso'], 12: [1, 'orsso'], 13: [2, 'osso'], 14: [3, 'osso'], ...armL(15, 22, 4) },
  ),
});
// valeu: fist at chest with thumb bent up-left (reads as thumbs-up, not a middle finger)
const thumb = {
  S: PA({
    10: [2, '.o.'],
    11: [1, '.so'],
    12: [2, 'osso'],
    13: [2, 'osso'],
    14: [3, 'osso'],
    15: [3, 'osro'],
    16: [4, '.oso'],
    17: [4, '.oso'],
    18: [5, '.oso'],
    19: [6, '.oso'],
  }),
};
// dancar: hands beside the head; forearms connect at the shoulder line (rows 17–21)
const dance = (lUp, rUp) => {
  const side = (x, up) => {
    const hi = { [10]: [x, 'orro'], [11]: [x, 'orso'], [12]: [x, 'oooo'] };
    const lo = { [15]: [x, 'orro'], [16]: [x, 'osro'] };
    const arm = { [13]: [x + 1, '.o.'], [14]: [x + 1, '.o.'], [17]: [x, '.o.'], [18]: [x, '.o.'], [19]: [x + 1, '.o.'], [20]: [x + 1, '.o.'] };
    return up ? { ...hi, ...arm } : { ...lo, ...arm };
  };
  return { S: PA({ ...side(1, lUp), ...side(10, rUp), 21: [5, '.o.o'], 22: [6, '.oso'] }) };
};
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
  13: [dance(true, true), dance(false, true), dance(true, false), dance(false, false), dance(true, true), dance(false, true)],
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
