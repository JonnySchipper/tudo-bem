import { describe, expect, it } from 'vitest';
import { chooseChip, scenePayout, SCENE_NODE_IDS, SCENE_START, viewNode, type SceneCtx } from './carlos.js';
import { checkTray, makeOrder, mgPayout, MG_MAX_POINTS, mulberry32, sanitizeMods, sanitizeTray, linePt } from './meveum.js';
import { detectLang, glossPt } from './gloss.js';
import { numberPt } from './numbers.js';
import { buildGrid, canPlaceFurniture, ROOMS, isWalkable } from './rooms.js';
import { findPath, positionAlong, pathDuration } from './path.js';
import { classifyChat } from './safety.js';
import { HATS, FURNITURE } from './catalog.js';
import { DEFAULT_APPEARANCE, STARTER_OUTFITS } from './constants.js';

describe('numbers', () => {
  it('spells Portuguese numbers with agreement', () => {
    expect(numberPt(1)).toBe('um');
    expect(numberPt(1, 'f')).toBe('uma');
    expect(numberPt(2, 'f')).toBe('duas');
    expect(numberPt(11)).toBe('onze');
    expect(numberPt(21, 'f')).toBe('vinte e uma');
    expect(numberPt(100)).toBe('cem');
  });
});

describe('gloss', () => {
  it('glosses common Portuguese lines', () => {
    expect(glossPt('Oi, tudo bem?')).toMatch(/hi/i);
    expect(glossPt('Bom dia!')).toBe('Good morning!');
    expect(glossPt('eu quero um pão de queijo')).toMatch(/cheese/);
    expect(glossPt('Oi, Jonny! Eu sou de Chicago.')).toBe('Hi, Jonny! I’m from Chicago.');
    expect(glossPt('Que kitnet legal!')).toBe('What a cool studio apartment!');
    expect(glossPt('Vamos na padaria?')).toBe('Let’s go to the bakery?');
  });
  it('does not gloss English', () => {
    expect(detectLang('hello how are you')).toBe('en');
    expect(glossPt('hello how are you')).toBeNull();
  });
});

describe('Me vê um…', () => {
  it('generates grammatical orders that escalate', () => {
    const rng = mulberry32(42);
    const first = makeOrder(rng, 0);
    expect(first.lines.length).toBeGreaterThanOrEqual(1);
    const late = makeOrder(rng, 5);
    expect(late.lines.length).toBeGreaterThanOrEqual(2);
    expect(linePt({ itemId: 'coxinha', qty: 2 })).toBe('duas coxinhas');
    expect(linePt({ itemId: 'agua', qty: 2 })).toBe('duas águas');
    expect(linePt({ itemId: 'pastel', qty: 3 })).toBe('três pastéis');
    expect(linePt({ itemId: 'pao_de_queijo', qty: 3 })).toBe('três pães de queijo');
  });

  it('checks trays and modifiers exactly', () => {
    const order = { customer: 'x', pt: '', en: '', timeMs: 1, authored: false, mods: ['pra_viagem'], lines: [{ itemId: 'coxinha', qty: 2 }, { itemId: 'cafe', qty: 1 }] };
    expect(checkTray(order, { coxinha: 2, cafe: 1 }, ['pra_viagem']).ok).toBe(true);
    expect(checkTray(order, { coxinha: 2, cafe: 1 }, []).missingMods).toEqual(['pra_viagem']);
    expect(checkTray(order, { coxinha: 2, cafe: 1 }, ['pra_viagem', 'sem_acucar']).extraMods).toEqual(['sem_acucar']);
    expect(checkTray(order, { coxinha: 1, cafe: 1 }, ['pra_viagem']).missing).toEqual([{ itemId: 'coxinha', qty: 1 }]);
    expect(checkTray(order, { coxinha: 2, cafe: 1, pastel: 1 }, ['pra_viagem']).extra).toEqual([{ itemId: 'pastel', qty: 1 }]);
  });

  it('sanitizes client trays and modifiers', () => {
    expect(sanitizeTray({ coxinha: 2.7, hacker: 5, pastel: -1 })).toEqual({ coxinha: 2 });
    expect(Object.values(sanitizeTray({ coxinha: 99 }))[0]).toBeLessThanOrEqual(9);
    expect(sanitizeMods(['pra_viagem', 'pra_comer_aqui', 'nope', 'bem_quente'])).toEqual(['pra_comer_aqui', 'bem_quente']);
  });

  it('pays 8–20 RV', () => {
    expect(mgPayout(0)).toBe(8);
    expect(mgPayout(MG_MAX_POINTS)).toBe(20);
  });

  it('never puts banned content in generated orders', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) expect(classifyChat(makeOrder(rng, i % 6).pt).action).toBe('allow');
  });
});

describe('Seu Carlos scene', () => {
  const walk = (ctx: SceneCtx, picks: number[]) => {
    let node = SCENE_START;
    const scores: number[] = [];
    for (const p of picks) {
      const r = chooseChip(node, p, ctx)!;
      scores.push(r.score);
      ctx = r.ctx;
      node = r.next;
    }
    return { node, scores, ctx };
  };

  it('reaches the end with top chips in 5 turns', () => {
    const { node, scores, ctx } = walk({ name: 'Ana', pronoun: 'ela' }, [0, 0, 0, 0, 0]);
    expect(node).toBe('fim');
    expect(scores).toEqual([3, 3, 3, 3, 3]);
    expect(ctx.food).toBe('pao_na_chapa');
    expect(ctx.where).toBe('aqui');
    expect(viewNode('fim', ctx)!.end).toBe(true);
    expect(scenePayout(scores, 0)).toBe(14);
  });

  it('rephrases slower on low-score chips and still finishes', () => {
    const { node, scores } = walk({ name: 'Sam', pronoun: 'nome' }, [3, 0, 3, 0, 3, 0, 3, 0, 2, 0]);
    expect(node).toBe('fim');
    expect(Math.min(...scores)).toBe(1);
  });

  it('respects the addressed form and spends kinship once', () => {
    const ela = walk({ name: 'Ana', pronoun: 'ela' }, [0, 0, 0, 0, 0]);
    expect(viewNode('fim', { ...ela.ctx, kinUsed: false })!.line.pt).toMatch(/Tá na mão, minha filha\./);
    const ele = walk({ name: 'Leo', pronoun: 'ele' }, [0, 2, 0, 0, 0, 0]);
    expect(ele.ctx.kinUsed).toBe(true);
    expect(viewNode('fim', ele.ctx)!.line.pt).toMatch(/^Tá na mão\. /);
    expect(viewNode('fim', { name: 'Sam', pronoun: 'nome' })!.line.pt).not.toMatch(/filh/);
    expect(viewNode('preco', { name: 'Ana', pronoun: 'ela' })!.chips[0].pt).toBe('Muito obrigada, Seu Carlos!');
  });

  it('decays payouts after daily cap', () => {
    expect(scenePayout([3, 3], 2)).toBe(7);
    expect(scenePayout([3, 3], 9)).toBe(0);
  });

  it('keeps all authored lines inside the constitution', () => {
    for (const pronoun of ['ele', 'ela', 'nome'] as const) {
      for (const id of SCENE_NODE_IDS) {
        const v = viewNode(id, { name: 'Ana', pronoun, food: 'coxinha', drink: 'cafe' })!;
        expect(classifyChat(v.line.pt).action, v.line.pt).toBe('allow');
        for (const c of v.chips) expect(classifyChat(c.pt).action, c.pt).toBe('allow');
      }
    }
  });
});

describe('rooms + pathing', () => {
  it('every room spawn, portal and interact tile is reachable', () => {
    for (const room of Object.values(ROOMS)) {
      const g = buildGrid(room);
      expect(isWalkable(g, room.spawn.x, room.spawn.y)).toBe(true);
      const targets = room.portals.map((p) => ({ x: p.x, y: p.y }));
      for (const p of room.portals) {
        const dest = ROOMS[p.to];
        expect(findPath(buildGrid(dest), dest.spawn, p.arrive), `${p.id} arrive`).not.toBeNull();
      }
      for (const p of room.props) if (p.interact) targets.push(p.interact);
      for (const p of room.props) if (p.seat) targets.push({ x: p.x, y: p.y });
      for (const n of room.npcs) targets.push(n.interact);
      for (const t of targets) expect(findPath(g, room.spawn, t), `${room.id} → ${t.x},${t.y}`).not.toBeNull();
    }
  });

  it('interpolates along paths', () => {
    const g = buildGrid(ROOMS.praca);
    const path = findPath(g, { x: 7, y: 9 }, { x: 9, y: 9 })!;
    expect(path.at(-1)).toEqual({ x: 9, y: 9 });
    const end = positionAlong({ x: 7, y: 9 }, path, pathDuration({ x: 7, y: 9 }, path) + 1, 'SE');
    expect(end.moving).toBe(false);
    expect(end.tile).toEqual({ x: 9, y: 9 });
  });

  it('furniture cannot go on doors or fixed props', () => {
    const k = ROOMS.kitnet;
    expect(canPlaceFurniture(k, [], 3, 4)).toBe(true);
    expect(canPlaceFurniture(k, [], 0, 5)).toBe(false);
    expect(canPlaceFurniture(k, [], 6, 1)).toBe(false);
    expect(canPlaceFurniture(k, [{ uid: 'a', itemId: 'cadeira_madeira', x: 3, y: 4, rot: 0 }], 3, 4)).toBe(false);
  });
});

describe('catalog', () => {
  it('ships 12 hats with some free and names inside the constitution', () => {
    expect(HATS).toHaveLength(12);
    expect(HATS.filter((h) => h.price === 0).length).toBeGreaterThanOrEqual(2);
    for (const item of [...HATS, ...FURNITURE]) expect(classifyChat(item.pt).action).toBe('allow');
  });
});

describe('slim avatar create', () => {
  it('offers one clothing-only starter outfit and keeps a full saved appearance', () => {
    expect(STARTER_OUTFITS).toHaveLength(1);
    expect(STARTER_OUTFITS[0].id).toBe('visual_inicial');
    expect(Object.keys(STARTER_OUTFITS[0].set).sort()).toEqual(['bottom', 'bottomColor', 'shoes', 'top', 'topColor']);
    expect(STARTER_OUTFITS[0].set).toMatchObject({ top: 'camiseta', bottom: 'calca' });
    expect(DEFAULT_APPEARANCE.extra).toBe('nenhum');
    expect(DEFAULT_APPEARANCE.hair).toBeTruthy();
    expect(DEFAULT_APPEARANCE.face).toBeTruthy();
  });
});
