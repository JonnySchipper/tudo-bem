// Character layers for Phase 3 (HOWTO 5.5): every creator option as a key-colored canonical sheet (see scripts/lib/pixel/chars.mjs).
//
// Derived from LimeZu's Character Generator: bodies, eyes, hairstyles, outfits (top and bottom halves recolored separately), beard,
// mustache, glasses, phone, and the beanie / snapback / chef / detective hats. Authored in the pack style: face brows and blush, freckles,
// earrings, buns and braids, the emote gestures, the idle-pose props, the NPC pieces and the hats the pack lacks (see hats.mjs).
import path from 'node:path';
import { crop, loadPng, clone, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { toCanonicalSheet, mergeLayers, keyLayer } from '../../../../scripts/lib/pixel/chars.mjs';
import { rowFacing } from '../../../../scripts/lib/pixel/chars.mjs';
import { alphaAt, anchorOf, anchors, emptySheet, eyeWhites, fx, fy, frames, hexAt, keyAuto, keyOutfit, keyRanks, openFringe, putHex, puffHair, regata, bermuda, saia, stampSet, warpLayer, warpPlan } from '../../../../scripts/lib/pixel/charedit.mjs';
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';
import { HAT_ART } from './hats.mjs';
import { buildGarbs } from './garb.mjs';
import { APRON_ART, EXTRA_ART, FACE_ALPHA, FACE_ART, GESTURE_FRAMES, HAIR_ADDON, POSE_ART } from './charart.mjs';
import { buildRegulars } from './regulars.mjs';

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

/** face style -> LimeZu eyes number (the pack's eyes differ by iris color only) */
export const EYES_BASE = { suave: '01', marcante: '04', doce: '02', maduro: '05' };

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
  const bodyKeyed = keyLayer(bodyRaw, { skin: ['#aa5e56', '#b57972', '#bf8b78', '#c49d85'] });
  const an = anchors(bodyRaw);
  layers.body_medio = bodyKeyed;

  // ---- warps for the other two body types (body-attached layers only; head layers are shared)
  const plans = { esguio: warpPlan(bodyRaw, an, 'esguio'), forte: warpPlan(bodyRaw, an, 'forte') };
  const bodyAttached = {}; // key -> medio image, registered so variants are generated at the end
  const regBody = (key, img) => {
    layers[key] = img;
    bodyAttached[key] = img;
  };
  regBody('body_medio', bodyKeyed);

  // ---- eyes
  for (const [face, n] of Object.entries(EYES_BASE)) layers[`eyes_${face}`] = eyeWhites(await canon('Eyes', `Eyes_${n}`));

  // ---- outfits: 5 top styles x 3 bottom styles
  for (const top of TOPS) {
    const raw = await canon('Outfits', `Outfit_${TOP_BASE[top]}_01`);
    let { img } = keyOutfit(raw, an);
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
    layers[`hair_${style}`] = img;
  }

  // ---- face styles (brows, blush, lines) and extras
  for (const [face, art] of Object.entries(FACE_ART)) layers[`face_${face}`] = art ? stampSet(emptySheet(), { S: art.S, E: art.E }, an, 'head', { alphaOf: FACE_ALPHA }) : emptySheet();
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

  // ---- BJJ gi (Professora Bia): drawn over the camisa + calça outfit (white, recolored by the look), so it only adds what makes a kimono
  // read: crossed lapels under the chin and a black belt with its knot across the waist. Everything follows the outfit's silhouette.
  regBody('npc_gi', buildGi(layers.outfit_camisa_calca, an));

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
 * The gi pieces for every non-sitting frame, from the alpha of `outfit` (the camisa + calça layer). Torso rows are bottom-7 .. bottom-4
 * (the same rows the body warp uses): two lapel diagonals that cross under the collar on the front frames, and the belt on the last two
 * torso rows (dark top row, black lower row) inside the silhouette, with a knot and two short tails on the front.
 */
function buildGi(outfit, an) {
  const out = emptySheet();
  const LAP = '#d8d0e0', BELT_HI = '#3a3a50', BELT = '#1f1f2e';
  for (const { r, c } of frames()) {
    if (r >= 8 && r <= 11) continue; // sitting frames have another geometry
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const facing = rowFacing(r);
    const row = (y) => {
      let x0 = 99, x1 = -1;
      for (let x = 0; x < 16; x++) if (alphaAt(outfit, fx(c, x), fy(r, a.bottom + y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return x1 < 0 ? null : [x0, x1];
    };
    const put = (x, y, hex) => {
      if (x < 0 || x > 15 || !alphaAt(outfit, fx(c, x), fy(r, a.bottom + y))) return;
      putHex(out, fx(c, x), fy(r, a.bottom + y), hex);
    };
    const top = row(-7);
    if (facing === 'S' && top) {
      const cx = Math.round((top[0] + top[1]) / 2);
      put(cx - 2, -7, LAP); put(cx + 1, -7, LAP);
      put(cx - 1, -6, LAP); put(cx, -6, LAP);
    }
    for (const [y, hex] of [[-5, BELT_HI], [-4, BELT]]) {
      const ext = row(y);
      if (!ext) continue;
      const inset = facing === 'E' || facing === 'W' ? 0 : 2;
      for (let x = ext[0] + inset; x <= ext[1] - inset; x++) put(x, y, hex);
    }
    if (facing === 'S') {
      const ext = row(-4);
      if (ext) {
        const cx = Math.round((ext[0] + ext[1]) / 2);
        put(cx, -5, BELT); put(cx - 1, -3, BELT); put(cx + 1, -3, BELT);
      }
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
