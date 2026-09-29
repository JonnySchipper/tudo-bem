/**
 * Phaser world view. Implements the same WorldView the isometric renderer does.
 * The game boots this only for `?view=pixel`. The style-frame page is untouched.
 */
import Phaser from 'phaser';
import { positionAlong, type Tile } from '@tudobem/shared';
import type { ClientAvatar } from '../../state';
import type { Guide, Hit, WorldView } from '../view';
import { bufferPixels } from './coords';
import { loadManifest } from './manifest';
import { WorldScene } from './WorldScene';

export class PixelView implements WorldView {
  readonly cam = { scale: 3 };
  guides: Guide[] = [];
  readonly ready: Promise<void>;
  private scene: WorldScene;
  private phaser: Phaser.Game | null = null;
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.scene = new WorldScene(() => this.guides);
    window.addEventListener('resize', () => this.resize());
    this.ready = this.boot();
  }

  private cssBox(): { width: number; height: number } {
    return {
      width: this.canvas.clientWidth || window.innerWidth,
      height: this.canvas.clientHeight || window.innerHeight,
    };
  }

  private async boot(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}pixel/`;
    const manifest = await loadManifest(base);
    this.scene.manifest = manifest;
    this.scene.base = base;
    try {
      this.mount(Phaser.WEBGL);
    } catch (e) {
      console.error('[TB] webgl failed, using canvas', e);
      this.mount(Phaser.CANVAS);
    }
  }

  private mount(type: number): void {
    const box = this.cssBox();
    const buf = bufferPixels(box.width, box.height, window.devicePixelRatio || 1);
    this.dpr = buf.dpr;
    this.scene.dpr = buf.dpr;
    this.phaser = new Phaser.Game({
      type,
      canvas: this.canvas,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#1d1b26',
      banner: false,
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE, width: buf.width, height: buf.height, zoom: 1 / buf.dpr },
      scene: this.scene,
    });
  }

  resize(): void {
    if (!this.phaser) return;
    const box = this.cssBox();
    const buf = bufferPixels(box.width, box.height, window.devicePixelRatio || 1);
    this.dpr = buf.dpr;
    this.scene.dpr = buf.dpr;
    this.phaser.scale.resize(buf.width, buf.height);
    this.phaser.scale.setZoom(1 / buf.dpr);
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
