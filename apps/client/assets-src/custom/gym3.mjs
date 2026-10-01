// Visual pass V3: the academia, redrawn as a real jiu-jitsu gym. The tatame is a green block of interlocking EVA mats with a red safety border
// (the floor around it is blue puzzle mats, see floors.mjs), the north wall carries flags, group photos and a trophy shelf, and the room gets a
// bench and a water cooler. Authored in the LimeZu look: navy outline, upper-left light.
import { blank, put, fillRect, mix, h2, NAVY } from './paint.mjs';

const WOOD = { d: '#573c2c', lo: '#6b4b30', mid: '#8b5e3c', base: '#a9764f', hi: '#c78c59', hi2: '#daa463' };
const METAL = { lo: '#565972', mid: '#8b8bab', hi: '#b2aecb', hi2: '#d8d0e0' };

/** The jigsaw seam of an EVA mat: a dark line along the top and left edge of the mat with a rounded tab detour at the middle, and a light line under it. */
export function mat(img, x0, y0, w, h, m) {
  fillRect(img, x0, y0, w, h, m.base);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3)) put(img, x0 + x, y0 + y, m.dot);
  }
  // lit rim (top/left) and shaded rim (bottom/right)
  fillRect(img, x0 + 1, y0 + 1, w - 2, 1, m.hi);
  fillRect(img, x0 + 1, y0 + 1, 1, h - 2, m.hi);
  fillRect(img, x0 + 1, y0 + h - 2, w - 2, 1, m.lo);
  fillRect(img, x0 + w - 2, y0 + 1, 1, h - 2, m.lo);
  // seams: top and left edges, with a tab
  fillRect(img, x0, y0, w, 1, m.seam);
  fillRect(img, x0, y0, 1, h, m.seam);
  const tab = (cx, cy, horizontal) => {
    for (let d = -3; d <= 3; d++) {
      const off = Math.round(Math.sqrt(Math.max(0, 9 - d * d)));
      if (horizontal) { put(img, cx + d, cy + off, m.seam); put(img, cx + d, cy + off + 1, m.hi); } else { put(img, cx + off, cy + d, m.seam); put(img, cx + off + 1, cy + d, m.hi); }
    }
    // the knob inside the detour is a touch lighter
    for (let dy = 0; dy < 2; dy++) for (let dx = -1; dx <= 1; dx++) put(img, horizontal ? cx + dx : cx + dy + 0, horizontal ? cy + dy : cy + dx, m.base);
  };
  tab(x0 + (w >> 1), y0, true);
  tab(x0, y0 + (h >> 1), false);
}

export const MAT_BLUE = [
  { base: '#4a82cc', hi: '#6a9ee0', lo: '#3c68ac', seam: '#2b4a86', dot: '#4f8ad4' },
  { base: '#4f88d2', hi: '#70a4e6', lo: '#416eb2', seam: '#2b4a86', dot: '#5490da' },
];
export const MAT_GREEN = { base: '#4fa05a', hi: '#6cbb70', lo: '#3f8449', seam: '#2a5a32', dot: '#54a961' };

// ------------------------------------------------------------------ the tatame: 6 x 4 tiles (96 x 64) of green mats with a red border
export function tatame() {
  const w = 96, h = 64;
  const img = blank(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  // red safety border (2 mats deep on the outside is one 4 px strip here), then the green mats
  fillRect(img, 1, 1, w - 2, h - 2, '#c43d3a');
  fillRect(img, 1, 1, w - 2, 1, '#e0605a'); fillRect(img, 1, 1, 1, h - 2, '#e0605a');
  fillRect(img, 1, h - 2, w - 2, 1, '#8f2b2d'); fillRect(img, w - 2, 1, 1, h - 2, '#8f2b2d');
  // border seams every 16 px
  for (let x = 17; x < w - 2; x += 16) { fillRect(img, x, 1, 1, 4, '#8f2b2d'); fillRect(img, x, h - 5, 1, 4, '#8f2b2d'); }
  for (let y = 17; y < h - 2; y += 16) { fillRect(img, 1, y, 4, 1, '#8f2b2d'); fillRect(img, w - 5, y, 4, 1, '#8f2b2d'); }
  // green mats: 3 x 2 of 30 x 28
  const gx = 5, gy = 5;
  const xs = [5, 34, 63, 91], ys = [5, 32, 59];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) mat(img, xs[c], ys[r], xs[c + 1] - xs[c], ys[r + 1] - ys[r], MAT_GREEN);
  // white boundary line round the fighting area
  fillRect(img, gx - 1, gy - 1, w - 2 * gx + 2, 1, '#f8f8f8'); fillRect(img, gx - 1, h - gy, w - 2 * gx + 2, 1, '#f8f8f8');
  fillRect(img, gx - 1, gy - 1, 1, h - 2 * gy + 2, '#f8f8f8'); fillRect(img, w - gx, gy - 1, 1, h - 2 * gy + 2, '#f8f8f8');
  // two starting marks
  for (const sx of [w / 2 - 13, w / 2 + 11]) { fillRect(img, sx, h / 2 - 1, 3, 1, '#f8f8f8'); fillRect(img, sx + 1, h / 2 - 2, 1, 3, '#f8f8f8'); }
  return { img, anchor: [w / 2, h] };
}

// ------------------------------------------------------------------ the wall gallery (64 x 34): flags, group photos and a trophy shelf
export function galeria() {
  const w = 64, h = 34;
  const img = blank(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, '#33496f');
  fillRect(img, 1, 1, w - 2, 1, '#4a6a9c');
  // string of pennants along the top
  fillRect(img, 2, 3, w - 4, 1, '#d8d0e0');
  const flags = [['#2f8f4a', '#f2c230'], ['#f8f8f8', '#d93232'], ['#2f4f9c', '#f8f8f8'], ['#f2c230', '#2f8f4a'], ['#d93232', '#f8f8f8'], ['#f8f8f8', '#2f4f9c'], ['#2f8f4a', '#f8f8f8']];
  flags.forEach(([a, b], i) => {
    const x = 4 + i * 8;
    for (let r = 0; r < 5; r++) fillRect(img, x + r, 4 + r, Math.max(1, 7 - 2 * r), 1, r === 2 ? b : a);
  });
  // a Brazil flag, bigger, left; two group photos right
  fillRect(img, 3, 14, 18, 12, NAVY); fillRect(img, 4, 15, 16, 10, '#2f8f4a');
  [2, 4, 6, 7, 7, 6, 4, 2].forEach((hw, i) => fillRect(img, 12 - hw, 16 + i, hw * 2, 1, '#f2c230'));
  fillRect(img, 10, 18, 4, 4, '#2f4f9c'); fillRect(img, 10, 19, 4, 1, '#f8f8f8');
  const photo = (x, y, pw, ph) => {
    fillRect(img, x, y, pw, ph, NAVY); fillRect(img, x + 1, y + 1, pw - 2, ph - 2, WOOD.hi); fillRect(img, x + 1, y + 1, pw - 2, 1, WOOD.hi2);
    fillRect(img, x + 3, y + 3, pw - 6, ph - 6, '#efe4d0');
    for (let k = 0; k < Math.floor((pw - 6) / 3); k++) { const px = x + 3 + k * 3; put(img, px + 1, y + 4, mix('#c78c59', '#573c2c', (k % 3) / 3)); put(img, px + 1, y + 5, '#f8f8f8'); put(img, px, y + 5, '#f8f8f8'); put(img, px + 1, y + 6, ['#f8f8f8', '#4a86c8', '#8a5cc0', '#8b5e3c'][k % 4]); }
  };
  photo(24, 13, 17, 13);
  photo(43, 13, 17, 13);
  // trophy shelf along the bottom
  fillRect(img, 3, 29, w - 6, 2, WOOD.mid); fillRect(img, 3, 29, w - 6, 1, WOOD.hi);
  for (const [x, hgt] of [[7, 5], [24, 4], [47, 6], [55, 3]]) {
    fillRect(img, x, 29 - hgt, 4, hgt - 1, '#f2c230'); fillRect(img, x, 29 - hgt, 1, hgt - 1, '#ffe57b'); fillRect(img, x - 1, 29 - hgt, 6, 1, '#f2c230'); fillRect(img, x + 1, 28, 2, 1, '#c99a2a');
  }
  for (const [x, c] of [[15, '#d93232'], [34, '#4a86c8'], [39, '#f8f8f8']]) { fillRect(img, x, 26, 4, 3, c); fillRect(img, x, 26, 4, 1, mix(c, '#ffffff', 0.35)); }
  return { img, anchor: [0, h] };
}

// ------------------------------------------------------------------ bench (2 x 1) with a towel and a water bottle
export function bancoGym() {
  const w = 32, h = 22;
  const img = blank(w, h);
  // legs
  for (const x of [3, 26]) { fillRect(img, x, 12, 3, 9, NAVY); fillRect(img, x + 1, 12, 1, 8, METAL.hi); }
  // seat: lit top face, front slats
  fillRect(img, 0, 6, w, 10, NAVY);
  fillRect(img, 1, 7, w - 2, 4, WOOD.hi2); fillRect(img, 1, 7, w - 2, 1, '#f2c988');
  fillRect(img, 1, 11, w - 2, 4, WOOD.mid);
  for (let x = 5; x < w - 2; x += 6) fillRect(img, x, 7, 1, 4, WOOD.base);
  fillRect(img, 1, 14, w - 2, 1, WOOD.d);
  // folded towel and a bottle
  fillRect(img, 5, 3, 9, 5, NAVY); fillRect(img, 6, 4, 7, 3, '#f8f8f8'); fillRect(img, 6, 4, 7, 1, '#ffffff'); fillRect(img, 6, 6, 7, 1, '#4a86c8');
  fillRect(img, 21, 0, 4, 8, NAVY); fillRect(img, 22, 2, 2, 5, '#6ab4e8'); fillRect(img, 22, 1, 2, 1, '#f8f8f8'); put(img, 22, 3, '#c4dff2');
  return { img, anchor: [16, 19] };
}

// ------------------------------------------------------------------ bebedouro: water cooler with a blue jug (1 x 2 tiles)
export function bebedouro() {
  const w = 16, h = 32;
  const img = blank(w, h);
  fillRect(img, 3, 13, 10, 17, NAVY);
  fillRect(img, 4, 14, 8, 15, METAL.hi2); fillRect(img, 4, 14, 1, 15, '#ffffff'); fillRect(img, 11, 14, 1, 15, METAL.mid);
  fillRect(img, 4, 14, 8, 1, '#ffffff');
  // taps: cold (blue) and hot (red), and a drip tray
  fillRect(img, 5, 18, 2, 2, '#4280dd'); fillRect(img, 9, 18, 2, 2, '#d93232');
  fillRect(img, 5, 23, 6, 2, METAL.lo); fillRect(img, 5, 23, 6, 1, METAL.mid);
  fillRect(img, 3, 29, 10, 2, NAVY);
  // the jug: translucent blue bottle with a neck
  fillRect(img, 4, 2, 8, 12, NAVY);
  fillRect(img, 5, 3, 6, 10, '#7cc4f0'); fillRect(img, 5, 3, 2, 10, '#b4e2fa'); fillRect(img, 9, 3, 2, 10, '#55a6e0');
  fillRect(img, 6, 0, 4, 3, NAVY); fillRect(img, 7, 1, 2, 2, '#4a86c8');
  fillRect(img, 5, 8, 6, 1, '#c4ecff');
  return { img, anchor: [8, 30] };
}

const one = (fn) => () => {
  const r = fn();
  return [{ img: r.img, anchor: r.anchor }];
};
export const DERIVE_GYM3 = { gymTatame3: one(tatame), gymBanco3: one(bancoGym), gymBebedouro3: one(bebedouro), gymGaleria3: one(galeria) };
export { h2 };
