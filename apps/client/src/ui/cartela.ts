import {
  CARTELA_ACTIVITIES,
  CARTELA_ACTIVITY,
  CARTELA_COPY,
  CARTELA_GOAL,
  CARTELA_REWARD,
  activityStampedToday,
  stampsOnDay,
  viewerProfileDay,
  type CartelaActivity,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon, type IconName } from '../art/ui';
import { openModal } from './panels';
import { ambience } from '../ambience';

const ACTIVITY_ICON: Record<CartelaActivity, IconName> = {
  tatame: 'recados',
  balcao: 'monta',
  feira: 'map',
  conversa: 'cumprimenta',
};

/** How long the payout banner stays up; the HUD chip holds the full card for the same time. */
export const CARTELA_BANNER_MS = 4600;

/**
 * The 7th stamp. A full card slides down with six stamps already inked; the seventh lands with a thump, the reward pops, then the card
 * slides away and the HUD chip turns over to a fresh card. `stamps` is the full count (the server sends 7, the profile is already 0).
 */
export function cartelaBanner(stamps: number = CARTELA_GOAL) {
  document.querySelector('.cartela-banner')?.remove();
  const n = Math.min(CARTELA_GOAL, Math.max(1, stamps));
  const el = h(
    'div',
    { class: 'cartela-banner', role: 'status', id: 'cartela-banner' },
    h(
      'div',
      { class: 'cb-card', 'aria-hidden': 'true' },
      h('span', { class: 'cb-title' }, CARTELA_COPY.title.pt),
      h(
        'span',
        { class: 'cb-holes' },
        ...Array.from({ length: CARTELA_GOAL }, (_, i) => h('i', { class: `cb-hole${i < n - 1 ? ' on' : ''}${i === n - 1 ? ' last' : ''}`, style: `--r:${((i * 37) % 17) - 8}deg` })),
      ),
    ),
    h('div', { class: 'cb-text' }, h('b', null, CARTELA_COPY.paid.pt), en(CARTELA_COPY.paid.en), h('span', { class: 'cb-count' }, `${n}/${CARTELA_GOAL}`)),
    h('span', { class: 'cb-reward' }, icon('rv', 20), `+${CARTELA_REWARD} RV`),
  );
  ui().append(el);
  window.setTimeout(() => ambience.sfx('stamp'), 620);
  window.setTimeout(() => el.classList.add('leaving'), CARTELA_BANNER_MS - 380);
  window.setTimeout(() => el.remove(), CARTELA_BANNER_MS);
}

export function openCartela() {
  const body = h('div');
  const render = () => {
    const st = game.profile?.cartela;
    const day = viewerProfileDay(game.profile);
    const todayN = st ? stampsOnDay(st, day) : 0;
    const stamps = st?.stamps ?? 0;
    const slots = Array.from({ length: CARTELA_GOAL }, (_, i) => i < stamps);
    body.replaceChildren(
      h('p', { class: 'cartela-lede' }, bi(`${stamps} de ${CARTELA_GOAL} carimbos`, `${stamps} of ${CARTELA_GOAL} stamps`)),
      h(
        'div',
        { class: 'cartela-stamps', 'aria-label': `${stamps} carimbos` },
        ...slots.map((on, i) => h('span', { class: `cartela-hole ${on ? 'on' : ''}`, 'aria-hidden': 'true', style: `--r:${((i * 37) % 17) - 8}deg;--d:${i * 70}ms` }, on ? h('i', { class: 'ink' }) : String(i + 1))),
      ),
      h('p', { class: 'cartela-today' }, bi(`${CARTELA_COPY.today.pt}: ${todayN}/${CARTELA_ACTIVITIES.length}`, `${CARTELA_COPY.today.en}: ${todayN}/${CARTELA_ACTIVITIES.length}`)),
      h(
        'ul',
        { class: 'cartela-acts' },
        ...CARTELA_ACTIVITIES.map((id) => {
          const done = st ? activityStampedToday(st, id, day) : false;
          return h(
            'li',
            { class: done ? 'done' : '' },
            h('span', { class: 'ico' }, icon(ACTIVITY_ICON[id], 28)),
            h('span', { class: 'lbl' }, CARTELA_ACTIVITY[id].pt, en(CARTELA_ACTIVITY[id].en, true)),
            done ? h('span', { class: 'tick', 'aria-label': 'feito hoje (done today)' }, '✓') : null,
          );
        }),
      ),
      h('p', { class: 'cartela-pay' }, bi(`Completa 7 e ganha +${CARTELA_REWARD} RV`, `Fill 7 and earn +${CARTELA_REWARD} RV`)),
    );
  };
  render();
  const off = game.on('profile', render);
  const close = openModal(
    'cartela',
    h(
      'div',
      { class: 'panel cartela-panel' },
      h('button', { class: 'close ghost', type: 'button', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, CARTELA_COPY.title.pt),
      en(CARTELA_COPY.title.en),
      body,
    ),
    { onClose: off },
  );
}
