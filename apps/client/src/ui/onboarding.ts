import {
  BODY_TYPES,
  DEFAULT_APPEARANCE,
  FACE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  LABELS,
  MIN_AGE,
  SKIN_TONES,
  STARTER_OUTFITS,
  validateName,
  type Appearance,
  type Pronoun,
} from '@tudobem/shared';
import { readAuthSession } from '../auth/session';
import { h, en, ui } from './dom';
import { renderAvatarPreview } from '../render/avatar';

export interface NewProfile {
  name: string;
  pronoun: Pronoun;
  appearance: Appearance;
  confirm18: true;
}

function hero() {
  return h(
    'div',
    { class: 'hero' },
    h('h1', null, 'Tudo Bem'),
    h('p', null, 'Um bairro brasileiro pra fazer amigos e aprender português.'),
    h('p', { style: 'opacity:.8;font-weight:600;font-style:italic' }, 'A Brazilian neighborhood to make friends and learn Portuguese.'),
  );
}

export function runOnboarding(submit: (p: NewProfile) => void): { setError: (pt: string, en: string) => void } {
  const api = { setError: (_pt: string, _en: string) => {} };
  const root = h('div', { class: 'onboarding' });
  ui().append(root);

  const a: Appearance = { ...DEFAULT_APPEARANCE, ...STARTER_OUTFITS[0].set, skin: Math.floor(Math.random() * SKIN_TONES.length) };
  let pronoun: Pronoun = 'nome';
  const canvas = h('canvas', { width: 220, height: 280, class: 'creator-canvas' });
  let raf = 0;
  let wave = 0;
  const loop = (ts: number) => {
    const ch = canvas.clientHeight || 280;
    const scale = Math.min(2.45, Math.max(1.35, (ch - 28) / 100));
    renderAvatarPreview(canvas, a, null, false, ts / 1000, { scale, footY: ch - 14, view: 'front', emote: ts / 1000 - wave < 2.5 ? 'oi' : null, emoteT0: wave });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame((ts) => {
    wave = ts / 1000;
    loop(ts);
  });

  const go = h('button', { class: 'primary', style: 'font-size:1.1em', id: 'enter-praca', disabled: true }, 'Entrar na Praça →');
  const adult = h('input', { type: 'checkbox', id: 'confirm-18', required: true });
  const preconfirmed = readAuthSession()?.ageGateConfirmed === true;
  if (preconfirmed) {
    adult.checked = true;
    go.disabled = false;
  }
  adult.addEventListener('change', () => (go.disabled = !adult.checked));
  const name = h('input', { type: 'text', maxLength: 16, placeholder: 'Ex.: Jonny, Bia, Leo…', 'aria-label': 'Nome', id: 'avatar-name' });
  const nameErr = h('div', { class: 'feedback s1', style: 'display:none' });
  const setErr = (pt: string, enText: string) => {
    nameErr.style.display = 'inline-block';
    nameErr.replaceChildren(pt, h('br'), h('i', null, enText));
    go.disabled = !adult.checked;
  };
  api.setError = setErr;

  const refresh: (() => void)[] = [];
  const chips = <T extends string>(opts: readonly T[], label: (v: T) => string, get: () => T, set: (v: T) => void) => {
    const wrap = h('div', { class: 'chips' });
    const render = () =>
      wrap.replaceChildren(
        ...opts.map((o) =>
          h('button', { class: get() === o ? 'on' : '', type: 'button', onclick: () => (set(o), render()) }, label(o)),
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
        ),
      ),
    );
  renderPresets();
  refresh.push(renderPresets);
  const field = (pt: string, enText: string, control: HTMLElement) => h('div', { class: 'field' }, h('label', null, pt, en(enText)), control);

  const pronounChips = chips(
    ['ele', 'ela', 'nome'] as const,
    (v) => ({ ele: 'ele (he)', ela: 'ela (she)', nome: 'só meu nome (name only)' })[v],
    () => pronoun,
    (v) => (pronoun = v),
  );

  go.addEventListener('click', () => {
    const check = validateName(name.value);
    if (!check.ok) return setErr(check.reason.pt, check.reason.en);
    if (!adult.checked) return setErr(`Marque que você tem ${MIN_AGE} anos ou mais.`, `Please confirm you are ${MIN_AGE} or older.`);
    go.disabled = true;
    submit({ name: check.name, pronoun, appearance: { ...a }, confirm18: true });
  });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());

  root.replaceChildren(
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
          h('div', { class: 'preview' }, canvas),
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
          field('Como você se chama?', 'Display name (not your full real name)', h('div', null, name, nameErr)),
          field('Como devemos te chamar?', 'How should NPCs address you? (grammar agreement)', pronounChips),
          field('Visual inicial', 'Starter outfit (tee and jeans only). Hats and more clothes are at Nanda’s stall.', presets),
          field('Corpo', 'Body', chips(BODY_TYPES, (v) => LABELS.body[v], () => a.body, (v) => (a.body = v))),
          field('Tom de pele', 'Skin tone', swatches(SKIN_TONES, () => a.skin, (i) => (a.skin = i))),
          field('Rosto', 'Face', chips(FACE_STYLES, (v) => LABELS.face[v], () => a.face ?? 'suave', (v) => (a.face = v))),
          field('Cabelo', 'Hair', chips(HAIR_STYLES, (v) => LABELS.hair[v], () => a.hair, (v) => (a.hair = v))),
          field('Cor do cabelo', 'Hair color', swatches(HAIR_COLORS, () => a.hairColor, (i) => (a.hairColor = i))),
          h(
            'div',
            { class: 'creator-cta' },
            h(
              'label',
              { class: 'adult-confirm', for: 'confirm-18' },
              adult,
              h('span', null, `Tenho ${MIN_AGE} anos ou mais.`, en(`I am ${MIN_AGE} or older. Tudo Bem is an adult world.`, true)),
            ),
            h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'spacer' }), go),
          ),
        ),
      ),
    ),
  );
  name.focus();
  window.addEventListener('tb:game-start', () => cancelAnimationFrame(raf), { once: true });

  return api;
}

export function closeOnboarding() {
  document.querySelector('.onboarding')?.remove();
}
