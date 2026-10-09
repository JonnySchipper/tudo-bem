/**
 * Catch-up popup. On sign-in, anything `owedGrants` still lists (a feature that shipped after this
 * player already lived here) is offered once. Taking it asks the server to hand it over; Later
 * hides it until the next sign-in.
 */
import { FILM, owedGrants, type Bilingual, type CatchupGrant } from '@tudobem/shared';
import { game } from '../state';
import { h, en, ui } from './dom';
import { npcPortrait } from './pixelArt';
import { flyInto } from './diaryPanel';

const skipped = new Set<string>();
let openId: string | null = null;
let leaving = false;

function releaseModal() {
  if (!document.querySelector('[data-modal], #arrival-intro')) game.modalOpen = false;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && openId) defer(openId);
}

function closeOffer() {
  document.removeEventListener('keydown', onKey);
  document.getElementById('grant-offer')?.remove();
  openId = null;
  leaving = false;
  releaseModal();
}

function defer(id: string) {
  if (leaving) return;
  skipped.add(id);
  closeOffer();
}

/** How a grant looks in Júlia's hands. A row in `CATCHUP_GRANTS` without one here still gets the wrapped present and its title. */
interface GiftLook {
  art: () => HTMLElement;
  name: Bilingual;
  detail?: Bilingual;
  /** The HUD button the item flies into once it is yours (it may only appear with the profile that answers the claim). */
  hud?: string;
}

const GIFTS: Record<string, GiftLook> = {
  camera: {
    art: () => h('span', { class: 'gift-art' }, h('i', { class: 'cam-body' }, h('i', { class: 'cam-lens' }), h('i', { class: 'cam-flash' }))),
    name: { pt: 'Câmera', en: 'Camera' },
    detail: { pt: `${FILM.starter} filmes`, en: `${FILM.starter} shots of film` },
    hud: 'btn-camera',
  },
};

/** The generic present: a box with a ribbon, drawn in blocks like the camera. */
function presentArt(): HTMLElement {
  return h('span', { class: 'gift-art' }, h('i', { class: 'gift-box' }, h('i', { class: 'gift-lid' }), h('i', { class: 'gift-ribbon' })));
}

function lookFor(grant: CatchupGrant): GiftLook {
  return GIFTS[grant.id] ?? { art: presentArt, name: grant.title };
}

/** Lift the item out of the card and fly it to its HUD button (or the burger on a phone, where the bar is in the drawer). */
function flyGift(look: GiftLook) {
  const src = document.querySelector<HTMLElement>('#grant-offer .grant-item .gift-art');
  if (!src) return;
  const r = src.getBoundingClientRect();
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.classList.add('arrival-flyer');
  Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  ui().append(ghost);
  const shown = (id: string) => (document.getElementById(id)?.getBoundingClientRect().width ?? 0) > 0;
  const fallback = () => (shown('btn-burger') ? 'btn-burger' : look.hud ?? 'btn-burger');
  let tries = 0;
  const go = () => {
    if (look.hud && shown(look.hud)) return flyInto(ghost, look.hud);
    if (look.hud && ++tries < 8) return void window.setTimeout(go, 120);
    flyInto(ghost, fallback());
  };
  window.setTimeout(go, 300);
}

/** Júlia holds the item out on a little sunburst; its paper tag says what it is. */
function giftRow(grant: CatchupGrant, look: GiftLook): HTMLElement {
  return h(
    'div',
    { class: 'grant-give' },
    h('i', { class: 'grant-shine', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: `grant-item gift-${grant.id}`, id: `grant-gift-${grant.id}` },
      look.art(),
      h('span', { class: 'grant-tag' }, h('b', null, look.name.pt), look.detail ? h('small', null, look.detail.pt) : null),
    ),
    h('div', { class: 'grant-tag-en' }, en(look.detail ? `${look.name.en} · ${look.detail.en}` : look.name.en)),
  );
}

function show(grant: CatchupGrant, claim: (id: string) => void) {
  openId = grant.id;
  leaving = false;
  game.modalOpen = true;
  const look = lookFor(grant);
  const later = h(
    'button',
    { type: 'button', class: 'ghost', id: 'grant-later', onclick: () => defer(grant.id) },
    grant.later.pt,
    en(grant.later.en),
  );
  const take = h(
    'button',
    {
      type: 'button',
      class: 'primary',
      id: 'grant-accept',
      onclick: () => {
        if (leaving) return;
        leaving = true;
        take.setAttribute('disabled', '');
        later.setAttribute('disabled', '');
        claim(grant.id);
        // Júlia hands it over (the item hops toward you), then it flies to the HUD while the card folds away
        const offer = document.getElementById('grant-offer');
        offer?.classList.add('giving');
        flyGift(look);
        window.setTimeout(() => offer?.classList.add('leaving'), 300);
        window.setTimeout(closeOffer, 760);
      },
    },
    grant.accept.pt,
    en(grant.accept.en),
  );
  const root = h(
    'div',
    { id: 'grant-offer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'grant-title', 'data-modal': 'grant' },
    h(
      'div',
      { class: 'grant-card' },
      h(
        'div',
        { class: 'grant-head' },
        // needs_br: true
        h('p', { class: 'arrival-kicker' }, 'Novidade'),
        en('Something new'),
        h('h2', { id: 'grant-title' }, grant.title.pt),
        en(grant.title.en),
      ),
      h(
        'div',
        { class: 'arrival-julia' },
        h('div', { class: 'grant-julia' }, npcPortrait('julia', 'feliz', 'arrival-portrait'), h('b', { class: 'grant-nametag' }, 'Júlia')),
        h('div', { class: 'arrival-says' }, h('p', null, grant.body.pt), en(grant.body.en)),
      ),
      giftRow(grant, look),
      h('div', { class: 'arrival-actions' }, later, take),
    ),
  );
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) defer(grant.id);
  });
  document.addEventListener('keydown', onKey);
  ui().append(root);
  take.focus();
}

/** Offer the first feature this profile is still missing. Safe to call on every welcome and profile push. */
export function syncGrants(claim: (id: string) => void) {
  const profile = game.profile;
  // the plane intro is their way in; this popup is only for people already home
  if (!profile || profile.arrivalIntroDone === false) {
    if (openId && !leaving) closeOffer();
    return;
  }
  const next = owedGrants(profile).find((g) => !skipped.has(g.id));
  if (!next) {
    if (openId && !leaving) closeOffer();
    return;
  }
  if (openId) return;
  show(next, claim);
}
