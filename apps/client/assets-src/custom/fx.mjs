// Small generated pieces: contact shadows, petals, glow, cloud shadow. Light/particle textures only (HOWTO D6 allows these to be generated).
// Colors come from the LimeZu palette (shadows use the outline navy/purple, petals the yellow ramp).
import { blank, setPx, hexPx, rng } from '../../../../scripts/lib/pixel/img.mjs';

/** Pixel ellipse contact shadow with a soft two-step falloff (outer ring lighter). */
export function shadowEllipse(w, h) {
  const img = blank(w, h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d <= 0.62) setPx(img, x, y, [26, 16, 48, 92]);
      else if (d <= 1.0) setPx(img, x, y, [26, 16, 48, 52]);
    }
  }
  return img;
}

/** 3x2 falling ipê petal, two tones. */
export function petal(kind = 0) {
  const img = blank(3, 3);
  if (kind === 0) {
    setPx(img, 0, 1, hexPx('#f8d239')); setPx(img, 1, 1, hexPx('#ffe57b')); setPx(img, 2, 1, hexPx('#f8d239'));
    setPx(img, 1, 2, hexPx('#f2b22b'));
  } else {
    setPx(img, 1, 0, hexPx('#ffe57b')); setPx(img, 0, 1, hexPx('#f8d239')); setPx(img, 1, 1, hexPx('#f2b22b'));
    setPx(img, 2, 2, hexPx('#ed931e'));
  }
  return img;
}

/** Ground decal: scattered fallen petals under an ipê. w x h in px, count petals. */
export function petalScatter(w, h, count, seed = 7) {
  const img = blank(w, h);
  const r = rng(seed);
  const tones = ['#f8d239', '#ffe57b', '#f2b22b', '#ed931e'];
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  let placed = 0, guard = 0;
  while (placed < count && guard++ < 2000) {
    const x = Math.floor(r() * w), y = Math.floor(r() * h);
    const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
    if (d > 1 || r() > 1 - d * 0.75) continue;
    const tone = tones[Math.floor(r() * tones.length)];
    setPx(img, x, y, hexPx(tone));
    if (r() < 0.35 && x + 1 < w) setPx(img, x + 1, y, hexPx(tones[Math.floor(r() * 2)]));
    placed++;
  }
  return img;
}

/** Soft radial light (white, alpha falloff). Used for light holes in the night darkness and for additive glow. */
export function glow(size) {
  const img = blank(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      if (d >= 1) continue;
      const a = Math.pow(1 - d, 1.6);
      setPx(img, x, y, [255, 255, 255, Math.round(a * 255)]);
    }
  }
  return img;
}

/** Tileable cloud-shadow mask: black blobs with dithered (pixel) edges, alpha 0 or 255. */
export function cloudShadow(w = 256, h = 128, seed = 11) {
  const img = blank(w, h);
  const r = rng(seed);
  const cell = 32;
  const gw = w / cell, gh = h / cell;
  const lattice = [];
  for (let j = 0; j < gh; j++) { lattice.push([]); for (let i = 0; i < gw; i++) lattice[j].push(r()); }
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const gx = x / cell, gy = y / cell;
    const i0 = Math.floor(gx), j0 = Math.floor(gy);
    const fx = smooth(gx - i0), fy = smooth(gy - j0);
    const v = (i, j) => lattice[((j % gh) + gh) % gh][((i % gw) + gw) % gw];
    const a = v(i0, j0) * (1 - fx) + v(i0 + 1, j0) * fx;
    const b = v(i0, j0 + 1) * (1 - fx) + v(i0 + 1, j0 + 1) * fx;
    return a * (1 - fy) + b * fy;
  };
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // two octaves, wrapped
      const n = 0.7 * noise(x, y) + 0.3 * noise(x * 2 + 17, y * 2 + 5);
      const th = 0.56 + (bayer[y & 3][x & 3] / 16 - 0.5) * 0.06;
      if (n > th) setPx(img, x, y, [0, 0, 0, 255]);
    }
  }
  return img;
}
