/**
 * Sprite art for the editor's DOM and overlay: palette thumbnails (a CSS window onto the atlas image) and the placement ghost (drawn on the
 * overlay canvas). Reads the same manifest and atlases the world loads, so the browser serves them from cache.
 */
import { loadManifest, pixelBase, type Manifest } from '../../render/pixel/manifest';
import type { ManifestSprite } from './assets';

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AtlasArt {
  url: string;
  img: HTMLImageElement;
  frames: Record<string, Frame>;
}

export class Art {
  private constructor(
    readonly manifest: Manifest,
    private atlases: Map<string, AtlasArt>,
  ) {}

  static async load(): Promise<Art> {
    const base = pixelBase();
    const manifest = await loadManifest(base);
    const atlases = new Map<string, AtlasArt>();
    await Promise.all(
      Object.entries(manifest.atlases)
        .filter(([, a]) => !a.lazy)
        .map(async ([name, a]) => {
          const url = base + a.image;
          const data = (await (await fetch(base + a.data)).json()) as { frames: Record<string, { frame: Frame }> };
          const img = new Image();
          img.src = url;
          await img.decode().catch(() => {});
          const frames: Record<string, Frame> = {};
          for (const [k, f] of Object.entries(data.frames)) frames[k] = f.frame;
          atlases.set(name, { url, img, frames });
        }),
    );
    return new Art(manifest, atlases);
  }

  get sprites(): Record<string, ManifestSprite> {
    return this.manifest.sprites as unknown as Record<string, ManifestSprite>;
  }

  sprite(key: string | null | undefined): ManifestSprite | null {
    return key ? (this.sprites[key] ?? null) : null;
  }

  has = (key: string): boolean => !!this.sprites[key];

  private frameOf(key: string): { atlas: AtlasArt; f: Frame } | null {
    const s = this.sprite(key);
    if (!s) return null;
    const atlas = this.atlases.get(s.atlas);
    const name = s.anim?.frames?.[0] ?? s.frame;
    const f = atlas?.frames[name] ?? atlas?.frames[s.frame];
    return atlas && f ? { atlas, f } : null;
  }

  /** A `box` x `box` CSS px thumbnail: whole-number zoom when the sprite is small, scaled down when it is big. */
  thumb(key: string | null, box = 48, flip = false): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'dm-thumb';
    wrap.style.width = wrap.style.height = `${box}px`;
    const fr = key ? this.frameOf(key) : null;
    if (!fr) {
      wrap.classList.add('dm-thumb-none');
      return wrap;
    }
    const { f, atlas } = fr;
    const fit = Math.min(box / f.w, box / f.h);
    const scale = fit >= 1 ? Math.min(3, Math.floor(fit)) : fit;
    const inner = document.createElement('span');
    inner.className = 'dm-thumb-art';
    inner.style.width = `${f.w}px`;
    inner.style.height = `${f.h}px`;
    inner.style.backgroundImage = `url(${atlas.url})`;
    inner.style.backgroundPosition = `-${f.x}px -${f.y}px`;
    inner.style.transform = `translate(-50%, -50%) scale(${flip ? -scale : scale}, ${scale})`;
    wrap.append(inner);
    return wrap;
  }

  /** Draw a sprite with its anchor at canvas point (x, y), `scale` canvas px per art px. */
  draw(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, scale: number, flip = false): boolean {
    const s = this.sprite(key);
    const fr = this.frameOf(key);
    if (!s || !fr) return false;
    const { f, atlas } = fr;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(atlas.img, f.x, f.y, f.w, f.h, -s.ax * scale, -s.ay * scale, f.w * scale, f.h * scale);
    ctx.restore();
    return true;
  }
}
