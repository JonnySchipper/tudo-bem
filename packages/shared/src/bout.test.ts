import { describe, expect, it } from 'vitest';
import { ADJACENT_POSITIONS, BOUT_PROTOCOL_VERSION, CROWD, CROWD_SHOUTS, REF_LINES, endLine, formatBoutClock, positionOf, rungOfPosition, signalForPoints } from './index.js';

describe('protocol', () => {
  it('is version 2 (Tatame v3: pick, tap, defend)', () => {
    expect(BOUT_PROTOCOL_VERSION).toBe(2);
  });
});

describe('position ladder', () => {
  it('maps the rung to the seven positions, with the side that is ahead', () => {
    const at = (rung: number, top: 'montada' | 'costas' = 'montada') => positionOf({ rung, top });
    expect(at(0)).toEqual({ id: 'de_pe', ahead: null });
    expect(at(1)).toEqual({ id: 'guarda_fechada', ahead: 'you' });
    expect(at(-1)).toEqual({ id: 'meia_guarda', ahead: 'partner' });
    expect(at(2).id).toBe('cem_quilos');
    expect(at(-2).id).toBe('cem_quilos');
    expect(at(3).id).toBe('joelho');
    expect(at(4)).toEqual({ id: 'montada', ahead: 'you' });
    expect(at(4, 'costas')).toEqual({ id: 'costas', ahead: 'you' });
    expect(at(-4, 'costas')).toEqual({ id: 'costas', ahead: 'partner' });
    const seen = new Set([-4, -3, -2, -1, 0, 1, 2, 3, 4].flatMap((r) => [at(r).id, at(r, 'costas').id]));
    expect([...seen].sort()).toEqual(['costas', 'cem_quilos', 'de_pe', 'guarda_fechada', 'joelho', 'meia_guarda', 'montada'].sort());
  });

  it('adjacent positions are exactly the one-rung steps (the transition art list)', () => {
    expect(ADJACENT_POSITIONS).toHaveLength(7);
    for (const [a, b] of ADJACENT_POSITIONS) expect(Math.abs(rungOfPosition(a) - rungOfPosition(b))).toBe(1);
    // every step the ladder can take is in the list, in one direction or the other
    const has = (a: string, b: string) => ADJACENT_POSITIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    for (const top of ['montada', 'costas'] as const)
      for (let r = -3; r <= 3; r++) {
        const a = positionOf({ rung: r, top }).id;
        const b = positionOf({ rung: r + 1, top }).id;
        if (a === b) continue;
        expect(has(a, b), `${a} <-> ${b}`).toBe(true);
      }
  });
});


describe('the referee', () => {
  it('Bia calls the points in Portuguese, doubling as number practice', () => {
    expect(REF_LINES.pontos2.pt).toBe('Dois pontos!');
    expect(REF_LINES.pontos3.pt).toBe('Três pontos!');
    expect(REF_LINES.pontos4.pt).toBe('Quatro pontos!');
    expect(REF_LINES.vantagem.pt).toBe('Vantagem!');
    expect(REF_LINES.combate.pt).toBe('Combate!');
    expect([2, 3, 4].map(signalForPoints)).toEqual(['pontos2', 'pontos3', 'pontos4']);
  });

  it('end lines read well in Portuguese and carry no Oss / rola / Gracie', () => {
    const lines = [
      endLine('you', 'finalizacao'),
      endLine('partner', 'finalizacao'),
      endLine('you', 'pontos'),
      endLine('partner', 'pontos'),
      endLine('you', 'vantagens'),
      endLine('partner', 'vantagens'),
      endLine('draw', 'empate'),
      endLine('draw', 'quit'),
      ...Object.values(REF_LINES),
    ];
    for (const l of lines) {
      expect(l.pt.length).toBeGreaterThan(3);
      expect(l.en.length).toBeGreaterThan(3);
      expect(l.pt + l.en).not.toMatch(/\boss\b|\brola\b|gracie/i);
    }
  });

  it('the scoreboard clock reads minutes and seconds', () => {
    expect(formatBoutClock(120_000)).toBe('2:00');
    expect(formatBoutClock(7_500)).toBe('0:08');
    expect(formatBoutClock(0)).toBe('0:00');
  });
});

describe('crowd cues are short Portuguese shouts and reaction icons', () => {
  it('only the four shouts from the brief, and the three icons', () => {
    expect([...CROWD_SHOUTS].sort()).toEqual(['Boa!', 'Isso!', 'Segura!', 'Vai!']);
    const icons = new Set(Object.values(CROWD).flatMap((c) => c.icons));
    expect([...icons].sort()).toEqual(['🔥', '👏', '😮'].sort());
    for (const c of Object.values(CROWD)) for (const s of c.shouts) expect(CROWD_SHOUTS).toContain(s);
  });
});
