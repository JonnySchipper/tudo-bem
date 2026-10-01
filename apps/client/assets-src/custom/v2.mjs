// Visual pass V2 (composition): preprocessing hooks for pack singles (`prep` in import-map.d/v2.json) and the new authored pieces
// (coreto, mesas de dominó e xadrez, banquinho, pipoqueiro, carrinho de coco, busto, canteiros...). Everything is derived from a LimeZu
// single where one fits, or authored with the pack palette (kit.mjs / paint.mjs).
import { blank, clone, crop, paste, setPx, hexPx, px } from './kit.mjs';
import { coreto } from './v2coreto.mjs';
import * as props2 from './v2props.mjs';

// ------------------------------------------------------------------ prep hooks
const isGreenish = (r, g, b) => g > r + 8 && g >= b - 4;

/** Removes the pack's grass ellipse under a tree (green pixels from row `fromY` down); roots and trunk (brown / tan / grey) stay. */
function stripGrass(img, fromY = 0) {
  const out = clone(img);
  for (let y = fromY; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (!out.data[i + 3]) continue;
    if (isGreenish(out.data[i], out.data[i + 1], out.data[i + 2])) out.data[i + 3] = 0;
  }
  return out;
}

/** Drops semi-transparent pixels (baked soft shadows): the frame draws its own contact and cast shadows. */
function hardAlpha(img) {
  const out = clone(img);
  for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3] > 0 && out.data[i + 3] < 255) out.data[i + 3] = 0;
  return out;
}

/** Crop to the opaque bounding box rows [y0, y1) of the image (after the rect crop); keeps the width. */
function cutRows(img, y0, y1) {
  return crop(img, 0, y0, img.w, (y1 ?? img.h) - y0);
}

/** Removes the orange ring some pack props stand in (the beach palm's base): warm saturated pixels from row `fromY` down. */
function stripRing(img, fromY = 0) {
  const out = clone(img);
  for (let y = fromY; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (!out.data[i + 3]) continue;
    const r = out.data[i], g = out.data[i + 1], b = out.data[i + 2];
    if (r > 200 && g > 110 && g < 190 && b < 110) out.data[i + 3] = 0;
  }
  return out;
}

export const PREP = { stripGrass, hardAlpha, cutRows, stripRing };

export const DERIVE_V2 = {
  coreto,
  mesaDomino: props2.mesaDomino,
  mesaXadrez: props2.mesaXadrez,
  banquinho: props2.banquinhoPart,
  busto: props2.bustoPart,
  canteiroRedondo: props2.canteiroRedondoPart,
  canteiroLosango: props2.canteiroLosangoPart,
  pipoqueiro: props2.pipoqueiro,
  cocoCart: props2.cocoCart,
  bandeirinhas: props2.bandeirinhasPart,
  revisteiro: props2.revisteiroPart,
  parkedFusca: props2.parkedFusca,
  parkedKombi: props2.parkedKombi,
  parkedMoto: props2.parkedMoto,
};
