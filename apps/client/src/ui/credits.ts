/**
 * Créditos / Credits: the small panel behind the top-bar "Créditos" button. Data first (`CREDITS`, tested), DOM second.
 * The LimeZu line is a license requirement (`apps/client/assets-src/LICENSES.md`): it must stay reachable in the game.
 */
import { h, en } from './dom';
import { closeModal, openModal } from './modal.js';
import { CREDITS, LIMEZU_URL, type CreditLine } from './creditsData';

function line(c: CreditLine): HTMLElement {
  return h(
    'li',
    { class: 'credit', 'data-credit': c.id },
    h('div', { class: 'credit-role' }, c.role.pt, h('small', null, c.role.en)),
    h(
      'div',
      { class: 'credit-who' },
      h('b', null, c.who),
      c.note ? h('span', { class: 'credit-note' }, c.note) : null,
      c.link ? h('a', { class: 'credit-link', href: c.link.href, target: '_blank', rel: 'noopener noreferrer' }, c.link.label) : null,
    ),
  );
}

/** The small art credit line on the title / sign-in screen ("Art: LimeZu — limezu.itch.io"). */
export function artCredit(): HTMLElement {
  return h(
    'footer',
    { class: 'intro-art-credit', id: 'intro-art-credit' },
    'Art: ',
    h('a', { href: LIMEZU_URL, target: '_blank', rel: 'noopener noreferrer' }, 'LimeZu'),
    ' — limezu.itch.io',
  );
}

/** Opens the credits panel (a normal modal: Esc, the close button and a click outside all close it). */
export function openCredits(): void {
  const close = openModal(
    'credits',
    h(
      'div',
      { class: 'panel credits-panel' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, 'Créditos'),
      en('Credits — the people and tools behind Tudo Bem.'),
      h(
        'p',
        { class: 'credits-art', id: 'credits-art' },
        'Arte: ',
        h('a', { class: 'credit-link', href: LIMEZU_URL, target: '_blank', rel: 'noopener noreferrer' }, 'LimeZu — limezu.itch.io'),
        en('Art: LimeZu (Modern Exteriors, Modern Interiors)', true),
      ),
      h('ul', { class: 'credits-list' }, ...CREDITS.filter((c) => c.id !== 'art').map(line)),
      h('button', { class: 'primary', onclick: () => close(), id: 'credits-close' }, 'Fechar'),
    ),
  );
}

export { closeModal as closeCredits };
