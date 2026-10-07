/**
 * HUD layout glue (V4): the few numbers CSS cannot know. It measures the top bar and the pills that hang under it and writes
 *  - `--hud-bottom`: where the top bar ends (the tracker sits just under it),
 *  - `--toast-top`: where the toast stack starts so it never covers the tracker or the mission chip.
 * Everything else is plain CSS (`styles/hud.css`). Pure helpers are exported for the tests.
 */

/** The phone layout: a narrow portrait screen, or a landscape phone (short). Keep in step with styles/hud.css. */
export const COMPACT_QUERY = '(max-width: 640px), (max-height: 520px)';

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Where the toast stack starts: under the top bar and, when they share its column, under the pills that hang below it. */
export function toastTop(bar: Box | null, below: readonly (Box | null)[], gap = 8): number {
  let y = bar ? bar.bottom : 0;
  for (const b of below) if (b && b.bottom > y) y = b.bottom;
  return Math.round(y + gap);
}

let raf = 0;
const watched = new WeakSet<Element>();
let ro: ResizeObserver | null = null;

const rectOf = (el: Element | null): Box | null => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
};

function apply(): void {
  const root = document.documentElement;
  const bar = document.getElementById('hud-top');
  if (!bar) return;
  const left = rectOf(bar.querySelector('.hud-left'));
  const stats = rectOf(bar.querySelector('.hud-right'));
  const barBox: Box | null = left || stats ? { top: Math.min(left?.top ?? 1e9, stats?.top ?? 1e9), bottom: Math.max(left?.bottom ?? 0, stats?.bottom ?? 0), left: left?.left ?? 0, right: stats?.right ?? 0 } : null;
  if (barBox) root.style.setProperty('--hud-bottom', `${Math.round(barBox.bottom + 5)}px`);
  const compact = window.matchMedia(COMPACT_QUERY).matches;
  // the recado tracker, or the airport tutorial card that takes its place in the airport
  const tracker = [...document.querySelectorAll<HTMLElement>('.rtrack')].map(rectOf).find((r) => r) ?? null;
  const mission = rectOf(document.getElementById('mission-pill'));
  const cartela = rectOf(document.getElementById('cartela-pill'));
  // desktop: the tracker is on the other side of the screen from the toasts; on a phone they share the column
  root.style.setProperty('--toast-top', `${toastTop(barBox ? { ...barBox, bottom: barBox.bottom + 5 } : null, compact ? [tracker, mission, cartela] : [mission, cartela])}px`);
  if (typeof ResizeObserver !== 'undefined') {
    ro ??= new ResizeObserver(() => placeHud());
    for (const el of [bar, ...document.querySelectorAll('.rtrack'), document.getElementById('mission-pill'), document.getElementById('cartela-pill')]) {
      if (el && !watched.has(el)) {
        watched.add(el);
        ro.observe(el);
      }
    }
  }
}

/** Re-measure on the next frame (cheap to call from anywhere). */
export function placeHud(): void {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    apply();
  });
}

if (typeof window !== 'undefined') window.addEventListener('resize', placeHud);
