/**
 * Directional cast shadows (V5): the Phaser side of `shadows.ts`.
 *
 * Every standing sprite (props, buildings, canopies, characters, vehicles, the dog) gets a shadow that is its own silhouette, flipped over the
 * ground line and sheared by the sun (`shadowLook`). The silhouette is generated once per sprite frame from the sprite's alpha (`silhouette.ts`),
 * packed into ONE canvas texture (so the whole layer is one bound texture), and drawn by a sprite inside a Container whose rotation/scale and the
 * sprite's own rotation compose to the shear (`shearTransform`): the GPU does the shear, so the shadow slides smoothly with the clock and
 * nothing is regenerated when the sun moves. Drawn with MULTIPLY (the ground keeps its colour and texture and only loses light) under everything
 * that stands, in the main (world) camera at the same integer zoom as the art.
 */
import Phaser from 'phaser';
import type { SpriteDef } from './manifest';
import { DEPTH } from './props';
import { ShelfPacker, buildSilhouette, type Silhouette } from './silhouette';
import { castPreset, casterShear, shearTransform, type CastPreset, type ShadowLook } from './shadows';

const ATLAS_KEY = 'shadowAtlas';
const ATLAS_SIZE = 1024;

interface Ref {
  frame: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/** What a caster needs to find its silhouette again after the atlas was reset. */
interface Source {
  tex: string;
  frame: string | number;
  /** foot position inside the (untrimmed) source frame */
  ax: number;
  ay: number;
  preset: CastPreset;
}

interface Caster {
  box: Phaser.GameObjects.Container;
  spr: Phaser.GameObjects.Sprite;
  src: Source;
  /** tallest point above the foot, art px (caps the shadow's reach) */
  height: number;
  /** a sprite this shadow follows each frame (characters, vehicles, the dog), or null for a static prop */
  follow: Phaser.GameObjects.Sprite | null;
  /** fixed source frame for a follower (a character keeps one silhouette whatever it animates), or null = the live frame */
  fixedFrame: string | number | null;
  /** extra length multiplier set by the owner (a sitting avatar casts a shorter shadow) */
  hScale: number;
  /** the owner can hide the shadow (the folded feira stalls) */
  ownerVisible: boolean;
  epoch: number;
  sig: string;
  key: string;
}

/** The handle a scene keeps for a static shadow: lets a stall that is folded away hide its shadow too. */
export class ShadowHandle {
  constructor(private readonly c: Caster | null) {}
  setVisible(v: boolean): this {
    if (this.c) this.c.ownerVisible = v;
    return this;
  }
}

export class ShadowLayer {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private packer = new ShelfPacker(ATLAS_SIZE, ATLAS_SIZE);
  private cache = new Map<string, Ref | null>();
  private epoch = 0;
  private dirty = false;
  private statics: Caster[] = [];
  private followers: Caster[] = [];
  private lastLook = '';
  private scratch: HTMLCanvasElement | null = null;
  /** stats for the shots and the perf notes */
  generated = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: { world<G extends Phaser.GameObjects.GameObject>(o: G): G },
  ) {
    this.makeAtlas();
  }

  private makeAtlas(): void {
    const t = this.scene.textures;
    if (t.exists(ATLAS_KEY)) t.remove(ATLAS_KEY);
    const ct = t.createCanvas(ATLAS_KEY, ATLAS_SIZE, ATLAS_SIZE);
    if (!ct) throw new Error('shadow atlas');
    // shadows are soft: bilinear, unlike the art
    ct.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.tex = ct;
    this.canvas = ct.getCanvas();
    this.ctx = ct.getContext();
    this.packer.reset();
    this.cache.clear();
    this.epoch++;
    this.dirty = true;
  }

  // ------------------------------------------------------------------ silhouettes
  /** Reads one frame's alpha as RGBA (untrimmed: the frame's own offset is applied). */
  private readFrame(tex: string, frame: string | number): { w: number; h: number; data: Uint8ClampedArray } | null {
    const t = this.scene.textures.get(tex);
    if (!t || t.key === '__MISSING') return null;
    const f = t.get(frame);
    if (!f || f.name === '__BASE' && frame !== '__BASE') return null;
    const src = f.source.image as CanvasImageSource | undefined;
    if (!src) return null;
    const w = f.realWidth;
    const h = f.realHeight;
    this.scratch ??= document.createElement('canvas');
    const c = this.scratch;
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.clearRect(0, 0, w, h);
    g.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, f.x, f.y, f.cutWidth, f.cutHeight);
    return { w, h, data: g.getImageData(0, 0, w, h).data };
  }

  /** The silhouette of a source frame in the atlas (generated and packed on first use); null when the source is not readable or the atlas is full. */
  private silhouette(s: Source): Ref | null {
    const k = `${s.tex}|${s.frame}|${s.ax},${s.ay}|${s.preset.blur}`;
    const hit = this.cache.get(k);
    if (hit !== undefined) return hit;
    const px = this.readFrame(s.tex, s.frame);
    if (!px) return null;
    const sil: Silhouette = buildSilhouette(px, s.ax, s.ay, { blur: s.preset.blur });
    let at = this.packer.alloc(sil.w, sil.h);
    if (!at) {
      // full: start over (every caster re-resolves on its next update; rare, a room needs a fraction of the atlas)
      this.makeAtlas();
      at = this.packer.alloc(sil.w, sil.h);
      if (!at) return null;
    }
    const id = new ImageData(new Uint8ClampedArray(sil.data), sil.w, sil.h);
    this.ctx.putImageData(id, at.x, at.y);
    const name = `s${this.cache.size}_${at.x}_${at.y}`;
    this.tex!.add(name, 0, at.x, at.y, sil.w, sil.h);
    const ref: Ref = { frame: name, w: sil.w, h: sil.h, ax: sil.ax, ay: sil.ay };
    this.cache.set(k, ref);
    this.dirty = true;
    this.generated++;
    return ref;
  }

  // ------------------------------------------------------------------ casters
  private make(src: Source, height: number, wx: number, wy: number, key: string): Caster {
    const spr = this.scene.make.sprite({ x: 0, y: 0, key: ATLAS_KEY, add: false }, false).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    const box = this.rig.world(this.scene.add.container(wx, wy, [spr])).setDepth(DEPTH.shadowCast).setVisible(false);
    return { box, spr, src, height, follow: null, fixedFrame: null, hScale: 1, ownerVisible: true, epoch: -1, sig: '', key };
  }

  /** A shadow for a static sprite standing at world px (wx, wy) (its anchor). `null` handle semantics: a sprite that does not cast returns a no-op handle. */
  addStatic(key: string, d: SpriteDef, wx: number, wy: number): ShadowHandle {
    const preset = castPreset(key, d);
    if (!preset.cast) return new ShadowHandle(null);
    const c = this.make({ tex: d.atlas, frame: d.frame, ax: d.ax, ay: d.ay, preset }, Math.max(1, Math.min(d.h, d.ay)), Math.round(wx), Math.round(wy), key);
    this.statics.push(c);
    return new ShadowHandle(c);
  }

  /**
   * A shadow that follows a live sprite (a character, a vehicle, the dog): it copies the sprite's position, depth and flip every frame. A
   * character keeps one silhouette (`frame`) whatever it animates; a vehicle follows its own frame.
   */
  follow(src: Phaser.GameObjects.Sprite, key: string, opts: { frame?: string | number; hScale?: number } = {}): void {
    const preset = castPreset(key);
    if (!preset.cast) return;
    const f = src.frame;
    const ax = f.realWidth * src.originX;
    const ay = f.realHeight * src.originY;
    const c = this.make({ tex: src.texture.key, frame: opts.frame ?? f.name, ax, ay, preset }, Math.max(1, Math.min(f.realHeight, ay)), src.x, src.y, key);
    c.follow = src;
    c.fixedFrame = opts.frame ?? null;
    c.hScale = opts.hScale ?? 1;
    this.followers.push(c);
  }

  /** Change the length multiplier of the shadow that follows `src` (a sitting avatar casts a shorter one). */
  setFollowScale(src: Phaser.GameObjects.Sprite, hScale: number): void {
    const c = this.followers.find((q) => q.follow === src);
    if (c && c.hScale !== hScale) {
      c.hScale = hScale;
      c.sig = '';
    }
  }

  /** Drop the shadows of a room (statics). Followers belong to avatars and vehicles and end with their sprite. */
  clearRoom(): void {
    for (const c of this.statics) c.box.destroy();
    this.statics = [];
  }

  get count(): number {
    return this.statics.length + this.followers.length;
  }

  // ------------------------------------------------------------------ frame
  /**
   * Re-aim every shadow at the sun. `enabled` is false in interiors (their own baked shadows are used), under low-fx and at night; `alphaMul`
   * is the strength (0..1), `look` the sun.
   */
  update(look: ShadowLook, enabled: boolean, alphaMul: number): void {
    const on = enabled && look.alpha * alphaMul > 0.01;
    // followers whose sprite died
    for (let i = this.followers.length - 1; i >= 0; i--) {
      const c = this.followers[i];
      if (c.follow && !c.follow.active) {
        c.box.destroy();
        this.followers.splice(i, 1);
      }
    }
    if (!on) {
      for (const c of this.statics) if (c.box.visible) c.box.setVisible(false);
      for (const c of this.followers) if (c.box.visible) c.box.setVisible(false);
      this.flush();
      return;
    }
    const lookSig = `${look.lx.toFixed(3)},${look.ly.toFixed(3)},${look.tint},${(look.alpha * alphaMul).toFixed(3)}`;
    const lookChanged = lookSig !== this.lastLook;
    this.lastLook = lookSig;
    for (const c of this.statics) this.aim(c, look, alphaMul, lookChanged);
    for (const c of this.followers) {
      const s = c.follow!;
      c.box.setPosition(s.x, s.y).setDepth(DEPTH.shadowCast);
      if (!s.visible || s.alpha < 0.05) {
        c.box.setVisible(false);
        continue;
      }
      c.spr.setFlipX(s.flipX);
      this.aim(c, look, alphaMul, lookChanged);
    }
    this.flush();
  }

  private aim(c: Caster, look: ShadowLook, alphaMul: number, lookChanged: boolean): void {
    // find (or refresh) the silhouette: a follower's live frame can change, the atlas can have been reset
    let frame = c.src.frame;
    if (c.follow) {
      frame = c.fixedFrame ?? c.follow.frame.name;
      c.src.tex = c.follow.texture.key;
    }
    const want = `${c.src.tex}|${frame}`;
    if (c.epoch !== this.epoch || c.key !== want) {
      c.key = want;
      c.src.frame = frame;
      const ref = this.silhouette(c.src);
      c.epoch = this.epoch;
      c.sig = '';
      if (!ref) {
        c.box.setVisible(false);
        c.epoch = -1;
        return;
      }
      c.spr.setFrame(ref.frame).setOrigin(ref.ax / ref.w, ref.ay / ref.h);
    }
    if (c.epoch !== this.epoch) return;
    const vis = c.ownerVisible;
    if (c.box.visible !== vis) c.box.setVisible(vis);
    c.spr.setVisible(vis);
    if (!vis) return;
    const sig = `${c.hScale}`;
    if (lookChanged || c.sig !== sig) {
      c.sig = sig;
      const sh = casterShear(look, { hScale: c.src.preset.hScale * c.hScale, capPx: c.src.preset.capPx }, c.height);
      const t = shearTransform(sh.lx, sh.ly);
      c.box.setRotation(t.rotation).setScale(t.scaleX, t.scaleY);
      c.spr.setRotation(t.childRotation);
      c.spr.setTint(look.tint).setAlpha(Math.min(1, look.alpha * alphaMul * c.src.preset.alpha));
    }
  }

  /** Upload the atlas once per frame, and only if a silhouette was added. */
  private flush(): void {
    if (this.dirty && this.tex) {
      this.tex.refresh();
      this.dirty = false;
    }
  }

  destroy(): void {
    this.clearRoom();
    for (const c of this.followers) c.box.destroy();
    this.followers = [];
    if (this.scene.textures.exists(ATLAS_KEY)) this.scene.textures.remove(ATLAS_KEY);
  }
}
