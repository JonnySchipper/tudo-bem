/**
 * Decoded character layer sheets (RGBA), shared by the game scene, the avatar creator preview and the hat icons.
 * Layers are plain PNGs from `public/pixel/chars/` listed in the manifest; they are decoded once through a 2D canvas.
 */
import type { Manifest } from './manifest';
import { loadManifest } from './manifest';
import type { Geometry } from './bodytype';

export interface Decoded {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export class CharAssets {
  readonly sheetW: number;
  readonly sheetH: number;
  readonly geometry: Geometry;
  constructor(
    readonly manifest: Manifest,
    private readonly layers: Map<string, Decoded>,
  ) {
    this.sheetW = manifest.sheet.frame[0] * manifest.sheet.cols;
    this.sheetH = manifest.sheet.frame[1] * manifest.sheet.rows;
    this.geometry = { frameW: manifest.sheet.frame[0], frameH: manifest.sheet.frame[1], cols: manifest.sheet.cols, rows: manifest.sheet.rows };
  }

  has(key: string): boolean {
    return this.layers.has(key);
  }

  layer(key: string): Decoded | undefined {
    return this.layers.get(key);
  }
}

function decode(url: string): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('2d canvas unavailable'));
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      resolve({ w: c.width, h: c.height, data: d.data });
    };
    img.onerror = () => reject(new Error(`layer ${url} failed to load`));
    img.src = url;
  });
}

export async function loadCharAssets(base: string, manifest: Manifest): Promise<CharAssets> {
  const entries = Object.entries(manifest.chars);
  const decoded = await Promise.all(entries.map(([, file]) => decode(base + file)));
  return new CharAssets(manifest, new Map(entries.map(([key], i) => [key, decoded[i]])));
}

let shared: Promise<CharAssets> | null = null;

/** One shared load per page (the creator preview and the game scene both use it). */
export function sharedCharAssets(): Promise<CharAssets> {
  if (!shared) {
    const base = `${import.meta.env.BASE_URL}pixel/`;
    shared = loadManifest(base).then((m) => loadCharAssets(base, m));
    shared.catch(() => {
      shared = null;
    });
  }
  return shared;
}
