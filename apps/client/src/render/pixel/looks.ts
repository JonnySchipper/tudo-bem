/**
 * Character looks (HOWTO §6 Phase 3): an `Appearance` (+ hat, + NPC extras) becomes an ordered list of layers with the ramp colors to
 * swap in. Pure: no Phaser, no DOM. The layers are drawn back to front by `composeRgba` (charcompose.ts).
 */
import { CLOTH_COLORS, DEFAULT_APPEARANCE, HAIR_COLORS, SHOE_COLORS, SKIN_TONES, hatById, type Appearance, type BodyType, type NpcId } from '@tudobem/shared';
import { CHAR_LAYERS, HAT_LIFT, hatLayer, outfitKey, pick, type IdleEntry } from './characters';
import type { Ramps } from './charcompose';

export interface LookLayer {
  /** key of a layer sheet in manifest.chars */
  key: string;
  ramps?: Ramps;
}

export interface Look {
  body: BodyType;
  /** back to front */
  layers: LookLayer[];
  /** the standing pose (prop layers are already in `layers`; the scene picks the animation and pace) */
  idle: IdleEntry;
}

export interface HatSpec {
  layer: string;
  color: string;
  accent: string;
}

export interface LookOptions {
  /** catalog hat id, an NPC hat id (`pano`), or an explicit spec */
  hat?: string | HatSpec | null;
  /** apron color (NPC piece) */
  apron?: string | null;
}

const pickColor = (list: readonly string[], i: number | undefined): string => list[Number.isInteger(i) && (i as number) >= 0 && (i as number) < list.length ? (i as number) : 0];

export function hatSpec(hat: string | HatSpec | null | undefined): HatSpec | null {
  if (!hat) return null;
  if (typeof hat !== 'string') return hat;
  const layer = hatLayer(hat);
  if (!layer) {
    if (!('unknown-hat:' + hat in warned)) {
      warned['unknown-hat:' + hat] = true;
      console.warn(`[pixel] no hat layer for '${hat}'`);
    }
    return null;
  }
  const def = hatById(hat);
  return { layer, color: def?.color ?? '#c9582c', accent: def?.accent ?? '#f1e9dc' };
}
const warned: Record<string, true> = {};

const VALID_BODY: readonly BodyType[] = ['esguio', 'medio', 'forte'];

export function lookForAppearance(a: Appearance, opts: LookOptions = {}): Look {
  const body: BodyType = VALID_BODY.includes(a.body) ? a.body : 'medio';
  const skin = pickColor(SKIN_TONES, a.skin);
  const hair = pickColor(HAIR_COLORS, a.hairColor);
  const top = pickColor(CLOTH_COLORS, a.topColor);
  const bottom = pickColor(CLOTH_COLORS, a.bottomColor);
  const shoes = pickColor(SHOE_COLORS, a.shoes);
  const face = pick(CHAR_LAYERS.face, a.face, 'suave', 'face');
  const extra = pick(CHAR_LAYERS.extra as Record<string, (typeof CHAR_LAYERS.extra)[keyof typeof CHAR_LAYERS.extra]>, a.extra, 'nenhum', 'extra');
  const idle = pick(CHAR_LAYERS.idle, a.idle, 'solto', 'idle');
  const suffix = CHAR_LAYERS.bodySuffix[body];
  const layers: LookLayer[] = [
    { key: CHAR_LAYERS.body[body], ramps: { skin } },
    { key: face.eyes },
    { key: face.overlay, ramps: { hair } },
  ];
  const under = extra && extra.order === 'under-hair' ? extra : null;
  const over = extra && extra.order === 'over-hair' ? extra : null;
  layers.push({ key: outfitKey(a.top, a.bottom, body), ramps: { top, bottom, shoes } });
  if (opts.apron) layers.push({ key: CHAR_LAYERS.apron + suffix, ramps: { accent: opts.apron } });
  for (const l of idle.layers) layers.push({ key: idle.warped ? l + suffix : l, ramps: { top, skin } });
  if (under) layers.push({ key: under.layer, ramps: under.ramps.length ? { hair } : undefined });
  layers.push({ key: pick(CHAR_LAYERS.hair, a.hair, 'curto', 'hair'), ramps: { hair } });
  if (over) layers.push({ key: over.layer });
  // gestures (raised hands) are drawn over the hair: they reach up beside the head
  layers.push({ key: CHAR_LAYERS.gestures, ramps: { skin, top } });
  const hat = hatSpec(opts.hat);
  if (hat) layers.push({ key: hat.layer, ramps: { hat: hat.color, accent: hat.accent } });
  return { body, layers, idle };
}

/** Art px from the top of a bare head to the top of this look's sprite (hat, plus the body height change): labels stand above it. */
export function lookHeadLift(look: Look): number {
  const hat = look.layers.find((l) => l.key.startsWith('hat_'));
  return (hat ? (HAT_LIFT[hat.key] ?? 3) : 0) + (look.body === 'esguio' ? 1 : look.body === 'forte' ? -1 : 0);
}

/** Everything that makes an NPC read like their portrait (public/pixel/portraits): the appearance, plus a hat and an apron. */
export interface NpcStyle {
  /** used when the caller has no room appearance (Dona Graça and Tia Lu are not in a room yet) */
  appearance: Appearance;
  hat?: string | HatSpec;
  apron?: string;
}

const base = (o: Partial<Appearance>): Appearance => ({ ...DEFAULT_APPEARANCE, ...o });

/**
 * Keyed by NPC id (a string, so ids that are not on a map yet work too).
 * Carlos: white baker's cap + apron over a terracotta shirt + grey mustache. Nanda: mustard top, straw hat, hoops, dark curls.
 * Júlia: light blouse, long chestnut hair. Graça: grey bun, round glasses, pale-blue apron over a plum top. Tia Lu: red polka-dot
 * headscarf, gold hoops, green top, orange apron.
 */
export const NPC_STYLES: Record<NpcId, NpcStyle> = {
  carlos: {
    appearance: base({ body: 'forte', skin: 3, hair: 'curto', hairColor: 5, top: 'camisa', topColor: 3, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'maduro', extra: 'bigode', idle: 'bracos' }),
    hat: 'chapeu_chef',
    apron: '#f1eee8',
  },
  nanda: {
    appearance: base({ body: 'esguio', skin: 5, hair: 'cacheado', hairColor: 0, top: 'camiseta', topColor: 1, bottom: 'calca', bottomColor: 2, shoes: 2, face: 'doce', extra: 'brincos', idle: 'cintura' }),
    hat: 'chapeu_palha',
  },
  julia: {
    appearance: base({ body: 'medio', skin: 1, hair: 'longo', hairColor: 3, top: 'blusa', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 0, face: 'suave', extra: 'nenhum', idle: 'bolsa' }),
  },
  graca: {
    appearance: base({ body: 'medio', skin: 6, hair: 'coque', hairColor: 5, top: 'blusa', topColor: 7, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'maduro', extra: 'oculos', idle: 'bracos' }),
    apron: '#a8c5d4',
  },
  tia_lu: {
    appearance: base({ body: 'medio', skin: 4, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 0, bottom: 'saia', bottomColor: 3, shoes: 3, face: 'doce', extra: 'brincos', idle: 'cintura' }),
    hat: { layer: 'hat_pano', color: '#c8202f', accent: '#f4ede2' },
    apron: '#e8892b',
  },
  // Professora Bia (BJJ): an off-white gi (shirt and trousers), black bun, and a dark belt: the NPC apron layer in near-black (its band
  // across the waist reads as the belt). All existing layers, no new art.
  prof: {
    appearance: base({ body: 'forte', skin: 4, hair: 'coque', hairColor: 0, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 4, shoes: 0, face: 'marcante', extra: 'nenhum', idle: 'bracos' }),
    apron: '#26232e',
  },
};

/** NPC look: the room's appearance when given (so map edits still show), otherwise the style's own; hat and apron always from the style. */
export function lookForNpc(id: string, appearance?: Appearance, hatId?: string | null): Look {
  const style = (NPC_STYLES as Record<string, NpcStyle | undefined>)[id];
  const a = style?.appearance ?? appearance ?? DEFAULT_APPEARANCE;
  return lookForAppearance(a, { hat: style?.hat ?? hatId ?? null, apron: style?.apron ?? null });
}

/** 53-bit string hash (cyrb53), base 36. */
export function hashString(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Cache key of a composed sheet: two looks with the same layers and colors share one texture. */
export const lookKey = (l: Look): string =>
  'char:' + hashString(l.layers.map((x) => x.key + (x.ramps ? Object.entries(x.ramps).sort().map(([k, v]) => `${k}=${v}`).join(',') : '')).join('|'));
