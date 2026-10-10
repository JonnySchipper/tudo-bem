/**
 * The first time a minigame, panel or activity opens, a short card (in English; for a game, with the controls for a computer and a phone)
 * sits over it; a "?" button stays in the corner while it is open, to read it again. After the first time the card waits for the "?".
 * Each one is found by its root element (`HOW_TO_PLAY[].selector`), so the games and panels themselves need not know about this.
 * A card never lands on top of a new-word card or the Diário reveal: it waits until they are gone.
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
  const kicker = g.kind === 'place' ? 'How it works' : 'How to play';
  // a game lists both sets of controls (yours first); a place shows only the line for this device, when it has one
  const mine = touch() ? g.phone : g.desktop;
  const other = touch() ? g.desktop : g.phone;
  const controls =
    g.kind === 'place'
      ? mine
        ? h('dl', { class: 'howto-controls' }, h('dt', null, touch() ? 'Phone' : 'Computer'), h('dd', null, mine))
        : null
      : h('dl', { class: 'howto-controls' }, h('dt', null, touch() ? 'Phone' : 'Computer'), h('dd', null, mine ?? ''), h('dt', null, touch() ? 'Computer' : 'Phone'), h('dd', null, other ?? ''));
  const card = h(
    'div',
    { class: `howto-card howto-${g.kind ?? 'game'}`, id: 'howto-card', role: 'dialog', 'aria-label': `${kicker}: ${g.en}`, 'data-game': g.id },
    h('p', { class: 'howto-kicker' }, kicker),
    h('h3', null, g.pt, h('span', { class: 'en' }, g.en)),
    h('p', { class: 'howto-goal' }, g.goal),
    h('ol', null, ...g.steps.map((s) => h('li', null, s))),
    controls,
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
  // a card left from the thing that just closed goes with it
  const stale = document.getElementById('howto-card');
  if (stale && stale.dataset.game !== id) stale.remove();
  help?.remove();
  help = null;
  if (!g) {
    closeHowToPlay();
    return;
  }
  const label = g.kind === 'place' ? 'How it works' : 'How to play';
  help = h('button', { type: 'button', class: 'howto-help', id: 'howto-help', 'aria-label': `${label}: ${g.en}`, title: label, onclick: () => openHowToPlay(g.id) }, '?');
  ui().append(help);
  // a guided tutorial that already explains it here keeps the card for the "?" (it opens by itself the next time, somewhere else);
  // a thing that teaches by doing (fishing) never opens its card by itself
  if (!seen(g.id) && !quietHere(g) && g.autoOpen !== false) autoOpen(g.id);
}

const quietHere = (g: HowToPlay): boolean => !!g.quietIn?.includes(game.room?.room ?? '');

/** Something else is telling the player something right now: a new-word card, the Diário reveal, another how-to card, the Vila guide. */
const busy = (): boolean => !!document.getElementById('photo-celebrate') || !!document.getElementById('howto-card') || !!document.getElementById('vila-guide');

/** Open the first-time card once nothing else is on top; give up if the thing closes first. */
function autoOpen(id: string, wait = 350): void {
  window.setTimeout(() => {
    if (current !== id || seen(id)) return;
    if (busy()) return autoOpen(id, 500);
    openHowToPlay(id);
  }, wait);
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
