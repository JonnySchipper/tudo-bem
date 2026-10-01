/**
 * Offline ground preview (visual pass V1): paints the terrain and the ground decals of Vila Ipê from public/pixel/ with no browser, no props, no light.
 *
 *   pnpm pixel
 *   apps/server/node_modules/.bin/tsx apps/client/tools/ground-preview.ts --region=0,6,28,10 --zoom=4 --out=.scratch/p.png [--room=praca] [--nodecals] [--grid]
 *
 * It uses the game's own `terrainTiles` and `sceneryFor`, so what it draws is what the scene draws, minus sprites on top.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOMS } from '@tudobem/shared';
import { terrainTiles } from '../src/render/pixel/terrainPlan';
import { sceneryFor } from '../src/render/pixel/scenery';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const PUB = path.resolve(import.meta.dirname, '../public/pixel');
const manifest = JSON.parse(fs.readFileSync(path.join(PUB, 'manifest.json'), 'utf8'));
const room = (ROOMS as Record<string, any>)[argv.room ?? 'praca'];
const [rx, ry, rw, rh] = (argv.region ?? `0,0,${room.cols},${room.rows}`).split(',').map(Number);
const Z = Number(argv.zoom ?? 4);

type Img = { w: number; h: number; data: Uint8Array };
async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
const W = room.cols * 16, H = room.rows * 16;
const canvas: Img = { w: W, h: H, data: new Uint8Array(W * H * 4) };
function blit(src: Img, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
    const si = ((sy + y) * src.w + sx + x) * 4, di = (ty * W + tx) * 4;
    const a = src.data[si + 3] / 255;
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) canvas.data[di + c] = Math.round(src.data[si + c] * a + canvas.data[di + c] * (1 - a));
    canvas.data[di + 3] = 255;
  }
}

const tileset = await load(path.join(PUB, manifest.terrain.tileset));
const { margin, spacing, columns } = manifest.terrain;
const { tiles } = terrainTiles(room.floor, manifest.terrain, {});
tiles.sort((a, b) => a.layer - b.layer);
for (const t of tiles) {
  const sx = margin + (t.idx % columns) * (16 + spacing), sy = margin + Math.floor(t.idx / columns) * (16 + spacing);
  blit(tileset, sx, sy, 16, 16, Math.round((t.i - 0.5) * 16), Math.round((t.j - 0.5) * 16));
}
if (!argv.nodecals) {
  const sc = sceneryFor(room, (k) => !!manifest.sprites[k]);
  const atlas = await load(path.join(PUB, manifest.atlases.outdoor.image));
  const frames = JSON.parse(fs.readFileSync(path.join(PUB, manifest.atlases.outdoor.data), 'utf8')).frames;
  for (const d of [...(sc?.decals ?? [])].sort((a, b) => a.depth - b.depth)) {
    const sd = manifest.sprites[d.key];
    const f = frames[sd.frame].frame;
    const ox = d.origin === 'tl' ? 0 : sd.ax, oy = d.origin === 'tl' ? 0 : sd.ay;
    blit(atlas, f.x, f.y, f.w, f.h, Math.round(d.x - ox), Math.round(d.y - oy));
  }
  // ground-level sprites the scene sorts below everything (bus lane etc. are decals already)
}
if (argv.grid) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 16 === 0 || y % 16 === 0) { const di = (y * W + x) * 4; canvas.data[di] = (canvas.data[di] + 255) >> 1; canvas.data[di + 1] >>= 1; canvas.data[di + 2] >>= 1; }
const out = argv.out ?? '.scratch/ground-preview.png';
await sharp(Buffer.from(canvas.data.buffer, canvas.data.byteOffset, canvas.data.length), { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: rx * 16, top: ry * 16, width: rw * 16, height: rh * 16 })
  .resize(rw * 16 * Z, rh * 16 * Z, { kernel: 'nearest' })
  .png()
  .toFile(out);
console.log('wrote', out);
