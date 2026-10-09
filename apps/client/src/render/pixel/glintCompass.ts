/**
 * Arrows at the screen edge that point to the stars (unread reading words) the camera does not show: a small gold star with a chevron,
 * sitting on the edge of the play area on the line from the middle of the screen to the star, bobbing toward it. A DOM layer like
 * `labels.ts`, fed every frame by WorldScene with the stars' positions in CSS px.
 */
import type { Insets } from './coords';

export interface EdgeMark {
  x: number;
  y: number;
  /** radians, the direction from the mark to the star */
  angle: number;
}

/** Margin (CSS px) between the arrows and the edge of the play area. */
const EDGE = 26;

/**
 * Where the arrow for a star at `p` sits: null while the star is on screen (inside the play area less the HUD insets), else the point
 * where the line from the middle of the play area to the star crosses its edge (pulled in by `EDGE`).
 */
export function edgeMark(p: { x: number; y: number }, view: { w: number; h: number }, ins: Insets): EdgeMark | null {
  const x0 = ins.left + EDGE;
  const x1 = view.w - ins.right - EDGE;
  const y0 = ins.top + EDGE;
  const y1 = view.h - ins.bottom - EDGE;
  if (x1 <= x0 || y1 <= y0) return null;
  // on screen with a little slack: the star itself is the cue
  if (p.x >= ins.left && p.x <= view.w - ins.right && p.y >= ins.top && p.y <= view.h - ins.bottom) return null;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const angle = Math.atan2(dy, dx);
  const sx = dx === 0 ? Infinity : (dx > 0 ? x1 - cx : x0 - cx) / dx;
  const sy = dy === 0 ? Infinity : (dy > 0 ? y1 - cy : y0 - cy) / dy;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s, angle };
}

export class GlintCompass {
  private readonly root: HTMLElement;
  private readonly marks = new Map<string, HTMLElement>();
  private shown = 0;

  constructor(
    after: HTMLElement,
    private readonly insets: () => Insets,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'glint-compass';
    this.root.setAttribute('aria-hidden', 'true');
    after.after(this.root);
  }

  /** The stars of the room this player has not read, in CSS px relative to the canvas (on screen or not). */
  update(stars: readonly { key: string; x: number; y: number }[]): void {
    if (!stars.length && !this.shown) return;
    const view = { w: window.innerWidth, h: window.innerHeight };
    const ins = this.insets();
    const live = new Set<string>();
    for (const s of stars) {
      const m = edgeMark(s, view, ins);
      if (!m) continue;
      live.add(s.key);
      let el = this.marks.get(s.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'glint-mark';
        const arrow = document.createElement('i');
        arrow.className = 'glint-mark-arrow';
        const star = document.createElement('b');
        star.className = 'glint-mark-star';
        el.append(arrow, star);
        this.root.append(el);
        this.marks.set(s.key, el);
      }
      el.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
      el.style.setProperty('--a', `${m.angle.toFixed(3)}rad`);
    }
    for (const [key, el] of this.marks) {
      if (live.has(key)) continue;
      el.remove();
      this.marks.delete(key);
    }
    this.shown = this.marks.size;
  }
}
