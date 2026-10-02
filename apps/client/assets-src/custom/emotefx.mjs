// Wave 2: the pop-up emote icons (a bubble with a tiny pixel picture, shown ~1 s above the head) and the small parrot companion.
// Both are authored with the LimeZu palette family (navy outline, warm yellows, greens) on the 16 px grid.
import { blank, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { stampGrid } from './kit.mjs';

const PAL = {
  o: '#3a3a50', w: '#fbf7ee', W: '#e6dfd0', y: '#f6c93a', Y: '#fde58a', d: '#c98a1c', K: '#2a2a3a', r: '#d0463a', s: '#f0b48c', S: '#d98f68',
  g: '#5dbb54', G: '#8fdc6b', n: '#3f8f4a', k: '#f2a02b', R: '#d93232', b: '#3f6aa8', B: '#6f9ad8', p: '#a86bd1', P: '#cfa0ec',
};

/** Bubble (12 x 12): rounded paper body, navy outline, little tail down the middle. The picture is stamped at (2, 1). */
const BUBBLE = [
  '..oooooooo..',
  '.owwwwwwwwo.',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  '.owwwwwwwwo.',
  '..oooowwo...',
  '......oo....',
];

// 8 x 8 pictures
const PIC = {
  // waving hand: four fingers up, thumb out, a shaded palm
  oi: [
    '.o.o.o..',
    'oyoyoyo.',
    'oYyyyyoo',
    'oYyyyyyo',
    'oyyyyyyo',
    '.oyyyydo',
    '..oyyydo',
    '...ooooo',
  ],
  // thumbs up: fist with the thumb straight up
  valeu: [
    '...oo...',
    '..oYyo..',
    '..oYyo..',
    '.ooYyyoo',
    'oYYyyyyo',
    'oYyyyyyo',
    'oyyyyydo',
    '.oooooo.',
  ],
  // laughing face: closed happy eyes and an open grin
  rir: [
    '..oooo..',
    '.oYyyyo.',
    'oyKyyKyo',
    'oyyyyyyo',
    'oKKKKKKo',
    'oKwwwwKo',
    '.oKrrKo.',
    '..oooo..',
  ],
  // music note for the dance
  dancar: [
    '...ooooo',
    '...oPPpo',
    '...oppoo',
    '...op.o.',
    '...op...',
    '.oopo...',
    'oPPpo...',
    '.ooo....',
  ],
  // sweat drop for "desculpa"
  desculpa: [
    '...oo...',
    '..oBBo..',
    '..oBbo..',
    '.oBBbbo.',
    '.oBbbbo.',
    '.obbbbo.',
    '..obbo..',
    '...oo...',
  ],
};

function icon(rows) {
  const img = blank(12, 12);
  stampGrid(img, BUBBLE, PAL, 0, 0);
  stampGrid(img, rows, PAL, 2, 1);
  return img;
}

/** One part per emote: `fx/emote_<kind>`, a static 12 x 12 sprite anchored at the bottom of its tail. */
export async function emoteIcons() {
  return Object.entries(PIC).map(([kind, rows], i) => ({ ...(i === 0 ? {} : { key: `fx/emote_${kind}` }), img: icon(rows), anchor: [6, 12] }));
}

// ------------------------------------------------------------------ parrot companion (8 x 10, 4 frames): small enough for the 14 px head scale
const PARROT = [
  '..oooo..',
  '.oGGgno.',
  'okKwGgno',
  'okkGgggo',
  '.ogGggro',
  '.oGgggRo',
  '..ognno.',
  '..okko..',
  '...obbo.',
  '...oBbo.',
];
// frames: wing tucked, wing out (two pixels on the body side), tail swaying one pixel
const swap = (rows, edits) => rows.map((r, y) => (edits[y] ? edits[y] : r));
const PARROT_FRAMES = [
  PARROT,
  swap(PARROT, { 4: '.ogGgnro', 5: '.oGgnnRo' }),
  swap(PARROT, { 8: '..obbo..', 9: '..oBbo..' }),
  swap(PARROT, { 4: '.ogGgnro', 5: '.oGgnnRo', 8: '..obbo..', 9: '..oBbo..' }),
];
const PARROT_W = 8;
const PARROT_H = 10;

const parrotFrames = () =>
  PARROT_FRAMES.map((rows) => {
    const img = blank(PARROT_W, PARROT_H);
    stampGrid(img, rows, PAL, 0, 0);
    return img;
  });

export async function parrotCompanion() {
  return [{ frames: parrotFrames(), fps: 3, anchor: [4, PARROT_H - 1] }];
}

export async function parrotStrip() {
  const frames = parrotFrames();
  const strip = blank(frames.length * PARROT_W, PARROT_H);
  frames.forEach((f, i) => paste(strip, f, i * PARROT_W, 0));
  return [{ key: 'chars/parrot_strip', img: strip, meta: { frames: frames.length, frameW: PARROT_W, fps: 3 } }];
}
