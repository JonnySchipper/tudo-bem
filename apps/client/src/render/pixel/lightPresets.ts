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
  /** only the glow, no hole in the night (`Light.halo`): for a sign inside a lit hall */
  halo?: boolean;
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
  // the airport terminal at night (issue #168; the hall itself is lit by `roofLights.ts`): full lights on what stands against the dark
  // glass front (the AEROPORTO letters, the gate number, the departures board and the TERMINAL sign in the front row), halos only (the
  // hall is lit already, and stamps cost a phone) on the backlit signs further in, the information desk lamp and the café counter
  'aero/vidraca_letreiro': { lights: [{ x: 0, y: -36, r: 52, color: '#ffd560', squash: 0.32, glow: 0.45 }] },
  'aero/portao': { lights: [{ x: 0, y: -36, r: 18, color: '#ffd560', squash: 0.9, glow: 0.45 }] },
  'aero/painel': { lights: [{ x: 0, y: -28, r: 30, color: '#ffe9b0', squash: 0.8, glow: 0.45 }] },
  'aero/placa_terminal': { lights: [{ x: 0, y: -34, r: 24, color: '#eaf2ff', squash: 0.6, glow: 0.35 }] },
  'aero/placa_bagagem': { lights: [{ x: 0, y: -34, r: 24, color: '#eaf2ff', squash: 0.6, glow: 0.4, halo: true }] },
  'aero/placa_alfandega': { lights: [{ x: 0, y: -34, r: 24, color: '#eaf2ff', squash: 0.6, glow: 0.4, halo: true }] },
  'aero/placa_desembarque': { lights: [{ x: 0, y: -34, r: 30, color: '#eaf2ff', squash: 0.55, glow: 0.4, halo: true }] },
  'aero/informacoes': { lights: [{ x: 0, y: -18, r: 32, color: '#ffd690', squash: 0.75, glow: 0.4, halo: true }] },
  'aero/lanchonete': { lights: [{ x: 0, y: -30, r: 42, color: '#ffc46a', squash: 0.75, glow: 0.45, halo: true }] },
  // the feira's bunting over the aisle (96 px overhead, wire at its top): warm bulbs along the wire, so the aisle between the folded stalls
  // reads at night like the praça's lit corners, and the puddles under it catch them in the rain
  'props/bandeirinhas_b': { lights: stringLights(84, -18, 4, '#ffcf7a') },
  // the short bunting (one post, a 16 px overhead line): on the party boat's deck its two bulbs come on with the pier lamps at sunset
  'props/bandeirinha': { lights: stringLights(12, -14, 2, '#ffcf7a') },
};

/** The preset of a sprite key, the generic one when the prop is flagged, else none. */
export function presetFor(key: string | null, flagged: boolean | undefined): LightPreset | null {
  if (key && LIGHT_PRESETS[key]) return LIGHT_PRESETS[key];
  return flagged ? GENERIC_PRESET : null;
}
