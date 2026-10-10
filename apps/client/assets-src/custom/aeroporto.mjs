// The airport (the arrival tutorial, `ROOMS.aeroporto`). Hand-authored with the LimeZu palette and the set's rules: light from the upper
// left, the navy outline where a shape meets empty space, no gradients. The LimeZu packs have no airport, so every piece here is original.
//
//   behind the glass   aero/aviao (the airliner at gate 3, in the Tudo Bem green and yellow), aero/ponte (the jet bridge), aero/torre
//                      (the control tower), aero/rebocador (a baggage tug and two carts), aero/luz_pista (a runway edge light)
//   the glass front    aero/vidraca (one tile of curtain wall: glass is drawn half transparent, so the apron shows through), aero/portao
//                      (gate 3's door), aero/vidraca_letreiro (six tiles with the AEROPORTO letters), aero/vidraca_baixa + aero/porta_auto
//                      (the low south front and its automatic doors)
//   the hall           aero/cadeiras, aero/balcao_portao, aero/painel (departures board), aero/informacoes (Célia's desk), aero/cabine and
//                      aero/cabine_fechada (passport control; the passport and the entry stamp lie on the counter: photo spots), aero/fila,
//                      aero/faixa (BEM-VINDO AO BRASIL!), aero/esteira (the baggage carousel, animated), aero/carrinho(_vazio), aero/raiox,
//                      aero/canal_verde, aero/lanchonete (the pão de queijo café), the hanging signs aero/placa_*
//   diary objects      aero/mala, aero/etiqueta, aero/mochila, aero/fone, aero/cinto, aero/bilhete (grids with the outline added)
//   the Vila           aero/placa_onibus (the airport bus sign at the stop on Rua dos Ipês)
import { blank, setPx, hexPx, px } from '../../../../scripts/lib/pixel/img.mjs';
import { put, fillRect, line, NAVY, h2 } from './paint.mjs';
import { outlineAround } from './draw.mjs';
import { C } from './draw.mjs';

// ------------------------------------------------------------------ palette
const P = {
  navy: NAVY, navy2: '#46465e', slate: '#565972', slate2: '#6c6e85', mist: '#8b8bab', mist2: '#a2a6be', lav: '#b2aecb', lav2: '#c6bdd5',
  lav3: '#d8d0e0', lav4: '#ebe4f2', white: '#f8f8f8', snow: '#ffffff',
  sign: '#2e3550', signHi: '#3e4a6a', signLo: '#232842', ink: '#f8d239',
  green: '#2e8a55', greenHi: '#3fa565', greenLo: '#24704a', greenDk: '#1d5f3a',
  yellow: '#f8d239', yellowHi: '#fff59a', yellowLo: '#f2b22b', orange: '#ed931e',
  blue: '#4280dd', blueHi: '#50a7e8', blueLo: '#3d56d2', blueDk: '#2a3a96', sky: '#95e3e3',
  red: '#d93232', redHi: '#fc5c46', redLo: '#9e2b2d',
  wood: '#c78c59', woodHi: '#daa463', woodLo: '#a9764f', woodDk: '#6b4c2c', cream: '#f0efde', creamLo: '#e0d0b2',
  glass: '#a8d4ea', glassHi: '#eefaff', teal: '#367f82', tealHi: '#49928f', tealLo: '#2a575b',
};

const dot = (img, x, y, hex) => put(img, x, y, hex);
const rect = (img, x, y, w, h, hex) => fillRect(img, x, y, w, h, hex);
const alpha = (img, x, y, hex, a) => setPx(img, x, y, hexPx(hex, a));
/** A half-transparent rectangle (glass). */
const glassRect = (img, x, y, w, h, a = 78) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) alpha(img, xx, yy, P.glass, a);
};
/** The two diagonal glints every pane of glass in the set has. */
const glint = (img, x, y, w, h, seed = 0) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const d = (xx - x + (yy - y) + seed) % 22;
    if (d === 3 || d === 4) alpha(img, xx, yy, P.glassHi, 150);
    else if (d === 7) alpha(img, xx, yy, P.glassHi, 110);
  }
};
const inPoly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Fills every pixel whose centre is inside `pred` with `pick(x, y)`. */
const fill = (img, pred, pick) => {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (pred(x + 0.5, y + 0.5)) put(img, x, y, typeof pick === 'function' ? pick(x, y) : pick);
};
const opaque = (img, x, y) => (px(img, x, y)?.[3] ?? 0) > 0;
/** A 1 px line in `hex` along the edge of `pred` where it meets something already drawn (a part over another part). */
const seam = (img, pred, hex) => {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!pred(x + 0.5, y + 0.5)) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !pred(x + dx + 0.5, y + dy + 0.5));
    if (edge) put(img, x, y, hex);
  }
};

// ------------------------------------------------------------------ the 3x5 pixel font (accents read from the decomposed letter)
const G = (s) => s.split('/');
const FONT = {
  A: G('.#./#.#/###/#.#/#.#'), B: G('##./#.#/##./#.#/##.'), C: G('.##/#../#../#../.##'), D: G('##./#.#/#.#/#.#/##.'),
  E: G('###/#../##./#../###'), F: G('###/#../##./#../#..'), G: G('.##/#../#.#/#.#/.##'), H: G('#.#/#.#/###/#.#/#.#'),
  I: G('###/.#./.#./.#./###'), J: G('..#/..#/..#/#.#/.#.'), K: G('#.#/#.#/##./#.#/#.#'), L: G('#../#../#../#../###'),
  M: G('#...#/##.##/#.#.#/#...#/#...#'), N: G('##./#.#/#.#/#.#/#.#'), O: G('.#./#.#/#.#/#.#/.#.'), P: G('##./#.#/##./#../#..'),
  Q: G('.#./#.#/#.#/##./.##'), R: G('##./#.#/##./#.#/#.#'), S: G('.##/#../.#./..#/##.'), T: G('###/.#./.#./.#./.#.'),
  U: G('#.#/#.#/#.#/#.#/###'), V: G('#.#/#.#/#.#/#.#/.#.'), W: G('#...#/#...#/#.#.#/##.##/#...#'), X: G('#.#/#.#/.#./#.#/#.#'),
  Y: G('#.#/#.#/.#./.#./.#.'), Z: G('###/..#/.#./#../###'),
  0: G('###/#.#/#.#/#.#/###'), 1: G('.#./##./.#./.#./###'), 2: G('##./..#/.#./#../###'), 3: G('##./..#/.#./..#/##.'),
  4: G('#.#/#.#/###/..#/..#'), 5: G('###/#../##./..#/##.'), 6: G('.##/#../###/#.#/###'), 7: G('###/..#/.#./.#./.#.'),
  8: G('###/#.#/###/#.#/###'), 9: G('###/#.#/###/..#/##.'),
  '!': G('.#./.#./.#./.../.#.'), $: G('.##/##./.#./.##/##.'), '-': G('.../.../###/.../...'), ':': G('.../.#./.../.#./...'), ' ': G('.../.../.../.../...'),
};
const MARK = { '́': 2, '̀': 0, '̂': 1, '̃': 1 };
function glyphs(text) {
  const out = [];
  for (const ch of text.normalize('NFD')) {
    if (ch in MARK && out.length) out[out.length - 1].mark = { at: MARK[ch], tilde: ch === '̃', caret: ch === '̂' };
    else if (ch === '̧' && out.length) out[out.length - 1].cedilla = true;
    else {
      const rows = FONT[ch.toUpperCase()];
      if (!rows) throw new Error(`aeroporto font: no glyph for '${ch}' in '${text}'`);
      out.push({ rows, mark: null, cedilla: false });
    }
  }
  return out;
}
export const textW = (text, scale = 1) => (glyphs(text).reduce((w, g) => w + g.rows[0].length + 1, 0) - 1) * scale;
/** Paints `text` with its top-left at (x, y); `scale` 2 doubles every pixel. Accents go one row (`scale` rows) above the letter. */
function text(img, x, y, str, hex, scale = 1, shadow = null) {
  let cx = x;
  const px2 = (gx, gy, c) => rect(img, cx + gx * scale, y + gy * scale, scale, scale, c);
  for (const g of glyphs(str)) {
    const paint = (c, oy) => {
      g.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') rect(img, cx + rx * scale, y + (ry + oy) * scale, scale, scale, c);
      });
    };
    if (shadow) paint(shadow, 1 / scale);
    paint(hex, 0);
    if (g.mark) {
      if (g.mark.tilde) { px2(0, -1, hex); px2(1, -2, hex); px2(2, -1, hex); px2(3, -2, hex); }
      else if (g.mark.caret) { px2(0, -1, hex); px2(1, -2, hex); px2(2, -1, hex); }
      else px2(g.mark.at, -1, hex);
    }
    if (g.cedilla) px2(1, 5, hex);
    cx += (g.rows[0].length + 1) * scale;
  }
}

// ------------------------------------------------------------------ the airliner
function aviao() {
  const W = 206, H = 100;
  const img = blank(W, H);
  // far wing first (behind the fuselage, in the shade)
  const farWing = inPoly([[98, 41], [140, 41], [82, 13], [68, 13]]);
  fill(img, farWing, (x, y) => (y < 18 ? P.lav : (x + y) % 9 === 0 ? P.mist2 : P.lav2));
  seam(img, farWing, P.mist);
  // far engine: a sliver of nacelle peeking over the fuselage
  fill(img, (x, y) => x > 116 && x < 136 && y > 31 && y < 39, (x, y) => (y < 33 ? P.lav3 : P.lav));
  rect(img, 134, 32, 2, 7, P.slate);
  // fuselage: top at y 36, belly at y 64; it tapers up toward the tail and rounds off at the nose
  const top = 35;
  const belly = (x) => (x >= 62 ? 64 : 64 - (62 - x) * 0.42);
  const noseC = { x: 178, y: 50, rx: 26, ry: 15 };
  const body = (x, y) => {
    if (x < 13 || y < top) return false;
    if (x > noseC.x) return ((x - noseC.x) / noseC.rx) ** 2 + ((y - noseC.y) / noseC.ry) ** 2 <= 1 && y < 65;
    return y < belly(x);
  };
  fill(img, body, (x, y) => {
    const b = x > noseC.x ? noseC.y + Math.sqrt(Math.max(0, 1 - ((x - noseC.x) / noseC.rx) ** 2)) * noseC.ry : belly(x);
    if (y < top + 2) return P.snow;
    if (y > b - 3) return P.lav2;
    if (y > b - 8) return P.lav3;
    return P.white;
  });
  // the cheatline: Tudo Bem green with a yellow pinstripe, from the tail to the nose
  for (let x = 16; x < 200; x++) for (let y = 47; y < 53; y++) {
    if (!body(x + 0.5, y + 0.5)) continue;
    put(img, x, y, y === 47 ? P.greenHi : y < 51 ? P.green : y === 51 ? P.yellow : P.yellowLo);
  }
  // windows (skip the doors), each with a lit corner
  for (let x = 40; x < 160; x += 5) {
    if (x > 56 && x < 66) continue;
    rect(img, x, 42, 2, 3, P.blueDk);
    dot(img, x, 42, P.blue);
  }
  // doors: the rear one and the front one (the jet bridge meets it)
  for (const [dx, dw] of [[58, 7], [160, 8]]) {
    for (let y = 38; y < 59; y++) { dot(img, dx, y, P.lav); dot(img, dx + dw, y, P.lav); }
    for (let x = dx; x <= dx + dw; x++) { dot(img, x, 38, P.lav); dot(img, x, 58, P.lav); }
    rect(img, dx + 2, 41, dw - 3, 2, P.blueDk);
  }
  // the cockpit
  for (let x = 184; x < 197; x++) for (let y = 41 + Math.floor((x - 184) * 0.35); y < 45; y++) if (body(x + 0.5, y + 0.5)) put(img, x, y, x < 187 ? P.blueLo : P.navy2);
  for (let x = 186; x < 196; x += 3) dot(img, x, 44, P.slate);
  // the airline's name over the windows
  text(img, 96, 37, 'TUDO BEM', P.green);
  // the tail fin, swept back: the flag of Brazil (green field, yellow rhombus, blue disc with its white band; no red)
  const fin = inPoly([[15, 37], [52, 37], [26, 3], [12, 3]]);
  fill(img, fin, (x, y) => {
    const t = x - 12 - (37 - y) * 0.06;
    const dx = x - 27, dy = y - 22;
    if (dx * dx + dy * dy <= 20) return Math.abs(dy + 0.3 * dx + 0.5) < 1 ? P.white : dy < -2 ? P.blue : P.blueLo;
    if (Math.abs(dx) / 10 + Math.abs(dy) / 7 <= 1) return dy < -3 ? P.yellowHi : P.yellow;
    return t < 6 ? P.greenHi : x > 40 - (37 - y) * 0.6 ? P.greenLo : P.green;
  });
  // the near tailplane, toward the viewer
  const stab = inPoly([[20, 54], [50, 54], [32, 63], [10, 63]]);
  fill(img, stab, (x, y) => (y < 56 ? P.snow : P.lav4));
  seam(img, stab, P.lav);
  // the near wing, sweeping back and down toward the viewer, a green winglet at the tip
  const wing = inPoly([[94, 57], [142, 57], [66, 95], [50, 95]]);
  fill(img, wing, (x, y) => {
    const lead = x > 142 - (y - 57) * 2.0 - 4;
    if (lead) return P.snow;
    const flap = x < 94 - (y - 57) * 1.16 + 6;
    return flap ? P.lav3 : (x * 3 + y) % 23 === 0 ? P.lav3 : P.lav4;
  });
  seam(img, wing, P.lav);
  // flap tracks
  for (const t of [0.35, 0.6, 0.85]) {
    const y = Math.round(57 + t * 38), x = Math.round(94 - t * 44 + 4);
    rect(img, x, y, 3, 2, P.mist);
  }
  const winglet = inPoly([[50, 95], [58, 95], [52, 84], [47, 84]]);
  fill(img, winglet, (x) => (x < 51 ? P.greenHi : P.green));
  // the pylon and the near engine (its intake faces the nose)
  rect(img, 114, 60, 8, 6, P.lav3);
  const nacelle = (x, y) => x > 100 && x < 134 && ((y - 71) / 7.5) ** 2 + (x > 128 ? ((x - 128) / 6) ** 2 : 0) <= 1;
  fill(img, nacelle, (x, y) => (y < 66 ? P.snow : y > 75 ? P.lav2 : y > 73 ? P.lav3 : P.white));
  fill(img, (x, y) => x > 100 && x < 104 && Math.abs(y - 71) < 5, P.mist);
  // the intake: a dark ring and the fan
  fill(img, (x, y) => ((x - 131) / 3.2) ** 2 + ((y - 71) / 6.6) ** 2 <= 1, (x, y) => (((x - 131) / 2.2) ** 2 + ((y - 71) / 5) ** 2 <= 1 ? (y < 70 ? P.slate2 : P.slate) : P.navy2));
  dot(img, 131, 70, P.lav3);
  for (let y = 66; y < 77; y += 2) dot(img, 104 + (y % 4), y, P.lav);
  // the landing gear
  for (const [gx, n] of [[80, 2], [174, 1]]) {
    rect(img, gx + 2, belly(gx) - 1, 2, 5, P.slate);
    for (let i = 0; i < n; i++) fill(img, (x, y) => (x - (gx + 3 + i * 7)) ** 2 + (y - 70) ** 2 <= 9, (x, y) => (x + y < gx + 3 + i * 7 + 69 ? P.slate : P.navy2));
  }
  // a little light on the belly and one on the tail
  dot(img, 120, 63, P.white);
  dot(img, 13, 40, P.white);
  outlineAround(img);
  return { img, anchor: [Math.floor(W / 2), 73] };
}

/** The plane that lands on the runway (ambient, `render/pixel/runway.ts`): the same livery at runway distance, gear down. */
function aviaoPista() {
  const W = 92, H = 34;
  const img = blank(W, H);
  const farWing = inPoly([[44, 18], [60, 18], [36, 6], [31, 6]]);
  fill(img, farWing, P.lav);
  const body = (x, y) => x >= 6 && y >= 15 && (x > 78 ? ((x - 78) / 12) ** 2 + ((y - 20) / 6) ** 2 <= 1 && y < 26 : y < (x >= 26 ? 26 : 26 - (26 - x) * 0.3));
  fill(img, body, (x, y) => (y < 17 ? P.snow : y > 23 ? P.lav3 : P.white));
  for (let x = 8; x < 88; x++) if (body(x + 0.5, 20.5)) { put(img, x, 20, P.green); put(img, x, 21, P.yellow); }
  for (let x = 18; x < 74; x += 3) dot(img, x, 18, P.blueDk);
  for (let x = 82; x < 88; x++) dot(img, x, 18, P.navy2);
  const fin = inPoly([[7, 16], [22, 16], [12, 2], [5, 2]]);
  fill(img, fin, (x) => (x < 10 ? P.greenHi : P.green));
  // the flag at runway distance: the rhombus and the disc
  for (const [x, y] of [[10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [11, 8], [12, 8], [13, 8], [11, 10], [12, 10], [13, 10]]) dot(img, x, y, P.yellow);
  dot(img, 12, 9, P.blueLo);
  const wing = inPoly([[42, 24], [62, 24], [30, 33], [24, 33]]);
  fill(img, wing, (x, y) => (x > 62 - (y - 24) * 3.5 - 2 ? P.snow : P.lav4));
  fill(img, (x, y) => x > 44 && x < 58 && ((y - 27.5) / 3) ** 2 <= 1, (x, y) => (y < 27 ? P.white : P.lav2));
  rect(img, 56, 26, 2, 3, P.navy2);
  for (const gx of [36, 80]) { rect(img, gx, 26, 1, 3, P.slate); rect(img, gx - 1, 29, 3, 2, P.navy2); }
  outlineAround(img);
  return { img, anchor: [48, 30] };
}

function fumaca() {
  const img = blank(16, 8);
  fill(img, (x, y) => ((x - 5) / 5) ** 2 + ((y - 5) / 3) ** 2 <= 1 || ((x - 10) / 5) ** 2 + ((y - 4) / 3.5) ** 2 <= 1, (x, y) => (y < 3 ? P.white : y > 5 ? P.lav2 : P.lav4));
  return { img, anchor: [8, 7] };
}

// ------------------------------------------------------------------ the jet bridge
function ponte() {
  const W = 40, H = 58;
  const img = blank(W, H);
  // the support legs and the wheel bogie under the tube
  for (const lx of [11, 27]) rect(img, lx, 44, 2, 9, P.slate);
  rect(img, 9, 50, 22, 2, P.slate2);
  for (const wx of [10, 17, 23, 29]) { rect(img, wx - 1, 52, 3, 4, P.navy2); dot(img, wx - 1, 52, P.slate); }
  // the tube's roof, ribbed, with its east side in shade
  rect(img, 7, 8, 26, 39, P.lav3);
  for (let y = 10; y < 46; y += 3) rect(img, 8, y, 24, 1, P.lav2);
  rect(img, 7, 8, 1, 39, P.lav4);
  rect(img, 31, 8, 4, 39, P.mist2);
  for (let y = 12; y < 44; y += 7) rect(img, 32, y, 2, 3, P.blueDk);
  rect(img, 7, 46, 28, 2, P.mist);
  // the bellows that meet the plane's door
  for (let x = 3; x < 37; x++) {
    const fold = x % 3 === 0;
    rect(img, x, 1, 1, 8, fold ? P.navy2 : P.slate);
    dot(img, x, 1, fold ? P.slate : P.slate2);
  }
  outlineAround(img);
  return { img, anchor: [20, 57] };
}

// ------------------------------------------------------------------ the control tower
function torre() {
  const W = 44, H = 116;
  const img = blank(W, H);
  // the base block
  rect(img, 6, 98, 32, 18, P.lav3);
  rect(img, 6, 98, 32, 2, P.lav4);
  rect(img, 6, 114, 32, 2, P.lav);
  for (const wx of [9, 15, 27, 33]) rect(img, wx, 103, 3, 4, P.blueDk);
  rect(img, 20, 104, 5, 10, P.slate);
  // the shaft
  rect(img, 16, 36, 12, 62, P.lav3);
  rect(img, 16, 36, 3, 62, P.lav4);
  rect(img, 25, 36, 3, 62, P.lav2);
  for (let y = 44; y < 96; y += 13) rect(img, 16, y, 12, 1, P.lav);
  // the flare under the cab
  for (let y = 28; y < 36; y++) {
    const hw = 6 + (36 - y) * 1.8;
    for (let x = Math.round(22 - hw); x < Math.round(22 + hw); x++) put(img, x, y, x < 22 - hw + 3 ? P.lav4 : y > 33 ? P.lav : P.lav3);
  }
  // the cab: dark green glass, lit panes, white mullions
  rect(img, 5, 15, 34, 13, P.tealLo);
  for (let x = 5; x < 39; x++) for (let y = 15; y < 28; y++) {
    if ((x - 5) % 6 === 0) put(img, x, y, P.lav4);
    else if (y < 19 && (x + y) % 7 < 2) put(img, x, y, P.tealHi);
    else if (y > 24) put(img, x, y, P.teal);
  }
  // the roof and the overhang
  rect(img, 2, 11, 40, 4, P.white);
  rect(img, 2, 14, 40, 1, P.lav);
  rect(img, 8, 8, 28, 3, P.lav3);
  // the mast, a radar bar and the red light
  rect(img, 21, 0, 2, 8, P.slate);
  rect(img, 14, 3, 9, 2, P.mist);
  dot(img, 21, 0, P.redHi);
  dot(img, 22, 0, P.red);
  outlineAround(img);
  return { img, anchor: [22, 115] };
}

// ------------------------------------------------------------------ the baggage tug and its carts
function rebocador() {
  const W = 84, H = 30;
  const img = blank(W, H);
  const bags = [
    [P.red, P.redHi, P.redLo], [P.blue, P.blueHi, P.blueLo], [P.yellow, P.yellowHi, P.yellowLo],
    [P.green, P.greenHi, P.greenLo], ['#8a6bbf', '#a98be0', '#5e4a96'], [P.orange, '#f7b45a', '#b5541b'],
  ];
  // two carts: a frame, two wheels, a pile of bags
  for (let c = 0; c < 2; c++) {
    const x0 = 2 + c * 27;
    rect(img, x0, 20, 24, 3, P.slate2);
    rect(img, x0, 20, 24, 1, P.mist);
    for (const wx of [x0 + 3, x0 + 19]) { rect(img, wx, 23, 4, 4, P.navy2); dot(img, wx + 1, 24, P.slate); }
    for (let i = 0; i < 4; i++) {
      const [b, hi, lo] = bags[(c * 3 + i) % bags.length];
      const bw = 7 + ((c + i) % 2) * 2, bh = 6 + ((i * 3 + c) % 3);
      const bx = x0 + 1 + (i % 2) * 11 + (i > 1 ? 1 : 0), by = 20 - bh - (i > 1 ? 6 : 0);
      rect(img, bx, by, bw, bh, b);
      rect(img, bx, by, bw, 1, hi);
      rect(img, bx, by + bh - 1, bw, 1, lo);
      rect(img, bx + Math.floor(bw / 2) - 1, by - 1, 3, 1, P.slate);
    }
  }
  // the tow bar
  rect(img, 52, 22, 9, 1, P.slate);
  // the tug: low yellow body, a cab, a beacon
  rect(img, 60, 14, 22, 11, P.yellow);
  rect(img, 60, 14, 22, 2, P.yellowHi);
  rect(img, 60, 23, 22, 2, P.yellowLo);
  rect(img, 64, 5, 12, 9, P.yellowLo);
  rect(img, 66, 7, 9, 6, P.blueDk);
  rect(img, 66, 7, 3, 2, P.blueHi);
  rect(img, 63, 4, 14, 1, P.slate);
  rect(img, 69, 2, 2, 2, P.orange);
  for (let x = 60; x < 82; x += 4) dot(img, x, 20, P.slate);
  for (const wx of [62, 75]) { rect(img, wx, 23, 6, 5, P.navy2); rect(img, wx + 2, 25, 2, 1, P.slate); }
  outlineAround(img);
  return { img, anchor: [42, 29] };
}

function luzPista() {
  const img = blank(7, 10);
  rect(img, 2, 4, 3, 6, P.slate2);
  rect(img, 1, 0, 5, 4, P.yellow);
  rect(img, 2, 1, 2, 2, P.yellowHi);
  outlineAround(img);
  return { img, anchor: [3, 9] };
}

// ------------------------------------------------------------------ the glass front
const FRAME = P.slate, FRAME_HI = P.slate2;
/** One tile of curtain wall: header, a left mullion, a transom, two panes of glass, a kick plate. */
function paneTile(img, x0, seed) {
  rect(img, x0, 0, 16, 4, FRAME);
  rect(img, x0, 0, 16, 1, FRAME_HI);
  rect(img, x0, 0, 2, 40, FRAME);
  dot(img, x0, 0, FRAME_HI);
  rect(img, x0 + 2, 21, 14, 2, FRAME);
  glassRect(img, x0 + 2, 4, 14, 17);
  glassRect(img, x0 + 2, 23, 14, 17);
  glint(img, x0 + 2, 4, 14, 17, seed);
  glint(img, x0 + 2, 23, 14, 17, seed + 9);
  // the kick plate the hall's floor meets
  rect(img, x0, 40, 16, 6, P.lav3);
  rect(img, x0, 40, 16, 1, P.lav4);
  rect(img, x0, 45, 16, 1, P.mist2);
}
function vidraca() {
  const img = blank(16, 46);
  paneTile(img, 0, 0);
  return { img, anchor: [8, 45] };
}
function vidracaLetreiro() {
  const img = blank(96, 46);
  for (let i = 0; i < 6; i++) paneTile(img, i * 16, i * 5);
  // the letters on a dark band across the top panes
  rect(img, 2, 5, 92, 15, P.navy);
  rect(img, 3, 6, 90, 13, P.sign);
  rect(img, 3, 6, 90, 1, P.signHi);
  const tw = textW('AEROPORTO', 2) - 2;
  text(img, Math.floor((96 - tw) / 2), 8, 'AEROPORTO', P.yellow, 2, P.yellowLo);
  return { img, anchor: [48, 45] };
}
function portao() {
  const img = blank(48, 46);
  paneTile(img, 0, 3);
  paneTile(img, 32, 11);
  // the door frame and the two closed leaves (the jet bridge behind)
  rect(img, 16, 0, 16, 46, FRAME);
  rect(img, 16, 0, 16, 1, FRAME_HI);
  rect(img, 18, 18, 12, 24, P.lav2);
  rect(img, 18, 18, 12, 1, P.lav4);
  rect(img, 23, 18, 2, 24, P.mist);
  for (const wx of [19, 26]) { rect(img, wx, 22, 3, 6, P.blueDk); dot(img, wx, 22, P.blue); }
  rect(img, 16, 40, 16, 6, P.lav3);
  rect(img, 16, 40, 16, 1, P.lav4);
  // the gate number over the door
  rect(img, 17, 3, 14, 13, P.navy);
  rect(img, 18, 4, 12, 11, P.sign);
  text(img, 21, 5, '3', P.yellow, 2);
  return { img, anchor: [24, 45] };
}
function vidracaBaixa() {
  const img = blank(16, 22);
  rect(img, 0, 0, 16, 3, FRAME);
  rect(img, 0, 0, 16, 1, FRAME_HI);
  rect(img, 0, 0, 2, 16, FRAME);
  glassRect(img, 2, 3, 14, 11);
  glint(img, 2, 3, 14, 11, 5);
  rect(img, 0, 14, 16, 8, P.lav3);
  rect(img, 0, 14, 16, 1, P.lav4);
  rect(img, 0, 21, 16, 1, P.mist2);
  return { img, anchor: [8, 21] };
}
function portaAuto() {
  const img = blank(32, 26);
  rect(img, 0, 0, 3, 22, FRAME);
  rect(img, 29, 0, 3, 22, FRAME);
  rect(img, 0, 0, 32, 6, FRAME);
  rect(img, 0, 0, 32, 1, FRAME_HI);
  // the green exit sign
  rect(img, 5, 0, 22, 6, P.green);
  text(img, 6, 1, 'SAÍDA', P.white);
  // the two leaves slid aside
  glassRect(img, 3, 6, 6, 15, 110);
  glassRect(img, 23, 6, 6, 15, 110);
  rect(img, 8, 6, 1, 15, FRAME_HI);
  rect(img, 23, 6, 1, 15, FRAME_HI);
  // the mat in the doorway
  rect(img, 2, 22, 28, 4, P.navy2);
  for (let x = 3; x < 30; x += 2) rect(img, x, 23, 1, 2, P.slate);
  return { img, anchor: [16, 25] };
}

// ------------------------------------------------------------------ the hall
function cadeiras() {
  const img = blank(48, 26);
  rect(img, 2, 18, 44, 2, P.slate2);
  rect(img, 2, 18, 44, 1, P.mist);
  for (const lx of [6, 40]) { rect(img, lx, 20, 2, 5, P.slate); rect(img, lx - 2, 24, 6, 2, P.slate); }
  for (let i = 0; i < 3; i++) {
    const x0 = 2 + i * 15;
    rect(img, x0, 2, 14, 10, P.blue);
    rect(img, x0, 2, 14, 2, P.blueHi);
    rect(img, x0, 10, 14, 2, P.blueLo);
    rect(img, x0 + 1, 12, 12, 6, P.blueHi);
    rect(img, x0 + 1, 16, 12, 2, P.blue);
    if (i) rect(img, x0 - 2, 9, 3, 9, P.slate);
  }
  outlineAround(img);
  return { img, anchor: [24, 25] };
}

const ICONS = {
  aviao: ['....#....', '...###...', '#..###..#', '#########', '...###...', '...###...', '..#####..', '....#....'],
  mala: ['..###..', '..#.#..', '#######', '#.#.#.#', '#.#.#.#', '#######', '.#...#.'],
  lupa: ['.###...', '#...#..', '#...#..', '#...#..', '.####..', '....##.', '.....##'],
  pouso: ['.....#...', '....##...', '#..###...', '########.', '..#####..', '...##.##.', '.......##', '.........'],
};
/** A wayfinding sign: a dark board with a pictogram and yellow letters, hung on two thin poles. */
function placa(label, icon, tiles, opts = {}) {
  const W = tiles * 16, H = 42;
  const img = blank(W, H);
  for (const lx of [5, W - 7]) { rect(img, lx, 16, 2, 25, P.slate2); rect(img, lx, 16, 1, 25, P.mist); rect(img, lx - 1, 40, 4, 2, P.slate); }
  const bg = opts.bg ?? P.sign, hi = opts.hi ?? P.signHi;
  rect(img, 1, 1, W - 2, 16, bg);
  rect(img, 1, 1, W - 2, 1, hi);
  rect(img, 1, 16, W - 2, 1, P.signLo);
  const rows = ICONS[icon];
  const iw = rows ? rows[0].length : 0;
  const tw = textW(label);
  const total = (rows ? iw + 3 : 0) + tw;
  let x = Math.floor((W - total) / 2);
  if (rows) {
    rows.forEach((row, ry) => [...row].forEach((c, rx) => c === '#' && dot(img, x + rx, 5 + ry, P.white)));
    x += iw + 3;
  }
  text(img, x, 7, label, opts.ink ?? P.yellow);
  if (opts.arrow) {
    const ax = W - 8;
    for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, 3], [-1, 2], [1, 2], [-2, 1], [2, 1]]) dot(img, ax + dx, 6 + dy + 2, P.white);
  }
  outlineAround(img);
  return { img, anchor: [Math.floor(W / 2), H - 1] };
}

function painel() {
  const img = blank(48, 44);
  for (const lx of [10, 36]) { rect(img, lx, 28, 2, 15, P.slate2); rect(img, lx, 28, 1, 15, P.mist); rect(img, lx - 2, 42, 6, 2, P.slate); }
  rect(img, 1, 1, 46, 28, P.slate);
  rect(img, 2, 2, 44, 26, '#1d2238');
  rect(img, 2, 2, 44, 8, P.sign);
  text(img, 4, 4, 'EMBARQUE', P.yellow);
  // the clock
  rect(img, 38, 4, 7, 5, P.navy2);
  for (const [x, y] of [[39, 5], [41, 5], [43, 5], [40, 7], [42, 7]]) dot(img, x, y, P.yellowLo);
  // four flights: a time, a city, a gate, the status lamp
  for (let r = 0; r < 4; r++) {
    const y = 12 + r * 4;
    for (let x = 4; x < 12; x++) if ((x + r) % 4 !== 3) dot(img, x, y, P.yellowLo);
    for (let x = 14; x < 34; x++) if (h2(x, r, 7) > 0.3) dot(img, x, y, P.white);
    rect(img, 36, y, 3, 1, P.sky);
    rect(img, 42, y, 2, 1, r === 0 ? P.greenHi : r === 2 ? P.yellow : P.greenHi);
  }
  outlineAround(img);
  return { img, anchor: [24, 43] };
}

function balcaoPortao() {
  const img = blank(32, 30);
  rect(img, 1, 12, 30, 18, P.blueLo);
  rect(img, 1, 12, 30, 2, P.blue);
  rect(img, 1, 20, 30, 2, P.white);
  rect(img, 1, 22, 30, 1, P.green);
  rect(img, 1, 28, 30, 2, P.blueDk);
  rect(img, 0, 9, 32, 4, P.lav4);
  rect(img, 0, 12, 32, 1, P.lav2);
  // the screen
  rect(img, 18, 1, 10, 8, P.slate);
  rect(img, 19, 2, 8, 5, '#1d2238');
  rect(img, 20, 3, 4, 1, P.sky);
  rect(img, 22, 9, 2, 1, P.slate);
  // the gate placard
  rect(img, 3, 2, 8, 7, P.yellow);
  text(img, 5, 3, '3', P.navy);
  outlineAround(img);
  return { img, anchor: [16, 29] };
}

function informacoes() {
  const img = blank(48, 34);
  // the counter: a teal front with rounded ends and a white top
  fill(img, (x, y) => y >= 13 && y < 34 && x > 1 && x < 47 && !((x < 4 || x > 44) && y > 31), (x, y) => (y < 15 ? P.tealHi : y > 30 ? P.tealLo : P.teal));
  rect(img, 1, 10, 46, 4, P.lav4);
  rect(img, 1, 13, 46, 1, P.lav2);
  // the big "i"
  fill(img, (x, y) => (x - 24) ** 2 + (y - 22) ** 2 <= 38, (x, y) => ((x - 24) ** 2 + (y - 22) ** 2 >= 28 ? P.yellowLo : P.yellow));
  rect(img, 23, 18, 3, 2, P.navy);
  rect(img, 23, 21, 3, 6, P.navy);
  rect(img, 22, 26, 5, 1, P.navy);
  // a monitor and a rack of leaflets
  rect(img, 33, 2, 10, 8, P.slate);
  rect(img, 34, 3, 8, 5, '#1d2238');
  rect(img, 35, 4, 3, 1, P.sky);
  rect(img, 6, 5, 9, 5, P.lav);
  for (const [i, c] of [P.red, P.yellow, P.green].entries()) rect(img, 7 + i * 3, 3, 2, 4, c);
  outlineAround(img);
  return { img, anchor: [24, 33] };
}

/** Passport control: side walls, the counter, a glass screen over it. `open` puts the passport and the stamp on the counter. */
function cabine(open) {
  const img = blank(48, 52);
  rect(img, 0, 8, 4, 44, P.lav2);
  rect(img, 0, 8, 1, 44, P.lav4);
  rect(img, 44, 8, 4, 44, P.lav);
  rect(img, 44, 8, 1, 44, P.lav3);
  rect(img, 0, 6, 48, 2, P.slate);
  rect(img, 4, 8, 40, 2, P.slate2);
  glassRect(img, 4, 10, 40, 21, 64);
  glint(img, 4, 10, 40, 21, 4);
  // the counter top and the navy front with the federal police's gold line and badge
  rect(img, 2, 31, 44, 5, P.lav4);
  rect(img, 2, 35, 44, 1, P.lav2);
  rect(img, 3, 36, 42, 16, P.sign);
  rect(img, 3, 36, 42, 1, P.signHi);
  rect(img, 3, 39, 42, 1, P.yellowLo);
  fill(img, (x, y) => Math.abs(x - 23.5) + Math.abs(y - 45.5) <= 4, (x, y) => (x + y < 69 ? P.yellow : P.yellowLo));
  dot(img, 23, 45, P.sign);
  if (open) {
    // the passport, open at the photo page
    rect(img, 7, 29, 7, 4, P.greenDk);
    rect(img, 8, 29, 5, 3, P.green);
    dot(img, 10, 30, P.yellow);
    rect(img, 9, 32, 7, 2, P.cream);
    // the entry stamp and its ink pad
    rect(img, 33, 31, 6, 2, P.redLo);
    rect(img, 35, 26, 2, 5, P.woodLo);
    rect(img, 34, 24, 4, 3, P.wood);
    dot(img, 34, 24, P.woodHi);
  } else {
    // FECHADO hung in the glass
    rect(img, 9, 15, 30, 9, P.redLo);
    rect(img, 10, 16, 28, 7, P.red);
    text(img, 10, 17, 'FECHADO', P.white);
    line(img, 15, 10, 13, 15, P.slate);
    line(img, 33, 10, 35, 15, P.slate);
  }
  outlineAround(img);
  return { img, anchor: [24, 51] };
}

function fila() {
  const img = blank(48, 20);
  // the belts, sagging a pixel in the middle
  for (const [a, b] of [[4, 24], [24, 44]]) for (let x = a; x <= b; x++) {
    const sag = Math.abs(x - (a + b) / 2) < 5 ? 1 : 0;
    dot(img, x, 6 + sag, P.redHi);
    dot(img, x, 7 + sag, P.red);
  }
  for (const x of [3, 23, 43]) {
    rect(img, x, 3, 2, 14, P.mist2);
    dot(img, x, 3, P.lav4);
    rect(img, x - 1, 2, 4, 2, P.lav3);
    rect(img, x - 2, 17, 6, 2, P.slate2);
  }
  outlineAround(img);
  return { img, anchor: [24, 19] };
}

function faixa() {
  const img = blank(96, 64);
  for (const x of [10, 85]) rect(img, x, 0, 1, 11, P.slate2);
  rect(img, 2, 10, 92, 17, P.green);
  rect(img, 2, 10, 92, 2, P.greenHi);
  rect(img, 2, 25, 92, 2, P.greenLo);
  rect(img, 4, 13, 88, 1, P.yellow);
  rect(img, 4, 23, 88, 1, P.yellow);
  const label = 'BEM-VINDO AO BRASIL!';
  text(img, Math.floor((96 - textW(label)) / 2), 16, label, P.white);
  outlineAround(img);
  return { img, anchor: [48, 63] };
}

/**
 * The baggage carousel: a stadium of rubber slats round a steel island, six bags going round in two alternating colours. The loop is
 * seamless: over its 30 frames every bag travels exactly two spacings, onto the place of the next bag of its own colour, while the slats
 * move 2 px a frame (60 px, a whole number of 3 px slats). So the last frame runs into the first with nothing jumping.
 */
export const ESTEIRA_FRAMES = 30;
export const ESTEIRA_COLORS = 2;
/** `count` frames of the loop (more than ESTEIRA_FRAMES only for the test, which checks that frame 30 is frame 0 again). */
export function esteiraFrames(count = ESTEIRA_FRAMES) {
  const W = 96, H = 40, N = ESTEIRA_FRAMES;
  // the slat ring: straight runs at y 11 and 26 between x 16 and 80, half circles at the ends (radius 7.5 round the ring's middle line)
  const L = 64, R = 7.5, cyM = 18.5;
  const perim = 2 * L + 2 * Math.PI * R;
  const at = (s) => {
    s = ((s % perim) + perim) % perim;
    if (s < L) return [16 + s, cyM - R];
    s -= L;
    if (s < Math.PI * R) { const a = -Math.PI / 2 + s / R; return [80 + Math.cos(a) * R, cyM + Math.sin(a) * R]; }
    s -= Math.PI * R;
    if (s < L) return [80 - s, cyM + R];
    s -= L;
    const a = Math.PI / 2 + s / R;
    return [16 + Math.cos(a) * R, cyM + Math.sin(a) * R];
  };
  const stadium = (x, y, r) => {
    const cx = Math.max(16, Math.min(80, x));
    return (x - cx) ** 2 + (y - cyM) ** 2 <= r * r;
  };
  const pair = [[P.blue, P.blueHi, P.blueLo], [P.yellow, P.yellowHi, P.yellowLo]];
  const bags = Array.from({ length: 6 }, (_, i) => pair[i % ESTEIRA_COLORS]);
  const spacing = perim / bags.length;
  const step = (spacing * ESTEIRA_COLORS) / N;
  const frames = [];
  for (let f = 0; f < count; f++) {
    const img = blank(W, H);
    // the body: the stainless rim and its front face
    fill(img, (x, y) => stadium(x, y, 15.5) || (y > cyM && y < 38 && x > 16 - 15.5 * Math.sqrt(Math.max(0, 1 - ((y - cyM) / 30) ** 2)) - 0.5 && stadium(x, cyM + Math.min(y - cyM, 0), 15.5)), (x, y) => (y > 32 ? P.mist2 : P.lav3));
    for (let x = 1; x < 95; x++) for (let y = 30; y < 38; y++) if (stadium(x + 0.5, Math.min(y, 33.5) - 0.5, 15.5) && y > cyM + 10) put(img, x, y, y > 35 ? P.mist : y === 33 ? P.lav : P.mist2);
    // the slats, moving 2 px a frame
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const inRing = stadium(x + 0.5, y + 0.5, 11.5) && !stadium(x + 0.5, y + 0.5, 4.5);
      if (!inRing) continue;
      // the slat seams run across the ring: along the straights they are columns, round the ends they are rays
      let s;
      if (x + 0.5 >= 16 && x + 0.5 <= 80) s = y + 0.5 < cyM ? x - 16 : 160 - x;
      else s = Math.round(Math.atan2(y + 0.5 - cyM, x + 0.5 - (x < 48 ? 16 : 80)) * R);
      put(img, x, y, (s + f * 2 + 300) % 3 === 0 ? P.slate : P.navy2);
    }
    // the island in the middle
    fill(img, (x, y) => stadium(x, y, 4.5), (x, y) => (y < cyM - 2 ? P.lav4 : P.lav2));
    // the bags, each 9 x 6 seen from above with a handle
    bags.forEach(([b, hi, lo], i) => {
      const [bx, by] = at(i * spacing + f * step);
      const x0 = Math.round(bx - 4), y0 = Math.round(by - 3);
      rect(img, x0, y0, 9, 6, b);
      rect(img, x0, y0, 9, 1, hi);
      rect(img, x0, y0 + 5, 9, 1, lo);
      rect(img, x0 + 3, y0 + 2, 3, 1, P.slate);
    });
    outlineAround(img);
    frames.push(img);
  }
  return { frames, anchor: [48, 39] };
}

function carrinho(loaded) {
  const H = loaded ? 26 : 20;
  const img = blank(16, H);
  const y0 = H - 26 + 6;
  rect(img, 2, Math.max(0, y0 - 4), 12, 2, P.mist2);
  for (const x of [2, 12]) rect(img, x, Math.max(0, y0 - 4), 2, H - 4 - Math.max(0, y0 - 4), P.mist);
  rect(img, 2, H - 6, 12, 2, P.slate2);
  for (const x of [3, 11]) { rect(img, x, H - 4, 3, 4, P.navy2); dot(img, x + 1, H - 3, P.slate); }
  if (loaded) {
    rect(img, 3, 9, 10, 11, P.blue);
    rect(img, 3, 9, 10, 1, P.blueHi);
    for (const x of [5, 8, 11]) rect(img, x, 10, 1, 9, P.blueLo);
    rect(img, 4, 4, 7, 5, P.red);
    rect(img, 4, 4, 7, 1, P.redHi);
    rect(img, 6, 3, 3, 1, P.slate);
  }
  outlineAround(img);
  return { img, anchor: [8, H - 1] };
}

function raiox() {
  const img = blank(64, 34);
  // the roller conveyors in and out
  for (const x0 of [0, 46]) {
    rect(img, x0, 20, 18, 7, P.slate2);
    for (let x = x0 + 1; x < x0 + 17; x += 2) rect(img, x, 21, 1, 4, P.lav3);
    for (const lx of [x0 + 2, x0 + 14]) rect(img, lx, 27, 2, 6, P.slate);
  }
  // the tunnel
  rect(img, 18, 4, 28, 26, P.lav2);
  rect(img, 18, 4, 28, 3, P.lav4);
  rect(img, 18, 26, 28, 4, P.lav);
  for (let x = 18; x < 46; x += 4) rect(img, x, 28, 2, 2, P.yellow);
  for (const x0 of [18, 42]) for (let x = x0; x < x0 + 4; x++) rect(img, x, 11, 1, 15, x % 2 ? P.navy2 : P.slate);
  rect(img, 30, 2, 4, 2, P.red);
  // a bag on its way in
  rect(img, 4, 13, 9, 7, P.navy2);
  rect(img, 4, 13, 9, 1, P.slate2);
  rect(img, 7, 12, 3, 1, P.slate);
  // the screen, with a bag in blue and orange
  rect(img, 50, 2, 12, 11, P.slate);
  rect(img, 51, 3, 10, 8, '#1d2238');
  rect(img, 52, 5, 7, 4, P.blue);
  rect(img, 54, 6, 3, 2, P.orange);
  rect(img, 55, 13, 2, 7, P.slate);
  outlineAround(img);
  return { img, anchor: [32, 33] };
}

function canalVerde() {
  const img = blank(16, 36);
  rect(img, 7, 14, 2, 20, P.slate2);
  rect(img, 5, 33, 6, 3, P.slate);
  rect(img, 1, 1, 14, 14, P.green);
  rect(img, 1, 1, 14, 1, P.greenHi);
  rect(img, 2, 2, 12, 12, P.green);
  for (const [x, y] of [[4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]]) { dot(img, x, y, P.white); dot(img, x, y + 1, P.white); }
  outlineAround(img);
  return { img, anchor: [8, 35] };
}

function lanchonete() {
  const img = blank(64, 60);
  // the posts and the green-and-yellow awning
  for (const x of [1, 61]) rect(img, x, 8, 2, 30, P.woodDk);
  for (let x = 0; x < 64; x++) for (let y = 9; y < 18; y++) {
    const stripe = Math.floor(x / 6) % 2;
    const scallop = y >= 16 && ((x % 6) - 2.5) ** 2 > 6 + (y - 16) * 2;
    if (scallop) continue;
    put(img, x, y, stripe ? (y < 11 ? P.yellowHi : P.yellow) : y < 11 ? P.greenHi : P.green);
  }
  // the sign board
  rect(img, 2, 0, 60, 9, P.cream);
  rect(img, 2, 0, 60, 1, P.white);
  rect(img, 2, 8, 60, 1, P.creamLo);
  const label = 'PÃO DE QUEIJO';
  text(img, Math.floor((64 - textW(label)) / 2), 2, label, P.woodDk);
  // behind the counter: the espresso machine, cups on top
  rect(img, 40, 20, 17, 13, P.lav3);
  rect(img, 40, 20, 17, 2, P.lav4);
  rect(img, 42, 26, 3, 4, P.slate);
  rect(img, 51, 26, 3, 4, P.slate);
  dot(img, 48, 23, P.red);
  for (const x of [41, 45, 49]) { rect(img, x, 17, 3, 3, P.white); dot(img, x, 17, P.lav2); }
  // the glass case with the pães de queijo
  rect(img, 4, 22, 32, 12, P.lav);
  rect(img, 5, 23, 30, 10, P.cream);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
    const x = 6 + i * 4 + r * 2, y = 25 + r * 4;
    rect(img, x, y, 3, 3, P.yellowLo);
    dot(img, x, y, P.yellowHi);
    dot(img, x + 2, y + 2, P.woodLo);
  }
  glassRect(img, 5, 23, 30, 6, 90);
  glint(img, 5, 23, 30, 10, 2);
  // the counter: a cream top over a wooden front
  rect(img, 0, 33, 64, 4, P.cream);
  rect(img, 0, 33, 64, 1, P.white);
  rect(img, 0, 37, 64, 19, P.wood);
  for (let y = 39; y < 56; y += 4) rect(img, 0, y, 64, 1, P.woodLo);
  rect(img, 0, 37, 64, 1, P.woodHi);
  rect(img, 0, 56, 64, 4, P.green);
  rect(img, 0, 56, 64, 1, P.greenHi);
  // the price card
  rect(img, 26, 42, 12, 8, P.yellow);
  text(img, 27, 43, 'R$4', P.navy);
  outlineAround(img);
  return { img, anchor: [32, 59] };
}

function placaOnibus() {
  const img = blank(16, 34);
  rect(img, 7, 12, 2, 21, P.slate2);
  rect(img, 7, 12, 1, 21, P.mist);
  rect(img, 5, 32, 6, 2, P.slate);
  rect(img, 1, 0, 14, 13, P.blueLo);
  rect(img, 1, 0, 14, 1, P.blue);
  ICONS.aviao.forEach((row, ry) => [...row].forEach((c, rx) => c === '#' && dot(img, 4 + rx, 1 + ry, P.white)));
  rect(img, 1, 13, 14, 6, P.yellow);
  text(img, 2, 13, '875', P.navy);
  outlineAround(img);
  return { img, anchor: [8, 33] };
}

// ------------------------------------------------------------------ the diary's small things (grids; the outline is added)
const ITEM_PAL = {
  k: P.slate, g: P.mist, w: P.white, i: P.lav4,
  r: P.red, p: P.redHi, R: P.redLo,
  e: P.green, f: P.greenHi, E: P.greenDk,
  y: P.yellow, Y: P.yellowHi, o: P.yellowLo,
  b: P.blue, c: P.blueHi, B: P.blueDk,
  v: '#8a6bbf', V: '#5e4a96',
};
const ITEMS = {
  mala: [
    '....kkkk....',
    '....k..k....',
    '.pppppppppp.',
    '.prrRrrRrrR.',
    '.prrRrrRrrR.',
    '.prrRrrRrrR.',
    '.prrRrrRrrR.',
    '.prrRrrRrrR.',
    '.prrRrrRrrR.',
    '.RRRRRRRRRR.',
    '..k......k..',
  ],
  etiqueta: [
    '..kkk.....',
    '.k...k....',
    '..k.k.....',
    '...k......',
    '.YYYYYYY..',
    '.YyyyyyyY.',
    '.YywwwwyY.',
    '.YywBBwyY.',
    '.YywwwwyY.',
    '.YyyyyyyY.',
    '..ooooooo.',
  ],
  mochila: [
    '...kkkk...',
    '..k....k..',
    '.ffffffff.',
    'fEeeeeeeEe',
    'eEeeeeeeEe',
    'eEEEEEEEEe',
    'eEeyyyyeEe',
    'eEeyooyeEe',
    'eEEEEEEEEe',
    '.eeeeeeee.',
  ],
  fone: [
    '...kkkkkk...',
    '..k......k..',
    '.k........k.',
    '.k........k.',
    'pp........pp',
    'rR........Rr',
    'rR........Rr',
    '.R........R.',
  ],
  cinto: [
    '..............BB.',
    'BBBBBBggggBBBBbB.',
    'bbbbbbgwwgbbbbB..',
    'BBBBBBggggBBBB...',
  ],
  bilhete: [
    'wwwwwwwwwwwww',
    'wccccccwiwiww',
    'wwwwwwwwiwiww',
    'wkkwkwkkiwiww',
    'wkkwkwkkiwiww',
    'wwwwwwwwwwwww',
  ],
};
function item(name) {
  const rows = ITEMS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const img = blank(w + 2, rows.length + 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && put(img, x + 1, y + 1, ITEM_PAL[ch])));
  outlineAround(img);
  return { img, anchor: [Math.floor(img.w / 2), img.h - 1] };
}

// ------------------------------------------------------------------ parts for the import pipeline
const solid = (fp, shadow = 'fx/shadow_16', cast = true) => ({ footprint: fp, shadow, ...(cast ? { cast: { kx: 0.4, ky: 0.22 } } : {}) });

export async function aeroporto() {
  const parts = [];
  const add = (key, made, meta) => parts.push({ key, ...made, meta });
  add('aero/aviao', aviao(), solid([12, 3], null));
  add('aero/ponte', ponte(), solid([3, 2], null));
  add('aero/aviao_pista', aviaoPista(), solid([6, 1], null, false));
  add('aero/fumaca', fumaca(), solid([1, 1], null, false));
  add('aero/torre', torre(), solid([2, 2], 'fx/shadow_32'));
  add('aero/rebocador', rebocador(), solid([5, 1], 'fx/shadow_48'));
  add('aero/luz_pista', luzPista(), solid([1, 1], null, false));
  add('aero/vidraca', vidraca(), solid([1, 1], null, false));
  add('aero/vidraca_letreiro', vidracaLetreiro(), solid([6, 1], null, false));
  add('aero/portao', portao(), solid([3, 1], null, false));
  add('aero/vidraca_baixa', vidracaBaixa(), solid([1, 1], null, false));
  add('aero/porta_auto', portaAuto(), solid([2, 1], null, false));
  add('aero/cadeiras', cadeiras(), solid([3, 1], 'fx/shadow_48'));
  add('aero/placa_terminal', placa('TERMINAL', 'aviao', 3), solid([3, 1], null, false));
  add('aero/placa_bagagem', placa('BAGAGEM', 'mala', 3), solid([3, 1], null, false));
  add('aero/placa_alfandega', placa('ALFÂNDEGA', 'lupa', 3), solid([3, 1], null, false));
  add('aero/placa_desembarque', placa('DESEMBARQUE', 'pouso', 4), solid([4, 1], null, false));
  add('aero/painel', painel(), solid([3, 1], 'fx/shadow_48'));
  add('aero/balcao_portao', balcaoPortao(), solid([2, 1], 'fx/shadow_32'));
  add('aero/informacoes', informacoes(), solid([3, 1], 'fx/shadow_48'));
  add('aero/cabine', cabine(true), solid([3, 2], 'fx/shadow_48'));
  add('aero/cabine_fechada', cabine(false), solid([3, 2], 'fx/shadow_48'));
  add('aero/fila', fila(), solid([3, 1], null, false));
  add('aero/faixa', faixa(), solid([6, 1], null, false));
  const est = esteiraFrames();
  parts.push({ key: 'aero/esteira', frames: est.frames, fps: 6, anchor: est.anchor, meta: solid([6, 2], 'fx/shadow_48') });
  add('aero/carrinho', carrinho(true), solid([1, 1]));
  add('aero/carrinho_vazio', carrinho(false), solid([1, 1]));
  add('aero/raiox', raiox(), solid([4, 1], 'fx/shadow_48'));
  add('aero/canal_verde', canalVerde(), solid([1, 1], 'fx/shadow_10'));
  add('aero/lanchonete', lanchonete(), solid([4, 2], 'fx/shadow_48'));
  add('aero/placa_onibus', placaOnibus(), solid([1, 1], 'fx/shadow_10'));
  for (const name of Object.keys(ITEMS)) add(`aero/${name}`, item(name), solid([1, 1], 'fx/shadow_10', false));
  return parts;
}

/** scratch preview hook: every part on one sheet */
export async function preview() {
  return (await aeroporto()).map((p) => p.img ?? p.frames[0]);
}
