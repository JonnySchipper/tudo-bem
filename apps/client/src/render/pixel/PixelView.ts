/**
 * PixelView: the top-down pixel renderer behind `?view=pixel` (HOWTO §5.1, §6 Phase 2). Implements `WorldView` on the existing
 * `<canvas id="world">` with Phaser as a view only (D3): Phaser input is fully disabled, so main.ts keeps owning input, networking and
 * state. `frame(now)` does nothing; Phaser runs its own loop and `WorldScene.update()` reads `game` every frame.
 */
import Phaser from 'phaser';
import { positionAlong, type PathPos, type Tile } from '@tudobem/shared';
import type { ClientAvatar } from '../../state';
import type { Guide, Hit, WorldView } from '../view';
import { sharedCharAssets } from './charAssets';
import { WorldScene } from './WorldScene';
import { LabelLayer } from './labels';
import { bufferPixels, canvasToWorld, tileAtWorld, tileCenterToCanvas, type Insets } from './coords';
import { game } from '../../state';

export class PixelView implements WorldView {
  /** `scale` is CSS px per art px (HOWTO §5.4); e2e's clickTile multiplies by it. */
  readonly cam = { scale: 4 };
  guides: Guide[] = [];
  /** sprite keys the scene asked for that the manifest lacks (HOWTO §5.10) */
  artMissing: string[] = [];
  private scene: WorldScene | null = null;
  private phaser: Phaser.Game | null = null;
  private labels: LabelLayer;
  private dpr = 1;
  private insetsCss: Insets = { top: 64, bottom: 110, left: 0, right: 0 };

  constructor(readonly canvas: HTMLCanvasElement) {
    this.labels = new LabelLayer(canvas);
    this.measure();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  private started = false;

  /** Boots Phaser. main.ts calls this once the intro has closed: starting WebGL under the title screen's blur crashed some GPUs (#48). */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.boot().catch((e) => {
      this.started = false;
      console.error('[pixel] boot failed', e);
    });
  }

  private async boot(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}pixel/`;
    const assets = await sharedCharAssets();
    const manifest = assets.manifest;
    this.labels.setArt({ base, images: manifest.images ?? {} });
    const q = new URLSearchParams(location.search);
    const buf = bufferPixels(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    this.dpr = buf.dpr;
    const scene = new WorldScene(manifest, base, assets, {
      labels: this.labels,
      guides: () => this.guides,
      insets: () => this.insetsCss,
      lowfx: q.get('lowfx') === '1',
      debugArt: q.get('debug') === 'art',
    });
    this.artMissing = scene.artMissing;
    this.phaser = new Phaser.Game({
      type: Phaser.WEBGL, // an explicit renderer is required when a canvas is passed in
      canvas: this.canvas,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: '#1d1b26',
      banner: false,
      audio: { noAudio: true }, // the game has its own audio; don't let Phaser touch AudioContext
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE, width: buf.width, height: buf.height, zoom: 1 / buf.dpr },
      scene: [scene],
    });
    this.scene = scene;
  }

  /** HUD space to keep clear of the avatar (same numbers as the iso renderer). */
  private measure(): void {
    const narrow = window.innerWidth < 700;
    const cs = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
    const safeBot = parseFloat(cs.getPropertyValue('--safe-bottom')) || 0;
    this.insetsCss = { top: (narrow ? 124 : 64) + safeTop, bottom: (narrow ? 168 : 110) + safeBot, left: 0, right: 0 };
  }

  resize(): void {
    this.measure();
    const g = this.phaser;
    if (!g) return;
    const { dpr, width: w, height: h } = bufferPixels(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      g.scale.setZoom(1 / dpr);
    }
    if (g.scale.width !== w || g.scale.height !== h) g.scale.resize(w, h);
  }

  /** Phaser runs its own loop; nothing to do per main-loop frame except keep the zoom the e2e helper reads current. */
  frame(_now: number): void {
    if (this.scene) this.cam.scale = this.scene.cssScale;
  }

  avatarPos(a: ClientAvatar, now: number): PathPos {
    return positionAlong(a.from, a.path, now - a.start, a.pub.dir);
  }

  private rect(): DOMRect {
    return this.canvas.getBoundingClientRect();
  }

  tileToClient(x: number, y: number): { px: number; py: number } {
    const r = this.rect();
    if (!this.scene) return { px: r.left + r.width / 2, py: r.top + r.height / 2 };
    const p = tileCenterToCanvas(this.scene.cam, x, y);
    return { px: r.left + p.px, py: r.top + p.py };
  }

  private worldAt(px: number, py: number): { wx: number; wy: number } | null {
    if (!this.scene) return null;
    const r = this.rect();
    return canvasToWorld(this.scene.cam, px - r.left, py - r.top);
  }

  hitTest(px: number, py: number): Hit | null {
    const room = game.roomDef;
    const w = this.worldAt(px, py);
    if (!room || !w || !this.scene) return null;
    const hit = this.scene.hitAt(w.wx, w.wy);
    if (hit) return hit;
    const tile = tileAtWorld(w.wx, w.wy, room.cols, room.rows);
    if (!tile) return null;
    const portal = room.portals.find((p) => p.x === tile.x && p.y === tile.y);
    if (portal && !game.placing) return { kind: 'portal', portal };
    return { kind: 'tile', tile };
  }

  tileAt(px: number, py: number): Tile | null {
    const room = game.roomDef;
    const w = this.worldAt(px, py);
    if (!room || !w) return null;
    return tileAtWorld(w.wx, w.wy, room.cols, room.rows);
  }

  /** Frame-time probe and fx level (`window.__tb.perf`). */
  perf() {
    return this.scene?.perfInfo() ?? null;
  }

  /** For debugging and the shots script. */
  info() {
    return this.scene?.info() ?? null;
  }
}
