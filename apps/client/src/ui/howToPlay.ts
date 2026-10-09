/**
 * The first time a minigame opens, a short how-to-play card (in English, with the controls for a computer and a phone) sits over it; a
 * "?" button stays in the corner while the game is open, to read it again. After the first time the card waits for the "?". Each game
 * is found by its root element (`HOW_TO_PLAY[].selector`), so the games themselves need not know about this.
 */
import { game } from '../state';
import { h, ui } from './dom';
import { COMPACT_QUERY } from './hudLayout';
import { HOW_TO_PLAY, howToPlay, type HowToPlay } from './howToPlayData';

const seenKey = (id: string) => `tb_howto:${game.profile?.id ?? 'guest'}:${id}`;

function seen(id: string): boolean {
  try {
    return localStorage.getItem(seenKey(id)) === '1';
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(seenKey(id), '1');
  } catch {
    /* private mode */
  }
}

const touch = () => window.matchMedia(COMPACT_QUERY).matches || window.matchMedia('(pointer: coarse)').matches;

/** Open the card for a game (the "?" button, or the first time). */
export function openHowToPlay(id: string): void {
  const g = howToPlay(id);
  if (!g) return;
  markSeen(id);
  closeHowToPlay();
  const close = () => card.remove();
  const ok = h('button', { type: 'button', class: 'primary', id: 'howto-ok', onclick: close }, 'Got it · Entendi!');
  const card = h(
    'div',
    { class: 'howto-card', id: 'howto-card', role: 'dialog', 'aria-label': `How to play: ${g.en}`, 'data-game': g.id },
    h('p', { class: 'howto-kicker' }, 'How to play'),
    h('h3', null, g.pt, h('span', { class: 'en' }, ` · ${g.en}`)),
    h('p', { class: 'howto-goal' }, g.goal),
    h('ol', null, ...g.steps.map((s) => h('li', null, s))),
    h('dl', { class: 'howto-controls' }, h('dt', null, touch() ? 'Phone' : 'Computer'), h('dd', null, touch() ? g.phone : g.desktop), h('dt', null, touch() ? 'Computer' : 'Phone'), h('dd', null, touch() ? g.desktop : g.phone)),
    h('div', { class: 'howto-foot' }, ok),
  );
  // the card stops clicks and keys reaching the game under it until it is closed
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      close();
    }
  });
  ui().append(card);
  ok.focus({ preventScroll: true });
}

export function closeHowToPlay(): void {
  document.getElementById('howto-card')?.remove();
}

/** The game whose root is in the page now, if any (the first one in the list wins). */
function openGame(): HowToPlay | null {
  return HOW_TO_PLAY.find((g) => document.querySelector(g.selector)) ?? null;
}

let current: string | null = null;
let help: HTMLElement | null = null;

function sync() {
  const g = openGame();
  const id = g?.id ?? null;
  if (id === current) return;
  current = id;
  help?.remove();
  help = null;
  if (!g) {
    closeHowToPlay();
    return;
  }
  help = h('button', { type: 'button', class: 'howto-help', id: 'howto-help', 'aria-label': `How to play ${g.en}`, title: 'How to play', onclick: () => openHowToPlay(g.id) }, '?');
  ui().append(help);
  if (!seen(g.id)) window.setTimeout(() => current === g.id && openHowToPlay(g.id), 350);
}

/** Watch for games opening and closing (once, at game start). */
export function installHowToPlay(): void {
  let queued = false;
  const obs = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dialogue', 'data-modal'] });
  sync();
}
