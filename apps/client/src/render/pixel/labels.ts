/**
 * DOM overlay of the pixel view (HOWTO D8, §5.9): nameplates, speech bubbles and tutorial guides are HTML positioned over the canvas,
 * so text stays crisp at every zoom and accents render. One `#world-labels` layer with `pointer-events: none`; elements are created once
 * per key and only moved (transform: translate, whole CSS px) each frame; a bubble line or a guide is rewritten only when its text changes.
 *
 *  - Nameplates: Verde plate for players (or the colour and shape they earned in the escola), terracotta for NPCs, a mustard ring on yourself,
 *    stepped pixel corners (pixel.css).
 *  - Speech bubbles: the art track 2 9-slice bubble (`ui/bubble`, slice and file from the manifest's `images`), 2x. The tail is bottom-left;
 *    when the speaker is in the right half of the screen a mirrored copy (tail bottom-right) is used so the bubble opens toward the middle.
 *  - Guides: the bouncing pixel arrow (`ui/guide_arrow_strip`, a CSS steps animation over its 4 frames) with a small label. Off-screen
 *    targets pin the arrow to the nearest edge of the free screen region and turn it toward the target (`guides.ts`).
 */
import './pixel.css';
import { BUBBLE_STYLES, FOUNDER_BADGE, tierRule, type BubbleStyle, type Nameplate } from '@tudobem/shared';
import { diffIds } from './reconcile';
import { GUIDE_ROTATION, pinGuide, type GuideDir, type GuideInsets } from './guides';

export interface BubbleItem {
  text: string;
  gloss: string | null;
  /** 0..1 */
  alpha: number;
  /** Appearance only. Classic (or omitted) is the free bubble. The text is never derived from this. */
  style?: BubbleStyle;
}

export interface StackItem {
  key: string;
  /** CSS px of the point the stack stands on (just above the head) */
  x: number;
  y: number;
  plate: {
    text: string;
    /** `sign`: a shop name chalked on a board (a player-owned padaria), not a person. */
    kind: 'npc' | 'player' | 'me' | 'sign';
    /** false: keep the element but fade it out (a CPU far from you) */
    show?: boolean;
    /** Academy stamp glyph, members only. */
    mark?: string;
    /** Beta founder “f” mark beside the nameplate. */
    founder?: boolean;
    /** Subscription founder badge. A separate mark; it does not change the plate tier. */
    subBadge?: boolean;
    /** Live Fada da Feira crown. A display overlay only — not a tier, belt or stripe. */
    feiraCrown?: boolean;
    /** Players: the nameplate colour earned in the escola (verde is the plain plate; the others add their colour and shape). */
    tier?: Nameplate;
  } | null;
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

/** The HUD pieces a world label must never sit under (a bubble half hidden by the tracker looks clipped): the plates, the tracker, toasts, the chat bar. */
const HUD_SELECTOR = '.hud-slab, .rtrack, #mission-pill, #cartela-pill, .toast, .chatbar, .hud-chip';
/** True when `r` touches any of `hud` (pure; viewport px). */
export const underHud = (r: Rect, hud: readonly Rect[]): boolean => hud.some((h) => overlaps(r, h));
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
  plateRow: HTMLElement;
  plate: HTMLElement;
  founder: HTMLElement;
  subBadge: HTMLElement;
  crown: HTMLElement;
  bubbles: BubbleEl[];
  side: 'left' | 'right';
  plateKey: string;
  plateW: number;
  plateH: number;
  transform: string;
  hidden: boolean;
  /** true while a part of the stack would sit under the HUD (then the whole stack is not drawn) */
  occluded: boolean;
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
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--wl-bubble', `url("${url}")`);
      rootStyle.setProperty('--wl-bubble-slice', `${s.top} ${s.right} ${s.bottom} ${s.left}`);
      rootStyle.setProperty('--wl-bubble-width', `${px(s.top * k)} ${px(s.right * k)} ${px(s.bottom * k)} ${px(s.left * k)}`);
      void mirrorImage(url)
        .then((m) => {
          this.root.style.setProperty('--wl-bubble-m', `url("${m}")`);
          rootStyle.setProperty('--wl-bubble-m', `url("${m}")`);
        })
        .catch(() => undefined);
      for (const style of BUBBLE_STYLES) {
        if (style === 'classic') continue;
        const skin = art.images[`ui/bubble_${style}`];
        if (!skin?.file) continue;
        const skinUrl = art.base + skin.file;
        st.setProperty(`--wl-bubble-${style}`, `url("${skinUrl}")`);
        rootStyle.setProperty(`--wl-bubble-${style}`, `url("${skinUrl}")`);
        void mirrorImage(skinUrl)
          .then((m) => {
            this.root.style.setProperty(`--wl-bubble-${style}-m`, `url("${m}")`);
            rootStyle.setProperty(`--wl-bubble-${style}-m`, `url("${m}")`);
          })
          .catch(() => undefined);
      }
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
    this.hideUnderHud();
  }

  private hudRects: Rect[] = [];
  private hudAt = -1e9;

  /** A stack whose plate or bubbles overlap a HUD box is hidden whole (never half under the HUD); it returns once it clears. */
  private hideUnderHud(): void {
    if (typeof document === 'undefined') return;
    const now = performance.now();
    if (now - this.hudAt > 250) {
      this.hudAt = now;
      this.hudRects = [...document.querySelectorAll(HUD_SELECTOR)]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom }));
    }
    for (const el of this.stacks.values()) {
      if (el.hidden) continue;
      let under = false;
      if (this.hudRects.length) {
        for (const part of [el.plateRow, ...el.bubbles.map((b) => b.root)]) {
          if (part.style.display === 'none') continue;
          const r = part.getBoundingClientRect();
          if (r.width && underHud({ l: r.left, r: r.right, t: r.top, b: r.bottom }, this.hudRects)) {
            under = true;
            break;
          }
        }
      }
      if (under !== el.occluded) {
        el.occluded = under;
        el.root.style.visibility = under ? 'hidden' : '';
      }
    }
  }

  // ------------------------------------------------------------------ stacks (nameplate + bubbles)
  private createStack(): StackEl {
    const root = document.createElement('div');
    root.className = 'wl-stack';
    const plateRow = document.createElement('div');
    plateRow.className = 'wl-plate-row';
    const plate = document.createElement('div');
    plate.className = 'wl-plate';
    const founder = document.createElement('span');
    founder.className = 'wl-founder';
    founder.style.display = 'none';
    const subBadge = document.createElement('span');
    subBadge.className = 'wl-sub-badge';
    subBadge.style.display = 'none';
    const crown = document.createElement('i');
    crown.className = 'wl-feira-crown';
    crown.style.display = 'none';
    crown.setAttribute('aria-hidden', 'true');
    plateRow.append(crown, plate, subBadge, founder);
    root.appendChild(plateRow);
    return { root, plateRow, plate, founder, subBadge, crown, bubbles: [], side: 'left', plateKey: '', plateW: 0, plateH: 0, transform: '', hidden: false, occluded: false, baseBottoms: [], plateBottom: '' };
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
      el.plateRow.style.bottom = pb;
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
    const tier = s.plate && (s.plate.kind === 'player' || s.plate.kind === 'me') && s.plate.tier && s.plate.tier !== 'verde' ? s.plate.tier : null;
    const pk = s.plate ? `${s.plate.kind}|${s.plate.text}|${s.plate.mark ?? ''}|${s.plate.founder ? '1' : ''}|${s.plate.subBadge ? 'b' : ''}|${s.plate.feiraCrown ? 'c' : ''}|${tier ?? ''}` : '';
    if (pk !== el.plateKey) {
      el.plateKey = pk;
      if (s.plate) {
        el.plateRow.style.display = '';
        el.plate.style.display = '';
        el.plate.textContent = s.plate.text;
        el.plate.className = `wl-plate wl-plate-${s.plate.kind}${tier ? ` wl-tier wl-tier-${tier}` : ''}`;
        el.plate.replaceChildren();
        if (tier) {
          // the colour and a shape (sun, drop, star, crown): readable without telling colours apart
          const ico = document.createElement('i');
          ico.className = `wl-tier-ico tier-ico tier-ico-${tier}`;
          ico.setAttribute('aria-hidden', 'true');
          el.plate.append(ico);
          el.plate.title = `Placa ${tierRule(tier).pt}`;
        } else el.plate.removeAttribute('title');
        if (s.plate.mark) {
          const mark = document.createElement('i');
          mark.className = 'wl-mark';
          mark.textContent = s.plate.mark;
          mark.setAttribute('aria-hidden', 'true');
          el.plate.append(mark, document.createTextNode(s.plate.text));
        } else {
          el.plate.append(document.createTextNode(s.plate.text));
        }
        if (s.plate.feiraCrown) {
          el.crown.style.display = '';
          el.crown.title = 'Fada da Feira';
        } else {
          el.crown.style.display = 'none';
          el.crown.removeAttribute('title');
        }
        if (s.plate.founder) {
          el.founder.style.display = '';
          el.founder.textContent = 'f';
          el.founder.setAttribute('role', 'img');
          const founderTip = `${FOUNDER_BADGE.pt} · ${FOUNDER_BADGE.en}`;
          el.founder.setAttribute('aria-label', founderTip);
          el.founder.setAttribute('title', founderTip);
        } else {
          el.founder.style.display = 'none';
          el.founder.replaceChildren();
        }
        if (s.plate.subBadge) {
          el.subBadge.style.display = '';
          el.subBadge.setAttribute('role', 'img');
          el.subBadge.setAttribute('aria-label', 'Fundador · Founder');
          el.subBadge.setAttribute('title', 'Fundador · Founder');
        } else {
          el.subBadge.style.display = 'none';
          el.subBadge.removeAttribute('aria-label');
        }
        const w = el.plateRow.offsetWidth;
        el.plateW = w % 2 ? w + 1 : w;
        el.plateH = el.plateRow.offsetHeight;
        el.plateRow.style.marginLeft = px(-el.plateW / 2);
      } else {
        el.plateRow.style.display = 'none';
        el.plateW = 0;
        el.plateH = 0;
      }
    }

    const plateOn = !!s.plate && s.plate.show !== false;
    if (plateOn === el.plateRow.classList.contains('wl-plate-off')) el.plateRow.classList.toggle('wl-plate-off', !plateOn);

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
      const style = b.style && b.style !== 'classic' ? b.style : 'classic';
      const cls = style === 'classic' ? 'wl-bubble' : `wl-bubble wl-style-${style}`;
      if (be.root.className !== cls) {
        be.root.className = cls;
        remeasure = true;
      }
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
    return { key: s.key, ax, ay, plate: plateOn ? { w: el.plateW, h: el.plateH } : null, bubbles: el.bubbles.map((be, i) => ({ left: lefts[i] ?? 0, w: be.w, h: be.h })) };
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
