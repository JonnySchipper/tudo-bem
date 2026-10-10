/**
 * The Diário's first page. The very first word a new player earns (the comissária's "bem-vindo", in the arrivals hall) does not get the
 * usual card: the world dims to a warm light, the journal rises out of it glowing, opens, its pages turn, and the word writes itself onto
 * the first page, one letter at a time, with a sparkle and a music-box cue (the `diario` sting). Then the book closes and settles into
 * the Diário button. Every later word gets the short version of the same flourish on its card (`miniBook`).
 *
 * The staging says what the journal is; the text does not. The root reuses the new-word card's ids (`photo-celebrate`, `photo-close`)
 * so the word queue waits for it and the play scripts dismiss it like any card. Reduced motion: the same page, without the travel.
 */
import { game } from '../state';
import { ambience } from '../ambience';
import { h, en, ui } from './dom';
import { shouldReveal, type WordMoment } from './diaryWordQueue';
import { flyWord } from './wordFlight';

const KEY = () => `tb_diario_aberto:${game.profile?.id ?? 'guest'}`;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Beats of the reveal, in ms from the start. Exported for the screenshot script, which pauses on them. */
export const REVEAL_MS = { rise: 250, open: 1700, pages: 2500, write: 3400, letter: 110 } as const;

function seen(): boolean {
  try {
    return localStorage.getItem(KEY()) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY(), '1');
  } catch {
    /* private mode: it shows once per visit */
  }
}

/** True when the next word should open the journal instead of showing the card. */
export function wantsReveal(): boolean {
  return shouldReveal(game.profile?.diary, seen());
}

/** The letters of a word as spans that write themselves in, one after another (`--i` drives the delay). */
function inkLetters(word: string): HTMLElement[] {
  return [...word].map((ch, i) => h('span', { class: `jr-ink${ch === ' ' ? ' sp' : ''}`, style: `--i:${i}` }, ch === ' ' ? ' ' : ch));
}

/**
 * Open the journal on its first word. `done` runs once the book has gone into the Diário button (the word queue goes on).
 */
export function revealJournal(m: WordMoment, done: () => void): void {
  markSeen();
  document.getElementById('photo-celebrate')?.remove();
  const still = reduceMotion();
  const letters = inkLetters(m.pt);
  const word = h('b', { class: 'jr-word', id: 'photo-word', lang: 'pt-BR' }, ...letters);
  const gloss = en(m.en);
  gloss.classList.add('jr-gloss');
  const quill = h('i', { class: 'jr-quill', 'aria-hidden': 'true' });
  const close = h('button', { type: 'button', class: 'primary jr-keep', id: 'photo-close' }, 'Guardar', h('small', null, 'Keep it'));
  const right = h(
    'div',
    { class: 'jr-page jr-right' },
    h('p', { class: 'jr-pagehead', lang: 'pt-BR' }, 'Chegada'),
    h('div', { class: 'jr-line' }, word, quill),
    gloss,
    h('p', { class: 'jr-count' }, h('b', null, '1'), ' palavra', h('span', { class: 'en' }, ' · 1 word')),
  );
  const left = h(
    'div',
    { class: 'jr-page jr-left' },
    h('p', { class: 'jr-owner', lang: 'pt-BR' }, 'Diário de'),
    h('p', { class: 'jr-name' }, game.profile?.name ?? ''),
    h('p', { class: 'jr-stamp', 'aria-hidden': 'true' }, 'BRASIL · 2026'),
  );
  const turning = [0, 1, 2].map((i) => h('div', { class: 'jr-leaf', style: `--i:${i}`, 'aria-hidden': 'true' }));
  const cover = h(
    'div',
    { class: 'jr-cover', 'aria-hidden': 'true' },
    h('i', { class: 'jr-corner tl' }),
    h('i', { class: 'jr-corner tr' }),
    h('i', { class: 'jr-corner bl' }),
    h('i', { class: 'jr-corner br' }),
    h('span', { class: 'jr-title' }, 'Diário'),
    h('i', { class: 'jr-clasp' }),
  );
  const book = h('div', { class: 'jr-book' }, left, right, ...turning, cover);
  const glow = h('div', { class: 'jr-glow', 'aria-hidden': 'true' });
  const motes = h('div', { class: 'jr-motes', 'aria-hidden': 'true' }, ...Array.from({ length: 18 }, (_, i) => h('i', { style: `--i:${i}` })));
  const stage = h('div', { class: 'jr-stage' }, glow, book);
  const caption = h('div', { class: 'jr-caption' }, h('p', { lang: 'pt-BR' }, 'Seu diário'), en('Your diary'), close);
  const root = h('div', { id: 'photo-celebrate', class: `journal-reveal${still ? ' still' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': `Seu diário: ${m.pt} (${m.en})` }, motes, stage, caption);
  ui().append(root);

  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, still ? Math.min(ms, 200) : ms));
  const phase = (p: string) => root.setAttribute('data-phase', p);
  phase('rise');
  // rise, open, the pages, the word
  at(REVEAL_MS.rise, () => phase('float'));
  at(REVEAL_MS.open, () => {
    phase('open');
    ambience.sting('diario');
  });
  at(REVEAL_MS.pages, () => {
    phase('pages');
    ambience.sfx('page');
  });
  const write = () => {
    phase('write');
    letters.forEach((_, i) => at(i * REVEAL_MS.letter, () => ambience.sfx('page')));
    at(letters.length * REVEAL_MS.letter + 250, () => {
      phase('written');
      close.focus({ preventScroll: true });
    });
  };
  // a word heard in a line flies off the dialogue box onto the page first
  const from = m.from && !still ? m.from : null;
  at(REVEAL_MS.write, () => {
    if (!from) return write();
    flyWord(
      { ...from, at: performance.now() },
      () => (word.isConnected ? word.getBoundingClientRect() : null),
      () => parseFloat(getComputedStyle(word).fontSize) || 40,
      write,
    );
  });

  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    for (const t of timers) window.clearTimeout(t);
    phase('close');
    document.removeEventListener('keydown', onKey, true);
    // the card ids go with the closing: the next card (and the play scripts) need not wait for the book's flight
    root.removeAttribute('id');
    close.removeAttribute('id');
    word.removeAttribute('id');
    // the book shuts and goes into the Diário button; on a phone the button is behind the menu
    const target = ['btn-caderno', 'btn-burger'].map((id) => document.getElementById(id)).find((el) => (el?.getBoundingClientRect().width ?? 0) > 0);
    const tr = target?.getBoundingClientRect();
    const br = book.getBoundingClientRect();
    if (!tr || still || typeof book.animate !== 'function') {
      root.remove();
      done();
      return;
    }
    const dx = tr.left + tr.width / 2 - (br.left + br.width / 2);
    const dy = tr.top + tr.height / 2 - (br.top + br.height / 2);
    root.classList.add('leaving');
    const anim = book.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 60}px) scale(0.55) rotate(-6deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(-12deg)`, opacity: 0.3 },
      ],
      { duration: 900, delay: 350, easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      root.remove();
      target!.classList.remove('bump');
      void target!.offsetWidth;
      target!.classList.add('bump');
      window.setTimeout(() => target!.classList.remove('bump'), 500);
      ambience.sting('caderno');
      done();
    };
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    if (root.getAttribute('data-phase') !== 'written') return;
    e.preventDefault();
    e.stopPropagation();
    finish();
  };
  document.addEventListener('keydown', onKey, true);
  close.addEventListener('click', finish);
}

/** The short version, on every later word's card: a small journal that opens, turns a page, and takes the word in with a sparkle. */
export function miniBook(): HTMLElement {
  return h(
    'div',
    { class: 'mini-book', 'aria-hidden': 'true' },
    h('i', { class: 'mb-page mb-left' }),
    h('i', { class: 'mb-page mb-right' }, h('i', { class: 'mb-ink' })),
    h('i', { class: 'mb-leaf' }),
    h('i', { class: 'mb-cover' }),
    h('i', { class: 'mb-spark' }),
  );
}
