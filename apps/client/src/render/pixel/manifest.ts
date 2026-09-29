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
  /** standalone images for the DOM (portraits, icons, ui kit, the parrot strip): see `imageUrl` / `nineSlice` */
  images?: Record<string, ImageDef>;
}

/** A standalone PNG under `public/pixel/` shown by the DOM (an `<img>`, a CSS `border-image`, a background strip). */
export interface ImageDef {
  file: string;
  w: number;
  h: number;
  /** animated strips: frame count, frame width in px, playback speed */
  frames?: number;
  frameW?: number;
  fps?: number;
  /** 9-slice insets in image px (ui kit) and the ready `border-image-slice` string "top right bottom left" */
  slice?: { top: number; right: number; bottom: number; left: number };
  css?: string;
}

export async function loadManifest(base: string): Promise<Manifest> {
  const res = await fetch(`${base}manifest.json`);
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  return (await res.json()) as Manifest;
}

// ---------------------------------------------------------------- DOM image helpers

/** Where `public/pixel/` is served from. */
export const pixelBase = (): string => `${import.meta.env.BASE_URL}pixel/`;

let uiImages: Manifest['images'] | null = null;
let uiManifest: Promise<Manifest> | null = null;

/** Remembers the manifest's `images` so `imageUrl` / `nineSlice` can answer synchronously. */
export function setUiManifest(m: Pick<Manifest, 'images'>): void {
  uiImages = m.images ?? null;
}

/** Loads the manifest once for the DOM UI (both views) and registers it. Resolves to null when it cannot be loaded. */
export function loadUiManifest(): Promise<Manifest | null> {
  uiManifest ??= loadManifest(pixelBase()).then((m) => {
    setUiManifest(m);
    return m;
  });
  return uiManifest.catch(() => null);
}

/** The image entry for `key`, or null (unknown key, or the manifest is not loaded yet). */
export function imageDef(key: string, images: Manifest['images'] | null = uiImages): ImageDef | null {
  return images?.[key] ?? null;
}

/**
 * URL of a standalone image. Files are named after their key (`icons/pao` -> `icons/pao.png`), so the URL is also right
 * before the manifest has loaded, and an image that is not listed still gets a URL (a 404 shows the `alt` text).
 */
export function imageUrl(key: string, images: Manifest['images'] | null = uiImages, base: string = pixelBase()): string {
  return base + (imageDef(key, images)?.file ?? `${key}.png`);
}

export interface NineSlice {
  url: string;
  /** `border-image-slice` value, "top right bottom left" */
  slice: string;
  /** `border-width` in px, equal to the slice insets at 1 CSS px per art px */
  width: string;
  /** the whole `border-image` shorthand (with `fill`) at `scale` CSS px per art px */
  borderImage(scale?: number): string;
}

/** 9-slice data for a ui kit image (`ui/panel`, `ui/button`, ...), or null when it has no slice. */
export function nineSlice(key: string, images: Manifest['images'] | null = uiImages, base: string = pixelBase()): NineSlice | null {
  const d = imageDef(key, images);
  if (!d?.slice) return null;
  const { top, right, bottom, left } = d.slice;
  const url = imageUrl(key, images, base);
  const slice = d.css ?? `${top} ${right} ${bottom} ${left}`;
  return {
    url,
    slice,
    width: `${top}px ${right}px ${bottom}px ${left}px`,
    borderImage: (scale = 1) => `url(${url}) ${slice} fill / ${top * scale}px ${right * scale}px ${bottom * scale}px ${left * scale}px / 0 stretch`,
  };
}
