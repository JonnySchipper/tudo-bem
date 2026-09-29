/** Small helpers for drawing manifest sprites with Phaser, shared by the game's WorldScene and the style frame. */
import type Phaser from 'phaser';
import type { SpriteDef } from './manifest';

/** Phaser origin for a sprite: its `ax`/`ay` anchor as a fraction of the frame (may lie outside [0, 1] for overhead parts). */
export const originOf = (d: SpriteDef): [number, number] => [d.ax / d.w, d.ay / d.h];

/** Create (once) the looping animation of a sprite that has `anim` frames; returns its key. */
export function ensureAnim(scene: Phaser.Scene, key: string, d: SpriteDef): string {
  const ak = 'anim:' + key;
  if (d.anim && !scene.anims.exists(ak)) scene.anims.create({ key: ak, frames: d.anim.frames.map((f) => ({ key: d.atlas, frame: f })), frameRate: d.anim.fps, repeat: -1 });
  return ak;
}
