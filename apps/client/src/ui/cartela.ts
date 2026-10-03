import {
  CARTELA_ACTIVITIES,
  CARTELA_ACTIVITY,
  CARTELA_COPY,
  CARTELA_GOAL,
  CARTELA_REWARD,
  activityStampedToday,
  stampsOnDay,
  todayEastern,
  type CartelaActivity,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon, type IconName } from '../art/ui';
import { openModal } from './panels';

const ACTIVITY_ICON: Record<CartelaActivity, IconName> = {
  tatame: 'recados',
  balcao: 'monta',
  feira: 'map',
  conversa: 'cumprimenta',
};

function easternDay() {
  return todayEastern();
}

export function cartelaBanner(stamps: number) {
  document.querySelector('.cartela-banner')?.remove();
  const el = h(
    'div',
    { class: 'cartela-banner', role: 'status' },
    h('span', { class: 'stamp-ring' }, `${stamps}/${CARTELA_GOAL}`),
    h('div', null, h('b', null, CARTELA_COPY.paid.pt), en(CARTELA_COPY.paid.en)),
  );
  ui().append(el);
  setTimeout(() => el.remove(), 5200);
}

export function openCartela() {
  const body = h('div');
  const render = () => {
    const st = game.profile?.cartela;
    const day = easternDay();
    const todayN = st ? stampsOnDay(st, day) : 0;
    const stamps = st?.stamps ?? 0;
    const slots = Array.from({ length: CARTELA_GOAL }, (_, i) => i < stamps);
    body.replaceChildren(
      h('p', { class: 'cartela-lede' }, bi(`${stamps} de ${CARTELA_GOAL} carimbos`, `${stamps} of ${CARTELA_GOAL} stamps`)),
      h(
        'div',
        { class: 'cartela-stamps', 'aria-label': `${stamps} carimbos` },
        ...slots.map((on, i) => h('span', { class: `cartela-hole ${on ? 'on' : ''}`, 'aria-hidden': 'true' }, on ? '✓' : String(i + 1))),
      ),
      h('p', { class: 'cartela-today' }, bi(`${CARTELA_COPY.today.pt}: ${todayN}/${CARTELA_ACTIVITIES.length} hoje`, `${CARTELA_COPY.today.en}: ${todayN}/${CARTELA_ACTIVITIES.length} today`)),
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
            done ? h('span', { class: 'tick', 'aria-label': 'feito hoje' }, '✓') : null,
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
      h('button', { class: 'close ghost', type: 'button', onclick: () => close(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, CARTELA_COPY.title.pt),
      en(CARTELA_COPY.title.en),
      body,
    ),
    { onClose: off },
  );
}
