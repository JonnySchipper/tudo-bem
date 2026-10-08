/**
 * A word learned in conversation is taken from the line the player is reading in the bottom dialogue box: a marker sweeps under the word,
 * then the word lifts off and flies into the new-word card, landing as its big word. Closing the card files it into the Diário.
 * Speech bubbles over heads are never flown from (neighbours chatting on their own teach nothing). If the word is not on screen, the plain
 * new-word card shows on its own. The camera keeps that plain card: a photo has no written word.
 */
import { h, ui } from './dom';
import { celebrateWord } from './diaryPanel';
import type { WordMoment } from './diaryWordQueue';
import { findWordIndex, lineForms } from './heardWordMatch';
import type { WordSource } from './wordFlight';

/** Portuguese lines in the dialogue box. Speech bubbles over heads are never flown from. */
const LINE_ROOTS = ['.dbx .line-bubble .pt'];
/** How long before giving up and showing the plain card. */
const FIND_MS = 3500;
const MARK_MS = 900;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function hiddenText(node: Node, root: Element): boolean {
  for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
    if (el.getAttribute('aria-hidden') === 'true' || el.classList.contains('en') || el.classList.contains('tw-rest')) return true;
  }
  return false;
}

/** Drawn and readable, and inside the window. */
function onScreen(rect: DOMRect, el: Element | null): boolean {
  if (!el || rect.width <= 0 || rect.height <= 0) return false;
  if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
  if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  for (let e: Element | null = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.35) return false;
  return true;
}

/** The word inside `root`, or null. Text is re-read every time: the typewriter replaces its text node on each tick. */
function locateIn(root: Element, forms: readonly string[]): WordSource | null {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n as Text;
    if (hiddenText(t, root)) continue;
    for (const f of forms) {
      const i = findWordIndex(t.data, f);
      if (i < 0) continue;
      const range = document.createRange();
      range.setStart(t, i);
      range.setEnd(t, i + f.length);
      const rect = range.getBoundingClientRect();
      if (!onScreen(rect, t.parentElement)) continue;
      const cs = getComputedStyle(t.parentElement ?? root);
      return {
        rect,
        text: t.data.slice(i, i + f.length),
        fontFamily: cs.fontFamily,
        fontSize: parseFloat(cs.fontSize) || 16,
        fontWeight: cs.fontWeight,
        at: performance.now(),
      };
    }
  }
  return null;
}

function locate(forms: readonly string[]): { root: Element; spot: WordSource } | null {
  for (const sel of LINE_ROOTS) {
    for (const root of document.querySelectorAll(sel)) {
      const spot = locateIn(root, forms);
      if (spot) return { root, spot };
    }
  }
  return null;
}

/** The marker sweeps under the word in the line (following it while the box settles), then the word flies into the card. */
function highlight(root: Element, first: WordSource, forms: readonly string[], m: WordMoment) {
  const mark = h('i', { class: 'heard-mark', 'aria-hidden': 'true' });
  ui().append(mark);
  let spot = first;
  const place = (r: DOMRect) => {
    mark.style.left = `${r.left - 4}px`;
    mark.style.top = `${r.top - 1}px`;
    mark.style.width = `${r.width + 8}px`;
    mark.style.height = `${r.height + 2}px`;
  };
  place(spot.rect);
  const t0 = performance.now();
  const follow = (now: number) => {
    const again = root.isConnected ? locateIn(root, forms) : null;
    if (again) {
      spot = again;
      place(spot.rect);
    }
    if (now - t0 < MARK_MS) {
      requestAnimationFrame(follow);
      return;
    }
    // the marker stays a moment under the gap the word leaves, then fades
    window.setTimeout(() => {
      mark.classList.add('leaving');
      window.setTimeout(() => mark.remove(), 300);
    }, 500);
    celebrateWord(reduceMotion() ? m : { ...m, from: { ...spot, at: performance.now() } });
  };
  requestAnimationFrame(follow);
}

/** A word heard in a line reached the diary: show it coming out of the dialogue box into the card. */
export function flyHeardWord(m: WordMoment) {
  const forms = lineForms(m.pt);
  const t0 = performance.now();
  const look = () => {
    const found = locate(forms);
    if (found) return highlight(found.root, found.spot, forms, m);
    if (performance.now() - t0 > FIND_MS) return celebrateWord(m);
    window.setTimeout(look, 100);
  };
  look();
}
