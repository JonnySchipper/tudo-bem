/** Look -> composed sheet pixels. Pure (needs decoded layers, not a DOM), so it is unit tested with fake layers. */
import { composeRgba, type RgbaLayer } from './charcompose';
import { applyBodyHeight, frameBottoms, type Geometry } from './bodytype';
import { highlightEdges, outlineSheet } from './charfx';
import type { Look } from './looks';

export interface LayerSource {
  sheetW: number;
  sheetH: number;
  /** frame size and grid of the sheet (16x32, 8 x 18) */
  geometry: Geometry;
  layer(key: string): { data: Uint8ClampedArray | Uint8Array } | undefined;
}

const missing = new Set<string>();
const bottomsCache = new WeakMap<object, Int8Array>();

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
    layers.push({ data: d.data, ramps: l.ramps, post: l.hl ? (px) => highlightEdges(px, src.geometry) : undefined });
  }
  let rgba = composeRgba(src.sheetW * src.sheetH * 4, layers);
  const body = look.body === 'medio' ? undefined : src.layer('body_medio');
  if (body) {
    let bottoms = bottomsCache.get(body);
    if (!bottoms) {
      bottoms = frameBottoms(body.data, src.geometry);
      bottomsCache.set(body, bottoms);
    }
    rgba = applyBodyHeight(rgba, src.geometry, bottoms, look.body);
  }
  // one consistent outer outline on the finished silhouette (after the body height change moved the rows)
  outlineSheet(rgba, src.geometry);
  return rgba;
}
