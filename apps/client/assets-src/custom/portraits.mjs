// NPC dialogue portraits: 64x64, 4 expressions each (neutro, feliz, surpreso, pensativo). A portrait is a close-up of the sprite.
//
// Each one starts from the sheet the world draws (looks.ts -> composeLook, through lookkit.mjs): the south-facing idle frame, so the skin,
// hair, hat, outfit, apron, glasses, earrings and props are the NPC's own pixels and a change to NPC_STYLES shows up here on the next
// `pnpm pixel`. The bust is cut from that frame (head and shoulders, 20 x 20 sprite px), the eye row and the mouth row are each shown twice
// so the face has room, the face marks are lifted off, and the frame is scaled 3x with Scale3x: every output pixel is a copy of one sprite
// pixel, so the palette is the sprite's and nothing is blurred. The silhouette outline is thinned back to 1 px, then the eyes, brows and
// mouth are redrawn per expression from the sprite's own iris, brow, skin and lip colours, glasses are redrawn thin, and the bust is set
// on the background of the NPC's room inside the shared frame (portraitbg.mjs).
import { blank, put, mix, NAVY } from './paint.mjs';
import { lookKit, charLayers, sheetFrame, SHEET_W, SHEET_H } from './lookkit.mjs';
import { BACKGROUNDS, TARP, frame } from './portraitbg.mjs';
import { FRAME_W, FRAME_H, CANON_COLS, CANON_ROWS } from '../../../../scripts/lib/pixel/chars.mjs';

export const EXPRESSIONS = ['neutro', 'feliz', 'surpreso', 'pensativo'];
export const NPCS = ['carlos', 'nanda', 'julia', 'graca', 'tia_lu', 'prof', 'ze', 'chico', 'rosa', 'lucia', 'celia', 'agente'];

const SIZE = 64;
const S = 3; // Scale3x
const OX = 2, OY = 2; // inside the 2 px frame
const WIN = 20; // sprite px across the window (60 px at 3x)

/**
 * Hand-touches per NPC, in sprite px of the south idle frame. `bottom`: the last sprite row in the window (default: the eye row + 5,
 * the shoulders). `eyes`: the two eyes' [x0, x1] when the sprite's eye pixels sit off the face. `mouth`: the sprite's mouth pixels when
 * they cannot be told from blush and scarf by colour. `room`: the background when the NPC has no room in ROOMS. `browHidden`: under a brim.
 */
const TUNE = {
  carlos: {},
  nanda: {},
  // the smile is the navy line and the teeth; the reds next to it are the blush and the scarf
  julia: { mouth: [[8, 21], [9, 21], [10, 21], [5, 22], [6, 22], [7, 22], [8, 22]] },
  graca: {},
  tia_lu: {},
  prof: {},
  ze: {},
  chico: {},
  // her sprite's eyes sit on the locks either side of the face (they read at 1x); the portrait puts them on the face
  rosa: { eyes: [[5, 6], [9, 10]] },
  lucia: { room: 'escola' },
  celia: { room: 'aeroporto' },
  agente: { room: 'aeroporto', browHidden: true },
};

// ------------------------------------------------------------------ pixels
const rgbaAt = (img, x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : ((img.data[(y * img.w + x) * 4] << 24) | (img.data[(y * img.w + x) * 4 + 1] << 16) | (img.data[(y * img.w + x) * 4 + 2] << 8) | img.data[(y * img.w + x) * 4 + 3]) >>> 0);
const alpha = (img, x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : img.data[(y * img.w + x) * 4 + 3]);
const hexAt = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return '#' + [0, 1, 2].map((c) => img.data[i + c].toString(16).padStart(2, '0')).join('');
};
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lumaOf = (hex) => { const [r, g, b] = rgbOf(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };
const setRgba = (img, x, y, v) => {
  const i = (y * img.w + x) * 4;
  img.data[i] = v >>> 24; img.data[i + 1] = (v >>> 16) & 255; img.data[i + 2] = (v >>> 8) & 255; img.data[i + 3] = v & 255;
};
const copyPx = (dst, x, y, src, sx, sy) => setRgba(dst, x, y, rgbaAt(src, sx, sy));

/**
 * Scale3x (AdvMAME3x) on a small image. Returns the 3x image; `from[i]` is the index of the source pixel output pixel i copies,
 * so a flag on a source pixel (it is on the silhouette edge) carries over.
 */
export function scale3x(img) {
  const W3 = img.w * 3, out = blank(W3, img.h * 3), from = new Int32Array(W3 * img.h * 3);
  const P = (x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : rgbaAt(img, x, y));
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const A = P(x - 1, y - 1), B = P(x, y - 1), C = P(x + 1, y - 1), D = P(x - 1, y), E = P(x, y), F = P(x + 1, y), G = P(x - 1, y + 1), H = P(x, y + 1), I = P(x + 1, y + 1);
    const idx = { A: [x - 1, y - 1], B: [x, y - 1], D: [x - 1, y], E: [x, y], F: [x + 1, y], H: [x, y + 1] };
    let e = ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'E'];
    if (B !== H && D !== F) {
      e = [
        D === B ? 'D' : 'E',
        (D === B && E !== C) || (B === F && E !== A) ? 'B' : 'E',
        B === F ? 'F' : 'E',
        (D === B && E !== G) || (D === H && E !== A) ? 'D' : 'E',
        'E',
        (B === F && E !== I) || (H === F && E !== C) ? 'F' : 'E',
        D === H ? 'D' : 'E',
        (D === H && E !== I) || (H === F && E !== G) ? 'H' : 'E',
        H === F ? 'F' : 'E',
      ];
    }
    for (let k = 0; k < 9; k++) {
      const ox = x * 3 + (k % 3), oy = y * 3 + Math.floor(k / 3);
      const [sx, sy] = idx[e[k]];
      setRgba(out, ox, oy, P(sx, sy));
      from[oy * W3 + ox] = sx < 0 || sy < 0 || sx >= img.w || sy >= img.h ? -1 : sy * img.w + sx;
    }
  }
  return { img: out, from };
}

/**
 * The silhouette outline comes out 3 px thick at 3x: keep the outermost pixel (it touches the outside) and give the inner two the
 * colour of the part they sit on.
 */
function thinOutline(img, from, edge) {
  const isEdge = (x, y) => alpha(img, x, y) > 0 && from[y * img.w + x] >= 0 && edge[from[y * img.w + x]];
  const outside = (x, y) => alpha(img, x, y) === 0;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let pass = 0; pass < 2; pass++) {
    const swaps = [];
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      if (!isEdge(x, y) || N4.some(([dx, dy]) => outside(x + dx, y + dy))) continue;
      let part = null;
      for (const list of [N4, N8]) {
        for (const [dx, dy] of list) if (alpha(img, x + dx, y + dy) > 0 && !isEdge(x + dx, y + dy)) { part = [x + dx, y + dy]; break; }
        if (part) break;
      }
      if (part) swaps.push([x, y, rgbaAt(img, part[0], part[1]), from[part[1] * img.w + part[0]]]);
    }
    for (const [x, y, v, f] of swaps) { setRgba(img, x, y, v); from[y * img.w + x] = f; }
  }
}

// ------------------------------------------------------------------ reading the sprite's face
const isFaceLayer = (k) => k.startsWith('eyes_') || k.startsWith('face_');

/** The south idle frame of a look, composed exactly like the world does it. */
function composeFrame(K, src, look) {
  return sheetFrame({ w: SHEET_W, h: SHEET_H, data: new Uint8Array(K.composeLook(src, look)) }, 0, 0);
}

/**
 * Where the face is: the eye row and the two eyes (whites and iris), the brows, the mouth, and which pixels the face layers drew.
 * Signature faces (the five regulars) carry the beard, the mustache and Rosa's hoops too: those stay, only eyes, brows and mouth lift.
 */
function readFace(full, bare, glasses, tune = {}) {
  const marks = (x, y) => rgbaAt(full, x, y) !== rgbaAt(bare, x, y);
  const light = (x, y) => alpha(full, x, y) > 0 && lumaOf(hexAt(full, x, y)) > 205;
  // the eye row: the row with the most light marks inside the face (the whites); behind glasses, the lens rows
  let eyeRow = -1, best = 0;
  for (let y = 12; y < 27; y++) {
    let n = 0;
    for (let x = 2; x < 14; x++) if ((glasses ? glasses.lens(x, y) : marks(x, y) && light(x, y))) n++;
    if (n > best) { best = n; eyeRow = y; }
  }
  if (eyeRow < 0) throw new Error('portrait: no eyes found on the sprite');
  if (glasses) eyeRow = glasses.lensRows[glasses.lensRows.length - 1];
  const eyes = [];
  for (const side of [0, 1]) {
    const xs = [];
    for (let x = side ? 8 : 2; x < (side ? 14 : 8); x++) if (glasses ? glasses.lens(x, eyeRow) : marks(x, eyeRow)) xs.push(x);
    if (!xs.length) continue;
    const white = xs.find((x) => light(x, eyeRow)) ?? (side ? xs[0] : xs[xs.length - 1]);
    const iris = xs.find((x) => !light(x, eyeRow));
    const [x0, x1] = tune.eyes?.[side] ?? [Math.min(...xs), Math.max(...xs)];
    eyes.push({ x0, x1, irisRight: iris === undefined ? !side : iris > white, iris: iris === undefined || glasses ? null : hexAt(full, iris, eyeRow) });
  }
  // brows: marks up to three rows over the eyes, inside the face
  const brow = [];
  for (let y = eyeRow - 3; y < eyeRow; y++) for (let x = 2; x < 14; x++) if (marks(x, y) && !light(x, y)) brow.push([x, y]);
  const browHex = brow.length ? hexAt(full, ...brow[0]) : null;
  const browRow = brow.length ? Math.max(...brow.map(([, y]) => y)) : eyeRow - 2;
  // the mouth: lip-coloured or navy marks just under the eyes, near the middle (dark beard and grey mustache stay)
  const mouth = tune.mouth ? [...tune.mouth] : [];
  if (!tune.mouth) for (let y = eyeRow + 1; y <= eyeRow + 2; y++) for (let x = 5; x < 11; x++) {
    if (!marks(x, y) || alpha(full, x, y) === 0) continue;
    const [r, g, b] = rgbOf(hexAt(full, x, y));
    const navy = Math.abs(r - 0x3a) < 8 && Math.abs(g - 0x3a) < 8 && Math.abs(b - 0x50) < 8;
    if (navy || (r - b > 30 && 0.299 * r + 0.587 * g + 0.114 * b > 60)) mouth.push([x, y]);
  }
  return { eyeRow, eyes, brow, browHex, browRow, mouth, marks };
}

// ------------------------------------------------------------------ the expressions (portrait px)
// Eye grids, iris on the right (mirrored when the sprite's iris sits on the left). o lash, w white, i iris, p pupil, h light, l lid.
const EYE = {
  neutro: ['.oooo.', 'owwhpo', 'owwiio', '.wwww.'],
  feliz: ['......', '.oooo.', 'o....o', '......'],
  surpreso: ['.oooo.', 'owwwwo', 'owwhpo', 'owwiio', '.oooo.'],
  pensativo: ['oooooo', 'lwwhpo', '.wwiio', '......'],
};
const EYE_DY = { neutro: 1, feliz: 1, surpreso: 0, pensativo: 1 };
// Brows over the left eye (viewer's left); the right one is mirrored. B brow.
const BROW = {
  neutro: [['.BBBBB', 'BB....'], 0],
  feliz: [['.BBBB.', 'B....B'], -1],
  surpreso: [['..BBB.', '.B...B', 'B.....'], -3],
  pensativo: [['BBBB..', '....BB'], 0],
};
const MOUTH = {
  feliz: ['dddddd', 'dwwwwd', '.dttd.'],
  surpreso: ['.dd.', 'dmmd', 'dmmd', '.dd.'],
  pensativo: ['....dd', '.dddd.', 'd.....'],
  neutro: ['.dddd.'],
};

function grid(img, rows, pal, x0, y0, mirror = false) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.' || !pal[ch]) return;
    put(img, mirror ? x0 + row.length - 1 - i : x0 + i, y0 + j, pal[ch]);
  }));
}

// ------------------------------------------------------------------ one NPC
async function npcParts(K, src, id) {
  const tune = TUNE[id] ?? {};
  const look = K.lookForNpc(id);
  const hasGlasses = look.layers.some((l) => l.key === 'extra_oculos');
  const full = composeFrame(K, src, look);
  // under the glasses: the same face without them (the lenses are redrawn thin after the scale)
  const noGlasses = hasGlasses ? composeFrame(K, src, { ...look, layers: look.layers.filter((l) => l.key !== 'extra_oculos') }) : full;
  const bare = composeFrame(K, src, { ...look, layers: look.layers.filter((l) => !isFaceLayer(l.key) && l.key !== 'extra_oculos') });
  let glasses = null;
  if (hasGlasses) {
    const on = (x, y) => rgbaAt(full, x, y) !== rgbaAt(noGlasses, x, y);
    const lens = (x, y) => on(x, y) && lumaOf(hexAt(full, x, y)) > 150;
    const lensRows = [];
    for (let y = 12; y < 27; y++) if ([...Array(12).keys()].some((i) => lens(i + 2, y))) lensRows.push(y);
    let frameHex = null, lensHex = null;
    for (let y = 12; y < 27 && !(frameHex && lensHex); y++) for (let x = 2; x < 14; x++) if (on(x, y)) {
      if (lens(x, y) && lumaOf(hexAt(full, x, y)) < 245) lensHex ??= hexAt(full, x, y);
      else if (!lens(x, y)) frameHex ??= hexAt(full, x, y);
    }
    glasses = { on, lens, lensRows, frameHex: frameHex ?? NAVY, lensHex: lensHex ?? '#c6ecff' };
  }
  const face = readFace(noGlasses, bare, glasses, tune);
  const { eyeRow } = face;
  // the LimeZu body has its own navy eye marks under the eye layer: paint them skin (the colour between the eyes)
  const mid = face.eyes.length === 2 ? Math.floor((face.eyes[0].x1 + face.eyes[1].x0 + 1) / 2) : 7;
  const skinHex = hexAt(bare, mid, eyeRow);
  for (let y = eyeRow - 1; y <= eyeRow + 2; y++) for (let x = 3; x < 13; x++) {
    if (alpha(bare, x, y) === 0) continue;
    const [r, , b] = rgbOf(hexAt(bare, x, y));
    if (b > r) put(bare, x, y, skinHex);
  }

  // the lifted frame: eyes, brows, mouth (and the glasses) back to the bare skin under them. A pack face (eyes + brows + blush layers)
  // lifts whole; a regular's own face keeps what is not eyes, brows or mouth (beard, mustache, hoops).
  const ownFace = look.layers.some((l) => l.key.startsWith('face_npc_'));
  const lifted = { w: full.w, h: full.h, data: new Uint8Array(full.data) };
  for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) {
    const inEye = y === eyeRow && x >= 2 && x < 14 && (face.marks(x, y) || glasses?.on(x, y));
    const inBrow = face.brow.some(([bx, by]) => bx === x && by === y);
    const inGlass = glasses?.on(x, y) && y >= eyeRow - 2 && y <= eyeRow + 1 && x >= 2 && x < 14;
    const packMark = !ownFace && face.marks(x, y);
    if (inEye || inBrow || inGlass || packMark) copyPx(lifted, x, y, bare, x, y);
  }
  // the sprite's mouth is a pixel or two: it is redrawn thin at portrait size, in the sprite's mouth colour
  const mouthDark = face.mouth.map(([x, y]) => hexAt(noGlasses, x, y)).sort((a, b) => lumaOf(a) - lumaOf(b))[0] ?? null;
  for (const [x, y] of face.mouth) copyPx(lifted, x, y, bare, x, y);

  // the window: 20 sprite columns around the body, rows down to the shoulders. The eye row and the row over it are shown twice (the
  // face gets room for the eyes and brows); above the brows a hair row that repeats the one under it is dropped (the hair mass is
  // shorter, the hat keeps its crown).
  const bottom = tune.bottom ?? eyeRow + 5;
  const mouthRow = face.mouth.length ? Math.min(...face.mouth.map(([, y]) => y)) : eyeRow + 1;
  const rowDiff = (a, b) => { let n = 0; for (let x = 0; x < FRAME_W; x++) if (rgbaAt(lifted, x, a) !== rgbaAt(lifted, x, b)) n++; return n; };
  const rows = [];
  let skipped = false;
  for (let y = bottom; rows.length < WIN && y >= 0; y--) {
    // a row of the hair or hat mass that is (almost) the one under it is dropped, never two in a row
    if (y < face.browRow - 1 && rows.length && !skipped && rowDiff(y, rows[0]) <= (tune.squeeze ?? 2)) { skipped = true; continue; }
    skipped = false;
    rows.unshift(y);
    if ((y === eyeRow || y === eyeRow - 1) && rows.length < WIN) rows.unshift(y);
  }
  while (rows.length < WIN) rows.unshift(rows[0] - 1);
  if (process.env.PORTRAIT_DEBUG) console.log(id, JSON.stringify({ eyeRow, eyes: face.eyes, browRow: face.browRow, brow: face.brow, mouth: face.mouth, rows }));
  const X0 = Math.round((FRAME_W - WIN) / 2) + (tune.dx ?? 0);
  const rowAt = (sy) => rows.indexOf(sy);
  const P = (sx, sy) => [OX + (sx - X0) * S, OY + rowAt(sy) * S];

  // the sprite's colours for the redraw
  const skinAt = (x, y) => hexAt(bare, x, y);
  const eyeL = face.eyes[0] ?? { x0: 4, x1: 5, irisRight: true };
  const skin = skinAt(Math.round((eyeL.x0 + eyeL.x1) / 2), eyeRow);
  const skinShade = mix(skin, '#5a2a2a', 0.28);
  const iris = face.eyes.find((e) => e.iris && lumaOf(e.iris) > 40)?.iris ?? '#573c2c';
  const lash = '#2a2030';
  const hairHex = look.layers.find((l) => l.key.startsWith('hair_'))?.ramps?.hair ?? '#1d1716';
  const browHex = face.browHex ?? mix(hairHex, lash, 0.3);
  const lip = tune.lip ?? (mouthDark && lumaOf(mouthDark) < lumaOf(skin) - 30 ? mouthDark : mix(skin, '#6a2028', 0.55));
  const mouthX = face.eyes.length === 2 ? (face.eyes[0].x1 + face.eyes[1].x0 + 1) / 2 : 8;

  // the room behind them (ROOMS: who stands where); the open-air streets get the praça
  const room = tune.room ?? Object.values(K.ROOMS).find((r) => r.npcs?.some((n) => n.id === id))?.id ?? 'praca';
  const bgKind = BACKGROUNDS[room] ? room : 'praca';

  // the 20 x 20 window, scaled once: the expressions only differ in the face drawn over it
  const win = blank(WIN, WIN);
  const edge = new Uint8Array(WIN * WIN);
  rows.forEach((sy, wy) => {
    for (let wx = 0; wx < WIN; wx++) {
      const sx = X0 + wx;
      copyPx(win, wx, wy, lifted, sx, sy);
      if (alpha(lifted, sx, sy) > 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => alpha(lifted, sx + dx, sy + dy) === 0)) edge[wy * WIN + wx] = 1;
    }
  });
  const { img: big, from } = scale3x(win);
  thinOutline(big, from, edge);
  const base = blank(SIZE, SIZE);
  BACKGROUNDS[bgKind](base, TARP[id]);
  for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) if (alpha(big, x, y) > 0) copyPx(base, OX + x, OY + y, big, x, y);

  const parts = [];
  for (const expr of EXPRESSIONS) {
    const img = { w: SIZE, h: SIZE, data: new Uint8Array(base.data) };
    if (process.env.PORTRAIT_RAW) { frame(img); parts.push({ key: `portraits/${id}_${expr}`, img }); continue; }
    // eyes
    const eyeTop = P(0, eyeRow)[1];
    for (const e of face.eyes) {
      const [ex] = P(e.x0, eyeRow);
      const w = (e.x1 - e.x0 + 1) * S;
      const g = EYE[expr];
      const gx = ex + Math.round((w - 6) / 2);
      grid(img, g, { o: lash, w: '#f4f1ea', i: iris, p: mix(iris, '#100c18', 0.6), h: '#ffffff', l: skinShade }, gx, eyeTop + EYE_DY[expr], !e.irisRight);
    }
    // brows
    if (!tune.browHidden && face.eyes.length) {
      const [rowsB, dy] = BROW[expr];
      const by = P(0, face.browRow)[1] + 1 + dy;
      face.eyes.forEach((e, i) => {
        const [ex] = P(e.x0, eyeRow);
        const w = (e.x1 - e.x0 + 1) * S;
        const gx = ex + Math.round((w - 6) / 2);
        // pensativo: one brow up, the other down
        const tilt = expr === 'pensativo' && i === 1 ? -2 : 0;
        grid(img, rowsB, { B: browHex }, gx, by + tilt, i === 1);
      });
    }
    // mouth
    const [mx0, my0] = P(Math.floor(mouthX), mouthRow);
    const mx = mx0 + (mouthX % 1 ? S / 2 : 0);
    const g = MOUTH[expr];
    grid(img, g, { d: lip, w: '#f6f0e6', t: '#d56868', m: '#4a1a24' }, Math.round(mx - g[0].length / 2 + S / 2), my0 + (expr === 'surpreso' ? 0 : 1));
    if (expr === 'feliz') {
      const blush = mix(skin, '#e86060', 0.35);
      for (const e of face.eyes) {
        const [ex] = P(e.x0, eyeRow);
        const left = e === face.eyes[0];
        for (const [dx, dy] of [[0, 0], [1, 0], [2, 0]]) put(img, ex + (left ? -1 : 4) + dx, eyeTop + 7 + dy, blush);
      }
    }
    // glasses, thin: a 1 px frame round each lens, the bridge, a glint on the lens
    if (glasses) {
      for (const e of face.eyes) {
        const [ex] = P(e.x0, eyeRow);
        const w = (e.x1 - e.x0 + 1) * S;
        const x0 = ex - 1, x1 = ex + w, y0 = eyeTop - 1, y1 = eyeTop + 6;
        for (let x = x0; x <= x1; x++) { put(img, x, y0, glasses.frameHex); put(img, x, y1, glasses.frameHex); }
        for (let y = y0; y <= y1; y++) { put(img, x0, y, glasses.frameHex); put(img, x1, y, glasses.frameHex); }
        put(img, x0 + 1, y0 + 1, glasses.lensHex);
        put(img, x0 + 2, y0 + 1, glasses.lensHex);
        put(img, x0 + 1, y0 + 2, glasses.lensHex);
      }
      if (face.eyes.length === 2) {
        const [a] = P(face.eyes[0].x1, eyeRow), [b] = P(face.eyes[1].x0, eyeRow);
        for (let x = a + S; x < b; x++) put(img, x, eyeTop, glasses.frameHex);
      }
    }
    frame(img);
    parts.push({ key: `portraits/${id}_${expr}`, img });
  }
  return parts;
}

let cache = null;
/** `ctx.charLayers`: the character layers `pnpm pixel` just built (else the committed public/pixel/chars are read). */
export async function portraitParts(ctx = {}) {
  if (cache && !ctx.charLayers) return cache;
  const K = await lookKit();
  const layers = await charLayers(ctx.charLayers);
  const src = { sheetW: SHEET_W, sheetH: SHEET_H, geometry: { frameW: FRAME_W, frameH: FRAME_H, cols: CANON_COLS, rows: CANON_ROWS }, layer: (k) => layers.get(k) };
  const parts = [];
  for (const id of NPCS) parts.push(...(await npcParts(K, src, id)));
  if (!ctx.charLayers) cache = parts;
  return parts;
}

/** scratch preview hook: preview('carlos') -> 4 expressions */
export async function preview(...npcs) {
  const parts = await portraitParts();
  return parts.filter((p) => !npcs.length || npcs.some((n) => p.key.startsWith(`portraits/${n}_`))).map((p) => p.img);
}
