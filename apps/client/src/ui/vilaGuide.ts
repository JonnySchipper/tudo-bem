/**
 * The Vila Ipê guide card (words in ui/vilaGuideData.ts). It opens by itself once, the first time a resident stands in the Vila, and
 * waits for a calm moment: never on top of a dialogue, a panel, a new-word card or another first-time card. Ajustes → Guia and Júlia
 * ("O que tem pra fazer aqui?") open it again.
 */
import { game } from '../state';
import { h, ui } from './dom';
import { modalId } from './modal';
import { isDialogueBoxOpen } from './dialogue';
import { VILA_GUIDE, shouldShowVilaGuide, vilaGuideKey } from './vilaGuideData';

function seen(): boolean {
  try {
    return localStorage.getItem(vilaGuideKey(game.profile?.id)) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(vilaGuideKey(game.profile?.id), '1');
  } catch {
    /* private mode */
  }
}

export function closeVilaGuide(): void {
  document.getElementById('vila-guide')?.remove();
}

export function openVilaGuide(): void {
  markSeen();
  closeVilaGuide();
  const close = () => card.remove();
  const ok = h('button', { type: 'button', class: 'primary', id: 'vila-guide-ok', onclick: close }, 'Vamos lá!', h('span', { class: 'en' }, ' · Let’s go'));
  const card = h(
    'div',
    { class: 'howto-card vila-guide', id: 'vila-guide', role: 'dialog', 'aria-label': VILA_GUIDE.title.en },
    h('p', { class: 'howto-kicker' }, 'Your guide · Guia da Vila'),
    h('h3', null, VILA_GUIDE.title.pt, h('span', { class: 'en' }, VILA_GUIDE.title.en)),
    h('p', { class: 'howto-goal' }, VILA_GUIDE.lead),
    h('dl', { class: 'vila-guide-list' }, ...VILA_GUIDE.lines.flatMap((l) => [h('dt', { lang: 'pt-BR' }, l.pt), h('dd', null, l.en)])),
    h('p', { class: 'vila-guide-tip' }, VILA_GUIDE.tip),
    h('div', { class: 'howto-foot' }, ok),
  );
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

/** Something else has the player's attention right now. */
const busy = (): boolean =>
  !!modalId() || isDialogueBoxOpen() || !!document.getElementById('photo-celebrate') || !!document.getElementById('howto-card') || !!document.querySelector('.tb-note');

let waiting = 0;

/** After a room change: the first time in the Vila, open the guide once things are calm (gives up after a minute). */
export function maybeShowVilaGuide(room: string): void {
  const p = game.profile;
  if (!p || waiting || !shouldShowVilaGuide({ room, arrivalIntroDone: p.arrivalIntroDone, desembarqueDone: p.desembarqueDone, seen: seen() })) return;
  const until = performance.now() + 60_000;
  const tryOpen = () => {
    waiting = 0;
    if (seen() || performance.now() > until || !shouldShowVilaGuide({ room: game.room?.room ?? '', arrivalIntroDone: game.profile?.arrivalIntroDone, seen: false })) return;
    if (busy()) {
      waiting = window.setTimeout(tryOpen, 700);
      return;
    }
    openVilaGuide();
  };
  // let the room settle first (the welcome toast, the ways-out banner)
  waiting = window.setTimeout(tryOpen, 1800);
}
