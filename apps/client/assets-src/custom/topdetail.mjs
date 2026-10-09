// Per-style details on the five tops, so they tell apart at Praça distance (the pack's torsos differ by a placket at most): a tee's
// sleeve hems, a hoodie's hood, drawstrings and kangaroo pocket, a shirt's collar points and chest pocket, a blouse's scoop neck and
// puff sleeves. Built per frame from the outfit's own alpha (like the gi), in key colours: the top ramp (so they recolour with the
// top) and the skin ramp for the scoop neck. The regata is cut from the detailed tee, so it keeps nothing of the sleeves.
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';
import { clone } from '../../../../scripts/lib/pixel/img.mjs';
import { anchorOf, frames } from '../../../../scripts/lib/pixel/charedit.mjs';
import { rowFacing } from '../../../../scripts/lib/pixel/chars.mjs';
import { frameTools, torsoFeetRow, torsoSpan } from './gi.mjs';

const TOP = KEY_RAMPS.top;
const SKIN = KEY_RAMPS.skin;

/** Returns a copy of the keyed outfit with the style's details painted on every frame. */
export function detailTop(outfit, body, top, an) {
  const draw = DETAILS[top];
  if (!draw) return outfit;
  const out = clone(outfit);
  for (const { r, c } of frames()) {
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const B = torsoFeetRow(a, r);
    const f = rowFacing(r);
    const t = frameTools(out, outfit, body, r, c);
    const belt = torsoSpan(t, r, f, B);
    if (!belt) continue;
    const [x0, x1] = belt;
    const cl = Math.floor((x0 + x1) / 2), cr = cl + 1;
    const dir = f === 'E' ? 1 : -1;
    const front = dir > 0 ? x1 : x0, back = dir > 0 ? x0 : x1;
    draw({ t, f, B, x0, x1, cl, cr, dir, front, back });
  }
  return out;
}

/** Sleeve ends outside the torso on the front / back views: the row under the shoulder, beyond the torso by 3+. */
const sleeveEnds = (t, B, x0, x1, hex) => {
  for (let x = 0; x < 16; x++) if ((x <= x0 - 3 || x >= x1 + 3) && t.cloth(x, B - 7)) t.put(x, B - 7, hex);
};
/** The near sleeve on a side view: the cloth between the torso's back and front edges, one row above the hand. */
const nearSleeve = (t, B, front, back, hex) => {
  for (let x = Math.min(back, front) + 1; x < Math.max(back, front); x++) t.onCloth(x, B - 6, hex);
};

const DETAILS = {
  // tee: hemmed short sleeves
  camiseta: ({ t, f, B, x0, x1, front, back }) => {
    if (f === 'S' || f === 'N') sleeveEnds(t, B, x0, x1, TOP[1]);
    else nearSleeve(t, B, front, back, TOP[1]);
  },
  // hoodie: the hood's rim around the neck, two drawstrings, a kangaroo pocket with its side openings; the hood's shadow on the back
  moletom: ({ t, f, B, x0, x1, cl, cr, dir, front, back }) => {
    if (f === 'S') {
      for (let x = x0 - 1; x <= x1 + 1; x++) t.onBody(x, B - 8, TOP[2]);
      for (const y of [B - 7, B - 6]) { t.onCloth(cl - 1, y, TOP[3]); t.onCloth(cr + 1, y, TOP[3]); }
      for (let x = x0; x <= x1; x++) t.onCloth(x, B - 5, x === x0 || x === x1 ? TOP[0] : TOP[1]);
    } else if (f === 'N') {
      for (let x = x0 - 1; x <= x1 + 1; x++) t.onBody(x, B - 8, TOP[2]);
      for (let x = x0; x <= x1; x++) t.onCloth(x, B - 7, TOP[1]);
    } else {
      for (const x of [back, front - dir, front]) t.onBody(x, B - 8, TOP[2]);
      t.onCloth(front, B - 5, TOP[1]);
    }
  },
  // shirt: collar points beside the neck, a chest pocket on the wearer's right
  camisa: ({ t, f, B, x0, x1, cl, cr, dir, front }) => {
    if (f === 'S') {
      for (const x of [cl - 2, cl - 1, cr + 1, cr + 2]) t.onBody(x, B - 8, TOP[3]);
      t.onCloth(x0 - 1, B - 6, TOP[1]); t.onCloth(x0, B - 6, TOP[1]);
    } else if (f === 'N') {
      for (let x = x0; x <= x1; x++) t.onCloth(x, B - 8, TOP[3]);
    } else {
      t.onBody(front, B - 8, TOP[3]); t.onBody(front - dir, B - 8, TOP[3]);
    }
  },
  // blouse: a small V neck with a light trim, puffed sleeve tops
  blusa: ({ t, f, B, x0, x1, cl, cr, front }) => {
    if (f === 'S') {
      t.onBody(cl, B - 8, SKIN[1]); t.onBody(cr, B - 8, SKIN[1]);
      t.onBody(cl - 1, B - 8, TOP[3]); t.onBody(cr + 1, B - 8, TOP[3]);
      for (let x = 0; x < 16; x++) if ((x <= x0 - 3 || x >= x1 + 3) && t.cloth(x, B - 8)) t.put(x, B - 8, TOP[3]);
    } else if (f === 'N') {
      for (let x = cl; x <= cr; x++) t.onBody(x, B - 8, SKIN[1]);
    } else {
      t.onBody(front, B - 8, SKIN[1]);
    }
  },
};
