// Critters and the parrot perch (art1). Hand-authored with LimeZu palette colors: the pack has no dog and no parrot.
import { blank, paste, setPx, hexPx, C, K, rect, hline, vline, dot, drawShaded, newMask, fillMask, ellipse, union, rectP, stampGrid, outlineAround } from './kit.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';

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

// ------------------------------------------------------------------ vira-lata caramelo
const DOG = ['#a9764f','#c78c59', '#daa463', '#f1ce8e'];
const DOG_FAR = ['#916e41', '#a9764f', '#c78c59', '#daa463'];

function dogBody(img, ox, oy, o = {}) {
  const { headDy = 0, tail = 0, legs = null, dx = 0 } = o;
  // far legs first (darker), then body, head, near legs
  const legRects = (set, ramp) => {
    for (const [lx, ll, lift] of set) {
      const top = 8, len = 4 - lift;
      const m = newMask(2, len); fillMask(m, rectP(0, 0, 2, len));
      drawShaded(img, m, ox + lx, oy + top, ramp, { rimShade: 1, outline: false, hiCorner: false });
      dot(img, ox + lx, oy + top + len - 1, ramp === DOG ? '#f1ce8e' : '#daa463');
      hline(img, ox + lx, oy + top + len, 2, C.navy);
      dot(img, ox + lx + 1, oy + top + len - 1, ramp === DOG ? '#a9764f' : '#916e41');
    }
  };
  const [far, near] = legs ?? [[[6, 0, 0], [11, 0, 0]], [[4, 0, 0], [9, 0, 0]]];
  legRects(far, DOG_FAR);
  const body = newMask(18, 12);
  fillMask(body, union(ellipse(8.5, 6.4, 5.4, 2.9), ellipse(11.5, 6.6, 2.6, 2.7)));
  drawShaded(img, body, ox + 0, oy + 0, DOG, { rimLit: 1, rimShade: 2 });
  legRects(near, DOG);
  // head + snout + ear
  const head = newMask(18, 12);
  fillMask(head, union(ellipse(14 + dx, 4.4 + headDy, 2.6, 2.4), rectP(15.4 + dx, 4.6 + headDy, 17.6 + dx, 6.6 + headDy)));
  drawShaded(img, head, ox, oy, DOG, { rimLit: 1, rimShade: 1 });
  dot(img, ox + 17 + dx, oy + 5 + headDy, C.navy); // nose
  dot(img, ox + 15 + dx, oy + 3 + headDy, C.navy); // eye
  // floppy ear
  rect(img, ox + 12 + dx, oy + 2 + headDy, 2, 3, '#a9764f'); dot(img, ox + 12 + dx, oy + 2 + headDy, '#c78c59');
  vline(img, ox + 11 + dx, oy + 3 + headDy, 2, C.navy);
  // tail
  const tp = [[[3, 5], [2, 4], [2, 3], [1, 2]], [[3, 5], [2, 5], [1, 4], [1, 3]], [[3, 5], [2, 6], [1, 6], [0, 5]]][tail];
  for (const [x, y] of tp) { dot(img, ox + x, oy + y, '#c78c59'); }
  const [lx, ly] = tp[tp.length - 1];
  dot(img, ox + lx, oy + ly, '#f1ce8e');
  for (const [x, y] of tp) for (const [ax, ay] of [[-1, 0], [1, 0], [0, -1]]) if (!tp.some(([tx, ty]) => tx === x + ax && ty === y + ay)) { const p = img.data[((oy + y + ay) * img.w + ox + x + ax) * 4 + 3]; if (!p) dot(img, ox + x + ax, oy + y + ay, C.navy); }
  // cream chest patch
  dot(img, ox + 12, oy + 7, '#f1ce8e'); dot(img, ox + 11, oy + 7, '#e0b870');
}

const SW = 20, SH = 14;

export function dogIdle(frame) {
  const img = blank(SW, SH);
  dogBody(img, 1, 1, { tail: frame % 3 === 2 ? 2 : frame % 2, headDy: frame === 3 ? 0.6 : 0 });
  return img;
}

export function dogWalk(phase) {
  const img = blank(SW, SH);
  const pos = [[0, 0], [1, 0], [2, 1], [1, 0]][phase]; // stride offsets
  const legs = [
    [[6 + [-1, 0, 1, 0][phase], 0, phase === 2 ? 1 : 0], [11 + [1, 0, -1, 0][phase], 0, phase === 0 ? 1 : 0]],
    [[4 + [1, 0, -1, 0][phase], 0, phase === 0 ? 1 : 0], [9 + [-1, 0, 1, 0][phase], 0, phase === 2 ? 1 : 0]],
  ];
  dogBody(img, 1, 1 + (phase % 2), { tail: phase % 3 === 1 ? 1 : 0, legs, headDy: 0 });
  return img;
}

export function dogSleep(frame) {
  const W = 20, H = 12;
  const img = blank(W, H);
  const rise = frame ? 1 : 0;
  const body = newMask(W, H);
  fillMask(body, union(ellipse(9, 7.4 - rise * 0.4, 7, 3.6 + rise * 0.5), ellipse(15.5, 8, 3.4, 2.6)));
  drawShaded(img, body, 0, 0, DOG, { rimLit: 1, rimShade: 2 });
  // head resting on the paws (right), ear, closed eye
  const head = newMask(W, H);
  fillMask(head, union(ellipse(15.5, 7.6, 2.8, 2.2), rectP(16.5, 8, 19, 9.8)));
  drawShaded(img, head, 0, 0, DOG, { rimLit: 1, rimShade: 1 });
  rect(img, 14, 6, 2, 3, '#a9764f'); vline(img, 13, 6, 3, C.navy);
  dot(img, 17, 7, C.navy); dot(img, 18, 7, C.navy2);
  dot(img, 19, 8, C.navy);
  // curled tail around the rump
  for (const [x, y] of [[2, 9], [3, 10], [4, 10], [5, 10]]) dot(img, x, y, '#c78c59');
  dot(img, 2, 9, '#f1ce8e');
  hline(img, 3, 11, 4, C.navy);
  return img;
}

export async function viraLata() {
  const idle = [0, 1, 2, 1].map(dogIdle), walk = [0, 1, 2, 3].map(dogWalk), sleep = [0, 1].map(dogSleep);
  const meta = { footprint: [1, 1], shadow: 'fx/shadow_10' };
  const out = [];
  const add = (name, frames, fps, ax, ay) => {
    out.push({ key: `critters/vira_lata_${name}_e`, frames, fps, anchor: [ax, ay], meta });
    out.push({ key: `critters/vira_lata_${name}_w`, frames: frames.map(flipH), fps, anchor: [frames[0].w - 1 - ax, ay], meta });
  };
  add('idle', idle, 3, 10, 12);
  add('walk', walk, 8, 10, 12);
  add('sleep', sleep, 1.5, 10, 10);
  return out;
}
