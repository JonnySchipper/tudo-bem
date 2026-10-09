/**
 * Praça "Placar da Vila": Most Words Learned + Highest Current Streak.
 */
import type { BoardRow } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { openModal } from './modal.js';

const closeBtn = (close: () => void) => h('button', { class: 'close ghost', onclick: close, 'aria-label': 'Fechar (Close)' }, '✕');

function rowEl(r: BoardRow, kind: 'words' | 'streak') {
  const unit = kind === 'words' ? (r.score === 1 ? 'palavra' : 'palavras') : r.score === 1 ? 'dia' : 'dias';
  return h(
    'div',
    { class: `r lb-row${r.you ? ' you' : ''}` },
    h(
      'span',
      { class: 'lb-rank', 'aria-label': `#${r.rank}` },
      r.rank <= 3 ? h('i', { class: `lb-medal medal-${r.rank}` }, String(r.rank)) : `#${r.rank}`,
    ),
    h('b', { class: 'lb-name' }, r.name),
    r.you ? h('span', { class: 'lb-you' }, bi('você', 'you')) : '',
    h('span', { class: 'spacer' }),
    h('span', { class: 'lb-score' }, `${r.score} ${unit}`),
  );
}

function splitBoard(rows: BoardRow[]): { board: BoardRow[]; youOut?: BoardRow } {
  if (rows.length > 10 && rows[rows.length - 1]?.you && (rows[rows.length - 1]?.rank ?? 0) > 10) {
    return { board: rows.slice(0, -1), youOut: rows[rows.length - 1] };
  }
  return { board: rows };
}

function list(titlePt: string, titleEn: string, rows: BoardRow[], kind: 'words' | 'streak') {
  const { board, youOut } = splitBoard(rows);
  return h(
    'div',
    { class: `lb-board lb-${kind}` },
    h('h3', null, titlePt, en(` ${titleEn}`, true)),
    h(
      'div',
      { class: 'list-rows lb-list' },
      board.length ? '' : h('div', { class: 'r' }, 'Ninguém no placar ainda.', en('Nobody on the board yet — learn a word or keep a streak!')),
      ...board.map((r) => rowEl(r, kind)),
    ),
    youOut
      ? h('div', { class: 'lb-you-out' }, h('div', { class: 'section-title' }, 'Sua posição', en(' Your place', true)), rowEl(youOut, kind))
      : '',
  );
}

export function openLeaderboards(refresh: () => void) {
  const body = h('div', { class: 'lb-body' });
  const render = () => {
    const data = game.leaderboards;
    body.replaceChildren(
      data
        ? h(
            'div',
            { class: 'lb-cols' },
            list('Palavras aprendidas', 'Words learned', data.words, 'words'),
            list('Sequência atual', 'Current streak', data.streak, 'streak'),
          )
        : h('div', { class: 'r' }, 'Carregando…', en('Loading…')),
    );
  };
  render();
  refresh();
  const off = game.on('leaderboards', render);
  const poll = window.setInterval(refresh, 15_000);
  const close = openModal(
    'leaderboards',
    h('div', { class: 'panel lb-panel' }, closeBtn(() => close()), h('h2', null, 'Placar da Vila'), en('Village board — words learned and school streaks. Free for everyone.'), body),
    {
      onClose: () => {
        off();
        clearInterval(poll);
      },
    },
  );
}
