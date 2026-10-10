import { describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, gameDay, greetingFor } from './clock.js';
import { MG_ITEMS, mulberry32 } from './meveum.js';
import { cardById } from './cards.js';
import { ECONOMY } from './constants.js';
import { isNpcId } from './bonds.js';
import { ROOMS } from './rooms.js';
import { nextPortalToward } from './npcMotion.js';
import {
  addToBag,
  advance,
  BAG_MAX_PER_ITEM,
  dayBonusDue,
  describeStep,
  dropRecado,
  freshRecadoState,
  greetingKind,
  ITEMS,
  itemById,
  itemWithArticle,
  normalizeBag,
  normalizeRecados,
  npcName,
  npcWhere,
  offerFor,
  RECADO_FLAGS,
  RECADOS,
  recadoEnabled,
  recadoById,
  rollRecadoDay,
  stepMatches,
  stepNpc,
  stepWhere,
  takeFromBag,
  whereLine,
  withheldByBond,
  type RecadoDef,
  type RecadoEvent,
  type RecadoFlag,
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

describe('the recados pack (recados.md)', () => {
  const gated = RECADOS.filter((d) => d.requires);

  it('describe every step as a plain sentence (no "1×", no "(Name)")', () => {
    expect(describeStep({ kind: 'pedir', npc: 'carlos', itemId: 'cafe_com_leite', qty: 1 })).toEqual({ pt: 'Peça um café com leite pro Seu Carlos.', en: 'Ask Seu Carlos for the coffee with milk.' });
    expect(describeStep({ kind: 'pedir', npc: 'carlos', itemId: 'coxinha', qty: 1 }).pt).toBe('Peça uma coxinha pro Seu Carlos.');
    expect(describeStep({ kind: 'entregar', npc: 'nanda', itemId: 'cafe_com_leite', qty: 1 })).toEqual({ pt: 'Leve o café com leite pra Nanda.', en: 'Take the coffee with milk to Nanda.' });
    expect(describeStep({ kind: 'entregar', npc: 'prof', itemId: 'agua', qty: 1 }).pt).toBe('Leve a água pra Professora Bia.');
    expect(describeStep({ kind: 'entregar', npc: 'julia', itemId: 'flores', qty: 1 }).pt).toBe('Leve as flores pra Júlia.');
    expect(describeStep({ kind: 'falar', npc: 'julia' })).toEqual({ pt: 'Fale com a Júlia.', en: 'Talk to Júlia.' });
    expect(describeStep({ kind: 'falar', npc: 'carlos' }).pt).toBe('Fale com Seu Carlos.');
    expect(describeStep({ kind: 'ler', hotspotId: 'padaria_letreiro' }).pt).toBe('Leia a placa “PADARIA DO SEU CARLOS”.');
    expect(describeStep({ kind: 'ler', hotspotId: 'nope' }).pt).toBe('Leia a placa.');
    expect(describeStep({ kind: 'cumprimentar', npc: 'julia', timeCorrect: true }).pt).toBe('Cumprimente a Júlia do jeito certo pra hora.');
    expect(describeStep({ kind: 'cumprimentar', timeCorrect: true }).pt).toBe('Cumprimente alguém do jeito certo pra hora.');
    expect(describeStep({ kind: 'cumprimentar', npc: 'carlos' }).pt).toBe('Cumprimente Seu Carlos.');
    expect(describeStep({ kind: 'cumprimentar' }).pt).toBe('Cumprimente alguém.');
  });

  it('spell quantities above one with number words and a plural noun', () => {
    expect(describeStep({ kind: 'pedir', npc: 'carlos', itemId: 'pao_de_queijo', qty: 2 }).pt).toBe('Peça dois pães de queijo pro Seu Carlos.');
    expect(describeStep({ kind: 'pedir', npc: 'carlos', itemId: 'coxinha', qty: 3 }).pt).toBe('Peça três coxinhas pro Seu Carlos.');
    expect(describeStep({ kind: 'entregar', npc: 'nanda', itemId: 'agua', qty: 2 }).pt).toBe('Leve duas águas pra Nanda.');
    expect(describeStep({ kind: 'entregar', npc: 'nanda', itemId: 'pastel', qty: 2 }).pt).toBe('Leve dois pastéis pra Nanda.');
    expect(describeStep({ kind: 'pedir', npc: 'ze', itemId: 'flores', qty: 2 }).pt).toBe('Peça duas flores pro Seu Zé.');
    expect(describeStep({ kind: 'pedir', npc: 'carlos', itemId: 'cafe_com_leite', qty: 2 }).en).toBe('Ask Seu Carlos for two orders of coffee with milk.');
    for (const it of ITEMS) {
      const t = describeStep({ kind: 'pedir', npc: 'carlos', itemId: it.id, qty: 2 }).pt;
      expect(t, it.id).not.toMatch(/\d|×|[(]/);
      expect(t, it.id).toMatch(/^Peça (dois|duas) /);
    }
    for (const d of RECADOS) for (const st of d.steps) expect(describeStep(st).pt, d.id).not.toMatch(/×|[(]/);
  });

  it('are well formed: unique ids, needs_br, real items, real cards, real NPCs and rooms', () => {
    expect(new Set(RECADOS.map((d) => d.id)).size).toBe(RECADOS.length);
    for (const d of RECADOS) {
      expect(d.needs_br, d.id).toBe(true);
      expect(d.steps.length, d.id).toBeGreaterThan(0);
      expect(isNpcId(d.giver), d.id).toBe(true);
      for (const c of d.cards) expect(cardById(c), c).toBeTruthy();
      expect(d.cards.length, d.id).toBeGreaterThan(0);
      if (d.reward.itemId) expect(itemById(d.reward.itemId), d.id).toBeTruthy();
      for (const t of [d.title, d.ask, d.thanks]) expect(t.pt && t.en, d.id).toBeTruthy();
      for (const st of d.steps) {
        expect(describeStep(st).pt && describeStep(st).en, d.id).toBeTruthy();
        if (st.kind === 'pedir' || st.kind === 'entregar') expect(itemById(st.itemId), st.itemId).toBeTruthy();
        if ('npc' in st && st.npc) expect(isNpcId(st.npc), d.id).toBe(true);
        if (st.kind === 'ir') expect(ROOMS[st.room], d.id).toBeTruthy();
      }
      expect(d.title.pt.length, d.id).toBeLessThanOrEqual(40);
      expect(d.ask.pt.split(/\s+/).length, d.id).toBeLessThanOrEqual(24);
    }
    expect(recadoById('carlos_cafe_pra_nanda')?.giver).toBe('carlos');
    expect(recadoById('nope')).toBeUndefined();
    expect(recadoById(undefined)).toBeUndefined();
  });

  it('are the first 15 plus three at the feira: five givers, the bond spread 6 / 7 / 5, rewards in the economy', () => {
    expect(RECADOS).toHaveLength(18);
    expect(new Set(RECADOS.map((d) => d.giver))).toEqual(new Set(['carlos', 'nanda', 'julia', 'graca', 'tia_lu']));
    expect(RECADOS.filter((d) => d.minBond === 0)).toHaveLength(6);
    expect(RECADOS.filter((d) => d.minBond === 10)).toHaveLength(7);
    expect(RECADOS.filter((d) => d.minBond >= 20 && d.minBond <= 30)).toHaveLength(5);
    for (const d of RECADOS) {
      expect(d.reward.rv, d.id).toBeGreaterThanOrEqual(8);
      expect(d.reward.rv, d.id).toBeLessThanOrEqual(15);
      expect(d.reward.bond, d.id).toBeGreaterThanOrEqual(3);
      expect(d.reward.bond, d.id).toBeLessThanOrEqual(6);
      // no single recado outpays a full Carlos scene (ECONOMY.sceneMax)
      expect(d.reward.rv, d.id).toBeLessThanOrEqual(ECONOMY.sceneMax + 1);
    }
  });

  it('use every step kind the brief asks for, mostly pedir + entregar', () => {
    const kinds = RECADOS.flatMap((d) => d.steps.map((s) => s.kind));
    for (const k of ['pedir', 'entregar', 'cumprimentar', 'ir', 'falar'] as const) expect(kinds, k).toContain(k);
    expect(RECADOS.filter((d) => d.steps.some((s) => s.kind === 'pedir') && d.steps.some((s) => s.kind === 'entregar')).length).toBeGreaterThanOrEqual(8);
    expect(RECADOS.some((d) => d.steps.some((s) => s.kind === 'cumprimentar' && s.timeCorrect))).toBe(true);
  });

  it('gate exactly what cannot be finished yet: feira recados (Tia Lu) and falar with anyone but Seu Carlos', () => {
    expect(gated.map((d) => [d.id, d.requires]).sort()).toEqual(
      [
        ['julia_conhecer_nanda', 'dialogue'],
        ['nanda_pergunta_pro_carlos', 'dialogue'],
        ['tia_lu_banana_pra_nanda', 'feira'],
        ['tia_lu_flores_pra_julia', 'feira'],
        ['nanda_maca', 'feira'],
        ['carlos_salada_do_ze', 'feira'],
        ['julia_pastel_caldo_pra_bia', 'feira'],
      ].sort(),
    );
    for (const d of RECADOS) {
      const vendors = ['tia_lu', 'ze', 'chico', 'rosa'];
      const usesFeira = vendors.includes(d.giver) || d.steps.some((s) => 'npc' in s && vendors.includes(s.npc as string));
      const talksToOthers = d.steps.some((s) => s.kind === 'falar' && s.npc !== 'carlos');
      if (usesFeira) expect(d.requires, d.id).toBe('feira');
      else if (talksToOthers) expect(d.requires, d.id).toBe('dialogue');
      else expect(d.requires, d.id).toBeUndefined();
    }
    for (const id of ['banana', 'flores', 'maca', 'alface', 'tomate', 'caldo_de_cana']) expect(RECADOS.some((d) => d.requires === 'feira' && d.steps.some((s) => 'itemId' in s && s.itemId === id))).toBe(true);
  });

  it('have no dead ends today: ungated steps only involve NPCs that exist and items the padaria scene can put in the bag', () => {
    const inWorld = new Set(Object.values(ROOMS).flatMap((r) => r.npcs.map((n) => n.id)));
    const orderable = new Set(['pao_na_chapa', 'coxinha', 'pastel', 'cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua']);
    for (const d of RECADOS.filter((r) => !r.requires)) {
      let inBag = new Set<string>();
      let prev: RecadoDef['steps'][number] | undefined;
      for (const st of d.steps) {
        if ('npc' in st && st.npc) expect(inWorld.has(st.npc), `${d.id}: ${st.kind} ${st.npc}`).toBe(true);
        if (st.kind === 'pedir') {
          expect(orderable.has(st.itemId), `${d.id}: ${st.itemId}`).toBe(true);
          expect(st.npc, d.id).toBe('carlos');
          expect(st.qty, d.id).toBe(1);
          // one scene orders one food and one drink: two pedir in a row would need two scenes
          expect(prev?.kind, d.id).not.toBe('pedir');
          inBag = new Set([...inBag, st.itemId]);
        }
        if (st.kind === 'entregar') expect(inBag.has(st.itemId), `${d.id}: hands over ${st.itemId} without ordering it`).toBe(true);
        prev = st;
      }
    }
  });

  it('the givers who are not in the world yet (Graça, Tia Lu) are only ever the giver, never a step target, until they arrive', () => {
    for (const d of RECADOS.filter((r) => !r.requires)) for (const st of d.steps) if ('npc' in st) expect(['graca', 'tia_lu']).not.toContain(st.npc);
    expect(npcName('graca')).toBe('Dona Graça');
    expect(npcName('tia_lu')).toBe('Tia Lu');
    expect(npcName('carlos')).toBe('Seu Carlos');
  });

  it('stay in the A1 register: você/tá/pra, never “Give me”, and the pack keeps the Portuguese thanks and asks', () => {
    for (const d of RECADOS) {
      for (const t of [d.title.en, d.ask.en, d.thanks.en]) expect(t, d.id).not.toMatch(/give me/i);
      expect(`${d.ask.pt} ${d.thanks.pt}`, d.id).not.toMatch(/\btu\b|\bvocês\b|\bvós\b/i);
    }
  });
});

describe('RECADO_FLAGS (feature gating in the offer logic)', () => {
  const day = 777;
  const everything = { carlos: 100, nanda: 100, julia: 100, graca: 100, tia_lu: 100, prof: 100 };
  const seen = (flags?: Record<RecadoFlag, boolean>) => new Set(Array.from({ length: 40 }, (_, i) => offerFor({ bond: everything }, day, mulberry32(i), RECADOS, 15, flags)).flat());

  it('both flags are on by default (Phase 7 shipped the NPC dialogue, Phase 9 the feira), so every recado is offered', () => {
    expect(RECADO_FLAGS).toEqual({ feira: true, dialogue: true });
    const ids = seen();
    expect(ids.size).toBe(18);
    for (const d of RECADOS) expect(ids.has(d.id), d.id).toBe(true);
    expect(recadoEnabled(RECADOS[0]!)).toBe(true);
    expect(recadoEnabled({ requires: 'feira' })).toBe(true);
    expect(recadoEnabled({ requires: 'feira' }, { feira: false, dialogue: true })).toBe(false);
  });

  it('each flag unlocks only its own recados', () => {
    const feira = seen({ feira: true, dialogue: false });
    expect(feira.has('tia_lu_banana_pra_nanda') && feira.has('tia_lu_flores_pra_julia')).toBe(true);
    expect(feira.has('julia_conhecer_nanda')).toBe(false);
    const dialogue = seen({ feira: false, dialogue: true });
    expect(dialogue.has('julia_conhecer_nanda') && dialogue.has('nanda_pergunta_pro_carlos')).toBe(true);
    expect(dialogue.has('tia_lu_banana_pra_nanda')).toBe(false);
    expect(seen({ feira: true, dialogue: true }).size).toBe(18);
    expect(feira.has('nanda_maca') && feira.has('carlos_salada_do_ze') && feira.has('julia_pastel_caldo_pra_bia')).toBe(true);
  });

  it('can be overridden globally (tests, and the later phases that ship the features) and restored', () => {
    const before = { ...RECADO_FLAGS };
    try {
      RECADO_FLAGS.feira = false;
      expect(seen().size).toBe(13);
      // the rollover reads the live flags too
      const st = rollRecadoDay({ bond: everything }, day, mulberry32(3), RECADOS);
      expect(st.offered).toHaveLength(3);
    } finally {
      Object.assign(RECADO_FLAGS, before);
    }
    expect(seen().size).toBe(18);
  });

  it('a new player at bond 0 is offered three of the six open recados', () => {
    const pool = new Set(Array.from({ length: 60 }, (_, i) => offerFor({}, day, mulberry32(i), RECADOS, 15)).flat());
    expect([...pool].sort()).toEqual(['carlos_cafe_pra_nanda', 'graca_pao_pra_julia', 'julia_cumprimento_certo', 'nanda_coxinha', 'nanda_um_oi_pro_carlos', 'tia_lu_banana_pra_nanda']);
    expect(offerFor({}, day, mulberry32(1))).toHaveLength(3);
  });
});

describe('withheldByBond', () => {
  const pool = (giver: 'carlos' | 'nanda', id: string, minBond: number, requires?: RecadoFlag): RecadoDef => ({ ...RECADOS[0]!, id, giver, minBond, ...(requires ? { requires } : {}) });
  const defs = [pool('carlos', 'c0', 0), pool('carlos', 'c30', 30), pool('nanda', 'n50', 50), pool('nanda', 'nf', 10, 'feira')];

  it('lists what the bond filter holds back: under the giver minBond, flag on, not skipped', () => {
    expect(withheldByBond({}, [], defs).map((d) => d.id)).toEqual(['c30', 'n50', 'nf']);
    expect(withheldByBond({ carlos: 30, nanda: 10 }, [], defs).map((d) => d.id)).toEqual(['n50']);
    expect(withheldByBond({}, ['c30'], defs).map((d) => d.id)).toEqual(['n50', 'nf']);
    expect(withheldByBond({}, [], defs, { ...RECADO_FLAGS, feira: false }).map((d) => d.id)).toEqual(['c30', 'n50']);
  });

  it('is exactly what offerFor never offers for that bond', () => {
    const bond = { carlos: 12 };
    const offered = new Set(Array.from({ length: 60 }, (_, i) => offerFor({ bond }, 1, mulberry32(i), RECADOS, 30)).flat());
    for (const d of withheldByBond(bond)) expect(offered.has(d.id)).toBe(false);
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

  it('the shipped pack unlocks the bond-10 recados for their giver only', () => {
    expect(offerFor({ bond: { carlos: 10 } }, day, mulberry32(1), RECADOS, 15)).toContain('carlos_agua_pra_julia');
    expect(offerFor({ bond: { nanda: 100 } }, day, mulberry32(1), RECADOS, 15)).not.toContain('carlos_agua_pra_julia');
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

describe('where a step happens (markers, arrows, the where-line)', () => {
  const at = (h: number, m = 0) => h * 60 + m;

  it('finds a scheduled NPC by the hour, and when one at home comes back out', () => {
    expect(npcWhere('nanda', at(10))).toEqual({ npc: 'nanda', room: 'praca', out: true });
    expect(npcWhere('nanda', at(21))).toMatchObject({ out: false, backAt: at(8) });
    expect(npcWhere('nanda', at(3))).toMatchObject({ out: false, backAt: at(8) });
    expect(npcWhere('graca', at(9))).toMatchObject({ out: false, backAt: at(17) });
    // no schedule: the room that lists them, always out
    expect(npcWhere('prof', at(3))).toMatchObject({ room: 'academia', out: true });
  });

  it('sends a step with Seu Carlos to whoever works the counter, and names the room or the time they are back', () => {
    const order: RecadoStep = { kind: 'pedir', npc: 'carlos', itemId: 'coxinha', qty: 1 };
    expect(stepNpc(order)).toBe('carlos');
    expect(stepWhere(order, at(10))).toMatchObject({ room: 'padaria', npc: 'carlos', out: true });
    expect(stepWhere(order, at(23))).toMatchObject({ room: 'padaria', npc: 'graca', out: true });
    expect(stepWhere({ kind: 'ir', room: 'feira' }, at(10))).toMatchObject({ room: 'feira', npc: null });
    expect(stepNpc({ kind: 'cumprimentar', timeCorrect: true })).toBeNull();
    expect(whereLine(stepWhere({ kind: 'entregar', npc: 'nanda', itemId: 'coxinha', qty: 1 }, at(10)))).toEqual({ pt: ROOMS.praca.name, en: ROOMS.praca.gloss });
    expect(whereLine(stepWhere({ kind: 'entregar', npc: 'nanda', itemId: 'coxinha', qty: 1 }, at(22)))).toEqual({ pt: 'Em casa · volta às 8h', en: 'At home · back at 8:00' });
  });

  it('points at the door toward the next room on the shortest public route', () => {
    expect(nextPortalToward('praca', { x: 10, y: 10 }, 'praca')).toBeNull();
    expect(nextPortalToward('praca', { x: 10, y: 10 }, 'padaria')?.to).toBe('rua');
    expect(nextPortalToward('rua', { x: 5, y: 5 }, 'padaria')?.to).toBe('padaria');
  });
});

describe('drop and the day bonus', () => {
  it('drop takes an active recado off the list and back onto the offer; unknown ids are refused', () => {
    const st = { ...freshRecadoState(), day: 3, offered: [], active: [{ id: 'nanda_coxinha', step: 1 }] };
    expect(dropRecado(st, 'nope')).toBeNull();
    const next = dropRecado(st, 'nanda_coxinha')!;
    expect(next.active).toEqual([]);
    expect(next.offered).toEqual(['nanda_coxinha']);
    expect(st.active).toHaveLength(1);
  });

  it('the bonus is due at three done and not yet paid; it survives a reload and resets with the day', () => {
    expect(dayBonusDue({ done: ['a', 'b'] })).toBe(false);
    expect(dayBonusDue({ done: ['a', 'b', 'c'] })).toBe(true);
    expect(dayBonusDue({ done: ['a', 'b', 'c'], bonus: true })).toBe(false);
    expect(normalizeRecados({ day: 2, bonus: true }).bonus).toBe(true);
    expect(normalizeRecados({ day: 2, bonus: 'yes' }).bonus).toBeUndefined();
    const rolled = rollRecadoDay({ recados: { ...freshRecadoState(), day: 1, done: ['a', 'b', 'c'], bonus: true } }, 2, mulberry32(1));
    expect(rolled.bonus).toBeUndefined();
  });
});

describe('naming an item in a sentence', () => {
  it('uses the card’s gender for um / uma, and no article for a plural', () => {
    expect(itemWithArticle('coxinha')).toBe('uma coxinha');
    expect(itemWithArticle('cafe_com_leite')).toBe('um café com leite');
    expect(itemWithArticle('banana')).toBe('uma banana');
    expect(itemWithArticle('flores')).toBe('flores');
    for (const it of ITEMS) expect(it.gender, it.id).toBeDefined();
  });
});
