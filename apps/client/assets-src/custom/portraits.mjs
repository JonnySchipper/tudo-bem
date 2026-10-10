// NPC dialogue portraits: 64x64, 4 expressions each (neutro, feliz, surpreso, pensativo). A portrait IS the sprite.
//
// Each one is the sheet the world draws (looks.ts -> composeLook, through lookkit.mjs): a 20 x 20 sprite-pixel window around the head
// and shoulders of a south-facing frame, scaled 3x with nothing in between (every output pixel is one sprite pixel, the outline, the
// shading and the face are the sprite's own), set on the background of the NPC's room inside the shared 2 px frame (portraitbg.mjs).
// The expressions are the sprite's own frames: `neutro` the idle, `feliz` the laugh (the `rir` emote: eyes shut happy, open mouth),
// `pensativo` eyes closed (the blink frame of the idle; a regular with a signature face has no blink, and glasses hide it, so they get
// the closed-eye smile of the second laugh frame), `surpreso` the idle with the brows lifted one row and the mouth a small "o", in the sprite's own pixels.
import { blank } from './paint.mjs';
import { lookKit, charLayers, sheetFrame, SHEET_W, SHEET_H } from './lookkit.mjs';
import { BACKGROUNDS, TARP, frame } from './portraitbg.mjs';
import { FRAME_W, FRAME_H, CANON_COLS, CANON_ROWS, CANON_ANIMS } from '../../../../scripts/lib/pixel/chars.mjs';
import { BLINK_FRAME } from './chars.mjs';

export const EXPRESSIONS = ['neutro', 'feliz', 'surpreso', 'pensativo'];
export const NPCS = ['carlos', 'nanda', 'julia', 'graca', 'tia_lu', 'prof', 'ze', 'chico', 'rosa', 'lucia', 'celia', 'agente', 'dito'];

const SIZE = 64;
const S = 3;
const OX = 2, OY = 2; // inside the 2 px frame
const WIN = 20; // sprite px across the window (60 px at 3x)
const X0 = Math.round((FRAME_W - WIN) / 2); // the 16 px frame sits centred in the 20 px window

/** [row, col] of the sheet frame each expression shows (`surpreso` is the idle, touched up) */
const FRAME_OF = (signature) => ({
  neutro: [0, 0],
  feliz: [CANON_ANIMS.rir.row, 0],
  surpreso: [0, 0],
  pensativo: signature ? [CANON_ANIMS.rir.row, 1] : [0, BLINK_FRAME],
});
/** the authored mouth colour (charedit.mjs LEGEND M) */
const MOUTH = [0x8a, 0x3f, 0x3a];

/** NPCs that stand in no ROOMS entry: the room their portrait is set in */
const ROOM_OF = { lucia: 'escola', celia: 'aeroporto', agente: 'aeroporto' };

const alpha = (img, x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : img.data[(y * img.w + x) * 4 + 3]);
const firstOpaqueRow = (img) => {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (alpha(img, x, y)) return y;
  return -1;
};
const rgbaAt = (img, x, y) => img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4);
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
/** source-over of one sprite pixel onto the background pixel (the hair's fringe shadow, the blush and the hair's glint are translucent) */
const blendPx = (dst, x, y, src, sx, sy) => {
  const di = (y * dst.w + x) * 4, si = (sy * src.w + sx) * 4;
  const a = src.data[si + 3] / 255;
  for (let q = 0; q < 3; q++) dst.data[di + q] = Math.round(src.data[si + q] * a + dst.data[di + q] * (1 - a));
  dst.data[di + 3] = 255;
};

/**
 * Surprised, in sprite pixels: the face marks (brows, lashes, eyes) move up one row where bare skin is above them, so the eyes open
 * wide under lifted brows, and the authored mouth becomes a single dark pixel. `bare` is the same frame without the face layers (a
 * moved mark leaves the skin that was under it); `body` is the body alone (a mark only moves onto skin, never over a brim or the hair).
 */
function surprise(fr, bare, body, eyeRow) {
  const out = { w: fr.w, h: fr.h, data: new Uint8Array(fr.data) };
  const skin = (x, y) => alpha(fr, x, y) > 0 && same(rgbaAt(fr, x, y), rgbaAt(body, x, y));
  for (let y = eyeRow - 4; y <= eyeRow; y++) for (let x = 2; x < 14; x++) {
    if (same(rgbaAt(fr, x, y), rgbaAt(bare, x, y)) || !alpha(fr, x, y)) continue;
    if (!skin(x, y - 1) && !(alpha(fr, x, y - 1) && !same(rgbaAt(fr, x, y - 1), rgbaAt(bare, x, y - 1)))) continue;
    out.data.set(rgbaAt(bare, x, y), (y * fr.w + x) * 4);
    out.data.set(rgbaAt(fr, x, y), ((y - 1) * fr.w + x) * 4);
  }
  const mouth = [];
  for (let y = eyeRow; y <= eyeRow + 2; y++) for (let x = 3; x < 13; x++) {
    const p = rgbaAt(fr, x, y);
    if (p[3] === 255 && p[0] === MOUTH[0] && p[1] === MOUTH[1] && p[2] === MOUTH[2]) mouth.push([x, y]);
  }
  if (mouth.length) {
    for (const [x, y] of mouth) out.data.set(rgbaAt(bare, x, y), (y * fr.w + x) * 4);
    const [x, y] = mouth[mouth.length - 1];
    out.data.set([...MOUTH, 255], (y * fr.w + x) * 4);
  }
  return out;
}

/** The portraits of one NPC: the window rows, from the sprite's head (the body's own top, so a hat does not push the face out). */
async function npcParts(K, src, id) {
  const look = K.lookForNpc(id);
  const compose = (l) => ({ w: SHEET_W, h: SHEET_H, data: new Uint8Array(K.composeLook(src, l)) });
  const sheet = compose(look);
  const isFace = (k) => k.startsWith('eyes_') || k.startsWith('face_');
  // no blink to show: a regular's signature face has none, and glasses hide it
  const signature = look.layers.some((l) => l.key.startsWith('face_npc_') || l.key === 'extra_oculos');
  const bare = compose({ ...look, layers: look.layers.filter((l) => !isFace(l.key)) });
  const bodyOnly = compose({ ...look, layers: look.layers.filter((l) => l.key.startsWith('body_')) });
  const headTop = firstOpaqueRow(sheetFrame(bodyOnly, 0, 0));
  const spriteTop = firstOpaqueRow(sheetFrame(sheet, 0, 0));
  // the eye row is 11 under the head's top; the window ends 5 under it (the shoulders) and may rise two rows for a tall hat
  const eyeRow = headTop + 11;
  const top = Math.max(spriteTop, headTop - 5, Math.min(headTop - 3, spriteTop));
  const room = ROOM_OF[id] ?? Object.values(K.ROOMS).find((r) => r.npcs?.some((n) => n.id === id))?.id ?? 'praca';
  const base = blank(SIZE, SIZE);
  BACKGROUNDS[BACKGROUNDS[room] ? room : 'praca'](base, TARP[id]);
  const faceAt = [Math.round(OX + (FRAME_W / 2 - X0) * S), Math.round(OY + (eyeRow + 1 - top) * S)];
  const parts = [];
  const frames = FRAME_OF(signature);
  for (const expr of EXPRESSIONS) {
    const [row, col] = frames[expr];
    let fr = sheetFrame(sheet, row, col);
    if (expr === 'surpreso') fr = surprise(fr, sheetFrame(bare, row, col), sheetFrame(bodyOnly, row, col), eyeRow);
    const img = { w: SIZE, h: SIZE, data: new Uint8Array(base.data) };
    for (let wy = 0; wy < WIN; wy++) for (let wx = 0; wx < WIN; wx++) {
      const sx = X0 + wx, sy = top + wy;
      if (!alpha(fr, sx, sy)) continue;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) blendPx(img, OX + wx * S + dx, OY + wy * S + dy, fr, sx, sy);
    }
    frame(img);
    parts.push({ key: `portraits/${id}_${expr}`, img, meta: { face: faceAt } });
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
  for (const id of NPCS) parts.push(...(await npcParts(K, src, id)));  if (!ctx.charLayers) cache = parts;
  return parts;
}
