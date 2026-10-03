/**
 * Pixel art for the DOM UI, shared by both views (the iso view has no Phaser): item icons, furniture icons, NPC portraits, the
 * parrot. Everything is drawn at an integer zoom with `image-rendering: pixelated` (the `px-img` class), sized from the manifest.
 */
import type { NpcId } from '@tudobem/shared';
import { furnitureArtKey } from '../render/pixel/props';
import { imageDef, imageUrl, loadUiManifest, nineSlice, pixelBase, type Manifest } from '../render/pixel/manifest';
import { h } from './dom';

export type Expression = 'neutro' | 'feliz' | 'surpreso' | 'pensativo';

/** `<img>` of a standalone manifest image at an integer zoom. */
export function pxImg(key: string, zoom: number, alt = '', cls = ''): HTMLImageElement {
  const d = imageDef(key);
  const el = h('img', { class: `px-img ${cls}`.trim(), src: imageUrl(key), alt, draggable: false }) as HTMLImageElement;
  if (d) {
    el.width = d.w * zoom;
    el.height = d.h * zoom;
    el.style.width = `${d.w * zoom}px`;
    el.style.height = `${d.h * zoom}px`;
  }
  return el;
}

/** The 16x16 bag item icon (`icons/<itemId>`) at `zoom` (3 = 48 px). */
export const foodIcon = (itemId: string, zoom = 3, alt = '', cls = ''): HTMLImageElement => pxImg(`icons/${itemId}`, zoom, alt, `px-food ${cls}`.trim());

/** NPCs with no portrait of their own yet borrow another's (empty when every scheduled NPC has `portraits/<id>_*`). */
/** Dona Lúcia borrows Júlia's portrait until the escola has its own. */
export const PORTRAIT_PLACEHOLDER: Record<string, string> = { lucia: 'julia' };

/** Portrait key for an NPC and expression. */
export const portraitKey = (npc: NpcId | string, expr: Expression = 'neutro'): string => `portraits/${PORTRAIT_PLACEHOLDER[npc] ?? npc}_${expr}`;

/**
 * The expression a dialogue shows for a 0-3 answer score (Me vê um / scene chips): `feliz` on a perfect answer, `surpreso` on a miss,
 * `neutro` otherwise (and before any answer).
 */
export function expressionForScore(score: number | undefined): Expression {
  if (score === undefined) return 'neutro';
  if (score >= 3) return 'feliz';
  if (score <= 0) return 'surpreso';
  return 'neutro';
}

/** The Conversa conta grade: `pass` is happy, `tryAgain` surprised, everything else (and mid-conversation) neutral. */
export function expressionForGrade(grade: 'pass' | 'almost' | 'tryAgain' | null | undefined): Expression {
  return grade === 'pass' ? 'feliz' : grade === 'tryAgain' ? 'surpreso' : 'neutro';
}

/**
 * A portrait card: the 64x64 portrait at 2x (1x on phones, by CSS on `.px-portrait`), inside `cls`. When the NPC has no portrait the card
 * is left empty rather than showing a broken image.
 */
export function npcPortrait(npcId: NpcId | string | null, expr: Expression, cls: string): HTMLElement {
  const box = h('div', { class: `${cls} px-portrait` });
  if (!npcId) return box;
  const img = pxImg(portraitKey(npcId, expr), 2, '', 'px-portrait-img');
  img.addEventListener('error', () => img.remove(), { once: true });
  box.append(img);
  return box;
}

/** The parrot from the perch (`chars/parrot_strip`, 4 frames) as a looping CSS strip animation, 8x. */
export function parrotPortrait(cls: string): HTMLElement {
  const d = imageDef('chars/parrot_strip');
  const frames = d?.frames ?? 4;
  const fw = d?.frameW ?? 10;
  const zoom = 6;
  const el = h('div', { class: `${cls} px-portrait px-parrot` });
  const sprite = h('div', {
    class: 'px-strip',
    style: `width:${fw * zoom}px;height:${(d?.h ?? 15) * zoom}px;background-image:url(${imageUrl('chars/parrot_strip')});background-size:${fw * zoom * frames}px ${(d?.h ?? 15) * zoom}px;--frames:${frames};--frame-w:${fw * zoom}px;--dur:${frames / (d?.fps ?? 3)}s`,
  });
  el.append(sprite);
  return el;
}

// ---------------------------------------------------------------- furniture icons (an atlas crop)

interface AtlasCache {
  image: Promise<HTMLImageElement>;
  frames: Promise<Record<string, { frame: { x: number; y: number; w: number; h: number } }>>;
}

const atlases = new Map<string, AtlasCache>();
const furnUrls = new Map<string, string>();
let uiManifestRef: Manifest | null = null;

/** The manifest for furniture crops (set by `initPixelArt`). */
export function setPixelArtManifest(m: Manifest | null): void {
  uiManifestRef = m;
}

function atlasFor(name: string): AtlasCache | null {
  const def = uiManifestRef?.atlases[name];
  if (!def) return null;
  let a = atlases.get(name);
  if (!a) {
    const base = pixelBase();
    a = {
      image: new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`atlas ${def.image}`));
        img.src = base + def.image;
      }),
      frames: fetch(base + def.data)
        .then((r) => r.json())
        .then((j: { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> }) => j.frames),
    };
    a.image.catch(() => {});
    a.frames.catch(() => {});
    atlases.set(name, a);
  }
  return a;
}

/** Crops one manifest sprite (rot 0 / S-facing for furniture) out of its atlas into a PNG data URL, cached by key. */
export async function spriteDataUrl(spriteKey: string): Promise<string | null> {
  const hit = furnUrls.get(spriteKey);
  if (hit) return hit;
  const def = uiManifestRef?.sprites[spriteKey];
  const atlas = def ? atlasFor(def.atlas) : null;
  if (!def || !atlas) return null;
  const [img, frames] = await Promise.all([atlas.image, atlas.frames]);
  const f = frames[def.frame]?.frame;
  if (!f) return null;
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const url = c.toDataURL();
  furnUrls.set(spriteKey, url);
  return url;
}

/**
 * The catalog icon of a furniture item: its rot-0 sprite from the atlas, at an integer zoom, centred in a fixed square box so every
 * row lines up (2x fits the tallest, 34 px, in 72). The image fills in when the atlas has loaded (at once when it is cached).
 */
export function furnitureIcon(itemId: string, zoom = 2, box = 72): HTMLElement {
  const key = furnitureArtKey(itemId, 0);
  const def = uiManifestRef?.sprites[key];
  const wrap = h('span', { class: 'furn-icon-box', style: `width:${box}px;height:${box}px` });
  if (!def) return wrap;
  const img = h('img', { class: 'px-img px-furn', alt: '', draggable: false }) as HTMLImageElement;
  img.width = def.w * zoom;
  img.height = def.h * zoom;
  img.style.width = `${def.w * zoom}px`;
  img.style.height = `${def.h * zoom}px`;
  const cached = furnUrls.get(key);
  if (cached) img.src = cached;
  else void spriteDataUrl(key).then((url) => url && (img.src = url), () => {});
  wrap.append(img);
  return wrap;
}

// ---------------------------------------------------------------- pixel chrome (9-slice border-images as CSS variables)

/**
 * CSS custom properties for the pixel chrome, from the manifest's ui kit (`pixel-ui.css` reads them under `html.px-ui`):
 * `--px-panel` / `--px-panel-2` (panel at 1x / 2x), `--px-bubble`, `--px-button`, `--px-button-hover`, `--px-button-pressed`
 * (full `border-image` shorthands) and the border widths `--px-panel-w`, `--px-btn-x`, `--px-btn-t`, `--px-btn-b`.
 * Empty when the manifest has no such image.
 */
export function chromeVars(images: Manifest['images'] | null, base: string = pixelBase()): Record<string, string> {
  const out: Record<string, string> = {};
  const panel = nineSlice('ui/panel', images, base);
  if (panel) {
    out['--px-panel'] = panel.borderImage(1);
    out['--px-panel-2'] = panel.borderImage(2);
    out['--px-panel-w'] = `${images?.['ui/panel']?.slice?.top ?? 7}px`;
  }
  const bubble = nineSlice('ui/bubble', images, base);
  if (bubble) out['--px-bubble'] = bubble.borderImage(1);
  for (const [name, key] of [['button', 'ui/button'], ['button-hover', 'ui/button_hover'], ['button-pressed', 'ui/button_pressed']] as const) {
    const n = nineSlice(key, images, base);
    if (n) out[`--px-${name}`] = n.borderImage(1);
  }
  const btn = images?.['ui/button']?.slice;
  if (btn) {
    out['--px-btn-x'] = `${btn.left}px`;
    out['--px-btn-t'] = `${btn.top}px`;
    out['--px-btn-b'] = `${btn.bottom}px`;
  }
  return out;
}

/** Sets the chrome variables on <html>. Returns false when the ui kit is missing (the old chrome stays). */
export function applyChrome(m: Pick<Manifest, 'images'> | null): boolean {
  const vars = chromeVars(m?.images ?? null);
  if (!vars['--px-panel'] || !vars['--px-button']) return false;
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.documentElement.classList.add('px-ui');
  return true;
}

/** Loads the manifest for the DOM UI (both views) and turns the pixel chrome on. Await it before the first panel is built. */
export async function initPixelArt(): Promise<Manifest | null> {
  const m = await loadUiManifest();
  if (!m) console.warn('[TB] pixel manifest unavailable, UI art will be missing');
  setPixelArtManifest(m);
  applyChrome(m);
  return m;
}
