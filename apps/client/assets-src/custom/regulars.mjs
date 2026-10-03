// The five praça regulars (Carlos, Júlia, Zé, Chico, Rosa).
//
// LimeZu supplies the walking body. These sheets are only the face, the hat (or Júlia's high ponytail) and the one prop
// a stranger would name them by. Shapes are solid bands with a navy edge — no 1 px dither — so the same outfit still
// reads if a later pass draws the sprite larger (nearest-neighbour). Light falls from the upper left.
//
// Head patterns are authored on the reference frame (head top at row 10). Body patterns use the feet row (31).
// S is the front, E the side facing screen-right, N the back. W is E mirrored by stampSet.
import { T } from './hats.mjs';
import { emptySheet, stampSet } from '../../../../scripts/lib/pixel/charedit.mjs';

const P = (y0, rows) => ({ y0, rows, x0: 0 });
const HEAD = 10;
const FEET = 31;

/** { absoluteRow: [x, chars] } → a head-anchored pattern. */
function head(spec) {
  const ys = Object.keys(spec).map(Number);
  if (!ys.length) return P(0, []);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(spec[y] ? T(spec[y][0], spec[y][1]) : '.'.repeat(16));
  return P(y0 - HEAD, rows);
}
/** Same, anchored to the feet. */
function body(spec) {
  const ys = Object.keys(spec).map(Number);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(spec[y] ? T(spec[y][0], spec[y][1]) : '.'.repeat(16));
  return P(y0 - FEET, rows);
}

const stampHead = (an, set) => stampSet(emptySheet(), set, an, 'head');
const stampBody = (an, set) => stampSet(emptySheet(), set, an, 'body');

// ---------------------------------------------------------------- faces (skin ramp + hair ramp + fixed whites / gold)
// Eyes are two pixels so they stay eyes when the sprite is enlarged. Brows, mouth and facial hair are the person.

const FACE = {
  // Seu Carlos: kind narrow eyes, a thick salt-and-pepper mustache (hair ramp). No cheek stubble.
  carlos: {
    S: head({
      18: [4, 'ii....ii'],
      20: [4, 'wK....Kw'],
      21: [5, 'q.sp.q'],
      22: [3, 'hhhhhhhhhh'],
      23: [3, 'h........h'],
    }),
    E: head({
      18: [9, 'iii'],
      20: [10, 'wK'],
      21: [10, 'sp'],
      22: [8, 'hhhhh'],
      23: [9, 'hh'],
    }),
    N: head({ 22: [4, 'hh......hh'] }),
  },
  // Júlia: rounder eyes, a short smile, two freckles. The ponytail is the hair sheet.
  julia: {
    S: head({
      18: [3, 'jj......jj'],
      20: [3, 'wKK....KKw'],
      21: [5, 'q..ss..q'],
      22: [5, 'oooo'],
    }),
    E: head({
      18: [9, 'jj'],
      20: [10, 'wKK'],
      21: [10, 'rs'],
      22: [10, 'oo'],
    }),
    N: head({}),
  },
  // Seu Zé: heavy brow, cheek stubble, a thin dark mustache. Not Carlos's solid grey bar.
  ze: {
    S: head({
      18: [3, 'hhh....hhh'],
      19: [3, 'h........h'],
      20: [4, 'wK....Kw'],
      21: [3, 'h..sp..h'],
      22: [4, 'h.iiii.h'],
      23: [4, 'h......h'],
    }),
    E: head({
      18: [8, 'hhh'],
      19: [7, 'h'],
      20: [10, 'wK'],
      21: [8, 'h.sp'],
      22: [8, 'hiii'],
      23: [8, 'h'],
    }),
    N: head({ 20: [3, 'h........h'] }),
  },
  // Seu Chico: eyes over a full beard that owns the jaw. Not a mustache, not stubble.
  chico: {
    S: head({
      18: [4, 'hh....hh'],
      20: [4, 'wK....Kw'],
      21: [2, 'hh......hh'],
      22: [3, 'hhhh..hhhh'],
      23: [3, 'hhhhhhhhhh'],
      24: [4, 'hhhhhhhh'],
      25: [5, 'hhhhhh'],
    }),
    E: head({
      18: [9, 'hh'],
      20: [10, 'wK'],
      21: [8, 'hhh'],
      22: [7, 'hhhhh'],
      23: [7, 'hhhh'],
      24: [8, 'hhh'],
    }),
    N: head({
      21: [2, 'hh........hh'],
      22: [2, 'hh........hh'],
      23: [3, 'hhh......hhh'],
      24: [5, 'hhhhhh'],
    }),
  },
  // Dona Rosa: round eyes, a soft smile, gold hoops at the ears. No glasses, no grey bun.
  rosa: {
    S: head({
      17: [0, 'Y..............Y'],
      18: [0, 'yY..jj....jj..Yy'],
      19: [0, 'yY............Yy'],
      20: [0, '.ywKK......KKwy.'],
      21: [4, 'q..ss..q'],
      22: [5, 'oooo'],
    }),
    E: head({
      17: [13, 'Y'],
      18: [12, 'yYjj'],
      19: [13, 'y'],
      20: [10, 'wKK'],
      21: [11, 's'],
      22: [10, 'oo'],
    }),
    N: head({
      18: [0, 'Y..............Y'],
      19: [0, 'y..............y'],
    }),
  },
};

// ---------------------------------------------------------------- hats
// Toque: tall white puff and a band, no brim, so it cannot be the panama or the bucket.
const TOQUE = {
  S: head({
    2: [4, 'oooooooo'],
    3: [3, 'o3333321o'],
    4: [2, 'o333222221o'],
    5: [2, 'o332222221o'],
    6: [2, 'o322222221o'],
    7: [3, 'o22222221o'],
    8: [3, 'oaaaaaaaaao'],
    9: [3, 'o22222221o'],
    10: [4, 'oooooooo'],
  }),
  E: head({
    2: [3, 'oooooooo'],
    3: [2, 'o3333321o'],
    4: [1, 'o333222221o'],
    5: [1, 'o332222221o'],
    6: [1, 'o322222221o'],
    7: [2, 'o22222221o'],
    8: [2, 'oaaaaaaaaao'],
    9: [2, 'o22222221o'],
    10: [3, 'oooooooo'],
  }),
  N: head({
    2: [4, 'oooooooo'],
    3: [3, 'o3333321o'],
    4: [2, 'o332222221o'],
    5: [2, 'o322222221o'],
    6: [2, 'o222222221o'],
    7: [3, 'o22222221o'],
    8: [3, 'o22222221o'],
    9: [3, 'o11111111o'],
    10: [4, 'oooooooo'],
  }),
};

// Panama: pinched crown, black band, a brim wider than the head. The brim stops above the eyes.
const PANAMA = {
  S: head({
    5: [5, 'oooooo'],
    6: [4, 'o333221o'],
    7: [4, 'o322221o'],
    8: [4, 'oaaaaaao'],
    9: [1, 'o332222222221o'],
    10: [0, 'o3322222222221o'],
    11: [0, 'o1111111111111o'],
    12: [1, 'oooooooooooooo'],
  }),
  E: head({
    5: [4, 'oooooo'],
    6: [3, 'o33221o'],
    7: [3, 'o22221o'],
    8: [3, 'oaaaaao'],
    9: [1, 'o332222222221o'],
    10: [1, 'o111222222111o'],
    11: [2, 'oooooooooooo'],
  }),
  N: head({
    5: [5, 'oooooo'],
    6: [4, 'o333221o'],
    7: [4, 'o222221o'],
    8: [4, 'oaaaaaao'],
    9: [1, 'o222222222222o'],
    10: [0, 'o11111111111111o'],
    11: [1, 'oooooooooooooo'],
  }),
};

// Bucket: flat crown, short brim all the way around, no band. Yellow comes from the hat ramp.
const BUCKET = {
  S: head({
    6: [3, 'oooooooooo'],
    7: [3, 'o333222221o'],
    8: [3, 'o332222221o'],
    9: [3, 'o222222221o'],
    10: [1, 'o3322222222221o'],
    11: [1, 'o1112222222111o'],
    12: [2, 'oooooooooooo'],
  }),
  E: head({
    6: [2, 'oooooooooo'],
    7: [2, 'o33322221o'],
    8: [2, 'o32222221o'],
    9: [2, 'o22222221o'],
    10: [1, 'o33222222221o'],
    11: [2, 'o111111111o'],
    12: [3, 'oooooooooo'],
  }),
  N: head({
    6: [3, 'oooooooooo'],
    7: [3, 'o333222221o'],
    8: [3, 'o222222221o'],
    9: [3, 'o222222221o'],
    10: [1, 'o2222222222221o'],
    11: [1, 'o1111111111111o'],
    12: [2, 'oooooooooooo'],
  }),
};

// Flower crown: four 2 px blooms (red, yellow, coral, red) on leaves. Fixed hues, so it stays flowers.
const CROWN = {
  S: head({
    7: [1, '.RR..YY..CC..R'],
    8: [1, 'gRRgYYggCCggRg'],
    9: [2, 'gg..gg..gg..g'],
    10: [3, 'G...G...G..'],
  }),
  E: head({
    7: [2, 'RR.YY.CC'],
    8: [2, 'RRgYYgCC'],
    9: [3, 'gg.gg.g'],
  }),
  N: head({
    7: [2, 'RR.YY.CC.RR'],
    8: [2, 'RRgYYgCCgRR'],
    9: [3, 'gg..gg..gg'],
  }),
};

// Júlia: hair pulled up into a high ponytail with a coral tie. The face stays clear (no shoulder hair).
const PONYTAIL = {
  S: head({
    2: [6, 'ojjo'],
    3: [5, 'ojjkko'],
    4: [5, 'okkkkko'],
    5: [4, 'ojjkkjjo'],
    6: [5, 'oCCCo'],
    7: [6, 'jj'],
    8: [6, 'kk'],
    9: [6, 'ii'],
    10: [4, 'oooooooo'],
    11: [3, 'ojjkkjjjo'],
    12: [2, 'ojkkkkkkjjo'],
    13: [2, 'oiiiiiiiiio'],
    14: [1, 'oiiiiiiiiiiiio'],
    15: [1, 'oiiiiiiiiiiiio'],
    16: [1, 'ohiiiiiiiiiho'],
    17: [2, 'h..........h'],
  }),
  E: head({
    2: [1, 'ojjo'],
    3: [0, 'ojjkko'],
    4: [0, 'okkkkko'],
    5: [1, 'oCCCo'],
    6: [0, 'ojjo'],
    7: [0, 'okko'],
    8: [0, 'ojjo'],
    9: [0, 'okko'],
    10: [0, 'ojjo'],
    11: [0, 'okko'],
    12: [0, 'ojjo'],
    13: [0, 'okkkoiiiiio'],
    14: [0, 'ojjjoiiiiiio'],
    15: [1, 'ooohiiiiiii'],
    16: [1, 'ooo'],
    17: [1, 'oo'],
    18: [2, 'oo'],
    19: [2, 'o'],
  }),
  N: head({
    4: [6, 'oooo'],
    5: [5, 'ojjkko'],
    6: [5, 'okkkjo'],
    7: [5, 'oCCCo'],
    8: [6, 'jj'],
    9: [6, 'ii'],
    10: [6, 'jj'],
    11: [6, 'kk'],
    12: [6, 'jj'],
    13: [6, 'ii'],
    14: [6, 'jj'],
    15: [6, 'kk'],
    16: [6, 'jj'],
    17: [6, 'ii'],
    18: [6, 'jj'],
    19: [6, 'ii'],
    20: [6, 'jj'],
    21: [6, 'oo'],
  }),
};

// ---------------------------------------------------------------- the one prop
// Apron: bib, shoulder straps, a hem and a flour patch. White comes from the accent ramp.
const APRON = {
  S: body({
    22: [4, 'b......b'],
    23: [4, 'b......b'],
    24: [3, 'occcccccco'],
    25: [3, 'occcccccco'],
    26: [3, 'occwwcccco'],
    27: [3, 'occcccccco'],
    28: [3, 'oaaaaaaaao'],
    29: [3, 'oooooooooo'],
  }),
  E: body({
    22: [8, 'b'],
    23: [8, 'b'],
    24: [7, 'occcb'],
    25: [7, 'occcb'],
    26: [7, 'owwcb'],
    27: [7, 'occcb'],
    28: [7, 'oaaab'],
    29: [7, 'oooo'],
  }),
  N: body({
    22: [4, 'b......b'],
    23: [5, 'b....b'],
    24: [6, 'b..b'],
    27: [5, 'oooooo'],
    28: [4, 'oaaaaaao'],
    29: [4, 'oooooooo'],
  }),
};

// Market tote: two handles, a cloth bag, a leaf and a terracotta stripe. Not a purse, not an apron.
const TOTE = {
  S: body({
    23: [11, 'b.b'],
    24: [10, 'oooooo'],
    25: [10, 'ocggco'],
    26: [10, 'ocbbco'],
    27: [10, 'oRbbRo'],
    28: [10, 'ocbbco'],
    29: [10, 'oaaaao'],
    30: [10, 'oooooo'],
  }),
  E: body({
    23: [11, 'bb'],
    24: [10, 'oooooo'],
    25: [10, 'ocggco'],
    26: [10, 'ocbbco'],
    27: [10, 'oRbbRo'],
    28: [10, 'oaaaao'],
    29: [10, 'oooooo'],
  }),
  N: body({
    23: [3, 'b..b'],
    24: [3, 'oooooo'],
    25: [3, 'obggbo'],
    26: [3, 'obbbbo'],
    27: [3, 'oRbbRo'],
    28: [3, 'obbbbo'],
    29: [3, 'oaaaao'],
    30: [3, 'oooooo'],
  }),
};

// Verduras: a bunch of leaves with one olive in the middle. The olive is the dark oval with a catchlight.
const GREENS = {
  S: body({
    22: [11, '.gG'],
    23: [9, 'gGG.Gg'],
    24: [9, 'gGKGGg'],
    25: [10, 'GKKwK'],
    26: [10, 'GKKKG'],
    27: [11, 'gGGg'],
    28: [12, 'oB'],
    29: [12, 'B'],
  }),
  E: body({
    22: [11, 'gG'],
    23: [10, 'gGGY'],
    24: [10, 'gKKG'],
    25: [11, 'KwK'],
    26: [11, 'KKG'],
    27: [12, 'gG'],
    28: [13, 'B'],
  }),
  N: body({
    23: [11, 'gGG'],
    24: [10, 'gGKg'],
    25: [11, 'KKw'],
    26: [12, 'gg'],
    27: [12, 'B'],
  }),
};

// Pastel: a fried half-moon with a crimped edge and a paper corner. Golden, not an apron.
const PASTEL = {
  S: body({
    24: [11, 'oYYY'],
    25: [10, 'oYyyyY'],
    26: [10, 'oyKyYy'],
    27: [11, 'oyyyY'],
    28: [12, 'oYYY'],
    29: [13, 'oWW'],
  }),
  E: body({
    24: [11, 'oYY'],
    25: [10, 'oYyyyY'],
    26: [10, 'oyKyYy'],
    27: [11, 'oyyyY'],
    28: [12, 'oYY'],
    29: [13, 'WW'],
  }),
  N: body({
    25: [12, 'oYY'],
    26: [12, 'oyy'],
    27: [12, 'oYY'],
    28: [13, 'WW'],
  }),
};

// A wrapped bunch of flowers. The crown is the hat; this is the prop in her hand.
const BOUQUET = {
  S: body({
    22: [9, 'R.YY.C'],
    23: [8, 'RRmYYmCC'],
    24: [8, 'RgRgYgCg'],
    25: [9, 'gggggg'],
    26: [10, 'oWWo'],
    27: [10, 'oWWo'],
    28: [11, 'oo'],
  }),
  E: body({
    22: [10, 'R.Y.C'],
    23: [10, 'RmYmC'],
    24: [11, 'gYg'],
    25: [11, 'gg'],
    26: [11, 'oWWo'],
    27: [12, 'oo'],
  }),
  N: body({
    22: [10, 'RYYC'],
    23: [10, 'RgYg'],
    24: [11, 'ggg'],
    25: [11, 'oWo'],
    26: [12, 'o'],
  }),
};

const setOf = (art) => ({ S: art.S, E: art.E, N: art.N });

/** Adds the regulars' face, hat, hair and prop sheets. Props are body-attached (warped per body type). */
export function buildRegulars({ layers, an, regBody }) {
  layers.face_npc_carlos = stampHead(an, setOf(FACE.carlos));
  layers.face_npc_julia = stampHead(an, setOf(FACE.julia));
  layers.face_npc_ze = stampHead(an, setOf(FACE.ze));
  layers.face_npc_chico = stampHead(an, setOf(FACE.chico));
  layers.face_npc_rosa = stampHead(an, setOf(FACE.rosa));
  layers.hat_npc_toque = stampHead(an, setOf(TOQUE));
  layers.hat_npc_panama = stampHead(an, setOf(PANAMA));
  layers.hat_npc_bucket = stampHead(an, setOf(BUCKET));
  layers.hat_npc_coroa = stampHead(an, setOf(CROWN));
  layers.hair_npc_julia = stampHead(an, setOf(PONYTAIL));
  regBody('prop_npc_avental', stampBody(an, setOf(APRON)));
  regBody('prop_npc_sacola', stampBody(an, setOf(TOTE)));
  regBody('prop_npc_verdura', stampBody(an, setOf(GREENS)));
  regBody('prop_npc_pastel', stampBody(an, setOf(PASTEL)));
  regBody('prop_npc_buque', stampBody(an, setOf(BOUQUET)));
}
