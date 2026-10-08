import { describe, expect, it } from 'vitest';
import { rankBoard, type BoardEntry } from './leaderboards.js';

const e = (id: string, name: string, score: number): BoardEntry => ({ id, name, score });

describe('rankBoard', () => {
  it('orders by score descending', () => {
    const rows = rankBoard([e('a', 'Ana', 3), e('b', 'Bia', 10), e('c', 'Caio', 7)], 'a');
    expect(rows.map((r) => r.name)).toEqual(['Bia', 'Caio', 'Ana']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows[2]!.you).toBe(true);
  });

  it('ties share a rank and the next skips (1,2,2,4)', () => {
    const rows = rankBoard(
      [e('a', 'Ana', 10), e('b', 'Bia', 8), e('c', 'Caio', 8), e('d', 'Duda', 5)],
      'd',
    );
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ['Ana', 1],
      ['Bia', 2],
      ['Caio', 2],
      ['Duda', 4],
    ]);
  });

  it('breaks remaining ties by name then id', () => {
    const rows = rankBoard([e('2', 'Zoe', 5), e('1', 'Ana', 5), e('3', 'ana', 5)], '1');
    expect(rows.map((r) => r.id)).toEqual(['1', '3', '2']);
  });

  it('keeps only the top 10 and still shows the viewer outside', () => {
    const many = Array.from({ length: 12 }, (_, i) => e(`p${i}`, `P${String(i).padStart(2, '0')}`, 20 - i));
    const rows = rankBoard(many, 'p11');
    expect(rows).toHaveLength(11);
    expect(rows.slice(0, 10).map((r) => r.id)).toEqual(many.slice(0, 10).map((m) => m.id));
    expect(rows[10]).toMatchObject({ id: 'p11', rank: 12, you: true, score: 9 });
  });

  it('omits zero scores from the board but still shows a zero-score viewer', () => {
    const rows = rankBoard([e('a', 'Ana', 5), e('b', 'Bia', 0), e('c', 'Caio', 0)], 'b');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'a', rank: 1, score: 5 });
    expect(rows[1]).toMatchObject({ id: 'b', rank: 2, score: 0, you: true });
  });

  it('empty board with a viewer still returns their row', () => {
    expect(rankBoard([e('a', 'Ana', 0)], 'a')).toEqual([{ rank: 1, id: 'a', name: 'Ana', score: 0, you: true }]);
    expect(rankBoard([], 'ghost')).toEqual([]);
  });
});
