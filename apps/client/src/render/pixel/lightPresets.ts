/**
 * Light sources by data (V5): a prop lights up at night from a preset keyed by its sprite key, or from the generic preset when its `PropDef` has
 * `lightAtNight: true`. Offsets are art px from the sprite's anchor (the bottom-centre of the footprint; y negative = up). New props (a coreto with
 * string lights, a pipoqueiro cart) get their light from this table or the flag, with no scene code.
 *
 * The manifest's own `light` field (lamps, the quiosque) and `PROP_LIGHT` (poste, banca) keep working; a preset is used only when neither exists.
 */
export interface LightSpec {
  x: number;
  y: number;
  r: number;
  color: string;
  /** vertical squash of the pool (1 = round halo, below 1 = a pool on the ground) */
  squash: number;
  /** additive glow alpha override */
  glow?: number;
}

export interface LightPreset {
  lights: LightSpec[];
  /** the sprite has a water surface that gets caustics by day and an underwater glow at night */
  water?: boolean;
}

/** A small warm pool at the foot, for a prop flagged `lightAtNight` that has no preset of its own. */
export const GENERIC_PRESET: LightPreset = { lights: [{ x: 0, y: -14, r: 30, color: '#ffc46a', squash: 0.7, glow: 0.4 }] };

/** String lights: a row of small warm bulbs across the top of a structure of the given width (art px), `n` bulbs. */
export function stringLights(width: number, top: number, n: number, color = '#ffd27a'): LightSpec[] {
  const out: LightSpec[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    // the wire sags between posts: bulbs hang lower in the middle
    const sag = Math.sin(t * Math.PI) * 4;
    out.push({ x: Math.round((t - 0.5) * width), y: Math.round(top + sag), r: 13, color, squash: 1, glow: 0.5 });
  }
  return out;
}

export const LIGHT_PRESETS: Record<string, LightPreset> = {
  // the praça fountain: teal underwater lights in the basin, and its surface catches the sun by day
  'props/fountain': { lights: [{ x: 0, y: -26, r: 46, color: '#5ff0e0', squash: 0.8, glow: 0.4 }, { x: 0, y: -26, r: 22, color: '#a8fff0', squash: 0.8, glow: 0.45 }], water: true },
  // a bandstand, when one exists: string lights under the roof
  'props/coreto': { lights: stringLights(64, -40, 7), },
  // a popcorn cart, a coconut-water cart
  'props/pipoqueiro': { lights: [{ x: 0, y: -22, r: 28, color: '#ffcf6a', squash: 0.9, glow: 0.45 }] },
  'props/carrinho_coco': { lights: [{ x: 0, y: -22, r: 26, color: '#fff0b8', squash: 0.9, glow: 0.4 }] },
};

/** The preset of a sprite key, the generic one when the prop is flagged, else none. */
export function presetFor(key: string | null, flagged: boolean | undefined): LightPreset | null {
  if (key && LIGHT_PRESETS[key]) return LIGHT_PRESETS[key];
  return flagged ? GENERIC_PRESET : null;
}
