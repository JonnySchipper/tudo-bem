import { describe, expect, it } from 'vitest';
import {
  CADERNO_GROUP_RV,
  CARDS,
  cadernoGroups,
  cardsInText,
  completedGroups,
  groupProgress,
  isLearned,
  maskCards,
  normalizeCaderno,
  normalizeCadernoPaid,
  recordHeard,
  recordSeen,
  recordUsed,
} from './index.js';

describe('cardsInText', () => {
  it('finds cards accent-insensitively and whole-word', () => {
    expect(cardsInText('Bom dia! Tudo bem?')).toEqual(expect.arrayContaining(['lex.social.bom_dia', 'lex.social.tudo_bem']));
    expect(cardsInText('bom dia')).toContain('lex.social.bom_dia');
    expect(cardsInText('BOM DIA')).toContain('lex.social.bom_dia');
    expect(cardsInText('Me ve um pao na chapa, por favor.')).toEqual(
      expect.arrayContaining(['lex.padaria.me_ve', 'lex.padaria.pao_na_chapa', 'lex.padaria.por_favor']),
    );
    // not inside another word
    expect(cardsInText('paozinhos')).not.toContain('lex.padaria.pao');
    expect(cardsInText('opaoo')).toEqual([]);
    expect(cardsInText('coxinhas e bolos')).toEqual(expect.arrayContaining(['lex.padaria.coxinha', 'lex.padaria.bolo'])); // plural forms
  });

  it('the longest form wins: a phrase does not also count its parts', () => {
    const ids = cardsInText('Um café com leite, por favor');
    expect(ids).toContain('lex.padaria.cafe_com_leite');
    expect(ids).not.toContain('lex.padaria.cafe');
    expect(cardsInText('pão de queijo')).toEqual(['lex.padaria.pao_de_queijo']);
    expect(cardsInText('um pão e um café')).toEqual(expect.arrayContaining(['lex.padaria.pao', 'lex.padaria.cafe']));
    expect(cardsInText('misto quente')).toContain('lex.padaria.misto_quente');
    expect(cardsInText('misto-quente')).toContain('lex.padaria.misto_quente');
  });

  it('handles slash forms, digits and junk input', () => {
    expect(cardsInText('Obrigada!')).toContain('lex.social.obrigado');
    expect(cardsInText('obrigado')).toContain('lex.social.obrigado');
    expect(cardsInText('quero duas')).toContain('lex.num.2');
    expect(cardsInText('sete')).toEqual(['lex.num.7']);
    expect(cardsInText('')).toEqual([]);
    expect(cardsInText('!!! ???')).toEqual([]);
    expect(cardsInText(undefined as unknown as string)).toEqual([]);
    expect(cardsInText('x'.repeat(50_000))).toEqual([]);
    // every id it returns is a real card
    const real = new Set(CARDS.map((c) => c.id));
    for (const id of cardsInText('bom dia, um pão na chapa, três cafés, pra viagem, obrigado')) expect(real.has(id)).toBe(true);
  });

  it('maskCards leaves only the free wording', () => {
    expect(maskCards('Me vê um pão na chapa, por favor! Meu segredo é roxo.')).toBe('¤ ¤ ¤ ¤ meu segredo e roxo');
    expect(maskCards('')).toBe('');
  });

  it('every card is findable from its own form', () => {
    for (const c of CARDS) {
      const form = c.form.split('/')[0]!.trim();
      expect(cardsInText(form), c.id).toContain(c.id);
    }
  });
});

describe('recording', () => {
  it('counts each kind separately, keeps firstAt, and is pure', () => {
    const a = recordSeen({}, ['lex.padaria.pao'], 100);
    expect(a).toEqual({ 'lex.padaria.pao': { seen: 1, heard: 0, used: 0, firstAt: 100 } });
    const b = recordHeard(a, ['lex.padaria.pao'], 200);
    const c = recordUsed(b, ['lex.padaria.pao', 'lex.padaria.pao'], 300); // repeated id in one call counts once
    expect(c['lex.padaria.pao']).toEqual({ seen: 1, heard: 1, used: 1, firstAt: 100 });
    expect(a['lex.padaria.pao']!.heard).toBe(0); // inputs are not mutated
    expect(recordSeen(undefined, ['nope', 'lex.padaria.pao'], 1)).toEqual({ 'lex.padaria.pao': { seen: 1, heard: 0, used: 0, firstAt: 1 } });
  });
});

describe('groups', () => {
  it('group the cards by their deck and cover every card exactly once', () => {
    const groups = cadernoGroups();
    expect(groups.map((g) => g.id)).toEqual(expect.arrayContaining(['padaria', 'social', 'num']));
    expect(groups.flatMap((g) => g.cardIds).sort()).toEqual(CARDS.map((c) => c.id).sort());
    expect(groups.find((g) => g.id === 'social')!.label.pt).toBe('Cumprimentos');
  });

  it('a card counts as learned when used, or when both seen and heard', () => {
    expect(isLearned(undefined)).toBe(false);
    expect(isLearned({ seen: 5, heard: 0, used: 0, firstAt: 1 })).toBe(false);
    expect(isLearned({ seen: 0, heard: 5, used: 0, firstAt: 1 })).toBe(false);
    expect(isLearned({ seen: 1, heard: 1, used: 0, firstAt: 1 })).toBe(true);
    expect(isLearned({ seen: 0, heard: 0, used: 1, firstAt: 1 })).toBe(true);
  });

  it('progress counts learned cards and a group completes only when all are learned', () => {
    const social = cadernoGroups().find((g) => g.id === 'social')!;
    let c = recordUsed({}, social.cardIds.slice(0, 3), 1);
    let p = groupProgress(c).find((g) => g.id === 'social')!;
    expect(p).toMatchObject({ total: social.cardIds.length, learned: 3, complete: false });
    expect(completedGroups(c)).toEqual([]);
    c = recordUsed(c, social.cardIds, 2);
    p = groupProgress(c).find((g) => g.id === 'social')!;
    expect(p.complete).toBe(true);
    expect(completedGroups(c)).toEqual(['social']);
    expect(groupProgress(undefined).every((g) => g.learned === 0 && !g.complete)).toBe(true);
  });

  it('the payout constant is the HOWTO default', () => {
    expect(CADERNO_GROUP_RV).toBe(15);
  });
});

describe('normalize (old saves)', () => {
  it('defaults and cleans anything', () => {
    expect(normalizeCaderno(undefined)).toEqual({});
    expect(normalizeCaderno('x')).toEqual({});
    expect(normalizeCaderno({ nope: { seen: 1 }, 'lex.padaria.pao': { seen: 2.7, heard: -1, used: 'x', firstAt: 5 }, 'lex.padaria.bolo': 3 })).toEqual({
      'lex.padaria.pao': { seen: 2, heard: 0, used: 0, firstAt: 5 },
    });
    expect(normalizeCadernoPaid(['padaria', 'padaria', 'nope', 3])).toEqual(['padaria']);
    expect(normalizeCadernoPaid(undefined)).toEqual([]);
  });
});
