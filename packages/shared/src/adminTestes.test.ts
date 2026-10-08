import { describe, expect, it } from 'vitest';
import { canFoundAcademy } from './playerAcademy.js';
import { progressForWins, winsToBelt } from './academia.js';
import { applyAdminBelt, winsForRank } from './adminTestes.js';

describe('admin belt ranks follow the stripe ladder', () => {
  it('maps each belt at 0 stripes onto the cumulative win table', () => {
    expect(winsForRank('branca', 0)).toBe(0);
    expect(winsForRank('azul', 0)).toBe(winsToBelt('azul'));
    expect(winsForRank('roxa', 0)).toBe(60);
    expect(winsForRank('marrom', 0)).toBe(140);
    expect(winsForRank('preta', 0)).toBe(300);
  });

  it('uses the per-belt pace and promotes on the fourth stripe', () => {
    expect(winsForRank('branca', 1)).toBe(5);
    expect(winsForRank('azul', 2)).toBe(20 + 20);
    expect(winsForRank('roxa', 3)).toBe(60 + 60);
    expect(winsForRank('marrom', 3)).toBe(140 + 120);
    expect(progressForWins(winsForRank('branca', 4))).toEqual({ belt: 'azul', stripes: 0 });
    expect(progressForWins(winsForRank('preta', 4))).toEqual({ belt: 'preta', stripes: 4 });
  });

  it('sets a belt by wins, and a win step promotes', () => {
    const white = applyAdminBelt(undefined, { belt: 'branca', stripes: 3 });
    expect(white.ok && white.bjj).toMatchObject({ belt: 'branca', stripes: 3, wins: 15 });
    const up = applyAdminBelt(white.ok ? white.bjj : undefined, { deltaWins: 5 });
    expect(up.ok && up.bjj).toMatchObject({ belt: 'azul', stripes: 0, wins: 20 });
    const brown = applyAdminBelt(undefined, { belt: 'marrom' });
    expect(brown.ok && canFoundAcademy(brown.ok ? brown.bjj : undefined)).toBe(true);
    const back = applyAdminBelt(brown.ok ? brown.bjj : undefined, { wins: 139 });
    expect(back.ok && back.bjj.belt).toBe('roxa');
    expect(back.ok && canFoundAcademy(back.bjj)).toBe(false);
  });
});
