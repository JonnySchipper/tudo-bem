// Traffic for Vila Ipê: ônibus (LimeZu bus, wheel spin frames). The kombi, fusca and moto are authored in vehicles-auth.mjs
// (art2 redrew them; the art1 kombi was a repainted LimeZu camper and read as a generic van).
import { blank, clone, paste, crop, setPx, hexPx, px, C, K, rect, hline, vline, dot, drawShaded, newMask, fillMask, ellipse, union, rectP, minus, swap, stripSoftAlpha, outlineAround, stretchCols, hexAt } from './kit.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';

const VS = 'ext:ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_';

/** Rotates the wheel hub 90 degrees around (cx, cy) (radius r) so the wheel looks like it turns between two frames. */
function spinHub(img, cx, cy, r) {
  const out = clone(img);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy > r * r) continue;
    const sx = Math.floor(cx + dy), sy = Math.floor(cy - dx); // rotate by 90 degrees
    const p = px(img, sx, sy);
    if (p) setPx(out, x, y, p);
  }
  return out;
}

/** Finds the hub (slate greys inside the dark tyre) of the wheels in the lower part and returns their centers. */
function findHubs(img, yMin) {
  const hubCols = new Set(['#565972', '#6c6e85', '#7d7f99', '#8b8bab']);
  const pts = [];
  for (let y = yMin; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const h = hexAt(img, x, y);
    if (!h || !hubCols.has(h)) continue;
    // must be surrounded by tyre navy within 3 px on the left or right
    const l = hexAt(img, x - 3, y), r = hexAt(img, x + 3, y);
    if ((l === '#3a3a50' || l === '#46465e') && (r === '#3a3a50' || r === '#46465e')) pts.push([x, y]);
  }
  const groups = [];
  for (const [x, y] of pts) {
    let g = groups.find((g) => Math.abs(g.cx - x) < 9 && Math.abs(g.cy - y) < 9);
    if (!g) { g = { n: 0, sx: 0, sy: 0, cx: x, cy: y }; groups.push(g); }
    g.n++; g.sx += x; g.sy += y; g.cx = g.sx / g.n; g.cy = g.sy / g.n;
  }
  return groups.filter((g) => g.n > 8).map((g) => [g.cx + 0.5, g.cy + 0.5]);
}

async function bus(ctx, dir) {
  const src = await ctx.load(`${VS}Bus_${dir === 'e' ? 'Right' : 'Left'}_5.png`);
  const f0 = src;
  let f1 = src;
  const hubs = findHubs(src, 46);
  for (const [cx, cy] of hubs) f1 = spinHub(f1, cx, cy, 4);
  return [{ key: `vehicles/onibus_${dir}`, frames: [f0, f1], fps: 8, anchor: [56, 60], meta: { footprint: [6, 2], shadow: 'fx/shadow_48' } }];
}

export async function onibus(ctx) {
  return [...(await bus(ctx, 'e')), ...(await bus(ctx, 'w'))];
}
