/**
 * Naming dialog for the subscriber dog or cat.
 * Opens the first time that pet is shown without a name, and again from Renomear.
 * needs_br: true
 */
import { PET_NAME_PROMPT, suggestPetName, validatePetName, type PetId } from '@tudobem/shared';
import { game } from '../state';
import { bi, h, en } from './dom';
import { closeModal, modalId, openModal } from './modal.js';

let saveName: (pet: PetId, name: string) => void = () => {};
let errEl: HTMLElement | null = null;
/** `${playerId}:${pet}` we already asked about during this showing. A reload or putting the pet away asks again. */
let asked: string | null = null;

export function bindPetName(save: (pet: PetId, name: string) => void): void {
  saveName = save;
}

/** True when the dialog took the message (so the toast can stay quiet). */
export function showPetNameError(pt: string, enText: string): boolean {
  if (!errEl || modalId() !== 'pet-name') return false;
  errEl.hidden = false;
  errEl.replaceChildren(pt, en(enText, true));
  return true;
}

/**
 * An equipped dog or cat with no name yet: ask once per time it is on screen.
 * Dismissing waits until the next showing (reload, or the pet was put away and brought back).
 */
export function maybeAskPetName(): void {
  const p = game.profile;
  const pet = p?.pet;
  if (!p || !game.room || (pet !== 'dog' && pet !== 'cat')) {
    asked = null;
    return;
  }
  if (p.petNames?.[pet]) return;
  const key = `${p.id}:${pet}`;
  if (asked === key || modalId() === 'pet-name') return;
  asked = key;
  openPetName(pet);
}

/** The naming dialog. `rename` prefills the current name. */
export function openPetName(pet: PetId): void {
  const prompt = PET_NAME_PROMPT[pet];
  const current = game.profile?.petNames?.[pet] ?? '';
  errEl = h('p', { class: 'pet-name-err', id: 'pet-name-err', hidden: true });
  const input = h('input', {
    id: 'pet-name-input',
    class: 'pet-name-input',
    type: 'text',
    maxlength: '16',
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    value: current,
    'aria-label': prompt.pt,
  }) as HTMLInputElement;
  const save = () => {
    const shaped = validatePetName(input.value);
    if (!shaped.ok) {
      showPetNameError(shaped.reason.pt, shaped.reason.en);
      input.focus();
      return;
    }
    if (errEl) errEl.hidden = true;
    saveName(pet, shaped.name);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });
  const root = h(
    'div',
    { class: 'panel pet-name-panel', id: 'pet-name-panel', role: 'dialog', 'aria-labelledby': 'pet-name-title' },
    h('button', { class: 'close ghost', type: 'button', onclick: () => closeModal(), 'aria-label': 'Fechar' }, '✕'),
    h('h2', { id: 'pet-name-title' }, prompt.pt),
    en(prompt.en),
    input,
    errEl,
    h(
      'div',
      { class: 'pet-name-actions' },
      h(
        'button',
        {
          type: 'button',
          id: 'pet-name-roll',
          onclick: () => {
            input.value = suggestPetName(Math.random, input.value);
            input.focus();
            if (errEl) errEl.hidden = true;
          },
        },
        bi('Sortear', 'Suggest a name'),
      ),
      h('button', { type: 'button', class: 'primary', id: 'pet-name-save', onclick: save }, bi('Salvar', 'Save')),
    ),
  );
  const off = game.on('profile', () => {
    const shaped = validatePetName(input.value);
    const saved = game.profile?.petNames?.[pet];
    if (shaped.ok && saved === shaped.name) close();
  });
  const close = openModal('pet-name', root, { onClose: () => off() });
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
}
