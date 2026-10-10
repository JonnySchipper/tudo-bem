// Portrait backgrounds and the shared frame (portraits.mjs). One frame for every NPC; the background says where they work: the padaria's
// warm wall and tiles, the feira tarp, the praça ipê, the escola chalkboard, the academia mats, the airport glass. Light from the upper left,
// hard pixels, a few colours each (the PNGs stay small).
import { put, mix, NAVY } from './paint.mjs';
import { RAMPS, CREAM } from './feira.mjs';

const W = 64;
/** a soft upper-left light band over a flat fill: a dithered step toward `hi` near the top-left corner, toward `lo` at the bottom-right */
function lit(img, x0, y0, x1, y1, base, hi, lo) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const d = (x + y) / 2, dither = (x + y) % 2 === 0;
    put(img, x, y, d < 14 || (d < 18 && dither) ? hi : d > 52 || (d > 48 && dither) ? lo : base);
  }
}
const rect = (img, x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(img, x, y, c); };

/** the padaria: cream wall, a terracotta and white azulejo band, a shelf with two loaves */
function padaria(img) {
  lit(img, 2, 2, 62, 62, '#ecd2ab', '#f5e3c4', '#dcbc92');
  // shelf (wood) with bread on it, behind the head at shoulder height
  for (const [x0, w] of [[4, 9], [51, 9]]) {
    rect(img, x0, 22, w, 4, '#c78c59');
    rect(img, x0 + 1, 21, w - 2, 1, '#daa463');
    rect(img, x0, 25, w, 1, '#8a5a38');
  }
  for (const [x, y] of [[5, 18], [52, 18]]) {
    rect(img, x + 1, y, 5, 3, '#c97a3a');
    rect(img, x, y + 1, 7, 2, '#c97a3a');
    rect(img, x + 1, y, 3, 1, '#e8a860');
    for (const dx of [2, 4]) put(img, x + dx, y + 1, '#f2c27a');
    rect(img, x, y + 2, 7, 1, '#8f4e24');
  }
  // azulejos on the lower wall
  for (let y = 40; y < 62; y++) for (let x = 2; x < 62; x++) {
    const tx = Math.floor((x - 2) / 6), ty = Math.floor((y - 40) / 6), ix = (x - 2) % 6, iy = (y - 40) % 6;
    let c = (tx + ty) % 2 ? '#f6efe2' : '#e7d3b4';
    if (ix === 0 || iy === 0) c = '#cdb08a';
    else if ((tx + ty) % 2 && (ix === 3 || iy === 3) && ix > 1 && ix < 5 && iy > 1 && iy < 5) c = '#c9673a';
    put(img, x, y, c);
  }
  rect(img, 2, 39, 60, 1, '#b58a5c');
}

/** the feira: the stall's striped tarp with a scalloped hem over a bright morning */
function feira(img, stripe = ['#e0533c', '#f4ede2']) {
  lit(img, 2, 2, 62, 62, '#f3dfa6', '#f9ecc6', '#e2c886');
  // crates of produce at the bottom corners
  for (const x0 of [2, 50]) {
    rect(img, x0, 50, 12, 12, '#a86a3c');
    rect(img, x0, 50, 12, 1, '#c98a55');
    for (const y of [54, 58]) rect(img, x0, y, 12, 1, '#7a4a28');
  }
  for (let y = 2; y < 16; y++) for (let x = 2; x < 62; x++) {
    const band = Math.floor((x - 2) / 6) % 2;
    const hem = y >= 12 && ((x - 2) % 6 - 2.5) ** 2 + (y - 12) ** 2 * 2.2 > 9;
    if (hem) continue;
    put(img, x, y, y === 2 || (x + y) % 9 === 0 && y < 6 ? mix(stripe[band], '#ffffff', 0.25) : y > 9 ? mix(stripe[band], '#3a2418', 0.18) : stripe[band]);
  }
  for (let x = 2; x < 62; x++) put(img, x, 16, '#d9c288');
}

/** the praça: sky, the yellow ipê crown in the corners, a hedge behind the shoulders */
function praca(img) {
  lit(img, 2, 2, 62, 62, '#a9d4e6', '#c7e6f1', '#8ec0d8');
  const blossom = (cx, cy, r) => {
    for (let y = 2; y < 62; y++) for (let x = 2; x < 62; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2);
      if (d > r) continue;
      const bump = ((x * 7 + y * 13) % 5) === 0;
      put(img, x, y, d > r - 1.6 ? '#c9921c' : bump ? '#fff2a0' : x + y < cx + cy - r / 2 ? '#f9d648' : '#f2c230');
    }
  };
  blossom(4, 4, 15);
  blossom(62, 8, 12);
  for (let y = 46; y < 62; y++) for (let x = 2; x < 62; x++) {
    const top = 46 + Math.round(1.5 + 1.5 * Math.sin(x * 0.7));
    if (y < top) continue;
    put(img, x, y, y === top ? '#68a65a' : (x * 3 + y * 5) % 7 === 0 ? '#3d7a45' : '#4f8f4d');
  }
}

/** the escola: the chalkboard behind Dona Lúcia, a chalk word and a line */
function escola(img) {
  lit(img, 2, 2, 62, 62, '#3f6a52', '#4b7a60', '#335a45');
  for (let x = 6; x < 20; x++) if (x % 4 !== 3) put(img, x, 9 + (x % 2), '#cfe0d4');
  for (const [x, y] of [[46, 7], [47, 6], [48, 6], [49, 7], [49, 8], [49, 9], [48, 9], [47, 9], [46, 8], [50, 9], [53, 6], [53, 7], [53, 8], [53, 9], [54, 7], [55, 6]]) put(img, x, y, '#e6efe8');
  // chalk tray (wood)
  rect(img, 2, 56, 60, 2, '#a9764f');
  rect(img, 2, 56, 60, 1, '#c78c59');
  rect(img, 2, 58, 60, 4, '#8a5a38');
  rect(img, 8, 55, 4, 1, '#f4ede2');
}

/** the academia: pale wall with the stripe and the tatami */
function academia(img) {
  lit(img, 2, 2, 62, 62, '#d8dde8', '#e8ecf3', '#c3cad8');
  rect(img, 2, 30, 60, 3, '#3f62a0');
  rect(img, 2, 33, 60, 1, '#2e4878');
  for (let y = 48; y < 62; y++) for (let x = 2; x < 62; x++) put(img, x, y, (Math.floor((x - 2) / 20) + (y < 55 ? 0 : 1)) % 2 ? '#3d8a5a' : '#2f7a4c');
  rect(img, 2, 48, 60, 1, '#5aa874');
}

/** the airport: the curtain-wall glass, mullions and a sky glint */
function aeroporto(img) {
  lit(img, 2, 2, 62, 62, '#b8d8ea', '#d3e8f3', '#9cc4dc');
  for (let y = 2; y < 62; y++) for (let x = 2; x < 62; x++) if ((x + y * 2) % 23 < 2 && x + y < 60) put(img, x, y, '#e8f4fa');
  for (const x of [17, 46]) rect(img, x, 2, 2, 60, '#6f8fa8');
  rect(img, 2, 40, 60, 2, '#6f8fa8');
  rect(img, 2, 54, 60, 8, '#8f9db4');
  rect(img, 2, 54, 60, 1, '#a9b6ca');
}

/** the pet shop: the cream wall with a scatter of mustard paw prints, a shelf of ração bags, the sp-green wainscot */
function petshop(img) {
  lit(img, 2, 2, 62, 62, '#f5e6d3', '#fbf1e3', '#e9d6bf');
  const paw = (x, y) => { for (const [dx, dy] of [[0, 1], [1, 0], [3, 0], [4, 1], [1, 3], [2, 3], [3, 3], [1, 4], [2, 4], [3, 4], [2, 2]]) put(img, x + dx, y + dy, '#e8c46a'); };
  for (const [x, y] of [[5, 6], [12, 14], [50, 5], [56, 15]]) paw(x, y);
  // a shelf with two bags of ração at shoulder height on both sides
  for (const [x0, w] of [[2, 12], [50, 12]]) {
    rect(img, x0, 32, w, 3, '#a9764f');
    rect(img, x0, 32, w, 1, '#c78c59');
    rect(img, x0, 34, w, 1, '#6b4c2c');
  }
  for (const [x, c, hi] of [[3, '#cb2a2a', '#fc5c46'], [8, '#46756a', '#689183'], [51, '#3d56d2', '#50a7e8'], [56, '#d4a017', '#f8d239']]) {
    rect(img, x, 24, 5, 8, c);
    rect(img, x, 24, 5, 1, hi);
    rect(img, x + 1, 27, 3, 2, '#f5e6d3');
  }
  // the wainscot
  for (let y = 46; y < 62; y++) for (let x = 2; x < 62; x++) put(img, x, y, (x - 2) % 8 === 0 ? '#24554e' : '#2f5d50');
  rect(img, 2, 46, 60, 1, '#588278');
}

/** the Praia: a pale sky, the sea's horizon with a glint row, and the sand */
function praia(img) {
  lit(img, 2, 2, 62, 62, '#bfe3ee', '#d6eef5', '#a6d4e4');
  rect(img, 2, 36, 60, 12, '#3fa9a0');
  rect(img, 2, 36, 60, 1, '#5bbdb1');
  for (let x = 4; x < 62; x += 7) rect(img, x, 40 + (x % 2), 3, 1, '#8fd6c8');
  rect(img, 2, 48, 60, 14, '#ebd9a8');
  rect(img, 2, 48, 60, 1, '#f3e5bd');
  for (let x = 3; x < 62; x += 9) put(img, x, 53 + (x % 3), '#d6bd86');
}

export const BACKGROUNDS = { padaria, feira, praca, escola, academia, aeroporto, petshop, praia };

/** each feira vendor's tarp, as their stall has it (feira.mjs: frutas red, verduras green, pastel yellow, flores blue; cream between) */
export const TARP = {
  tia_lu: [RAMPS.red[2], CREAM[2]],
  ze: [RAMPS.green[2], CREAM[2]],
  chico: [RAMPS.yellow[2], CREAM[2]],
  rosa: [RAMPS.blue[2], CREAM[2]],
};

/** the shared 2 px frame: navy edge, a wood ring lit top-left and shaded bottom-right, rounded corners */
export function frame(img) {
  for (let i = 0; i < W; i++) {
    for (const [x, y] of [[i, 0], [i, W - 1], [0, i], [W - 1, i]]) put(img, x, y, NAVY);
    if (i >= 1 && i <= W - 2) {
      put(img, i, 1, '#daa463');
      put(img, 1, i, '#daa463');
      put(img, i, W - 2, '#8a5a38');
      put(img, W - 2, i, '#8a5a38');
    }
  }
  put(img, W - 2, 1, '#c78c59');
  put(img, 1, W - 2, '#c78c59');
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [W - 1, 0], [W - 2, 0], [W - 1, 1], [0, W - 1], [1, W - 1], [0, W - 2], [W - 1, W - 1], [W - 2, W - 1], [W - 1, W - 2]]) img.data[(y * W + x) * 4 + 3] = 0;
  for (const [x, y] of [[1, 1], [W - 2, 1], [1, W - 2], [W - 2, W - 2]]) put(img, x, y, NAVY);
}
