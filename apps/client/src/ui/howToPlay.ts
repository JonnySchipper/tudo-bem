/**
 * The first time a minigame, panel or activity opens, a short card (in English; for a game, with the controls for a computer and a phone)
 * sits over it; a "?" button stays in the corner while it is open, to read it again. After the first time the card waits for the "?".
 * Each one is found by its root element (`HOW_TO_PLAY[].selector`), so the games and panels themselves need not know about this.
 * A card never lands on top of a new-word card or the Diário reveal: it waits until they are gone.
 *
 * The "?" is the one help button (SIMPLIFICATION-REVIEW B7): inside an activity it opens that activity's card; out in the Vila, with nothing
 * open, it opens the Vila guide. The top bar's stats open their own notes on a click (hudNotes.ts).
 */
import { game } from '../state';
import { h, ui } from './dom';
import { COMPACT_QUERY } from './hudLayout';
import { HOW_TO_PLAY, howToPlay, type HowToPlay } from './howToPlayData';
import { modalId } from './modal';
import { isDialogueBoxOpen } from './dialogue';
import { openVilaGuide } from './vilaGuide';
import { stage } from './disclosure';

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

/** The "?" key for the open world: no activity, panel or dialogue open, in the Vila (not the arrival). */
const VILA_HELP = 'vila-guide';
function inOpenVila(): boolean {
  const p = game.profile;
  const room = game.room?.room;
  if (!p || !room || room === 'aeroporto' || room === 'desembarque' || stage(p) === 'S0') return false;
  return !modalId() && !isDialogueBoxOpen();
}

function sync() {
  const g = openGame();
  const id = g?.id ?? (inOpenVila() ? VILA_HELP : null);
  if (id === current) return;
  current = id;
  // a card left from the thing that just closed goes with it
  const stale = document.getElementById('howto-card');
  if (stale && stale.dataset.game !== id) stale.remove();
  help?.remove();
  help = null;
  if (!g) {
    closeHowToPlay();
    if (id === VILA_HELP) {
      help = h('button', { type: 'button', class: 'howto-help howto-vila', id: 'howto-help', 'aria-label': 'Guia da Vila (Your guide to the Vila)', title: 'Guia da Vila', onclick: () => openVilaGuide() }, '?');
      ui().append(help);
    }
    return;
  }
  const label = g.kind === 'place' ? 'How it works' : 'How to play';
  help = h('button', { type: 'button', class: 'howto-help', id: 'howto-help', 'aria-label': `${label}: ${g.en}`, title: label, onclick: () => openHowToPlay(g.id) }, '?');
  ui().append(help);
  // a place card, and a thing that teaches by doing (fishing, the cart games), never opens its card by itself
  if (!seen(g.id) && g.autoOpen !== false) autoOpen(g.id);
}

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
