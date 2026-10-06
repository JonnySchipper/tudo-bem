/**
 * The shoulder parrot is painted green. Phaser's multiply tint cannot turn those greens blue
 * (a channel that is near zero stays near zero), so a bought colour has to remap the body.
 * Outline, beak, eye and feet stay put.
 */

/** Body greens, dark to light, sampled from `chars/parrot_strip.png`. */
export const PARROT_BODY_GREENS = [0x3f8f4a, 0x5dbb54, 0x8fdc6b] as const;

const SHADE = [0.55, 0.78, 1] as const;

function shade(tint: number, factor: number): number {
  const scale = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor)));
  return (scale((tint >> 16) & 255) << 16) | (scale((tint >> 8) & 255) << 8) | scale(tint & 255);
}

/** Dark/mid/light body colours for `tint`. White (the green bird) remaps nothing. */
export function parrotBodyMap(tint: number): Map<number, number> | null {
  if ((tint & 0xffffff) === 0xffffff) return null;
  const map = new Map<number, number>();
  PARROT_BODY_GREENS.forEach((green, i) => map.set(green, shade(tint, SHADE[i]!)));
  return map;
}

/** Recolor body greens in an RGBA buffer in place. Other pixels, including transparency, stay. */
export function recolorParrotPixels(data: Uint8ClampedArray, tint: number): void {
  const map = parrotBodyMap(tint);
  if (!map) return;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const hex = ((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!) >>> 0;
    const next = map.get(hex);
    if (next === undefined) continue;
    data[i] = (next >> 16) & 255;
    data[i + 1] = (next >> 8) & 255;
    data[i + 2] = next & 255;
  }
}
