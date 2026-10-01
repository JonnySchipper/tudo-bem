// Art track 4: the strip of sky and far São Paulo skyline behind the north building row of Vila Ipê (the 2 tile top margin of the map).
// Four 224 x 32 chunks laid end to end (56 tiles = 896 px). Sky in the brand soft-sky blue warming toward the horizon (dithered bands),
// two layers of distant buildings in lavender greys (windows, caixas d'água, antennas, a crane), a few pixel clouds. Buildings stand on the
// bottom edge so the facades hide their feet.
import { blank, rect, hline, vline, dot, C, outlineAround } from './kit.mjs';
import { rng } from '../../../../scripts/lib/pixel/img.mjs';

const W = 224, H = 32;
const SKY = ['#94b6cf', '#a0bfd3', '#a8c5d4', '#b9d1d9', '#cddbdb', '#e0e4d9'];
const CLOUD = ['#f5f0e4', '#e6e6e4'];
const FAR = { wall: '#b9b6d0', shade: '#a7a7c4', win: '#cbc8de', top: '#c9c6dc' };
const NEAR = { wall: '#a39fbe', shade: '#918ead', win: '#bdb7d4', top: '#b2aecb' };

function sky(img, r) {
  for (let y = 0; y < H; y++) {
    const band = Math.min(SKY.length - 1, Math.floor((y / H) * SKY.length * 0.95));
    const frac = ((y / H) * SKY.length * 0.95) % 1;
    for (let x = 0; x < W; x++) {
      // dither into the next band near its lower edge
      const next = frac > 0.6 && (x + y) % 2 === 0 && band < SKY.length - 1;
      rect(img, x, y, 1, 1, SKY[next ? band + 1 : band]);
    }
  }
  // clouds: flat-bottomed puffs
  for (let i = 0; i < 3; i++) {
    const cx = 20 + Math.floor(r() * (W - 60)), cy = 4 + Math.floor(r() * 10);
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const rx = 4 + Math.floor(r() * 4), ry = 2 + Math.floor(r() * 2);
      const ox = cx + k * 5 - 2;
      for (let y = -ry; y <= 0; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) dot(img, ox + x, cy + y, y < -ry / 2 ? CLOUD[0] : CLOUD[1]);
    }
  }
}

function buildings(img, r, pal, minH, maxH, minW, maxW, gap) {
  let x = -Math.floor(r() * 6);
  while (x < W) {
    const w = minW + Math.floor(r() * (maxW - minW));
    const h = minH + Math.floor(r() * (maxH - minH));
    const top = H - h;
    rect(img, x, top, w, h + 4, pal.wall);
    hline(img, x, top, w, pal.top);
    vline(img, x + w - 1, top, h + 4, pal.shade);
    vline(img, x + w - 2, top, h + 4, pal.shade);
    // windows in a grid
    for (let wy = top + 3; wy < H - 2; wy += 4) for (let wx = x + 2; wx < x + w - 3; wx += 4) if (r() < 0.78) rect(img, wx, wy, 2, 2, pal.win);
    // rooftop: a caixa d'água, an antenna or a parapet step
    const k = r();
    if (k < 0.3 && w > 9) { rect(img, x + 3, top - 4, 5, 4, pal.shade); hline(img, x + 3, top - 4, 5, pal.top); }
    else if (k < 0.55) { vline(img, x + 2 + Math.floor(r() * (w - 4)), top - 6, 6, pal.shade); }
    else if (k < 0.7) { rect(img, x, top - 2, w, 2, pal.shade); }
    x += w + gap + Math.floor(r() * 3);
  }
}

function chunk(seed) {
  const r = rng(seed);
  const img = blank(W, H);
  sky(img, r);
  buildings(img, r, FAR, 14, 26, 10, 22, -1);
  buildings(img, r, NEAR, 6, 15, 14, 30, 0);
  // a tower crane on one of the far blocks
  const cx = 30 + Math.floor(r() * (W - 80));
  vline(img, cx, H - 26, 26, FAR.shade);
  hline(img, cx - 8, H - 26, 18, FAR.shade);
  vline(img, cx + 7, H - 25, 5, C.lav);
  void outlineAround;
  return img;
}

export async function skyline() {
  return [0, 1, 2, 3].map((i) => ({ key: `backdrop/sky_${i}`, img: chunk(101 + i * 17), anchor: [0, H], meta: { footprint: [14, 2], shadow: null } }));
}
