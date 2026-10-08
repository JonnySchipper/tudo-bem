// The game's own look code (looks.ts -> composeLook.ts -> charcompose.ts), bundled with esbuild so the asset scripts compose a character
// exactly the way the world does. Used by the portraits: a portrait is a close-up of the sprite, so it starts from the composed sheet.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPng } from '../../../../scripts/lib/pixel/img.mjs';
import { CANON_COLS, CANON_ROWS, FRAME_W, FRAME_H } from '../../../../scripts/lib/pixel/chars.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');

let kit;
/** { lookForNpc, composeLook, NPC_STYLES, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, ROOMS, ... } from the client and shared sources. */
export async function lookKit() {
  if (kit) return kit;
  const { build } = createRequire(path.join(ROOT, 'apps/server/package.json'))('esbuild'); // esbuild is a server dev dependency
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-lookkit-'));
  const outfile = path.join(tmp, 'lookkit.mjs');
  await build({
    stdin: {
      contents: `export * from './apps/client/src/render/pixel/looks.ts'; export { composeLook } from './apps/client/src/render/pixel/composeLook.ts';
        export * from './packages/shared/src/index.ts';`,
      resolveDir: ROOT,
      sourcefile: 'lookkit-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
  });
  kit = await import(pathToFileURL(outfile).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return kit;
}

/** Character layers by key: the ones `pnpm pixel` just built, or the committed PNGs in public/pixel/chars. */
export async function charLayers(built) {
  if (built) return new Map(Object.entries(built));
  const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
  const out = new Map();
  for (const [key, file] of Object.entries(manifest.chars)) out.set(key, await loadPng(path.join(PIX, file)));
  return out;
}

export const SHEET_W = FRAME_W * CANON_COLS;
export const SHEET_H = FRAME_H * CANON_ROWS;

/** The NPC's composed sheet as an image ({ w, h, data }), the same pixels WorldScene draws. */
export async function npcSheet(id, layers) {
  const K = await lookKit();
  const src = {
    sheetW: SHEET_W,
    sheetH: SHEET_H,
    geometry: { frameW: FRAME_W, frameH: FRAME_H, cols: CANON_COLS, rows: CANON_ROWS },
    layer: (k) => layers.get(k),
  };
  const look = K.lookForNpc(id);
  return { w: SHEET_W, h: SHEET_H, data: new Uint8Array(K.composeLook(src, look)), look };
}

/** One 16x32 frame of a sheet (row 0 = idle facing S). */
export function sheetFrame(sheet, row = 0, col = 0) {
  const out = { w: FRAME_W, h: FRAME_H, data: new Uint8Array(FRAME_W * FRAME_H * 4) };
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
    const si = ((row * FRAME_H + y) * sheet.w + col * FRAME_W + x) * 4;
    out.data.set(sheet.data.subarray(si, si + 4), (y * FRAME_W + x) * 4);
  }
  return out;
}
