import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCards } from '../../../scripts/build-curriculum.mjs';
import cardsJson from '../../../content/curriculum/phase0/cards.json';
import dnt from '../../../content/curriculum/phase0/do-not-teach.json';
import npcPack from '../../../content/safety/phase0/jev/npc-reply-pack.json';
import { AUTHORED_ORDERS, MG_ITEMS, MG_MODS, makeOrder, mulberry32 } from './meveum.js';
import { chooseChip, scoreTypedReply, SCENE_NODE_IDS, SCENE_START, viewNode, type SceneCtx } from './carlos.js';
import { acceptAnswer, normalizeAnswer } from './accept.js';
import { CARDS, cardById } from './cards.js';
import { HATS, FURNITURE } from './catalog.js';
import { ROOMS } from './rooms.js';
import { classifyChat } from './safety.js';

const dir = path.resolve(__dirname, '../../../content/curriculum/phase0');
const md = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

/** Every chip path through the Carlos scene (DFS). */
function allPaths(ctx: SceneCtx) {
  const out: { lines: string[]; chips: string[]; end: string }[] = [];
  const walk = (node: string, c: SceneCtx, lines: string[], chips: string[], depth: number) => {
    const v = viewNode(node, c)!;
    const l2 = [...lines, v.line.pt];
    if (v.end || depth > 12) return out.push({ lines: l2, chips, end: node });
    v.chips.forEach((chip, i) => {
      const r = chooseChip(node, i, c)!;
      walk(r.next, r.ctx, l2, [...chips, chip.pt], depth + 1);
    });
  };
  walk(SCENE_START, ctx, [], [], 0);
  return out;
}

describe('curriculum pack ingest (content/curriculum/phase0)', () => {
  it('cards.json is in sync with the lexeme markdown (run `pnpm content` after editing .md)', () => {
    expect(JSON.parse(JSON.stringify(buildCards()))).toEqual(cardsJson);
  });

  it('every pack card is DRAFT awaiting Brazilian sign-off; engineering seeds are flagged', () => {
    for (const c of CARDS) expect(['needs_br', 'needs_curriculum_and_br']).toContain(c.signoff);
    for (const c of CARDS.filter((c) => c.source === 'engineering-seed')) expect(c.signoff).toBe('needs_curriculum_and_br');
    expect(cardById('lex.social.obrigado')!.accepts).toEqual(expect.arrayContaining(['obrigado', 'obrigada']));
  });

  it('authored Me vê um tickets match me-ve-um-orders.md verbatim and use only shelf items + mods', () => {
    const text = md('me-ve-um-orders.md');
    expect(AUTHORED_ORDERS).toHaveLength(14);
    for (const o of AUTHORED_ORDERS) {
      expect(text, o.pt).toContain(o.pt);
      for (const [id] of o.lines) expect(MG_ITEMS.map((i) => i.id)).toContain(id);
      for (const m of o.mods) expect(MG_MODS.map((x) => x.id)).toContain(m);
    }
  });

  it('first rounds serve authored tickets; later rounds combine with agreement', () => {
    const rng = mulberry32(3);
    expect(makeOrder(rng, 0).authored).toBe(true);
    expect(makeOrder(rng, 3).authored).toBe(true);
    const late = makeOrder(rng, 5);
    expect(late.authored).toBe(false);
    expect(late.lines.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Seu Carlos voice sheet + CEO lock (voice-seu-carlos.md)', () => {
  for (const pronoun of ['ele', 'ela', 'nome'] as const) {
    it(`every path (${pronoun}): Pois não, never “Pode falar”, kinship ≤ 1, ≤ 18 words`, () => {
      const paths = allPaths({ name: 'Sam', pronoun });
      expect(paths.length).toBeGreaterThan(20);
      for (const p of paths) {
        const all = p.lines.join(' ');
        const kin = (all.match(/meu filho|minha filha/g) ?? []).length;
        expect(kin, all).toBeLessThanOrEqual(1);
        if (pronoun === 'nome') expect(kin).toBe(0);
        if (pronoun === 'ela') expect(all).not.toMatch(/meu filho/);
        expect(all).toMatch(/Pois não/);
        expect(all).not.toMatch(/Pode falar/i);
        for (const l of p.lines) expect(l.split(/\s+/).length, l).toBeLessThanOrEqual(18);
        expect(p.end).toBe('fim');
      }
    });
  }

  it('kinship is used when the player lingers (“Ainda tô olhando” → “Sem pressa, minha filha.”)', () => {
    let ctx: SceneCtx = { name: 'Ana', pronoun: 'ela' };
    let r = chooseChip('inicio', 0, ctx)!;
    r = chooseChip(r.next, 2, r.ctx)!;
    expect(viewNode(r.next, { ...r.ctx, kinUsed: false })!.line.pt).toMatch(/Sem pressa, minha filha\./);
    ctx = r.ctx;
    expect(ctx.kinUsed).toBe(true);
  });
});

describe('do-not-teach scan (do-not-teach.md)', () => {
  const terms = Object.values(dnt.sections).flat();
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hitsIn = (s: string) => terms.filter((t) => new RegExp(`(^|[^a-z])${norm(t).replace(/[-]/g, '\\-')}($|[^a-z])`).test(norm(s)));

  it('no authored PT surface contains a do-not-teach term', () => {
    const surfaces: string[] = [];
    for (const pronoun of ['ele', 'ela', 'nome'] as const)
      for (const id of SCENE_NODE_IDS) {
        const v = viewNode(id, { name: 'Ana', pronoun, food: 'coxinha', drink: 'agua' })!;
        surfaces.push(v.line.pt, ...v.chips.map((c) => c.pt));
      }
    surfaces.push(...AUTHORED_ORDERS.map((o) => o.pt));
    const rng = mulberry32(11);
    for (let i = 0; i < 100; i++) surfaces.push(makeOrder(rng, 4 + (i % 2)).pt);
    for (const c of CARDS) surfaces.push(c.form, ...c.patterns);
    for (const room of Object.values(ROOMS)) for (const n of room.npcs) surfaces.push(...n.idleLines.map((l) => l.pt));
    surfaces.push(...HATS.map((h) => h.pt), ...FURNITURE.map((f) => f.pt), ...MG_MODS.map((m) => m.pt));
    const bad = surfaces.flatMap((s) => hitsIn(s).map((t) => `${t} ← ${s}`));
    expect(bad).toEqual([]);
    for (const s of surfaces) expect(classifyChat(s).action, s).toBe('allow');
  });
});

describe('accept-list rules (accept-list-rules.md)', () => {
  it.each([
    ['pao', 'pão'],
    ['cafe com leite', 'Café com leite!'],
    ['OBRIGADA', 'obrigado'],
    ['2 pães', 'dois pães'],
    ['duas aguas', 'dois águas'],
    ['tres', 'três'],
    ['  me ve   um cafe  ', 'Me vê um café.'],
    ['café c/ leite', 'café com leite'],
  ])('%s ≡ %s', (a, b) => expect(normalizeAnswer(a)).toBe(normalizeAnswer(b)));

  it('Me vê construction: me dá / quero accepted at score 2, bare order at 1, English never 3', () => {
    expect(acceptAnswer('me dá um pão na chapa', 'Me vê um pão na chapa, por favor.')).toMatchObject({ match: true, cap: 2 });
    expect(acceptAnswer('quero um pão na chapa', 'Me vê um pão na chapa, por favor.')).toMatchObject({ match: true, cap: 2 });
    expect(acceptAnswer('pão na chapa', 'Me vê um pão na chapa, por favor.')).toMatchObject({ match: true, cap: 1 });
    expect(acceptAnswer('um pão na chapa, por favor', 'Me vê um pão na chapa, por favor.')).toMatchObject({ match: true, cap: 3 });
    expect(acceptAnswer('two breads and a coffee', 'Dois pães e um café.').match).toBe(false);
  });

  it.each(npcPack.fixtures.map((f) => [f.node, f.text, f] as const))('Jev NPC reply %s: “%s”', (node, text, f) => {
    const r = scoreTypedReply(node, text, { name: 'Ana', pronoun: 'ela', food: 'pao_na_chapa' });
    expect(r.chip, r.why).toBe(f.chip);
    expect(r.task_success, r.why).toBe(f.task_success);
    if ('language' in f) expect(r.language).toBe(f.language);
  });
});
