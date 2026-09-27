/**
 * Runtime loader for baked art (apps/client/public/art, produced by `pnpm art`).
 *
 * Static props, furniture, hats and food icons are drawn from baked PNGs when available; animated
 * pieces (trees, fan, cat, avatars…) stay live. Anything missing falls back to the procedural
 * renderer, so the game never shows a hole. `?art=live` forces live drawing everywhere.
 * TB Art can replace any PNG in public/art with a hand-painted one of the same name/anchor.
 */
import type { Dir, PropDef } from '@tudobem/shared';
import { furnitureById } from '@tudobem/shared';

export interface SpriteMeta {
  file: string;
  /** Size in world units (1 unit = 1 px at camera scale 1). */
  w: number;
  h: number;
  /** Offset of the image's top-left from the anchor (tile-center floor point), world units. */
  ox: number;
  oy: number;
  /** Content hash stamped by `pnpm art`; appended as ?v= so a re-baked sprite never hits a stale cache. */
  v?: string;
}

export interface ArtManifest {
  version: number;
  scale: number;
  generatedBy: string;
  sprites: Record<string, SpriteMeta>;
}

/** Props that animate (or depend on live state) stay procedural. */
export const ANIMATED_PROPS = new Set<PropDef['kind']>(['ipe', 'poste', 'barraca_chapeus', 'trilho_pedidos', 'poleiro']);
export const ANIMATED_FURNITURE = new Set(['planta', 'radio', 'ventilador', 'gato']);

export function propKey(p: PropDef, slice = 0): string | null {
  if (ANIMATED_PROPS.has(p.kind)) return null;
  if (p.kind === 'balcao') return `props/balcao_${slice}_of_${p.w ?? 1}`;
  if (p.kind === 'banco' || p.kind === 'cadeira_padaria') return `props/${p.kind}_${(p.seat ?? 'SE') as Dir}`;
  return `props/${p.kind}`;
}

export function furnitureKey(itemId: string, rot: 0 | 1): string | null {
  const def = furnitureById(itemId);
  if (!def || ANIMATED_FURNITURE.has(def.kind)) return null;
  return `furniture/${itemId}_${rot}`;
}

const live = typeof location !== 'undefined' && new URLSearchParams(location.search).get('art') === 'live';
let manifest: ArtManifest | null = null;
const images = new Map<string, HTMLImageElement>();

const ART_BASE = `${import.meta.env.BASE_URL ?? '/'}art/`;

/** Sprite URL, versioned by content hash (art is served immutable under fixed file names). */
export const spriteSrc = (base: string, meta: SpriteMeta) => base + meta.file + (meta.v ? `?v=${meta.v}` : '');

export async function loadArt(base = ART_BASE) {
  if (live || manifest) return;
  try {
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = (await res.json()) as ArtManifest;
    for (const [key, meta] of Object.entries(manifest.sprites)) {
      const img = new Image();
      img.decoding = 'async';
      img.src = spriteSrc(base, meta);
      images.set(key, img);
    }
  } catch {
    manifest = null;
  }
}

function ready(key: string | null): { img: HTMLImageElement; meta: SpriteMeta } | null {
  if (!key || !manifest) return null;
  const meta = manifest.sprites[key];
  const img = images.get(key);
  if (!meta || !img || !img.complete || !img.naturalWidth) return null;
  return { img, meta };
}

/** Draw a baked sprite anchored at (x, y). Returns false if not available (caller draws live). */
export function drawSprite(ctx: CanvasRenderingContext2D, key: string | null, x: number, y: number): boolean {
  const s = ready(key);
  if (!s) return false;
  ctx.drawImage(s.img, x + s.meta.ox, y + s.meta.oy, s.meta.w, s.meta.h);
  return true;
}

export function spriteUrl(key: string): string | null {
  if (live || !manifest?.sprites[key]) return null;
  return spriteSrc(ART_BASE, manifest.sprites[key]);
}

export function artStats() {
  return { live, loaded: [...images.values()].filter((i) => i.complete && i.naturalWidth).length, total: images.size };
}
