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
import type { TapCue } from './tapMark';
import { HUD_COMPACT_QUERY, T, bufferPixels, canvasToWorld, hudInsets, tileAtWorld, tileCenterToCanvas, worldToCanvas, type Insets } from './coords';
import { game } from '../../state';
import { uiScale } from '../../ui/hudLayout';

export class PixelView implements WorldView {
  /** `scale` is CSS px per art px (HOWTO §5.4); e2e's clickTile multiplies by it. */
  readonly cam = { scale: 4 };
  guides: Guide[] = [];
  /** sprite keys the scene asked for that the manifest lacks (HOWTO §5.10) */
  artMissing: string[] = [];
  private scene: WorldScene | null = null;
  private phaser: Phaser.Game | null = null;
  private host: { shot?: string | null } | null = null;
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
    const host = {
      labels: this.labels,
      guides: () => this.guides,
      insets: () => this.insetsCss,
      lowfx: q.get('lowfx') === '1',
      debugArt: q.get('debug') === 'art',
      shot: q.get('shot'),
    };
    this.host = host;
    const scene = new WorldScene(manifest, base, assets, host);
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
      // The shutter copies this canvas. WebGL clears the buffer after each frame unless we keep it.
      render: { preserveDrawingBuffer: true },
      scale: { mode: Phaser.Scale.NONE, width: buf.width, height: buf.height, zoom: 1 / buf.dpr },
      scene: [scene],
    });
    this.scene = scene;
    this.watchContext();
  }

  /**
   * A lost WebGL context leaves a blank canvas (the GPU reclaimed it, or a driver reset). It should not happen, but never fail silently: say so
   * and offer a reload instead of a dark world with only the labels on it.
   */
  private watchContext(): void {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.error('[pixel] WebGL context lost');
      showWorldLost();
    });
    // an exception inside Phaser's render stops its loop for good (a frozen, blank world): a watchdog sees the frame counter stand still
    let last = -1;
    let still = 0;
    window.setInterval(() => {
      const g = this.phaser;
      if (!g || document.hidden || !game.room) {
        still = 0;
        return;
      }
      const f = g.loop.frame;
      still = f === last ? still + 1 : 0;
      last = f;
      if (still >= 3) {
        console.error('[pixel] render loop stopped');
        showWorldLost();
      }
    }, 2000);
  }

  /** HUD space to keep clear of the avatar, following the HUD's own compact media query (coords.hudInsets). */
  private measure(): void {
    const compact = window.matchMedia(HUD_COMPACT_QUERY).matches;
    const cs = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
    const safeBot = parseFloat(cs.getPropertyValue('--safe-bottom')) || 0;
    if (compact) {
      this.insetsCss = hudInsets(window.innerWidth, window.innerHeight, compact, safeTop, safeBot);
    } else {
      // the HUD is drawn at the desktop UI scale (hudLayout.uiScale), so the room it takes grows with it
      const k = uiScale();
      this.insetsCss = { top: 64 * k + safeTop, bottom: 110 * k + safeBot, left: 0, right: 0 };
    }
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

  /** Screen rect of a prop's tile footprint, in client px. */
  propClientRect(prop: { x: number; y: number; w?: number; h?: number }): { x: number; y: number; w: number; h: number } | null {
    if (!this.scene) return null;
    const r = this.rect();
    const a = worldToCanvas(this.scene.cam, prop.x * T, prop.y * T);
    const b = worldToCanvas(this.scene.cam, (prop.x + (prop.w ?? 1)) * T, (prop.y + (prop.h ?? 1)) * T);
    return { x: r.left + a.px, y: r.top + a.py, w: b.px - a.px, h: b.py - a.py };
  }

  tileToClient(x: number, y: number): { px: number; py: number } {
    const r = this.rect();
    if (!this.scene) return { px: r.left + r.width / 2, py: r.top + r.height / 2 };
    const p = tileCenterToCanvas(this.scene.cam, x, y);
    return { px: r.left + p.px, py: r.top + p.py };
  }

  clientToWorld(px: number, py: number): { wx: number; wy: number } | null {
    return this.worldAt(px, py);
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

  markTap(kind: TapCue, at: { tile: Tile } | { px: number; py: number }): void {
    if (!this.scene) return;
    if ('tile' in at) return this.scene.markTap(kind, at);
    const w = this.worldAt(at.px, at.py);
    if (w) this.scene.markTap(kind, w);
  }

  setDialogueFocus(f: { npc: Tile | null } | null): void {
    this.scene?.setDialogue(f);
  }

  setDialogueBox(px: number): void {
    this.scene?.setDialogueBox(px);
  }

  /** Ambient life hook (`window.__tb.ambient`). */
  ambientHook() {
    return this.scene?.ambientHook() ?? null;
  }

  /** Facing hook (`window.__tb.facings`). */
  facingsHook() {
    return this.scene?.facingsHook() ?? null;
  }

  /** Texture bookkeeping for the soak script (`window.__tb.renderer.textureInfo()`): how many textures Phaser holds, and the shadow atlas. */
  textureInfo() {
    const g = this.phaser;
    if (!g) return null;
    const list = g.textures.list as Record<string, Phaser.Textures.Texture>;
    const gl = (g.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    return {
      count: Object.keys(list).length,
      shadowAtlas: list['shadowAtlas'] ? `${list['shadowAtlas'].source[0].width}x${list['shadowAtlas'].source[0].height}` : null,
      maxTextureSize: gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : null,
      lost: gl ? gl.isContextLost() : null,
    };
  }

  /** Frame-time probe and fx level (`window.__tb.perf`). */
  perf() {
    return this.scene?.perfInfo() ?? null;
  }

  /** Debug: 'map' zooms the outdoor map out to fit (same as ?shot=map), null goes back to following the avatar. */
  setShot(mode: string | null): void {
    if (this.host) this.host.shot = mode;
  }

  /** For debugging and the shots script. */
  info() {
    return this.scene?.info() ?? null;
  }

  /** Frame names drawn in the current room (`window.__tb.drawnFrames`). */
  drawnFrames(): string[] {
    return this.scene?.drawnFrames() ?? [];
  }
}

/** The "recarregar" overlay shown when the world can no longer draw (lost WebGL context, stopped render loop): never a silent blank world. */
export function showWorldLost(): void {
  {
      if (document.getElementById('gl-lost')) return;
      const box = document.createElement('div');
      box.id = 'gl-lost';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#1d1b26;color:#f5e6d3;font:600 18px/1.4 system-ui,sans-serif;text-align:center;padding:24px';
      const t = document.createElement('div');
      t.textContent = 'A imagem do mundo parou. Recarregue a página para voltar à praça.';
      const en = document.createElement('div');
      en.style.cssText = 'font-size:14px;opacity:.7;font-weight:500';
      en.textContent = 'The world view stopped. Reload the page to get back to the praça.';
      const b = document.createElement('button');
      b.id = 'gl-lost-reload';
      b.textContent = 'Recarregar';
      b.style.cssText = 'padding:10px 22px;border:0;border-radius:6px;background:#d4a017;color:#2a2233;font:700 16px system-ui,sans-serif;cursor:pointer';
      b.onclick = () => location.reload();
      box.append(t, en, b);
      document.body.append(box);
  }
}
