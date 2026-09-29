/** Look -> composed sheet pixels. Pure (needs decoded layers, not a DOM), so it is unit tested with fake layers. */
import { composeRgba, type RgbaLayer } from './charcompose';
import type { Look } from './looks';

export interface LayerSource {
  sheetW: number;
  sheetH: number;
  layer(key: string): { data: Uint8ClampedArray | Uint8Array } | undefined;
}

const missing = new Set<string>();

export function composeLook(src: LayerSource, look: Look): Uint8ClampedArray {
  const layers: RgbaLayer[] = [];
  for (const l of look.layers) {
    const d = src.layer(l.key);
    if (!d) {
      if (!missing.has(l.key)) {
        missing.add(l.key);
        console.warn(`[pixel] character layer '${l.key}' is missing from the manifest`);
      }
      continue;
    }
    layers.push({ data: d.data, ramps: l.ramps });
  }
  return composeRgba(src.sheetW * src.sheetH * 4, layers);
}
