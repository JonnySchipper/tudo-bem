/**
 * Escola da Praça: one practice loop. The server deals the round and names the host who pays.
 * Dona Lúcia at her desk, the English on the chalkboard, the Portuguese on paper cards. A right card gets her stamp and the word is
 * chalked on the board; a wrong one shakes and is crossed out, and the others stay open. After a right answer, "De novo" deals another.
 */
import type { ServerMsg } from '@tudobem/shared';
import { h, en, bi } from './dom';
import { openModal } from './modal';
import { npcPortrait } from './pixelArt';
import { ambience } from '../ambience';

type PracticeOk = Extract<ServerMsg, { t: 'diary'; phase: 'practice'; ok: true }>;
type PracticeResult = Extract<ServerMsg, { t: 'diary'; phase: 'result' }>;

let closePractice: (() => void) | null = null;
let picked: string | null = null;
let again: (() => void) | null = null;

function setFace(expr: 'neutro' | 'feliz' | 'pensativo' | 'surpreso') {
  const slot = document.getElementById('escola-face');
  slot?.replaceChildren(npcPortrait('lucia', expr, 'escola-portrait'));
}

export function openEscolaPractice(msg: PracticeOk, answer: (choice: string) => void, practiceAgain?: () => void) {
  again = practiceAgain ?? null;
  picked = null;
  // a new round inside an open practice repaints the board instead of reopening the panel
  const live = document.getElementById('escola-round');
  const body = live ?? h('div', { id: 'escola-round' });
  body.replaceChildren(
    h(
      'div',
      { class: 'escola-board' },
      h('p', { class: 'escola-prompt', id: 'escola-prompt' }, 'Como se diz…', en(msg.en)),
      h('p', { class: 'escola-gloss chalk', id: 'escola-gloss' }, msg.en),
      h('p', { class: 'escola-chalked chalk', id: 'escola-chalked', lang: 'pt-BR', 'aria-live': 'polite' }),
      h('i', { class: 'escola-tray', 'aria-hidden': 'true' }),
    ),
    h(
      'div',
      { class: 'escola-options', id: 'escola-options' },
      ...msg.options.map((choice, i) => {
        const button = h(
          'button',
          {
            type: 'button',
            class: 'escola-choice',
            'data-choice': choice,
            lang: 'pt-BR',
            style: `--r:${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg;--d:${120 + i * 90}ms`,
            onclick: () => {
              if (button.disabled) return;
              picked = choice;
              for (const other of body.querySelectorAll('button')) other.disabled = true;
              button.classList.add('picked');
              answer(choice);
            },
          },
          choice,
        );
        return button;
      }),
    ),
  );
  document.getElementById('escola-result')?.replaceChildren();
  if (live) {
    setFace('neutro');
    return;
  }
  closePractice?.();
  closePractice = openModal(
    'escola',
    h(
      'div',
      { class: 'panel escola-panel', id: 'escola-practice' },
      h('button', { class: 'close ghost', type: 'button', onclick: () => closePractice?.(), 'aria-label': 'Fechar' }, '✕'),
      h(
        'div',
        { class: 'escola-head' },
        h('div', { id: 'escola-face' }, npcPortrait('lucia', 'neutro', 'escola-portrait')),
        h('div', null, h('h2', { id: 'escola-host' }, msg.host), en('Practice a word from your diary. Virtual RV only — beta is free.')),
      ),
      body,
      h('div', { id: 'escola-result', 'aria-live': 'polite' }),
    ),
    {
      onClose: () => {
        closePractice = null;
      },
    },
  );
}

export function showEscolaResult(msg: PracticeResult) {
  const slot = document.getElementById('escola-result');
  if (!slot) return;
  const card = picked ? document.querySelector<HTMLButtonElement>(`#escola-options button[data-choice="${CSS.escape(picked)}"]`) : null;
  card?.classList.remove('picked');
  if (msg.correct) {
    card?.classList.add('right');
    const chalk = document.getElementById('escola-chalked');
    if (chalk && picked) chalk.textContent = picked;
    setFace('feliz');
    ambience.sfx('stamp');
    window.setTimeout(() => ambience.sting('caderno'), 180);
  } else {
    if (card) {
      card.classList.add('wrong');
      card.disabled = true;
    }
    setFace('pensativo');
    ambience.sfx('nope');
  }
  const line = h(
    'div',
    { class: msg.correct ? 'escola-win' : 'escola-miss', id: 'escola-feedback' },
    h('p', null, msg.line.pt),
    en(msg.line.en),
    msg.granted ? h('p', { class: 'escola-granted', id: 'escola-granted' }, `Nova palavra: ${msg.granted.pt}`, en(msg.granted.en)) : null,
    msg.correct && again
      ? h(
          'button',
          {
            type: 'button',
            class: 'primary escola-again',
            id: 'escola-again',
            onclick: (e: Event) => {
              (e.currentTarget as HTMLButtonElement).disabled = true;
              again?.();
            },
          },
          bi('De novo', 'Again'),
        )
      : null,
  );
  slot.replaceChildren(line);
  if (!msg.correct) {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#escola-options button:not(.wrong)')) b.disabled = false;
  }
}

export function escolaPracticeOpen() {
  return !!document.querySelector('[data-modal="escola"]');
}
