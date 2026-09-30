/**
 * Registers a composed character sheet (RGBA from `composeLook`) as a Phaser spritesheet and creates its animations:
 *   `<sheet>:idle:S|W|E|N`, `<sheet>:walk:...`, and one per emote / pose row facing S: `<sheet>:oi:S`, `<sheet>:phone:S`, ...
 * The pure composition lives in charcompose.ts / composeLook.ts (unit tested); this file only touches the DOM canvas and Phaser.
 */
import Phaser from 'phaser';
import { FACING_ROW, type Facing } from './facing';

export type { Facing };

export interface AnimMeta {
  rows?: number[];
  row?: number;
  frames: number;
  fps?: number;
  loop?: boolean;
  /** total plays (emotes) */
  repeat?: number;
  /** ms to hold the last frame */
  hold?: number;
}

export interface SheetMeta {
  frame: [number, number];
  cols: number;
  rows: number;
  anims: Record<string, AnimMeta>;
}

/** Names of the emote animations (facing S) in the sheet. */
export const EMOTE_ANIMS = ['oi', 'dancar', 'rir', 'valeu', 'desculpa'] as const;

const frameIndex = (meta: SheetMeta, row: number, col: number) => row * meta.cols + col;

export function addSheetTexture(scene: Phaser.Scene, sheetKey: string, rgba: Uint8ClampedArray, meta: SheetMeta): void {
  if (scene.textures.exists(sheetKey)) return;
  const [fw, fh] = meta.frame;
  const W = fw * meta.cols, H = fh * meta.rows;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), W, H), 0, 0);
  const tex = scene.textures.addCanvas(sheetKey, out);
  if (!tex) throw new Error('addCanvas failed for ' + sheetKey);
  for (let r = 0; r < meta.rows; r++) for (let c = 0; c < meta.cols; c++) tex.add(frameIndex(meta, r, c), 0, c * fw, r * fh, fw, fh);
  createAnims(scene, sheetKey, meta);
}

export const animKey = (sheetKey: string, anim: string, facing: Facing) => `${sheetKey}:${anim}:${facing}`;

/** All animation names the scene may play on a sheet (used to remove them on eviction). */
export function animNames(meta: SheetMeta): string[] {
  return Object.keys(meta.anims).filter((n) => n !== 'sit');
}

function createAnims(scene: Phaser.Scene, sheetKey: string, meta: SheetMeta): void {
  for (const name of animNames(meta)) {
    const a = meta.anims[name];
    const frames = (row: number) => Array.from({ length: a.frames }, (_, c) => ({ key: sheetKey, frame: frameIndex(meta, row, c) }));
    if (a.rows) {
      (Object.keys(FACING_ROW) as Facing[]).forEach((f) => {
        scene.anims.create({ key: animKey(sheetKey, name, f), frames: frames(a.rows![FACING_ROW[f]]), frameRate: a.fps ?? 8, repeat: -1 });
      });
    } else if (a.row !== undefined) {
      scene.anims.create({ key: animKey(sheetKey, name, 'S'), frames: frames(a.row), frameRate: a.fps ?? 8, repeat: a.loop ? -1 : Math.max(0, (a.repeat ?? 1) - 1) });
    }
  }
}

/** Total duration of an emote in ms (all plays plus the hold), or 0 when the sheet has no such animation. */
export function emoteDuration(meta: SheetMeta, name: string): number {
  const a = meta.anims[name];
  if (!a || a.row === undefined || a.loop) return 0;
  return Math.round(((a.frames / (a.fps ?? 8)) * (a.repeat ?? 1)) * 1000) + (a.hold ?? 0);
}

/** Frame index of the single-frame sit pose for a facing. */
export function sitFrame(meta: SheetMeta, facing: Facing): number {
  return frameIndex(meta, meta.anims.sit.rows![FACING_ROW[facing]], 0);
}
