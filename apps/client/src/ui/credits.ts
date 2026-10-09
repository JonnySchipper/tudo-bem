/**
 * Créditos / Credits: the small panel behind the top-bar "Créditos" button. Data first (`CREDITS`, tested), DOM second.
 * The LimeZu line is a license requirement (`apps/client/assets-src/LICENSES.md`): it must stay reachable in the game.
 * A plain-looking footer line opens the hidden admin login (does not look like a button).
 */
import { h, en } from './dom';
import { closeModal, openModal } from './modal.js';
import { openAdmin } from './admin.js';
import { CREDITS, LIMEZU_URL, TEAM_EMAIL, type CreditLine } from './creditsData';

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

/** The small footer on the title / sign-in screen: Privacy and Terms, then the LimeZu art credit. */
export function artCredit(): HTMLElement {
  return h(
    'footer',
    { class: 'intro-art-credit', id: 'intro-art-credit' },
    h('span', { class: 'intro-policies' }, h('a', { href: '/privacy' }, 'Privacy'), ' · ', h('a', { href: '/terms' }, 'Terms')),
    h('span', { class: 'intro-art-sep', 'aria-hidden': 'true' }, '·'),
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
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('img', {
        class: 'tb-logo tb-logo-banner credits-logo',
        src: `${import.meta.env.BASE_URL}brand/tb-logo-banner.png`,
        alt: 'Tudo Bem',
        width: '1073',
        height: '386',
        decoding: 'async',
        draggable: 'false',
      }),
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
      h(
        'p',
        { class: 'credits-legal', id: 'credits-legal' },
        h('a', { class: 'credit-link', href: '/privacy', target: '_blank', rel: 'noopener' }, 'Privacidade'),
        ' · ',
        h('a', { class: 'credit-link', href: '/terms', target: '_blank', rel: 'noopener' }, 'Termos'),
        ' · ',
        h('a', { class: 'credit-link', href: `mailto:${TEAM_EMAIL}` }, TEAM_EMAIL),
        en('Privacy · Terms · contact the team', true),
      ),
      // Plain text on purpose: no button chrome. Opens the admin login.
      h(
        'button',
        {
          type: 'button',
          class: 'credits-door',
          id: 'credits-admin-door',
          onclick: () => {
            close();
            openAdmin();
          },
          'aria-label': 'versão do bairro (neighbourhood version)',
        },
        'versão do bairro',
        en('neighbourhood version', true),
      ),
      h('button', { class: 'primary', onclick: () => close(), id: 'credits-close' }, 'Fechar', en('Close', true)),
    ),
  );
}

export { closeModal as closeCredits };
