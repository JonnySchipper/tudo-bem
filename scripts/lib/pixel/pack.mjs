// Shelf atlas packer with 1px extrusion around every frame; writes a Phaser "JSON hash" atlas.
import { blank, paste, extrude } from './img.mjs';

/**
 * @param {{name: string, img: {w,h,data}}[]} items
 * @param {{ maxWidth?: number, extrusion?: number, gap?: number }} opts
 */
export function packAtlas(items, opts = {}) {
  const maxW = opts.maxWidth ?? 512;
  const ext = opts.extrusion ?? 1;
  const gap = opts.gap ?? 1;
  const cells = items
    .map((it) => ({ name: it.name, img: it.img, ext: extrude(it.img, ext) }))
    .sort((a, b) => b.ext.h - a.ext.h || b.ext.w - a.ext.w || a.name.localeCompare(b.name));
  let x = 0, y = 0, rowH = 0, usedW = 0;
  const placed = [];
  for (const c of cells) {
    if (x + c.ext.w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
    placed.push({ ...c, px: x, py: y });
    x += c.ext.w + gap;
    rowH = Math.max(rowH, c.ext.h);
    usedW = Math.max(usedW, x - gap);
  }
  const H = y + rowH;
  const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));
  const atlas = blank(nextPow2(usedW), nextPow2(H));
  const frames = {};
  for (const p of placed) {
    paste(atlas, p.ext, p.px, p.py);
    frames[p.name] = {
      frame: { x: p.px + ext, y: p.py + ext, w: p.img.w, h: p.img.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.img.w, h: p.img.h },
      sourceSize: { w: p.img.w, h: p.img.h },
    };
  }
  return { atlas, json: { frames, meta: { app: 'tudobem pixel-import', version: '1', size: { w: atlas.w, h: atlas.h }, scale: '1' } } };
}
