/**
 * Catch-up popup. On sign-in, anything `owedGrants` still lists (a feature that shipped after this
 * player already lived here) is offered once. Taking it asks the server to hand it over; Later
 * hides it until the next sign-in.
 */
import { FILM, owedGrants, type CatchupGrant } from '@tudobem/shared';
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

/** The camera button appears with the profile that answers the claim (it was hidden until then). */
function flyCamera() {
  const src = document.querySelector<HTMLElement>('#grant-gift-camera .gift-art');
  if (!src) return;
  const r = src.getBoundingClientRect();
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.classList.add('arrival-flyer');
  Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  ui().append(ghost);
  const shown = (id: string) => (document.getElementById(id)?.getBoundingClientRect().width ?? 0) > 0;
  let tries = 0;
  const go = () => {
    if (shown('btn-camera')) return flyInto(ghost, 'btn-camera');
    if (++tries < 8) return void window.setTimeout(go, 120);
    flyInto(ghost, shown('btn-burger') ? 'btn-burger' : 'btn-camera');
  };
  window.setTimeout(go, 280);
}

function cameraArt(): HTMLElement {
  return h(
    'span',
    { class: 'gift-art' },
    h('i', { class: 'cam-body' }, h('i', { class: 'cam-lens' }), h('i', { class: 'cam-flash' })),
  );
}

function giftRow(grant: CatchupGrant): HTMLElement {
  if (grant.id === 'camera') {
    return h(
      'div',
      { class: 'arrival-gifts one' },
      h(
        'div',
        { class: 'arrival-gift gift-camera', id: 'grant-gift-camera' },
        cameraArt(),
        h('b', null, 'Câmera'),
        h('small', null, `${FILM.starter} filmes`),
      ),
    );
  }
  return h('div', { class: 'arrival-gifts one' }, h('div', { class: 'arrival-gift' }, h('b', null, grant.title.pt)));
}

function show(grant: CatchupGrant, claim: (id: string) => void) {
  openId = grant.id;
  leaving = false;
  game.modalOpen = true;
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
        if (grant.id === 'camera') flyCamera();
        document.getElementById('grant-offer')?.classList.add('leaving');
        window.setTimeout(closeOffer, 520);
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
        npcPortrait('julia', 'feliz', 'arrival-portrait'),
        h('div', { class: 'arrival-says' }, h('b', { class: 'arrival-name' }, 'Júlia'), h('p', null, grant.body.pt), en(grant.body.en)),
      ),
      giftRow(grant),
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
