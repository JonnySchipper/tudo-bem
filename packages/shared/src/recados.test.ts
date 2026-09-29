import { describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, gameDay, greetingFor } from './clock.js';
import { MG_ITEMS, mulberry32 } from './meveum.js';
import { cardById } from './cards.js';
import {
  addToBag,
  advance,
  BAG_MAX_PER_ITEM,
  describeStep,
  freshRecadoState,
  greetingKind,
  ITEMS,
  itemById,
  normalizeBag,
  normalizeRecados,
  offerFor,
  RECADOS,
  recadoById,
  rollRecadoDay,
  stepMatches,
  takeFromBag,
  type RecadoDef,
  type RecadoEvent,
  type RecadoStep,
} from './recados.js';

const at = (day: number, min: number) => day * GAME_DAY_MS + (min / 1440) * GAME_DAY_MS - CLOCK_OFFSET_MS;
const tile = { x: 3, y: 3 };

describe('items', () => {
  it('reuses the padaria shelf ids instead of inventing parallel ones', () => {
    for (const id of ['pao', 'pao_de_queijo', 'cafe_com_leite']) {
      expect(MG_ITEMS.some((i) => i.id === id)).toBe(true);
      expect(itemById(id)?.cardId).toBe(`lex.padaria.${id}`);
    }
    for (const id of ['jornal', 'flores', 'banana']) expect(itemById(id)?.name.pt).toBe(id);
    expect(ITEMS.map((i) => i.id)).not.toContain('pao_frances');
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(i.name.pt && i.name.en).toBeTruthy();
      if (i.cardId) expect(cardById(i.cardId)).toBeTruthy();
    }
  });

  it('adds, caps and takes from the bag without mutating', () => {
    const bag = { coxinha: 1 };
    const more = addToBag(bag, 'coxinha', 2);
    expect(more).toEqual({ coxinha: 3 });
    expect(bag).toEqual({ coxinha: 1 });
    expect(addToBag(bag, 'nao_existe', 1)).toEqual(bag);
    expect(addToBag(bag, 'coxinha', -4)).toEqual(bag);
    expect(addToBag({}, 'agua', 999).agua).toBe(BAG_MAX_PER_ITEM);
    expect(takeFromBag({ agua: 2 }, 'agua', 1)).toEqual({ agua: 1 });
    expect(takeFromBag({ agua: 1 }, 'agua', 1)).toEqual({});
    expect(takeFromBag({ agua: 1 }, 'agua', 2)).toBeNull();
    expect(takeFromBag({}, 'agua', 1)).toBeNull();
  });

  it('normalizes bags from old or hand-edited saves', () => {
    expect(normalizeBag(undefined)).toEqual({});
    expect(normalizeBag('x')).toEqual({});
    expect(normalizeBag({ agua: 2.9, coxinha: -1, __proto__: { x: 1 }, foo: 5, pastel: 'a' })).toEqual({ agua: 2 });
  });
});

describe('greetingKind', () => {
  it('reads greetings accent- and case-insensitively; the time greetings win over oi', () => {
    expect(greetingKind('Bom dia, pessoal!')).toBe('bom dia');
    expect(greetingKind('BOA TARDE!')).toBe('boa tarde');
    expect(greetingKind('oi, boa noite')).toBe('boa noite');
    expect(greetingKind('Olá!')).toBe('oi');
    expect(greetingKind('oi')).toBe('oi');
    expect(greetingKind('voa tarde')).toBeNull();
    expect(greetingKind('oitenta')).toBeNull();
    expect(greetingKind('quero pão')).toBeNull();
  });
});

describe('stepMatches', () => {
  it('falar: only that NPC', () => {
    const step: RecadoStep = { kind: 'falar', npc: 'julia' };
    expect(stepMatches(step, { kind: 'talked', npc: 'julia' })).toBe(true);
    expect(stepMatches(step, { kind: 'talked', npc: 'nanda' })).toBe(false);
    expect(stepMatches(step, { kind: 'read', hotspotId: 'x' })).toBe(false);
  });

  it('pedir: the order must hold enough of the item, from the right NPC', () => {
    const step: RecadoStep = { kind: 'pedir', npc: 'carlos', itemId: 'coxinha', qty: 2 };
    const order = (npc: 'carlos' | 'nanda', items: { itemId: string; qty: number }[]): RecadoEvent => ({ kind: 'ordered', npc, items });
    expect(stepMatches(step, order('carlos', [{ itemId: 'coxinha', qty: 2 }]))).toBe(true);
    expect(stepMatches(step, order('carlos', [{ itemId: 'coxinha', qty: 1 }, { itemId: 'coxinha', qty: 1 }]))).toBe(true);
    expect(stepMatches(step, order('carlos', [{ itemId: 'coxinha', qty: 1 }, { itemId: 'pastel', qty: 5 }]))).toBe(false);
    expect(stepMatches(step, order('nanda', [{ itemId: 'coxinha', qty: 2 }]))).toBe(false);
    expect(stepMatches(step, order('carlos', []))).toBe(false);
  });

  it('entregar: npc, item and quantity', () => {
    const step: RecadoStep = { kind: 'entregar', npc: 'nanda', itemId: 'agua', qty: 2 };
    expect(stepMatches(step, { kind: 'gave', npc: 'nanda', itemId: 'agua', qty: 2 })).toBe(true);
    expect(stepMatches(step, { kind: 'gave', npc: 'nanda', itemId: 'agua', qty: 1 })).toBe(false);
    expect(stepMatches(step, { kind: 'gave', npc: 'julia', itemId: 'agua', qty: 2 })).toBe(false);
    expect(stepMatches(step, { kind: 'gave', npc: 'nanda', itemId: 'cafe', qty: 2 })).toBe(false);
  });

  it('ir: the room, and the area when there is one', () => {
    expect(stepMatches({ kind: 'ir', room: 'padaria' }, { kind: 'entered', room: 'padaria', tile })).toBe(true);
    expect(stepMatches({ kind: 'ir', room: 'padaria' }, { kind: 'entered', room: 'praca', tile })).toBe(false);
    const area = { x: 2, y: 2, w: 2, h: 2 };
    expect(stepMatches({ kind: 'ir', room: 'praca', area }, { kind: 'entered', room: 'praca', tile: { x: 3, y: 3 } })).toBe(true);
    expect(stepMatches({ kind: 'ir', room: 'praca', area }, { kind: 'entered', room: 'praca', tile: { x: 4, y: 3 } })).toBe(false);
    expect(stepMatches({ kind: 'ir', room: 'praca', area }, { kind: 'entered', room: 'praca', tile: { x: 1, y: 2 } })).toBe(false);
  });

  it('ler: the hotspot id', () => {
    expect(stepMatches({ kind: 'ler', hotspotId: 'cardapio' }, { kind: 'read', hotspotId: 'cardapio' })).toBe(true);
    expect(stepMatches({ kind: 'ler', hotspotId: 'cardapio' }, { kind: 'read', hotspotId: 'banca' })).toBe(false);
  });

  it('cumprimentar: any greeting, a named NPC, or the greeting that fits the game time', () => {
    const greet = (text: string, minute: number, extra: Partial<Extract<RecadoEvent, { kind: 'greeted' }>> = {}): RecadoEvent => ({ kind: 'greeted', text, minute, ...extra });
    expect(stepMatches({ kind: 'cumprimentar' }, greet('oi!', 0))).toBe(true);
    expect(stepMatches({ kind: 'cumprimentar' }, greet('quero pão', 0))).toBe(false);
    // nobody around: a greeting to an empty room does not count
    expect(stepMatches({ kind: 'cumprimentar' }, greet('oi!', 0, { company: false }))).toBe(false);
    expect(stepMatches({ kind: 'cumprimentar' }, greet('oi!', 0, { company: false, npc: 'julia' }))).toBe(true);
    expect(stepMatches({ kind: 'cumprimentar', npc: 'julia' }, greet('oi', 0, { npc: 'julia' }))).toBe(true);
    expect(stepMatches({ kind: 'cumprimentar', npc: 'julia' }, greet('oi', 0, { npc: 'nanda' }))).toBe(false);
    expect(stepMatches({ kind: 'cumprimentar', npc: 'julia' }, greet('oi', 0))).toBe(false);
    const timed: RecadoStep = { kind: 'cumprimentar', timeCorrect: true };
    expect(greetingFor(9 * 60)).toBe('bom dia');
    expect(stepMatches(timed, greet('Bom dia!', 9 * 60))).toBe(true);
    expect(stepMatches(timed, greet('Boa tarde!', 9 * 60))).toBe(false);
    expect(stepMatches(timed, greet('Boa tarde!', 13 * 60))).toBe(true);
    expect(stepMatches(timed, greet('Boa noite', 18 * 60))).toBe(true);
    expect(stepMatches(timed, greet('Boa noite', 3 * 60))).toBe(true);
    expect(stepMatches(timed, greet('Bom dia', 4 * 60 + 59))).toBe(false);
    expect(stepMatches(timed, greet('oi', 9 * 60))).toBe(false);
  });
});

describe('advance', () => {
  const def: RecadoDef = { ...RECADOS[0]!, steps: [{ kind: 'falar', npc: 'carlos' }, { kind: 'entregar', npc: 'nanda', itemId: 'agua', qty: 1 }] };

  it('only the current step counts, in order, and never mutates', () => {
    const a = { id: def.id, step: 0 };
    const early = advance(a, def, { kind: 'gave', npc: 'nanda', itemId: 'agua', qty: 1 });
    expect(early).toEqual({ active: a, matched: false, done: false });
    const first = advance(a, def, { kind: 'talked', npc: 'carlos' });
    expect(first).toEqual({ active: { id: def.id, step: 1 }, matched: true, done: false });
    expect(a.step).toBe(0);
    const last = advance(first.active, def, { kind: 'gave', npc: 'nanda', itemId: 'agua', qty: 1 });
    expect(last).toMatchObject({ matched: true, done: true, active: { step: 2 } });
    // already finished: nothing further matches
    expect(advance(last.active, def, { kind: 'talked', npc: 'carlos' })).toMatchObject({ matched: false, done: true });
  });
});

describe('starter recados', () => {
  it('are well formed: unique ids, needs_br, real items, real cards', () => {
    expect(new Set(RECADOS.map((d) => d.id)).size).toBe(RECADOS.length);
    for (const d of RECADOS) {
      expect(d.needs_br).toBe(true);
      expect(d.steps.length).toBeGreaterThan(0);
      expect(d.reward.rv).toBeGreaterThan(0);
      expect(d.reward.bond).toBeGreaterThan(0);
      for (const c of d.cards) expect(cardById(c), c).toBeTruthy();
      if (d.reward.itemId) expect(itemById(d.reward.itemId)).toBeTruthy();
      for (const s of d.steps) if (s.kind === 'pedir' || s.kind === 'entregar') expect(itemById(s.itemId), s.itemId).toBeTruthy();
      for (const t of [d.title, d.ask, d.thanks]) expect(t.pt && t.en).toBeTruthy();
      expect(describeStep(d.steps[0]!).pt).toBeTruthy();
    }
    expect(recadoById('carlos_cafe_pra_nanda')?.giver).toBe('carlos');
    expect(recadoById('nope')).toBeUndefined();
    expect(recadoById(undefined)).toBeUndefined();
  });
});

describe('offerFor', () => {
  const day = 12345;
  const pool = (giver: 'carlos' | 'nanda' | 'julia', id: string, minBond: number): RecadoDef => ({ ...RECADOS[0]!, id, giver, minBond });
  const defs = [pool('carlos', 'c0', 0), pool('nanda', 'n0', 0), pool('julia', 'j0', 0), pool('carlos', 'c1', 0), pool('carlos', 'c30', 30), pool('nanda', 'n50', 50)];

  it('offers 3, all distinct, all unlocked', () => {
    for (let seed = 1; seed < 40; seed++) {
      const ids = offerFor({}, day, mulberry32(seed), defs);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
      expect(ids).not.toContain('c30');
      expect(ids).not.toContain('n50');
    }
  });

  it('is deterministic for the same rng and varies with it', () => {
    expect(offerFor({}, day, mulberry32(5), defs)).toEqual(offerFor({}, day, mulberry32(5), defs));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => offerFor({}, day, mulberry32(i), defs).join()));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('gates by the giver minBond, and only that giver bond counts', () => {
    const all = (bond: Parameters<typeof offerFor>[0]['bond']) => new Set(Array.from({ length: 60 }, (_, i) => offerFor({ bond }, day, mulberry32(i), defs, 6)).flat());
    expect(all({})).not.toContain('c30');
    expect(all({ carlos: 29 })).not.toContain('c30');
    expect(all({ carlos: 30 })).toContain('c30');
    expect(all({ nanda: 100 })).not.toContain('c30');
    expect(all({ nanda: 50 })).toContain('n50');
    expect(all({ nanda: 49 })).not.toContain('n50');
  });

  it('excludes what was finished today and what is already active, but not yesterday’s', () => {
    const recados = { ...freshRecadoState(), day, done: ['c0', 'n0'], active: [{ id: 'j0', step: 0 }] };
    const ids = offerFor({ recados }, day, mulberry32(1), defs, 6);
    expect(ids).not.toContain('c0');
    expect(ids).not.toContain('n0');
    expect(ids).not.toContain('j0');
    expect(ids).toContain('c1');
    const stale = offerFor({ recados }, day + 1, mulberry32(1), defs, 6);
    expect(stale).toContain('c0');
    expect(stale).toContain('n0');
    expect(stale).not.toContain('j0');
  });

  it('offers fewer when fewer are unlocked, and none when nothing is', () => {
    expect(offerFor({}, day, mulberry32(1), [defs[4]!])).toEqual([]);
    expect(offerFor({}, day, mulberry32(1), defs.slice(0, 2))).toHaveLength(2);
  });

  it('the shipped starter set offers exactly the three unlocked recados to a new player', () => {
    const ids = offerFor({}, day, mulberry32(1));
    expect(ids.sort()).toEqual(['carlos_cafe_pra_nanda', 'julia_cumprimento_certo', 'nanda_coxinha']);
    expect(offerFor({ bond: { carlos: 10 } }, day, mulberry32(1), RECADOS, 6)).toContain('carlos_agua_pra_julia');
  });
});

describe('rollRecadoDay (daily rollover by game day)', () => {
  it('keeps the same offer all game day, then rolls at game midnight', () => {
    const day = gameDay(at(1000, 0));
    const first = rollRecadoDay({}, day, mulberry32(1));
    expect(first.day).toBe(day);
    expect(first.offered).toHaveLength(3);
    // same day, any time: untouched (same object)
    const same = rollRecadoDay({ recados: first }, gameDay(at(1000, 1439)), mulberry32(99));
    expect(same).toBe(first);
    // next game day: fresh offer, done cleared, active recados kept
    const busy = { ...first, done: [first.offered[0]!], active: [{ id: first.offered[1]!, step: 1 }], talked: ['carlos' as const], graded: ['carlos' as const] };
    const next = rollRecadoDay({ recados: busy }, gameDay(at(1001, 0)), mulberry32(2));
    expect(next.day).toBe(1001);
    expect(next.done).toEqual([]);
    expect(next.talked).toEqual([]);
    expect(next.graded).toEqual([]);
    expect(next.active).toEqual([{ id: first.offered[1], step: 1 }]);
    expect(next.offered).not.toContain(first.offered[1]);
    expect(gameDay(at(1000, 1439))).toBe(1000);
    expect(gameDay(at(1001, 0))).toBe(1001);
  });
});

describe('normalizeRecados', () => {
  it('defaults old saves and repairs bad data without throwing', () => {
    expect(normalizeRecados(undefined)).toEqual({ day: -1, offered: [], active: [], done: [], talked: [], graded: [] });
    expect(normalizeRecados('nope')).toMatchObject({ day: -1, active: [] });
    const messy = normalizeRecados({ day: 7.9, offered: ['a', 3, null], active: [{ id: 'a', step: 1 }, { id: 5, step: 0 }, { id: 'b', step: -1 }, { id: 'c', step: 1.5 }, null], done: 'x', talked: ['carlos', 'ghost'] });
    expect(messy).toEqual({ day: 7, offered: ['a'], active: [{ id: 'a', step: 1 }], done: [], talked: ['carlos'], graded: [] });
  });
});
