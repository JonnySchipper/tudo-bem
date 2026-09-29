/**
 * Composes a character from canonical layer sheets (HOWTO §5.5): palette-swap each layer's key colors, draw the layers back to
 * front into one canvas, register it as a Phaser spritesheet and create the walk/idle animations.
 *
 * The pure swap math lives in palette.ts (unit tested); this file only touches the DOM canvas and Phaser.
 */
import Phaser from 'phaser';
import { KEY_RAMPS, buildRamp, mergeTables, rampMap, swapKeys, type RampName } from './palette';

export type Facing = 'S' | 'W' | 'E' | 'N';
/** Row order of the canonical sheet (same as FACING_ROW in HOWTO §5.2). */
export const CANON_FACING_ROW: Record<Facing, number> = { S: 0, W: 1, E: 2, N: 3 };

export interface SheetMeta {
  frame: [number, number];
  cols: number;
  rows: number;
  anims: Record<string, { rows?: number[]; row?: number; frames: number; fps?: number; loop?: boolean; repeat?: number }>;
}

export interface CharLayer {
  /** texture key of the loaded layer PNG */
  texture: string;
  /** ramp name -> target base color; the ramp is generated with buildRamp */
  ramps?: Partial<Record<RampName, string>>;
}

const frameIndex = (meta: SheetMeta, row: number, col: number) => row * meta.cols + col;

/** Ramp table for a set of base colors (skin, hair, ...). */
export function tableFor(ramps: Partial<Record<RampName, string>>): Map<number, number> {
  const tables: Map<number, number>[] = [];
  for (const [name, base] of Object.entries(ramps) as [RampName, string][]) {
    const key = KEY_RAMPS[name];
    tables.push(rampMap(key, buildRamp(base, key.length as 3 | 4)));
  }
  return mergeTables(...tables);
}

export function composeCharacter(scene: Phaser.Scene, sheetKey: string, layers: CharLayer[], meta: SheetMeta): void {
  if (scene.textures.exists(sheetKey)) return;
  const [fw, fh] = meta.frame;
  const W = fw * meta.cols, H = fh * meta.rows;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('2d canvas unavailable');
  octx.imageSmoothingEnabled = false;
  for (const layer of layers) {
    const src = scene.textures.get(layer.texture).getSourceImage() as CanvasImageSource;
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    if (!tctx) throw new Error('2d canvas unavailable');
    tctx.drawImage(src, 0, 0);
    if (layer.ramps && Object.keys(layer.ramps).length) {
      const img = tctx.getImageData(0, 0, W, H);
      swapKeys(img.data, tableFor(layer.ramps));
      tctx.putImageData(img, 0, 0);
    }
    octx.drawImage(tmp, 0, 0);
  }
  const tex = scene.textures.addCanvas(sheetKey, out);
  if (!tex) throw new Error('addCanvas failed for ' + sheetKey);
  for (let r = 0; r < meta.rows; r++) for (let c = 0; c < meta.cols; c++) tex.add(frameIndex(meta, r, c), 0, c * fw, r * fh, fw, fh);
  createAnims(scene, sheetKey, meta);
}

export const animKey = (sheetKey: string, anim: string, facing: Facing) => `${sheetKey}:${anim}:${facing}`;

/** Creates `<sheet>:idle:S`, `<sheet>:walk:W`, ... for the looping animations. */
function createAnims(scene: Phaser.Scene, sheetKey: string, meta: SheetMeta): void {
  for (const name of ['idle', 'walk'] as const) {
    const a = meta.anims[name];
    if (!a?.rows) continue;
    (Object.keys(CANON_FACING_ROW) as Facing[]).forEach((f) => {
      const row = a.rows![CANON_FACING_ROW[f]];
      scene.anims.create({
        key: animKey(sheetKey, name, f),
        frames: Array.from({ length: a.frames }, (_, c) => ({ key: sheetKey, frame: frameIndex(meta, row, c) })),
        frameRate: a.fps ?? 8,
        repeat: -1,
      });
    });
  }
}

/** Frame index of the single-frame sit pose for a facing. */
export function sitFrame(meta: SheetMeta, facing: Facing): number {
  return frameIndex(meta, meta.anims.sit.rows![CANON_FACING_ROW[facing]], 0);
}
