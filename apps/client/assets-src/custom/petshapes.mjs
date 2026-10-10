// The Pet Shop breeds (#234, docs/PET-STORE-PLAN.md §3.2): shape × pattern × key colour.
//
// Every breed of packages/shared/src/petBreeds.ts is one body shape (dogs: medio, grande, pequeno, peludo, salsicha; cats: comum, peludo,
// esguio) and one marking pattern (solido, peito, manchado, pintado, tigrado, sela, pontas). Only the combinations the catalog uses are
// baked (`petStripCombos()`), as 20-frame strips in the subscriber pet's frame contract (pets.mjs: 24 x 20, PET_ANIMS, side views face east).
//
// The strips are key-coloured: the client swaps the `coat`, `coat2` and `collar` key ramps (palette.ts PET_KEY_RAMPS) for the ramps of the
// coat's colours at runtime (render/pixel/petLook.ts). Eyes, nose, tongue, the cat's pink inner ears and the navy outline stay fixed.
//
// How a frame is made: the shape generator draws with *label* ramps (one per body part: body, ear, tail, leg, accent = muzzle / chest /
// socks / tail tip, inner ear, collar), then `finish()` maps every labelled pixel to a key colour by the pattern's rules:
//   solido   everything in `coat`                      peito    the accent parts in `coat2` (the caramelo's cream chest)
//   manchado two or three patches in `coat2`           pintado  scattered dots in `coat2`
//   tigrado  diagonal stripes in `coat2`               sela     the saddle (the top rows of the back), the ear tops and the tail in `coat2`
//   pontas   ears, mask, paws and tail in `coat2`
// The pattern keeps the rank (light) of the pixel it repaints, so the markings are lit like the coat.
import { blank, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { put, shape, ell, box, or, NAVY } from './paint.mjs';
import { PET_KEY_RAMPS } from '../../src/render/pixel/palette.ts';
import { petStripCombos } from '../../../../packages/shared/src/petBreeds.ts';

/** Every (species, shape, pattern) the catalog uses: the strips `pnpm pixel` bakes. */
export const PET_STRIPS = petStripCombos();

export const PET_W = 24;
export const PET_H = 20;

// ------------------------------------------------------------------ label ramps
const LABELS = ['body', 'ear', 'tail', 'leg', 'accent', 'earin', 'collar'];
const labelHex = (name, rank) => {
  const i = LABELS.indexOf(name);
  return '#' + [i * 24 + 16, rank * 40 + 20, 7].map((v) => v.toString(16).padStart(2, '0')).join('');
};
/** [dark, shade, base, hi] of a label; `far` is the same part on the far side of the body, one rank darker. */
const R = (name, far = false) => (far ? [0, 0, 1, 2] : [0, 1, 2, 3]).map((r) => labelHex(name, r));
const decode = (r, g, b) => {
  if (b !== 7 || (r - 16) % 24 || (g - 20) % 40) return null;
  const i = (r - 16) / 24, rank = (g - 20) / 40;
  return i >= 0 && i < LABELS.length && rank >= 0 && rank < 4 ? { label: LABELS[i], rank } : null;
};

const NOSE = '#2a2233';
const EYE = '#2a2233';
const EYE_SOFT = '#46465e';
const PINK = '#f4b4c4';
const PINK_DEEP = '#e07070';

const tri = (ax, ay, bx, by, cx, cy) => (x, y) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
/** An ellipse with a tufted edge (the fluffy shapes): the radius wobbles around the outline. */
const fluff = (cx, cy, rx, ry, tufts = 7, depth = 0.16) => (x, y) => {
  const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
  const k = 1 + depth * Math.sin(a * tufts);
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= k * k;
};
const T = [0.86, 0.4, 0];
const paint = (img, pred, b, ramp, t = T) => shape(img, pred, b, ramp, { ol: NAVY, t });
const E = (img, cx, cy, rx, ry, ramp, t = T) => paint(img, ell(cx, cy, rx, ry), [cx, cy, rx, ry], ramp, t);

function leg(img, x, y0, y1, far = false, w = 2) {
  if (y1 - y0 < 1.2) return;
  paint(img, box(x, y0, x + w, y1), [x + w / 2, (y0 + y1) / 2, w / 2 + 0.15, (y1 - y0) / 2], R('leg', far), [0.95, 0.42, -0.05]);
  const px = Math.floor(x), py = Math.floor(y1) - 1;
  put(img, px, py, R('accent', far)[2]);
  if (w > 1) put(img, px + 1, py, R('accent', far)[1]);
}

function eye(img, x, y, blink, cat = false) {
  if (blink) { put(img, x, y, EYE); put(img, x + 1, y, EYE); return; }
  put(img, x, y, EYE);
  if (cat) put(img, x, y - 1, '#ffffff');
  else { put(img, x, y - 1, EYE_SOFT); put(img, x - 1, y - 1, '#ffffff'); }
}

// ------------------------------------------------------------------ dog shapes
/**
 * Dog shape parameters. `leg` lengthens (+) or shortens (-) the legs and lifts the body with them; `ear` is the ear type; `tail` the tail
 * type; `body` the side-view body half-length and depth; `head` scales the head; `fluffy` gives the tufted outline and hides the legs.
 */
export const DOG_SHAPES = {
  medio: { leg: 0, ear: 'pointy', tail: 'curl', body: [7, 3.3], chest: 3.5, head: 1, fluffy: false, long: 0 },
  grande: { leg: 1.2, ear: 'floppy', tail: 'straight', body: [7.4, 3.9], chest: 4.3, head: 1.08, fluffy: false, long: 0 },
  pequeno: { leg: -2, ear: 'bat', tail: 'curl', body: [5.6, 2.9], chest: 3, head: 1.12, fluffy: false, long: -1 },
  peludo: { leg: -1.4, ear: 'floppy', tail: 'plume', body: [6.4, 3.6], chest: 3.6, head: 1.05, fluffy: true, long: 0 },
  salsicha: { leg: -3.2, ear: 'long', tail: 'straight', body: [8.6, 2.7], chest: 2.9, head: 0.9, fluffy: false, long: 1 },
};

/** The tail in the side view (behind the rump at x0, y0). */
function dogTailSide(img, s, x0, y0, phase) {
  const wag = [0, -1, 0, 1][phase] ?? 0;
  if (s.tail === 'curl') {
    const [a0, a1] = [[1.9, 5.6], [1.6, 5.2], [1.9, 5.6], [2.1, 5.9]][phase] ?? [1.9, 5.6];
    const cx = x0, cy = y0;
    const arc = (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      let a = Math.atan2(y - cy, x - cx);
      if (a < 0) a += Math.PI * 2;
      return d >= 1.1 && d <= 3.0 && a >= a0 && a <= a1;
    };
    paint(img, arc, [cx, cy, 3, 3], R('tail'), [0.85, 0.35, 0]);
    const tipA = a1 - 0.5;
    put(img, Math.round(cx + Math.cos(tipA) * 2), Math.round(cy + Math.sin(tipA) * 2), R('accent')[2]);
  } else if (s.tail === 'plume') {
    paint(img, fluff(x0 - 0.4, y0 - 1 + wag * 0.3, 2.6, 3.2, 5, 0.22), [x0, y0 - 1, 2.6, 3.2], R('tail'));
    put(img, Math.round(x0 - 1), Math.round(y0 - 3 + wag * 0.3), R('accent')[3]);
  } else {
    // straight: angled down and back from the rump, the tip lifting on the wag
    const tip = [x0 - 3.2, y0 + 1.8 + wag * 0.8];
    const pred = (x, y) => {
      const ax = x0 + 0.6, ay = y0 - 0.6, bx = tip[0], by = tip[1];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) <= 1.05 - t * 0.35;
    };
    paint(img, pred, [x0 - 1.5, y0 + 0.5, 2.5, 1.5], R('tail'));
    put(img, Math.round(tip[0]), Math.round(tip[1]) - 1, R('accent')[2]);
  }
}

/** Ears in the side view: far ear first (dark), then the skull covers its base; near ear on top. */
function dogEarsSide(img, s, hx, hy, near) {
  const k = s.head;
  if (s.ear === 'pointy' || s.ear === 'bat') {
    const big = s.ear === 'bat' ? 1.35 : 1;
    if (!near) paint(img, tri(hx - 3.9 * k, hy - 2 * k, hx - 2.7 * k, hy - 7 * big * k, hx - 0.1 * k, hy - 2.6 * k), [hx - 2.1, hy - 4.4, 1.8, 2.6], R('ear', true), [0.9, 0.4, 0]);
    else {
      paint(img, tri(hx + 0.1 * k, hy - 3 * k, hx + 2.1 * k, hy - 8 * big * k, hx + 4.1 * k, hy - 2.8 * k), [hx + 2.1, hy - 5.2, 2, 2.8], R('ear'), [0.86, 0.36, 0]);
      put(img, Math.round(hx + 1.7 * k), Math.round(hy - 5.4 * k), R('earin')[1]);
      put(img, Math.round(hx + 1.7 * k), Math.round(hy - 4.4 * k), R('earin')[1]);
    }
  } else if (near) {
    // floppy / long: a hanging flap over the side of the head (long reaches below the jaw)
    const drop = s.ear === 'long' ? 4.6 : 3.2;
    paint(img, ell(hx - 0.9 * k, hy + drop * 0.35, 1.6 * k, drop * 0.7), [hx - 0.9, hy + drop * 0.3, 1.6, drop * 0.7], R('ear'), [0.88, 0.4, 0]);
  }
}

function dogHeadSide(img, s, hx, hy, o = {}) {
  const k = s.head;
  dogEarsSide(img, s, hx, hy, false);
  if (s.fluffy) paint(img, fluff(hx, hy, 4.9 * k, 4.4 * k, 6, 0.12), [hx, hy, 4.9 * k, 4.4 * k], R('body'));
  else E(img, hx, hy, 4.8 * k, 4.2 * k, R('body'), [0.84, 0.4, 0]);
  if (s.fluffy) paint(img, fluff(hx - 0.4, hy - 4.2 * k, 2.4, 1.6, 5, 0.25), [hx, hy - 4, 2.4, 1.6], R('body')); // the top-knot
  dogEarsSide(img, s, hx, hy, true);
  // the muzzle (accent) to the right; the pug / bulldog type keeps it short
  const mx = hx + 3.7 * k - (s.ear === 'bat' ? 0.6 : 0), my = hy + 2 * k;
  E(img, mx, my, 2.6 * k, 2.1 * k, R('accent'), [0.9, 0.4, 0]);
  put(img, Math.round(mx + 1.6 * k), Math.round(my - 1.4 * k), NAVY); put(img, Math.round(mx + 0.6 * k), Math.round(my - 1.4 * k), EYE_SOFT); // nose
  put(img, Math.round(mx - 0.6), Math.round(my + 1.6 * k), R('accent')[0]);
  eye(img, Math.round(hx + 1.7 * k), Math.round(hy - 1.4 * k), o.blink);
  if (o.tongue) { put(img, Math.round(mx), Math.round(my + 1.6 * k), '#d56868'); put(img, Math.round(mx), Math.round(my + 2.6 * k), '#e07070'); }
}

function dogBodySide(img, s, by, o = {}) {
  const [rx, ry] = s.body;
  const x0 = 9.4 - s.long * 0.6, chestX = 14.4 + s.long * 1.6;
  const pred = s.fluffy
    ? or(fluff(x0, by, rx, ry, 9, 0.14), fluff(chestX, by + 0.4, 2.8, s.chest, 5, 0.14), fluff(x0 - 3.8, by - 0.4, 3.2, 3.2, 5, 0.14))
    : or(ell(x0, by, rx, ry), ell(chestX, by + 0.4, 2.7, s.chest), ell(x0 - 3.8, by - 0.4, 3.2, 3.2));
  paint(img, pred, [x0 + 0.2, by, rx + 1, ry + 0.2], R('body'));
  // cream chest (accent): the front of the chest under the neck
  for (const [dx, dy] of [[0.6, 1.4], [0.6, 2.4], [-0.4, 2.4], [-0.4, 3.4], [-1.4, 3.4]]) put(img, Math.round(chestX + dx), Math.round(by + dy), R('accent')[2]);
  put(img, Math.round(chestX + 0.6), Math.round(by + 0.4), R('accent')[3]);
  if (s.fluffy && !o.sit) {
    // the coat hangs down over the legs like a skirt
    paint(img, fluff(x0 + 0.6, by + ry * 0.9, rx * 0.95, 1.8, 11, 0.3), [x0, by + ry, rx, 1.8], R('body'));
  }
}

/** One side frame: walk phases 0..3, or `sit` / `lie`. Feet on row 18, head to the east. */
function dogSide(s, phase, o = {}) {
  const img = blank(PET_W, PET_H);
  const lift = s.leg;
  if (o.lie) {
    const by = 15.6;
    dogTailSide(img, { ...s, tail: s.tail === 'curl' ? 'straight' : s.tail }, 4.8, 15.2, 0);
    const pred = s.fluffy ? fluff(11, by, 6.8 + s.long, 3.1, 9, 0.12) : ell(11.2, by, 6.6 + s.long, 3.0);
    paint(img, pred, [11.2, by, 6.6, 3], R('body'));
    for (const [x, y] of [[14, 16], [15, 16]]) put(img, x, y, R('accent')[2]);
    const hx = 18 + s.long * 0.4, hy = 13.4;
    dogHeadSide(img, s, hx, hy);
    E(img, 19.6 + s.long * 0.4, 17.6, 2.8, 1.2, R('accent'), [0.95, 0.4, 0]); // the front paws under the chin
    collarAt(img, Math.round(hx - 3.2), 14);
    return img;
  }
  if (o.sit) {
    const by = 13.4 - lift * 0.4;
    dogTailSide(img, s, 5.6, by - 1, 0);
    const pred = or(ell(10.5 + s.long * 0.5, by + 0.8, 5.2 + s.long, 3.4), ell(13.2 + s.long, by + 2.2, 3.2, 2.4));
    paint(img, s.fluffy ? or(pred, fluff(10.5, by + 1, 5.6, 3.8, 8, 0.15)) : pred, [10.5, by + 1, 6, 3.6], R('body'));
    leg(img, 14.2 + s.long, by + 0.8, 19.2);
    paint(img, ell(8.4, 17.2, 3.4 + s.long, 1.6), [8.4, 17.2, 3.4, 1.6], R('body'), [0.9, 0.4, 0]);
    const hx = 17.6 + s.long * 0.6, hy = by - 4.2 + Math.max(0, -lift) * 0.4;
    dogHeadSide(img, s, hx, hy);
    collarAt(img, Math.round(hx - 3), Math.round(hy + 3.4));
    return img;
  }
  const bob = phase % 2 ? -1 : 0;
  const by = 11.6 - lift + bob;
  const legTop = by + 1.4, foot = 18.8;
  const sw = [[-1, 1, 1, -1], [0, 0, 0, 0], [1, -1, -1, 1], [0, 0, 0, 0]][phase];
  const up = [[0, 1, 0, 1], [0, 0, 0, 0], [1, 0, 1, 0], [0, 0, 0, 0]][phase];
  const lx = s.long ? [3 - s.long, 7 - s.long, 14 + s.long, 17 + s.long] : [4, 8, 13, 16];
  dogTailSide(img, s, 3.6 - s.long * 1.2, by - 3.4, phase);
  if (!s.fluffy || s.leg > -1) {
    leg(img, lx[1] + sw[1], legTop, foot - up[1], true);
    leg(img, lx[3] + sw[3], legTop, foot - up[3], true);
  }
  dogBodySide(img, s, by);
  leg(img, lx[0] + sw[0], legTop, foot - up[0]);
  leg(img, lx[2] + sw[2], legTop, foot - up[2]);
  const hx = 18.3 + s.long * 0.4 - (s.head > 1.05 ? 0.4 : 0), hy = by - 2.2 - (s.head - 1) * 3;
  dogHeadSide(img, s, hx, hy, { tongue: phase === 2 });
  collarAt(img, Math.round(hx - 4.4), Math.round(hy + 2.2));
  return img;
}

/** The collar: three pixels around the neck (key `collar`, base and highlight). */
function collarAt(img, x, y, front = false) {
  if (front) { put(img, x - 1, y, R('collar')[3]); put(img, x, y, R('collar')[2]); put(img, x + 1, y, R('collar')[2]); return; }
  put(img, x, y, R('collar')[2]); put(img, x + 1, y, R('collar')[3]); put(img, x + 1, y + 1, R('collar')[2]);
}

/** Front ears (south view): left is the far one (darker). */
function dogEarsFront(img, s, cx, cy) {
  const k = s.head;
  if (s.ear === 'pointy' || s.ear === 'bat') {
    const big = s.ear === 'bat' ? 1.3 : 1;
    paint(img, tri(cx - 4.8 * k, cy - 1.2 * k, cx - 6.6 * k, cy - 7 * big * k, cx - 1.4 * k, cy - 2 * k), [cx - 4, cy - 4.2, 2.6, 3], R('ear', true), [0.9, 0.4, 0]);
    paint(img, tri(cx + 1.4 * k, cy - 1.2 * k, cx + 4.6 * k, cy - 7 * big * k, cx + 6.8 * k, cy - 2 * k), [cx + 4.2, cy - 4.2, 2.6, 3], R('ear'), [0.88, 0.38, 0]);
    return true;
  }
  return false;
}
function dogFloppyFront(img, s, cx, cy) {
  const drop = s.ear === 'long' ? 4.4 : 3;
  E(img, cx - 4.6 * s.head, cy + drop * 0.3, 1.7, drop * 0.75, R('ear', true), [0.9, 0.4, 0]);
  E(img, cx + 4.6 * s.head, cy + drop * 0.3, 1.7, drop * 0.75, R('ear'), [0.88, 0.4, 0]);
}

function dogFront(s, phase, o = {}) {
  const img = blank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0) - Math.max(0, s.leg) * 0.8 + Math.max(0, -s.leg - 1) * 0.6;
  const k = s.head;
  const cx = 12, cy = 8.2 + yb;
  const pointy = dogEarsFront(img, s, cx, cy);
  if (s.fluffy) paint(img, fluff(cx, cy, 5.6 * k, 4.6 * k, 7, 0.13), [cx, cy, 5.6, 4.6], R('body'));
  else E(img, cx, cy, 5.4 * k, 4.3 * k, R('body'), [0.84, 0.4, 0]);
  if (s.fluffy) paint(img, fluff(cx, cy - 4.4 * k, 2.6, 1.6, 5, 0.25), [cx, cy - 4.4, 2.6, 1.6], R('body'));
  if (pointy) { put(img, cx - 4, Math.round(cy - 5.2), R('earin')[1]); put(img, cx - 4, Math.round(cy - 4.2), R('earin')[1]); put(img, cx + 4, Math.round(cy - 5.2), R('earin')[1]); put(img, cx + 3, Math.round(cy - 4.2), R('earin')[1]); }
  else dogFloppyFront(img, s, cx, cy);
  E(img, cx, cy + 3 * k, 3.1 * k, 2.3 * k, R('accent'), [0.9, 0.42, 0]);
  // the chest under the chin, wider and deeper for the big shapes
  const chestRx = sit ? 5.6 : 4.8 * (s.chest / 3.5) ** 0.5;
  const chest = s.fluffy ? fluff(cx, 14.8 + yb, chestRx + 0.6, 3.4, 7, 0.16) : sit ? ell(cx, 15.2 + yb, 5.6, 2.6) : ell(cx, 14.6 + yb, chestRx, 3.1);
  paint(img, chest, [cx, 14.8 + yb, chestRx, 3], R('body'), [0.86, 0.4, 0]);
  put(img, cx, Math.round(15 + yb), R('accent')[2]); put(img, cx, Math.round(16 + yb), R('accent')[2]);
  collarAt(img, cx, Math.round(cy + 4.8 * k), true);
  if (sit) {
    E(img, cx, 17.2, 6.2, 1.8, R('body'), [0.9, 0.4, 0]);
    E(img, cx - 1.8, 17.6, 1.5, 1.3, R('accent'), [0.95, 0.4, 0]);
    E(img, cx + 1.8, 17.6, 1.5, 1.3, R('accent'), [0.95, 0.4, 0]);
  } else if (s.fluffy) {
    // the coat hides the legs: two paws peep out
    paint(img, fluff(cx, 17.4 + bob * 0.5, 5.4, 1.8, 9, 0.3), [cx, 17.4, 5.4, 1.8], R('body'));
    E(img, cx - 2.2, 18.2 - (phase === 1 ? 0.6 : 0), 1.3, 0.9, R('accent'), [0.95, 0.4, 0]);
    E(img, cx + 2.2, 18.2 - (phase === 2 ? 0.6 : 0), 1.3, 0.9, R('accent'), [0.95, 0.4, 0]);
  } else {
    const liftL = phase === 1 ? 1.4 : 0, liftR = phase === 2 ? 1.4 : 0;
    leg(img, cx - 3.8, Math.min(17, 15.2 + yb), 19.2 - liftL);
    leg(img, cx + 1.6, Math.min(17, 15.2 + yb), 19.2 - liftR);
    put(img, cx - 5, 18, R('leg', true)[1]); put(img, cx + 4, 18, R('leg', true)[1]);
    put(img, cx - 5, 17, NAVY); put(img, cx + 4, 17, NAVY);
  }
  eye(img, cx - 3, Math.round(cy - 0.2), o.blink);
  eye(img, cx + 2, Math.round(cy - 0.2), o.blink);
  put(img, cx - 1, Math.round(cy + 2.8 * k), NOSE); put(img, cx, Math.round(cy + 2.8 * k), NOSE);
  if (o.tongue) { put(img, cx, Math.round(cy + 4.8), PINK_DEEP); put(img, cx, Math.round(cy + 5.8), PINK); }
  return img;
}

function dogBack(s, phase, o = {}) {
  const img = blank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0) - Math.max(0, s.leg) * 0.8 + Math.max(0, -s.leg - 1) * 0.6;
  const k = s.head;
  const wag = [0, -1, 0, 1][phase] ?? 0;
  // tail: up over the rump (curl / plume) or hanging (straight)
  if (s.tail === 'straight') {
    paint(img, box(11.4 + wag * 0.5, 13 + yb, 12.6 + wag * 0.5, 17.4 + yb), [12, 15 + yb, 1, 2.2], R('tail'), [0.9, 0.4, 0]);
    put(img, 12 + wag, Math.round(17 + yb), R('accent')[2]);
  } else {
    const p = s.tail === 'plume' ? fluff(15 + wag * 0.3, 8.5 + yb, 3, 3.2, 5, 0.22) : ell(15 + wag * 0.3, 8.5 + yb, 2.4, 2.6);
    paint(img, p, [15, 8.5 + yb, 2.4, 2.6], R('tail'), [0.88, 0.4, 0]);
    put(img, 16 + wag, Math.round(7 + yb), R('accent')[2]);
  }
  const cx = 11.8, cy = 8.4 + yb;
  if (s.ear === 'pointy' || s.ear === 'bat') {
    const big = s.ear === 'bat' ? 1.3 : 1;
    paint(img, tri(cx - 4.4 * k, cy - 1.2, cx - 6.2 * k, cy - 7 * big, cx - 1.4 * k, cy - 2), [cx - 3.8, cy - 4.2, 2.4, 3], R('ear', true), [0.9, 0.4, 0]);
    paint(img, tri(cx + 1.4 * k, cy - 1.2, cx + 4.4 * k, cy - 7 * big, cx + 6.6 * k, cy - 2), [cx + 4.2, cy - 4.2, 2.4, 3], R('ear'), [0.88, 0.38, 0]);
  }
  if (s.fluffy) paint(img, fluff(cx, cy, 5 * k, 3.9 * k, 7, 0.13), [cx, cy, 5, 3.9], R('body'));
  else E(img, cx, cy, 4.6 * k, 3.6 * k, R('body'), [0.84, 0.4, 0]);
  if (!(s.ear === 'pointy' || s.ear === 'bat')) dogFloppyFront(img, s, cx, cy);
  const bw = sit ? 5.8 : 5.2 * (s.chest / 3.5) ** 0.5;
  const body = s.fluffy ? fluff(12, 14.2 + yb, bw + 0.6, 3.6, 8, 0.15) : sit ? ell(12, 14.8 + yb, 5.8, 2.8) : ell(12, 13.8 + yb, bw, 3.4);
  paint(img, body, [12, 14 + yb, bw, 3.2], R('body'), [0.86, 0.4, 0]);
  if (sit) {
    E(img, 12, 17.4, 6.4, 1.7, R('body'), [0.9, 0.4, 0]);
    put(img, 8, 17, R('accent')[1]); put(img, 15, 17, R('accent')[1]);
  } else if (s.fluffy) {
    paint(img, fluff(12, 17.4 + bob * 0.5, 5.6, 1.8, 9, 0.3), [12, 17.4, 5.6, 1.8], R('body'));
  } else {
    const liftL = phase === 1 ? 1.4 : 0, liftR = phase === 2 ? 1.4 : 0;
    leg(img, 8, Math.min(17, 15 + yb), 19.2 - liftL, true);
    leg(img, 13.4, Math.min(17, 15 + yb), 19.2 - liftR);
  }
  return img;
}

/** Belly down facing the camera, paws stretched out. */
function dogLieFront(s) {
  const img = blank(PET_W, PET_H);
  const k = s.head;
  const body = s.fluffy ? fluff(12, 15.6, 7.2 + s.long, 3, 9, 0.14) : ell(12, 15.6, 6.8 + s.long, 2.8);
  paint(img, body, [12, 15.6, 6.8, 2.8], R('body'));
  const cx = 12, cy = 12.2;
  if (s.ear === 'pointy' || s.ear === 'bat') {
    const big = s.ear === 'bat' ? 1.25 : 0.8;
    paint(img, tri(cx - 3.6, cy - 1, cx - 5, cy - 5.6 * big, cx - 1, cy - 1.8), [cx - 3.2, cy - 3, 2, 2.4], R('ear', true), [0.9, 0.4, 0]);
    paint(img, tri(cx + 1, cy - 1, cx + 3.6, cy - 5.6 * big, cx + 5, cy - 1.8), [cx + 3.2, cy - 3, 2, 2.4], R('ear'), [0.88, 0.38, 0]);
  }
  if (s.fluffy) paint(img, fluff(cx, cy, 4.6 * k, 3.2 * k, 7, 0.14), [cx, cy, 4.6, 3.2], R('body'));
  else E(img, cx, cy + 0.4, 4.2 * k, 3 * k, R('body'), [0.84, 0.4, 0]);
  if (!(s.ear === 'pointy' || s.ear === 'bat')) {
    E(img, cx - 4.2 * k, cy + 1, 1.6, 2, R('ear', true), [0.9, 0.4, 0]);
    E(img, cx + 4.2 * k, cy + 1, 1.6, 2, R('ear'), [0.88, 0.4, 0]);
  }
  E(img, cx, cy + 2, 2.4 * k, 1.6 * k, R('accent'), [0.9, 0.4, 0]);
  E(img, 9.4, 17.8, 2, 1.15, R('accent'), [0.95, 0.4, 0]);
  E(img, 14.6, 17.8, 2, 1.15, R('accent'), [0.95, 0.4, 0]);
  eye(img, cx - 2, Math.round(cy), false);
  eye(img, cx + 1, Math.round(cy), false);
  put(img, cx - 1, Math.round(cy + 2), NOSE); put(img, cx, Math.round(cy + 2), NOSE);
  collarAt(img, cx, Math.round(cy + 3), true);
  return img;
}

function dogLieBack(s) {
  const img = blank(PET_W, PET_H);
  const k = s.head;
  if (s.tail !== 'straight') { E(img, 6.2, 14.6, 2.4, 2, R('tail'), [0.88, 0.4, 0]); put(img, 5, 13, R('accent')[2]); }
  else { paint(img, box(4, 16, 7, 17.2), [5.5, 16.6, 1.5, 0.8], R('tail')); put(img, 4, 16, R('accent')[2]); }
  const body = s.fluffy ? fluff(12.2, 15.6, 6.6 + s.long, 3, 9, 0.14) : ell(12.2, 15.6, 6.2 + s.long, 2.8);
  paint(img, body, [12.2, 15.6, 6.2, 2.8], R('body'));
  const cy = 12.8;
  if (s.ear === 'pointy' || s.ear === 'bat') {
    const big = s.ear === 'bat' ? 1.2 : 0.8;
    paint(img, tri(8.8, cy - 0.6, 7.8, cy - 5 * big, 11, cy - 1.6), [9, cy - 2.6, 1.8, 2], R('ear', true), [0.9, 0.4, 0]);
    paint(img, tri(13.4, cy - 1.6, 16.6, cy - 5 * big, 15.6, cy - 0.6), [15.4, cy - 2.6, 1.8, 2], R('ear'), [0.88, 0.38, 0]);
  }
  E(img, 12.2, cy, 3.6 * k, 2.4 * k, R('body'), [0.84, 0.4, 0]);
  if (!(s.ear === 'pointy' || s.ear === 'bat')) {
    E(img, 8.8, cy + 0.6, 1.8, 1.3, R('ear', true), [0.9, 0.4, 0]);
    E(img, 15.6, cy + 0.4, 1.8, 1.3, R('ear'), [0.88, 0.38, 0]);
  }
  return img;
}

// ------------------------------------------------------------------ cat shapes
/** Cat shape parameters: `ear` scales the ears, `leg` the legs, `tail` the tail thickness, `ruff` the neck fluff, `round` the body. */
export const CAT_SHAPES = {
  comum: { ear: 1, leg: 0, tail: 1, ruff: false, round: 1, face: 1 },
  peludo: { ear: 0.85, leg: -1, tail: 1.9, ruff: true, round: 1.18, face: 1.1 },
  esguio: { ear: 1.35, leg: 1.2, tail: 0.7, ruff: false, round: 0.86, face: 0.88 },
};

function catEarsFront(img, s, cx, cy) {
  const e = s.ear;
  paint(img, tri(cx - 3.8 * s.face, cy + 1.4, cx - 4.8 * s.face, cy - 6.2 * e, cx - 0.8, cy + 0.6), [cx - 2.8, cy - 2.6, 2, 3.4], R('ear', true), [0.9, 0.4, 0]);
  paint(img, tri(cx + 0.8, cy + 0.6, cx + 4.6 * s.face, cy - 6.2 * e, cx + 5.2 * s.face, cy + 1.4), [cx + 3.2, cy - 2.6, 2, 3.4], R('ear'), [0.88, 0.38, 0]);
}

function catFront(s, phase, o = {}) {
  const img = blank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0) - s.leg * 0.7;
  const cx = 12, cy = 9.4 + yb;
  catEarsFront(img, s, cx, cy - 1.4);
  put(img, cx - 3, Math.round(cy - 6.2 * s.ear + 0.4), PINK); put(img, cx - 3, Math.round(cy - 5.2 * s.ear + 0.4), PINK);
  put(img, cx + 3, Math.round(cy - 6.2 * s.ear + 0.4), PINK); put(img, cx + 3, Math.round(cy - 5.2 * s.ear + 0.4), PINK_DEEP);
  if (s.ruff) paint(img, fluff(cx, cy + 2.6, 5.6, 3.2, 9, 0.18), [cx, cy + 2.6, 5.6, 3.2], R('body'));
  E(img, cx, cy, 4.6 * s.face, 3.8 * s.face, R('body'), [0.84, 0.4, 0]);
  E(img, cx, cy + 2.6, 2.2 * s.face, 1.6, R('accent'), [0.9, 0.4, 0]);
  const rx = (sit ? 4.4 : 3.6) * s.round;
  const chest = sit ? ell(cx, 15.4 + yb, rx, 2.4) : ell(cx, 14.6 + yb, rx, 2.8);
  paint(img, chest, [cx, 15 + yb, rx, 2.6], R('body'), [0.86, 0.4, 0]);
  put(img, cx, Math.round(14 + yb), R('accent')[3]); put(img, cx - 1, Math.round(15 + yb), R('accent')[2]); put(img, cx, Math.round(15 + yb), R('accent')[3]); put(img, cx + 1, Math.round(15 + yb), R('accent')[2]);
  const tx = 17 + (s.round - 1) * 3;
  const tw = 1.7 * s.tail;
  paint(img, s.tail > 1.5 ? fluff(tx, 13.2 + yb, tw, 3.4, 5, 0.2) : ell(tx, 13.2 + yb, tw, 3.2), [tx, 13.2 + yb, tw, 3.2], R('tail'), [0.88, 0.4, 0]);
  put(img, Math.round(tx), Math.round(11 + yb), R('accent')[3]);
  if (sit) {
    E(img, cx, 17.4, 5.2 * s.round, 1.6, R('body'), [0.9, 0.4, 0]);
    E(img, cx - 1.4, 17.6, 1.3, 1.1, R('accent'), [0.95, 0.4, 0]);
    E(img, cx + 1.4, 17.6, 1.3, 1.1, R('accent'), [0.95, 0.4, 0]);
  } else {
    const liftL = phase === 1 ? 1.6 : 0, liftR = phase === 2 ? 1.6 : 0;
    leg(img, cx - 2.8, Math.min(17, 15.4 + yb), 19.2 - liftL);
    leg(img, cx + 0.6, Math.min(17, 15.4 + yb), 19.2 - liftR);
  }
  eye(img, cx - 2, Math.round(cy - 0.4), o.blink, true);
  eye(img, cx + 2, Math.round(cy - 0.4), o.blink, true);
  put(img, cx, Math.round(cy + 1.6), PINK_DEEP);
  put(img, cx - 1, Math.round(cy + 2.6), PINK);
  collarAt(img, cx, Math.round(cy + 3.8 * s.face), true);
  return img;
}

function catBack(s, phase, o = {}) {
  const img = blank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0) - s.leg * 0.7;
  const wag = [0, 1, 0, -1][phase] ?? 0;
  const tw = s.tail;
  const tailP = tw > 1.5 ? fluff(12 + wag, 5.4 + yb, 1.9, 3.8, 5, 0.22) : box(12 + wag - tw, 2 + yb, 12 + wag + tw, 9 + yb);
  paint(img, tailP, [12 + wag, 5 + yb, 1.2 * tw, 3.5], R('tail'), [0.9, 0.4, 0]);
  put(img, 12 + wag, Math.round(2 + yb), R('accent')[3]);
  const cx = 12, cy = 10.2 + yb;
  paint(img, tri(cx - 3.6, cy - 1.2, cx - 4.6 * s.face, cy - 6.6 * s.ear, cx - 1, cy - 2), [cx - 3, cy - 4, 1.8, 3], R('ear', true), [0.9, 0.4, 0]);
  paint(img, tri(cx + 1, cy - 2, cx + 4.4 * s.face, cy - 6.6 * s.ear, cx + 4.6, cy - 1.2), [cx + 3, cy - 4, 1.8, 3], R('ear'), [0.88, 0.38, 0]);
  if (s.ruff) paint(img, fluff(cx, cy + 2.4, 5.4, 3, 9, 0.18), [cx, cy + 2.4, 5.4, 3], R('body'));
  E(img, cx, cy, 4.2 * s.face, 3.2 * s.face, R('body'), [0.84, 0.4, 0]);
  const rx = (sit ? 4.6 : 3.8) * s.round;
  paint(img, sit ? ell(cx, 15.2 + yb, rx, 2.4) : ell(cx, 14.4 + yb, rx, 2.8), [cx, 14.8 + yb, rx, 2.6], R('body'), [0.86, 0.4, 0]);
  if (sit) E(img, cx, 17.4, 5.4 * s.round, 1.6, R('body'), [0.9, 0.4, 0]);
  else {
    const liftL = phase === 1 ? 1.6 : 0, liftR = phase === 2 ? 1.6 : 0;
    leg(img, 9, Math.min(17, 15.2 + yb), 19.2 - liftL, true);
    leg(img, 12.8, Math.min(17, 15.2 + yb), 19.2 - liftR);
  }
  return img;
}

function catSide(s, phase, o = {}) {
  const img = blank(PET_W, PET_H);
  const bob = (o.sit ? 1 : phase % 2 ? -1 : 0) - s.leg * 0.8;
  const sw = o.sit ? [0, 0, 0, 0] : [[-1, 1, 1, -1], [0, 0, 0, 0], [1, -1, -1, 1], [0, 0, 0, 0]][phase];
  const lift = o.sit ? [0, 0, 0, 0] : [[0, 1.5, 0, 1.5], [0, 0, 0, 0], [1.5, 0, 1.5, 0], [0, 0, 0, 0]][phase];
  const wag = o.sit ? 0 : [0, 1, 0, -1][phase];
  const tw = s.tail;
  // the tail rises from a root that always meets the rump (a slim body starts further right)
  const tailP = or(tw > 1.5 ? fluff(4 + wag, 7 + bob, 2, 4.2, 5, 0.22) : box(4 + wag - 1.15 * tw, 3 + bob, 4 + wag + 1.15 * tw, 11 + bob), box(4 + wag, 10 + bob, 7.6, 12 + bob));
  paint(img, tailP, [4 + wag, 7 + bob, 1.15 * tw, 4], R('tail'), [0.9, 0.4, 0]);
  put(img, 4 + wag, Math.round(3 + bob), R('accent')[3]);
  const legTop = 13 + bob;
  if (!o.sit) {
    leg(img, 7 + sw[1], legTop, 19.2 - lift[1], true);
    leg(img, 14 + sw[3], legTop, 19.2 - lift[3], true);
  }
  if (s.ruff) paint(img, fluff(14.6, 11.6 + bob, 3.2, 3.6, 7, 0.2), [14.6, 11.6 + bob, 3.2, 3.6], R('body'));
  paint(img, or(ell(10.2, 12.4 + bob, 5.2 * s.round, 2.8 * s.round), ell(14.2, 12.8 + bob, 2.2, 2.4)), [11, 12.4 + bob, 6, 3], R('body'), [0.86, 0.4, 0]);
  put(img, 13, Math.round(13 + bob), R('accent')[2]); put(img, 14, Math.round(14 + bob), R('accent')[3]);
  if (o.sit) {
    E(img, 8.2, 16.6, 3.2 * s.round, 1.8, R('body'), [0.9, 0.4, 0]);
    leg(img, 14, 13.5 + bob, 19.2);
  } else {
    leg(img, 6 + sw[0], legTop, 19.2 - lift[0]);
    leg(img, 13 + sw[2], legTop, 19.2 - lift[2]);
  }
  const hx = 18.4, hy = 10 + bob;
  paint(img, tri(hx - 2, hy - 1.6, hx - 0.2, hy - 7.8 * s.ear, hx + 2.2, hy - 2.4), [hx, hy - 5, 2.2, 3.2], R('ear'), [0.88, 0.36, 0]);
  put(img, Math.round(hx - 0.4), Math.round(hy - 6 * s.ear + 0.4), PINK); put(img, Math.round(hx + 0.6), Math.round(hy - 6 * s.ear + 0.4), PINK_DEEP);
  E(img, hx, hy, 3.8 * s.face, 3.4 * s.face, R('body'), [0.84, 0.4, 0]);
  E(img, hx + 2.8 * s.face, hy + 1.6, 2.1 * s.face, 1.6, R('accent'), [0.9, 0.4, 0]);
  eye(img, Math.round(hx + 0.6), Math.round(hy - 1), o.blink, true);
  put(img, Math.round(hx + 3.6 * s.face), Math.round(hy + 1), PINK_DEEP);
  collarAt(img, Math.round(hx - 3.4), Math.round(hy + 2));
  return img;
}

function catLieSide(s) {
  const img = blank(PET_W, PET_H);
  const tw = s.tail;
  paint(img, tw > 1.5 ? fluff(4.2, 15.6, 3, 2, 5, 0.22) : ell(4.2, 15.8, 2.6, 1.6 * Math.max(0.8, tw)), [4.2, 15.8, 2.6, 1.6], R('tail'), [0.9, 0.4, 0]);
  put(img, 3, 15, R('accent')[3]);
  if (s.ruff) paint(img, fluff(15.6, 14.6, 3, 3, 7, 0.2), [15.6, 14.6, 3, 3], R('body'));
  E(img, 11.2, 15.4, 6.4 * s.round, 2.6 * Math.min(1.1, s.round), R('body'), [0.86, 0.4, 0]);
  put(img, 14, 16, R('accent')[3]);
  const hx = 18.2, hy = 14;
  paint(img, tri(hx - 1, hy - 2.4, hx + 0.4, hy - 6.4 * s.ear, hx + 2, hy - 2.4), [hx + 0.4, hy - 4.4, 1.6, 2.2], R('ear'), [0.88, 0.36, 0]);
  put(img, Math.round(hx), Math.round(hy - 5 * s.ear + 0.4), PINK);
  E(img, hx, hy, 3.6 * s.face, 3 * s.face, R('body'), [0.84, 0.4, 0]);
  E(img, hx + 2.6, hy + 1, 1.8, 1.4, R('accent'), [0.9, 0.4, 0]);
  eye(img, Math.round(hx + 0.8), Math.round(hy - 1), false, true);
  put(img, Math.round(hx + 3.8), Math.round(hy + 1), PINK_DEEP);
  E(img, 16.4, 17.6, 2.2, 1.15, R('accent'), [0.95, 0.4, 0]);
  return img;
}

/** A loaf: paws tucked, ears up, the tail curled to the side. */
function catLieFront(s) {
  const img = blank(PET_W, PET_H);
  const tw = s.tail;
  paint(img, tw > 1.5 ? fluff(17.4, 15.6, 2.6, 1.9, 5, 0.22) : ell(17.4, 15.8, 2.2, 1.6), [17.4, 15.8, 2.2, 1.6], R('tail'), [0.88, 0.4, 0]);
  put(img, 18, 15, R('accent')[3]);
  E(img, 11.2, 15.6, 5.6 * s.round, 2.6, R('body'), [0.86, 0.4, 0]);
  if (s.ruff) paint(img, fluff(11.2, 14.2, 4.8, 2.4, 9, 0.2), [11.2, 14.2, 4.8, 2.4], R('body'));
  const cx = 11.2, cy = 12.6;
  paint(img, tri(cx - 2.6, cy - 1.4, cx - 3 * s.face, cy - 5.8 * s.ear, cx - 0.2, cy - 2), [cx - 2, cy - 3.4, 1.6, 2.4], R('ear', true), [0.9, 0.4, 0]);
  paint(img, tri(cx + 0.2, cy - 2, cx + 3 * s.face, cy - 5.8 * s.ear, cx + 3.2, cy - 1.4), [cx + 1.8, cy - 3.4, 1.6, 2.4], R('ear'), [0.88, 0.38, 0]);
  put(img, 9, Math.round(cy - 4.6 * s.ear + 0.6), PINK); put(img, 13, Math.round(cy - 4.6 * s.ear + 0.6), PINK_DEEP);
  E(img, cx, cy, 4 * s.face, 2.8 * s.face, R('body'), [0.84, 0.4, 0]);
  E(img, cx, 17.6, 3.2, 1.15, R('accent'), [0.95, 0.4, 0]);
  eye(img, 10, Math.round(cy), false, true);
  eye(img, 13, Math.round(cy), false, true);
  put(img, 11, Math.round(cy + 1.4), PINK_DEEP);
  put(img, 12, Math.round(cy + 2.4), R('accent')[3]);
  return img;
}

function catLieBack(s) {
  const img = blank(PET_W, PET_H);
  const tw = s.tail;
  paint(img, tw > 1.5 ? fluff(6.2, 15, 2.4, 2.6, 5, 0.22) : ell(6.2, 15.2, 2 * Math.max(0.8, tw), 2.2), [6.2, 15.2, 2, 2.2], R('tail'), [0.9, 0.4, 0]);
  put(img, 6, 13, R('accent')[3]);
  E(img, 12, 15.6, 5.4 * s.round, 2.6, R('body'), [0.86, 0.4, 0]);
  const cy = 12.8;
  paint(img, tri(9.6, cy - 1.2, 9.4 - (s.ear - 1) * 2, cy - 5 * s.ear, 11.4, cy - 1.6), [10.2, cy - 3, 1.4, 2], R('ear', true), [0.9, 0.4, 0]);
  paint(img, tri(12.6, cy - 1.2, 14.8 + (s.ear - 1) * 2, cy - 5 * s.ear, 14.8, cy - 1.6), [13.8, cy - 3, 1.4, 2], R('ear'), [0.88, 0.38, 0]);
  if (s.ruff) paint(img, fluff(12, cy + 1.6, 4.4, 2.2, 9, 0.2), [12, cy + 1.6, 4.4, 2.2], R('body'));
  E(img, 12, cy, 3.4 * s.face, 2.4 * s.face, R('body'), [0.84, 0.4, 0]);
  return img;
}

// ------------------------------------------------------------------ patterns
const LABELLED = new Set(['body', 'ear', 'tail', 'leg', 'accent']);
/** Smooth deterministic noise for the patches (low frequency, so a patch is a blob, not salt). */
const blob = (x, y, seed) => Math.sin(x * 0.52 + seed * 1.7) * Math.sin(y * 0.66 + seed * 0.9) + 0.55 * Math.sin((x + y) * 0.31 + seed);

/**
 * Pattern rules: which key ramp (`coat` or `coat2`) a labelled pixel goes to. `top` is the first row of `body` in this column (the back /
 * the top of the head), for the saddle.
 */
function channel(pattern, label, rank, x, y, top, frame) {
  switch (pattern) {
    case 'solido':
      return 'coat';
    case 'peito':
      return label === 'accent' ? 'coat2' : 'coat';
    case 'manchado':
      if (label === 'accent') return 'coat';
      return blob(x, y, frame % 3) > 0.62 ? 'coat2' : 'coat';
    case 'pintado': {
      if (label === 'accent') return 'coat';
      // scattered dots on two interleaved lattices (about one pixel in six), never touching each other
      return (x * 7 + y * 13) % 11 === 0 || (x * 5 + y * 3) % 13 === 0 ? 'coat2' : 'coat';
    }
    case 'tigrado':
      if (label === 'accent') return 'coat';
      return (x * 2 + y * 3 + 64) % 7 < 2 ? 'coat2' : 'coat';
    case 'sela':
      if (label === 'accent' || label === 'leg') return 'coat';
      if (label === 'tail') return 'coat2';
      if (label === 'ear') return y <= top + 2 ? 'coat2' : 'coat';
      return top >= 0 && y - top < 3 ? 'coat2' : 'coat';
    case 'pontas':
      if (label === 'ear' || label === 'tail' || label === 'accent') return 'coat2';
      if (label === 'leg') return y >= 16 ? 'coat2' : 'coat';
      return 'coat';
    default:
      return 'coat';
  }
}

/** Maps the label colours of one frame to the key colours of `pattern`. */
export function finish(img, pattern, frame = 0) {
  const lab = (x, y) => {
    const i = (y * img.w + x) * 4;
    return img.data[i + 3] ? decode(img.data[i], img.data[i + 1], img.data[i + 2]) : null;
  };
  const top = [];
  for (let x = 0; x < img.w; x++) {
    top[x] = -1;
    for (let y = 0; y < img.h; y++) if (lab(x, y)?.label === 'body') { top[x] = y; break; }
  }
  const out = blank(img.w, img.h);
  out.data.set(img.data);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const l = lab(x, y);
    if (!l) continue;
    let hex;
    if (l.label === 'collar') hex = PET_KEY_RAMPS.collar[l.rank >= 3 ? 1 : 0];
    else if (l.label === 'earin') hex = PET_KEY_RAMPS.coat[0];
    else if (LABELLED.has(l.label)) {
      const ch = channel(pattern, l.label, l.rank, x, y, top[x], frame);
      // the accent parts in `coat` sit one rank lighter (a muzzle reads even on a solid coat)
      const rank = l.label === 'accent' && ch === 'coat' ? Math.min(3, l.rank + 1) : l.rank;
      hex = PET_KEY_RAMPS[ch][rank];
    }
    if (hex) put(out, x, y, hex);
  }
  return out;
}

// ------------------------------------------------------------------ strips
/** Where a coat pixel meets empty space, the missing 1 px navy edge; a coat pixel on the frame border becomes navy. */
export function sealOutline(img) {
  const isNavy = (x, y) => {
    const i = (y * img.w + x) * 4;
    return img.data[i] === 0x3a && img.data[i + 1] === 0x3a && img.data[i + 2] === 0x50;
  };
  const opaque = (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3] > 0;
  const add = [], eat = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!opaque(x, y) || isNavy(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) eat.push([x, y]);
      else if (!opaque(nx, ny)) add.push([nx, ny]);
    }
  }
  for (const [x, y] of add) put(img, x, y, NAVY);
  for (const [x, y] of eat) put(img, x, y, NAVY);
  return img;
}

/** The 20 frames of one shape, in label colours (PET_ANIMS order). */
export function shapeFrames(species, shapeId) {
  if (species === 'dog') {
    const s = DOG_SHAPES[shapeId];
    if (!s) throw new Error(`petshapes: no dog shape '${shapeId}'`);
    return [
      ...[0, 1, 2, 3].map((p) => dogSide(s, p)),
      ...[0, 1, 2, 3].map((p) => dogFront(s, p)),
      ...[0, 1, 2, 3].map((p) => dogBack(s, p)),
      dogFront(s, 0), dogFront(s, 0, { blink: true }),
      dogSide(s, 0, { sit: true }), dogFront(s, 0, { sit: true }), dogBack(s, 0, { sit: true }),
      dogSide(s, 0, { lie: true }), dogLieFront(s), dogLieBack(s),
    ];
  }
  const s = CAT_SHAPES[shapeId];
  if (!s) throw new Error(`petshapes: no cat shape '${shapeId}'`);
  return [
    ...[0, 1, 2, 3].map((p) => catSide(s, p)),
    ...[0, 1, 2, 3].map((p) => catFront(s, p)),
    ...[0, 1, 2, 3].map((p) => catBack(s, p)),
    catFront(s, 0), catFront(s, 0, { blink: true }),
    catSide(s, 0, { sit: true }), catFront(s, 0, { sit: true }), catBack(s, 0, { sit: true }),
    catLieSide(s), catLieFront(s), catLieBack(s),
  ];
}

/** One key-coloured strip (`chars/pet_<species>_<shape>_<pattern>`): 20 frames side by side. */
export function breedStrip(species, shapeId, pattern) {
  const frames = shapeFrames(species, shapeId).map((f, i) => sealOutline(finish(f, pattern, i)));
  const img = blank(PET_W * frames.length, PET_H);
  frames.forEach((f, i) => paste(img, f, i * PET_W, 0));
  return img;
}

/** Swaps the key ramps of a strip for concrete ramps (the contact sheet and the tests; the client does the same with swapKeys). */
export function colourStrip(img, ramps) {
  const out = blank(img.w, img.h);
  out.data.set(img.data);
  const table = new Map();
  for (const name of ['coat', 'coat2', 'collar']) PET_KEY_RAMPS[name].forEach((k, i) => table.set(k, ramps[name][i]));
  for (let i = 0; i < out.data.length; i += 4) {
    if (!out.data[i + 3]) continue;
    const hex = '#' + [0, 1, 2].map((c) => out.data[i + c].toString(16).padStart(2, '0')).join('');
    const to = table.get(hex);
    if (to) put(out, (i / 4) % out.w, Math.floor(i / 4 / out.w), to);
  }
  return out;
}
