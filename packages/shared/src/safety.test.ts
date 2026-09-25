import { describe, expect, it } from 'vitest';
import { classifyChat, jevPublicChat, normalize, validateName } from './safety.js';
import publicPack from '../../../content/safety/phase0/jev/public-chat-pack.json';
import piiPack from '../../../content/safety/phase0/pii/regex-fixtures.json';
import allowPack from '../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';

describe('Jev stub vs content/safety/phase0/jev/public-chat-pack.json', () => {
  it.each(publicPack.fixtures.map((f) => [f.text, f] as const))('%s', (text, f) => {
    const a = jevPublicChat(text);
    expect(a.action, JSON.stringify(classifyChat(text))).toBe(f.action);
    expect(a.content_class).toBe(f.content_class);
    if ('contains_english_majority' in f) expect(a.contains_english_majority).toBe(f.contains_english_majority);
    if ('looks_like_real_name_or_phone' in f) expect(a.looks_like_real_name_or_phone).toBe(f.looks_like_real_name_or_phone);
  });
});

describe('PII regex fixtures (content/safety/phase0/pii/regex-fixtures.json)', () => {
  for (const p of piiPack.patterns) {
    it(`${p.id} matches its examples`, () => {
      const re = new RegExp(p.regex, p.flags);
      const subject = (s: string) => ((p as { normalized?: boolean }).normalized ? normalize(s) : s);
      for (const s of p.match) expect(re.test(subject(s)), `should match: ${s}`).toBe(true);
      for (const s of p.noMatch) expect(re.test(subject(s)), `should not match: ${s}`).toBe(false);
    });
    it(`${p.id} blocks through the full stack`, () => {
      for (const s of p.match) expect(classifyChat(s).action).toBe('block');
    });
  }
});

describe('PT slang allowlist — false-block KPI', () => {
  it('never blocks, warns or escalates allowlisted slang and sentences', () => {
    const cases = [...allowPack.terms, ...allowPack.sentences];
    const falseBlocks = cases.filter((c) => classifyChat(c).action !== 'allow');
    const rate = falseBlocks.length / cases.length;
    expect(falseBlocks, `false-block rate ${(rate * 100).toFixed(1)}%`).toEqual([]);
  });
});

describe('CEO locks 2026-09-25', () => {
  it('§3 never rewrites player chat — warn delivers verbatim', () => {
    for (const msg of ['Essa coxinha tá gostosa!', 'bora jogar uma pelada no parque?', 'vamos no bar depois?', 'cala a boca, idiota']) {
      const v = classifyChat(msg);
      expect(v.action).toBe('warn');
      expect(v.text).toBe(msg);
    }
  });

  it('§3 block and escalate never deliver any text', () => {
    for (const msg of ['bora tomar uma cerveja', 'seu macaco', 'aquele preto ali', 'eu quero morrer']) expect(classifyChat(msg).text).toBe('');
  });

  it('§1 preto/preta is allowed only as color or food', () => {
    for (const ok of ['feijão preto', 'café preto', 'camiseta preta', 'cabelo preto', 'o quadro preto', 'tênis pretos', 'vestido de preto']) expect(classifyChat(ok).action, ok).toBe('allow');
    for (const bad of ['oi preto', 'aquela preta', 'seu pretinho']) expect(classifyChat(bad).action, bad).toBe('escalate');
  });

  it('§2 cu blocks exact word only', () => {
    expect(classifyChat('cu').action).toBe('block');
    expect(classifyChat('cuidado, custa caro').action).toBe('allow');
  });
});

describe('general', () => {
  it('laughter is not spam', () => {
    expect(classifyChat('kkkkkkkkkkkk').action).toBe('allow');
    expect(classifyChat('hahahahahahaha').action).toBe('allow');
  });

  it('validates display names', () => {
    expect(validateName('Jonny').ok).toBe(true);
    expect(validateName('Maria Clara').ok).toBe(true);
    expect(validateName('a').ok).toBe(false);
    expect(validateName('ana12345').ok).toBe(false);
    expect(validateName('fuck').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
  });
});
