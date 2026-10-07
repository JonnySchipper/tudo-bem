import { describe, expect, it } from 'vitest';
import { DIARY_WORDS } from '@tudobem/shared';
import { findWordIndex, lineForms } from './heardWordMatch';

describe('findWordIndex', () => {
  it('finds a word whatever the case of its first letter', () => {
    expect(findWordIndex('Bom dia, tudo bem?', 'bom dia')).toBe(0);
    expect(findWordIndex('Olha, bom dia!', 'Bom dia')).toBe(6);
  });

  it('never matches inside a longer word', () => {
    expect(findWordIndex('Que pãozinho gostoso', 'pão')).toBe(-1);
    expect(findWordIndex('Um pão e um pãozinho', 'pão')).toBe(3);
  });

  it('keeps accents as written', () => {
    expect(findWordIndex('Você está aqui', 'voce')).toBe(-1);
    expect(findWordIndex('Você está aqui', 'você')).toBe(0);
  });

  it('is -1 for an empty needle or a missing word', () => {
    expect(findWordIndex('Oi', '')).toBe(-1);
    expect(findWordIndex('Oi', 'tchau')).toBe(-1);
  });
});

describe('lineForms', () => {
  it('puts what the line prints before the headword', () => {
    const w = DIARY_WORDS.find((x) => x.source === 'conversation' && x.match);
    if (!w) return;
    expect(lineForms(w.pt)[0]).toBe(w.match);
    expect(lineForms(w.pt)).toContain(w.pt);
  });

  it('is just the headword for a word with no match', () => {
    expect(lineForms('palavra-que-nao-existe')).toEqual(['palavra-que-nao-existe']);
  });
});
