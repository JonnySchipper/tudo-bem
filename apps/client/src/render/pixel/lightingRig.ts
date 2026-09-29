/**
 * The two-camera lighting rig (docs/lifesim/DECISIONS.md, Phase 1 decisions 13-15), shared by the game's WorldScene and the style frame.
 *
 * `main` (integer device zoom) draws the world; `fx` (zoom 1, screen space) draws the grade, the cool shadow fill, the night darkness and
 * the additive glow, so light stays smooth at screen resolution while the sprites stay crisp. World objects are hidden from `fx` with
 * `world(o)`, screen-space objects from `main` with `screen(o)`.
 *
 * The grade is a MULTIPLY render texture that light sources punch holes in, so lamp pools and lit windows are not tinted by it.
 */
import Phaser from 'phaser';
import { rgbToInt } from './lighting';
import { hourLook, type SceneLook } from './dayNight';

export interface Light {
  x: number; // world px
  y: number;
  r: number; // world px radius
  color: number;
  /** vertical squash of the glow (1 = round halo, <1 = pool on the ground) */
  squash: number;
  kind: 'lamp' | 'window' | 'player' | 'stall' | 'car';
  /** 0..1 multiplier set per frame for dynamic lights */
  live?: number;
  /** additive glow alpha override */
  glow?: number;
  /** game minutes this light lags the 18:00 / 06:00 switch (`dayNight.lightDelay`); unset = follows the general glow */
  delay?: number;
}

export class LightingRig {
  readonly fxCam: Phaser.Cameras.Scene2D.Camera;
  /** every light source; edit in place and call `syncLights()` after adding or removing */
  lights: Light[] = [];
  /** authored lit-window overlays (fade in with the night) */
  litOverlays: Phaser.GameObjects.Image[] = [];
  /** generated window glow rectangles for facades without a lit overlay */
  windowRects: Phaser.GameObjects.Rectangle[] = [];
  /** window light patches on interior floors (world sprites, ADD blend): full strength by day, gone at night */
  patches: Phaser.GameObjects.Image[] = [];
  /** cast-shadow sprites (fade out as it gets dark) */
  castShadows: Phaser.GameObjects.Image[] = [];
  private grade: Phaser.GameObjects.RenderTexture;
  private fill: Phaser.GameObjects.Rectangle;
  private dark: Phaser.GameObjects.RenderTexture;
  private sun: Phaser.GameObjects.Image;
  private glowSprites: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly main: Phaser.Cameras.Scene2D.Camera,
    /** texture key of the soft radial glow */
    private readonly glowKey: string,
  ) {
    const w = scene.scale.width;
    const h = scene.scale.height;
    this.fxCam = scene.cameras.add(0, 0, w, h, false, 'fx');
    this.fxCam.setRoundPixels(false);
    this.grade = this.screen(scene.add.renderTexture(0, 0, w, h)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(1);
    // cool blue fill in the shadows (SCREEN lifts darks more than lights): keeps golden hour from being a flat orange wash
    this.fill = this.screen(scene.add.rectangle(0, 0, w, h, 0x3454a8, 0)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(1.5);
    this.dark = this.screen(scene.add.renderTexture(0, 0, w, h)).setOrigin(0, 0).setDepth(2);
    this.sun = this.screen(scene.add.image(0, 0, glowKey)).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.5).setTint(0xffb867).setAlpha(0);
  }

  /** Register a world-space object: only the main camera draws it. */
  world<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.fxCam.ignore(o);
    return o;
  }

  /** Register a screen-space object: only the fx camera draws it. */
  screen<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.main.ignore(o);
    return o;
  }

  /** Create glow sprites for lights added since the last call, and drop the surplus. */
  syncLights(): void {
    while (this.glowSprites.length < this.lights.length) {
      this.glowSprites.push(this.screen(this.scene.add.image(0, 0, this.glowKey)).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setAlpha(0));
    }
    while (this.glowSprites.length > this.lights.length) this.glowSprites.pop()?.destroy();
  }

  /** Forget every light, overlay and shadow registered by a room (the room is being rebuilt; the objects themselves are destroyed by the caller). */
  clearRoom(): void {
    this.lights = [];
    this.litOverlays = [];
    this.windowRects = [];
    this.castShadows = [];
    this.patches = [];
    this.syncLights();
  }

  resize(w: number, h: number): void {
    this.fxCam.setSize(w, h);
    this.grade.resize(w, h);
    this.dark.resize(w, h);
    this.fill.setSize(w, h);
  }

  /**
   * Redraw the grade, fill, darkness and glows. `look` comes from `dayNight.computeLook` (the live clock and the weather), or is a plain game
   * hour (the style frame's slider). `toScreen` maps world px to fx-camera (device) px.
   */
  apply(lookOrHour: SceneLook | number, zoom: number, toScreen: (wx: number, wy: number) => [number, number]): void {
    const look = typeof lookOrHour === 'number' ? hourLook(lookOrHour) : lookOrHour;
    const dark = look.dark;
    for (const c of this.castShadows) c.setAlpha(look.cast);
    const strengthOf = (l: Light) => {
      if (l.kind === 'player') return look.playerGlow;
      if (l.kind === 'car') return look.glow * (l.live ?? 0);
      return l.delay === undefined ? look.glow : look.lampOn(l.delay);
    };
    this.grade.fill(rgbToInt(look.grade), 1);
    this.fill.setFillStyle(rgbToInt(look.fill.color), look.fill.alpha);
    for (const o of this.litOverlays) {
      const d = o.getData('delay') as number | undefined;
      o.setAlpha(Math.min(1, (d === undefined ? look.glow : look.lampOn(d)) * 0.95));
    }
    for (const o of this.patches) o.setAlpha(look.patchAlpha).setTint(look.patchTint);
    this.dark.clear();
    if (dark > 0.001) this.dark.fill(0x0b1030, dark);
    this.lights.forEach((l, i) => {
      const s = strengthOf(l);
      const g = this.glowSprites[i];
      if (!g) return;
      const [sx, sy] = toScreen(l.x, l.y);
      const px = (l.r * 2 * zoom) / 128;
      if (s > 0.001) {
        // erase: the grade is mostly lifted inside the light, the darkness fully
        this.grade.stamp(this.glowKey, undefined, sx, sy, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, s * 0.9), erase: true });
        if (dark > 0.001) this.dark.stamp(this.glowKey, undefined, sx, sy, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, s * 1.05), erase: true });
      }
      const glowAlpha = l.glow ?? (l.kind === 'window' ? 0.3 : l.kind === 'stall' ? 0.3 : l.kind === 'player' ? 0.22 : l.kind === 'car' ? 0.3 : 0.42);
      g.setPosition(sx, sy).setScale(px, px * l.squash).setTint(l.color).setAlpha(s * glowAlpha);
    });
    for (const r of this.windowRects) r.setAlpha(look.glow * 0.6);
    // low sun: a big warm glow from the upper left (adds warmth and shows the light direction without darkening the scene)
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    this.sun.setPosition(sw * 0.12, -sh * 0.08).setScale((Math.max(sw, sh) * 2.1) / 128).setAlpha(look.sun);
  }
}
