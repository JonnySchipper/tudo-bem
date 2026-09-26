import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCards, buildCpuNames, buildOrders } from '../../../scripts/build-curriculum.mjs';
import cardsJson from '../../../content/curriculum/phase0/cards.json';
import ordersJson from '../../../content/curriculum/phase0/me-ve-um-orders.json';
import cpuNamesJson from '../../../content/curriculum/phase0/cpu-names.json';
import dnt from '../../../content/curriculum/phase0/do-not-teach.json';
import npcPack from '../../../content/safety/phase0/jev/npc-reply-pack.json';
import { AUTHORED_ORDERS, MG_ITEMS, MG_MODS, makeOrder, mulberry32 } from './meveum.js';
import { chooseChip, scoreTypedReply, SCENE_NODE_IDS, SCENE_START, viewNode, type SceneCtx } from './carlos.js';
import { acceptAnswer, normalizeAnswer } from './accept.js';
import { CARDS, cardById } from './cards.js';
import { HATS, FURNITURE } from './catalog.js';
import { ROOMS } from './rooms.js';
import { classifyChat } from './safety.js';
import { glossPt } from './gloss.js';

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

  it('me-ve-um-orders.json is in sync with me-ve-um-orders.md (run `pnpm content` after editing .md)', () => {
    expect(JSON.parse(JSON.stringify(buildOrders()))).toEqual(ordersJson);
  });

  it('cpu-names.json is in sync with cpu-name-allowlist.md: 48 first names, no surnames', () => {
    expect(JSON.parse(JSON.stringify(buildCpuNames()))).toEqual(cpuNamesJson);
    const names = cpuNamesJson.names;
    expect(names).toHaveLength(48);
    expect(new Set(names).size).toBe(48);
    for (const n of names) {
      expect(n, n).toMatch(/^\p{Lu}\p{Ll}+$/u);
      expect(classifyChat(n).action, n).toBe('allow');
    }
    expect(names).toEqual(expect.arrayContaining(['João', 'Letícia', 'Vinícius']));
  });

  it('every card comes from the pack markdown and awaits Brazilian sign-off only', () => {
    for (const c of CARDS) {
      expect(c.signoff, c.id).toBe('needs_br');
      expect(c.source, c.id).toMatch(/^lexemes-.*\.md$/);
    }
    expect(cardById('lex.social.obrigado')!.accepts).toEqual(expect.arrayContaining(['obrigado', 'obrigada']));
  });

  it.each([
    ['pao_de_queijo', 'cheese bread (cassava cheese roll)'],
    ['misto_quente', 'grilled ham and cheese sandwich'],
    ['guarana', 'guaraná soda'],
    ['pois_nao', 'Yes? / Coming — how can I help?'],
    ['ta_na_mao', 'Here you go. (friendly handoff)'],
    ['por_conta_da_casa', 'on the house'],
  ])('former engineering seed %s carries the locked Curriculum gloss (ENG-SEED-REVIEW 2026-09-25)', (id, gloss) => {
    const c = cardById(`lex.padaria.${id}`)!;
    expect(c.gloss_en).toBe(gloss);
    expect(c.source).toBe('lexemes-padaria-a1.md');
  });

  it('“Me vê” is never glossed as “Give me” on any EN surface', () => {
    const en: string[] = [...AUTHORED_ORDERS.map((o) => o.en), ...ordersJson.orders.map((o) => o.en)];
    const rng = mulberry32(5);
    for (let i = 0; i < 60; i++) en.push(makeOrder(rng, 4 + (i % 2)).en);
    for (const pronoun of ['ele', 'ela', 'nome'] as const)
      for (const id of SCENE_NODE_IDS) {
        const v = viewNode(id, { name: 'Ana', pronoun, food: 'coxinha', drink: 'agua' })!;
        en.push(v.line.en, ...v.chips.map((c) => c.en));
      }
    for (const room of Object.values(ROOMS)) en.push(...room.props.map((p) => p.label?.en ?? ''));
    en.push(glossPt('Me vê um pão na chapa, por favor.') ?? '');
    expect(en.filter((s) => /give me/i.test(s))).toEqual([]);
    expect(AUTHORED_ORDERS.find((o) => o.pt === 'Me vê um café com leite.')!.en).toBe('I’ll take a coffee with milk.');
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

  // Typed replies to the authored Seu Carlos nodes, scored onto chips by accept-list-rules.md.
  // [node, typed text, chip, task_success, language?]
  const TYPED: [string, string, number | null, number, string?][] = [
    ['inicio', 'tudo bem', 0, 3],
    ['inicio', 'Bom dia, Seu Carlos!', 1, 3],
    ['inicio', 'oi', 2, 2],
    ['inicio', 'hello', 3, 1, 'en'],
    ['pedido', 'me ve um pao na chapa por favor', 0, 3],
    ['pedido', 'Me vê um pão na chapa', 0, 3],
    ['pedido', 'me da um pao na chapa', 0, 2],
    ['pedido', 'quero um pão na chapa, por favor', 0, 2],
    ['pedido', 'pao na chapa', 0, 1],
    ['pedido', 'um cafe com leite pf', 1, 3],
    ['pedido', 'ainda to olhando', 2, 2],
    ['pedido', 'two breads and a coffee', 3, 1, 'en'],
    ['pedido', 'quero um sorvete', null, 0],
    ['bebida', 'uma agua por favor', 2, 3],
    ['bebida', 'um suco de laranja', 1, 1],
    ['local', 'para viagem', 1, 3],
    ['local', 'to go', 3, 1, 'en'],
    ['preco', 'obrigada!', 0, 3],
    ['preco', 'valeu', 1, 2],
  ];
  it.each(TYPED)('typed reply %s: “%s”', (node, text, chip, taskSuccess, language) => {
    const r = scoreTypedReply(node, text, { name: 'Ana', pronoun: 'ela', food: 'pao_na_chapa' });
    expect(r.chip, r.why).toBe(chip);
    expect(r.task_success, r.why).toBe(taskSuccess);
    if (language) expect(r.language).toBe(language);
  });

  it('Carlos never offers what the Jev NPC-reply pack forbids', () => {
    for (const id of SCENE_NODE_IDS) {
      const line = viewNode(id, { name: 'Ana', pronoun: 'ela', food: 'pao_na_chapa' })?.line.pt;
      if (line) expect(classifyChat(line).action, `${npcPack.scene_flavor}\n${line}`).toBe('allow');
    }
  });
});
