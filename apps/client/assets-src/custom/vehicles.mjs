// Traffic for Vila Ipê (art1): ônibus (LimeZu bus, wheel spin frames), kombi (LimeZu camper shortened and repainted two-tone),
// fusca and moto (authored with the pack palette, the pack has no beetle or motorbike).
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

// ------------------------------------------------------------------ kombi
async function kombiDir(ctx, dir) {
  const east = dir === 'e';
  let img = stripSoftAlpha(await ctx.load(`${VS}Camper_${east ? 'Right' : 'Left'}_1.png`));
  const W = img.w; // 96
  const mx = (x0, x1) => (east ? [x0, x1] : [W - x1, W - x0]);
  // 1. paint out the roof spare tire and the roof vent with the roof color
  for (const [x0, y0, x1, y1] of [[15, 10, 37, 25], [43, 11, 58, 22]]) {
    const [a, b] = mx(x0, x1);
    rect(img, a, y0, b - a, y1 - y0, '#d8d0e0');
  }
  // 2. two-tone: white upper body, teal lower body; the brown stripe becomes a cream belt line
  const lower = (x, y) => y >= 44;
  const out = clone(img);
  const teal = { '#b2aecb': '#367f82', '#989ebe': '#2e7177', '#8b8bab': '#2a575b', '#c6bdd5': '#49928f', '#a4bbd5': '#49928f', '#d8d0e0': '#539b8f' };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < W; x++) {
    const h = hexAt(img, x, y);
    if (!h) continue;
    if (h === '#ac7949') setPx(out, x, y, hexPx(y === 48 ? '#f0efde' : '#eee1b7'));
    else if (h === '#845156' || h === '#8e595c') setPx(out, x, y, hexPx(y > 40 ? '#367f82' : '#b2aecb'));
    else if (lower(x, y) && teal[h] && y < 55) setPx(out, x, y, hexPx(teal[h]));
    else if (y >= 30 && y < 44 && h === '#b2aecb') setPx(out, x, y, hexPx('#d8d0e0'));
    else if (y >= 30 && y < 44 && h === '#989ebe') setPx(out, x, y, hexPx('#c6bdd5'));
  }
  img = out;
  // 3. shorten: cut a 26 px band from the middle
  const CUT = 22;
  const cutA = east ? 40 : W - 40 - CUT;
  const left = crop(img, 0, 0, cutA, img.h), right = crop(img, cutA + CUT, 0, W - cutA - CUT, img.h);
  const res = blank(W - CUT, img.h);
  paste(res, left, 0, 0); paste(res, right, cutA, 0);
  // hide the seam: the door post of the source ends up next to the cut, copy the neighbouring column over it
  const seam = east ? cutA : cutA - 1;
  for (let y = 28; y < 58; y++) { const p = px(res, east ? seam - 1 : seam + 1, y); if (p && p[3]) setPx(res, seam, y, p); }
  return { img: res };
}

export async function kombi(ctx) {
  const e = await kombiDir(ctx, 'e'), w = await kombiDir(ctx, 'w');
  const meta = { footprint: [4, 2], shadow: 'fx/shadow_48' };
  return [
    { key: 'vehicles/kombi_e', img: e.img, anchor: [Math.floor(e.img.w / 2), 60], meta },
    { key: 'vehicles/kombi_w', img: w.img, anchor: [Math.floor(w.img.w / 2), 60], meta },
  ];
}
