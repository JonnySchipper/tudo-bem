/**
 * The layer table (HOWTO §6 Phase 3 step 2): every creator option -> the key of a canonical layer sheet in `public/pixel/chars/`.
 * A missing mapping falls back to the closest style and logs once. Pure: no Phaser, no DOM.
 *
 * Layer sheets are built by `assets-src/custom/chars.mjs` (see assets-src/README.md for what is derived from LimeZu and what is authored).
 */
import { HATS, type BodyType, type BottomStyle, type ExtraStyle, type FaceStyle, type HairStyle, type IdlePose, type TopStyle } from '@tudobem/shared';

export interface OutfitEntry {
  /** layer key at body type `medio`; esguio / forte add a `__<body>` suffix (the body warp is baked at import) */
  layer: string;
  /** the LimeZu outfit the torso comes from */
  source: string;
  /** what the import does to the legs / sleeves of that outfit */
  edit: 'none' | 'shorts' | 'skirt' | 'tank' | 'tank+shorts' | 'tank+skirt';
  /** which key ramps are recolorable (torso -> top, pants -> bottom, shoes -> shoes). Every outfit has all three. */
  ramps: readonly ('top' | 'bottom' | 'shoes')[];
}

const ALL_RAMPS = ['top', 'bottom', 'shoes'] as const;
const outfit = (top: TopStyle, bottom: BottomStyle, source: string, edit: OutfitEntry['edit']): OutfitEntry => ({ layer: `outfit_${top}_${bottom}`, source, edit, ramps: ALL_RAMPS });

const BOTTOM_EDIT: Record<BottomStyle, 'none' | 'shorts' | 'skirt'> = { calca: 'none', bermuda: 'shorts', saia: 'skirt' };
const editOf = (top: TopStyle, bottom: BottomStyle): OutfitEntry['edit'] => {
  const b = BOTTOM_EDIT[bottom];
  if (top === 'regata') return b === 'none' ? 'tank' : b === 'shorts' ? 'tank+shorts' : 'tank+skirt';
  return b;
};
/** LimeZu outfit number each top style borrows its torso from (Outfit_NN_01) */
const TOP_SOURCE: Record<TopStyle, string> = { camiseta: 'Outfit_01', regata: 'Outfit_01', moletom: 'Outfit_10', camisa: 'Outfit_08', blusa: 'Outfit_11' };

const BOTTOMS: BottomStyle[] = ['calca', 'bermuda', 'saia'];
const TOPS: TopStyle[] = ['camiseta', 'regata', 'moletom', 'camisa', 'blusa'];

/** Every (top x bottom) combination resolves to one outfit sheet. */
export const OUTFITS: Record<TopStyle, Record<BottomStyle, OutfitEntry>> = Object.fromEntries(
  TOPS.map((t) => [t, Object.fromEntries(BOTTOMS.map((b) => [b, outfit(t, b, TOP_SOURCE[t], editOf(t, b))]))]),
) as Record<TopStyle, Record<BottomStyle, OutfitEntry>>;

export interface ExtraEntry {
  layer: string;
  /** ramps the layer uses (hair for beard / mustache, none for glasses and earrings) */
  ramps: readonly ('hair' | 'skin')[];
  /** drawn before the hair (beard, mustache, freckles) or after it (glasses, earrings) */
  order: 'under-hair' | 'over-hair';
}

export interface IdleEntry {
  /** prop layers that only have pixels on the idle rows (or the phone row) */
  layers: readonly string[];
  /** true when the prop is warped with the body type (arms across the chest) */
  warped?: boolean;
  /** animation used while standing: 'idle', or a real pack row that only exists facing S */
  anim: 'idle' | 'phone';
  /** playback speed relative to the idle fps (5), so poses breathe at different rates */
  speed: number;
}

export const CHAR_LAYERS = {
  body: { esguio: 'body_medio__esguio', medio: 'body_medio', forte: 'body_medio__forte' } as Record<BodyType, string>,
  bodySuffix: { esguio: '__esguio', medio: '', forte: '__forte' } as Record<BodyType, string>,
  hair: {
    curto: 'hair_curto',
    raspado: 'hair_raspado',
    undercut: 'hair_undercut',
    cacheado: 'hair_cacheado',
    black: 'hair_black',
    ondulado: 'hair_ondulado',
    longo: 'hair_longo',
    coque: 'hair_coque',
    trancas: 'hair_trancas',
  } as Record<HairStyle, string>,
  outfit: OUTFITS,
  face: {
    suave: { eyes: 'eyes_suave', overlay: 'face_suave' },
    marcante: { eyes: 'eyes_marcante', overlay: 'face_marcante' },
    doce: { eyes: 'eyes_doce', overlay: 'face_doce' },
    maduro: { eyes: 'eyes_maduro', overlay: 'face_maduro' },
  } as Record<FaceStyle, { eyes: string; overlay: string }>,
  extra: {
    nenhum: null,
    oculos: { layer: 'extra_oculos', ramps: [], order: 'over-hair' },
    barba: { layer: 'extra_barba', ramps: ['hair'], order: 'under-hair' },
    bigode: { layer: 'extra_bigode', ramps: ['hair'], order: 'under-hair' },
    brincos: { layer: 'extra_brincos', ramps: [], order: 'over-hair' },
    sardas: { layer: 'extra_sardas', ramps: [], order: 'under-hair' },
  } as Record<ExtraStyle, ExtraEntry | null>,
  /** catalog hat id -> layer (recolored with HatDef.color -> hat ramp and HatDef.accent -> accent ramp) */
  hat: {
    bone_verde: 'hat_bone_verde',
    chapeu_palha: 'hat_chapeu_palha',
    gorro_listrado: 'hat_gorro_listrado',
    viseira_azul: 'hat_viseira_azul',
    boina_vermelha: 'hat_boina_vermelha',
    chapeu_sol: 'hat_chapeu_sol',
    bucket_amarelo: 'hat_bucket_amarelo',
    capacete_bike: 'hat_capacete_bike',
    panama: 'hat_panama',
    coroa_flores: 'hat_coroa_flores',
    chapeu_chef: 'hat_chapeu_chef',
    cartola: 'hat_cartola',
  } as Record<string, string>,
  /** standing poses: props on the idle rows, or the pack's phone loop (S only). `solto` is the plain pack idle. */
  idle: {
    solto: { layers: [], anim: 'idle', speed: 1 },
    bolsos: { layers: ['pose_bolsos'], anim: 'idle', speed: 0.8 },
    bracos: { layers: ['pose_bracos'], warped: true, anim: 'idle', speed: 0.9 },
    celular: { layers: ['acc_phone'], anim: 'phone', speed: 1 },
    cafe: { layers: ['pose_cafe'], anim: 'idle', speed: 0.8 },
    cintura: { layers: ['pose_cintura'], anim: 'idle', speed: 1.2 },
    bolsa: { layers: ['pose_bolsa'], anim: 'idle', speed: 1 },
  } as Record<IdlePose, IdleEntry>,
  /** hats that are not in the shop (NPC pieces) */
  npcHat: { pano: 'hat_pano' } as Record<string, string>,
  apron: 'npc_apron',
  /** the BJJ gi pieces (lapels and black belt) over the white camisa + calça outfit */
  gi: 'npc_gi',
  gestures: 'emote_gestures',
  phone: 'acc_phone',
} as const;

const logged = new Set<string>();

/** Looks a key up in a layer table; an unknown value falls back to `fallback` and logs once. */
export function pick<V>(table: Record<string, V>, key: string | null | undefined, fallback: string, what: string): V {
  if (key != null && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  if (key != null && key !== '') {
    const tag = `${what}:${key}`;
    if (!logged.has(tag)) {
      logged.add(tag);
      console.warn(`[pixel] no ${what} layer for '${key}', using '${fallback}'`);
    }
  }
  return table[fallback];
}

/** Art px a hat rises above the top of the head (nameplates and bubbles stand above it). */
export const HAT_LIFT: Record<string, number> = {
  hat_bone_verde: 1,
  hat_chapeu_palha: 4,
  hat_gorro_listrado: 1,
  hat_viseira_azul: 0,
  hat_boina_vermelha: 3,
  hat_chapeu_sol: 3,
  hat_bucket_amarelo: 3,
  hat_capacete_bike: 3,
  hat_panama: 2,
  hat_coroa_flores: 1,
  hat_chapeu_chef: 5,
  hat_cartola: 7,
  hat_pano: 2,
};

/** Layer key of an outfit at a body type (an unknown top or bottom falls back to camiseta / calca and logs once). */
export function outfitKey(top: string | undefined, bottom: string | undefined, body: BodyType): string {
  const row = pick(OUTFITS as unknown as Record<string, Record<string, OutfitEntry>>, top, 'camiseta', 'top');
  const entry = pick(row, bottom, 'calca', 'bottom');
  return entry.layer + CHAR_LAYERS.bodySuffix[body];
}

export const hatLayer = (id: string | null | undefined): string | null => (id ? (CHAR_LAYERS.hat[id] ?? CHAR_LAYERS.npcHat[id] ?? null) : null);

/** Every layer key the table can produce, at every body type (used by the tests and to preload). */
export function allLayerKeys(): string[] {
  const keys = new Set<string>();
  for (const b of Object.keys(CHAR_LAYERS.body) as BodyType[]) {
    keys.add(CHAR_LAYERS.body[b]);
    for (const t of TOPS) for (const bo of BOTTOMS) keys.add(OUTFITS[t][bo].layer + CHAR_LAYERS.bodySuffix[b]);
    keys.add(CHAR_LAYERS.apron + CHAR_LAYERS.bodySuffix[b]);
    keys.add(CHAR_LAYERS.gi + CHAR_LAYERS.bodySuffix[b]);
    keys.add('pose_bracos' + CHAR_LAYERS.bodySuffix[b]);
  }
  for (const k of Object.values(CHAR_LAYERS.hair)) keys.add(k);
  for (const f of Object.values(CHAR_LAYERS.face)) {
    keys.add(f.eyes);
    keys.add(f.overlay);
  }
  for (const e of Object.values(CHAR_LAYERS.extra)) if (e) keys.add(e.layer);
  for (const h of HATS) keys.add(CHAR_LAYERS.hat[h.id]);
  for (const h of Object.values(CHAR_LAYERS.npcHat)) keys.add(h);
  for (const i of Object.values(CHAR_LAYERS.idle)) for (const l of i.layers) if (l !== 'pose_bracos') keys.add(l);
  keys.add(CHAR_LAYERS.gestures);
  return [...keys];
}
