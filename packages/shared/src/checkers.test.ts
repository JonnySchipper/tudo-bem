import { describe, expect, it } from 'vitest';
import { applyMove, cpuPickMove, initialBoard, legalMoves, winner, idx, type Board } from './checkers.js';

describe('checkers', () => {
  it('starts with 12 pieces per side on dark squares', () => {
    const b = initialBoard();
    expect(b.filter((p) => p === 1).length).toBe(12);
    expect(b.filter((p) => p === -1).length).toBe(12);
  });

  it('you have forward slides and mandatory jumps when a capture exists', () => {
    const b = initialBoard();
    expect(legalMoves(b, 'you').length).toBeGreaterThan(0);
    const trap: Board = Array(64).fill(0) as Board;
    trap[idx(2, 5)] = 1;
    trap[idx(3, 4)] = -1;
    trap[idx(1, 4)] = 1;
    const moves = legalMoves(trap, 'you');
    expect(moves.every((m) => m.caps.length > 0)).toBe(true);
    expect(moves.some((m) => m.from === idx(2, 5) && m.to === idx(4, 3) && m.caps.includes(idx(3, 4)))).toBe(
      true,
    );
  });

  it('promotes to a king on the far row', () => {
    let b = initialBoard().map(() => 0) as Board;
    b[idx(1, 1)] = 1;
    b[idx(0, 0)] = 0;
    b = applyMove(b, { from: idx(1, 1), to: idx(0, 0), caps: [] });
    expect(b[idx(0, 0)]).toBe(2);
  });

  it('blocks slides when any jump is available', () => {
    const trap: Board = Array(64).fill(0) as Board;
    trap[idx(2, 5)] = 1;
    trap[idx(3, 4)] = -1;
    trap[idx(5, 5)] = 1;
    const moves = legalMoves(trap, 'you');
    expect(moves.every((m) => m.caps.length > 0)).toBe(true);
    expect(moves.some((m) => m.from === idx(2, 5))).toBe(true);
  });

  it('alternating sides: no legal moves means a win for the side to move', () => {
    const b = initialBoard().map(() => 0) as Board;
    b[idx(3, 3)] = 1;
    expect(winner(b, 'cpu')).toBe('you');
  });

  it('the CPU helper still picks legal moves for solo tests', () => {
    const m = cpuPickMove(initialBoard());
    expect(m).toBeTruthy();
    expect(legalMoves(initialBoard(), 'cpu').some((x) => x.from === m!.from && x.to === m!.to)).toBe(true);
  });
});
