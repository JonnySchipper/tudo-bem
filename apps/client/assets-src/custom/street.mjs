// Street details authored for Vila Ipê: zebra crossing, lane dashes, flower scatters, grass tufts. LimeZu palette colors only.
import { blank, setPx, hexPx, rng } from '../../../../scripts/lib/pixel/img.mjs';

/**
 * Zebra crossing over an asphalt road that runs left-right: bold horizontal bars (4 px bar, 4 px gap, like the real ones: bar and gap are the same
 * width), white with a shaded lower row so each bar sits on the road, rounded ends, and only a handful of chipped pixels. w x h px.
 */
export function crosswalk(w = 32, h = 64, seed = 5) {
  const img = blank(w, h);
  const r = rng(seed);
  const pitch = 8, bar = 4;
  for (let by = 2; by + bar <= h - 1; by += pitch) {
    for (let y = by; y < by + bar; y++) {
      for (let x = 1; x < w - 1; x++) {
        const end = x === 1 || x === w - 2;
        if (end && (y === by || y === by + bar - 1)) continue; // rounded ends
        if (r() < 0.012) continue; // a chip of worn paint
        const hex = y === by ? '#f0efde' : y === by + bar - 1 ? '#c6bdd5' : '#ebe4f2';
        setPx(img, x, y, hexPx(hex));
      }
    }
  }
  return img;
}

/** One yellow lane dash, len x 2 px (centre line, Brazilian yellow), with the end pixels trimmed so it reads as paint, not a bar. */
export function laneDash(len = 12) {
  const img = blank(len, 2);
  for (let x = 0; x < len; x++) { setPx(img, x, 0, hexPx('#f8d239')); setPx(img, x, 1, hexPx(x === 0 || x === len - 1 ? '#ed931e' : '#f2b22b')); }
  return img;
}

/** Sparse wildflowers on transparent: plus-shaped 3x3 blooms with a coloured centre, plus single-pixel buds. */
export function flowerScatter(w, h, count, seed = 1) {
  const img = blank(w, h);
  const r = rng(seed);
  const petals = ['#ebe4f2', '#e88dad', '#f8d239', '#ffa0a0', '#95e3e3'];
  const centers = ['#f2b22b', '#ed931e', '#f8d239'];
  const leaf = ['#64b63b', '#568d61'];
  let placed = 0, guard = 0;
  while (placed < count && guard++ < 500) {
    const x = 2 + Math.floor(r() * (w - 4)), y = 2 + Math.floor(r() * (h - 4));
    if (img.data[(y * w + x) * 4 + 3]) continue;
    const p = petals[Math.floor(r() * petals.length)];
    if (r() < 0.6) {
      setPx(img, x, y - 1, hexPx(p)); setPx(img, x - 1, y, hexPx(p)); setPx(img, x + 1, y, hexPx(p)); setPx(img, x, y + 1, hexPx(p));
      setPx(img, x, y, hexPx(p === '#f8d239' ? '#ed931e' : centers[Math.floor(r() * centers.length)]));
    } else {
      setPx(img, x, y, hexPx(p));
      setPx(img, x, y + 1, hexPx(leaf[0]));
    }
    placed++;
  }
  return img;
}

/** A small grass tuft (5x4 or 4x3) that pokes through paving cracks. */
export function tuft(kind = 0) {
  const rows = kind === 0
    ? ['.g.g.', 'gGgGg', '.GgG.', '..G..']
    : ['g..g.', 'gGgG.', '.GgGg', '..G..'];
  const pal = { g: '#9bc246', G: '#64b63b' };
  const img = blank(5, 4);
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') setPx(img, x, y, hexPx(pal[c])); }));
  return img;
}
