/**
 * A word learned in conversation is taken from the line itself: the word lights up where it was said (a marker sweeps under it in the
 * dialogue box or the speech bubble), lifts off the line and flies along an arc into the Diário, which bumps and says what came in.
 * The camera keeps its card: a photo has no written word to point at. When the line is not on screen (the box closed, a bubble faded)
 * the word gets that same card instead. Nothing here takes the pointer.
 */
import { ambience } from '../ambience';
import { h, en, ui } from './dom';
import { celebrateWord } from './diaryPanel';
import type { WordMoment } from './diaryWordQueue';
import { findWordIndex, lineForms } from './heardWordMatch';

/** Where a heard line can be on screen, most specific first: the dialogue box, a neighbour's bubble, then any open panel. */
const LINE_ROOTS = ['#heard-quote .heard-line', '.dbx .line-bubble .pt', '.wl-bubble .pt', '[data-modal]', '[role="dialog"]'];
/** How long to wait for the word to be typed out (the typewriter) before giving up and showing the card. */
const FIND_MS = 3500;
/** How long to look for the line itself before echoing it (its bubble may sit under the HUD). */
const ECHO_MS = 900;
/** A line said this long ago can still be echoed. */
const RECENT_MS = 8000;
const MARK_MS = 1050;
const LIFT_MS = 280;
const FLY_MS = 900;
const LANDED_MS = 2600;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function hiddenText(node: Node, root: Element): boolean {
  for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
    if (el.getAttribute('aria-hidden') === 'true' || el.classList.contains('en') || el.classList.contains('tw-rest')) return true;
  }
  return false;
}

/** Drawn and readable: not hidden or faded out (a bubble under the HUD is kept in the page but hidden), and inside the window. */
function onScreen(rect: DOMRect, el: Element | null): boolean {
  if (!el || rect.width <= 0 || rect.height <= 0) return false;
  if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
  if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  for (let e: Element | null = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.35) return false;
  return true;
}

interface Spot {
  rect: DOMRect;
  text: string;
  font: Element;
}

/** The word inside `root`, or null. Text is re-read every time: the typewriter replaces its text node on each tick. */
function locateIn(root: Element, forms: readonly string[]): Spot | null {
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
      if (onScreen(rect, t.parentElement)) return { rect, text: t.data.slice(i, i + f.length), font: t.parentElement ?? root };
    }
  }
  return null;
}

function locate(forms: readonly string[]): { root: Element; spot: Spot } | null {
  for (const sel of LINE_ROOTS) {
    for (const root of document.querySelectorAll(sel)) {
      const spot = locateIn(root, forms);
      if (spot) return { root, spot };
    }
  }
  return null;
}

/** Lines neighbours said lately (speech bubbles), so a word can be shown in its line even when the bubble is off screen. */
const recent: { speaker: string; text: string; at: number }[] = [];

export function noteLine(speaker: string, text: string) {
  recent.push({ speaker, text, at: performance.now() });
  if (recent.length > 8) recent.shift();
}

/** The line, quoted over the world for a moment: the word is marked in it and flies from there. */
function echo(forms: readonly string[]): boolean {
  const now = performance.now();
  const line = [...recent].reverse().find((l) => now - l.at < RECENT_MS && forms.some((f) => findWordIndex(l.text, f) >= 0));
  if (!line) return false;
  document.getElementById('heard-quote')?.remove();
  const quote = h(
    'div',
    { id: 'heard-quote', 'aria-hidden': 'true' },
    h('b', { class: 'heard-who' }, line.speaker),
    h('span', { class: 'heard-line', lang: 'pt-BR' }, `“${line.text}”`),
  );
  ui().append(quote);
  window.setTimeout(() => {
    quote.classList.add('leaving');
    window.setTimeout(() => quote.remove(), 320);
  }, MARK_MS + LIFT_MS + 500);
  return true;
}

function diaryTarget(): HTMLElement | null {
  for (const id of ['btn-caderno', 'btn-burger']) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

function bump(target: HTMLElement) {
  target.classList.remove('bump');
  void target.offsetWidth;
  target.classList.add('bump');
  window.setTimeout(() => target.classList.remove('bump'), 500);
}

/** The small note next to the Diário once the word is in: what it means and how far along its area is. */
function landed(m: WordMoment, target: HTMLElement | null) {
  document.getElementById('heard-landed')?.remove();
  const note = h(
    'div',
    { id: 'heard-landed', role: 'status' },
    h('span', { class: 'heard-kicker' }, 'No diário'),
    h('b', { class: 'heard-pt', lang: 'pt-BR' }, m.pt),
    en(m.en),
    m.progress ? h('span', { class: 'heard-progress' }, `${m.areaPt ?? ''}: ${m.progress}`) : null,
  );
  ui().append(note);
  const w = note.offsetWidth;
  const hgt = note.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = vw / 2 - w / 2;
  let y = 72;
  if (target) {
    const r = target.getBoundingClientRect();
    const below = r.top + r.height / 2 < vh / 2;
    x = r.left + r.width / 2 - w / 2;
    y = below ? r.bottom + 12 : r.top - hgt - 12;
    note.classList.add(below ? 'below' : 'above');
    note.style.setProperty('--tip', `${Math.round(r.left + r.width / 2 - Math.max(8, Math.min(vw - w - 8, x)))}px`);
  }
  note.style.left = `${Math.round(Math.max(8, Math.min(vw - w - 8, x)))}px`;
  note.style.top = `${Math.round(Math.max(8, Math.min(vh - hgt - 8, y)))}px`;
  window.setTimeout(() => {
    note.classList.add('leaving');
    window.setTimeout(() => note.remove(), 320);
  }, LANDED_MS);
}

/** A sparkle left behind by the flying word. */
function spark(x: number, y: number, i: number) {
  const s = h('i', { class: 'heard-spark', 'aria-hidden': 'true', style: `left:${x}px;top:${y}px;--dx:${((i * 37) % 21) - 10}px;--dy:${((i * 53) % 17) - 4}px` });
  if (i % 3 === 0) s.classList.add('star');
  ui().append(s);
  window.setTimeout(() => s.remove(), 700);
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** The word lifts off its line and flies on an arc into the Diário. */
function fly(spot: Spot, m: WordMoment) {
  const target = diaryTarget();
  const { rect } = spot;
  const cs = getComputedStyle(spot.font);
  const chip = h('span', { class: 'heard-chip', lang: 'pt-BR', 'aria-hidden': 'true' }, spot.text);
  const sx = rect.left + rect.width / 2;
  const sy = rect.top + rect.height / 2;
  Object.assign(chip.style, {
    left: `${sx}px`,
    top: `${sy}px`,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: `${rect.height}px`,
  });
  ui().append(chip);
  const tr = target?.getBoundingClientRect();
  const tx = tr ? tr.left + tr.width / 2 : sx;
  const ty = tr ? tr.top + tr.height / 2 : 40;
  const ay = sy - 16;
  // the arc rises above the higher of the two ends and swings out sideways, so the word visibly travels
  const side = tx > sx ? 1 : -1;
  const cx = (sx + tx) / 2 - side * Math.min(160, Math.abs(tx - sx) * 0.25);
  const cy = Math.min(ay, ty) - Math.max(90, Math.abs(tx - sx) * 0.18);
  const t0 = performance.now();
  let n = 0;
  const frame = (now: number) => {
    const t = now - t0;
    if (t < LIFT_MS) {
      const k = easeOut(t / LIFT_MS);
      chip.style.top = `${sy - 16 * k}px`;
      chip.style.transform = `translate(-50%, -50%) scale(${1 + 0.25 * k}) rotate(${-3 * k}deg)`;
      requestAnimationFrame(frame);
      return;
    }
    const u = Math.min(1, (t - LIFT_MS) / FLY_MS);
    const k = easeInOut(u);
    const x = (1 - k) ** 2 * sx + 2 * (1 - k) * k * cx + k ** 2 * tx;
    const y = (1 - k) ** 2 * ay + 2 * (1 - k) * k * cy + k ** 2 * ty;
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    chip.style.transform = `translate(-50%, -50%) scale(${1.25 - k}) rotate(${-3 + 18 * k * side}deg)`;
    chip.style.opacity = String(u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
    if (u < 0.96 && n++ % 2 === 0) spark(x, y, n);
    if (u < 1) {
      requestAnimationFrame(frame);
      return;
    }
    chip.remove();
    ambience.sting('caderno');
    if (target) {
      bump(target);
      const ring = h('i', { class: 'heard-ring', 'aria-hidden': 'true', style: `left:${tx}px;top:${ty}px` });
      ui().append(ring);
      window.setTimeout(() => ring.remove(), 700);
    }
    landed(m, target);
  };
  requestAnimationFrame(frame);
}

/** The marker sweeps under the word where it was said, following it if its bubble moves. Then the word flies. */
function highlight(root: Element, first: Spot, forms: readonly string[], m: WordMoment) {
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
    // a bubble that slips under the HUD for a moment takes the mark with it
    mark.style.visibility = again ? '' : 'hidden';
    if (again) {
      spot = again;
      place(spot.rect);
    }
    if (now - t0 < MARK_MS) {
      requestAnimationFrame(follow);
      return;
    }
    mark.classList.add('leaving');
    window.setTimeout(() => mark.remove(), 300);
    if (reduceMotion()) {
      ambience.sting('caderno');
      landed(m, diaryTarget());
    } else fly(spot, m);
  };
  requestAnimationFrame(follow);
}

/**
 * A word heard in a line reached the diary: show it coming out of that line. If the line cannot be found on screen in time,
 * the usual new-word card is shown instead.
 */
export function flyHeardWord(m: WordMoment) {
  const forms = lineForms(m.pt);
  const t0 = performance.now();
  let echoed = false;
  const look = () => {
    const found = locate(forms);
    if (found) return highlight(found.root, found.spot, forms, m);
    const waited = performance.now() - t0;
    if (!echoed && waited > ECHO_MS && echo(forms)) {
      echoed = true;
      // the quote has just been laid out: look again on the next frame
      return void requestAnimationFrame(look);
    }
    if (waited > FIND_MS) return celebrateWord(m);
    window.setTimeout(look, 120);
  };
  look();
}
