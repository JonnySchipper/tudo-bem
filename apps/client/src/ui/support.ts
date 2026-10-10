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
  breedById,
  hasPerkAccess,
  isPreviewUnlocked,
  type BubbleStyle,
  type PetId,
} from '@tudobem/shared';
import { icon } from '../art/ui';
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
  /** The pet shop panel on Meus pets (#234): every adopted pet, take one out, collars and toys. */
  openPets?: () => void;
  /** Take one owned pet out (null: everyone home). */
  takePet?: (petId: string | null) => void;
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
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, 'Apoiar o Tudo Bem'),
      en('Support Tudo Bem'),
      h(
        'div',
        { class: 'support-free', id: 'support-free' },
        icon('coracao', 32),
        h('p', null, 'Aprender é sempre grátis.', en('Learning is always free. Every lesson, word and nameplate.', true)),
      ),
      h(
        'div',
        { class: `support-price${ready ? '' : ' soon'}`, id: 'support-price' },
        h('p', null, h('b', null, SUBSCRIPTION_PRICE.pt), en(`${SUBSCRIPTION_PRICE.en}. Optional, for anyone who wants to help.`, true)),
        ready ? null : h('span', { class: 'support-soon', id: 'support-soon' }, 'em breve', en('coming soon', true)),
      ),
      h('h3', { class: 'support-head' }, 'O que você ganha'),
      en('What you get. Looks only: nothing here helps you learn faster or win.', true),
      h(
        'ul',
        { class: 'support-perks' },
        perk('badge', 'Selo de fundador', 'Founder badge. Stays, even if you cancel.'),
        perk('banner', 'Banner dos fundadores na kitnet', 'Founders banner for your kitnet. Stays too.'),
        perk('praia', 'Prévia da Praia', `Beach preview, ${isPreviewUnlocked(p ?? {}, 'praia') ? 'unlocked' : 'while the subscription is active'}.`),
        perk('pet', 'Cachorro e gato que te seguem', 'A dog and a cat that follow you.'),
        perk('bubble', 'Balões de conversa coloridos', 'Chat bubble colours. The words never change.'),
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
              btn.replaceChildren('em breve', en('coming soon', true));
            }
          },
        },
        ...(ready ? ['Assinar', en('Subscribe', true)] : ['em breve', en('coming soon', true)]),
      ),
      h('p', { class: 'support-note' }, en(ready ? 'Subscribe for $10/month. Learning stays free.' : 'Checkout is not open yet. Everything in the game stays free in the meantime.', true)),
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
              choice('pet', null, p?.pet ?? null, 'Nenhum', 'None', () => actions.setPet(null)),
              choice('pet', 'dog', p?.pet ?? null, PET_COPY.dog.pt, PET_COPY.dog.en, () => actions.setPet('dog')),
              choice('pet', 'cat', p?.pet ?? null, PET_COPY.cat.pt, PET_COPY.cat.en, () => actions.setPet('cat')),
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
            p?.pets?.length && actions.takePet
              ? h(
                  'div',
                  { class: 'support-row support-owned', id: 'support-owned', role: 'group', 'aria-label': 'Seus pets (Your pets)' },
                  ...p.pets.map((pet) => {
                    const on = pet.id === p.activePetId;
                    return h(
                      'button',
                      { type: 'button', class: on ? 'on' : '', 'data-pet-id': pet.id, onclick: () => actions.takePet?.(on ? null : pet.id) },
                      pet.name ?? 'Sem nome',
                      en(`${breedById(pet.breed)?.pt ?? pet.breed}${on ? ' · out' : ''}`, true),
                    );
                  }),
                )
              : null,
            actions.openPets
              ? h(
                  'p',
                  { class: 'support-petshop', id: 'support-petshop' },
                  'Mais raças no Pet Shop do Seu Dito, na Rua dos Ipês.',
                  en('More breeds at Seu Dito’s pet shop, on Ipê Street.', true),
                  h('button', { type: 'button', id: 'support-my-pets', onclick: () => (closeModal(), actions.openPets?.()) }, bi(`Meus pets (${p?.pets?.length ?? 0})`, 'My pets')),
                )
              : null,
            h('h3', null, 'Balão', en('Bubble', true)),
            en('Colour and shape only. The sentence stays the one you typed.', true),
            h(
              'div',
              { class: 'support-bubbles', role: 'group', 'aria-label': 'Balão (Bubble)' },
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

/** One perk row: a small pixel icon, the Portuguese name, the English gloss. */
function perk(kind: 'badge' | 'banner' | 'praia' | 'pet' | 'bubble', pt: string, enText: string): HTMLElement {
  return h('li', null, h('i', { class: `support-ico support-ico-${kind}`, 'aria-hidden': 'true' }), h('span', null, pt, en(enText, true)));
}

function choice(group: string, id: string | null, current: string | null, label: string, gloss: string, onclick: () => void): HTMLElement {
  const on = (current ?? null) === id;
  return h(
    'button',
    { type: 'button', class: on ? 'on' : '', 'data-perk': `${group}:${id ?? 'none'}`, onclick },
    label,
    gloss.toLowerCase() === label.toLowerCase() ? null : en(gloss, true),
  );
}
