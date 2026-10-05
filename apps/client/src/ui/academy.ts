/**
 * Elevator directory and the player-academy floor bar (slice 1).
 * needs_br: true — every Portuguese string in this file is new.
 */
import {
  CRESTS,
  CREST_IDS,
  ELEVATOR_STACK_WIDTH,
  GI_COLORS,
  GI_COLOR_IDS,
  elevatorLayout,
  type AcademyCard,
  type CrestId,
  type GiColorId,
  type GiStampId,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { closeModal, openModal } from './modal';

export interface AcademyLook {
  crest: CrestId;
  giColor: GiColorId;
  giStamp: GiStampId;
}

export interface AcademyActions {
  found: (name: string, look: AcademyLook) => void;
  visit: (id: string) => void;
  join: (id: string) => void;
  leave: (id: string) => void;
  look: (id: string, look: AcademyLook) => void;
}

let actions: AcademyActions | null = null;
let directoryOpen = false;
let wantDirectory = false;

export function bindAcademy(a: AcademyActions) {
  actions = a;
}

/** Ask the server for the elevator list. The panel opens when the directory arrives. */
export function askElevator() {
  wantDirectory = true;
}

export function elevatorWantsOpen() {
  return wantDirectory;
}

export function onAcademyDirectory(rows: AcademyCard[], canFound: boolean, ownedId: string | null) {
  if (!wantDirectory && !directoryOpen) return;
  wantDirectory = false;
  renderDirectory(rows, canFound, ownedId);
}

export function syncAcademyFloor() {
  const card = game.room?.room === 'andar' ? game.room.academy : undefined;
  let bar = document.getElementById('academy-floor');
  if (!card) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = h('div', { id: 'academy-floor', class: 'academy-floor' });
    document.getElementById('ui')?.append(bar);
  }
  const stacked = elevatorLayout(window.innerWidth).stacked;
  bar.classList.toggle('stacked', stacked);
  const controls: Node[] = [
    crestEl(card.crest, 28),
    h('div', { class: 'academy-floor-name' }, h('b', null, card.name), en(`${card.ownerName} · ${card.size}`)),
    h('span', { class: 'academy-chip' }, `${GI_COLORS[card.giColor].pt} ${CRESTS[card.giStamp].glyph}`),
    h('span', { class: 'academy-chip' }, card.fees.pt),
    h('span', { class: 'academy-chip' }, card.cup.pt),
  ];
  if (card.owner) controls.push(h('button', { type: 'button', class: 'green', onclick: () => openLook(card) }, bi('Brasão e kimono', 'Crest and gi')));
  else if (card.member) controls.push(h('button', { type: 'button', onclick: () => actions?.leave(card.id) }, bi('Sair', 'Leave')));
  bar.replaceChildren(...controls);
}

function renderDirectory(rows: AcademyCard[], canFound: boolean, ownedId: string | null) {
  const stacked = elevatorLayout(window.innerWidth <= 0 ? 390 : window.innerWidth).stacked;
  const list = h('div', { class: 'academy-list' });
  if (!rows.length) {
    list.append(h('p', { class: 'hint' }, 'Nenhuma academia ainda.'), en('No academies yet.'));
  }
  for (const row of rows) list.append(rowEl(row, stacked));
  const panel = h(
    'div',
    { class: `panel academy-dir${stacked ? ' academy-dir-stacked' : ''}`, role: 'dialog', 'aria-label': 'Elevador' },
    h('h2', null, 'Elevador'),
    en('Academies in the neighborhood'),
    h('p', { class: 'hint' }, 'A beta é grátis. Sem taxa pra entrar.'),
    en('Beta is free. No fee to join.'),
    list,
    foundBlock(canFound, ownedId, stacked),
  );
  const close = openModal('academy', panel, {
    onClose: () => {
      directoryOpen = false;
    },
  });
  directoryOpen = true;
  panel.append(h('button', { class: 'close ghost', onclick: close, 'aria-label': 'Fechar' }, '✕'));
}

function rowEl(row: AcademyCard, stacked: boolean) {
  const buttons = h(
    'div',
    { class: 'academy-actions' },
    h('button', { type: 'button', onclick: () => actions?.visit(row.id) }, bi('Visitar', 'Visit')),
    row.member
      ? row.owner
        ? null
        : h('button', { type: 'button', onclick: () => actions?.leave(row.id) }, bi('Sair', 'Leave'))
      : h('button', { type: 'button', class: 'green', onclick: () => actions?.join(row.id) }, bi('Entrar', 'Join')),
  );
  return h(
    'article',
    { class: `academy-row${stacked ? ' stacked' : ''}`, 'data-academy': row.id, 'data-crest': row.crest, 'data-size': String(row.size) },
    crestEl(row.crest, 36),
    h(
      'div',
      { class: 'academy-meta' },
      h('b', null, row.name),
      en(row.ownerName),
      h('span', { class: 'academy-facts' }, `${row.size} · ${row.fees.pt} · ${row.cup.pt}`),
    ),
    stacked ? buttons : buttons,
  );
}

function foundBlock(canFound: boolean, ownedId: string | null, stacked: boolean) {
  if (ownedId) return h('p', { class: 'hint' }, 'Você já fundou uma academia.', en('You already founded an academy.'));
  if (!canFound) return h('p', { class: 'hint' }, 'Fundar academia é da faixa marrom.', en('Founding an academy takes a brown belt.'));
  const name = h('input', { id: 'academy-name', maxlength: '24', placeholder: 'Nome da academia', autocomplete: 'off' }) as HTMLInputElement;
  const look = { crest: 'ipe' as CrestId, giColor: 'branco' as GiColorId, giStamp: 'ipe' as GiStampId };
  const crestPick = picker(CREST_IDS, look.crest, (id) => {
    look.crest = id;
  }, (id) => CRESTS[id].glyph, (id) => CRESTS[id].pt);
  const colorPick = picker(GI_COLOR_IDS, look.giColor, (id) => {
    look.giColor = id;
  }, (id) => '', (id) => GI_COLORS[id].pt, (id) => GI_COLORS[id].fill);
  const stampPick = picker(CREST_IDS, look.giStamp, (id) => {
    look.giStamp = id;
  }, (id) => CRESTS[id].glyph, (id) => CRESTS[id].pt);
  return h(
    'form',
    {
      class: `academy-found${stacked ? ' stacked' : ''}`,
      onsubmit: (e: Event) => {
        e.preventDefault();
        actions?.found(name.value, { ...look });
      },
    },
    h('h3', null, 'Fundar academia'),
    en('Found an academy'),
    h('label', { class: 'field' }, 'Nome', name),
    h('div', { class: 'field' }, h('span', null, 'Brasão'), crestPick),
    h('div', { class: 'field' }, h('span', null, 'Cor do kimono'), colorPick),
    h('div', { class: 'field' }, h('span', null, 'Estampa'), stampPick),
    h('button', { type: 'submit', class: 'green' }, bi('Fundar academia', 'Found academy')),
  );
}

function openLook(card: AcademyCard) {
  const look = { crest: card.crest, giColor: card.giColor, giStamp: card.giStamp };
  const crestPick = picker(CREST_IDS, look.crest, (id) => {
    look.crest = id;
  }, (id) => CRESTS[id].glyph, (id) => CRESTS[id].pt);
  const colorPick = picker(GI_COLOR_IDS, look.giColor, (id) => {
    look.giColor = id;
  }, (id) => '', (id) => GI_COLORS[id].pt, (id) => GI_COLORS[id].fill);
  const stampPick = picker(CREST_IDS, look.giStamp, (id) => {
    look.giStamp = id;
  }, (id) => CRESTS[id].glyph, (id) => CRESTS[id].pt);
  const panel = h(
    'form',
    {
      class: 'panel academy-dir',
      role: 'dialog',
      'aria-label': 'Brasão e kimono',
      onsubmit: (e: Event) => {
        e.preventDefault();
        actions?.look(card.id, { ...look });
        closeModal();
      },
    },
    h('h2', null, 'Brasão e kimono'),
    en('Crest and gi'),
    h('div', { class: 'field' }, h('span', null, 'Brasão'), crestPick),
    h('div', { class: 'field' }, h('span', null, 'Cor do kimono'), colorPick),
    h('div', { class: 'field' }, h('span', null, 'Estampa'), stampPick),
    h('button', { type: 'submit', class: 'green' }, bi('Salvar', 'Save')),
  );
  const close = openModal('academy-look', panel);
  panel.append(h('button', { class: 'close ghost', type: 'button', onclick: close, 'aria-label': 'Fechar' }, '✕'));
}

function crestEl(id: CrestId, size: number) {
  const c = CRESTS[id];
  return h(
    'span',
    { class: `academy-crest crest-${id}`, title: c.pt, style: `background:${c.fill};width:${size}px;height:${size}px` },
    c.glyph,
  );
}

function picker<T extends string>(
  ids: readonly T[],
  current: T,
  set: (id: T) => void,
  glyph: (id: T) => string,
  label: (id: T) => string,
  fill?: (id: T) => string,
) {
  const box = h('div', { class: 'academy-picks', role: 'radiogroup' });
  const buttons: HTMLButtonElement[] = [];
  const paint = (on: T) => {
    for (const b of buttons) b.classList.toggle('on', b.dataset.id === on);
  };
  for (const id of ids) {
    const b = h(
      'button',
      {
        type: 'button',
        class: id === current ? 'on' : '',
        'data-id': id,
        title: label(id),
        style: fill ? `background:${fill(id)}` : '',
        onclick: () => {
          set(id);
          paint(id);
        },
      },
      glyph(id) || label(id),
    ) as HTMLButtonElement;
    buttons.push(b);
    box.append(b);
  }
  return box;
}

/** Used by the panel so a 390px phone stacks the directory. Re-exported for tests via the shared helper. */
export const elevatorStacksAt = ELEVATOR_STACK_WIDTH;
