// The title screen's parrot flock in pixel art (V4): two species in flight, side view facing right, 4 wing-beat frames each, 30 x 22 px per frame
// (`flock/papagaio_strip`, `flock/arara_strip`, standalone DOM strips like `chars/parrot_strip`). They replace the smooth vector birds that flew over the
// pixel Vila Ipê. Same language as the poleiro parrot: a navy sel-out outline, light from the upper left (rim-lit edges), the pack's greens and
// yellows plus the brand mustard and terracotta. Built from shapes (body, head, tail, a near and a far wing), shaded by neighbour tests and then
// outlined, so the silhouettes stay clean. Frames: wings up, half up, down, half up (a loop). The DOM mirrors the strip for birds flying left.
import { blank, put, NAVY } from './paint.mjs';

const FW = 30;
const FH = 22;

const SPECIES = {
  // papagaio-verde: green, a yellow face, a red flash in the wing, a short tail
  papagaio: {
    back: ['#7cc86c', '#4fa05a', '#2f7a46'],
    belly: ['#b6df83', '#8cc46c'],
    head: ['#ffe27a', '#f2c230', '#d49a16'],
    wing: ['#5fb85f', '#3a8a4c', '#1f5a34'],
    farWing: '#2a6b3e',
    tail: ['#4fa05a', '#2f7a46'],
    flash: '#d8482c',
    beak: ['#f0b050', '#a8681c'],
    tailLen: 5,
  },
  // arara-azul: a blue back, a golden belly, a pale face patch, a long blue tail with a red tip
  arara: {
    back: ['#6fa8e4', '#2f6fb3', '#234f8c'],
    belly: ['#f6d65a', '#e0aa22'],
    head: ['#7fb4ec', '#2f6fb3', '#234f8c'],
    wing: ['#6fa8e4', '#2a5fa5', '#1d437a'],
    farWing: '#1d437a',
    tail: ['#2f6fb3', '#234f8c'],
    flash: '#f2c230',
    beak: ['#4a4a5c', '#22222f'],
    tailLen: 9,
  },
};

const inPoly = (pts, x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inEll = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// wing polygons (the shoulder is about (14, 10)): base on the back, the tip sweeping up / back / down
const WING = {
  up: [[10, 9.2], [18.5, 9.2], [14, 1.6], [9.5, 0.6], [5.5, 3.2]],
  half: [[10, 9.2], [18.5, 9.2], [11.5, 5.6], [5, 5], [2.4, 8]],
  down: [[10, 10.4], [18.5, 10.4], [15, 18.4], [9, 21], [5, 18]],
  half2: null,
};
WING.half2 = WING.half;

function frame(spec, wing) {
  // part ids per pixel: 0 empty, then 1 far wing, 2 tail, 3 body, 4 head, 5 beak, 6 near wing
  const P = Array.from({ length: FH }, () => Array(FW).fill(0));
  const set = (pred, id) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (pred(x + 0.5, y + 0.5)) P[y][x] = id;
  };
  const wp = WING[wing];
  const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
  set((x, y) => inPoly(shift(wp, 3, wing === 'down' ? 1.2 : -1.4), x, y), 1);
  // tail: a tapered band off the left of the body
  const tl = spec.tailLen;
  set((x, y) => inPoly([[9, 10.4], [9, 14.4], [9 - tl, 16.6], [8 - tl, 14.4]], x, y), 2);
  set(inEll(15.5, 12.6, 8.4, 4.1), 3);
  set(inEll(23, 9.2, 3.9, 3.7), 4);
  set((x, y) => (x > 25.4 && x < 28.6 && y > 7.6 && y < 11.4 && x - 25.4 + (y - 7.6) * 0.3 < 3.4 - Math.max(0, y - 9.6) * 1.2) || (x > 26.4 && x < 28 && y >= 11.4 && y < 12.6), 5);
  set((x, y) => inPoly(wp, x, y), 6);

  const img = blank(FW, FH);
  const at = (x, y) => (x < 0 || y < 0 || x >= FW || y >= FH ? 0 : P[y][x]);
  const shade = (x, y, id, [hi, mid, lo]) => {
    const lit = at(x - 1, y - 1) !== id && at(x - 1, y) !== id ? 1 : at(x - 1, y - 1) !== id || at(x, y - 1) !== id ? 0.5 : 0;
    const dark = at(x + 1, y + 1) !== id && at(x, y + 1) !== id ? 1 : 0;
    return lit === 1 ? hi : dark ? lo : mid;
  };
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      const id = P[y][x];
      if (!id) continue;
      let c;
      if (id === 1) c = spec.farWing;
      else if (id === 2) c = x < 9 - tl + 3 && y > 14 - (9 - x) * 0.1 ? spec.flash : at(x, y + 1) !== 2 || x < 12 - tl ? spec.tail[1] : spec.tail[0];
      else if (id === 3) c = y > 13.6 ? spec.belly[at(x - 1, y - 1) !== 3 ? 0 : 1] : y > 12.8 ? spec.belly[1] : shade(x, y, 3, spec.back);
      else if (id === 4) c = shade(x, y, 4, spec.head);
      else if (id === 5) c = at(x, y + 1) !== 5 || at(x + 1, y) !== 5 ? spec.beak[1] : spec.beak[0];
      else c = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 3 || at(x + dx, y + dy) === 4) ? spec.wing[2] : shade(x, y, 6, spec.wing);
      // the red / gold flash near the wing's base
      if (id === 6 && Math.abs(x - 12.5) < 2.4 && Math.abs(y - (wing === 'down' ? 12.2 : 7.2)) < 1.6 && at(x, y) === 6) c = spec.flash;
      put(img, x, y, c);
    }
  // eye
  put(img, 22, 8, '#ffffff');
  put(img, 23, 8, '#2a2a3c');
  put(img, 23, 9, '#2a2a3c');
  // sel-out outline around the whole silhouette (navy where a shape meets empty space)
  const out = [];
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      if (P[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy))) out.push([x, y]);
    }
  for (const [x, y] of out) put(img, x, y, NAVY);
  return img;
}

const ORDER = ['up', 'half', 'down', 'half2'];

export async function flockStrips() {
  return Object.keys(SPECIES).map((species) => {
    const strip = blank(FW * ORDER.length, FH);
    ORDER.forEach((wing, i) => {
      const f = frame(SPECIES[species], wing);
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const s = (y * FW + x) * 4;
        const d = (y * strip.w + i * FW + x) * 4;
        if (f.data[s + 3]) for (let k = 0; k < 4; k++) strip.data[d + k] = f.data[s + k];
      }
    });
    return { key: `flock/${species}_strip`, img: strip, meta: { frames: ORDER.length, frameW: FW, fps: 8 } };
  });
}
export async function preview() {
  return (await flockStrips()).map((p) => p.img);
}
