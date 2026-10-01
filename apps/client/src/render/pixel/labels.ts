/**
 * DOM overlay of the pixel view (HOWTO D8, §5.9): nameplates, speech bubbles and tutorial guides are HTML positioned over the canvas,
 * so text stays crisp at every zoom and accents render. One `#world-labels` layer with `pointer-events: none`; elements are created once
 * per key and only moved (transform: translate, whole CSS px) each frame; a bubble line or a guide is rewritten only when its text changes.
 *
 *  - Nameplates: Verde plate for players, terracotta for NPCs, a mustard ring on yourself, stepped pixel corners (pixel.css).
 *  - Speech bubbles: the art track 2 9-slice bubble (`ui/bubble`, slice and file from the manifest's `images`), 2x. The tail is bottom-left;
 *    when the speaker is in the right half of the screen a mirrored copy (tail bottom-right) is used so the bubble opens toward the middle.
 *  - Guides: the bouncing pixel arrow (`ui/guide_arrow_strip`, a CSS steps animation over its 4 frames) with a small label. Off-screen
 *    targets pin the arrow to the nearest edge of the free screen region and turn it toward the target (`guides.ts`).
 */
import './pixel.css';
import { diffIds } from './reconcile';
import { GUIDE_ROTATION, pinGuide, type GuideDir, type GuideInsets } from './guides';

export interface BubbleItem {
  text: string;
  gloss: string | null;
  /** 0..1 */
  alpha: number;
}

export interface StackItem {
  key: string;
  /** CSS px of the point the stack stands on (just above the head) */
  x: number;
  y: number;
  plate: { text: string; kind: 'npc' | 'player' | 'me' } | null;
  bubbles: BubbleItem[];
}

export interface GuideItem {
  key: string;
  /** CSS px of the point the arrow tip touches (a little above the target) */
  x: number;
  y: number;
  label: string;
}

/** The manifest fields the labels need (`manifest.images`), so this file does not depend on manifest.ts. */
export interface LabelArt {
  base: string;
  images: Record<string, { file: string; w: number; h: number; frames?: number; frameW?: number; fps?: number; slice?: { top: number; right: number; bottom: number; left: number } }>;
}

/** Bubble art px -> CSS px (an integer, so the 9-slice stays crisp). */
export const BUBBLE_SCALE = 2;
/** Guide arrow art px -> CSS px. */
export const ARROW_SCALE = 2;
/** CSS px between the anchor point and the bubble's edge on the tail side: the tail tip sits about 9 art px in from the bubble's edge. */
const TAIL_X = 9 * BUBBLE_SCALE;
/** CSS px between the nameplate and the tail tip of the bubble above it. */
const BUBBLE_GAP = 1;
/** CSS px between the head anchor and the bottom of the nameplate. */
const PLATE_LIFT = 3;

/** Which side the tail (and so the anchor) is on for a speaker at screen x; `prev` gives hysteresis so a walker crossing the middle does not flicker. */
export function bubbleSide(x: number, viewW: number, prev: 'left' | 'right'): 'left' | 'right' {
  const mid = viewW / 2;
  if (prev === 'left') return x > mid + 24 ? 'right' : 'left';
  return x < mid - 24 ? 'left' : 'right';
}

/** Left edge of a bubble of width `w` whose tail tip is at `anchor`, kept inside `[4, viewW - 4]`. */
export function bubbleLeft(anchor: number, w: number, side: 'left' | 'right', viewW: number): number {
  const raw = side === 'left' ? anchor - TAIL_X : anchor + TAIL_X - w;
  return Math.round(Math.min(Math.max(raw, 4), Math.max(4, viewW - w - 4)));
}

/** One stack's layout before de-overlap: where its anchor is on screen and the sizes of its plate and bubbles (oldest line first). */
export interface StackBox {
  key: string;
  ax: number;
  ay: number;
  plate: { w: number; h: number } | null;
  /** `left` is relative to `ax` */
  bubbles: { left: number; w: number; h: number }[];
}

interface Rect {
  l: number;
  r: number;
  t: number;
  b: number;
}

const overlaps = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
/** Never lift a label more than this many CSS px (a crowd should not throw a bubble off the top of the screen). */
const MAX_LIFT = 140;

/** The CSS px from the stack's anchor up to the bottom of the newest bubble, and the total height of the pile above it. */
function pileExtent(box: StackBox): { gap: number; height: number } {
  const plateH = box.plate?.h ?? 0;
  const gap = PLATE_LIFT + plateH + BUBBLE_GAP;
  let height = 0;
  for (const b of box.bubbles) height += b.h - 2;
  return { gap, height: box.bubbles.length ? height + 2 : 0 };
}

/**
 * Vertical de-overlap of nameplates and bubble piles (pure). Nearer stacks (lower on screen) keep their place; a farther stack's nameplate is lifted
 * above whatever it would cover, and its bubble pile is lifted above any plate or pile already placed. Returns, per stack, how far its plate was lifted
 * and how far its pile was lifted in total (the plate's lift included, since the pile sits on the plate), in CSS px.
 */
export function deoverlapStacks(boxes: readonly StackBox[]): Map<string, { plateLift: number; pileLift: number }> {
  const out = new Map<string, { plateLift: number; pileLift: number }>();
  const placed: Rect[] = [];
  const order = [...boxes].sort((a, b) => b.ay - a.ay || (a.key < b.key ? -1 : 1));
  for (const box of order) {
    let plateLift = 0;
    let plateRect: Rect | null = null;
    if (box.plate) {
      const mk = (lift: number): Rect => {
        const b = box.ay - PLATE_LIFT - lift;
        return { l: box.ax - box.plate!.w / 2, r: box.ax + box.plate!.w / 2, t: b - box.plate!.h, b };
      };
      plateRect = mk(0);
      for (let i = 0; i < 8 && plateLift < MAX_LIFT; i++) {
        const hit = placed.find((r) => overlaps(plateRect!, r));
        if (!hit) break;
        plateLift = Math.min(MAX_LIFT, plateLift + (plateRect.b - (hit.t - 1)));
        plateRect = mk(plateLift);
      }
      placed.push(plateRect);
    }
    let pileLift = plateLift;
    if (box.bubbles.length) {
      const { gap, height } = pileExtent(box);
      const left = Math.min(...box.bubbles.map((b) => box.ax + b.left));
      const right = Math.max(...box.bubbles.map((b) => box.ax + b.left + b.w));
      const mk = (lift: number): Rect => {
        const b = box.ay - gap - lift;
        return { l: left, r: right, t: b - height, b };
      };
      let rect = mk(pileLift);
      for (let i = 0; i < 8 && pileLift < MAX_LIFT; i++) {
        const hit = placed.find((r) => overlaps(rect, r));
        if (!hit) break;
        pileLift = Math.min(MAX_LIFT, pileLift + (rect.b - (hit.t - 1)));
        rect = mk(pileLift);
      }
      placed.push(rect);
    }
    out.set(box.key, { plateLift, pileLift });
  }
  return out;
}

interface BubbleEl {
  root: HTMLElement;
  pt: HTMLElement;
  en: HTMLElement;
  text: string;
  gloss: string;
  opacity: string;
  w: number;
  h: number;
}

interface StackEl {
  root: HTMLElement;
  plate: HTMLElement;
  bubbles: BubbleEl[];
  side: 'left' | 'right';
  plateKey: string;
  plateW: number;
  plateH: number;
  transform: string;
  hidden: boolean;
  /** each bubble's `bottom` before any de-overlap lift (CSS px above the anchor) */
  baseBottoms: number[];
  plateBottom: string;
}

interface GuideEl {
  root: HTMLElement;
  label: HTMLElement;
  arrow: HTMLElement;
  text: string;
  labelW: number;
  labelH: number;
  transform: string;
  dir: GuideDir | '';
}

const px = (n: number) => `${n}px`;

/** Mirror an image left-right into a data URL (the bubble with its tail on the right). Pixel art, so a plain canvas flip is lossless. */
async function mirrorImage(url: string): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  if (!g) return url;
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

export class LabelLayer {
  readonly root: HTMLElement;
  private stacks = new Map<string, StackEl>();
  private guides = new Map<string, GuideEl>();
  private artKeys = new Map<string, HTMLElement>();

  constructor(after: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'world-labels';
    this.root.setAttribute('aria-hidden', 'true');
    after.after(this.root);
  }

  /** Point the CSS at the 9-slice bubble and the arrow strip from the manifest (called once the manifest has loaded). */
  setArt(art: LabelArt): void {
    const b = art.images['ui/bubble'];
    if (b?.slice) {
      const url = art.base + b.file;
      const s = b.slice;
      const k = BUBBLE_SCALE;
      const st = this.root.style;
      st.setProperty('--wl-bubble', `url("${url}")`);
      st.setProperty('--wl-bubble-slice', `${s.top} ${s.right} ${s.bottom} ${s.left}`);
      st.setProperty('--wl-bubble-width', `${px(s.top * k)} ${px(s.right * k)} ${px(s.bottom * k)} ${px(s.left * k)}`);
      st.setProperty('--wl-bubble-slice-m', `${s.top} ${s.left} ${s.bottom} ${s.right}`);
      st.setProperty('--wl-bubble-width-m', `${px(s.top * k)} ${px(s.left * k)} ${px(s.bottom * k)} ${px(s.right * k)}`);
      st.setProperty('--wl-bubble-in', `${px(-(s.top * k - 8))} ${px(-(s.right * k - 8))} ${px(-(s.bottom * k - 20))} ${px(-(s.left * k - 8))}`);
      st.setProperty('--wl-bubble-in-m', `${px(-(s.top * k - 8))} ${px(-(s.left * k - 8))} ${px(-(s.bottom * k - 20))} ${px(-(s.right * k - 8))}`);
      st.setProperty('--wl-bubble-pad-bottom', px(s.bottom * k));
      this.root.classList.add('wl-art-bubble');
      void mirrorImage(url)
        .then((m) => this.root.style.setProperty('--wl-bubble-m', `url("${m}")`))
        .catch(() => undefined);
    }
    const a = art.images['ui/guide_arrow_strip'];
    if (a) {
      const frames = a.frames ?? 4;
      const fw = a.frameW ?? Math.round(a.w / frames);
      const k = ARROW_SCALE;
      const st = this.root.style;
      st.setProperty('--wl-arrow', `url("${art.base + a.file}")`);
      st.setProperty('--wl-arrow-w', px(fw * k));
      st.setProperty('--wl-arrow-h', px(a.h * k));
      st.setProperty('--wl-arrow-size', `${px(a.w * k)} ${px(a.h * k)}`);
      st.setProperty('--wl-arrow-end', px(-a.w * k));
      st.setProperty('--wl-arrow-steps', String(frames));
      st.setProperty('--wl-arrow-ms', `${Math.round((frames / (a.fps ?? 6)) * 1000)}ms`);
      this.root.classList.add('wl-art-arrow');
    }
  }

  /** Reposition every label for this frame and drop the ones whose owner is gone. `insets` is the HUD space the guides keep clear of. */
  update(stacks: readonly StackItem[], guides: readonly GuideItem[], view: { w: number; h: number }, insets: GuideInsets = { top: 0, bottom: 0, left: 0, right: 0 }): void {
    const seen = new Map(stacks.map((s) => [s.key, s]));
    const d = diffIds(this.stacks.keys(), seen.keys());
    for (const k of d.remove) {
      this.stacks.get(k)?.root.remove();
      this.stacks.delete(k);
    }
    const boxes: StackBox[] = [];
    for (const s of stacks) {
      let el = this.stacks.get(s.key);
      if (!el) {
        el = this.createStack();
        this.stacks.set(s.key, el);
        this.root.appendChild(el.root);
      }
      const box = this.updateStack(el, s, view);
      if (box) boxes.push(box);
    }
    // nameplates and bubbles of neighbours must not cover each other: lift the farther one's label (pure, see `deoverlapStacks`)
    const lifts = deoverlapStacks(boxes);
    for (const box of boxes) {
      const el = this.stacks.get(box.key);
      const l = lifts.get(box.key);
      if (el && l) this.applyLift(el, l.plateLift, l.pileLift);
    }
    this.updateGuides(guides, view, insets);
  }

  // ------------------------------------------------------------------ stacks (nameplate + bubbles)
  private createStack(): StackEl {
    const root = document.createElement('div');
    root.className = 'wl-stack';
    const plate = document.createElement('div');
    plate.className = 'wl-plate';
    root.appendChild(plate);
    return { root, plate, bubbles: [], side: 'left', plateKey: '', plateW: 0, plateH: 0, transform: '', hidden: false, baseBottoms: [], plateBottom: '' };
  }

  private createBubble(): BubbleEl {
    const root = document.createElement('div');
    root.className = 'wl-bubble';
    const inner = document.createElement('div');
    inner.className = 'wl-b-in';
    const pt = document.createElement('div');
    pt.className = 'pt';
    const en = document.createElement('div');
    en.className = 'en';
    inner.append(pt, en);
    root.appendChild(inner);
    return { root, pt, en, text: '', gloss: '', opacity: '', w: 0, h: 0 };
  }

  /** Write the lifts `deoverlapStacks` chose (only when they changed). */
  private applyLift(el: StackEl, plateLift: number, pileLift: number): void {
    const pb = px(PLATE_LIFT + plateLift);
    if (pb !== el.plateBottom) {
      el.plateBottom = pb;
      el.plate.style.bottom = pb;
    }
    el.bubbles.forEach((be, i) => {
      const b = px((el.baseBottoms[i] ?? 0) + pileLift);
      if (be.root.style.bottom !== b) be.root.style.bottom = b;
    });
  }

  private updateStack(el: StackEl, s: StackItem, view: { w: number; h: number }): StackBox | null {
    const on = s.x > -60 && s.x < view.w + 60 && s.y > -10 && s.y < view.h + 90;
    if (!on) {
      if (!el.hidden) el.root.style.display = 'none';
      el.hidden = true;
      return null;
    }
    if (el.hidden) {
      el.root.style.display = '';
      el.hidden = false;
    }

    // nameplate: text and kind change rarely; measure only then
    const pk = s.plate ? `${s.plate.kind}|${s.plate.text}` : '';
    if (pk !== el.plateKey) {
      el.plateKey = pk;
      if (s.plate) {
        el.plate.style.display = '';
        el.plate.textContent = s.plate.text;
        el.plate.className = `wl-plate wl-plate-${s.plate.kind}`;
        const w = el.plate.offsetWidth;
        el.plateW = w % 2 ? w + 1 : w;
        el.plateH = el.plate.offsetHeight;
        el.plate.style.minWidth = px(el.plateW);
        el.plate.style.marginLeft = px(-el.plateW / 2);
      } else {
        el.plate.style.display = 'none';
        el.plateW = 0;
        el.plateH = 0;
      }
    }

    // bubbles: one element per line, rewritten only when its text changes
    while (el.bubbles.length > s.bubbles.length) el.bubbles.pop()?.root.remove();
    let remeasure = false;
    s.bubbles.forEach((b, i) => {
      let be = el.bubbles[i];
      if (!be) {
        be = this.createBubble();
        el.bubbles[i] = be;
        el.root.appendChild(be.root);
      }
      const gloss = b.gloss ?? '';
      if (be.text !== b.text || be.gloss !== gloss) {
        be.text = b.text;
        be.gloss = gloss;
        be.pt.textContent = b.text;
        be.en.textContent = gloss;
        be.en.style.display = gloss ? '' : 'none';
        remeasure = true;
      }
      const o = String(Math.max(0, Math.min(1, b.alpha)));
      if (be.opacity !== o) {
        be.opacity = o;
        be.root.style.opacity = o;
      }
    });
    const side = bubbleSide(s.x, view.w, el.side);
    if (side !== el.side || remeasure) {
      el.side = side;
      el.root.classList.toggle('wl-mirror', side === 'right');
      for (const be of el.bubbles) {
        be.w = be.root.offsetWidth;
        be.h = be.root.offsetHeight;
      }
    }

    // place: the stack root is a zero-size box at the head; the plate hangs above it and the bubbles pile up above the plate
    const ax = Math.round(s.x);
    const ay = Math.round(s.y);
    const tf = `translate(${ax}px, ${ay}px)`;
    if (tf !== el.transform) {
      el.transform = tf;
      el.root.style.transform = tf;
    }
    // newest line lowest; each older line's tail tip just touches the top edge of the one below it
    let bottom = PLATE_LIFT + el.plateH + BUBBLE_GAP;
    const lefts: number[] = [];
    for (let i = el.bubbles.length - 1; i >= 0; i--) {
      const be = el.bubbles[i];
      const left = bubbleLeft(ax, be.w, side, view.w) - ax;
      lefts[i] = left;
      be.root.style.left = px(left);
      el.baseBottoms[i] = bottom;
      bottom += be.h - 2;
    }
    el.baseBottoms.length = el.bubbles.length;
    return { key: s.key, ax, ay, plate: s.plate ? { w: el.plateW, h: el.plateH } : null, bubbles: el.bubbles.map((be, i) => ({ left: lefts[i] ?? 0, w: be.w, h: be.h })) };
  }

  // ------------------------------------------------------------------ guides
  private createGuide(): GuideEl {
    const root = document.createElement('div');
    root.className = 'wl-guide';
    const label = document.createElement('div');
    label.className = 'wl-plate wl-plate-guide';
    const arrow = document.createElement('div');
    arrow.className = 'wl-guide-arrow';
    root.append(label, arrow);
    return { root, label, arrow, text: '', labelW: 0, labelH: 0, transform: '', dir: '' };
  }

  private updateGuides(items: readonly GuideItem[], view: { w: number; h: number }, insets: GuideInsets): void {
    const seen = new Map(items.map((g) => [g.key, g]));
    const d = diffIds(this.guides.keys(), seen.keys());
    for (const k of d.remove) {
      this.guides.get(k)?.root.remove();
      this.guides.delete(k);
    }
    const arrowW = this.cssPx('--wl-arrow-w', 32);
    const arrowH = this.cssPx('--wl-arrow-h', 40);
    for (const g of items) {
      let el = this.guides.get(g.key);
      if (!el) {
        el = this.createGuide();
        this.guides.set(g.key, el);
        this.root.appendChild(el.root);
      }
      if (el.text !== g.label) {
        el.text = g.label;
        el.label.textContent = g.label;
        const w = el.label.offsetWidth;
        el.labelW = w % 2 ? w + 1 : w;
        el.labelH = el.label.offsetHeight;
        el.label.style.minWidth = px(el.labelW);
      }
      const pin = pinGuide(g, view, insets, 4);
      const ax = Math.round(pin.x);
      const ay = Math.round(pin.y);
      // the arrow box is placed so its tip (bottom-centre before rotation) is at the anchor; rotation turns it about the tip
      const rot = GUIDE_ROTATION[pin.dir];
      // the label sits on the far side of the arrow body from the tip
      const gap = 3;
      let lx: number;
      let ly: number;
      switch (pin.dir) {
        case 'down':
          lx = -el.labelW / 2;
          ly = -arrowH - gap - el.labelH;
          break;
        case 'up':
          lx = -el.labelW / 2;
          ly = arrowH + gap;
          break;
        case 'left':
          lx = arrowH + gap;
          ly = -el.labelH / 2;
          break;
        default:
          lx = -arrowH - gap - el.labelW;
          ly = -el.labelH / 2;
      }
      // keep the label inside the screen even when the arrow is pinned at a corner
      lx = Math.min(Math.max(lx, 4 - ax), view.w - 4 - el.labelW - ax);
      const tf = `translate(${ax}px, ${ay}px)`;
      if (tf !== el.transform) {
        el.transform = tf;
        el.root.style.transform = tf;
      }
      if (el.dir !== pin.dir) {
        el.dir = pin.dir;
        el.arrow.style.transform = rot ? `rotate(${rot}deg)` : '';
      }
      el.label.style.left = px(Math.round(lx));
      el.label.style.top = px(Math.round(ly));
      el.arrow.style.marginLeft = px(-arrowW / 2);
      el.arrow.style.marginTop = px(-arrowH);
    }
  }

  private cssPx(name: string, fallback: number): number {
    const v = parseFloat(this.root.style.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  /** ?debug=art: print the missing sprite key on each placeholder (CSS px positions). */
  updateArtKeys(items: readonly { key: string; x: number; y: number }[]): void {
    const seen = new Map(items.map((i) => [i.key, i]));
    for (const k of diffIds(this.artKeys.keys(), seen.keys()).remove) {
      this.artKeys.get(k)?.remove();
      this.artKeys.delete(k);
    }
    for (const it of items) {
      let el = this.artKeys.get(it.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'wl-art-key';
        el.textContent = it.key.replace(/[#@].*$/, '');
        this.artKeys.set(it.key, el);
        this.root.appendChild(el);
      }
      el.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px)`;
    }
  }

  destroy(): void {
    this.root.remove();
    this.stacks.clear();
    this.guides.clear();
  }
}
