/**
 * Language diary. Words the player earned, grouped by area and by how they were found.
 * Denominators come from the catalog (`progressLine`), never a number typed here.
 */
import { diaryBoard, progressLine } from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { closeModal, openModal } from './modal';

const closeBtn = (close: () => void) => h('button', { class: 'close ghost', type: 'button', onclick: close, 'aria-label': 'Fechar' }, '✕');

export function openDiary() {
  const boards = diaryBoard(game.profile?.diary);
  const close = openModal(
    'diary',
    h(
      'div',
      { class: 'panel diary-panel', id: 'diary-panel' },
      closeBtn(() => close()),
      h('h2', null, 'Diário'),
      en('Words you found. Each Portuguese word has one way in: camera, reading, conversation, or a game.'),
      ...boards.map((area) =>
        h(
          'section',
          { class: 'diary-area', 'data-area': area.id },
          h('h3', null, area.pt, en(area.en)),
          h('p', { class: 'diary-progress', 'data-progress': area.id }, progressLine(area)),
          area.empty
            ? h('p', { class: 'diary-empty' }, 'Sem palavras neste lugar ainda.', en('No words for this place yet.'))
            : h(
                'div',
                { class: 'diary-sources' },
                ...area.sources.map((src) => {
                  const words = area.words.filter((w) => w.source === src.source);
                  return h(
                    'div',
                    { class: 'diary-source', 'data-source': src.source },
                    h('h4', null, `${src.earned}/${src.total} ${src.label.pt}`, en(src.label.en)),
                    words.length
                      ? h(
                          'ul',
                          null,
                          ...words.map((w) =>
                            h(
                              'li',
                              { 'data-word': w.id },
                              h('b', null, w.pt),
                              en(w.en),
                              w.seed ? h('span', { class: 'diary-seed' }, 'amostra') : null,
                            ),
                          ),
                        )
                      : h('p', { class: 'diary-none' }, '—'),
                  );
                }),
              ),
        ),
      ),
    ),
  );
}

/** The photo card sits over the world and does not block the diary button. */
export function showPhoto(m: { ok: boolean; pt: string; en: string; areaPt?: string; progress?: string }) {
  document.getElementById('photo-capture')?.remove();
  const card = h(
    'div',
    { id: 'photo-capture', role: 'status' },
    h('div', { class: 'photo-flash', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'photo-frame' },
      h('p', { class: 'photo-kicker' }, m.ok ? 'Nova palavra' : 'Já no diário'),
      h('b', { class: 'photo-pt', id: 'photo-word' }, m.pt),
      en(m.en),
      m.progress ? h('p', { class: 'photo-progress', id: 'photo-progress' }, `${m.areaPt ?? 'Praça'}: ${m.progress}`) : null,
      h('button', { type: 'button', id: 'photo-close', onclick: () => card.remove() }, 'Ok'),
    ),
  );
  document.getElementById('ui')?.append(card);
}

export function syncCameraBanner() {
  const existing = document.getElementById('camera-banner');
  if (!game.cameraOn || !game.profile?.hasCamera) {
    game.cameraOn = false;
    existing?.remove();
    return;
  }
  if (existing) return;
  document.getElementById('ui')?.append(
    h('div', { id: 'camera-banner', role: 'status' }, 'Câmera aberta — fotografe algo na praça', en('Camera on — photograph something in the square')),
  );
}

export function closeDiary() {
  if (document.querySelector('[data-modal="diary"]')) closeModal();
}
