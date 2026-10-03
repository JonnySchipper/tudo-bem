/**
 * Escola da Praça: one practice loop. The server deals the round and names the host who pays.
 */
import type { ServerMsg } from '@tudobem/shared';
import { h, en } from './dom';
import { openModal } from './modal';

type PracticeOk = Extract<ServerMsg, { t: 'diary'; phase: 'practice'; ok: true }>;
type PracticeResult = Extract<ServerMsg, { t: 'diary'; phase: 'result' }>;

let closePractice: (() => void) | null = null;

export function openEscolaPractice(msg: PracticeOk, answer: (choice: string) => void) {
  closePractice?.();
  const body = h('div', { id: 'escola-round' });
  const paint = (prompt: string, options: string[]) => {
    body.replaceChildren(
      h('p', { class: 'escola-prompt', id: 'escola-prompt' }, 'Como se diz…', en(prompt)),
      h('p', { class: 'escola-gloss', id: 'escola-gloss' }, prompt),
      h(
        'div',
        { class: 'escola-options', id: 'escola-options' },
        ...options.map((choice) => {
          const button = h(
            'button',
            {
              type: 'button',
              class: 'escola-choice',
              'data-choice': choice,
              onclick: () => {
                if (button.disabled) return;
                for (const other of body.querySelectorAll('button')) other.disabled = true;
                answer(choice);
              },
            },
            choice,
          );
          return button;
        }),
      ),
    );
  };
  paint(msg.en, msg.options);
  closePractice = openModal(
    'escola',
    h(
      'div',
      { class: 'panel escola-panel', id: 'escola-practice' },
      h('button', { class: 'close ghost', type: 'button', onclick: () => closePractice?.(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', { id: 'escola-host' }, msg.host),
      en('Practice a word from your diary. Virtual RV only — beta is free.'),
      body,
      h('div', { id: 'escola-result' }),
    ),
  );
}

export function showEscolaResult(msg: PracticeResult) {
  const slot = document.getElementById('escola-result');
  const line = h(
    'div',
    { class: msg.correct ? 'escola-win' : 'escola-miss', id: 'escola-feedback' },
    h('p', null, msg.line.pt),
    en(msg.line.en),
    msg.granted ? h('p', { class: 'escola-granted', id: 'escola-granted' }, `Nova palavra: ${msg.granted.pt}`, en(msg.granted.en)) : null,
  );
  if (!slot) return;
  slot.replaceChildren(line);
  if (!msg.correct) {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#escola-options button')) b.disabled = false;
  }
}

export function escolaPracticeOpen() {
  return !!document.querySelector('[data-modal="escola"]');
}
