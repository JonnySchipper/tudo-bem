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
import type { ShadowLayer } from './shadowLayer';
import { v5on } from './v5flags';
import { litGrade, type RoofHall } from './roofLights';

/** A light colour pulled toward white by `1 - k`: the multiply tint of an amber pool on the night grade. */
export function warmPool(color: number, k: number): number {
  const ch = (shift: number) => {
    const c = (color >> shift) & 255;
    return Math.round(255 + (c - 255) * k);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

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
  /** V5: world px below the light where its reflection in wet pavement appears (a lamp head mirrored over the ground); unset = no reflection */
  mirror?: number;
  /** only the additive halo, no hole in the grade or the night (a backlit sign inside an already lit hall): three fewer stamps a frame */
  halo?: boolean;
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
  /** night sky over the window panes and its stars (alpha follows the live clock) */
  panes: Phaser.GameObjects.Rectangle[] = [];
  /** cast-shadow sprites (fade out as it gets dark) */
  castShadows: Phaser.GameObjects.Image[] = [];
  /** V5: the directional shadow layer (set by the scene); while it draws, the baked cast shadows above are hidden (`bakedCast` false) */
  shadows: ShadowLayer | null = null;
  bakedCast = true;
  /** night body lift: a faint cool ADD copy of every vehicle sprite so a parked car or van stays a solid shape on dark asphalt (see `liftBody`) */
  private bodyLift: { spr: Phaser.GameObjects.Sprite; img: Phaser.GameObjects.Image }[] = [];
  private grade: Phaser.GameObjects.RenderTexture;
  private fill: Phaser.GameObjects.Rectangle;
  private dark: Phaser.GameObjects.RenderTexture;
  private sun: Phaser.GameObjects.Image;
  private glowSprites: Phaser.GameObjects.Image[] = [];
  /** wet-pavement reflections of the lights that have a `mirror` */
  private reflSprites: Phaser.GameObjects.Image[] = [];
  /** scratch for `apply`: (light, strength, sx, sy, px) per lit light, flat */
  private litScratch: (Light | number)[] = [];
  /** the lit hall of a roofed open-air map (the airport terminal), set by the scene; filled lighter in the grade and the darkness */
  roof: RoofHall | null = null;

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

  /**
   * The roofed hall in fx-camera px, clipped to the screen, with each band's 0..1 lift (`gain` x its bank's switch); null when there is no
   * hall, it is off screen, or no band is lit (by day: the plain full-screen fills, exactly as without a roof).
   */
  private hallOnScreen(look: SceneLook, toScreen: (wx: number, wy: number) => [number, number]): { x0: number; x1: number; tint: number; bands: { y0: number; y1: number; k: number }[] } | null {
    const r = this.roof;
    if (!r || !r.bands.length) return null;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const [ax, ay] = toScreen(r.x0, r.bands[0].y0);
    const [bx, by] = toScreen(r.x1, r.bands[r.bands.length - 1].y1);
    const x0 = Math.max(0, Math.round(ax));
    const x1 = Math.min(W, Math.round(bx));
    if (x1 <= x0 || by <= 0 || ay >= H) return null;
    let any = false;
    const bands: { y0: number; y1: number; k: number }[] = [];
    for (const b of r.bands) {
      const y0 = Math.max(0, Math.round(toScreen(0, b.y0)[1]));
      const y1 = Math.min(H, Math.round(toScreen(0, b.y1)[1]));
      if (y1 <= y0) continue;
      const k = r.gain * look.lampOn(b.delay);
      if (k > 0.001) any = true;
      bands.push({ y0, y1, k });
    }
    return any && bands.length ? { x0, x1, tint: r.tint, bands } : null;
  }

  /**
   * Fill a full-screen render texture in pieces: the hall's bands with their own colour and alpha, everything around them with the base.
   * The pieces tile the screen, so this costs the same fill as one `fill()` (a few more draw calls), not an extra pass.
   */
  private fillSplit(rt: Phaser.GameObjects.RenderTexture, hall: NonNullable<ReturnType<LightingRig['hallOnScreen']>>, base: number, alpha: number, band: (k: number) => [number, number]): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const top = hall.bands[0].y0;
    const bottom = hall.bands[hall.bands.length - 1].y1;
    if (top > 0) rt.fill(base, alpha, 0, 0, W, top);
    if (bottom < H) rt.fill(base, alpha, 0, bottom, W, H - bottom);
    if (hall.x0 > 0) rt.fill(base, alpha, 0, top, hall.x0, bottom - top);
    if (hall.x1 < W) rt.fill(base, alpha, hall.x1, top, W - hall.x1, bottom - top);
    for (const b of hall.bands) {
      const [c, a] = band(b.k);
      if (a > 0.001) rt.fill(c, a, hall.x0, b.y0, hall.x1 - hall.x0, b.y1 - b.y0);
    }
  }

  /** Create glow sprites for lights added since the last call, and drop the surplus. */
  syncLights(): void {
    while (this.glowSprites.length < this.lights.length) {
      this.glowSprites.push(this.screen(this.scene.add.image(0, 0, this.glowKey)).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setAlpha(0));
    }
    while (this.glowSprites.length > this.lights.length) this.glowSprites.pop()?.destroy();
    while (this.reflSprites.length < this.lights.length) {
      this.reflSprites.push(this.screen(this.scene.add.image(0, 0, this.glowKey)).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.1).setAlpha(0).setVisible(false));
    }
    while (this.reflSprites.length > this.lights.length) this.reflSprites.pop()?.destroy();
  }

  /**
   * A cool ADD twin of a vehicle sprite (same frame, flip, depth + a hair): at night it lifts the body a little over the dark road, so cars read solid
   * instead of dissolving into the asphalt. Returns the image so the caller can register it with the room (it removes itself when the sprite is gone).
   */
  liftBody(spr: Phaser.GameObjects.Sprite): Phaser.GameObjects.Image {
    const img = this.scene.add.image(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(spr.originX, spr.originY).setBlendMode(Phaser.BlendModes.ADD).setTint(0xaebcf0).setAlpha(0);
    this.bodyLift.push({ spr, img });
    return img;
  }

  /** Forget every light, overlay and shadow registered by a room (the room is being rebuilt; the objects themselves are destroyed by the caller). */
  clearRoom(): void {
    this.lights = [];
    this.bodyLift = [];
    this.litOverlays = [];
    this.windowRects = [];
    this.castShadows = [];
    this.panes = [];
    this.patches = [];
    this.roof = null;
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
    const now = this.scene.time.now;
    for (const c of this.castShadows) c.setAlpha(this.bakedCast ? look.cast : 0);
    const strengthOf = (l: Light) => {
      if (l.kind === 'player') return look.playerGlow;
      if (l.kind === 'car') return look.glow * (l.live ?? 0);
      return l.delay === undefined ? look.glow : look.lampOn(l.delay);
    };
    const gradeInt = rgbToInt(look.grade);
    const hall = this.hallOnScreen(look, toScreen);
    if (hall) this.fillSplit(this.grade, hall, gradeInt, 1, (k) => [litGrade(gradeInt, hall.tint, k), 1]);
    else this.grade.fill(gradeInt, 1);
    this.fill.setFillStyle(rgbToInt(look.fill.color), look.fill.alpha);
    for (const o of this.litOverlays) {
      const d = o.getData('delay') as number | undefined;
      o.setAlpha(Math.min(1, (d === undefined ? look.glow : look.lampOn(d)) * 0.95));
    }
    for (const o of this.patches) o.setAlpha(look.patchAlpha).setTint(look.patchTint);
    for (const o of this.panes) o.setAlpha(look.windowNight);
    this.bodyLift = this.bodyLift.filter(({ spr, img }) => {
      if (!spr.active || !img.active) {
        if (img.active) img.destroy();
        return false;
      }
      img.setPosition(spr.x, spr.y).setDepth(spr.depth + 0.0005).setFlip(spr.flipX, spr.flipY).setAlpha(Math.min(0.4, dark * 0.45) * spr.alpha).setVisible(spr.visible);
      if (img.frame.name !== spr.frame.name || img.texture.key !== spr.texture.key) img.setTexture(spr.texture.key, spr.frame.name);
      return true;
    });
    this.dark.clear();
    if (dark > 0.001) {
      if (hall) this.fillSplit(this.dark, hall, 0x0b1030, dark, (k) => [0x0b1030, dark * (1 - k)]);
      else this.dark.fill(0x0b1030, dark);
    }
    // Every stamp on a render texture is a capture pass plus a full-screen blit, so the lit lights are collected first and stamped in three batches
    // (grade erase, warm re-tint, darkness erase) instead of three captures per light.
    const lit = this.litScratch;
    lit.length = 0;
    this.lights.forEach((l, i) => {
      const s = strengthOf(l);
      const g = this.glowSprites[i];
      if (!g) return;
      const [sx, sy] = toScreen(l.x, l.y);
      const px = (l.r * 2 * zoom) / 128;
      if (s > 0.001 && !l.halo) lit.push(l, s, sx, sy, px);
      const glowAlpha = l.glow ?? (l.kind === 'window' ? 0.3 : l.kind === 'stall' ? 0.3 : l.kind === 'player' ? 0.22 : l.kind === 'car' ? 0.3 : 0.42);
      g.setPosition(sx, sy).setScale(px, px * l.squash).setTint(l.color).setAlpha(s * glowAlpha);
      // wet pavement mirrors the lamp: a tall, narrow, shimmering streak below the foot of the pole
      const rf = this.reflSprites[i];
      if (rf) {
        const ra = l.mirror && look.wet > 0.05 && v5on('refl') ? s * look.wet * Math.min(1, look.night * 1.6) * 0.5 * (0.82 + 0.18 * Math.sin(now / 260 + i * 2.1)) : 0;
        if (ra > 0.01) {
          const wob = Math.sin(now / 420 + i) * 1.2 * zoom;
          rf.setPosition(sx + wob, sy + (l.mirror ?? 0) * zoom).setScale(px * 0.2, px * 0.85).setTint(l.color).setAlpha(ra).setVisible(true);
        } else if (rf.visible) rf.setVisible(false);
      }
    });
    if (lit.length) {
      const n = lit.length;
      const warmOn = dark > 0.05;
      // erase: the grade is mostly lifted inside the light, the darkness fully
      this.grade.beginDraw();
      for (let k = 0; k < n; k += 5) {
        const l = lit[k] as Light, s = lit[k + 1] as number, px = lit[k + 4] as number;
        this.grade.stamp(this.glowKey, undefined, lit[k + 2] as number, lit[k + 3] as number, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, s * 0.9), skipBatch: true });
      }
      this.grade.endDraw(true);
      // the lifted ground would read as neutral lavender-white next to the additive glow: re-tint it amber (a multiply by a warm colour)
      if (warmOn) {
        this.grade.beginDraw();
        for (let k = 0; k < n; k += 5) {
          const l = lit[k] as Light;
          if (l.kind === 'player') continue;
          const s = lit[k + 1] as number, px = lit[k + 4] as number;
          this.grade.stamp(this.glowKey, undefined, lit[k + 2] as number, lit[k + 3] as number, { scaleX: px * 0.92, scaleY: px * 0.92 * l.squash, alpha: Math.min(1, s * 0.85 * Math.min(1, dark / 0.15)), tint: warmPool(l.color, 0.9), skipBatch: true });
        }
        this.grade.endDraw(false);
      }
      if (dark > 0.001) {
        this.dark.beginDraw();
        for (let k = 0; k < n; k += 5) {
          const l = lit[k] as Light, s = lit[k + 1] as number, px = lit[k + 4] as number;
          this.dark.stamp(this.glowKey, undefined, lit[k + 2] as number, lit[k + 3] as number, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, s * 1.05), skipBatch: true });
        }
        this.dark.endDraw(true);
      }
    }
    for (const r of this.windowRects) r.setAlpha(look.glow * 0.6);
    // low sun: a big warm glow from the upper left (adds warmth and shows the light direction without darkening the scene)
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    this.sun.setPosition(sw * look.sunX, -sh * 0.1).setScale((Math.max(sw, sh) * 2.1) / 128).setAlpha(look.sun).setTint(look.sunTint);
  }
}
