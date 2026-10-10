import { describe, expect, it } from 'vitest';
import { localizeGreeting, localizeGreetingText, greetingFor } from './clock.js';
import { chooseChip, scoreTypedReply, viewNode, type SceneCtx } from './carlos.js';
import { papoById } from './papos.js';
import { fillTalk } from './npcTalk.js';
import { makeOrder, mulberry32 } from './meveum.js';
import { VENDORS } from './feira.js';

const at = (h: number, m = 0) => h * 60 + m;
const ctx = (minute: number): SceneCtx => ({ name: 'Ana', pronoun: 'ela', minute });

describe('greetings follow the game hour', () => {
  it('swaps only a leading greeting, keeps case, PT and EN independently', () => {
    expect(localizeGreetingText('Bom dia! Tudo bem?', at(17, 30))).toBe('Boa tarde! Tudo bem?');
    expect(localizeGreetingText('Boa noite, Seu Carlos!', at(9))).toBe('Bom dia, Seu Carlos!');
    expect(localizeGreetingText('bom dia', at(20))).toBe('boa noite');
    expect(localizeGreetingText('Good morning! How is it?', at(13), 'en')).toBe('Good afternoon! How is it?');
    expect(localizeGreetingText('“Bom dia!” disse ele', at(13))).toBe('“Boa tarde!” disse ele');
    // not at the start: untouched
    expect(localizeGreetingText('Oi! Bom dia!', at(13))).toBe('Oi! Bom dia!');
    expect(localizeGreetingText('Uma coxinha, por favor.', at(13))).toBe('Uma coxinha, por favor.');
    expect(localizeGreeting({ pt: 'Bom dia! Me vê um pão.', en: 'Good morning! I’ll take a bread.' }, at(19))).toEqual({ pt: 'Boa noite! Me vê um pão.', en: 'Good evening! I’ll take a bread.' });
  });

  it('the Carlos scene opener says the greeting of the hour (17:30 is boa tarde)', () => {
    expect(viewNode('inicio', ctx(at(9)))!.line.pt).toBe('Bom dia! Tudo bem?');
    expect(viewNode('inicio', ctx(at(17, 30)))!.line.pt).toBe('Boa tarde! Tudo bem?');
    expect(viewNode('inicio', ctx(at(17, 30)))!.line.en).toBe('Good afternoon! How’s it going?');
    expect(viewNode('inicio', ctx(at(23)))!.line.pt).toBe('Boa noite! Tudo bem?');
    expect(viewNode('inicio_devagar', ctx(at(14)))!.line.pt).toContain('Boa… tarde!');
  });

  it('the chips the player greets with match the hour', () => {
    for (const [minute, pt] of [[at(8), 'Bom dia!'], [at(15), 'Boa tarde!'], [at(21), 'Boa noite!']] as const) {
      expect(viewNode('inicio', ctx(minute))!.chips.map((c) => c.pt)).toContain(pt);
      expect(chooseChip('inicio', 1, ctx(minute))!.said.pt).toBe(pt);
    }
    expect(viewNode('inicio_devagar', ctx(at(15)))!.chips[0]!.pt).toBe('Boa tarde! Tudo bem!');
  });

  it('typed answers accept all three greetings at any hour (the exact-hour check is the recado `timeCorrect`)', () => {
    for (const minute of [at(8), at(15), at(21)]) {
      for (const text of ['Bom dia, Seu Carlos!', 'Boa tarde, Seu Carlos!', 'Boa noite, Seu Carlos!', 'bom dia', 'boa tarde', 'boa noite']) {
        const r = scoreTypedReply('inicio', text, ctx(minute));
        expect(r.chip, `${text} @ ${minute}`).toBe(1);
        expect(r.task_success, `${text} @ ${minute}`).toBe(3);
      }
    }
  });

  it('a bate-papo greets by the hour', () => {
    const line = papoById('carlos.cedo')!.nodes.oi!.line;
    expect(fillTalk(line.pt, { name: 'Ana', minute: at(17, 30) })).toMatch(/^Boa tarde, Ana!/);
    expect(fillTalk(line.en, { name: 'Ana', minute: at(9) })).toMatch(/^Good morning, Ana!/);
  });

  it('Me vê um customers greet by the hour without changing the tray', () => {
    for (let seed = 1; seed < 40; seed++) {
      const morning = makeOrder(mulberry32(seed), 5, undefined, at(9));
      const evening = makeOrder(mulberry32(seed), 5, undefined, at(20));
      expect(evening.lines).toEqual(morning.lines);
      expect(evening.pt.replace(/^Boa noite/, 'Bom dia')).toBe(morning.pt);
      expect(evening.pt).not.toMatch(/^Bom dia/);
    }
  });

  it('the feira vendors greet by the hour too (Bom dia at 17:30 is wrong)', () => {
    for (const id of ['tia_lu', 'ze', 'chico', 'rosa'] as const) {
      const g = VENDORS[id].greet;
      if (!/^Bom dia/.test(g.pt)) continue;
      expect(localizeGreeting(g, at(17, 30)).pt).toMatch(/^Boa tarde/);
      expect(localizeGreeting(g, at(17, 30)).en).toMatch(/^Good afternoon/);
      expect(localizeGreeting(g, at(7)).pt).toBe(g.pt);
    }
  });

  it('greetingFor edges used by all of the above', () => {
    expect(greetingFor(at(11, 59))).toBe('bom dia');
    expect(greetingFor(at(12))).toBe('boa tarde');
    expect(greetingFor(at(18))).toBe('boa noite');
  });
});
