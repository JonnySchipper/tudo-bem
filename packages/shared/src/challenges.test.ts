import { describe, expect, it } from 'vitest';
import {
  CARDS,
  challengeBank,
  challengeById,
  checkAnswer,
  finishBank,
  instantiate,
  itemWeight,
  mulberry32,
  pickChallenge,
  recordUsed,
  unlearnedShare,
  viewOf,
  type ChallengeKind,
} from './index.js';

const KINDS: ChallengeKind[] = ['cloze', 'choice', 'reorder', 'listening', 'typed'];
const LOCK = /\b(oss|rola|rolar|professor|professora|treinar|tatame|kimono|gi|gracie|armlock|triângulo|triangulo|chave de braço|mata-leão|guilhotina|kimura|guarda|montada|passar a guarda)\b/i;

describe('challenge bank', () => {
  const bank = challengeBank();

  it('has 60+ A1 items across all five kinds, all flagged for a Brazilian reviewer', () => {
    expect(bank.length).toBeGreaterThanOrEqual(60);
    for (const k of KINDS) expect(bank.filter((c) => c.kind === k).length, k).toBeGreaterThanOrEqual(8);
    for (const c of [...bank, ...finishBank()]) expect(c.needs_br).toBe(true);
    expect(new Set(bank.map((c) => c.id)).size).toBe(bank.length);
  });

  it('is Portuguese learning, never technique trivia: no BJJ words in prompts, options, words or phrases', () => {
    for (const c of [...bank, ...finishBank()]) {
      const text = [c.prompt.pt, ...(c.options?.map((o) => o.pt) ?? []), ...(c.words ?? []), c.listenPt ?? '', ...(c.accept ?? [])].join(' | ');
      expect(text, c.id).not.toMatch(LOCK);
      expect(c.id).not.toMatch(/^tech_/);
    }
  });

  it('every item is well formed for its kind', () => {
    for (const c of [...bank, ...finishBank()]) {
      if (c.kind === 'cloze') {
        expect(c.prompt.pt, c.id).toContain('___');
        expect(c.options!.length, c.id).toBeGreaterThanOrEqual(3);
      }
      if (c.kind === 'choice' || c.kind === 'listening') expect(c.options!.length, c.id).toBeGreaterThanOrEqual(3);
      if (c.options) {
        expect(new Set(c.options.map((o) => o.pt)).size, `${c.id} options are distinct`).toBe(c.options.length);
        for (const o of c.options) expect(o.en.length, c.id).toBeGreaterThan(0);
      }
      if (c.kind === 'reorder') {
        expect(c.words!.length, c.id).toBeGreaterThanOrEqual(3);
        expect(c.words!.length, c.id).toBeLessThanOrEqual(7);
      }
      if (c.kind === 'listening') {
        expect(c.listenPt, c.id).toBeTruthy();
        // the spoken phrase is one of the options (digits for number items)
        expect(c.options![0]!.pt === c.listenPt || /^\d+$/.test(c.options![0]!.pt), c.id).toBe(true);
      }
      if (c.kind === 'typed') {
        expect(c.accept!.length, c.id).toBeGreaterThan(0);
        expect(c.prompt.pt.includes('___') || /número/.test(c.prompt.pt), c.id).toBe(true);
      }
    }
  });

  it('every Caderno card an item names exists', () => {
    const ids = new Set(CARDS.map((c) => c.id));
    for (const c of [...bank, ...finishBank()]) for (const id of c.cards ?? []) expect(ids.has(id), `${c.id} -> ${id}`).toBe(true);
  });

  it('the finalização reorders are long sentences', () => {
    for (const c of finishBank()) {
      expect(c.kind).toBe('reorder');
      expect(c.words!.length).toBeGreaterThanOrEqual(6);
      expect(c.tier).toBe(3);
    }
    expect(challengeById('fz_cafe_leite')).toBeTruthy();
    expect(challengeById('cz_bom_dia')).toBeTruthy();
    expect(challengeById('nope')).toBeUndefined();
  });
});

describe('instances, views and answers', () => {
  it('the correct option is shuffled around, never leaked in the view', () => {
    const item = challengeById('cz_bom_dia')!;
    const spots = new Set<number>();
    for (let seed = 1; seed < 60; seed++) {
      const inst = instantiate(item, mulberry32(seed));
      const v = viewOf(inst);
      expect(v.options!.length).toBe(item.options!.length);
      expect(Object.keys(v).sort()).toEqual(['id', 'kind', 'options', 'prompt']);
      const at = inst.perm.indexOf(0);
      spots.add(at);
      expect(v.options![at]!.pt).toBe('Bom');
      expect(checkAnswer(inst, { kind: 'choice', index: at })).toBe(true);
      expect(checkAnswer(inst, { kind: 'choice', index: (at + 1) % v.options!.length })).toBe(false);
    }
    expect(spots.size).toBeGreaterThan(1);
  });

  it('a debug view carries the answer only when asked', () => {
    const inst = instantiate(challengeById('ch_dois')!, mulberry32(3));
    expect(viewOf(inst).debugCorrect).toBeUndefined();
    expect(viewOf(inst, true).debugCorrect).toBe(inst.perm.indexOf(0));
  });

  it('choice answers outside the range, non-integers and the wrong kind are wrong', () => {
    const inst = instantiate(challengeById('cz_oi')!, mulberry32(5));
    for (const a of [{ kind: 'choice', index: -1 }, { kind: 'choice', index: 99 }, { kind: 'choice', index: 1.5 }, { kind: 'choice', index: Number.NaN }, { kind: 'text', text: 'Oi' }, { kind: 'order', order: [0] }]) {
      expect(checkAnswer(inst, a as never)).toBe(false);
    }
  });

  it('reorder: tokens are shuffled (never already solved) and only the full order is right', () => {
    const item = challengeById('ro_cafe')!;
    for (let seed = 1; seed < 40; seed++) {
      const inst = instantiate(item, mulberry32(seed));
      expect(inst.tokens.map((t) => t.i)).not.toEqual([0, 1, 2, 3]);
      expect(inst.tokens.map((t) => t.pt).sort()).toEqual([...item.words!].sort());
      expect(checkAnswer(inst, { kind: 'order', order: [0, 1, 2, 3] })).toBe(true);
      expect(checkAnswer(inst, { kind: 'order', order: [1, 0, 2, 3] })).toBe(false);
      expect(checkAnswer(inst, { kind: 'order', order: [0, 1, 2] })).toBe(false);
      expect(checkAnswer(inst, { kind: 'order', order: [0, 1, 2, 3, 4] })).toBe(false);
      expect(checkAnswer(inst, { kind: 'order', order: [0, 0, 0, 0] })).toBe(false);
      expect(checkAnswer(inst, { kind: 'choice', index: 0 })).toBe(false);
    }
  });

  it('typed: accents and case optional, punctuation ignored, obrigada = obrigado, digits never count', () => {
    const pao = instantiate(challengeById('ty_pao')!, mulberry32(1));
    for (const ok of ['pão', 'pao', 'PÃO', '  pão! ']) expect(checkAnswer(pao, { kind: 'text', text: ok }), ok).toBe(true);
    for (const bad of ['', 'pães', 'bolo', 'pão de queijo']) expect(checkAnswer(pao, { kind: 'text', text: bad }), bad).toBe(false);
    const obr = instantiate(challengeById('ty_obrigado')!, mulberry32(1));
    expect(checkAnswer(obr, { kind: 'text', text: 'Obrigada' })).toBe(true);
    expect(checkAnswer(obr, { kind: 'text', text: 'obrigado' })).toBe(true);
    const tres = instantiate(challengeById('ty_num_tres')!, mulberry32(1));
    expect(checkAnswer(tres, { kind: 'text', text: 'três' })).toBe(true);
    expect(checkAnswer(tres, { kind: 'text', text: 'tres' })).toBe(true);
    expect(checkAnswer(tres, { kind: 'text', text: '3' })).toBe(false);
    expect(checkAnswer(tres, { kind: 'text', text: 'tr3s' })).toBe(false);
    const oi = instantiate(challengeById('ty_oi')!, mulberry32(1));
    expect(checkAnswer(oi, { kind: 'text', text: 'Olá' })).toBe(true);
    expect(checkAnswer(oi, { kind: 'text', text: 'oi' })).toBe(true);
    expect(checkAnswer(oi, { kind: 'text', text: 'hello' })).toBe(false);
    expect(viewOf(pao).maxLen).toBeGreaterThan(0);
  });

  it('listening items carry the phrase to speak', () => {
    const inst = instantiate(challengeById('li_bom_dia')!, mulberry32(2));
    const v = viewOf(inst);
    expect(v.listenPt).toBe('Bom dia');
    expect(v.options!.length).toBe(4);
    expect(v.options![inst.perm.indexOf(0)]!.pt).toBe('Bom dia');
  });
});

describe('the pick', () => {
  const all: Partial<Record<ChallengeKind, number>> = { cloze: 1, choice: 1, reorder: 1, listening: 1, typed: 1 };

  it('only draws the kinds asked for and skips used items', () => {
    const used = new Set<string>();
    const rng = mulberry32(11);
    for (let i = 0; i < 30; i++) {
      const it = pickChallenge(rng, { kinds: { reorder: 1 }, used });
      expect(it.kind).toBe('reorder');
      used.add(it.id);
    }
    // 30 draws from 14 reorders: it ran out of fresh ones and allowed repeats rather than failing
    expect(used.size).toBe(challengeBank().filter((c) => c.kind === 'reorder').length);
  });

  it('never draws listening when the player has sound off', () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 100; i++) expect(pickChallenge(rng, { kinds: all, canListen: false }).kind).not.toBe('listening');
    let heard = 0;
    for (let i = 0; i < 100; i++) if (pickChallenge(rng, { kinds: all }).kind === 'listening') heard++;
    expect(heard).toBeGreaterThan(0);
  });

  it('leans toward words not yet learned in the Caderno', () => {
    const cloze = { cloze: 1 };
    const cadernoLearned = recordUsed({}, ['lex.social.bom_dia', 'lex.social.boa_tarde', 'lex.social.boa_noite', 'lex.social.oi', 'lex.social.tudo_bem'], 1);
    const bomDia = challengeById('cz_bom_dia')!;
    expect(unlearnedShare(bomDia, {})).toBe(1);
    expect(unlearnedShare(bomDia, cadernoLearned)).toBe(0);
    expect(itemWeight(bomDia, cloze, {})).toBeCloseTo(4);
    expect(itemWeight(bomDia, cloze, cadernoLearned)).toBeCloseTo(1);
    // an item with no cards still turns up
    expect(unlearnedShare(challengeById('cz_sou')!, {})).toBeGreaterThan(0);
    const count = (cad: typeof cadernoLearned) => {
      const rng = mulberry32(21);
      let n = 0;
      for (let i = 0; i < 1500; i++) if (pickChallenge(rng, { kinds: cloze, caderno: cad }).id === 'cz_bom_dia') n++;
      return n;
    };
    expect(count({})).toBeGreaterThan(count(cadernoLearned) * 1.8);
  });

  it('always returns something, even with every item used or no usable kind', () => {
    const everything = new Set(challengeBank().map((c) => c.id));
    const rng = mulberry32(8);
    expect(pickChallenge(rng, { kinds: { typed: 1 }, used: everything })).toBeTruthy();
    expect(pickChallenge(rng, { kinds: {}, used: everything })).toBeTruthy();
    expect(pickChallenge(rng, { kinds: { listening: 1 }, canListen: false })).toBeTruthy();
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const rng = mulberry32(99);
      return Array.from({ length: 12 }, () => pickChallenge(rng, { kinds: all }).id).join(',');
    };
    expect(run()).toBe(run());
  });
});
