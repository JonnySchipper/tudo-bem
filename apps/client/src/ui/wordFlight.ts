/**
 * A word flying across the screen: it lifts off where it was read and travels on an arc, leaving sparkles, to wherever `target` says
 * (read every frame, so a card still popping in is followed). Used by the new-word card when the word came from a line of dialogue.
 */
import { h, ui } from './dom';

/** Where a word was on screen when it was learned, and how it was written there. */
export interface WordSource {
  rect: DOMRect;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  /** performance.now() when it was measured: an old position is not flown from */
  at: number;
}

export const LIFT_MS = 300;
export const FLY_MS = 820;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function spark(x: number, y: number, i: number) {
  const s = h('i', { class: 'heard-spark', 'aria-hidden': 'true', style: `left:${x}px;top:${y}px;--dx:${((i * 37) % 21) - 10}px;--dy:${((i * 53) % 17) - 4}px` });
  if (i % 3 === 0) s.classList.add('star');
  ui().append(s);
  window.setTimeout(() => s.remove(), 700);
}

/**
 * Fly `src` to the centre of `target()`, growing to `targetSize` px of type on the way. `arrive` runs when it lands (the chip is gone).
 * Returns the chip so a caller can drop it early.
 */
export function flyWord(src: WordSource, target: () => DOMRect | null, targetSize: () => number, arrive: () => void): HTMLElement {
  const { rect } = src;
  const sx = rect.left + rect.width / 2;
  const sy = rect.top + rect.height / 2;
  const chip = h('span', { class: 'heard-chip', lang: 'pt-BR', 'aria-hidden': 'true' }, src.text);
  Object.assign(chip.style, {
    left: `${sx}px`,
    top: `${sy}px`,
    fontFamily: src.fontFamily,
    fontSize: `${src.fontSize}px`,
    fontWeight: src.fontWeight,
    lineHeight: `${rect.height}px`,
  });
  ui().append(chip);
  const ay = sy - 18;
  const t0 = performance.now();
  let n = 0;
  const frame = (now: number) => {
    if (!chip.isConnected) return;
    const t = now - t0;
    if (t < LIFT_MS) {
      const k = easeOut(t / LIFT_MS);
      chip.style.top = `${sy - 18 * k}px`;
      chip.style.transform = `translate(-50%, -50%) scale(${1 + 0.2 * k}) rotate(${-4 * k}deg)`;
      requestAnimationFrame(frame);
      return;
    }
    const u = Math.min(1, (t - LIFT_MS) / FLY_MS);
    const k = easeInOut(u);
    const tr = target();
    const tx = tr ? tr.left + tr.width / 2 : sx;
    const ty = tr ? tr.top + tr.height / 2 : ay - 200;
    // the arc rises above the higher end and swings out to the side, so the word visibly travels
    const side = tx >= sx ? 1 : -1;
    const cx = (sx + tx) / 2 - side * Math.max(60, Math.min(180, Math.abs(tx - sx) * 0.3));
    const cy = Math.min(ay, ty) - Math.max(80, Math.abs(ty - ay) * 0.25);
    const x = (1 - k) ** 2 * sx + 2 * (1 - k) * k * cx + k ** 2 * tx;
    const y = (1 - k) ** 2 * ay + 2 * (1 - k) * k * cy + k ** 2 * ty;
    const grow = targetSize() / src.fontSize;
    const scale = 1.2 + (grow - 1.2) * k;
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    chip.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${-4 + 4 * k + Math.sin(k * Math.PI) * 8 * side}deg)`;
    if (u < 0.92 && n++ % 2 === 0) spark(x, y, n);
    if (u < 1) {
      requestAnimationFrame(frame);
      return;
    }
    chip.remove();
    arrive();
  };
  requestAnimationFrame(frame);
  return chip;
}
