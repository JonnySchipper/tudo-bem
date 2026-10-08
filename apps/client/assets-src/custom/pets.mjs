// Subscriber pets (dog and cat) that follow an avatar.
// Same language as the vira-lata and the shoulder parrot: LimeZu ramps, light from the upper left,
// a solid 1 px navy outline wherever a shape meets empty space. Side walk reuses the praça dog's
// poses (the pack has no dog of its own) and adds a collar so the pet reads as yours. Front, back
// and sit are drawn to the same frame so the follower can face the way it walks.
//
// Strip layout (every frame is PET_W × PET_H, feet on the bottom row, side views face east):
//   0–3  walkE    4–7 walkS    8–11 walkN    12–13 idleS (front, blink)
//   14 sitE    15 sitS    16 sitN    17 lieE    18 lieS    19 lieN
import { blank, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { blank as paintBlank, put, shape, ell, box, or, NAVY } from './paint.mjs';
import { dogWalk } from './dog.mjs';

export const PET_W = 24;
export const PET_H = 20;

/** Inclusive frame ranges. West is walkE / sitE flipped. */
export const PET_ANIMS = {
  walkE: [0, 3],
  walkS: [4, 7],
  walkN: [8, 11],
  idleS: [12, 13],
  sitE: [14, 14],
  sitS: [15, 15],
  sitN: [16, 16],
  lieE: [17, 17],
  lieS: [18, 18],
  lieN: [19, 19],
};

const COAT = ['#a9764f', '#c78c59', '#daa463', '#f2bd7a'];
const FAR = ['#8a5a38', '#a9764f', '#c78c59', '#daa463'];
const CREAM = ['#d9b98a', '#e8cf9f', '#f6e3b8', '#fff2d0'];
const EAR = '#b5754d';
const COLLAR = '#d4a017';
const COLLAR_HI = '#f2c230';
const NOSE = '#2a2233';
const EYE = '#2a2233';
const EYE_SOFT = '#46465e';

const GINGER = ['#8f4f1a', '#c47a2a', '#e0913f', '#f0b060'];
const GINGER_FAR = ['#6e3c14', '#8f4f1a', '#c47a2a', '#e0913f'];
const GINGER_HI = '#f8d896';
const PINK = '#f4b4c4';
const PINK_DEEP = '#e07070';
const STRIPE = '#8f4f1a';

const tri = (ax, ay, bx, by, cx, cy) => (x, y) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

/** Where a coat pixel meets empty space, lay down the missing 1 px navy edge (the stray's snout is clipped by its frame). */
function sealOutline(img) {
  const isNavy = (x, y) => {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h || !img.data[(y * img.w + x) * 4 + 3]) return false;
    const i = (y * img.w + x) * 4;
    return img.data[i] === 0x3a && img.data[i + 1] === 0x3a && img.data[i + 2] === 0x50;
  };
  const isCoat = (x, y) => {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h || !img.data[(y * img.w + x) * 4 + 3]) return false;
    return !isNavy(x, y);
  };
  const add = [];
  const eat = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!isCoat(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) eat.push([x, y]);
      else if (!img.data[(ny * img.w + nx) * 4 + 3]) add.push([nx, ny]);
    }
  }
  for (const [x, y] of add) put(img, x, y, NAVY);
  for (const [x, y] of eat) if (isCoat(x, y)) put(img, x, y, NAVY);
  return img;
}

function fit(img) {
  if (img.w === PET_W && img.h === PET_H) return img;
  const out = paintBlank(PET_W, PET_H);
  paste(out, img, Math.floor((PET_W - img.w) / 2), PET_H - img.h);
  return out;
}

/** Mustard collar on the vira-lata neck, so the follower is not the praça stray. */
function collarSide(img) {
  // neck sits just left of the muzzle, a few rows above the chest (the stray's own frame, bottom-aligned)
  const y = PET_H - 17;
  for (const [x, yy, c] of [
    [13, 7, COLLAR],
    [14, 7, COLLAR_HI],
    [14, 8, COLLAR],
    [15, 8, COLLAR],
  ]) {
    put(img, x, y + yy, c);
  }
  return img;
}

function leg(img, x, y0, y1, ramp, sock = CREAM[2]) {
  if (y1 - y0 < 1.2) return;
  shape(img, box(x, y0, x + 2, y1), [x + 1, (y0 + y1) / 2, 1.15, (y1 - y0) / 2], ramp, { ol: NAVY, t: [0.95, 0.42, -0.05] });
  const px = Math.floor(x);
  const py = Math.floor(y1) - 1;
  put(img, px, py, sock);
  put(img, px + 1, py, ramp[0]);
}

function eye(img, x, y, blink) {
  if (blink) {
    put(img, x, y, EYE);
    put(img, x + 1, y, EYE);
    return;
  }
  put(img, x, y, EYE);
  put(img, x, y - 1, EYE_SOFT);
  put(img, x - 1, y - 1, '#ffffff');
}

// ------------------------------------------------------------------ dog, front (south) and back (north)

function dogFront(phase, o = {}) {
  const img = paintBlank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0);
  // ears (behind the skull), skull, muzzle, then the chest tucked under the chin so the head is attached
  shape(img, tri(7.2, 7 + yb, 5.4, 1.2 + yb, 10.6, 6.2 + yb), [8, 4 + yb, 2.6, 3], FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(13.4, 7 + yb, 16.6, 1.2 + yb, 18.8, 6.2 + yb), [16.2, 4 + yb, 2.6, 3], COAT, { ol: NAVY, t: [0.88, 0.38, 0] });
  shape(img, ell(12, 8.2 + yb, 5.4, 4.3), [12, 8.2 + yb, 5.4, 4.3], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  put(img, 8, 3 + yb, EAR);
  put(img, 8, 4 + yb, EAR);
  put(img, 16, 3 + yb, EAR);
  put(img, 15, 4 + yb, EAR);
  shape(img, ell(12, 11.2 + yb, 3.1, 2.3), [12, 11.2 + yb, 3.1, 2.3], CREAM, { ol: NAVY, t: [0.9, 0.42, 0] });
  // chest overlaps the chin
  const chest = sit ? ell(12, 15.2 + yb, 5.6, 2.6) : ell(12, 14.6 + yb, 4.8, 3.1);
  shape(img, chest, [12, sit ? 15.2 + yb : 14.6 + yb, sit ? 5.6 : 4.8, sit ? 2.6 : 3.1], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  put(img, 11, 13 + yb, COLLAR_HI);
  put(img, 12, 13 + yb, COLLAR);
  put(img, 13, 13 + yb, COLLAR);
  if (sit) {
    // haunches and two front paws together
    shape(img, ell(12, 17.2, 6.2, 1.8), [12, 17.2, 6.2, 1.8], COAT, { ol: NAVY, t: [0.9, 0.4, 0] });
    shape(img, ell(10.2, 17.6, 1.5, 1.3), [10.2, 17.6, 1.5, 1.3], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
    shape(img, ell(13.8, 17.6, 1.5, 1.3), [13.8, 17.6, 1.5, 1.3], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  } else {
    const liftL = phase === 1 ? 1.4 : 0;
    const liftR = phase === 2 ? 1.4 : 0;
    leg(img, 8.2, 15.2 + yb, 19.2 - liftL, COAT);
    leg(img, 13.6, 15.2 + yb, 19.2 - liftR, COAT);
    // a hint of the back paws
    put(img, 7, 18, FAR[1]);
    put(img, 16, 18, FAR[1]);
    put(img, 7, 17, NAVY);
    put(img, 16, 17, NAVY);
  }
  eye(img, 9, 8 + yb, o.blink);
  eye(img, 14, 8 + yb, o.blink);
  put(img, 11, 11 + yb, NOSE);
  put(img, 12, 11 + yb, NOSE);
  put(img, 12, 12 + yb, CREAM[0]);
  if (o.tongue) {
    put(img, 12, 13 + yb, PINK_DEEP);
    put(img, 12, 14 + yb, PINK);
  }
  return img;
}

function dogBack(phase, o = {}) {
  const img = paintBlank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0);
  // tail first, curling over the rump, then the back covers its root
  const wag = [0, -1, 0, 1][phase] ?? 0;
  shape(img, ell(15 + wag * 0.3, 8.5 + yb, 2.4, 2.6), [15, 8.5 + yb, 2.4, 2.6], COAT, { ol: NAVY, t: [0.88, 0.4, 0] });
  put(img, 16 + wag, 7 + yb, CREAM[2]);
  shape(img, tri(7.4, 7.2 + yb, 5.6, 1.4 + yb, 10.4, 6.4 + yb), [8, 4 + yb, 2.4, 3], FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(13.2, 7.2 + yb, 16.2, 1.4 + yb, 18.4, 6.4 + yb), [16, 4 + yb, 2.4, 3], COAT, { ol: NAVY, t: [0.88, 0.38, 0] });
  shape(img, ell(11.6, 8.4 + yb, 4.6, 3.6), [11.6, 8.4 + yb, 4.6, 3.6], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  const body = sit ? ell(12, 14.8 + yb, 5.8, 2.8) : ell(12, 13.8 + yb, 5.2, 3.4);
  shape(img, body, [12, sit ? 14.8 + yb : 13.8 + yb, sit ? 5.8 : 5.2, sit ? 2.8 : 3.4], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  // darker saddle
  for (const [x, yy] of [[9, 12], [10, 11], [11, 11], [12, 12], [13, 12]]) put(img, x, yy + yb, COAT[1]);
  if (sit) {
    shape(img, ell(12, 17.4, 6.4, 1.7), [12, 17.4, 6.4, 1.7], COAT, { ol: NAVY, t: [0.9, 0.4, 0] });
    put(img, 8, 17, CREAM[1]);
    put(img, 15, 17, CREAM[1]);
  } else {
    const liftL = phase === 1 ? 1.4 : 0;
    const liftR = phase === 2 ? 1.4 : 0;
    leg(img, 8, 15 + yb, 19.2 - liftL, FAR);
    leg(img, 13.4, 15 + yb, 19.2 - liftR, COAT);
  }
  return img;
}

function dogSitSide() {
  const img = paintBlank(PET_W, PET_H);
  // tail wrapped along the haunch, then the seated body, then the head (overlaps the chest)
  shape(img, ell(6.2, 13.5, 2.6, 3.2), [6.2, 13.5, 2.6, 3.2], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  put(img, 5, 11, CREAM[2]);
  put(img, 4, 12, CREAM[1]);
  shape(img, or(ell(10.5, 14.2, 5.2, 3.4), ell(13.2, 15.6, 3.2, 2.4)), [10.5, 14.6, 6, 3.6], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  // front leg, straight
  leg(img, 14.2, 14.2, 19.2, COAT);
  // haunch on the ground
  shape(img, ell(8.4, 17.2, 3.4, 1.6), [8.4, 17.2, 3.4, 1.6], COAT, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(16.2, 8.2, 18.2, 2.2, 21.2, 7.6), [18.6, 5.2, 2.4, 3.2], COAT, { ol: NAVY, t: [0.88, 0.36, 0] });
  shape(img, ell(18.2, 9.6, 4.2, 3.8), [18.2, 9.6, 4.2, 3.8], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, ell(21.2, 11.4, 2.3, 1.9), [21.2, 11.4, 2.3, 1.9], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 19, 4, EAR);
  put(img, 19, 5, EAR);
  eye(img, 19, 8, false);
  put(img, 22, 11, NOSE);
  put(img, 21, 11, EYE_SOFT);
  put(img, 15, 12, COLLAR);
  put(img, 16, 12, COLLAR_HI);
  return img;
}

/** On its side, chin toward the paws, collar still visible. Head to the right (east). */
function dogLieSide() {
  const img = paintBlank(PET_W, PET_H);
  shape(img, ell(4.6, 15.2, 2.8, 2.2), [4.6, 15.2, 2.8, 2.2], COAT, { ol: NAVY, t: [0.88, 0.4, 0] });
  put(img, 3, 14, CREAM[2]);
  shape(img, ell(11.2, 15.4, 6.6, 3.0), [11.2, 15.4, 6.6, 3.0], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  for (const [x, y] of [[8, 13], [9, 13], [10, 13], [11, 13], [12, 14]]) put(img, x, y, COAT[1]);
  put(img, 14, 16, CREAM[2]);
  put(img, 15, 16, CREAM[3]);
  shape(img, ell(18.0, 14.2, 3.8, 3.2), [18.0, 14.2, 3.8, 3.2], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, tri(16.6, 12.2, 18.4, 7.2, 20.4, 12.0), [18.4, 9.6, 1.8, 2.6], COAT, { ol: NAVY, t: [0.88, 0.36, 0] });
  put(img, 18, 9, EAR);
  put(img, 19, 9, EAR);
  shape(img, ell(21.2, 15.2, 2.2, 1.7), [21.2, 15.2, 2.2, 1.7], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 22, 15, NOSE);
  eye(img, 19, 13, false);
  shape(img, ell(19.6, 17.6, 2.8, 1.2), [19.6, 17.6, 2.8, 1.2], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  put(img, 15, 14, COLLAR_HI);
  put(img, 15, 15, COLLAR);
  return img;
}

/** Belly down, facing the camera, paws stretched out in front. */
function dogLieFront() {
  const img = paintBlank(PET_W, PET_H);
  shape(img, ell(12, 15.6, 6.8, 2.8), [12, 15.6, 6.8, 2.8], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  shape(img, ell(12, 12.6, 4.2, 3.0), [12, 12.6, 4.2, 3.0], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, ell(7.8, 13.2, 2.2, 1.5), [7.8, 13.2, 2.2, 1.5], FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, ell(16.2, 13.0, 2.2, 1.5), [16.2, 13.0, 2.2, 1.5], COAT, { ol: NAVY, t: [0.88, 0.38, 0] });
  shape(img, ell(12, 14.2, 2.4, 1.6), [12, 14.2, 2.4, 1.6], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, ell(9.4, 17.8, 2.0, 1.15), [9.4, 17.8, 2.0, 1.15], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  shape(img, ell(14.6, 17.8, 2.0, 1.15), [14.6, 17.8, 2.0, 1.15], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  eye(img, 10, 12, false);
  eye(img, 13, 12, false);
  put(img, 11, 14, NOSE);
  put(img, 12, 14, NOSE);
  put(img, 11, 15, COLLAR_HI);
  put(img, 12, 15, COLLAR);
  put(img, 13, 15, COLLAR);
  return img;
}

/** The same lie seen from behind: tail, back, flopped ears, no face. */
function dogLieBack() {
  const img = paintBlank(PET_W, PET_H);
  shape(img, ell(6.2, 14.6, 2.4, 2.0), [6.2, 14.6, 2.4, 2.0], COAT, { ol: NAVY, t: [0.88, 0.4, 0] });
  put(img, 5, 13, CREAM[2]);
  shape(img, ell(12.2, 15.6, 6.2, 2.8), [12.2, 15.6, 6.2, 2.8], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  shape(img, ell(12.2, 12.8, 3.6, 2.4), [12.2, 12.8, 3.6, 2.4], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, ell(8.8, 13.4, 1.8, 1.3), [8.8, 13.4, 1.8, 1.3], FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, ell(15.6, 13.2, 1.8, 1.3), [15.6, 13.2, 1.8, 1.3], COAT, { ol: NAVY, t: [0.88, 0.38, 0] });
  for (const [x, y] of [[10, 14], [11, 14], [12, 14], [13, 14], [12, 15]]) put(img, x, y, COAT[1]);
  return img;
}

// ------------------------------------------------------------------ cat

function catEye(img, x, y, blink) {
  if (blink) {
    put(img, x, y, EYE);
    put(img, x + 1, y, EYE);
    return;
  }
  put(img, x, y, EYE);
  put(img, x, y - 1, '#ffffff');
}

function stripes(img, pts, yb = 0) {
  for (const [x, y] of pts) put(img, x, y + yb, STRIPE);
}

function catFront(phase, o = {}) {
  const img = paintBlank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0);
  // tall ears, then the head covering their base, then a slim chest
  shape(img, tri(8.2, 8 + yb, 7.2, 1.2 + yb, 11.2, 7.2 + yb), [9.2, 4.4 + yb, 2, 3.4], GINGER_FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(12.8, 8 + yb, 16.6, 1.2 + yb, 17.2, 7.2 + yb), [15.2, 4.4 + yb, 2, 3.4], GINGER, { ol: NAVY, t: [0.88, 0.38, 0] });
  put(img, 9, 3 + yb, PINK);
  put(img, 9, 4 + yb, PINK);
  put(img, 15, 3 + yb, PINK);
  put(img, 15, 4 + yb, PINK_DEEP);
  shape(img, ell(12, 9.4 + yb, 4.6, 3.8), [12, 9.4 + yb, 4.6, 3.8], GINGER, { ol: NAVY, t: [0.84, 0.4, 0] });
  stripes(img, [[10, 7], [11, 6], [13, 6], [14, 7]], yb);
  shape(img, ell(12, 12 + yb, 2.2, 1.6), [12, 12 + yb, 2.2, 1.6], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  const chest = sit ? ell(12, 15.4 + yb, 4.4, 2.4) : ell(12, 14.6 + yb, 3.6, 2.8);
  shape(img, chest, [12, sit ? 15.4 + yb : 14.6 + yb, sit ? 4.4 : 3.6, sit ? 2.4 : 2.8], GINGER, { ol: NAVY, t: [0.86, 0.4, 0] });
  // cream bib
  put(img, 12, 14 + yb, CREAM[3]);
  put(img, 11, 15 + yb, CREAM[2]);
  put(img, 12, 15 + yb, CREAM[3]);
  put(img, 13, 15 + yb, CREAM[2]);
  // tail curling out to the side so a front view still reads as a cat
  const tx = sit ? 17 : 17;
  shape(img, ell(tx, 13.2 + yb, 1.7, 3.2), [tx, 13.2 + yb, 1.7, 3.2], GINGER, { ol: NAVY, t: [0.88, 0.4, 0] });
  put(img, tx, 11 + yb, GINGER_HI);
  if (sit) {
    shape(img, ell(12, 17.4, 5.2, 1.6), [12, 17.4, 5.2, 1.6], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
    shape(img, ell(10.6, 17.6, 1.3, 1.1), [10.6, 17.6, 1.3, 1.1], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
    shape(img, ell(13.4, 17.6, 1.3, 1.1), [13.4, 17.6, 1.3, 1.1], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  } else {
    const liftL = phase === 1 ? 1.6 : 0;
    const liftR = phase === 2 ? 1.6 : 0;
    leg(img, 9.2, 15.4 + yb, 19.2 - liftL, GINGER, CREAM[2]);
    leg(img, 12.6, 15.4 + yb, 19.2 - liftR, GINGER, CREAM[2]);
  }
  catEye(img, 10, 9 + yb, o.blink);
  catEye(img, 14, 9 + yb, o.blink);
  put(img, 12, 11 + yb, PINK_DEEP);
  put(img, 11, 12 + yb, PINK);
  return img;
}

function catBack(phase, o = {}) {
  const img = paintBlank(PET_W, PET_H);
  const bob = phase % 2 ? -1 : 0;
  const sit = !!o.sit;
  const yb = bob + (sit ? 1 : 0);
  const wag = [0, 1, 0, -1][phase] ?? 0;
  // tail held up, the thing you see first from behind
  shape(img, box(11 + wag, 2 + yb, 13 + wag, 9 + yb), [12 + wag, 5 + yb, 1.2, 3.5], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 12 + wag, 2 + yb, GINGER_HI);
  put(img, 11 + wag, 3 + yb, STRIPE);
  shape(img, tri(8.4, 9 + yb, 7.4, 3.4 + yb, 11, 8.2 + yb), [9, 6 + yb, 1.8, 3], GINGER_FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(13, 9 + yb, 16.4, 3.4 + yb, 16.6, 8.2 + yb), [15, 6 + yb, 1.8, 3], GINGER, { ol: NAVY, t: [0.88, 0.38, 0] });
  shape(img, ell(12, 10.2 + yb, 4.2, 3.2), [12, 10.2 + yb, 4.2, 3.2], GINGER, { ol: NAVY, t: [0.84, 0.4, 0] });
  const body = sit ? ell(12, 15.2 + yb, 4.6, 2.4) : ell(12, 14.4 + yb, 3.8, 2.8);
  shape(img, body, [12, sit ? 15.2 + yb : 14.4 + yb, sit ? 4.6 : 3.8, sit ? 2.4 : 2.8], GINGER, { ol: NAVY, t: [0.86, 0.4, 0] });
  stripes(img, [[10, 13], [12, 12], [14, 13], [11, 15]], yb);
  if (sit) {
    shape(img, ell(12, 17.4, 5.4, 1.6), [12, 17.4, 5.4, 1.6], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
  } else {
    const liftL = phase === 1 ? 1.6 : 0;
    const liftR = phase === 2 ? 1.6 : 0;
    leg(img, 9, 15.2 + yb, 19.2 - liftL, GINGER_FAR, CREAM[1]);
    leg(img, 12.8, 15.2 + yb, 19.2 - liftR, GINGER, CREAM[2]);
  }
  return img;
}

function catSide(phase, o = {}) {
  const img = paintBlank(PET_W, PET_H);
  const bob = o.sit ? 1 : phase % 2 ? -1 : 0;
  const sw = o.sit ? [0, 0, 0, 0] : [[-1, 1, 1, -1], [0, 0, 0, 0], [1, -1, -1, 1], [0, 0, 0, 0]][phase];
  const lift = o.sit ? [0, 0, 0, 0] : [[0, 1.5, 0, 1.5], [0, 0, 0, 0], [1.5, 0, 1.5, 0], [0, 0, 0, 0]][phase];
  // tail up behind the rump
  const wag = o.sit ? 0 : [0, 1, 0, -1][phase];
  shape(img, box(3 + wag, 3 + bob, 5 + wag, 11 + bob), [4 + wag, 7 + bob, 1.15, 4], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 4 + wag, 3 + bob, GINGER_HI);
  put(img, 3 + wag, 5 + bob, STRIPE);
  put(img, 4 + wag, 7 + bob, STRIPE);
  if (!o.sit) {
    leg(img, 7 + sw[1], 13 + bob, 19.2 - lift[1], GINGER_FAR, CREAM[1]);
    leg(img, 14 + sw[3], 13 + bob, 19.2 - lift[3], GINGER_FAR, CREAM[1]);
  }
  shape(img, or(ell(10.2, 12.4 + bob, 5.2, 2.8), ell(14.2, 12.8 + bob, 2.2, 2.4)), [11, 12.4 + bob, 6, 3], GINGER, { ol: NAVY, t: [0.86, 0.4, 0] });
  stripes(img, [[8, 11], [10, 10], [12, 11]], bob);
  put(img, 13, 13 + bob, CREAM[2]);
  put(img, 14, 14 + bob, CREAM[3]);
  if (o.sit) {
    shape(img, ell(8.2, 16.6, 3.2, 1.8), [8.2, 16.6, 3.2, 1.8], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
    leg(img, 14, 13.5, 19.2, GINGER, CREAM[2]);
  } else {
    leg(img, 6 + sw[0], 13 + bob, 19.2 - lift[0], GINGER, CREAM[2]);
    leg(img, 13 + sw[2], 13 + bob, 19.2 - lift[2], GINGER, CREAM[2]);
  }
  shape(img, tri(16.4, 8.4 + bob, 18.2, 2.2 + bob, 20.6, 7.6 + bob), [18.4, 5 + bob, 2.2, 3.2], GINGER, { ol: NAVY, t: [0.88, 0.36, 0] });
  put(img, 18, 4 + bob, PINK);
  put(img, 19, 4 + bob, PINK_DEEP);
  shape(img, ell(18.4, 10 + bob, 3.8, 3.4), [18.4, 10 + bob, 3.8, 3.4], GINGER, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, ell(21.2, 11.6 + bob, 2.1, 1.6), [21.2, 11.6 + bob, 2.1, 1.6], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  stripes(img, [[17, 8]], bob);
  catEye(img, 19, 9 + bob, o.blink);
  put(img, 22, 11 + bob, PINK_DEEP);
  return img;
}

/** Stretched out on its side, tail behind, head to the right. */
function catLieSide() {
  const img = paintBlank(PET_W, PET_H);
  shape(img, ell(4.2, 15.8, 2.6, 1.6), [4.2, 15.8, 2.6, 1.6], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 3, 15, GINGER_HI);
  put(img, 5, 16, STRIPE);
  shape(img, ell(11.2, 15.4, 6.4, 2.6), [11.2, 15.4, 6.4, 2.6], GINGER, { ol: NAVY, t: [0.86, 0.4, 0] });
  stripes(img, [[8, 14], [10, 14], [12, 15]]);
  put(img, 14, 16, CREAM[3]);
  shape(img, ell(18.2, 14.0, 3.6, 3.0), [18.2, 14.0, 3.6, 3.0], GINGER, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, tri(17.2, 11.6, 18.6, 7.6, 20.2, 11.6), [18.6, 9.6, 1.6, 2.2], GINGER, { ol: NAVY, t: [0.88, 0.36, 0] });
  put(img, 18, 9, PINK);
  shape(img, ell(20.8, 15.0, 1.8, 1.4), [20.8, 15.0, 1.8, 1.4], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  catEye(img, 19, 13, false);
  put(img, 22, 15, PINK_DEEP);
  shape(img, ell(16.4, 17.6, 2.2, 1.15), [16.4, 17.6, 2.2, 1.15], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  return img;
}

/** A loaf: paws tucked, ears up, tail curled to the side. */
function catLieFront() {
  const img = paintBlank(PET_W, PET_H);
  shape(img, ell(17.4, 15.8, 2.2, 1.6), [17.4, 15.8, 2.2, 1.6], GINGER, { ol: NAVY, t: [0.88, 0.4, 0] });
  put(img, 18, 15, GINGER_HI);
  shape(img, ell(11.2, 15.6, 5.6, 2.6), [11.2, 15.6, 5.6, 2.6], GINGER, { ol: NAVY, t: [0.86, 0.4, 0] });
  shape(img, ell(11.2, 12.6, 4.0, 2.8), [11.2, 12.6, 4.0, 2.8], GINGER, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, tri(8.6, 11.2, 8.2, 6.8, 11.0, 10.6), [9.2, 9.2, 1.6, 2.4], GINGER_FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(11.4, 11.2, 14.2, 6.8, 14.4, 10.6), [13, 9.2, 1.6, 2.4], GINGER, { ol: NAVY, t: [0.88, 0.38, 0] });
  put(img, 9, 8, PINK);
  put(img, 13, 8, PINK_DEEP);
  stripes(img, [[10, 11], [12, 11]]);
  shape(img, ell(11.2, 17.6, 3.2, 1.15), [11.2, 17.6, 3.2, 1.15], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  catEye(img, 10, 12, false);
  catEye(img, 13, 12, false);
  put(img, 11, 14, PINK_DEEP);
  put(img, 12, 15, CREAM[3]);
  return img;
}

/** Loaf from behind: tail, stripes, the back of the ears. */
function catLieBack() {
  const img = paintBlank(PET_W, PET_H);
  shape(img, ell(6.2, 15.2, 2.0, 2.2), [6.2, 15.2, 2.0, 2.2], GINGER, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 6, 13, GINGER_HI);
  put(img, 6, 15, STRIPE);
  shape(img, ell(12, 15.6, 5.4, 2.6), [12, 15.6, 5.4, 2.6], GINGER, { ol: NAVY, t: [0.86, 0.4, 0] });
  shape(img, ell(12, 12.8, 3.4, 2.4), [12, 12.8, 3.4, 2.4], GINGER, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, tri(9.6, 11.6, 9.4, 7.8, 11.4, 11.2), [10.2, 9.8, 1.4, 2.0], GINGER_FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, tri(12.6, 11.6, 14.8, 7.8, 14.8, 11.2), [13.8, 9.8, 1.4, 2.0], GINGER, { ol: NAVY, t: [0.88, 0.38, 0] });
  stripes(img, [[11, 14], [13, 15], [12, 14]]);
  return img;
}

function dogFrames() {
  const side = [0, 1, 2, 3].map((i) => collarSide(fit(dogWalk(i))));
  const front = [0, 1, 2, 3].map((i) => dogFront(i));
  const back = [0, 1, 2, 3].map((i) => dogBack(i));
  return [...side, ...front, ...back, dogFront(0), dogFront(0, { blink: true }), dogSitSide(), dogFront(0, { sit: true }), dogBack(0, { sit: true }), dogLieSide(), dogLieFront(), dogLieBack()].map(sealOutline);
}

function catFrames() {
  const side = [0, 1, 2, 3].map((i) => catSide(i));
  const front = [0, 1, 2, 3].map((i) => catFront(i));
  const back = [0, 1, 2, 3].map((i) => catBack(i));
  return [...side, ...front, ...back, catFront(0), catFront(0, { blink: true }), catSide(0, { sit: true }), catFront(0, { sit: true }), catBack(0, { sit: true }), catLieSide(), catLieFront(), catLieBack()].map(sealOutline);
}

function strip(frames) {
  const img = blank(PET_W * frames.length, PET_H);
  frames.forEach((frame, i) => paste(img, frame, i * PET_W, 0));
  return img;
}

/** Standalone strips for the world spritesheets (`chars/pet_dog`, `chars/pet_cat`). */
export async function petStrips() {
  const meta = { frames: 20, frameW: PET_W, fps: 8, anims: PET_ANIMS };
  return [
    { key: 'chars/pet_dog', img: strip(dogFrames()), meta },
    { key: 'chars/pet_cat', img: strip(catFrames()), meta },
  ];
}
