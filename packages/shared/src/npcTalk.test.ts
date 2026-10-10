import { describe, expect, it } from 'vitest';
import { NPC_TALK, TALKING_NPCS, fillTalk, talkOpener } from './npcTalk.js';
import { classifyChat } from './safety.js';
import { cardsInText } from './caderno.js';
import { isNpcId } from './bonds.js';

// the Praia's trees leave the talk for a panel: Bento's boats, Neide's log, Jô's snacks / fish tray / beach rack; Seu Dito's opens the pet shop
const RESERVED = new Set(['end', 'help', 'shop', 'treino', 'rental', 'caderneta', 'snacks', 'sell', 'rack', 'adopt', 'petshop']);
const PRAIA_NPCS = ['bento', 'neide', 'jo'] as const;

describe('NPC greeting dialogues (Nanda, Júlia, Dona Graça, Professora Bia, Seu Dito)', () => {
  it('exist for Nanda and Júlia, three lines with two reply chips each (Seu Dito has five)', () => {
    expect(TALKING_NPCS.sort()).toEqual(['bento', 'dito', 'graca', 'jo', 'julia', 'nanda', 'neide', 'prof']);
    for (const npc of TALKING_NPCS.filter((id) => !(PRAIA_NPCS as readonly string[]).includes(id))) {
      const t = NPC_TALK[npc]!;
      expect(isNpcId(npc)).toBe(true);
      expect(Object.keys(t.nodes)).toHaveLength(npc === 'dito' ? 5 : 3);
      expect(t.nodes[t.start]).toBeDefined();
      for (const [id, node] of Object.entries(t.nodes)) {
        expect(node.chips, `${npc}.${id}`).toHaveLength(2);
        expect(node.line.pt.length).toBeGreaterThan(0);
        expect(node.line.en.length).toBeGreaterThan(0);
        for (const c of node.chips) expect(RESERVED.has(c.next) || t.nodes[c.next], `${npc}.${id} -> ${c.next}`).toBeTruthy();
      }
    }
  });

  it('every node can be reached from the start and the dialogue can always end', () => {
    for (const npc of TALKING_NPCS) {
      const t = NPC_TALK[npc]!;
      const seen = new Set<string>([t.start]);
      const queue = [t.start];
      let ends = false;
      while (queue.length) {
        for (const c of t.nodes[queue.shift()!]!.chips) {
          if (RESERVED.has(c.next)) ends = true;
          else if (!seen.has(c.next)) {
            seen.add(c.next);
            queue.push(c.next);
          }
        }
      }
      expect(seen.size, npc).toBe(Object.keys(t.nodes).length);
      expect(ends).toBe(true);
    }
  });

  it('the Praia: Bento opens the rentals, Neide teaches the three beats and keeps the log, Jô sells snacks, buys fish and has hats', () => {
    const next = (npc: (typeof PRAIA_NPCS)[number]) => Object.values(NPC_TALK[npc]!.nodes).flatMap((n) => n.chips.map((c) => c.next));
    expect(next('bento')).toContain('rental');
    expect(next('neide')).toEqual(expect.arrayContaining(['como', 'caderneta']));
    expect(['como', 'como2', 'como3'].every((id) => NPC_TALK.neide!.nodes[id])).toBe(true);
    expect(next('jo')).toEqual(expect.arrayContaining(['snacks', 'sell', 'rack']));
    for (const npc of PRAIA_NPCS) {
      expect(isNpcId(npc)).toBe(true);
      for (const [id, node] of Object.entries(NPC_TALK[npc]!.nodes)) for (const c of node.chips) expect(RESERVED.has(c.next) || NPC_TALK[npc]!.nodes[c.next], `${npc}.${id} -> ${c.next}`).toBeTruthy();
      // nobody on the beach waves or says "oi" as a wave: the greeting is by the hour
      expect(NPC_TALK[npc]!.nodes[NPC_TALK[npc]!.start]!.line.pt).toMatch(/^\{saudacao\}/);
    }
  });

  it('Nanda can open the hat shop and Júlia the help menu', () => {
    const next = (npc: 'nanda' | 'julia') => Object.values(NPC_TALK[npc]!.nodes).flatMap((n) => n.chips.map((c) => c.next));
    expect(next('nanda')).toContain('shop');
    expect(next('julia')).toContain('help');
    expect(next('prof')).toContain('treino');
  });

  it('Seu Dito opens the pet shop on Adotar and on the Lojinha', () => {
    const next = Object.values(NPC_TALK.dito!.nodes).flatMap((n) => n.chips.map((c) => c.next));
    expect(next).toEqual(expect.arrayContaining(['adopt', 'petshop']));
  });

  it('lines are short (A1), informal, safe for the chat filter and never say “Give me”', () => {
    for (const npc of TALKING_NPCS) {
      for (const node of Object.values(NPC_TALK[npc]!.nodes)) {
        for (const l of [node.line, ...node.chips]) {
          const pt = fillTalk(l.pt, { name: 'Ana', pronoun: 'ela' });
          expect(pt.split(/\s+/).length, pt).toBeLessThanOrEqual(14);
          expect(classifyChat(pt).action, pt).toBe('allow');
          expect(pt).not.toMatch(/\{|\}/);
          expect(l.en).not.toMatch(/give me/i);
        }
      }
    }
  });

  it('the openers teach known cards (the greeting for the hour, Tudo bem) and fill the name', () => {
    expect(talkOpener('nanda', 'Ana', 600)).toBe('Bom dia, Ana! Tudo bem? Eu sou a Nanda.');
    expect(talkOpener('nanda', 'Ana', 15 * 60)).toBe('Boa tarde, Ana! Tudo bem? Eu sou a Nanda.');
    expect(cardsInText(talkOpener('nanda', 'Ana', 15 * 60)!)).toEqual(expect.arrayContaining(['lex.social.boa_tarde', 'lex.social.tudo_bem']));
    expect(talkOpener('carlos', 'Ana')).toBeNull();
  });

  it('every greeting follows the game hour: bom dia / boa tarde / boa noite at the edges, in lines and in the chips the player greets with', () => {
    const cases: [number, string, string][] = [
      [299, 'Boa noite', 'Good evening'],
      [300, 'Bom dia', 'Good morning'],
      [719, 'Bom dia', 'Good morning'],
      [720, 'Boa tarde', 'Good afternoon'],
      [1079, 'Boa tarde', 'Good afternoon'],
      [1080, 'Boa noite', 'Good evening'],
    ];
    for (const [minute, pt, en] of cases) {
      for (const npc of ['nanda', 'julia', 'graca'] as const) {
        const t = NPC_TALK[npc]!;
        const start = t.nodes[t.start]!;
        expect(fillTalk(start.line.pt, { name: 'Ana', minute }), `${npc} ${minute}`).toMatch(new RegExp(`^${pt}, Ana!`));
        expect(fillTalk(start.line.en, { name: 'Ana', minute })).toMatch(new RegExp(`^${en}, Ana!`));
        expect(fillTalk(start.chips[0]!.pt, { name: 'Ana', minute }), `chip ${npc}`).toMatch(new RegExp(`^${pt}, `));
      }
    }
    // no authored NPC line hard-codes a greeting any more
    for (const npc of TALKING_NPCS) for (const node of Object.values(NPC_TALK[npc]!.nodes)) for (const l of [node.line, ...node.chips]) expect(l.pt, l.pt).not.toMatch(/^(bom dia|boa tarde|boa noite)/i);
  });

  it('the NPC only uses your name from 2 hearts', () => {
    expect(fillTalk('Oi, {nome}! Tudo bem?', { name: 'Ana', hearts: 0 })).toBe('Oi! Tudo bem?');
    expect(fillTalk('Oi, {nome}! Tudo bem?', { name: 'Ana', hearts: 1 })).toBe('Oi! Tudo bem?');
    expect(fillTalk('Oi, {nome}! Tudo bem?', { name: 'Ana', hearts: 2 })).toBe('Oi, Ana! Tudo bem?');
    expect(fillTalk('{saudacao}, {nome}! Tudo bem?', { name: 'Ana', hearts: 0, minute: 13 * 60 })).toBe('Boa tarde! Tudo bem?');
    expect(fillTalk('{saudacao}, {nome}!', { name: '', hearts: 5 })).toBe('Bom dia!');
  });

  it('fillTalk uses obrigado / obrigada from the pronoun', () => {
    expect(fillTalk('Agora não, {obrigad}.', { pronoun: 'ela' })).toBe('Agora não, obrigada.');
    expect(fillTalk('Agora não, {obrigad}.', { pronoun: 'ele' })).toBe('Agora não, obrigado.');
    expect(fillTalk('Oi, {nome}!', { name: 'Zé' })).toBe('Oi, Zé!');
  });
});
