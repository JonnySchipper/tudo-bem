import { describe, expect, it } from 'vitest';
import { NPC_TALK, TALKING_NPCS, fillTalk, talkOpener } from './npcTalk.js';
import { classifyChat } from './safety.js';
import { cardsInText } from './caderno.js';
import { isNpcId } from './bonds.js';

const RESERVED = new Set(['end', 'help', 'shop']);

describe('NPC greeting dialogues (Nanda, Júlia, Dona Graça, Professora Bia)', () => {
  it('exist for Nanda and Júlia, three lines with two reply chips each', () => {
    expect(TALKING_NPCS.sort()).toEqual(['graca', 'julia', 'nanda', 'prof']);
    for (const npc of TALKING_NPCS) {
      const t = NPC_TALK[npc]!;
      expect(isNpcId(npc)).toBe(true);
      expect(Object.keys(t.nodes)).toHaveLength(3);
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
          if (c.next === 'end' || c.next === 'help' || c.next === 'shop') ends = true;
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

  it('Nanda can open the hat shop and Júlia the help menu', () => {
    const next = (npc: 'nanda' | 'julia') => Object.values(NPC_TALK[npc]!.nodes).flatMap((n) => n.chips.map((c) => c.next));
    expect(next('nanda')).toContain('shop');
    expect(next('julia')).toContain('help');
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

  it('the openers teach known cards (Oi, Tudo bem) and fill the name', () => {
    expect(talkOpener('nanda', 'Ana')).toBe('Oi, Ana! Tudo bem? Eu sou a Nanda.');
    expect(cardsInText(talkOpener('nanda', 'Ana')!)).toEqual(expect.arrayContaining(['lex.social.oi', 'lex.social.tudo_bem']));
    expect(talkOpener('carlos', 'Ana')).toBeNull();
  });

  it('fillTalk uses obrigado / obrigada from the pronoun', () => {
    expect(fillTalk('Agora não, {obrigad}.', { pronoun: 'ela' })).toBe('Agora não, obrigada.');
    expect(fillTalk('Agora não, {obrigad}.', { pronoun: 'ele' })).toBe('Agora não, obrigado.');
    expect(fillTalk('Oi, {nome}!', { name: 'Zé' })).toBe('Oi, Zé!');
  });
});
