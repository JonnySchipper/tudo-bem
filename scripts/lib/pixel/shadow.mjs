// Flat cast shadows derived from a sprite's silhouette: light comes from the upper left, so shadows fall down-right (HOWTO 4.2 rule 3).
import { blank, setPx } from './img.mjs';

/**
 * @param img sprite
 * @param baseY row of the sprite where it touches the ground (its anchor y)
 * @param kx horizontal shift per pixel of height, ky vertical shift per pixel of height (foreshortened: ky < kx)
 * @returns { img, ax, ay } shadow image plus its anchor (place ax, ay at the sprite's anchor point in the world)
 */
export function castShadow(img, baseY, anchorX, kx, ky, rgba = [26, 16, 48, 66]) {
  const maxH = baseY;
  const sw = img.w + Math.ceil(maxH * kx) + 2;
  const sh = Math.ceil(maxH * ky) + 3;
  const out = blank(sw, sh);
  const alphaAt = (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= img.w || yi >= img.h) return 0;
    return img.data[(yi * img.w + xi) * 4 + 3];
  };
  for (let py = 1; py < sh; py++) {
    const hgt = (py - 1) / ky;
    const y = baseY - hgt;
    if (y < 0) continue;
    for (let px = 0; px < sw; px++) {
      const x = px - hgt * kx;
      if (alphaAt(x, y) > 0 || alphaAt(x - 0.5, y) > 0 || alphaAt(x + 0.5, y) > 0) setPx(out, px, py, rgba);
    }
  }
  return { img: out, ax: anchorX, ay: 1 };
}
