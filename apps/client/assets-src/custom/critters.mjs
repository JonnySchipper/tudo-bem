// Parrot perch (art1) and the vira-lata re-export (art2). Hand-authored with LimeZu palette colors: the pack has no dog and no parrot.
import { blank, paste, setPx, hexPx, C, K, rect, hline, vline, dot, drawShaded, newMask, fillMask, ellipse, union, rectP, stampGrid, outlineAround } from './kit.mjs';
import { flipH, crop } from '../../../../scripts/lib/pixel/img.mjs';

// ------------------------------------------------------------------ parrot on a perch (1x1, 4 idle frames)
const PARROT_PAL = { o: C.navy, y: C.y2, Y: C.y1, w: '#f8f8f8', k: C.navy, b: C.y4, B: K.br2, g: C.g2, G: C.g1, d: C.g3, r: C.r2, R: C.r4, f: C.y4, t: '#2e7177' };

const HEAD = [
  '...oooo...',
  '..oyyYyo..',
  '.oyYYyyyo.',
  '.oyYwkyybo',
  '.oyyyyybbo',
  '.ogyyyyBo.',
];
const BODY = [
  'oggGGggoo.',
  'odgGGGggo.',
  'odgGGGggo.',
  'odgGGGrro.',
  'odggGgrRo.',
  '.odggggdo.',
  '.oddgggdo.',
  '..oddddo..',
  '..offfoo..',
];
const TAIL = [
  '..odtdo...',
  '..odto....',
  '...oto....',
  '...odo....',
  '....oo....',
];

function perch(img) {
  // wooden stand: base plate, pole, T branch and a hanging seed cup
  rect(img, 4, 28, 8, 3, C.w5); hline(img, 4, 28, 8, C.w3); hline(img, 4, 30, 8, K.br4);
  rect(img, 7, 17, 2, 11, C.w3); vline(img, 7, 17, 11, C.w1); vline(img, 8, 17, 11, C.w4);
  rect(img, 1, 15, 14, 2, C.w2); hline(img, 1, 15, 14, C.w0); hline(img, 1, 16, 14, C.w3);
  dot(img, 1, 15, C.w1); dot(img, 14, 16, C.w4);
  // seed cup
  rect(img, 11, 19, 4, 3, C.y3); hline(img, 11, 19, 4, C.y1); hline(img, 11, 21, 4, C.y4);
  vline(img, 12, 17, 2, K.br1);
  outlineAround(img);
}

export async function poleiro() {
  const mk = ({ hx = 0, hy = 0, blink = false, tx = 0 }) => {
    const img = blank(16, 32);
    perch(img);
    const pal = { ...PARROT_PAL };
    stampGrid(img, TAIL, pal, 3 + tx, 15 + 0 + 0);
    stampGrid(img, BODY, pal, 3, 6);
    const head = blink ? HEAD.map((r) => r.replace('w', 'y').replace('k', 'o')) : HEAD;
    stampGrid(img, head, pal, 3 + hx, 0 + hy);
    return img;
  };
  const frames = [mk({}), mk({ hx: 1 }), mk({ blink: true, tx: 1 }), mk({ hy: 1 })];
  return [{ frames, fps: 3, anchor: [8, 30] }];
}

// The vira-lata caramelo lives in dog.mjs (redrawn in art track 2).
export { viraLata } from './dog.mjs';

// ------------------------------------------------------------------ parrot companion (Phase 3): the perch parrot without the perch
/** The poleiro parrot's head and body (4 idle frames) cropped free of the perch, for the shoulder / hovering companion of `profile.parrotEquipped`. */
export async function parrotCompanion() {
  const [{ frames }] = await poleiro();
  const crops = frames.map((f) => crop(f, 3, 0, 10, 15));
  return [{ frames: crops, fps: 3, anchor: [5, 14] }];
}
