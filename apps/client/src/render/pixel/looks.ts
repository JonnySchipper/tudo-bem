/**
 * Character looks (HOWTO §6 Phase 3): an `Appearance` (+ hat, + NPC extras) becomes an ordered list of layers with the ramp colors to
 * swap in. Pure: no Phaser, no DOM. The layers are drawn back to front by `composeRgba` (charcompose.ts).
 */
import { CLOTH_COLORS, DEFAULT_APPEARANCE, HAIR_COLORS, garbParts, SHOE_COLORS, SKIN_TONES, hatById, type Appearance, type Belt, type BodyType, type NpcId } from '@tudobem/shared';
import { CHAR_LAYERS, GARBS, HAT_LIFT, hatLayer, outfitKey, pick, type GarbColors, type GarbPiece, type IdleEntry } from './characters';
import type { Ramps } from './charcompose';

export interface LookLayer {
  /** key of a layer sheet in manifest.chars */
  key: string;
  ramps?: Ramps;
  /** exact colour swaps (the belt colour on the gi layer) */
  map?: Record<string, string>;
  /** top-left light on the edges of this layer (hair, outfit: crown and shoulders) */
  hl?: boolean;
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
  /** BJJ gi pieces (crossed lapels, black belt) over the outfit */
  gi?: boolean;
  /** with `gi`: the belt colour worn (the gi layer's black belt is recoloured); Professora Bia keeps hers black */
  belt?: Belt;
}

/** The gi layer's belt colours (`npc_gi.png`: band `#3a3a50`, shade and knot `#1f1f2e`) -> the colours of an earned belt. */
export const GI_BELT_MAP: Record<Belt, Record<string, string>> = {
  branca: { '#3a3a50': '#f3efe6', '#1f1f2e': '#bfb8a8' },
  azul: { '#3a3a50': '#4177c9', '#1f1f2e': '#2a4f8d' },
};

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
  // wave 2: the CPU's neighbourhood pieces (back pieces under the body, jersey / flip-flops over the outfit, bags over the hair, a bucket hat)
  const garb: GarbPiece[] = garbParts(a.garb).flatMap((id) => GARBS[id] ?? []);
  const gc: GarbColors = { top, bottom, skin };
  const garbLayer = (p: GarbPiece): LookLayer => ({ key: p.warped ? p.key + suffix : p.key, ramps: p.ramps(gc) });
  const layers: LookLayer[] = [
    ...garb.filter((p) => p.slot === 'under').map(garbLayer),
    { key: CHAR_LAYERS.body[body], ramps: { skin } },
    { key: face.eyes },
    { key: face.overlay, ramps: { hair } },
  ];
  const under = extra && extra.order === 'under-hair' ? extra : null;
  const over = extra && extra.order === 'over-hair' ? extra : null;
  layers.push({ key: outfitKey(a.top, a.bottom, body), ramps: { top, bottom, shoes }, hl: true });
  if (opts.apron) layers.push({ key: CHAR_LAYERS.apron + suffix, ramps: { accent: opts.apron } });
  if (opts.gi) layers.push({ key: CHAR_LAYERS.gi + suffix, ...(opts.belt ? { map: GI_BELT_MAP[opts.belt] } : {}) });
  for (const p of garb) if (p.slot === 'outfit') layers.push(garbLayer(p));
  for (const l of idle.layers) layers.push({ key: idle.warped ? l + suffix : l, ramps: { top, skin } });
  if (under) layers.push({ key: under.layer, ramps: under.ramps.length ? { hair } : undefined });
  for (const p of garb) if (p.slot === 'over') layers.push(garbLayer(p));
  layers.push({ key: pick(CHAR_LAYERS.hair, a.hair, 'curto', 'hair'), ramps: { hair }, hl: true });
  if (over) layers.push({ key: over.layer });
  const hat = hatSpec(opts.hat);
  const garbHat = garb.find((p) => p.slot === 'hat');
  if (hat) layers.push({ key: hat.layer, ramps: { hat: hat.color, accent: hat.accent } });
  else if (garbHat) layers.push(garbLayer(garbHat));
  // gestures (raised hands) are drawn over the hair and the hat: the hand reaches up in front of the head (wave 2: a brim used to hide it)
  layers.push({ key: CHAR_LAYERS.gestures, ramps: { skin, top } });
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
  /** BJJ gi pieces over the outfit (Professora Bia) */
  gi?: boolean;
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
  // The feira vendors (Phase 9), built from existing layers only (hats and aprons of the NPC set): Seu Zé in a panama hat and an olive apron,
  // Seu Chico in a yellow bucket hat and a white apron (the pastel fryer), Dona Rosa in a flower crown. Dialogue portraits: `portraits/ze_*`, `portraits/chico_*`, `portraits/rosa_*`.
  ze: {
    appearance: base({ body: 'forte', skin: 3, hair: 'raspado', hairColor: 5, top: 'camisa', topColor: 11, bottom: 'calca', bottomColor: 10, shoes: 2, face: 'maduro', extra: 'bigode', idle: 'bracos' }),
    hat: 'panama',
    apron: '#8a9a52',
  },
  chico: {
    appearance: base({ body: 'medio', skin: 5, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 1, face: 'marcante', extra: 'barba', idle: 'solto' }),
    hat: 'bucket_amarelo',
    apron: '#f1eee8',
  },
  rosa: {
    appearance: base({ body: 'esguio', skin: 2, hair: 'ondulado', hairColor: 3, top: 'blusa', topColor: 9, bottom: 'saia', bottomColor: 7, shoes: 0, face: 'suave', extra: 'brincos', idle: 'solto' }),
    hat: 'coroa_flores',
    apron: '#f4ede2',
  },
  // Professora Bia (BJJ): a white gi (camisa + calça outfit in off-white) with the gi layer on top (crossed lapels, black belt and knot),
  // short dark hair, arms crossed. Her portrait (portraits/prof_*) is a woman in her 30s with short dark hair and a gi collar.
  prof: {
    appearance: base({ body: 'medio', skin: 4, hair: 'curto', hairColor: 0, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 4, shoes: 0, face: 'marcante', extra: 'nenhum', idle: 'bracos' }),
    gi: true,
  },
  // Dona Lúcia (escola): bun, glasses, blouse and skirt, from layers that already exist. Portrait is Júlia's until she has her own.
  lucia: {
    appearance: base({ body: 'medio', skin: 3, hair: 'coque', hairColor: 4, top: 'blusa', topColor: 0, bottom: 'saia', bottomColor: 2, shoes: 2, face: 'maduro', extra: 'oculos', idle: 'bracos' }),
  },
};

/** NPC look: the room's appearance when given (so map edits still show), otherwise the style's own; hat and apron always from the style. */
export function lookForNpc(id: string, appearance?: Appearance, hatId?: string | null): Look {
  const style = (NPC_STYLES as Record<string, NpcStyle | undefined>)[id];
  const a = style?.appearance ?? appearance ?? DEFAULT_APPEARANCE;
  return lookForAppearance(a, { hat: style?.hat ?? hatId ?? null, apron: style?.apron ?? null, gi: style?.gi ?? false });
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
  'char:' + hashString(l.layers.map((x) => x.key + (x.ramps ? Object.entries(x.ramps).sort().map(([k, v]) => `${k}=${v}`).join(',') : '') + (x.map ? '~' + Object.entries(x.map).sort().map(([k, v]) => `${k}=${v}`).join(',') : '')).join('|'));
