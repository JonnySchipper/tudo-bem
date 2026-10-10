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
  showsAcademyLookEditor,
  showsFundarAcademy,
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

/** The floor bar is gone (it covered the HUD): the HUD names the floor, the crest board opens the team card. This keeps an open card current. */
export function syncAcademyFloor() {
  document.getElementById('academy-floor')?.remove();
  const card = game.room?.room === 'andar' ? game.room.academy : undefined;
  const open = document.querySelector('.academy-board');
  if (open && card) open.replaceWith(boardPanel(card));
}

/** The crest board on an academy floor: the owner edits crest and gi; anyone else sees the team and joins or leaves. */
export function openAcademyBoard(card: AcademyCard) {
  if (card.owner && showsAcademyLookEditor()) return openLook(card);
  openModal('academy-board', boardPanel(card));
}

function boardPanel(card: AcademyCard) {
  const members = `${card.size} ${card.size === 1 ? 'membro' : 'membros'}`;
  const action = card.owner
    ? null
    : card.member
    ? h('button', { type: 'button', onclick: () => actions?.leave(card.id) }, bi('Sair da equipe', 'Leave the team'))
    : h('button', { type: 'button', class: 'green', id: 'academy-join', onclick: () => actions?.join(card.id) }, bi('Entrar na equipe', 'Join the team'));
  return h(
    'div',
    { class: 'panel academy-dir academy-board', role: 'dialog', 'aria-label': card.name },
    preview(card.name, { crest: card.crest, giColor: card.giColor, giStamp: card.giStamp }, `de ${card.ownerName} · ${members}`),
    h('p', null, card.member ? 'Você é da equipe: aqui você treina com o kimono dela.' : 'Quem entra na equipe treina aqui com o kimono dela. É grátis.', en(card.member ? 'You are on the team: here you train in its gi.' : 'Team members train here in its gi. It is free.')),
    h('div', { class: 'academy-board-actions' }, action, h('button', { type: 'button', class: 'ghost', onclick: () => closeModal() }, bi('Fechar', 'Close'))),
  );
}

/** Crest, name and a gi swatch with its stamp: what the team looks like, live while you pick. */
function preview(name: string, look: AcademyLook, sub?: string) {
  const gi = GI_COLORS[look.giColor];
  return h(
    'div',
    { class: 'academy-preview' },
    crestEl(look.crest, 52),
    h('div', { class: 'academy-preview-text' }, h('b', null, name || 'Sua academia'), sub ? h('span', { class: 'hint' }, sub) : null),
    h('span', { class: 'academy-gi', title: `${gi.pt} · ${CRESTS[look.giStamp].pt}`, style: `background:${gi.fill}` }, CRESTS[look.giStamp].glyph),
  );
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
    { class: `panel academy-dir${stacked ? ' academy-dir-stacked' : ''}`, role: 'dialog', 'aria-label': 'Elevador (Elevator)' },
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
  panel.append(h('button', { class: 'close ghost', onclick: close, 'aria-label': 'Fechar (Close)' }, '✕'));
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
  // the Fundar block (and its brown-belt rule) waits for purple belt: before that the elevator is just the list
  if (!showsFundarAcademy(game.profile?.bjj)) return null;
  if (!canFound) return h('p', { class: 'hint' }, 'Fundar academia é da faixa marrom.', en('Founding an academy takes a brown belt.'));
  const name = h('input', { id: 'academy-name', maxlength: '24', placeholder: 'Equipe … (Team …)', autocomplete: 'off' }) as HTMLInputElement;
  const look: AcademyLook = { crest: 'ipe', giColor: 'branco', giStamp: 'ipe' };
  const box = h('div', { class: 'academy-preview-box' });
  const paint = () => box.replaceChildren(preview(name.value.trim(), look, 'Prévia · Preview'));
  name.addEventListener('input', paint);
  paint();
  return h(
    'form',
    {
      class: `academy-found${stacked ? ' stacked' : ''}`,
      onsubmit: (e: Event) => {
        e.preventDefault();
        if (!name.value.trim()) return name.focus();
        actions?.found(name.value, { ...look });
      },
    },
    h('h3', null, 'Fundar academia'),
    en('Found an academy'),
    box,
    h('label', { class: 'field' }, h('span', null, 'Nome', en('Name')), name),
    ...(showsAcademyLookEditor() ? lookFields(look, paint) : []),
    h('button', { type: 'submit', class: 'green' }, bi('Fundar academia', 'Found academy')),
  );
}

/** The three look pickers (crest, gi colour, gi stamp), each repainting the preview. */
function lookFields(look: AcademyLook, paint: () => void) {
  const field = (pt: string, enText: string, control: HTMLElement) => h('div', { class: 'field' }, h('span', null, pt, en(enText)), control);
  return [
    field('Brasão', 'Crest', picker(CREST_IDS, look.crest, (id) => ((look.crest = id), paint()), (id) => CRESTS[id].glyph, (id) => CRESTS[id].pt)),
    field('Cor do kimono', 'Gi colour', picker(GI_COLOR_IDS, look.giColor, (id) => ((look.giColor = id), paint()), () => '', (id) => GI_COLORS[id].pt, (id) => GI_COLORS[id].fill)),
    field('Estampa no kimono', 'Gi stamp', picker(CREST_IDS, look.giStamp, (id) => ((look.giStamp = id), paint()), (id) => CRESTS[id].glyph, (id) => CRESTS[id].pt)),
  ];
}

function openLook(card: AcademyCard) {
  const look: AcademyLook = { crest: card.crest, giColor: card.giColor, giStamp: card.giStamp };
  const box = h('div', { class: 'academy-preview-box' });
  const paint = () => box.replaceChildren(preview(card.name, look, `${card.size} ${card.size === 1 ? 'membro' : 'membros'}`));
  paint();
  const panel = h(
    'form',
    {
      class: 'panel academy-dir academy-look',
      role: 'dialog',
      'aria-label': 'Brasão e kimono (Crest and gi)',
      onsubmit: (e: Event) => {
        e.preventDefault();
        actions?.look(card.id, { ...look });
        closeModal();
      },
    },
    h('h2', null, 'Brasão e kimono'),
    en('Crest and gi'),
    box,
    ...lookFields(look, paint),
    h('p', { class: 'hint' }, 'Os membros treinam aqui com este kimono.', en('Members train here in this gi.')),
    h('button', { type: 'submit', class: 'green' }, bi('Salvar', 'Save')),
  );
  const close = openModal('academy-look', panel);
  panel.append(h('button', { class: 'close ghost', type: 'button', onclick: close, 'aria-label': 'Fechar (Close)' }, '✕'));
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
      glyph(id) ? [h('span', { class: 'glyph', 'aria-hidden': 'true' }, glyph(id)), h('small', null, label(id))] : label(id),
    ) as HTMLButtonElement;
    buttons.push(b);
    box.append(b);
  }
  return box;
}

/** Used by the panel so a 390px phone stacks the directory. Re-exported for tests via the shared helper. */
export const elevatorStacksAt = ELEVATOR_STACK_WIDTH;
