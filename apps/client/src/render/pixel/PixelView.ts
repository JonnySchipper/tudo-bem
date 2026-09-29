/**
 * Phaser world view. Implements the same WorldView the isometric renderer does.
 * The game boots this only for `?view=pixel`. The style-frame page is untouched.
 */
import Phaser from 'phaser';
import { positionAlong, type Tile } from '@tudobem/shared';
import type { ClientAvatar } from '../../state';
import type { Guide, Hit, WorldView } from '../view';
import { loadManifest } from './manifest';
import { WorldScene } from './WorldScene';

export class PixelView implements WorldView {
  readonly cam = { scale: 3 };
  guides: Guide[] = [];
  private scene: WorldScene;
  private phaser: Phaser.Game | null = null;
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.scene = new WorldScene(() => this.guides);
    this.scene.dpr = this.dpr;
    window.addEventListener('resize', () => this.resize());
    void this.boot();
  }

  private async boot(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}pixel/`;
    const manifest = await loadManifest(base);
    this.scene.manifest = manifest;
    this.scene.base = base;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round((rect.width || window.innerWidth) * this.dpr));
    const h = Math.max(1, Math.round((rect.height || window.innerHeight) * this.dpr));
    this.phaser = new Phaser.Game({
      type: Phaser.WEBGL,
      canvas: this.canvas,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#1d1b26',
      banner: false,
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / this.dpr },
      scene: this.scene,
    });
  }

  resize(): void {
    if (!this.phaser) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round((rect.width || window.innerWidth) * this.dpr));
    const h = Math.max(1, Math.round((rect.height || window.innerHeight) * this.dpr));
    this.phaser.scale.resize(w, h);
    this.cam.scale = this.scene.cssZoom;
  }

  frame(now: number): void {
    this.scene.setNow(now);
    this.cam.scale = this.scene.cssZoom;
  }

  avatarPos(a: ClientAvatar, now: number) {
    return positionAlong(a.from, a.path, now - a.start, a.pub.dir);
  }

  tileToClient(x: number, y: number): { px: number; py: number } {
    return this.scene.tileToClient(x, y);
  }

  hitTest(px: number, py: number): Hit | null {
    return this.phaser ? this.scene.hitTest(px, py) : null;
  }

  tileAt(px: number, py: number): Tile | null {
    return this.phaser ? this.scene.tileAt(px, py) : null;
  }
}
