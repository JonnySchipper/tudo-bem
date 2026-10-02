/**
 * Pure (no DOM, no Phaser) layer composition for characters: key-color swap per layer, then alpha-over into one RGBA buffer.
 * The game scene, the avatar creator preview and the hat icons all compose through this, so what you design is what you see in the world.
 */
import { KEY_RAMPS, buildRamp, hexToRgb, mergeTables, pack, rampMap, swapKeys, type RampName } from './palette';

export type Ramps = Partial<Record<RampName, string>>;

export interface RgbaLayer {
  data: Uint8ClampedArray | Uint8Array;
  ramps?: Ramps;
  /** exact colour swaps applied after the ramps (a belt on the gi layer): source colour -> target colour, both `#rrggbb` */
  map?: Record<string, string>;
  /** runs on the recolored copy of the layer before it is composited (the top-left light on hair and shoulders) */
  post?: (data: Uint8ClampedArray) => void;
}

/** Key-color -> target-color table for a set of base colors (skin, hair, ...). */
export function tableFor(ramps: Ramps): Map<number, number> {
  const tables: Map<number, number>[] = [];
  for (const [name, base] of Object.entries(ramps) as [RampName, string][]) {
    const key = KEY_RAMPS[name];
    tables.push(rampMap(key, buildRamp(base, key.length as 3 | 4)));
  }
  return mergeTables(...tables);
}

/** Table for exact colour swaps (`#rrggbb` -> `#rrggbb`). */
export function exactTable(map: Record<string, string>): Map<number, number> {
  const m = new Map<number, number>();
  for (const [from, to] of Object.entries(map)) {
    const [fr, fg, fb] = hexToRgb(from);
    const [tr, tg, tb] = hexToRgb(to);
    m.set(pack(fr, fg, fb), pack(tr, tg, tb));
  }
  return m;
}

/** Source-over of one RGBA buffer onto another of the same size (fully opaque or fully transparent pixels are copied, the rest is blended). */
export function compositeOver(dst: Uint8ClampedArray | Uint8Array, src: Uint8ClampedArray | Uint8Array): void {
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    if (a === 0) continue;
    if (a === 255 || dst[i + 3] === 0) {
      dst[i] = src[i];
      dst[i + 1] = src[i + 1];
      dst[i + 2] = src[i + 2];
      dst[i + 3] = a;
      continue;
    }
    const fa = a / 255;
    const da = dst[i + 3] / 255;
    const oa = fa + da * (1 - fa);
    for (let c = 0; c < 3; c++) dst[i + c] = Math.round((src[i + c] * fa + dst[i + c] * da * (1 - fa)) / oa);
    dst[i + 3] = Math.round(oa * 255);
  }
}

/** Composes layers back to front into a new RGBA buffer of `length` bytes. Source layers are never modified. */
export function composeRgba(length: number, layers: readonly RgbaLayer[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(length);
  const tmp = new Uint8ClampedArray(length);
  for (const layer of layers) {
    if (layer.data.length !== length) throw new Error(`layer size mismatch: ${layer.data.length} vs ${length}`);
    if ((layer.ramps && Object.keys(layer.ramps).length) || layer.post || layer.map) {
      tmp.set(layer.data);
      if (layer.ramps && Object.keys(layer.ramps).length) swapKeys(tmp, tableFor(layer.ramps));
      if (layer.map) swapKeys(tmp, exactTable(layer.map));
      layer.post?.(tmp);
      compositeOver(out, tmp);
    } else compositeOver(out, layer.data);
  }
  return out;
}
