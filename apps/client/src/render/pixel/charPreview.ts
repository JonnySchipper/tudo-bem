/**
 * DOM previews of the composed pixel character, for both views (the iso view has no Phaser): the avatar creator (8x, with a turn button),
 * the wardrobe / hat shop, and the hat icons. They compose through the same layer table and composer as the game scene.
 */
import type { Appearance } from '@tudobem/shared';
import { sharedCharAssets, type CharAssets } from './charAssets';
import { composeRgba } from './charcompose';
import { composeLook } from './composeLook';
import { FACING_ROW, type Facing } from './facing';
import { hatSpec, lookForAppearance, lookKey } from './looks';

/** Art px of the preview canvas: the 16x32 frame with room for a hat, a parrot and the bow. */
export const PREVIEW_W = 28;
export const PREVIEW_H = 36;
/** where the frame sits inside the canvas */
const FX = 6;
const FY = 2;

export interface PreviewSpec {
  appearance: Appearance;
  hat?: string | null;
  parrot?: boolean;
}

export const TURN_ORDER: Facing[] = ['S', 'E', 'N', 'W'];

export interface CharPreview {
  /** cycle S -> E -> N -> W; returns the new facing */
  turn(): Facing;
  facing(): Facing;
  /** play the wave (emote `oi`) once */
  wave(): void;
  stop(): void;
}

interface Composed {
  sheet: HTMLCanvasElement;
}

const composedCache = new Map<string, Composed>();

function composedFor(assets: CharAssets, spec: PreviewSpec): { key: string; look: ReturnType<typeof lookForAppearance>; c: Composed } {
  const look = lookForAppearance(spec.appearance, { hat: spec.hat ?? null });
  const key = lookKey(look);
  let c = composedCache.get(key);
  if (c) {
    composedCache.delete(key);
    composedCache.set(key, c);
  } else {
    const sheet = document.createElement('canvas');
    sheet.width = assets.sheetW;
    sheet.height = assets.sheetH;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(composeLook(assets, look)), assets.sheetW, assets.sheetH), 0, 0);
    c = { sheet };
    composedCache.set(key, c);
    while (composedCache.size > 8) composedCache.delete(composedCache.keys().next().value as string);
  }
  return { key, look, c };
}

const parrotImg = new Map<string, HTMLImageElement>();
function parrotStrip(assets: CharAssets): { img: HTMLImageElement; frames: number; frameW: number; h: number } | null {
  const meta = assets.manifest.images?.['chars/parrot_strip'];
  if (!meta) return null;
  const url = `${import.meta.env.BASE_URL}pixel/${meta.file}`;
  let img = parrotImg.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    parrotImg.set(url, img);
  }
  return img.complete && img.naturalWidth ? { img, frames: meta.frames ?? 4, frameW: meta.frameW ?? 10, h: meta.h } : null;
}

/**
 * Draws the character into `canvas` (set to PREVIEW_W x PREVIEW_H art px, shown by CSS at an integer scale with image-rendering: pixelated).
 * `get` is read every frame, so the preview follows the creator's controls.
 */
export function mountCharPreview(canvas: HTMLCanvasElement, get: () => PreviewSpec, opts: { facing?: Facing; waveOnStart?: boolean } = {}): CharPreview {
  canvas.width = PREVIEW_W;
  canvas.height = PREVIEW_H;
  canvas.style.imageRendering = 'pixelated';
  let facing: Facing = opts.facing ?? 'S';
  let waveT0 = opts.waveOnStart ? performance.now() : -1e9;
  let raf = 0;
  let stopped = false;
  let assets: CharAssets | null = null;
  void sharedCharAssets().then((a) => {
    assets = a;
  }, (e) => console.error('[pixel] character assets failed', e));

  const draw = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(draw);
    const ctx = canvas.getContext('2d');
    if (!ctx || !assets) return;
    const spec = get();
    const { look, c } = composedFor(assets, spec);
    const meta = assets.manifest.sheet;
    const [fw, fh] = meta.frame;
    const oi = meta.anims.oi;
    const waving = now - waveT0 < ((oi.frames / (oi.fps ?? 8)) * (oi.repeat ?? 1)) * 1000;
    let row: number;
    let col: number;
    if (waving) {
      row = oi.row ?? 12;
      col = Math.floor(((now - waveT0) / 1000) * (oi.fps ?? 8)) % oi.frames;
    } else if (look.idle.anim === 'phone' && facing === 'S') {
      row = meta.anims.phone.row ?? 17;
      col = Math.floor((now / 1000) * (meta.anims.phone.fps ?? 6) * look.idle.speed) % meta.anims.phone.frames;
    } else {
      row = meta.anims.idle.rows![FACING_ROW[facing]];
      col = Math.floor((now / 1000) * (meta.anims.idle.fps ?? 5) * look.idle.speed) % meta.anims.idle.frames;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (spec.parrot) {
      const p = parrotStrip(assets);
      if (p) {
        const pf = Math.floor((now / 1000) * 3) % p.frames;
        const side = facing === 'W' ? 1 : -1;
        const bob = Math.round(Math.sin(now / 420) * 1.5);
        const px = FX + 8 + side * 9 - 5;
        const py = FY + 31 - 12 + bob - 14;
        if (side === 1) {
          ctx.save();
          ctx.translate(px + p.frameW, py);
          ctx.scale(-1, 1);
          ctx.drawImage(p.img, pf * p.frameW, 0, p.frameW, p.h, 0, 0, p.frameW, p.h);
          ctx.restore();
        } else ctx.drawImage(p.img, pf * p.frameW, 0, p.frameW, p.h, px, py, p.frameW, p.h);
      }
    }
    ctx.drawImage(c.sheet, col * fw, row * fh, fw, fh, FX, FY, fw, fh);
  };
  raf = requestAnimationFrame(draw);

  return {
    turn() {
      facing = TURN_ORDER[(TURN_ORDER.indexOf(facing) + 1) % TURN_ORDER.length];
      return facing;
    },
    facing: () => facing,
    wave() {
      waveT0 = performance.now();
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

// ------------------------------------------------------------------ hat icons
const iconCache = new Map<string, string>();

/**
 * The S-facing hat layer alone, cropped tight and drawn at 4x, as a PNG data URL (both views). Resolves to '' when the hat has no layer.
 */
export async function hatIconUrl(hatId: string, scale = 4): Promise<string> {
  const cacheKey = `${hatId}@${scale}`;
  const hit = iconCache.get(cacheKey);
  if (hit) return hit;
  const spec = hatSpec(hatId);
  if (!spec) return '';
  const assets = await sharedCharAssets();
  const layer = assets.layer(spec.layer);
  if (!layer) return '';
  const rgba = composeRgba(layer.data.length, [{ data: layer.data, ramps: { hat: spec.color, accent: spec.accent } }]);
  const [fw, fh] = assets.manifest.sheet.frame;
  // frame (row 0 = idle S, col 0), cropped to the opaque bounds
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (rgba[(y * assets.sheetW + x) * 4 + 3]) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return '';
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const sctx = src.getContext('2d');
  if (!sctx) return '';
  const id = sctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * assets.sheetW + x0 + x) * 4;
    id.data.set(rgba.subarray(si, si + 4), (y * w + x) * 4);
  }
  sctx.putImageData(id, 0, 0);
  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const octx = out.getContext('2d');
  if (!octx) return '';
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, 0, 0, w * scale, h * scale);
  const url = out.toDataURL('image/png');
  iconCache.set(cacheKey, url);
  return url;
}

/** Fills an <img> with the hat icon once the art is ready (keeps the element reusable inside synchronous render code). */
export function setHatIcon(img: HTMLImageElement, hatId: string, scale = 4): void {
  img.style.imageRendering = 'pixelated';
  img.style.objectFit = 'contain';
  img.dataset.hatIcon = hatId;
  void hatIconUrl(hatId, scale).then(
    (url) => {
      if (url && img.dataset.hatIcon === hatId) img.src = url;
    },
    () => {},
  );
}

