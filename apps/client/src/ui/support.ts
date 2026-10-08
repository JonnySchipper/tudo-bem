/**
 * Apoiar o Tudo Bem / Support Tudo Bem.
 * Learning stays free. The subscribe button calls POST /api/billing/checkout, which uses the provider.
 * With no provider configured the button reads "em breve".
 * needs_br: true
 */
import {
  BUBBLE_STYLE_COPY,
  BUBBLE_STYLES,
  PET_COPY,
  SUBSCRIPTION_PRICE,
  hasPerkAccess,
  isPreviewUnlocked,
  type BubbleStyle,
  type PetId,
} from '@tudobem/shared';
import { fetchPublicConfig } from '../auth/config';
import { game } from '../state';
import { bi, h, en } from './dom';
import { closeModal, openModal } from './modal.js';

export interface SupportActions {
  subscribe: () => Promise<{ url?: string; soon?: boolean }>;
  setPet: (pet: PetId | null) => void;
  setBubble: (style: BubbleStyle) => void;
  /** Open the naming dialog for the pet that is out. */
  renamePet: (pet: PetId) => void;
}

export async function openSupport(actions: SupportActions): Promise<void> {
  const cfg = await fetchPublicConfig();
  const root = h('div', { class: 'panel support-panel', id: 'support-panel', role: 'dialog', 'aria-label': 'Apoiar o Tudo Bem' });
  const paint = () => {
    const p = game.profile;
    const active = hasPerkAccess(p?.subscription, Date.now());
    const portal = p?.subscription?.portalUrl;
    const ready = cfg.billingReady;
    const nodes = [
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, 'Apoiar o Tudo Bem'),
      en('Support Tudo Bem'),
      h('p', { class: 'support-free', id: 'support-free' }, 'Aprender é sempre grátis.', en('Learning is always free.', true)),
      h('p', { class: 'support-price', id: 'support-price' }, SUBSCRIPTION_PRICE.pt, en(SUBSCRIPTION_PRICE.en, true)),
      h(
        'ul',
        { class: 'support-perks' },
        h('li', null, 'Selo de fundador', en('Founder badge — stays, even if you cancel', true)),
        h('li', null, 'Banner dos fundadores na kitnet', en('Founders banner for your kitnet — stays too', true)),
        h('li', null, 'Prévia da Praia', en(`Beach preview — ${isPreviewUnlocked(p ?? {}, 'praia') ? 'unlocked' : 'with an active subscription'}`, true)),
        h('li', null, 'Cachorro e gato que te seguem', en('A dog and a cat that follow you', true)),
        h('li', null, 'Balões de conversa coloridos', en('Chat bubble colours. The words never change.', true)),
      ),
      h(
        'p',
        { class: 'support-age', id: 'support-age' },
        'Quem tem menos de 13 anos precisa que um pai, mãe ou responsável faça a compra.',
        en('Players under 13 need a parent or guardian to purchase.', true),
      ),
      ready
        ? h(
            'label',
            { class: 'support-confirm', for: 'support-18' },
            h('input', { type: 'checkbox', id: 'support-18' }),
            h('span', null, 'Tenho 18 anos ou mais, ou sou pai, mãe ou responsável.', en('I am 18+ or a parent/guardian.', true)),
          )
        : null,
      h(
        'button',
        {
          class: 'primary',
          id: 'btn-subscribe',
          type: 'button',
          disabled: !ready,
          onclick: async () => {
            if (!ready) return;
            const box = document.getElementById('support-18') as HTMLInputElement | null;
            if (!box?.checked) {
              box?.focus();
              return;
            }
            const btn = document.getElementById('btn-subscribe') as HTMLButtonElement | null;
            if (btn) btn.disabled = true;
            const out = await actions.subscribe();
            if (out.url) window.location.assign(out.url);
            else if (btn) {
              btn.disabled = false;
              btn.textContent = 'em breve';
            }
          },
        },
        ready ? 'Assinar' : 'em breve',
      ),
      !ready ? en('Checkout is not open yet.', true) : en('Subscribe — $10/month. Learning stays free.', true),
      portal
        ? h(
            'p',
            { class: 'support-manage' },
            h('a', { id: 'support-manage', href: portal, target: '_blank', rel: 'noopener noreferrer' }, 'Gerenciar assinatura', en('Manage subscription', true)),
          )
        : null,
      active
        ? h(
            'div',
            { class: 'support-choices', id: 'support-choices' },
            h('h3', null, 'Pet'),
            en('Follows you while the subscription is active.', true),
            h(
              'div',
              { class: 'support-row', role: 'group', 'aria-label': 'Pet' },
              choice('pet', null, p?.pet ?? null, 'Nenhum', () => actions.setPet(null)),
              choice('pet', 'dog', p?.pet ?? null, PET_COPY.dog.pt, () => actions.setPet('dog')),
              choice('pet', 'cat', p?.pet ?? null, PET_COPY.cat.pt, () => actions.setPet('cat')),
            ),
            p?.pet === 'dog' || p?.pet === 'cat'
              ? h(
                  'div',
                  { class: 'pet-rename-row', id: 'pet-rename-row' },
                  h(
                    'p',
                    { id: 'pet-called', class: 'pet-called' },
                    p.petNames?.[p.pet] ? p.petNames[p.pet]! : 'Ainda sem nome',
                    en(p.petNames?.[p.pet] ? 'Their name' : 'No name yet', true),
                  ),
                  h(
                    'button',
                    { type: 'button', id: 'pet-rename', onclick: () => actions.renamePet(p.pet as PetId) },
                    bi('Renomear', 'Rename'),
                  ),
                )
              : null,
            h('h3', null, 'Balão'),
            en('Colour and shape only. The sentence stays the one you typed.', true),
            h(
              'div',
              { class: 'support-bubbles', role: 'group', 'aria-label': 'Balão' },
              ...BUBBLE_STYLES.map((style) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: `support-swatch wl-bubble wl-style-${style === 'classic' ? 'classic' : style}${p?.bubbleStyle === style || (!p?.bubbleStyle && style === 'classic') ? ' on' : ''}`,
                    'data-bubble': style,
                    onclick: () => actions.setBubble(style),
                  },
                  h('span', { class: 'pt' }, 'Oi!'),
                  h('span', { class: 'en' }, BUBBLE_STYLE_COPY[style].en),
                ),
              ),
            ),
          )
        : h('p', { class: 'support-locked', id: 'support-locked' }, 'Pets e balões voltam ao normal quando a assinatura acaba. O selo e o banner ficam.', en('Pets and bubbles return to the defaults when a subscription ends. The badge and the banner stay.', true)),
    ];
    root.replaceChildren(...nodes.filter((n): n is HTMLElement => n != null));
    const classic = root.querySelector('[data-bubble="classic"]');
    classic?.classList.remove('wl-style-classic');
  };
  paint();
  const off = game.on('profile', paint);
  openModal('support', root, { onClose: () => off() });
}

function choice(group: string, id: string | null, current: string | null, label: string, onclick: () => void): HTMLElement {
  const on = (current ?? null) === id;
  return h(
    'button',
    { type: 'button', class: on ? 'on' : '', 'data-perk': `${group}:${id ?? 'none'}`, onclick },
    label,
  );
}
