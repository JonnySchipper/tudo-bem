import { randomPassengerLook, validateName, type Appearance, type Pronoun } from '@tudobem/shared';
import { h, en, ui } from './dom';
import { createIntroHeroScene } from './introHeroScene';

let stopBackdrop: (() => void) | null = null;

export interface NewProfile {
  name: string;
  pronoun: Pronoun;
  appearance: Appearance;
}

function hero() {
  return h(
    'div',
    { class: 'hero' },
    h('h1', null, 'Tudo Bem'),
  );
}

/**
 * The new account's one quick step: a name (Lia calls it out on the plane) and how NPCs address you. No avatar creator here: the player
 * picks which passenger they are in the flight in (ui/flightIntro.ts), and customizes the look later from the HUD (ui/lookEditor.ts).
 * Until then the account wears a random passenger's look. No age questions: the only 18+ prompt is the optional tick on account signup.
 */
export function runOnboarding(submit: (p: NewProfile) => void): { setError: (pt: string, en: string) => void } {
  const api = { setError: (_pt: string, _en: string) => {} };
  const root = h('div', { class: 'onboarding' });
  // the same pixel Vila Ipê the title screen shows (the intro snapshot), dimmed, behind the card
  const scene = createIntroHeroScene();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.append(scene.el, h('div', { class: 'onb-dim', 'aria-hidden': 'true' }));
  ui().append(root);
  scene.frame();
  const stopPan = scene.mountPan(reduced);
  const onResize = () => scene.frame();
  window.addEventListener('resize', onResize);
  stopBackdrop = () => {
    stopPan();
    window.removeEventListener('resize', onResize);
  };

  let pronoun: Pronoun = 'nome';
  const go = h('button', { class: 'primary', style: 'font-size:1.1em', id: 'enter-praca' }, 'Embarcar ✈', en('Board the plane', true));
  const name = h('input', { type: 'text', maxLength: 16, placeholder: 'Ex.: Jonny, Bia, Leo… (e.g. Jonny, Bia, Leo…)', 'aria-label': 'Nome', id: 'avatar-name', autocomplete: 'nickname' });
  const nameErr = h('div', { class: 'feedback s1', style: 'display:none' });
  const setErr = (pt: string, enText: string) => {
    nameErr.style.display = 'inline-block';
    nameErr.replaceChildren(pt, h('br'), h('i', null, enText));
    go.disabled = false;
  };
  api.setError = setErr;

  const pronounChips = h('div', { class: 'chips' });
  const renderPronouns = () =>
    pronounChips.replaceChildren(
      ...(['ele', 'ela', 'nome'] as const).map((v) =>
        h('button', { class: pronoun === v ? 'on' : '', type: 'button', onclick: () => ((pronoun = v), renderPronouns()) }, { ele: 'ele (he)', ela: 'ela (she)', nome: 'só meu nome (name only)' }[v]),
      ),
    );
  renderPronouns();
  const field = (pt: string, enText: string, control: HTMLElement) => h('div', { class: 'field' }, h('label', null, pt, en(enText)), control);

  go.addEventListener('click', () => {
    const check = validateName(name.value);
    if (!check.ok) return setErr(check.reason.pt, check.reason.en);
    go.disabled = true;
    submit({ name: check.name, pronoun, appearance: randomPassengerLook() });
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());

  root.append(
    hero(),
    h(
      'div',
      { class: 'panel creator-panel name-card' },
      h('div', { class: 'name-card-ticket', 'aria-hidden': 'true' }, h('span', null, '✈'), h('b', null, 'GRU'), h('i', null, 'Vila Ipê · SP')),
      h('h2', null, 'Seu cartão de embarque'),
      h('p', { class: 'creator-lead' }, 'Só o seu nome. Você escolhe quem você é lá no avião.'),
      en('Just your name. You pick who you are on the plane, and you can change your look any time (Menu → Visual).'),
      h(
        'div',
        { class: 'creator-fields' },
        h(
          'section',
          { class: 'cr-sec creator-who' },
          field('Como você se chama?', 'Display name (not your full real name)', h('div', null, name, nameErr)),
          field('Como devemos te chamar?', 'How should NPCs address you? (grammar agreement)', pronounChips),
        ),
        h('div', { class: 'rules' }, 'Regras da praça', en('Square rules — kind chat only; no personal info (phone, address, school, social handles); no dating, alcohol, slurs or politics. Chat is filtered.')),
        h('div', { class: 'creator-cta' }, h('div', { class: 'row' }, h('span', { class: 'spacer' }), go)),
      ),
    ),
  );
  name.focus();
  window.addEventListener('tb:game-start', () => stopBackdrop?.(), { once: true });

  return api;
}

export function closeOnboarding() {
  stopBackdrop?.();
  stopBackdrop = null;
  document.querySelector('.onboarding')?.remove();
}
