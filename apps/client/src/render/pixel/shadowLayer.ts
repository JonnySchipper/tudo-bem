/**
 * Directional cast shadows and rim light (V5): the Phaser side of `shadows.ts`.
 *
 * Every standing sprite (props, buildings, canopies, characters, vehicles, the dog) gets a shadow that is its own silhouette, flipped over the
 * ground line and sheared by the sun (`shadowLook`). The silhouette is generated once per sprite frame from the sprite's alpha (`silhouette.ts`),
 * packed into ONE canvas texture (so the whole layer is one bound texture), and drawn by a sprite inside a Container whose rotation/scale and the
 * sprite's own rotation compose to the shear (`shearTransform`): the GPU does the shear, so the shadow slides smoothly with the clock and
 * nothing is regenerated when the sun moves. Drawn with MULTIPLY (the ground keeps its colour and texture and only loses light) under everything
 * that stands, in the main (world) camera at the same integer zoom as the art.
 *
 * The same atlas holds the rim masks (`buildRim`): a static prop gets a second sprite over itself, ADD blended in the sun's warm colour, that
 * lights only the edge facing the sun at low sun.
 */
import Phaser from 'phaser';
import type { SpriteDef } from './manifest';
import { DEPTH } from './props';
import { ShelfPacker, buildRim, buildSilhouette, type RgbaImage } from './silhouette';
import { castPreset, casterShear, shearTransform, type CastPreset, type ShadowLook } from './shadows';

const ATLAS_KEY = 'shadowAtlas';
const ATLAS_SIZE = 1024;
/** Pages of the shadow atlas: a page is added when one is full (never destroyed while a sprite may draw from it); 4 x 1024^2 RGBA = 16 MB at most. */
const MAX_PAGES = 4;
const pageKey = (i: number): string => (i === 0 ? ATLAS_KEY : `${ATLAS_KEY}${i}`);

interface Page {
  key: string;
  tex: Phaser.Textures.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  packer: ShelfPacker;
  dirty: boolean;
}

interface Ref {
  /** texture key of the atlas page the frame is on */
  tex: string;
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

/** The sun's edge light for the frame: where it comes from, how strong, what colour. */
export interface RimLook {
  side: 'l' | 'r';
  alpha: number;
  tint: number;
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
  /** rim light sprite over a static prop (null for followers and things too small to catch light) */
  rim: Phaser.GameObjects.Sprite | null;
  rimSide: '' | 'l' | 'r';
  rimEpoch: number;
}

/** The handle a scene keeps for a static shadow: lets a stall that is folded away hide its shadow too. */
export class ShadowHandle {
  constructor(private readonly c: Caster | null) {}
  setVisible(v: boolean): this {
    if (this.c) {
      this.c.ownerVisible = v;
      this.c.rim?.setVisible(false);
    }
    return this;
  }
}

export class ShadowLayer {
  private pages: Page[] = [];
  private cache = new Map<string, Ref | null>();
  private epoch = 0;
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
    this.addPage();
  }

  /** Create the next atlas page (null at the page budget). */
  private addPage(): Page | null {
    if (this.pages.length >= MAX_PAGES) return null;
    const key = pageKey(this.pages.length);
    const t = this.scene.textures;
    if (t.exists(key)) t.remove(key);
    const ct = t.createCanvas(key, ATLAS_SIZE, ATLAS_SIZE);
    if (!ct) return null;
    // shadows are soft: bilinear, unlike the art
    ct.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const page: Page = { key, tex: ct, ctx: ct.getContext(), packer: new ShelfPacker(ATLAS_SIZE, ATLAS_SIZE), dirty: true };
    this.pages.push(page);
    return page;
  }

  /**
   * Throw every page away and start with one empty page. Only called between rooms (nothing static draws then), and every follower is hidden
   * and re-resolved before it draws again: a sprite must never render with a frame of a destroyed texture, because that throws inside Phaser's
   * render and stops the whole loop (a blank world).
   */
  private resetPages(): void {
    for (const c of this.followers) {
      c.box.setVisible(false);
      c.spr.setVisible(false);
      c.epoch = -1;
    }
    for (const p of this.pages) if (this.scene.textures.exists(p.key)) this.scene.textures.remove(p.key);
    this.pages = [];
    this.cache.clear();
    this.epoch++;
    this.addPage();
  }

  /** Texture budget for the soak test and the perf notes. */
  get pageCount(): number {
    return this.pages.length;
  }

  /** how full each page is, 0..1 */
  get pageFill(): number[] {
    return this.pages.map((p) => +p.packer.fill.toFixed(2));
  }

  // ------------------------------------------------------------------ atlas
  /** Reads one frame's alpha as RGBA (untrimmed: the frame's own offset is applied). */
  readFrame(tex: string, frame: string | number): RgbaImage | null {
    const t = this.scene.textures.get(tex);
    if (!t || t.key === '__MISSING') return null;
    const f = t.get(frame);
    if (!f || (f.name === '__BASE' && frame !== '__BASE')) return null;
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

  /** Pack an RGBA image into the atlas and return its frame, resetting the atlas when it is full. */
  private pack(img: RgbaImage, ax: number, ay: number): Ref | null {
    let page: Page | null = null;
    let at: { x: number; y: number } | null = null;
    for (const p of this.pages) {
      at = p.packer.alloc(img.w, img.h);
      if (at) {
        page = p;
        break;
      }
    }
    if (!page || !at) {
      // every page is full: add one (up to the budget). Existing frames stay valid; at the budget this sprite simply has no shadow.
      page = this.addPage();
      at = page ? page.packer.alloc(img.w, img.h) : null;
      if (!page || !at) return null;
    }
    page.ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), at.x, at.y);
    const name = `s${this.generated}_${at.x}_${at.y}`;
    page.tex.add(name, 0, at.x, at.y, img.w, img.h);
    page.dirty = true;
    this.generated++;
    return { tex: page.key, frame: name, w: img.w, h: img.h, ax, ay };
  }

  /** The shadow silhouette of a source frame (generated and packed on first use); null when the source is not readable or the atlas is full. */
  private silhouette(s: Source): Ref | null {
    const k = `sil|${s.tex}|${s.frame}|${s.ax},${s.ay}|${s.preset.blur}`;
    const hit = this.cache.get(k);
    if (hit !== undefined) return hit;
    const px = this.readFrame(s.tex, s.frame);
    if (!px) return null;
    const sil = buildSilhouette(px, s.ax, s.ay, { blur: s.preset.blur });
    const ref = this.pack(sil, sil.ax, sil.ay);
    this.cache.set(k, ref);
    return ref;
  }

  /** The rim mask of a source frame for light from `side`. */
  private rimMask(s: Source, side: 'l' | 'r'): Ref | null {
    const k = `rim${side}|${s.tex}|${s.frame}`;
    const hit = this.cache.get(k);
    if (hit !== undefined) return hit;
    const px = this.readFrame(s.tex, s.frame);
    if (!px) return null;
    const ref = this.pack(buildRim(px, side), s.ax, s.ay);
    this.cache.set(k, ref);
    return ref;
  }

  // ------------------------------------------------------------------ casters
  private make(src: Source, height: number, wx: number, wy: number, key: string): Caster {
    const spr = this.scene.make.sprite({ x: 0, y: 0, key: pageKey(0), add: false }, false).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    const box = this.rig.world(this.scene.add.container(wx, wy, [spr])).setDepth(DEPTH.shadowCast).setVisible(false);
    return { box, spr, src, height, follow: null, fixedFrame: null, hScale: 1, ownerVisible: true, epoch: -1, sig: '', key, rim: null, rimSide: '', rimEpoch: -1 };
  }

  /**
   * A shadow (and, for a prop tall enough to catch light, a rim light) for a static sprite standing at world px (wx, wy), its anchor. `depth` is
   * the sprite's own depth: the rim sprite sits just above it. A sprite that does not cast returns a no-op handle.
   */
  addStatic(key: string, d: SpriteDef, wx: number, wy: number, depth = 0): ShadowHandle {
    const preset = castPreset(key, d);
    if (!preset.cast) return new ShadowHandle(null);
    const c = this.make({ tex: d.atlas, frame: d.frame, ax: d.ax, ay: d.ay, preset }, Math.max(1, Math.min(d.h, d.ay)), Math.round(wx), Math.round(wy), key);
    if (d.h >= 18 && d.ay >= 14) {
      c.rim = this.rig.world(this.scene.add.sprite(Math.round(wx), Math.round(wy), pageKey(0))).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.002).setVisible(false);
    }
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
    for (const c of this.statics) {
      c.box.destroy();
      c.rim?.destroy();
    }
    this.statics = [];
    this.resetPages();
  }

  get count(): number {
    return this.statics.length + this.followers.length;
  }

  get rimCount(): number {
    return this.statics.filter((c) => c.rim?.visible).length;
  }

  // ------------------------------------------------------------------ frame
  /**
   * Re-aim every shadow at the sun. `enabled` is false in interiors (their own baked shadows are used), under low-fx and at night; `alphaMul`
   * is the strength (0..1), `look` the sun. `rim` is the edge light (alpha 0 hides it).
   */
  update(look: ShadowLook, enabled: boolean, alphaMul: number, rim?: RimLook): void {
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
      for (const c of this.statics) {
        if (c.box.visible) c.box.setVisible(false);
        if (c.rim?.visible) c.rim.setVisible(false);
      }
      for (const c of this.followers) if (c.box.visible) c.box.setVisible(false);
      this.flush();
      return;
    }
    const lookSig = `${look.lx.toFixed(3)},${look.ly.toFixed(3)},${look.tint},${(look.alpha * alphaMul).toFixed(3)}`;
    const lookChanged = lookSig !== this.lastLook;
    this.lastLook = lookSig;
    for (const c of this.statics) {
      this.aim(c, look, alphaMul, lookChanged);
      this.aimRim(c, enabled ? rim : undefined);
    }
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
      c.spr.setTexture(ref.tex, ref.frame).setOrigin(ref.ax / ref.w, ref.ay / ref.h);
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

  /** The warm edge of a static prop on the side the sun is on. */
  private aimRim(c: Caster, rim: RimLook | undefined): void {
    const r = c.rim;
    if (!r) return;
    if (!rim || rim.alpha < 0.02 || !c.ownerVisible) {
      if (r.visible) r.setVisible(false);
      return;
    }
    if (c.rimSide !== rim.side || c.rimEpoch !== this.epoch) {
      const ref = this.rimMask(c.src, rim.side);
      c.rimEpoch = this.epoch;
      c.rimSide = rim.side;
      if (!ref) {
        r.setVisible(false);
        return;
      }
      r.setTexture(ref.tex, ref.frame).setOrigin(ref.ax / ref.w, ref.ay / ref.h);
    }
    r.setTint(rim.tint).setAlpha(rim.alpha).setVisible(true);
  }

  /** Upload the atlas once per frame, and only if something was added. */
  private flush(): void {
    for (const p of this.pages) {
      if (p.dirty) {
        p.tex.refresh();
        p.dirty = false;
      }
    }
  }

  destroy(): void {
    this.clearRoom();
    for (const c of this.followers) c.box.destroy();
    this.followers = [];
    for (const p of this.pages) if (this.scene.textures.exists(p.key)) this.scene.textures.remove(p.key);
    this.pages = [];
  }
}
