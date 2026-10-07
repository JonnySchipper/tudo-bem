/**
 * The layer table (HOWTO §6 Phase 3 step 2): every creator option -> the key of a canonical layer sheet in `public/pixel/chars/`.
 * A missing mapping falls back to the closest style and logs once. Pure: no Phaser, no DOM.
 *
 * Layer sheets are built by `assets-src/custom/chars.mjs` (see assets-src/README.md for what is derived from LimeZu and what is authored).
 */
import { ALL_HATS, type BodyType, type BottomStyle, type ExtraStyle, type FaceStyle, type HairStyle, type IdlePose, type TopStyle } from '@tudobem/shared';

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
    chapeu_padeiro_casa: 'hat_chapeu_chef',
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
  /**
   * Praça regulars. Each person has their own face, a hat (Júlia's high ponytail is the hair sheet) and one prop.
   * Props are body-warped (`__esguio` / `__forte`). Faces, hats and the ponytail are not.
   */
  regularFace: ['face_npc_carlos', 'face_npc_julia', 'face_npc_ze', 'face_npc_chico', 'face_npc_rosa'] as const,
  regularHair: ['hair_npc_julia'] as const,
  regularHat: ['hat_npc_toque', 'hat_npc_panama', 'hat_npc_bucket', 'hat_npc_coroa'] as const,
  regularProp: ['prop_npc_avental', 'prop_npc_sacola', 'prop_npc_verdura', 'prop_npc_pastel', 'prop_npc_buque'] as const,
  apron: 'npc_apron',
  /** the BJJ gi pieces (lapels and black belt) over the white camisa + calça outfit */
  gi: 'npc_gi',
  gestures: 'emote_gestures',
  phone: 'acc_phone',
} as const;

/**
 * The option-4 player avatar (staging test): one painted character baked into a 32x64-per-frame sheet (`assets-src/custom/opt4.mjs`,
 * the same canonical rows as the 16x32 sheets at 2x). Drawn at half the avatar draw scale, so a player is the same size in the world
 * as before (every `avatarPx` offset still holds) with twice the pixels in the face and clothes.
 */
export const HIRES = {
  layers: { player: 'opt4_player' },
  /** art px of a hi-res sheet per art px of a 16x32 sheet */
  scale: 2,
} as const;

/** Colors a garb piece may take from the wearer (hex). */
export interface GarbColors {
  top: string;
  bottom: string;
  skin: string;
}

export interface GarbPiece {
  /** layer key (at body type medio; the body variants add the suffix) */
  key: string;
  /** under: drawn before the body (back pieces: only what sticks out shows); outfit: right over the outfit; over: over the hair too; hat: with the hat */
  slot: 'under' | 'outfit' | 'over' | 'hat';
  ramps: (c: GarbColors) => Record<string, string>;
  /** whether the layer is body-attached (has __esguio / __forte variants) */
  warped: boolean;
}

const piece = (key: string, slot: GarbPiece['slot'], ramps: GarbPiece['ramps'], warped = true): GarbPiece => ({ key, slot, ramps, warped });

/**
 * Wave 2: neighbourhood pieces worn by CPU neighbours (`Appearance.garb`, ids from GARB_IDS joined by '+'). Fixed colors on purpose (a
 * torcida jersey, a delivery box and a feira cart read by their colors); the jacket takes the wearer's top color.
 */
export const GARBS: Record<string, GarbPiece[]> = {
  // striped football shirts with no crest: grafite and off-white, or green and off-white
  jersey_alvinegro: [piece('garb_jersey', 'outfit', () => ({ top: '#2c2c36', accent: '#f1ede4' }))],
  jersey_verde: [piece('garb_jersey', 'outfit', () => ({ top: '#2d7d49', accent: '#f1ede4' }))],
  jaqueta: [piece('garb_jaqueta', 'outfit', (c) => ({ top: c.top, accent: '#e9c43a' }))],
  macacao: [piece('garb_macacao', 'outfit', () => ({ accent: '#3f62a0' }))],
  chinelo: [piece('garb_chinelo', 'outfit', (c) => ({ skin: c.skin, accent: '#3d9a50' }))],
  mochila: [piece('garb_mochila_u', 'under', () => ({ accent: '#d9602b' })), piece('garb_mochila_o', 'over', () => ({ accent: '#d9602b' }))],
  caixa: [piece('garb_caixa_u', 'under', () => ({ accent: '#d6382b' })), piece('garb_caixa_o', 'over', () => ({ accent: '#d6382b' }))],
  sacola: [piece('garb_sacola_o', 'over', () => ({ accent: '#a8542f' }))],
  carrinho: [piece('garb_carrinho_u', 'under', () => ({ accent: '#b83a46' })), piece('garb_carrinho_o', 'over', () => ({ accent: '#b83a46' }))],
  balde: [piece('hat_balde', 'hat', () => ({ hat: '#3f6aa8', accent: '#f1e9dc' }), false)],
};

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

/**
 * Draw scale for player and NPC sprites in the world.
 *
 * A standing LimeZu figure fills about 22 px of the 16×32 frame (`AVATAR_HEAD_LIFT`), on a 16 px floor tile: the height of a chair,
 * so at 1× people read as furniture. 2× made outfits read but the chibi heads turned chunky next to benches and lamps.
 * The target is about 1.4×, snapped so each art pixel lands on a whole number of device pixels at the camera zoom in use:
 * device zoom 2 → 3/2, 3 → 4/3, 4 → 6/4, 5 → 7/5, 6 → 8/6. The feet stay at the sprite origin.
 */
export const AVATAR_SCALE_TARGET = 1.4;

/** The draw scale at a device zoom (device px per art px): about `AVATAR_SCALE_TARGET`, never less than 1, crisp. */
export function avatarScaleFor(deviceZoom: number): number {
  const z = Math.max(1, Math.round(deviceZoom));
  return Math.max(z, Math.round(z * AVATAR_SCALE_TARGET)) / z;
}

let drawScale = avatarScaleFor(3);

/** The world camera's device zoom changed: people follow so they stay crisp. */
export function setAvatarZoom(deviceZoom: number): void {
  drawScale = avatarScaleFor(deviceZoom);
}

/** The draw scale in use right now. */
export const avatarDrawScale = (): number => drawScale;

/** Unscaled art px from the feet anchor to the top of a bare standing head (the frame is empty above the hair). */
export const AVATAR_HEAD_LIFT = 23;
/** Unscaled art px from the feet anchor to the top of a bare sitting head. */
export const AVATAR_HEAD_SIT_LIFT = 16;

/** World px above the feet for a distance measured on the unscaled sheet. */
export const avatarPx = (artPx: number): number => artPx * drawScale;

/** World px from the feet anchor to the top of the head, including a hat (`lookHeadLift`, unscaled art px). */
export const avatarCrown = (sitting: boolean, hatLift = 0): number => avatarPx((sitting ? AVATAR_HEAD_SIT_LIFT : AVATAR_HEAD_LIFT) + hatLift);

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
  hat_balde: 3,
  hat_npc_toque: 8,
  hat_npc_panama: 5,
  hat_npc_bucket: 4,
  hat_npc_coroa: 3,
  hair_npc_julia: 6,
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
  for (const h of ALL_HATS) keys.add(CHAR_LAYERS.hat[h.id]);
  for (const h of Object.values(CHAR_LAYERS.npcHat)) keys.add(h);
  for (const i of Object.values(CHAR_LAYERS.idle)) for (const l of i.layers) if (l !== 'pose_bracos') keys.add(l);
  keys.add(CHAR_LAYERS.gestures);
  for (const k of CHAR_LAYERS.regularFace) keys.add(k);
  for (const k of CHAR_LAYERS.regularHair) keys.add(k);
  for (const k of CHAR_LAYERS.regularHat) keys.add(k);
  for (const k of CHAR_LAYERS.regularProp) for (const b of Object.keys(CHAR_LAYERS.bodySuffix) as BodyType[]) keys.add(k + CHAR_LAYERS.bodySuffix[b]);
  for (const k of Object.values(HIRES.layers)) keys.add(k);
  for (const pieces of Object.values(GARBS)) {
    for (const p of pieces) {
      if (p.warped) for (const b of Object.keys(CHAR_LAYERS.bodySuffix) as BodyType[]) keys.add(p.key + CHAR_LAYERS.bodySuffix[b]);
      else keys.add(p.key);
    }
  }
  return [...keys];
}
