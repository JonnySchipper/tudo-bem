/**
 * Damas na mesa da praça: two human sides, legal moves only, play until someone wins.
 */
import {
  applyMove,
  initialBoard,
  legalMoves,
  winner,
  xy,
  type Board,
  type Move,
  type Side,
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
  /** Bottom pieces (●) vs top (○); same engine sides as before. */
  let turn: Side = 'you';
  let selected: number | null = null;
  let statusPt = 'Vez do preto — clique numa peça.';
  let statusEn = 'Black’s turn — click one of your pieces.';
  let done: Side | 'draw' | null = null;

  const status = h('p', { class: 'ck-status', id: 'ck-status' });
  const grid = h('div', { class: 'ck-grid', role: 'grid', 'aria-label': 'Tabuleiro de damas' });

  const sideLabel = (s: Side) => (s === 'you' ? { pt: 'Preto', en: 'Black' } : { pt: 'Branco', en: 'White' });

  const render = () => {
    status.replaceChildren(statusPt, en(statusEn, true));
    grid.replaceChildren(...Array.from({ length: 64 }, (_, i) => cellEl(i, board, selected, pick)));
  };

  const end = (w: Side | 'draw') => {
    done = w;
    if (w === 'draw') {
      statusPt = 'Empate.';
      statusEn = 'Draw.';
    } else {
      const lab = sideLabel(w);
      statusPt = `${lab.pt} ganhou!`;
      statusEn = `${lab.en} won!`;
    }
    render();
  };

  const tryMove = (m: Move) => {
    board = applyMove(board, m);
    selected = null;
    const next: Side = turn === 'you' ? 'cpu' : 'you';
    const w = winner(board, next);
    if (w) return end(w);
    turn = next;
    const lab = sideLabel(turn);
    statusPt = `Vez do ${lab.pt.toLowerCase()}.`;
    statusEn = `${lab.en}’s turn.`;
    render();
  };

  const pick = (i: number) => {
    if (done) return;
    const moves = legalMoves(board, turn);
    if (!moves.length) return end(winner(board, turn) ?? 'draw');

    if (selected !== null) {
      const m = moves.find((mv) => mv.from === selected && mv.to === i);
      if (m) return tryMove(m);
    }
    const p = board[i];
    const mine = turn === 'you' ? p === 1 || p === 2 : p === -1 || p === -2;
    if (mine && moves.some((mv) => mv.from === i)) {
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
      en('Two players, one device. Jumps are mandatory when you can take a piece.'),
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
            statusPt = 'Vez do preto — clique numa peça.';
            statusEn = 'Black’s turn — click one of your pieces.';
            render();
          },
        },
        bi('Jogar de novo', 'Play again'),
      ),
    ),
  );
  return closeModal;
}
