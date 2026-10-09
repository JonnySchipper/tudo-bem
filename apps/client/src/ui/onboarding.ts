import {
  BODY_TYPES,
  DEFAULT_APPEARANCE,
  FACE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  LABELS,
  LABELS_EN,
  SKIN_TONES,
  STARTER_OUTFITS,
  validateName,
  type Appearance,
  type Pronoun,
} from '@tudobem/shared';
import { h, en, ui } from './dom';
import { mountCharPreview } from '../render/pixel/charPreview';
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

/** Avatar creator. No age questions here: the only 18+ prompt is the optional tick on account signup. */
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

  const a: Appearance = { ...DEFAULT_APPEARANCE, ...STARTER_OUTFITS[0].set, skin: Math.floor(Math.random() * SKIN_TONES.length) };
  let pronoun: Pronoun = 'nome';
  // the composed pixel character (same layers as the world), shown at an integer scale with image-rendering: pixelated
  const canvas = h('canvas', { class: 'creator-canvas', id: 'avatar-preview' });
  const preview = mountCharPreview(canvas, () => ({ appearance: a, hat: null, parrot: false }), { waveOnStart: true });
  const turn = h('button', { class: 'stage-btn turn-btn', type: 'button', id: 'turn-avatar', 'aria-label': 'Girar o avatar (turn around)', onclick: () => preview.turn() }, '↻ Girar', en('Turn', true));
  const walkBtn = h('button', { class: 'stage-btn', type: 'button', id: 'walk-avatar', 'aria-pressed': 'false', 'aria-label': 'Andar (walk in place)' }, '▶ Andar', en('Walk', true));
  walkBtn.addEventListener('click', () => {
    const on = !preview.walking();
    preview.setWalking(on);
    walkBtn.setAttribute('aria-pressed', String(on));
    walkBtn.replaceChildren(on ? '■ Parar' : '▶ Andar', en(on ? 'Stop' : 'Walk', true));
  });

  const go = h('button', { class: 'primary', style: 'font-size:1.1em', id: 'enter-praca' }, 'Entrar na Praça →', en('Enter the Praça', true));
  const name = h('input', { type: 'text', maxLength: 16, placeholder: 'Ex.: Jonny, Bia, Leo… (e.g. Jonny, Bia, Leo…)', 'aria-label': 'Nome', id: 'avatar-name' });
  const nameErr = h('div', { class: 'feedback s1', style: 'display:none' });
  const setErr = (pt: string, enText: string) => {
    nameErr.style.display = 'inline-block';
    nameErr.replaceChildren(pt, h('br'), h('i', null, enText));
    go.disabled = false;
  };
  api.setError = setErr;

  const refresh: (() => void)[] = [];
  const chips = <T extends string>(opts: readonly T[], label: (v: T) => string, gloss: ((v: T) => string) | null, get: () => T, set: (v: T) => void) => {
    const wrap = h('div', { class: 'chips' });
    const render = () =>
      wrap.replaceChildren(
        ...opts.map((o) =>
          h('button', { class: get() === o ? 'on' : '', type: 'button', onclick: () => (set(o), render()) }, label(o), gloss ? en(gloss(o), true) : null),
        ),
      );
    render();
    refresh.push(render);
    return wrap;
  };
  const swatches = (colors: string[], get: () => number, set: (i: number) => void) => {
    const wrap = h('div', { class: 'swatches' });
    const render = () =>
      wrap.replaceChildren(
        ...colors.map((c, i) =>
          h('button', { class: get() === i ? 'on' : '', type: 'button', style: `background:${c}`, 'aria-label': `cor ${i + 1}`, onclick: () => (set(i), render()) }),
        ),
      );
    render();
    refresh.push(render);
    return wrap;
  };
  const outfit = () => STARTER_OUTFITS.find((o) => (Object.keys(o.set) as (keyof typeof o.set)[]).every((k) => a[k] === o.set[k]))?.id ?? '';
  const presets = h('div', { class: 'chips' });
  const renderPresets = () =>
    presets.replaceChildren(
      ...STARTER_OUTFITS.map((o) =>
        h(
          'button',
          {
            class: outfit() === o.id ? 'on' : '',
            type: 'button',
            'data-outfit': o.id,
            onclick: () => {
              Object.assign(a, o.set);
              refresh.forEach((r) => r());
            },
          },
          o.pt,
          en(o.en, true),
        ),
      ),
    );
  renderPresets();
  refresh.push(renderPresets);
  const field = (pt: string, enText: string, control: HTMLElement) => h('div', { class: 'field' }, h('label', null, pt, en(enText)), control);

  const pronounChips = chips(
    ['ele', 'ela', 'nome'] as const,
    (v) => ({ ele: 'ele (he)', ela: 'ela (she)', nome: 'só meu nome (name only)' })[v],
    null,
    () => pronoun,
    (v) => (pronoun = v),
  );

  go.addEventListener('click', () => {
    const check = validateName(name.value);
    if (!check.ok) return setErr(check.reason.pt, check.reason.en);
    go.disabled = true;
    submit({ name: check.name, pronoun, appearance: { ...a } });
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());

  const sec = (pt: string, enText: string, cls: string, ...kids: HTMLElement[]) =>
    h('section', { class: `cr-sec ${cls}` }, h('h3', null, pt, en(enText)), ...kids);

  root.append(
    hero(),
    h(
      'div',
      { class: 'panel creator-panel' },
      h('h2', null, 'Crie seu avatar'),
      h('p', { class: 'creator-lead' }, 'Nome, pronome, corpo, pele, rosto e cabelo — de graça. A roupa inicial já vem pronta.'),
      en('Name, pronoun, body, skin, face and hair are free. One starter outfit — hats and more clothes are at Nanda’s stall.'),
      h(
        'div',
        { class: 'creator' },
        h(
          'div',
          { class: 'creator-side' },
          h('div', { class: 'stage' }, h('div', { class: 'preview' }, canvas), h('div', { class: 'stage-btns' }, turn, walkBtn)),
          h(
            'div',
            { class: 'rules' },
            'Regras da praça',
            en('Square rules — kind chat only; no personal info (phone, address, school, social handles); no dating, alcohol, slurs or politics. Chat is filtered.'),
          ),
        ),
        h(
          'div',
          { class: 'creator-fields' },
          sec(
            'Quem é você?',
            'Who are you?',
            'cr-who',
            field('Como você se chama?', 'Display name (not your full real name)', h('div', null, name, nameErr)),
            field('Como devemos te chamar?', 'How should NPCs address you? (grammar agreement)', pronounChips),
          ),
          sec(
            'Seu visual',
            'Your look',
            'cr-look',
            field('Corpo', 'Body', chips(BODY_TYPES, (v) => LABELS.body[v], (v) => LABELS_EN.body[v], () => a.body, (v) => (a.body = v))),
            field('Rosto', 'Face', chips(FACE_STYLES, (v) => LABELS.face[v], (v) => LABELS_EN.face[v], () => a.face ?? 'suave', (v) => (a.face = v))),
            field('Tom de pele', 'Skin tone', swatches(SKIN_TONES, () => a.skin, (i) => (a.skin = i))),
            field('Cor do cabelo', 'Hair color', swatches(HAIR_COLORS, () => a.hairColor, (i) => (a.hairColor = i))),
            h('div', { class: 'field cr-wide' }, h('label', null, 'Cabelo', en('Hair')), chips(HAIR_STYLES, (v) => LABELS.hair[v], (v) => LABELS_EN.hair[v], () => a.hair, (v) => (a.hair = v))),
          ),
          sec('Roupa', 'Outfit', 'cr-outfit', field('Visual inicial', 'Starter outfit (tee and jeans only). Hats and more clothes are at Nanda’s stall.', presets)),
          h('div', { class: 'rules rules-m' }, 'Regras da praça', en('Square rules — kind chat only; no personal info (phone, address, school, social handles); no dating, alcohol, slurs or politics. Chat is filtered.')),
          h('div', { class: 'creator-cta' }, h('div', { class: 'row' }, h('span', { class: 'spacer' }), go)),
        ),
      ),
    ),
  );
  name.focus();
  window.addEventListener('tb:game-start', () => (preview.stop(), stopBackdrop?.()), { once: true });

  return api;
}

export function closeOnboarding() {
  stopBackdrop?.();
  stopBackdrop = null;
  document.querySelector('.onboarding')?.remove();
}
