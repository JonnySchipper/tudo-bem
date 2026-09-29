// Authored vehicles: fusca (VW Beetle), kombi (VW Type 2), moto (motoboy with a delivery box). The LimeZu pack has none of them.
// art1 made the first pass; art2 redrew all three (the fusca read as a modern taxi, the kombi as a generic van, the moto rider was
// unreadable). Same elevated three-quarter view as the pack's cars: roof plane on top, side face below, the east end turned toward
// the viewer a little. Facing east; the west variant is a mirror (the 1 px lit rim flips, as noted in art1).
// LimeZu palette + brand colors only, light from the upper left, navy outline.
import { blank, put, shape, fillRect, ell, box, or, and, sub, line, ring, NAVY } from './paint.mjs';
import { C, K } from './kit.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';

const WHITE = ['#b2aecb', '#d8d0e0', '#ebe4f2', '#f8f8f8'];
const CHROME = ['#6c6e85', '#a2a6be', '#d8d0e0', '#f8f8f8'];
const GLASS = ['#738ca8', '#a4bbd5', '#bad2e0', '#e2f2f3'];
const TIRE = NAVY;

/** rounded rect predicate */
const rr = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
};
/** polygon predicate (even-odd) */
const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

function disc(img, cx, cy, r, hex) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) put(img, x, y, hex);
  }
}
function wheel(img, cx, cy, r, phase = 0) {
  disc(img, cx, cy, r, TIRE);
  disc(img, cx, cy, r - 1.4, C.navy2);
  disc(img, cx, cy, r - 3, C.slate2);
  disc(img, cx, cy, r - 4.2, C.slate);
  const fx = Math.floor(cx), fy = Math.floor(cy);
  const pts = phase ? [[-1, -1], [0, 0]] : [[0, -1], [-1, 0]];
  for (const [dx, dy] of pts) put(img, fx + dx, fy + dy, C.lav3);
  put(img, fx - 1 + (phase ? 1 : 0), fy - 2 + (phase ? 3 : 0), C.lav4);
}

// ------------------------------------------------------------------ fusca (VW Beetle)
const FUSCA = ['#b99e86', '#d0be9c', '#e6d8b8', '#f6eed6']; // bege
const FUSCA_SHADE = ['#8f7a6c', '#a58f7a', '#c3ac90', '#d6c6a8'];
function fuscaFrame(phase) {
  const W = 60, H = 38;
  const img = blank(W, H);
  const ground = H - 2;
  // 1. wheels first; the fenders overlap them
  for (const cx of [14, 45]) { disc(img, cx, ground - 5.8, 6.2, NAVY); wheel(img, cx, ground - 5.8, 5.2, phase); }
  // 2. body: a long low tub with a round dome cabin. Rear deck slopes down in a curve; the nose is short and rounded.
  const tub = poly([[3, 27], [4, 24], [7, 22], [12, 20.5], [20, 19.5], [32, 19.5], [40, 20], [46, 21], [51, 22.5], [55, 25], [56.5, 28], [55, 31], [4, 31], [2.5, 29]]);
  const dome = (x, y) => ell(26, 22, 14.6, 13.6)(x, y) && y < 22;
  const rearSlope = poly([[6, 22], [10, 15], [16, 10], [24, 8], [30, 8], [8, 24]]);
  shape(img, or(tub, dome, rearSlope), [28, 20, 27, 12], FUSCA, { ol: '#7a6658', t: [0.84, 0.3, -0.05] });
  // 3. fenders: two separate bulges over the wheels (light top-left), with a running board between them
  shape(img, and(ell(46, 26, 11.5, 9), (x, y) => y < 32), [46, 26, 11.5, 9], FUSCA, { ol: '#7a6658', t: [0.84, 0.3, -0.05] });
  shape(img, and(ell(14, 25, 12.5, 9.5), (x, y) => y < 32), [14, 25, 12.5, 9.5], FUSCA, { ol: '#7a6658', t: [0.84, 0.3, -0.05] });
  // wheel arches (dark) reopen the fenders so the tyres show under them
  for (const cx of [14, 45]) {
    disc(img, cx, ground - 5.8, 6.6, NAVY);
    wheel(img, cx, ground - 5.8, 5.4, phase);
  }
  // running board between the wheels: dark strip with a chrome edge
  fillRect(img, 21, 28, 17, 3, NAVY); fillRect(img, 21, 28, 17, 1, CHROME[2]); fillRect(img, 22, 29, 15, 1, C.navy2); fillRect(img, 21, 30, 17, 1, C.slate);
  // 4. windows: one dome-shaped side window with a B-pillar, a small rear window, a windscreen ahead of the dome
  const win = (x, y) => ell(26, 22, 12, 10.6)(x, y) && y < 22 && y > 12.4;
  shape(img, and(win, (x) => x < 25.2), [20, 18, 6, 6], GLASS, { ol: '#7a6658', t: [0.9, 0.35, -0.2] });
  shape(img, and(win, (x) => x >= 26.4), [32, 18, 6, 6], GLASS, { ol: '#7a6658', t: [0.9, 0.35, -0.2] });
  shape(img, poly([[13.5, 21], [14.5, 15.5], [17.5, 12.5], [19.5, 12.5], [19, 21]]), [16, 17, 3, 4], GLASS, { ol: '#7a6658', t: [0.9, 0.35, -0.2] });
  // windscreen: slanted quad in front of the dome
  shape(img, poly([[38.6, 21.5], [35.5, 14.5], [40.5, 16.5], [44.5, 21.8]]), [40, 19, 4, 3], GLASS, { ol: '#7a6658', t: [0.9, 0.35, -0.2] });
  // door line, handle, side crease
  for (let y = 21; y < 28; y++) put(img, 25, y, FUSCA_SHADE[1]);
  put(img, 23, 24, CHROME[2]); put(img, 24, 24, CHROME[1]);
  for (let x = 23; x < 38; x++) put(img, x, 27, FUSCA_SHADE[1]);
  // 5. round headlight standing on the front fender, chrome ring; bumpers with over-riders; tail light
  disc(img, 53.4, 23.4, 2.9, NAVY); disc(img, 53.4, 23.4, 2.1, CHROME[2]); disc(img, 53.4, 23.4, 1.3, '#fff59a'); put(img, 53, 22, '#ffffff');
  fillRect(img, 53, 29, 6, 2, NAVY); fillRect(img, 53, 29, 5, 1, CHROME[3]); fillRect(img, 53, 30, 5, 1, CHROME[0]);
  fillRect(img, 0, 28, 6, 2, NAVY); fillRect(img, 1, 28, 5, 1, CHROME[3]); fillRect(img, 1, 29, 5, 1, CHROME[0]);
  put(img, 3, 25, C.r2); put(img, 3, 26, C.r4); put(img, 4, 25, C.r0);
  // hood ridge + trunk seam hint
  for (let x = 47; x < 54; x++) put(img, x, 26 + Math.floor((x - 47) / 4), FUSCA_SHADE[1]);
  return img;
}

export async function fusca() {
  const f = [fuscaFrame(0), fuscaFrame(1)];
  const meta = { footprint: [3, 1], shadow: 'fx/shadow_48' };
  return [
    { key: 'vehicles/fusca_e', frames: f, fps: 8, anchor: [30, 34], meta },
    { key: 'vehicles/fusca_w', frames: f.map(flipH), fps: 8, anchor: [29, 34], meta },
  ];
}

// ------------------------------------------------------------------ kombi (VW Type 2): white over turquoise, split windscreen, V nose
const TEAL = ['#2e7177', '#3f8f8f', '#5ea592', '#8ccfc0'];
const TEAL_SHADE = ['#22575c', '#2e7177', '#468a86', '#5ea592'];
const WHITE_SHADE = ['#8f8bb0', '#b2aecb', '#d0c8de', '#e6dff0'];
function kombiFrame(phase) {
  const W = 68, H = 46;
  const img = blank(W, H);
  const ground = H - 2;
  const wy = ground - 6.6;
  // wheels behind everything; arches cut into the lower body later
  for (const cx of [15, 44]) { disc(img, cx, wy, 7, NAVY); wheel(img, cx, wy, 6, phase); }
  // side face: white upper band over the turquoise lower body
  shape(img, rr(4, 13, 52, 38, 3.2), [28, 25, 24, 13], TEAL, { ol: '#22575c', t: [0.86, 0.34, -0.1] });
  shape(img, rr(4, 13, 52, 24, 3), [28, 18, 24, 6], WHITE, { ol: '#7a7a95', t: [0.9, 0.3, -0.3] });
  // roof: a white plane seen from above, with a lit top-left rim and a gutter line
  shape(img, rr(5, 2, 53, 14.5, 4), [29, 8, 24, 6.5], WHITE, { ol: '#7a7a95', t: [0.8, 0.28, -0.25] });
  fillRect(img, 9, 13, 42, 1, WHITE_SHADE[0]); fillRect(img, 9, 12, 42, 1, WHITE_SHADE[1]);
  for (const [x, y] of [[12, 5], [13, 5], [14, 5], [24, 4], [25, 4], [26, 4]]) put(img, x, y, WHITE[3]);
  // roof vent + ridge
  fillRect(img, 30, 6, 6, 3, WHITE_SHADE[1]); fillRect(img, 30, 6, 6, 1, WHITE[3]); fillRect(img, 30, 8, 6, 1, WHITE_SHADE[0]);
  // side windows: three sliding panes and the cab door window, white pillars between
  for (const [x0, x1] of [[8, 17], [20, 29], [32, 41]]) {
    shape(img, box(x0, 15, x1, 22), [(x0 + x1) / 2, 18, 4.5, 3.5], GLASS, { ol: '#7a7a95', t: [0.9, 0.35, -0.3] });
    put(img, x0 + 1, 16, GLASS[3]); put(img, x0 + 2, 17, GLASS[3]);
  }
  shape(img, rr(44, 14.5, 51, 22, 2.4), [47, 18, 3.5, 3.6], GLASS, { ol: '#7a7a95', t: [0.9, 0.35, -0.3] });
  put(img, 45, 16, GLASS[3]); put(img, 45, 17, GLASS[3]);
  // chrome belt strip and lower panel details: crease, door seams, handle, engine vents, tail light
  fillRect(img, 5, 24, 46, 1, CHROME[3]); fillRect(img, 5, 25, 46, 1, CHROME[1]);
  fillRect(img, 6, 31, 44, 1, TEAL[0]);
  for (let y = 26; y < 36; y++) { put(img, 30, y, TEAL[0]); put(img, 43, y, TEAL[0]); }
  fillRect(img, 39, 28, 3, 1, CHROME[2]); put(img, 39, 29, CHROME[0]);
  for (const y of [28, 30, 32]) fillRect(img, 6, y, 5, 1, TEAL[0]);
  fillRect(img, 4, 27, 2, 5, C.r3); put(img, 4, 27, C.r0); put(img, 5, 31, C.r5);
  // running board (a lit chrome-edged step between the arches) and rear bumper
  fillRect(img, 22, 36, 13, 2, NAVY); fillRect(img, 23, 36, 11, 1, CHROME[2]); fillRect(img, 23, 37, 11, 1, C.slate);
  fillRect(img, 2, 36, 6, 3, NAVY); fillRect(img, 3, 36, 4, 1, CHROME[3]); fillRect(img, 3, 37, 4, 1, CHROME[1]);
  // arches: the body is cut round the wheels so the tyres read
  for (const cx of [15, 44]) { disc(img, cx, wy, 7.4, NAVY); wheel(img, cx, wy, 6.2, phase); }
  // ---- the east end, turned toward the viewer: split windscreen, V-shaped two-tone nose, round headlights, bumper
  // front face (in shade, since light comes from the upper left)
  shape(img, rr(52, 4, 66, 40, 3), [59, 22, 7, 18], TEAL_SHADE, { ol: '#1a3f45', t: [1.5, 1.0, 0.4] });
  // windscreen: two panes split by a centre post, white frame
  shape(img, rr(52.5, 4.5, 65.5, 19, 2.6), [59, 12, 6.5, 7], WHITE_SHADE, { ol: '#6a6690', t: [1.5, 1.0, 0.4] });
  shape(img, box(54, 6.5, 58.3, 17), [56, 12, 2, 5], GLASS, { ol: '#6a6690', t: [0.9, 0.35, -0.3] });
  shape(img, box(59.7, 6.5, 64, 17), [62, 12, 2, 5], GLASS, { ol: '#6a6690', t: [0.9, 0.35, -0.3] });
  put(img, 55, 7, GLASS[3]); put(img, 55, 8, GLASS[3]); put(img, 60, 7, GLASS[3]); put(img, 61, 8, GLASS[3]);
  // the V: a white wedge pointing down on the turquoise nose, with the emblem at its point
  const V = poly([[53.5, 20], [64.5, 20], [59, 31]]);
  shape(img, V, [59, 24, 5.5, 5.5], WHITE_SHADE, { ol: '#1a3f45', t: [1.5, 1.0, 0.4] });
  for (let i = 0; i < 4; i++) { put(img, 55 + i, 21 + i, WHITE_SHADE[3]); }
  disc(img, 59, 26.2, 1.8, NAVY); disc(img, 59, 26.2, 1.1, C.lav4); put(img, 59, 26, C.navy2);
  // headlights (round, one each side of the V), chrome bumper with a dip in the middle
  for (const cx of [54.6, 63.4]) { disc(img, cx, 33, 2.5, NAVY); disc(img, cx, 33, 1.8, CHROME[2]); disc(img, cx, 33, 1.1, '#fff59a'); put(img, Math.floor(cx) - 1, 32, '#ffffff'); }
  fillRect(img, 52, 37, 15, 3, NAVY); fillRect(img, 53, 37, 13, 1, CHROME[3]); fillRect(img, 53, 38, 13, 1, CHROME[1]); fillRect(img, 53, 39, 13, 1, CHROME[0]);
  return img;
}

export async function kombi() {
  const f = [kombiFrame(0), kombiFrame(1)];
  const meta = { footprint: [4, 2], shadow: 'fx/shadow_48' };
  return [
    { key: 'vehicles/kombi_e', frames: f, fps: 8, anchor: [34, 42], meta },
    { key: 'vehicles/kombi_w', frames: f.map(flipH), fps: 8, anchor: [33, 42], meta },
  ];
}

// ------------------------------------------------------------------ moto (motoboy)
const JACKET = [C.y5, C.y4, C.y3, C.y1];
const TANK = ['#2a2f7c', C.b4, C.b3, C.b1];
const BOX = ['#7a1c20', C.r4, C.r2, C.r0];
function motoFrame(phase) {
  const W = 44, H = 34;
  const img = blank(W, H);
  const gy = 33;
  const rw = [9.5, 26], fw = [34.5, 26];
  const JEANS = ['#2a3e8f', C.b4, C.b3, C.b2];
  const JACK = ['#c46823', C.y4, C.y3, C.y1];
  const RED = ['#7a1c20', C.r4, C.r2, C.r0];
  const SILVER = ['#565972', '#6c6e85', '#8b8bab', '#b2aecb'];
  // wheels (big, chunky) behind the bike
  for (const [cx, cy] of [rw, fw]) { disc(img, cx, cy, 7, NAVY); wheel(img, cx, cy, 6, phase); }
  // exhaust: a long pipe from the engine to the rear, chrome tip
  line(img, 15, 29, 3, 27, NAVY); line(img, 15, 28, 3, 26, CHROME[1]); line(img, 15, 27, 4, 25, CHROME[2]);
  fillRect(img, 1, 25, 3, 3, NAVY); fillRect(img, 1, 26, 2, 1, CHROME[3]);
  // swing arm + engine block with cooling fins
  line(img, rw[0], rw[1], 17, 25, NAVY); line(img, rw[0], rw[1] - 1, 17, 24, SILVER[1]);
  shape(img, rr(15, 19.5, 26.5, 30, 1.6), [21, 25, 5.5, 5], SILVER, { ol: NAVY, t: [0.85, 0.3, -0.1] });
  for (const y of [22, 24, 26]) fillRect(img, 16, y, 9, 1, SILVER[0]);
  fillRect(img, 17, 28, 7, 1, NAVY); put(img, 18, 29, CHROME[3]);
  // rear fender over the rear wheel + tail light
  shape(img, poly([[3, 19.5], [16, 17.5], [16.5, 19.5], [4, 21.5]]), [10, 19, 6, 2], RED, { ol: NAVY, t: [0.85, 0.3, -0.1] });
  put(img, 2, 21, C.r2); put(img, 2, 22, C.r0);
  // rack and the delivery box (bau): red, lit top-left rim, lid seam, mustard band, a reflective patch
  fillRect(img, 3, 16, 12, 2, NAVY); fillRect(img, 4, 16, 10, 1, SILVER[1]);
  shape(img, rr(0, 2.5, 14, 16.5, 2), [7, 9.5, 7, 7], RED, { ol: NAVY, t: [0.86, 0.34, -0.1] });
  fillRect(img, 1, 6, 12, 1, RED[0]); fillRect(img, 1, 5, 12, 1, RED[3]);
  fillRect(img, 1, 9, 12, 3, C.y3); fillRect(img, 1, 9, 12, 1, C.y1); fillRect(img, 1, 11, 12, 1, C.y4);
  fillRect(img, 4, 13, 6, 1, WHITE[2]); put(img, 4, 13, WHITE[3]);
  // front fork, fender and headlight
  line(img, 31, 14, fw[0], fw[1], NAVY); line(img, 32, 14, fw[0] + 1, fw[1], SILVER[1]); line(img, 31, 15, fw[0], fw[1] - 1, CHROME[1]);
  shape(img, poly([[30, 19.5], [40, 20], [41, 22], [31, 21.5]]), [35, 20, 5, 1.5], RED, { ol: NAVY, t: [0.85, 0.3, -0.1] });
  disc(img, 37.5, 16.4, 2.9, NAVY); disc(img, 37.5, 16.4, 2.2, CHROME[2]); disc(img, 37.5, 16.4, 1.4, '#fff59a'); put(img, 36, 15, '#ffffff');
  // fuel tank (red) and the dark seat
  shape(img, rr(23.5, 13, 32.5, 19.5, 3), [28, 16, 4.5, 3.3], RED, { ol: NAVY, t: [0.85, 0.32, -0.1] });
  put(img, 25, 14, RED[3]); put(img, 26, 14, RED[3]); put(img, 24, 15, RED[3]);
  shape(img, rr(14, 16, 24, 19.5, 1.6), [19, 17.5, 5, 2], ['#26263a', C.navy2, C.slate, SILVER[1]], { ol: NAVY, t: [0.85, 0.3, -0.1] });
  // ---- rider: jeans (thigh + shin + boot), jacket, sleeve + glove, white helmet with a dark visor
  shape(img, poly([[14, 15.5], [21, 14.5], [29, 19.5], [27, 23], [19, 19.5]]), [22, 19, 6, 4], JEANS, { ol: NAVY, t: [0.85, 0.3, -0.1] }); // thigh
  shape(img, poly([[25, 20.5], [29.5, 20], [27.5, 27], [23.5, 27]]), [26.5, 24, 2.5, 3.5], JEANS, { ol: NAVY, t: [0.9, 0.35, -0.1] }); // shin
  shape(img, rr(22, 26, 29.5, 29.5, 1.2), [26, 27.5, 3.5, 1.7], ['#1c1c30', C.navy2, C.slate, SILVER[1]], { ol: NAVY, t: [0.9, 0.3, -0.2] }); // boot
  shape(img, poly([[15, 8.5], [24, 8], [27, 11.5], [23, 17.5], [14, 17]]), [20, 13, 6, 5], JACK, { ol: NAVY, t: [0.86, 0.32, -0.1] }); // jacket
  fillRect(img, 15, 13, 10, 1, WHITE[2]); put(img, 15, 13, WHITE[3]); put(img, 16, 14, WHITE[1]); // reflective stripe
  for (const [x, y] of [[16, 10], [17, 9], [16, 11]]) put(img, x, y, JACK[3]);
  shape(img, poly([[23, 10], [26, 10], [31, 12.5], [30.5, 15], [26, 13]]), [27.5, 12.5, 3.5, 2.5], JACK, { ol: NAVY, t: [0.9, 0.34, -0.1] }); // sleeve to the grip
  shape(img, rr(30, 11.5, 33.5, 15, 1.2), [32, 13, 1.7, 1.7], ['#1c1c30', C.navy2, C.slate, SILVER[1]], { ol: NAVY, t: [0.9, 0.3, -0.2] }); // glove
  line(img, 33, 11, 34, 7, NAVY); put(img, 34, 6, CHROME[2]); put(img, 33, 6, NAVY); // handlebar mirror
  shape(img, ell(20.6, 4.8, 5.3, 4.6), [20.6, 4.8, 5.3, 4.6], WHITE, { ol: NAVY, t: [0.84, 0.3, -0.1] }); // helmet
  for (let x = 16; x < 26; x++) if (Math.abs(x - 20.6) < 5) put(img, x, 3, C.r2);
  put(img, 17, 2, WHITE[3]); put(img, 18, 1, WHITE[3]);
  shape(img, poly([[23.6, 2.8], [26.6, 4], [26.6, 8], [23.8, 8]]), [25.2, 5.4, 2, 2.5], ['#1c1c30', C.navy2, C.slate, SILVER[1]], { ol: NAVY, t: [0.9, 0.35, -0.3] }); // visor
  put(img, 25, 4, '#b2aecb'); put(img, 25, 5, '#b2aecb');
  fillRect(img, 17, 8, 5, 1, WHITE[0]);
  return img;
}

export async function moto() {
  const f = [motoFrame(0), motoFrame(1)];
  const meta = { footprint: [2, 1], shadow: 'fx/shadow_32' };
  return [
    { key: 'vehicles/moto_e', frames: f, fps: 10, anchor: [22, 32], meta },
    { key: 'vehicles/moto_w', frames: f.map(flipH), fps: 10, anchor: [21, 32], meta },
  ];
}

export async function preview(which = 'all') {
  const out = [];
  if (which === 'all' || which === 'fusca') out.push(fuscaFrame(0), fuscaFrame(1));
  if (which === 'all' || which === 'kombi') out.push(kombiFrame(0), kombiFrame(1));
  if (which === 'all' || which === 'moto') out.push(motoFrame(0), motoFrame(1));
  return out;
}
void ring; void sub; void K;
