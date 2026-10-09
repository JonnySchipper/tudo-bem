// The jiu-jitsu gi (kimono) worn over the camisa + calça outfit, and the academy stamp on it. Built per frame from the alpha of the
// outfit layer, so the pieces follow the walk bob, the sit poses, the bow and the phone loop. Everything is in key colours:
//
//   top ramp   the gi cloth (collar and lapels light, seams and the jacket skirt in the shade), so an academy's blue / black / red gi
//              recolours the whole jacket, not just the shirt under it
//   belt ramp  the belt (3 ranks: knot shade and tail tip, band, knot light), swapped for the earned belt colour at runtime
//   accent     the academy stamp (gi_patch, its own layer): a crest on the back and a small one on the chest
//
// What makes it read as a gi at 16 px, from the top: the lapels' seam running down from the neck line in a V to the knot (the
// lapels lit beside it, the collar a light band at the back of the neck), ONE thin belt row with a knot and two tails, and the jacket's skirt hanging under the belt (the old waist line between shirt
// and pants becomes cloth). The belt used to be two full rows plus a knot on a five-row torso; it is one row now.
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';
import { OUTLINES, alphaAt, anchorOf, emptySheet, frames, fx, fy, hexAt, putHex } from '../../../../scripts/lib/pixel/charedit.mjs';
import { rowFacing } from '../../../../scripts/lib/pixel/chars.mjs';

const TOP = KEY_RAMPS.top;
const BELT = KEY_RAMPS.belt;
/** the pack's inner line colour (the camisa's placket uses it): the lapel seam has to read on a white gi, where the cloth's own shade is pale */
const SEAM = '#46465e';
const ACC = KEY_RAMPS.accent;

const SIT_ROWS = new Set([8, 9, 10, 11]);

/**
 * The feet row the torso rows are measured from. Standing frames use the frame's own bottom; the front / back sit frames are the idle
 * frame lowered 4 px with the legs cut off, the side sit frames keep the standing torso over a lap that ends one row higher.
 */
export function torsoFeetRow(a, r) {
  if (!SIT_ROWS.has(r)) return a.bottom;
  const f = rowFacing(r);
  return f === 'S' || f === 'N' ? a.bottom + 4 : a.bottom + 1;
}

/** Per-frame helpers over the outfit (cloth = opaque and not an outline colour) and the body. */
export function frameTools(out, outfit, body, r, c) {
  const inside = (x, y) => x >= 0 && x < 16 && y >= 0 && y < 32;
  const cloth = (x, y) => inside(x, y) && alphaAt(outfit, fx(c, x), fy(r, y)) > 0 && !OUTLINES.has(hexAt(outfit, fx(c, x), fy(r, y)));
  const outfitAt = (x, y) => inside(x, y) && alphaAt(outfit, fx(c, x), fy(r, y)) > 0;
  const bodyAt = (x, y) => inside(x, y) && alphaAt(body, fx(c, x), fy(r, y)) > 0;
  const put = (x, y, hex) => inside(x, y) && putHex(out, fx(c, x), fy(r, y), hex);
  /** x extent of the cloth pixels of one row, or null */
  const span = (y) => {
    let x0 = 99, x1 = -1;
    for (let x = 0; x < 16; x++) if (cloth(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    return x1 < 0 ? null : [x0, x1];
  };
  return { cloth, outfitAt, bodyAt, put, span, onCloth: (x, y, hex) => cloth(x, y) && put(x, y, hex), onOutfit: (x, y, hex) => outfitAt(x, y) && put(x, y, hex), onBody: (x, y, hex) => bodyAt(x, y) && put(x, y, hex) };
}

/**
 * The torso's x extent on the belt row. On the side sit frames the lap crosses that row, so the row above (the chest) is measured
 * instead; the lap is never part of the belt.
 */
export function torsoSpan(t, r, f, B) {
  return t.span(SIT_ROWS.has(r) && (f === 'E' || f === 'W') ? B - 6 : B - 5);
}

/** The gi pieces (`npc_gi`): collar, lapels, belt, tails, skirt and cuffs for every frame. */
export function buildGi(outfit, body, an) {
  const out = emptySheet();
  for (const { r, c } of frames()) {
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const B = torsoFeetRow(a, r);
    const f = rowFacing(r);
    const t = frameTools(out, outfit, body, r, c);
    // torso rows, from the feet: collar B-8, chest B-7, B-6, belt B-5, skirt (the old waist line) B-4, tails reach B-3
    const belt = torsoSpan(t, r, f, B);
    if (!belt) continue;
    const [x0, x1] = belt;
    if (f === 'S' || f === 'N') {
      const cl = Math.floor((x0 + x1) / 2), cr = cl + 1;
      if (f === 'S') {
        // the pack's neck line stays whole: it is the collar's dark top edge (lightening its ends read as a bow tie)
        // lapels: a dark seam V from the collar to the knot with the lapels lit outside it; the wearer's right lapel crosses over
        // the left on the second row (one seam, the other lapel's edge disappears under it)
        t.onCloth(cl - 2, B - 7, TOP[3]); t.onCloth(cl - 1, B - 7, SEAM);
        t.onCloth(cl, B - 7, TOP[3]); t.onCloth(cr, B - 7, TOP[3]);
        t.onCloth(cr + 1, B - 7, SEAM); t.onCloth(cr + 2, B - 7, TOP[3]);
        t.onCloth(cl - 1, B - 6, TOP[3]); t.onCloth(cl, B - 6, SEAM); t.onCloth(cr, B - 6, TOP[3]); t.onCloth(cr + 1, B - 6, TOP[2]);
        // sleeve cuffs: the sleeve ends outside the torso
        for (let x = 0; x < 16; x++) if ((x <= x0 - 3 || x >= x1 + 3) && t.cloth(x, B - 7)) t.put(x, B - 7, TOP[1]);
      } else {
        // the collar seen from behind: a light band across the shoulders
        for (let x = x0; x <= x1; x++) t.onCloth(x, B - 8, TOP[3]);
      }
      // the belt: one row, inside the arms
      for (let x = x0; x <= x1; x++) t.onCloth(x, B - 5, BELT[1]);
      // the jacket skirt under the belt replaces the waist line; the tails hang over it and the pants
      for (let x = x0; x <= x1; x++) t.onOutfit(x, B - 4, TOP[1]);
      if (f === 'S') {
        t.put(cl, B - 5, BELT[2]); t.put(cr, B - 5, BELT[2]);
        t.onOutfit(cl - 1, B - 4, BELT[1]); t.onOutfit(cr + 1, B - 4, BELT[1]);
        t.onOutfit(cl - 1, B - 3, BELT[0]); t.onOutfit(cr + 1, B - 3, BELT[0]);
      }
    } else {
      // side view: the near arm hangs in front of the torso, so the torso shows as its back edge and its front edge
      const dir = f === 'E' ? 1 : -1;
      const front = dir > 0 ? x1 : x0, back = dir > 0 ? x0 : x1;
      t.onBody(front, B - 8, TOP[3]); t.onBody(front - dir, B - 8, TOP[3]);
      t.onCloth(front, B - 7, TOP[3]);
      t.onCloth(front, B - 6, TOP[3]);
      // the near sleeve's cuff
      for (let x = Math.min(back, front) + 1; x < Math.max(back, front); x++) t.onCloth(x, B - 6, TOP[1]);
      t.onCloth(back, B - 5, BELT[1]); t.onCloth(front, B - 5, BELT[2]);
      t.onOutfit(back, B - 4, TOP[1]);
      t.onOutfit(front, B - 4, BELT[1]);
      t.onCloth(front, B - 3, BELT[0]);
    }
  }
  return out;
}

/** The academy stamp (`gi_patch`): a 4x2 crest on the back and a 1x2 one on the chest, on the accent ramp. Empty on the side views. */
export function buildGiPatch(outfit, body, an) {
  const out = emptySheet();
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
    if (f === 'N') {
      t.onCloth(cl - 1, B - 7, ACC[2]); t.onCloth(cl, B - 7, ACC[1]); t.onCloth(cr, B - 7, ACC[1]); t.onCloth(cr + 1, B - 7, ACC[1]);
      t.onCloth(cl - 1, B - 6, ACC[1]); t.onCloth(cl, B - 6, ACC[1]); t.onCloth(cr, B - 6, ACC[1]); t.onCloth(cr + 1, B - 6, ACC[0]);
    } else if (f === 'S') {
      t.onCloth(x0 - 1, B - 7, ACC[1]); t.onCloth(x0 - 1, B - 6, ACC[0]);
    }
  }
  return out;
}
