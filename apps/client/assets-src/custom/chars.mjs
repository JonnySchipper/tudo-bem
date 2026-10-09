// Character layers for Phase 3 (HOWTO 5.5): every creator option as a key-colored canonical sheet (see scripts/lib/pixel/chars.mjs).
//
// Derived from LimeZu's Character Generator: bodies, eyes, hairstyles, outfits (top and bottom halves recolored separately), beard,
// mustache, glasses, phone, and the beanie / snapback / chef / detective hats. Authored in the pack style: face brows and blush, freckles,
// earrings, buns and braids, the emote gestures, the idle-pose props, the NPC pieces and the hats the pack lacks (see hats.mjs).
import path from 'node:path';
import { crop, loadPng, clone, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { toCanonicalSheet, mergeLayers, keyLayer } from '../../../../scripts/lib/pixel/chars.mjs';
import { rowFacing } from '../../../../scripts/lib/pixel/chars.mjs';
import { OUTLINES, alphaAt, anchorOf, anchors, emptySheet, fx, fy, frames, hexAt, keyAuto, keyOutfit, keyRanks, openFringe, putHex, puffHair, regata, bermuda, saia, stampSet, warpLayer, warpPlan } from '../../../../scripts/lib/pixel/charedit.mjs';
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';
import { HAT_ART } from './hats.mjs';
import { buildGarbs } from './garb.mjs';
import { APRON_ART, BLINK_ART, EXTRA_ART, EYE_ART, FACE_ALPHA, FACE_ART, GESTURE_FRAMES, HAIR_ADDON, POSE_ART } from './charart.mjs';
import { buildRegulars } from './regulars.mjs';
import { buildGi, buildGiPatch } from './gi.mjs';
import { detailTop } from './topdetail.mjs';

const SRC_H = 32 * 10;
/** hair styles whose pack fringe reaches the eyes on the front frames: pulled up and aside (wave 2) */
const FRINGE_OPEN = new Set(['cacheado', 'black', 'ondulado', 'longo']);

/** creator top style -> the LimeZu outfit whose torso it borrows; the bottom style edits the legs of that same outfit */
export const TOP_BASE = { camiseta: '01', regata: '01', moletom: '10', camisa: '08', blusa: '11' };
export const TOPS = ['camiseta', 'regata', 'moletom', 'camisa', 'blusa'];
export const BOTTOMS = ['calca', 'bermuda', 'saia'];
export const BODY_TYPES = ['esguio', 'medio', 'forte'];

/** creator hair style -> LimeZu hairstyle number (or a derived style, see buildHairs) */
export const HAIR_BASE = { curto: '12', raspado: '20', undercut: '26', cacheado: '25', black: '25', ondulado: '07', longo: '15', coque: '16', trancas: '16' };

/** face style -> LimeZu eyes number (the pack's eyes differ by iris color only; since wave 3 the eyes are authored, see charart.mjs EYE_ART) */
export const EYES_BASE = { suave: '01', marcante: '04', doce: '02', maduro: '05' };
/** the idle frame (of 6) on which the eyes are closed */
export const BLINK_FRAME = 4;

export async function buildChars({ base }) {
  const cache = new Map();
  const load = async (kind, name) => {
    const f = path.join(base, kind, '16x16', name + '.png');
    if (!cache.has(f)) cache.set(f, crop(await loadPng(f), 0, 0, 896, SRC_H));
    return cache.get(f);
  };
  const canon = async (kind, name) => toCanonicalSheet(await load(kind, name));
  const acc0 = async (n) => canon('Accessories', n);
  const layers = {};

  // ---- body (skin ramp), the eyes stay a separate layer
  const bodyRaw = await canon('Bodies', 'Body_01');
  const an = anchors(bodyRaw);
  const bodyKeyed = cheekContour(keyLayer(bodyRaw, { skin: ['#aa5e56', '#b57972', '#bf8b78', '#c49d85'] }), an);
  layers.body_medio = bodyKeyed;

  // ---- warps for the other two body types (body-attached layers only; head layers are shared)
  const plans = { esguio: warpPlan(bodyRaw, an, 'esguio'), forte: warpPlan(bodyRaw, an, 'forte') };
  const bodyAttached = {}; // key -> medio image, registered so variants are generated at the end
  const regBody = (key, img) => {
    layers[key] = img;
    bodyAttached[key] = img;
  };
  regBody('body_medio', bodyKeyed);

  // ---- eyes (wave 3: authored per face style; the pack's Eyes_NN differ by iris colour only and are one pixel wide). One idle frame in
  // six (front and side rows) blinks.
  const blinks = (r, c) => r <= 2 && c === BLINK_FRAME;
  for (const face of Object.keys(EYES_BASE)) {
    const art = EYE_ART[face];
    const img = stampSet(emptySheet(), { S: art.S, E: art.E }, an, 'head', { only: (r, c) => !blinks(r, c) });
    layers[`eyes_${face}`] = stampSet(img, { S: BLINK_ART.S, E: BLINK_ART.E }, an, 'head', { only: blinks });
  }

  // ---- outfits: 5 top styles x 3 bottom styles
  for (const top of TOPS) {
    const raw = await canon('Outfits', `Outfit_${TOP_BASE[top]}_01`);
    let { img } = keyOutfit(raw, an);
    img = detailTop(img, bodyRaw, top, an);
    if (top === 'regata') img = regata(img, an);
    for (const bottom of BOTTOMS) {
      const edit = { calca: (i) => i, bermuda: (i) => bermuda(i, an), saia: (i) => saia(i, an) }[bottom];
      regBody(`outfit_${top}_${bottom}`, edit(img));
    }
  }

  // ---- hair
  const hairCache = {};
  const hairOf = async (n) => (hairCache[n] ??= keyAuto(await canon('Hairstyles', `Hairstyle_${n}_01`), 'hair').img);
  for (const [style, n] of Object.entries(HAIR_BASE)) {
    let img = await hairOf(n);
    if (style === 'black') img = puffHair(img, bodyRaw, an, { grow: 2 });
    if (FRINGE_OPEN.has(style)) img = openFringe(img, an, style === 'cacheado' || style === 'black' ? { notch: 2 } : {});
    const add = HAIR_ADDON[style];
    if (add) img = stampSet(clone(img), { S: add.S, N: add.N ?? add.S, E: add.E ?? add.S, W: add.W }, an, 'head');
    layers[`hair_${style}`] = hairShine(img, an);
  }

  // ---- face styles (brows, blush, lines) and extras
  for (const [face, art] of Object.entries(FACE_ART)) layers[`face_${face}`] = stampSet(emptySheet(), { S: art.S, E: art.E }, an, 'head', { alphaOf: FACE_ALPHA });
  layers.extra_oculos = await acc0('Accessory_15_Glasses_01');
  layers.extra_bigode = keyRanks(await acc0('Accessory_12_Mustache_01'), 'hair', { '#6f5449': 1, '#8a6552': 2 });
  layers.extra_barba = keyRanks(await acc0('Accessory_13_Beard_01'), 'hair', { '#6f5449': 1, '#8a6552': 2 });
  for (const [id, art] of Object.entries(EXTRA_ART)) layers['extra_' + id] = stampSet(emptySheet(), { S: art.S, N: art.S, E: art.E }, an, 'head');

  // ---- emote gestures, idle-pose props, phone, NPC apron
  const gest = emptySheet();
  for (const [row, list] of Object.entries(GESTURE_FRAMES)) list.forEach((set, c) => stampSet(gest, set, an, 'body', { only: (r, cc) => r === +row && cc === c }));
  layers.emote_gestures = gest;
  for (const [id, art] of Object.entries(POSE_ART)) {
    const img = stampSet(emptySheet(), { S: art.S, E: art.E, N: art.N }, an, 'body', { rows: new Set([0, 1, 2, 3]) });
    if (id === 'bracos') regBody('pose_' + id, img);
    else layers['pose_' + id] = img;
  }
  layers.acc_phone = await canon('Smartphones', 'Smartphone_1');
  regBody('npc_apron', stampSet(emptySheet(), APRON_ART, an, 'body', { rows: new Set([0, 1, 2, 3, 4, 5, 6, 7]) }));

  // ---- BJJ gi: drawn over the camisa + calça outfit (recolored by the look), so it only adds what makes a kimono read: the collar,
  // the crossed lapels with the chest in the V, one thin belt row with its knot and tails, the jacket skirt (gi.mjs). The academy
  // stamp is its own layer so a vestiário gi stays plain. Both follow the outfit's silhouette on every frame, sitting included.
  regBody('npc_gi', buildGi(layers.outfit_camisa_calca, bodyRaw, an));
  regBody('gi_patch', buildGiPatch(layers.outfit_camisa_calca, bodyRaw, an));

  // ---- hats: derived from pack accessories (recolored to the hat / accent ramps) or authored (hats.mjs)
  const acc = acc0;
  layers.hat_bone_verde = keyLayer(await acc('Accessory_04_Snapback_01'), {
    hat: ['#fc5c46', '#a82b2d', '#d93232', '#e63f38'],
    accent: ['#ebe4f2', '#f8c7cf', '#d8d0e0', '#eea5b8'],
  });
  layers.hat_panama = keyLayer(await acc('Accessory_08_Detective_Hat_01'), {
    hat: ['#633935', '#d28a5d', '#c37759', '#a66860', '#8e595c'],
    accent: ['#ed931e', '#f2b22b'],
  });
  layers.hat_chapeu_chef = keyAuto(await acc('Accessory_18_Chef_01'), 'hat', ['#565972', '#6c6e85', '#9d9dc3']).img;
  layers.hat_gorro_listrado = stripeBeanie(keyAuto(await acc('Accessory_11_Beanie_01'), 'hat').img, an);
  for (const [id, set] of Object.entries(HAT_ART)) layers['hat_' + id] = stampSet(emptySheet(), { S: set.S, N: set.N ?? set.S, E: set.E ?? set.S, W: set.W }, an, 'head');

  // ---- wave 2 garbs (jersey, jacket, dungarees, flip-flops, backpack, delivery box, tote, feira cart)
  buildGarbs({ layers, an, regBody });

  // ---- the five regulars: custom face, hat (or ponytail) and one prop over the LimeZu body
  buildRegulars({ layers, an, regBody });

  // ---- body variants
  for (const [key, img] of Object.entries(bodyAttached)) {
    layers[key + '__esguio'] = warpLayer(img, plans.esguio);
    layers[key + '__forte'] = warpLayer(img, plans.forte);
  }
  return { layers, an };
}

/**
 * A specular on the hair (wave 3): two half-transparent white pixels on the crown, left of centre, two rows under the hair's top edge on
 * every frame, plus one under them. Blended at runtime over whatever hair colour the look picks, so a black bob and a blonde one both
 * catch the light from the upper left without a fifth ramp colour.
 */
function hairShine(img, an) {
  const out = clone(img);
  const WHITE = '#fff6e6';
  for (const { r, c } of frames()) {
    const a = anchorOf(an, r, c);
    if (!a) continue;
    let top = -1;
    for (let y = 0; y < 32 && top < 0; y++) for (let x = 0; x < 16; x++) if (alphaAt(img, fx(c, x), fy(r, y)) === 255 && !OUTLINES.has(hexAt(img, fx(c, x), fy(r, y)))) { top = y; break; }
    if (top < 0) continue;
    const y = top + 1;
    let x0 = 99, x1 = -1;
    for (let x = 0; x < 16; x++) if (alphaAt(img, fx(c, x), fy(r, y)) === 255 && !OUTLINES.has(hexAt(img, fx(c, x), fy(r, y)))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (x1 - x0 < 4) continue;
    const sx = x0 + Math.max(1, Math.round((x1 - x0) * 0.3));
    const fill = (x, yy) => alphaAt(img, fx(c, x), fy(r, yy)) === 255 && !OUTLINES.has(hexAt(img, fx(c, x), fy(r, yy)));
    if (fill(sx, y)) putHex(out, fx(c, sx), fy(r, y), WHITE, 56);
    if (fill(sx + 1, y)) putHex(out, fx(c, sx + 1), fy(r, y), WHITE, 56);
    if (fill(sx, y + 1)) putHex(out, fx(c, sx), fy(r, y + 1), WHITE, 36);
  }
  return out;
}

/**
 * A contour on the face (wave 3): on the front-facing frames, the outermost skin pixel of the four rows from the brow line to the jaw
 * (head top + 8 .. + 11) takes the skin's shade rank, so the cheeks turn away from the light and the face reads as a volume, not a disc.
 * The pack already shades the jaw row and the chin; this joins them to the temples.
 */
function cheekContour(body, an) {
  const out = clone(body);
  const base = KEY_RAMPS.skin[2], shade = KEY_RAMPS.skin[1];
  for (const { r, c } of frames()) {
    if (rowFacing(r) !== 'S') continue;
    const a = anchorOf(an, r, c);
    if (!a) continue;
    for (let y = a.top + 8; y <= a.top + 11; y++) {
      const xs = [];
      for (let x = 0; x < 16; x++) if (alphaAt(body, fx(c, x), fy(r, y)) && hexAt(body, fx(c, x), fy(r, y)) === base) xs.push(x);
      if (xs.length < 6) continue;
      putHex(out, fx(c, xs[0]), fy(r, y), shade);
      putHex(out, fx(c, xs[xs.length - 1]), fy(r, y), shade);
    }
  }
  return out;
}

/** Beanie: accent stripes across the dome (rows relative to the top of the hat in each frame). */
function stripeBeanie(img, an) {
  const out = clone(img);
  const hatKeys = KEY_RAMPS.hat.map((h) => h);
  const acc = KEY_RAMPS.accent;
  for (const { r, c } of frames()) {
    let minY = 99;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) if (alphaAt(img, fx(c, x), fy(r, y))) minY = Math.min(minY, y);
    if (minY === 99) continue;
    for (let y = minY; y < 32; y++) for (let x = 0; x < 16; x++) {
      if (!alphaAt(img, fx(c, x), fy(r, y))) continue;
      const rel = y - minY;
      const rank = hatKeys.indexOf(hexAt(img, fx(c, x), fy(r, y)));
      if (rank < 0) continue;
      if ((rel >= 1 && rel <= 2) || (rel >= 4 && rel <= 5)) putHex(out, fx(c, x), fy(r, y), acc[Math.min(rank, 2)]);
    }
  }
  return out;
}
