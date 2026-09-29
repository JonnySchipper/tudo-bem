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

/**
 * Ground grime: a stippled, low-alpha warm-dark stain (oil, wet patch, wear) that breaks up big flat paving/asphalt areas.
 * Two alpha levels only, in the pixel-art way; no gradients.
 */
export function grime(w, h, seed = 3) {
  const img = blank(w, h);
  const r = rng(seed);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const bl = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const wob = [r() * 6, r() * 6, r() * 6];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = Math.atan2((y - cy) / (h / 2), (x - cx) / (w / 2));
      const edge = 0.72 + 0.16 * Math.sin(a * 3 + wob[0]) + 0.1 * Math.sin(a * 5 + wob[1]);
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d > edge) continue;
      const t = 1 - d / edge; // 1 centre .. 0 edge
      const th = bl[y & 3][x & 3] / 16;
      if (t > 0.55 && t * 0.9 > th * 0.9) setPx(img, x, y, [40, 26, 30, 46]);
      else if (t * 1.15 > th) setPx(img, x, y, [40, 26, 30, 26]);
    }
  }
  return img;
}

/**
 * Window light on an interior floor (Phase 4a): the window's shape cast down and to the right (light comes from the upper left), with the
 * mullions and the transom as unlit gaps. Warm, three alpha bands with dithered band edges and a dithered far end; drawn with the ADD blend at
 * a low alpha. `w` is the window width in px (the patch is `w` + 16 wide, 40 tall), `panes` the number of window panes across.
 */
export function lightPatch(w, panes = 2) {
  const H = 40, shift = 16;
  const img = blank(w + shift, H);
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const gaps = [];
  for (let i = 1; i < panes; i++) gaps.push(Math.round((w * i) / panes));
  for (let y = 0; y < H; y++) {
    const x0 = Math.round((y * shift) / H);
    const t = y / H;
    for (let x = 0; x < w; x++) {
      if (gaps.some((g) => x >= g - 1 && x <= g)) continue; // mullion shadows
      if (y >= 13 && y < 15) continue; // transom shadow
      const d = bayer[y & 3][x & 3] / 16 - 0.5; // -0.5..0.5
      const u = t + d * 0.09;
      if (u > 0.93) continue;
      const a = u < 0.5 ? 78 : u < 0.78 ? 52 : 30;
      setPx(img, x0 + x, y, [255, 216, 146, a]);
    }
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
export function cloudShadow(w = 512, h = 256, seed = 11, cell = 64) {
  const img = blank(w, h);
  const r = rng(seed);
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
      // soft edge: a smooth alpha ramp (light effect, so a gradient is fine); the tiny bayer term only breaks up banding
      const t = Math.min(1, Math.max(0, (n - 0.56 + (bayer[y & 3][x & 3] / 16 - 0.5) * 0.01) / 0.16));
      const a = t * t * (3 - 2 * t);
      if (a > 0.004) setPx(img, x, y, [0, 0, 0, Math.round(a * 255)]);
    }
  }
  return img;
}
