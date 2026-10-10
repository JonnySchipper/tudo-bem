/**
 * The look editor ("Visual" in the HUD menu): body, skin, face, hair, an extra and a starter outfit, all free, changed any time. This used
 * to be the first step of a new account; now a new player picks a passenger on the plane (ui/flightIntro.ts) and customizes here later.
 * Saving sends `updateAppearance`; hats stay in the wardrobe (Chapéus) and Nanda's stall.
 */
import {
  BODY_TYPES,
  DEFAULT_APPEARANCE,
  EXTRA_STYLES,
  FACE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  LABELS,
  LABELS_EN,
  SKIN_TONES,
  STARTER_OUTFITS,
  type Appearance,
} from '@tudobem/shared';
import { h, en } from './dom';
import { closeModal, openModal } from './modal';
import { mountCharPreview } from '../render/pixel/charPreview';

export interface LookEditorOpts {
  appearance: Appearance;
  hat?: string | null;
  onSave: (a: Appearance) => void;
}

export function openLookEditor(opts: LookEditorOpts): void {
  const start: Appearance = { ...DEFAULT_APPEARANCE, ...opts.appearance };
  const a: Appearance = { ...start };
  // the composed pixel character (same layers as the world), shown at an integer scale with image-rendering: pixelated
  const canvas = h('canvas', { class: 'creator-canvas', id: 'avatar-preview' });
  const preview = mountCharPreview(canvas, () => ({ appearance: a, hat: opts.hat ?? null, parrot: false }));
  const turn = h('button', { class: 'stage-btn turn-btn', type: 'button', id: 'turn-avatar', 'aria-label': 'Girar o avatar (turn around)', onclick: () => preview.turn() }, '↻ Girar', en('Turn', true));
  const walkBtn = h('button', { class: 'stage-btn', type: 'button', id: 'walk-avatar', 'aria-pressed': 'false', 'aria-label': 'Andar (walk in place)' }, '▶ Andar', en('Walk', true));
  walkBtn.addEventListener('click', () => {
    const on = !preview.walking();
    preview.setWalking(on);
    walkBtn.setAttribute('aria-pressed', String(on));
    walkBtn.replaceChildren(on ? '■ Parar' : '▶ Andar', en(on ? 'Stop' : 'Walk', true));
  });

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
  const outfit = () => STARTER_OUTFITS.find((o) => o.set.top === a.top && o.set.bottom === a.bottom)?.id ?? '';
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
            // the outfit's cut, keeping the colours the passenger came with
            onclick: () => {
              a.top = o.set.top;
              a.bottom = o.set.bottom;
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
  const sec = (pt: string, enText: string, cls: string, ...kids: HTMLElement[]) => h('section', { class: `cr-sec ${cls}` }, h('h3', null, pt, en(enText)), ...kids);

  const save = h('button', { class: 'primary', type: 'button', id: 'look-save' }, 'Salvar ✓', en('Save', true));
  const reset = h('button', { class: 'stage-btn', type: 'button', id: 'look-reset' }, '↺ Desfazer', en('Undo changes', true));
  reset.addEventListener('click', () => {
    Object.assign(a, start);
    refresh.forEach((r) => r());
  });
  save.addEventListener('click', () => {
    opts.onSave({ ...a });
    closeModal();
  });

  const panel = h(
    'div',
    { class: 'panel creator-panel look-editor', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'look-title' },
    h('button', { class: 'look-close', type: 'button', 'aria-label': 'Fechar (Close)', onclick: () => closeModal() }, '✕'),
    h('h2', { id: 'look-title' }, 'Seu visual'),
    h('p', { class: 'creator-lead' }, 'Corpo, pele, rosto, cabelo e roupa inicial — de graça, quando quiser.'),
    en('Body, skin, face, hair and starter outfit are free to change any time. Hats are in Chapéus and at Nanda’s stall.'),
    h(
      'div',
      { class: 'creator' },
      h('div', { class: 'creator-side' }, h('div', { class: 'stage' }, h('div', { class: 'preview' }, canvas), h('div', { class: 'stage-btns' }, turn, walkBtn))),
      h(
        'div',
        { class: 'creator-fields' },
        sec(
          'Seu visual',
          'Your look',
          'cr-look',
          field('Corpo', 'Body', chips(BODY_TYPES, (v) => LABELS.body[v], (v) => LABELS_EN.body[v], () => a.body, (v) => (a.body = v))),
          field('Rosto', 'Face', chips(FACE_STYLES, (v) => LABELS.face[v], (v) => LABELS_EN.face[v], () => a.face ?? 'suave', (v) => (a.face = v))),
          field('Tom de pele', 'Skin tone', swatches(SKIN_TONES, () => a.skin, (i) => (a.skin = i))),
          field('Cor do cabelo', 'Hair color', swatches(HAIR_COLORS, () => a.hairColor, (i) => (a.hairColor = i))),
          h('div', { class: 'field cr-wide' }, h('label', null, 'Cabelo', en('Hair')), chips(HAIR_STYLES, (v) => LABELS.hair[v], (v) => LABELS_EN.hair[v], () => a.hair, (v) => (a.hair = v))),
          h('div', { class: 'field cr-wide' }, h('label', null, 'Detalhe', en('Extra')), chips(EXTRA_STYLES, (v) => LABELS.extra[v], (v) => LABELS_EN.extra[v], () => a.extra ?? 'nenhum', (v) => (a.extra = v))),
        ),
        sec('Roupa', 'Outfit', 'cr-outfit', field('Visual inicial', 'Starter outfit (both free). Hats and more clothes are at Nanda’s stall.', presets)),
        h('div', { class: 'creator-cta' }, h('div', { class: 'row' }, reset, h('span', { class: 'spacer' }), save)),
      ),
    ),
  );
  openModal('look', panel, { onClose: () => preview.stop() });
  save.focus();
}
