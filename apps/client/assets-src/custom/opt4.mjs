// Option-4 player avatar (staging test): the auburn-bob / striped-tee concept frames in `assets-src/avatar-opt4/frames` (sliced from
// the concept sheets by extract.py, 168 px tall paintings) baked into one canonical player sheet at 32x64 per frame (8 cols x 18 rows,
// the same grid as the 16x32 sheets at 2x, see scripts/lib/pixel/chars.mjs). The game draws it at half the avatar scale, so the
// figure is the height of every other player (44 art px = 22 at 16x32) with twice the pixels in the face and clothes.
//
// Polish, in order: drop the cream fringe the background key left on the edges, downscale with premultiplied alpha, a light sharpen and
// contrast lift (the paintings are soft), a hard alpha edge, one shared palette for every frame (so colours do not shimmer between
// frames), a closed dark outline, then each frame is centred on its head (no sideways jump between idle and walk) with the soles on the bottom row.
import path from 'node:path';
import sharp from 'sharp';
import { blank, clone, flipH, loadPng, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { CANON_ANIMS, CANON_COLS, CANON_ROWS, FRAME_H, FRAME_W } from '../../../../scripts/lib/pixel/chars.mjs';
import { outlineShade } from '../../../client/src/render/pixel/charfx.ts';

const K = 2; // art px per 16x32-sheet px
const FW = FRAME_W * K, FH = FRAME_H * K;
/** standing height in art px: the LimeZu figure is 22 px at 16x32 (head top at y 10, soles on y 31) */
const TARGET_H = 44;
const SRC_H = 168;
/** the concept sheets' cream field (extract.py BG) */
const CREAM = [254, 240, 211];
const PALETTE = 40;

const SOURCES = { 'idle-down': 4, 'walk-down': 6, 'idle-right': 4, 'walk-right': 6, 'idle-up': 4, 'walk-up': 6 };

const near = (r, g, b, c, d) => (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2 < d * d;

/** Source frame -> clean RGBA: alpha hardened, the outer 2 px ring dropped when it is cream-tinted (the key's halo). */
function defringe(img) {
  const { w, h } = img;
  const out = clone(img);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img.data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (img.data[i + 3] < 128) {
        out.data[i + 3] = 0;
        continue;
      }
      out.data[i + 3] = 255;
      let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) if (a(x + dx, y + dy) < 128) { edge = true; break; }
      if (edge && near(img.data[i], img.data[i + 1], img.data[i + 2], CREAM, 70)) out.data[i + 3] = 0;
    }
  return out;
}

async function downscale(img) {
  const s = TARGET_H / SRC_H;
  const w = Math.round(img.w * s), h = Math.round(img.h * s);
  const { data } = await sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .linear(1.08, -8)
    .modulate({ saturation: 1.12 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = { w, h, data: new Uint8Array(data) };
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = out.data[i] >= 120 ? 255 : 0;
  return out;
}

/** k-means over every opaque pixel of every frame (deterministic seeds by luminance), then each pixel snaps to its nearest colour. */
function quantize(frames, k) {
  const px = [];
  for (const f of frames) for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3]) px.push([f.data[i], f.data[i + 1], f.data[i + 2]]);
  // farthest-point seeds (from the darkest pixel), so small but distinct colours (red sneakers, eyes) get their own entry
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const sample = px.filter((_, i) => i % 5 === 0);
  let centers = [[...sample.reduce((m, c) => (lum(c) < lum(m) ? c : m))]];
  const dist = sample.map(() => Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1];
    let far = 0;
    sample.forEach((c, i) => {
      dist[i] = Math.min(dist[i], (c[0] - last[0]) ** 2 + (c[1] - last[1]) ** 2 + (c[2] - last[2]) ** 2);
      if (dist[i] > dist[far]) far = i;
    });
    centers.push([...sample[far]]);
  }
  const nearest = (c) => {
    let best = 0, bd = Infinity;
    for (let j = 0; j < centers.length; j++) {
      const d = (c[0] - centers[j][0]) ** 2 + (c[1] - centers[j][1]) ** 2 + (c[2] - centers[j][2]) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  };
  for (let it = 0; it < 12; it++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    for (const c of px) {
      const j = nearest(c);
      sum[j][0] += c[0]; sum[j][1] += c[1]; sum[j][2] += c[2]; sum[j][3]++;
    }
    centers = centers.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c));
  }
  centers = centers.map((c) => c.map(Math.round));
  for (const f of frames)
    for (let i = 0; i < f.data.length; i += 4) {
      if (!f.data[i + 3]) continue;
      const c = centers[nearest([f.data[i], f.data[i + 1], f.data[i + 2]])];
      f.data[i] = c[0]; f.data[i + 1] = c[1]; f.data[i + 2] = c[2];
    }
}

/**
 * A closed 1 px outline outside the silhouette (4-neighbours), in a dark shade of the part it touches, the way the LimeZu figures and
 * the game's own `outlineSheet` close a character: without it the soft painted edge melts into busy ground.
 */
function outline(img) {
  const { w, h } = img;
  const out = clone(img);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : (y * w + x) * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (img.data[at(x, y) + 3]) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const j = at(x + dx, y + dy);
        if (j < 0 || !img.data[j + 3]) continue;
        const [r, g, b] = outlineShade(img.data[j], img.data[j + 1], img.data[j + 2]);
        const i = at(x, y);
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
        break;
      }
    }
  return out;
}

/** Places a frame in a 32x64 cell: head centroid on the cell's centre line, lowest opaque row on the bottom row. */
function cell(img) {
  let bottom = -1, top = img.h;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) { bottom = Math.max(bottom, y); top = Math.min(top, y); }
  let sx = 0, n = 0;
  const headEnd = top + Math.round(TARGET_H * 0.3);
  for (let y = top; y < headEnd; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) { sx += x; n++; }
  const cx = n ? sx / n : img.w / 2;
  const out = blank(FW, FH);
  paste(out, img, Math.round(FW / 2 - 0.5 - cx), FH - 1 - bottom);
  return out;
}

const shiftDown = (img, dy) => {
  const out = blank(img.w, img.h);
  paste(out, img, 0, dy);
  return out;
};

export async function buildOpt4({ dir }) {
  const names = [];
  const frames = [];
  for (const [name, n] of Object.entries(SOURCES))
    for (let i = 0; i < n; i++) {
      names.push(`${name}-${i}`);
      frames.push(await downscale(defringe(await loadPng(path.join(dir, `${name}-${i}.png`)))));
    }
  quantize(frames, PALETTE);
  const f = Object.fromEntries(names.map((nm, i) => [nm, cell(outline(frames[i]))]));
  const seq = (name, n, order) => order.map((k) => f[`${name}-${k % n}`]);
  // idle has 4 painted frames over the sheet's 6 columns; frame 2 is skipped (its arms swing out wider than the rest)
  const IDLE = [0, 1, 3, 3, 1, 0];
  const WALK = [0, 1, 2, 3, 4, 5];
  const byFacing = {
    S: { idle: seq('idle-down', 4, IDLE), walk: seq('walk-down', 6, WALK) },
    E: { idle: seq('idle-right', 4, IDLE), walk: seq('walk-right', 6, WALK) },
    N: { idle: seq('idle-up', 4, IDLE), walk: seq('walk-up', 6, WALK) },
  };
  byFacing.W = { idle: byFacing.E.idle.map(flipH), walk: byFacing.E.walk.map(flipH) };

  const sheet = blank(CANON_COLS * FW, CANON_ROWS * FH);
  const put = (img, col, row) => paste(sheet, img, col * FW, row * FH);
  ['S', 'W', 'E', 'N'].forEach((facing, fi) => {
    byFacing[facing].idle.forEach((img, c) => put(img, c, CANON_ANIMS.idle.rows[fi]));
    byFacing[facing].walk.forEach((img, c) => put(img, c, CANON_ANIMS.walk.rows[fi]));
    // no seated paintings yet: the standing frame lowered so the bench hides the legs
    put(shiftDown(byFacing[facing].idle[0], 8 * K), 0, CANON_ANIMS.sit.rows[fi]);
  });
  // emotes and the phone pose have no paintings yet: they stand (dancar walks in place)
  for (const a of Object.values(CANON_ANIMS)) {
    if (a.row === undefined) continue;
    const src = a === CANON_ANIMS.dancar ? byFacing.S.walk : byFacing.S.idle;
    for (let c = 0; c < a.frames; c++) put(src[c % src.length], c, a.row);
  }
  return { opt4_player: sheet };
}
