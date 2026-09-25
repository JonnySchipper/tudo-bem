import { describe, expect, it } from 'vitest';
import { chooseChip, scenePayout, SCENE_START, viewNode, type SceneCtx } from './carlos.js';
import { checkTray, makeOrder, mgPayout, MG_MAX_POINTS, mulberry32, sanitizeTray, linePt } from './meveum.js';
import { detectLang, glossPt } from './gloss.js';
import { numberPt } from './numbers.js';
import { buildGrid, canPlaceFurniture, ROOMS, isWalkable } from './rooms.js';
import { findPath, positionAlong, pathDuration } from './path.js';
import { classifyChat } from './safety.js';
import { HATS, FURNITURE } from './catalog.js';

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
    expect(first.lines).toHaveLength(1);
    expect(first.lines[0].qty).toBe(1);
    expect(first.pt).toMatch(/[Mm]e vê/);
    const late = makeOrder(rng, 5);
    expect(late.lines.length).toBeGreaterThanOrEqual(2);
    expect(linePt({ itemId: 'coxinha', qty: 2 })).toBe('duas coxinhas');
    expect(linePt({ itemId: 'pao_de_queijo', qty: 3 })).toBe('três pães de queijo');
  });

  it('checks trays exactly', () => {
    const order = { customer: 'x', pt: '', en: '', timeMs: 1, lines: [{ itemId: 'coxinha', qty: 2 }, { itemId: 'cafezinho', qty: 1 }] };
    expect(checkTray(order, { coxinha: 2, cafezinho: 1 }).ok).toBe(true);
    expect(checkTray(order, { coxinha: 1, cafezinho: 1 }).missing).toEqual([{ itemId: 'coxinha', qty: 1 }]);
    expect(checkTray(order, { coxinha: 2, cafezinho: 1, sonho: 1 }).extra).toEqual([{ itemId: 'sonho', qty: 1 }]);
  });

  it('sanitizes client trays', () => {
    expect(sanitizeTray({ coxinha: 2.7, hacker: 5, sonho: -1 })).toEqual({ coxinha: 2 });
    expect(Object.values(sanitizeTray({ coxinha: 99 }))[0]).toBeLessThanOrEqual(9);
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
    expect(viewNode('fim', ctx)!.end).toBe(true);
    expect(scenePayout(scores, 0)).toBe(14);
  });

  it('rephrases slower on low-score chips and still finishes', () => {
    const { node, scores } = walk({ name: 'Sam', pronoun: 'nome' }, [3, 0, 3, 0, 3, 0, 2, 0, 2, 0]);
    expect(node).toBe('fim');
    expect(Math.min(...scores)).toBe(1);
  });

  it('respects the addressed form', () => {
    expect(viewNode('inicio', { name: 'Ana', pronoun: 'ela' })!.line.pt).toMatch(/minha filha.*bem-vinda/);
    expect(viewNode('inicio', { name: 'Leo', pronoun: 'ele' })!.line.pt).toMatch(/meu filho.*bem-vindo/);
    expect(viewNode('inicio', { name: 'Sam', pronoun: 'nome' })!.line.pt).toMatch(/Sam/);
  });

  it('decays payouts after daily cap', () => {
    expect(scenePayout([3, 3], 2)).toBe(7);
    expect(scenePayout([3, 3], 9)).toBe(0);
  });

  it('keeps all authored lines inside the constitution', () => {
    for (const pronoun of ['ele', 'ela', 'nome'] as const) {
      for (const id of ['inicio', 'inicio_devagar', 'pedido', 'pedido_dica', 'bebida', 'bebida_dica', 'mais', 'mais_dica', 'preco', 'preco_dica', 'fim']) {
        const v = viewNode(id, { name: 'Ana', pronoun, food: 'coxinha', drink: 'cafezinho' })!;
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
