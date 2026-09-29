/** Types + loader for public/pixel/manifest.json (written by scripts/pixel-import.mjs, never edited by hand). */
import type { SheetMeta } from './charsheet';

export interface SpriteDef {
  atlas: string;
  frame: string;
  w: number;
  h: number;
  /** anchor inside the sprite, placed at the bottom-centre of the footprint (may lie outside the sprite for overhead parts) */
  ax: number;
  ay: number;
  footprint: [number, number];
  anim: { frames: string[]; fps: number } | null;
  /** key of the overhead (canopy) sprite, `true` when this sprite itself is overhead, or null */
  overhead: string | true | null;
  shadow: string | null;
  cast?: { frame: string; w: number; h: number; ax: number; ay: number };
  decal?: boolean;
  light?: { x: number; y: number; r: number; color: string };
  windows?: [number, number, number, number][];
  /** key of a same-size overlay sprite with the lit window panes (facades); draw it above the facade at night */
  lit?: string;
  /** wire attach point relative to the anchor (utility pole) */
  attach?: [number, number];
}

export interface TerrainLayerDef {
  name: string;
  edge: 'slab' | 'flat' | 'flush';
  first: number;
  phases: number;
  /** vertical phases of a 2D phase grid (flush floors); absent = 1 */
  phasesY?: number;
  variants: number;
  tiles: number;
}

export interface Manifest {
  version: number;
  tile: number;
  atlases: Record<string, { image: string; data: string; w: number; h: number; frames: number }>;
  terrain: { tileset: string; tile: number; margin: number; spacing: number; columns: number; count: number; layers: Record<string, TerrainLayerDef> };
  sprites: Record<string, SpriteDef>;
  chars: Record<string, string>;
  sheet: SheetMeta & { facingRow: Record<string, number> };
  keyRamps: Record<string, string[]>;
  fx: Record<string, { file: string; w: number; h: number }>;
}

export async function loadManifest(base: string): Promise<Manifest> {
  const res = await fetch(`${base}manifest.json`);
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  return (await res.json()) as Manifest;
}
