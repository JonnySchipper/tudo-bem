/**
 * Damas na mesa da praça: you play black (bottom) against the computer (white, top). Legal moves only; captures are mandatory.
 * A wooden board with real pieces: your movable pieces glow, the selected piece's landing squares are marked, the last move is tinted,
 * pieces slide to their square, taken pieces fade out, and a man that reaches the far row gets a gold crown.
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
  type Side,
} from '@tudobem/shared';
import { h, bi, en } from './dom';
import { openModal } from './modal';
import { ambience } from '../ambience';

const CPU_THINK_MS = 650;

export function openCheckers(): () => void {
  let board: Board = initialBoard();
  /** a stable id per piece so it can slide from square to square */
  let ids: (number | null)[] = board.map((p, i) => (p ? i : null));
  let turn: Side = 'you';
  let selected: number | null = null;
  let last: Move | null = null;
  let done: Side | 'draw' | null = null;
  let timer = 0;

  const status = h('p', { class: 'ck-status', id: 'ck-status', 'aria-live': 'polite' });
  const squares = h('div', { class: 'ck-squares', role: 'grid', 'aria-label': 'Tabuleiro de damas (Checkers board)' });
  const pieces = h('div', { class: 'ck-pieces', 'aria-hidden': 'true' });
  const pieceEls = new Map<number, HTMLElement>();
  const board_ = h('div', { class: 'ck-board' }, squares, pieces);

  const setStatus = (pt: string, enText: string) => status.replaceChildren(pt, en(enText, true));

  const statusForTurn = () => {
    if (done === 'draw') return setStatus('Empate.', 'Draw.');
    if (done) return setStatus(done === 'you' ? 'Preto ganhou!' : 'Branco ganhou!', done === 'you' ? 'Black won — you beat the computer!' : 'White won — the computer wins this one.');
    if (turn === 'you') setStatus('Vez do preto.', 'Your turn (black): click one of your glowing pieces.');
    else setStatus('Vez do branco.', 'The computer (white) is thinking…');
  };

  const place = (el: HTMLElement, i: number) => {
    const { x, y } = xy(i);
    el.style.setProperty('--x', String(x));
    el.style.setProperty('--y', String(y));
  };

  const render = () => {
    const moves = !done && turn === 'you' ? legalMoves(board, 'you') : [];
    const movable = new Set(moves.map((m) => m.from));
    const targets = new Set(selected === null ? [] : moves.filter((m) => m.from === selected).map((m) => m.to));
    squares.replaceChildren(
      ...board.map((_, i) => {
        const { x, y } = xy(i);
        const dark = (x + y) % 2 === 1;
        const cls = [
          'ck-cell',
          dark ? 'dark' : 'light',
          selected === i ? 'sel' : '',
          targets.has(i) ? 'target' : '',
          last && (last.from === i || last.to === i) ? 'last' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return h('button', {
          type: 'button',
          class: cls,
          style: `grid-column:${x + 1};grid-row:${y + 1}`,
          disabled: !dark,
          'data-cell': String(i),
          onclick: () => pick(i),
          'aria-label': dark ? (board[i] ? (board[i]! > 0 ? 'peça preta (black piece)' : 'peça branca (white piece)') : 'vazio (empty)') : undefined,
        });
      }),
    );
    // pieces: keep the element of a piece that moved so it slides; fade out the ones taken
    const alive = new Set<number>();
    board.forEach((p, i) => {
      const id = ids[i];
      if (!p || id == null) return;
      alive.add(id);
      let el = pieceEls.get(id);
      if (!el) {
        el = h('i', { class: 'ck-piece' }, h('b', { class: 'ck-crown' }, '♛'));
        pieceEls.set(id, el);
        pieces.append(el);
      }
      el.className = `ck-piece ${p > 0 ? 'black' : 'white'}${Math.abs(p) === 2 ? ' king' : ''}${movable.has(i) ? ' movable' : ''}${selected === i ? ' lifted' : ''}`;
      place(el, i);
    });
    for (const [id, el] of pieceEls) {
      if (alive.has(id)) continue;
      pieceEls.delete(id);
      el.classList.add('taken');
      window.setTimeout(() => el.remove(), 420);
    }
    statusForTurn();
  };

  const play = (m: Move) => {
    const wasKing = Math.abs(board[m.from] ?? 0) === 2;
    board = applyMove(board, m);
    const nextIds = [...ids];
    nextIds[m.to] = ids[m.from];
    nextIds[m.from] = null;
    for (const c of m.caps) nextIds[c] = null;
    ids = nextIds;
    last = m;
    selected = null;
    ambience.sfx(m.caps.length ? 'clink' : 'grab');
    if (!wasKing && Math.abs(board[m.to] ?? 0) === 2) window.setTimeout(() => ambience.sfx('ding'), 180);
    const next: Side = turn === 'you' ? 'cpu' : 'you';
    const w = winner(board, next);
    if (w) {
      done = w;
      turn = next;
      render();
      ambience.sting(w === 'you' ? 'win' : 'lose');
      return;
    }
    turn = next;
    render();
    if (turn === 'cpu') {
      timer = window.setTimeout(() => {
        const cm = cpuPickMove(board);
        if (cm) play(cm);
      }, CPU_THINK_MS);
    }
  };

  const pick = (i: number) => {
    if (done || turn !== 'you') return;
    const moves = legalMoves(board, 'you');
    if (selected !== null) {
      const m = moves.find((mv) => mv.from === selected && mv.to === i);
      if (m) return play(m);
    }
    selected = moves.some((mv) => mv.from === i) ? i : null;
    render();
  };

  const reset = () => {
    window.clearTimeout(timer);
    pieceEls.forEach((el) => el.remove());
    pieceEls.clear();
    board = initialBoard();
    ids = board.map((p, i) => (p ? i : null));
    turn = 'you';
    selected = null;
    last = null;
    done = null;
    render();
  };

  render();

  const close = openModal(
    'checkers',
    h(
      'div',
      { class: 'panel checkers-panel' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, bi('Damas', 'Checkers')),
      en('You play black against the computer. Jumps are mandatory when you can take a piece.'),
      h(
        'div',
        { class: 'ck-sides', 'aria-hidden': 'true' },
        h('span', { class: 'ck-side' }, h('i', { class: 'ck-dot black' }), bi('Preto', 'Black (you)')),
        h('span', { class: 'ck-side' }, h('i', { class: 'ck-dot white' }), bi('Branco', 'White (computer)')),
      ),
      status,
      board_,
      h('button', { class: 'ghost', id: 'ck-reset', onclick: reset }, bi('Jogar de novo', 'Play again')),
    ),
    { onClose: () => window.clearTimeout(timer) },
  );
  return close;
}
