/**
 * DOM overlay of the pixel view (HOWTO D8, §5.9): nameplates, speech bubbles and tutorial guides are HTML positioned over the canvas,
 * so text stays crisp at every zoom and accents render. One `#world-labels` layer with `pointer-events: none`; elements are created
 * once per key and only moved (transform: translate, rounded to whole CSS px) each frame. Phase 4 polishes the look.
 *
 * Same visual language as the style frame's labels (`frame/labels.ts`): Verde plate for players, terracotta for NPCs, mustard ring on
 * yourself, cream bubbles with the PT line and the EN gloss underneath.
 */
import './pixel.css';
import { diffIds } from './reconcile';

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
  x: number;
  y: number;
  label: string;
}

interface StackEl {
  root: HTMLElement;
  bubbles: HTMLElement;
  plate: HTMLElement;
  sig: string;
  bubbleEls: HTMLElement[];
}

const bubbleSig = (bs: BubbleItem[]) => bs.map((b) => `${b.text}\u0001${b.gloss ?? ''}`).join('\u0002');

export class LabelLayer {
  readonly root: HTMLElement;
  private stacks = new Map<string, StackEl>();
  private guides = new Map<string, HTMLElement>();
  private artKeys = new Map<string, HTMLElement>();

  constructor(after: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'world-labels';
    this.root.setAttribute('aria-hidden', 'true');
    after.after(this.root);
  }

  /** Reposition every label for this frame and drop the ones whose owner is gone. */
  update(stacks: readonly StackItem[], guides: readonly GuideItem[], view: { w: number; h: number }): void {
    const seen = new Map(stacks.map((s) => [s.key, s]));
    const d = diffIds(this.stacks.keys(), seen.keys());
    for (const k of d.remove) {
      this.stacks.get(k)?.root.remove();
      this.stacks.delete(k);
    }
    for (const s of stacks) {
      let el = this.stacks.get(s.key);
      if (!el) {
        el = this.createStack();
        this.stacks.set(s.key, el);
        this.root.appendChild(el.root);
      }
      this.updateStack(el, s, view);
    }
    this.updateGuides(guides, view);
  }

  private createStack(): StackEl {
    const root = document.createElement('div');
    root.className = 'wl-stack';
    const bubbles = document.createElement('div');
    bubbles.className = 'wl-bubbles';
    const plate = document.createElement('div');
    plate.className = 'wl-plate';
    root.append(bubbles, plate);
    return { root, bubbles, plate, sig: '', bubbleEls: [] };
  }

  private updateStack(el: StackEl, s: StackItem, view: { w: number; h: number }): void {
    const on = s.x > -60 && s.x < view.w + 60 && s.y > -10 && s.y < view.h + 90;
    el.root.style.display = on ? '' : 'none';
    if (!on) return;
    if (s.plate) {
      el.plate.style.display = '';
      if (el.plate.textContent !== s.plate.text) el.plate.textContent = s.plate.text;
      const cls = `wl-plate wl-plate-${s.plate.kind}`;
      if (el.plate.className !== cls) el.plate.className = cls;
    } else el.plate.style.display = 'none';
    const sig = bubbleSig(s.bubbles);
    if (sig !== el.sig) {
      el.sig = sig;
      el.bubbles.replaceChildren();
      el.bubbleEls = s.bubbles.map((b) => {
        const be = document.createElement('div');
        be.className = 'wl-bubble';
        const pt = document.createElement('div');
        pt.className = 'pt';
        pt.textContent = b.text;
        be.appendChild(pt);
        if (b.gloss) {
          const en = document.createElement('div');
          en.className = 'en';
          en.textContent = b.gloss;
          be.appendChild(en);
        }
        el.bubbles.appendChild(be);
        return be;
      });
    }
    s.bubbles.forEach((b, i) => {
      const be = el.bubbleEls[i];
      if (be) be.style.opacity = String(Math.max(0, Math.min(1, b.alpha)));
    });
    // keep partly visible stacks inside the screen instead of cutting them off at the edge
    const half = el.root.offsetWidth / 2;
    const x = Math.round(Math.min(Math.max(s.x, half + 4), Math.max(half + 4, view.w - half - 4)));
    el.root.style.transform = `translate(${x}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
  }

  private updateGuides(items: readonly GuideItem[], view: { w: number; h: number }): void {
    const seen = new Map(items.map((g) => [g.key, g]));
    const d = diffIds(this.guides.keys(), seen.keys());
    for (const k of d.remove) {
      this.guides.get(k)?.remove();
      this.guides.delete(k);
    }
    for (const g of items) {
      let el = this.guides.get(g.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'wl-guide';
        const inner = document.createElement('div');
        inner.className = 'wl-guide-in';
        el.appendChild(inner);
        this.guides.set(g.key, el);
        this.root.appendChild(el);
      }
      const inner = el.firstElementChild as HTMLElement;
      // off-screen targets pin the arrow to the nearest screen edge, pointing toward the target
      const padX = 26;
      const top = 76;
      const bottom = 130;
      const cx = Math.min(view.w - padX, Math.max(padX, g.x));
      const cy = Math.min(view.h - bottom, Math.max(top, g.y));
      const off = cx !== g.x || cy !== g.y;
      const arrow = !off ? '▼' : Math.abs(g.x - cx) > Math.abs(g.y - cy) ? (g.x < cx ? '◀' : '▶') : g.y < cy ? '▲' : '▼';
      const text = `${g.label} ${arrow}`;
      if (inner.textContent !== text) inner.textContent = text;
      el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px) translate(-50%, -100%)`;
    }
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
