/**
 * A pet on a DOM canvas (the pet shop panel's cards, the meet view, Meus pets): one frame of the look's strip, recoloured like the world does
 * (petLook.ts) and scaled with hard pixels. The strips are small PNGs; each is fetched once.
 */
import { petStripKey, type PetLook } from '@tudobem/shared';
import { imageUrl } from '../render/pixel/manifest';
import { petSwapTable, petTextureKey } from '../render/pixel/petLook';
import { swapKeys } from '../render/pixel/palette';

const FRAME_W = 24;
const FRAME_H = 20;
const images = new Map<string, Promise<HTMLImageElement>>();

function load(key: string): Promise<HTMLImageElement> {
  let p = images.get(key);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(key);
        reject(new Error(`pet strip ${key}`));
      };
      img.src = imageUrl(key);
    });
    images.set(key, p);
  }
  return p;
}

/** The recoloured strip of a look, cached per look. */
const strips = new Map<string, Promise<HTMLCanvasElement>>();
function stripFor(look: PetLook): Promise<HTMLCanvasElement> {
  const tex = petTextureKey(look);
  let p = strips.get(tex);
  if (!p) {
    const legacy = tex === `pet:${look.species}`;
    p = load(legacy ? `chars/pet_${look.species}` : petStripKey(look)).then((img) => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      if (!legacy) {
        const data = ctx.getImageData(0, 0, c.width, c.height);
        swapKeys(data.data, petSwapTable(look));
        ctx.putImageData(data, 0, 0);
      }
      return c;
    });
    p.catch(() => strips.delete(tex));
    strips.set(tex, p);
  }
  return p;
}

/** A canvas showing `frame` of the look at `scale`. `frames` (optional) loops through those frames at `fps`. */
export function petCanvas(look: PetLook, opts: { scale?: number; frame?: number; frames?: number[]; fps?: number; flip?: boolean; className?: string } = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 3;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * scale;
  canvas.height = FRAME_H * scale;
  canvas.className = `pet-canvas ${opts.className ?? ''}`.trim();
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const frames = opts.frames ?? [opts.frame ?? 12];
  void stripFor(look)
    .then((strip) => {
      let i = 0;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        if (opts.flip) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(strip, frames[i % frames.length]! * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      };
      draw();
      if (frames.length > 1) {
        const t = setInterval(() => {
          if (!canvas.isConnected && i > 0) return clearInterval(t);
          i++;
          draw();
        }, 1000 / (opts.fps ?? 6));
      }
    })
    .catch(() => {});
  return canvas;
}
