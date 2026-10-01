// HUD icons, 16x16 pixel art (`ui/icon_<name>`): the top bar, the send button, the mission steps and the credits button. They replace the old
// SVG icons of the isometric era so the whole chrome is one pixel language. Authored as char grids in the pack's palette (navy outline, warm
// browns, terracotta / mustard / leaf green from the brand palette); light comes from the upper left.
import { blank, grid } from './paint.mjs';

const PAL = {
  o: '#3a3a50', // outline navy
  w: '#f5e6d3', // cream
  W: '#fffaf0', // highlight
  y: '#d4a017', // mustard
  Y: '#f0c94a', // mustard light
  t: '#c45c26', // terracotta
  T: '#a13a30', // terracotta dark
  g: '#2f5d50', // green dark
  G: '#4f9a6a', // green
  L: '#9bd38a', // green light
  b: '#4280dd', // blue
  B: '#95e3e3', // blue light
  n: '#8b5e3c', // wood
  N: '#573c2c', // wood dark
  s: '#f2c9a0', // skin
  S: '#d9a072', // skin shade
  p: '#e07070', // pink
  r: '#9a9a92', // grey
  R: '#cfc8bc', // grey light
};

const ICON_ROWS = {
  map: [
    '................',
    '................',
    '.oooooooooooooo.',
    '.oGGGoWWWWoBBBo.',
    '.oGLGoWWtWoBBbo.',
    '.oGGGoWWTtoBbbo.',
    '.oLGGoWtWWoBBbo.',
    '.oGGLoWtWWoBBBo.',
    '.oGGGoWWtWoBbBo.',
    '.oLGGoWWWWoBBBo.',
    '.oGGGoWWWWoBBBo.',
    '.oooooooooooooo.',
    '................',
    '................',
    '................',
    '................',
  ],
  hat: [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....oYYYYyyo....',
    '...oYYYyYyyyo...',
    '...oYYyYyYyyo...',
    '...oYyYyYyyyo...',
    '...ottttttttoo..',
    '...oTTTTTTTTo...',
    '.oooyYYyyyyyooo.',
    'oYYYYyyyyyyyyyyo',
    'oyyyyyyyyyyyyyyo',
    '.ooyyyyyyyyyyoo.',
    '...oooooooooo...',
    '................',
  ],
  friends: [
    '................',
    '................',
    '..oooo..........',
    '.oLGGGo..oooo...',
    '.oGsssGoosssBo..',
    '.oGssssosssssbo.',
    '.oGssssossssbbo.',
    '..oGGGoosbbbbo..',
    '.oGGGGGGobbbbbo.',
    'oGGGGGGGGobbbbbo',
    'oGGGGGGGGobbbbbo',
    'oGGGGGGGGobbbbbo',
    'oooooooooooooooo',
    '................',
    '................',
    '................',
  ],
  soundOn: [
    '................',
    '................',
    '.......oo.......',
    '......oYyo...W..',
    '.....oYYyo....W.',
    '.oooooYYyo.W...W',
    '.oYYyoYYyo..W..W',
    '.oYYyoYYyo..W..W',
    '.oYYyoYYyo..W..W',
    '.oYYyoYYyo.W...W',
    '.oooooYYyo....W.',
    '.....oYYyo...W..',
    '......oYyo......',
    '.......oo.......',
    '................',
    '................',
  ],
  soundOff: [
    '................',
    '................',
    '.......oo.......',
    '......oRro......',
    '.....oRRro.W..W.',
    '.oooooRRro..WW..',
    '.oRRroRRro..WW..',
    '.oRRroRRro..WW..',
    '.oRRroRRro..WW..',
    '.oRRroRRro..WW..',
    '.oooooRRro.W..W.',
    '.....oRRro......',
    '......oRro......',
    '.......oo.......',
    '................',
    '................',
  ],
  musicOn: [
    '................',
    '................',
    '.....oooooooooo.',
    '.....oYYYYYYYyo.',
    '.....oyyyyyyyyo.',
    '.....oooooooooo.',
    '.....oY.....oY..',
    '.....oy.....oy..',
    '.....oY.....oY..',
    '..ooooy..ooooy..',
    '.oYYYyo.oYYYyo..',
    '.oYYyyo.oYYyyo..',
    '..oyyo...oyyo...',
    '...oo.....oo....',
    '................',
    '................',
  ],
  musicOff: [
    '................',
    '................',
    '.....oooooooooo.',
    '.....oRRRRRRRro.',
    '.....orrrrrrrro.',
    '.....oooooooooo.',
    '.....oR.....oR..',
    '.....or.....or..',
    '.....oR.....oR..',
    '..oooor..oooor..',
    '.oRRRro.oRRRro..',
    '.oRRrro.oRRrro..',
    '..orro...orro...',
    '...oo.....oo....',
    '................',
    '................',
  ],
  decor: [
    '................',
    '................',
    '................',
    '..ooooooooooo...',
    '.oGGGGGGGGGGGo..',
    '.oGLLLLLLLLLGo..',
    'ooGLLLLLLLLLGoo.',
    'oGoGGGGGGGGGoGo.',
    'oGGoGGGGGGGGoGGo',
    'oGGGGGGGGGGGGGGo',
    'oggggggggggggggo',
    '.oooooooooooooo.',
    '..oN........No..',
    '..oo........oo..',
    '................',
    '................',
  ],
  parrot: [
    '................',
    '................',
    '.....oooo.......',
    '....oGGGGo......',
    '...oGLLGGGo.....',
    '...oGLoGGtto....',
    '...oGGGGGtTo....',
    '...oGGGGGooo....',
    '..oGGbGGGGo.....',
    '..oGGbbGGGo.....',
    '..oGGbbGGo......',
    '..ooGGGGoo......',
    '...oyoooyo......',
    '.nnnnnnnnnnnnnn.',
    '.NNNNNNNNNNNNNN.',
    '................',
  ],
  send: [
    '................',
    '................',
    '..o.............',
    '..owo...........',
    '..owwoo.........',
    '..owwwwoo.......',
    '..owwwwwwoo.....',
    '..owwwwwwwwoo...',
    '..oWwwwwwwwwwoo.',
    '..owwwwwoooooo..',
    '..owwwooTTo.....',
    '..ooooTTTo......',
    '....oTTTo.......',
    '.....ooo........',
    '................',
    '................',
  ],
  close: [
    '................',
    '................',
    '..oo........oo..',
    '.oWwo......owwo.',
    '..oWwo....owwo..',
    '...oWwo..owwo...',
    '....oWwoowwo....',
    '.....oWwwwo.....',
    '.....owwwwo.....',
    '....owwooWwo....',
    '...owwo..oWwo...',
    '..owwo....oWwo..',
    '.owwo......oWwo.',
    '..oo........oo..',
    '................',
    '................',
  ],
  info: [
    '................',
    '................',
    '.....oooooo.....',
    '...ooBBbbbboo...',
    '..oBBbbbbbbbbo..',
    '..oBbbbwwbbbbo..',
    '.oBbbbbwwbbbbbo.',
    '.obbbbbbbbbbbbo.',
    '.obbbbbwwbbbbbo.',
    '.obbbbbwwbbbbbo.',
    '..obbbbwwbbbbo..',
    '..obbbbwwbbbbo..',
    '...oobbbbbboo...',
    '.....oooooo.....',
    '................',
    '................',
  ],
  // Caderno de palavras: a spiral notebook, terracotta cover with a cream label and a mustard seal
  caderno: [
    '................',
    '..oooooooooooo..',
    '.oroTttttttttTo.',
    '.oWoTWWWWWWWtTo.',
    '.oroTWnnnnnWtTo.',
    '.oWoTWWWWWWWtTo.',
    '.oroTWnnnWWWtTo.',
    '.oWoTWWWWWWWtTo.',
    '.oroTttttttttTo.',
    '.oWoTtttyyyttTo.',
    '.oroTtttyYyttTo.',
    '.oWoTttttttttTo.',
    '.oroTTTTTTTTTTo.',
    '..oooooooooooo..',
    '................',
    '................',
  ],
  // Recados: a clipboard with a mustard clip and a green tick
  recados: [
    '................',
    '.....oooooo.....',
    '..ooooyYYyoooo..',
    '..oWWWoyyoWWWo..',
    '..oWWWWWWWWWWo..',
    '..oWoWWWWWWWWo..',
    '..oWWoWWnnnnWo..',
    '..oWWWoWWWWWWo..',
    '..oWGWWWnnnnWo..',
    '..oGGGWWWWWWWo..',
    '..oWGGGWnnnWWo..',
    '..oWWWWWWWWWWo..',
    '..oooooooooooo..',
    '................',
    '................',
    '................',
  ],
  // a heart for friendship
  coracao: [
    '................',
    '................',
    '..oooo....oooo..',
    '.oTppTo..oTppTo.',
    '.oTpWptoTtpttTo.',
    '.oTpWtttttttttTo',
    '.oTptttttttttTo.',
    '..oTttttttttTo..',
    '...oTttttttTo...',
    '....oTtttttTo...',
    '.....oTtttTo....',
    '......oTttTo....',
    '.......oTTo.....',
    '........oo......',
    '................',
    '................',
  ],
  logout: [
    '................',
    '................',
    '.oooooooo.......',
    '.oTtttttto......',
    '.oTtttttto......',
    '.oTtttttto...W..',
    '.oTtttttto...WW.',
    '.oTtttyttoWWWWWW',
    '.oTtttyttoWWWWWW',
    '.oTtttttto...WW.',
    '.oTtttttto...W..',
    '.oTtttttto......',
    '.oooooooooo.....',
    '................',
    '................',
    '................',
  ],
  cumprimenta: [
    '................',
    '................',
    '...oo.oo.oo.oo..',
    '..ossossossosso.',
    '..ossossossosso.',
    '..ossossossosso.',
    '..osssssssssso..',
    '..osssssssssso..',
    '..osssssssssso..',
    '..ossssssssSso..',
    '...ossssssssSo..',
    '...osssssssSSo..',
    '....oTttttttTo..',
    '....oooooooooo..',
    '................',
    '................',
  ],
  pede: [
    '................',
    '....o..o..o.....',
    '...oT.oT.oT.....',
    '....o.oT..o.....',
    '................',
    '.oooooooooo.....',
    '.oWwwwwwwwoooo..',
    '.oNNNNNNNNoWwwo.',
    '.oNnnnnnnNo..oo.',
    '.owwwwwwwwo..ow.',
    '.owwwwwwwwo.oww.',
    '..owwwwwwo.ow...',
    '...oooooo.oo....',
    '.oooooooooooo...',
    '................',
    '................',
  ],
  monta: [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....oYYYYYyo....',
    '...oYYwYYyyyo...',
    '..oYYYYYYyyyyo..',
    '..oyyyyyyyyyyo..',
    '...ooooooooooo..',
    '.oooooooooooooo.',
    'oTttttttttttttTo',
    '.oTTTTTTTTTTTTo.',
    '..oooooooooooo..',
    '................',
    '................',
    '................',
  ],
};

// ---- V4 (UI visual pass): the slim HUD's settings gear, the phone drawer's burger and the emote tray's smiley. The gear and the smiley are
// built from a disc / tooth predicate, then outlined (sel-out: navy wherever a shape meets empty space), light from the upper left.
function disc(fillAt, shade, extra = {}) {
  const f = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => fillAt(x, y)));
  const rows = [];
  for (let y = 0; y < 16; y++) {
    let r = '';
    for (let x = 0; x < 16; x++) {
      if (extra[`${x},${y}`]) {
        r += extra[`${x},${y}`];
        continue;
      }
      if (!f[y][x]) {
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f[y + dy]?.[x + dx]);
        r += edge ? 'o' : '.';
      } else r += shade(x, y);
    }
    rows.push(r);
  }
  return rows;
}

const gearFill = (x, y) => {
  const dx = x - 7.5;
  const dy = y - 7.5;
  const r = Math.hypot(dx, dy);
  if (r < 2.3) return false;
  const k = (((Math.atan2(dy, dx) / (Math.PI / 4)) % 1) + 1) % 1;
  const d = Math.min(k, 1 - k);
  return r <= (d < 0.27 ? 6.8 : 5.3);
};
const gearShade = (x, y) => {
  const dx = x - 7.5;
  const dy = y - 7.5;
  if (Math.hypot(dx, dy) < 3.4) return 'r';
  return dx + dy < -2 ? 'W' : dx + dy < 3 ? 'R' : 'r';
};
ICON_ROWS.gear = disc(gearFill, gearShade);

const faceFill = (x, y) => Math.hypot(x - 7.5, y - 7.5) <= 6.5;
const faceShade = (x, y) => {
  const dx = x - 7.5;
  const dy = y - 7.5;
  return dx + dy < -4 ? 'Y' : dx + dy < 4 ? 'y' : 'S';
};
ICON_ROWS.emote = disc(faceFill, faceShade, {
  '5,5': 'o', '5,6': 'o', '10,5': 'o', '10,6': 'o',
  '4,9': 'o', '5,10': 'o', '6,11': 'o', '7,11': 'o', '8,11': 'o', '9,11': 'o', '10,10': 'o', '11,9': 'o',
  '6,9': 'p', '9,9': 'p',
});

// the RV coin (a gold real virtual with an ipê flower) and the Verde sprout, both pixel art now (they were smooth SVGs next to pixel frames)
PAL.d = '#a87810';
const coinFill = (x, y) => Math.hypot(x - 7.5, y - 7.5) <= 6.9;
const coinExtra = {};
for (let i = 4; i <= 11; i++) {
  coinExtra[`7,${i}`] = 'W';
  coinExtra[`8,${i}`] = 'W';
  coinExtra[`${i},7`] = 'W';
  coinExtra[`${i},8`] = 'W';
}
for (const k of ['7,7', '8,7', '7,8', '8,8']) coinExtra[k] = 't';
for (const k of ['6,6', '9,6', '6,9', '9,9']) coinExtra[k] = 'W';
ICON_ROWS.rv = disc(coinFill, (x, y) => {
  const dx = x - 7.5;
  const dy = y - 7.5;
  const r = Math.hypot(dx, dy);
  if (r > 5.2) return dx + dy < -2 ? 'Y' : dx + dy > 3 ? 'd' : 'y';
  return dx + dy > 5 ? 'Y' : 'y';
}, coinExtra);

// the brand mark: a sun over a striped padaria awning (it was a smooth SVG)
{
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 5.5;
      const r = Math.hypot(dx, dy);
      if (r <= 3.7) g[y][x] = dx + dy > 1.5 ? 'y' : 'Y';
      else if (r > 4.9 && r <= 6.4 && y < 9) {
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const ex = 7.5 + Math.cos(a) * r;
        const ey = 5.5 + Math.sin(a) * r;
        if (Math.hypot(ex - x, ey - y) < 0.62) g[y][x] = 'y';
      }
    }
  const awn = [
    '.oooooooooooooo.',
    'oTtttWWttWWtttTo',
    'oTtttWWttWWtttTo',
    '.oTtWWttWWttTTo.',
    '..oooooooooooo..',
  ];
  awn.forEach((r, i) => {
    g[10 + i] = [...r];
  });
  ICON_ROWS.mark = g.map((r) => r.join(''));
}

ICON_ROWS.verde = [
  '................',
  '................',
  '...oo......oo...',
  '..oLLoo..ooGLo..',
  '.oLLLGGooGGGLLo.',
  '.oLLGGGGGGGGGLo.',
  '..oGGGGoGGGGGo..',
  '...ooGGoGGGoo...',
  '.....oGoGoo.....',
  '......oGGo......',
  '......oGGo......',
  '......oGGo......',
  '.....ooGGoo.....',
  '....oGGGGGGo....',
  '....oooooooo....',
  '................',
];

ICON_ROWS.burger = [
  '................',
  '................',
  '.oooooooooooooo.',
  '.oTttttttttttTo.',
  '.oooooooooooooo.',
  '................',
  '.oooooooooooooo.',
  '.oTttttttttttTo.',
  '.oooooooooooooo.',
  '................',
  '.oooooooooooooo.',
  '.oTttttttttttTo.',
  '.oooooooooooooo.',
  '................',
  '................',
  '................',
];

export const UI_ICON_NAMES = Object.keys(ICON_ROWS);

function draw(rows) {
  if (rows.length !== 16) throw new Error(`ui icon needs 16 rows, got ${rows.length}`);
  rows.forEach((r, i) => {
    if (r.length !== 16) throw new Error(`ui icon row ${i} has ${r.length} chars: "${r}"`);
  });
  const img = blank(16, 16);
  grid(img, rows, PAL, 0, 0);
  return img;
}

export async function uiIconParts() {
  return UI_ICON_NAMES.map((name) => ({ key: `ui/icon_${name}`, img: draw(ICON_ROWS[name]) }));
}
export async function preview() {
  return UI_ICON_NAMES.map((name) => draw(ICON_ROWS[name]));
}
