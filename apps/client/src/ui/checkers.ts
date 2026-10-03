/**
 * Damas na mesa da praça: two sides, legal moves only, play until someone wins.
 */
import {
  applyMove,
  cpuPickMove,
  initialBoard,
  legalMoves,
  winner,
  xy,
  type Board,
  type Move,
  BOARD_SIZE,
} from '@tudobem/shared';
import { h, bi, en } from './dom';
import { openModal } from './modal';

const DARK_SQ = '#6b4a38';
const LIGHT_SQ = '#e8d4b0';

function cellEl(i: number, board: Board, sel: number | null, onPick: (i: number) => void): HTMLElement {
  const { x, y } = xy(i);
  const dark = (x + y) % 2 === 1;
  const p = board[i];
  let piece = '';
  if (p === 1 || p === 2) piece = p === 2 ? '♔' : '●';
  if (p === -1 || p === -2) piece = p === -2 ? '♚' : '○';
  return h(
    'button',
    {
      type: 'button',
      class: `ck-cell ${dark ? 'dark' : 'light'}${sel === i ? ' sel' : ''}${p ? ' has' : ''}`,
      style: `grid-column:${x + 1};grid-row:${y + 1}`,
      disabled: !dark,
      onclick: () => onPick(i),
      'aria-label': dark ? (piece || 'vazio') : undefined,
    },
    piece,
  );
}

export function openCheckers(): () => void {
  let board = initialBoard();
  let turn: 'you' | 'cpu' = 'you';
  let selected: number | null = null;
  let statusPt = 'Sua vez — clique numa peça sua.';
  let statusEn = 'Your turn — click one of your pieces.';
  let done: 'you' | 'cpu' | 'draw' | null = null;

  const status = h('p', { class: 'ck-status', id: 'ck-status' });
  const grid = h('div', { class: 'ck-grid', role: 'grid', 'aria-label': 'Tabuleiro de damas' });

  const render = () => {
    status.replaceChildren(statusPt, en(statusEn, true));
    grid.replaceChildren(...Array.from({ length: 64 }, (_, i) => cellEl(i, board, selected, pick)));
  };

  const end = (w: 'you' | 'cpu' | 'draw') => {
    done = w;
    if (w === 'you') {
      statusPt = 'Você ganhou!';
      statusEn = 'You won!';
    } else if (w === 'cpu') {
      statusPt = 'O vovô ganhou desta vez.';
      statusEn = 'Grandpa won this round.';
    } else {
      statusPt = 'Empate.';
      statusEn = 'Draw.';
    }
    render();
  };

  const cpuTurn = () => {
    const w = winner(board, 'cpu');
    if (w) return end(w);
    const m = cpuPickMove(board);
    if (!m) return end('you');
    board = applyMove(board, m);
    turn = 'you';
    const w2 = winner(board, 'you');
    if (w2) return end(w2);
    statusPt = 'Sua vez.';
    statusEn = 'Your turn.';
    selected = null;
    render();
  };

  const tryMove = (m: Move) => {
    board = applyMove(board, m);
    selected = null;
    const w = winner(board, 'cpu');
    if (w) return end(w);
    turn = 'cpu';
    statusPt = 'O vovô está pensando…';
    statusEn = 'Grandpa is thinking…';
    render();
    setTimeout(cpuTurn, 450);
  };

  const pick = (i: number) => {
    if (done || turn !== 'you') return;
    const p = board[i];
    const moves = legalMoves(board, 'you');
    if (!moves.length) return end(winner(board, 'you') ?? 'draw');

    if (selected !== null) {
      const m = moves.find((mv) => mv.from === selected && mv.to === i);
      if (m) return tryMove(m);
    }
    if (p === 1 || p === 2) {
      selected = i;
      render();
      return;
    }
    selected = null;
    render();
  };

  render();

  let closeModal: () => void;
  closeModal = openModal(
    'checkers',
    h(
      'div',
      { class: 'panel checkers-panel' },
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, bi('Damas', 'Checkers')),
      en('Click your piece, then a highlighted square. Jumps are mandatory when you can take a piece.'),
      status,
      grid,
      h(
        'button',
        {
          class: 'ghost',
          id: 'ck-reset',
          onclick: () => {
            board = initialBoard();
            turn = 'you';
            selected = null;
            done = null;
            statusPt = 'Sua vez — clique numa peça sua.';
            statusEn = 'Your turn — click one of your pieces.';
            render();
          },
        },
        bi('Jogar de novo', 'Play again'),
      ),
    ),
  );
  return closeModal;
}
