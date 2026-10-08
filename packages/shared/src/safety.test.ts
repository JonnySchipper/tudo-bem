import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_PACKS, classifyChat, compilePii, deobfuscate, jevNpcReply, jevPublicChat, normalize, validateName, type PiiPatternJson, type RuleJson } from './safety.js';
import publicPack from '../../../content/safety/phase0/jev/public-chat-pack.json';
import npcPack from '../../../content/safety/phase0/jev/npc-reply-pack.json';
import piiPack from '../../../content/safety/phase0/pii/regex-fixtures.json';
import allowPack from '../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';
import substancePack from '../../../content/safety/phase0/blocklists/prohibited-substance.json';
import v01Public from '../../../content/safety/source-v0.1/jev/public-chat-pack.json';
import v01Npc from '../../../content/safety/source-v0.1/jev/npc-reply-pack.json';
import v01Pii from '../../../content/safety/source-v0.1/pii/regex-fixtures.json';
import v01Allow from '../../../content/safety/source-v0.1/blocklists/allowlist-pt-slang.json';
import v01Slurs from '../../../content/safety/source-v0.1/blocklists/en-pt-slurs.json';
import v01Dating from '../../../content/safety/source-v0.1/blocklists/dating-flirting.json';
import v01Substance from '../../../content/safety/source-v0.1/blocklists/prohibited-substance.json';

const SAFETY_DIR = join(__dirname, '../../../content/safety');
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const rel = (dir: string) => files(dir).map((f) => f.slice(dir.length + 1).split(sep).join('/')).sort();

type PublicFixture = { id?: string; text: string; action: string; content_class: string; label?: string; source: string; canon?: Record<string, unknown> } & Record<string, unknown>;
const PUBLIC = publicPack.fixtures as PublicFixture[];

describe('TB Safety v0.1 fold', () => {
  it('phase0 keeps the engineering ingest layout (v0.1 docs + converted packs + eng overlays)', () => {
    expect(rel(join(SAFETY_DIR, 'phase0'))).toEqual(
      [
        'CEO-LOCKS-2026-09-25.md',
        'README.md',
        'constitution.md',
        'ops/report-mute-kick-phase0.md',
        'under13/design-notes.md',
        'blocklists/allowlist-pt-slang.json',
        'blocklists/dating-flirting.json',
        'blocklists/en-pt-slurs.json',
        'blocklists/prohibited-substance.json',
        'blocklists/ethnic-tokens.json',
        'blocklists/politics-religion.json',
        'blocklists/scam-rmt.json',
        'blocklists/harassment-selfharm.json',
        'jev/model-pack.json',
        'jev/npc-reply-pack.json',
        'jev/public-chat-pack.json',
        'pii/regex-fixtures.json',
      ].sort(),
    );
    for (const f of [v01Public, v01Npc, v01Pii, v01Allow, v01Slurs, v01Dating, v01Substance]) expect(f.version).toBe('0.1');
  });

  it('every phase0 JSON is _meta.status safety-v0.1', () => {
    for (const f of files(join(SAFETY_DIR, 'phase0')).filter((f) => f.endsWith('.json'))) {
      expect(JSON.parse(readFileSync(f, 'utf8'))._meta?.status, f).toBe('safety-v0.1');
    }
  });

  it('has no engineering-draft or TODO(T&S) markers left', () => {
    for (const f of files(SAFETY_DIR)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/engineering-draft|TODO\(T&S/);
  });
});

describe('v0.1 → eng conversion is lossless (content/safety/source-v0.1)', () => {
  const rulesOf = (pack: string) => RULE_PACKS[pack].rules as RuleJson[];
  const holder = (pack: string, term: string) => rulesOf(pack).find((r) => r.terms?.includes(term));

  it.each([
    ['en-pt-slurs', v01Slurs],
    ['dating-flirting', v01Dating],
    ['prohibited-substance', v01Substance],
  ] as const)('%s: every v0.1 entry is carried over with its action', (pack, v01) => {
    for (const e of v01.entries) {
      // CEO-LOCKS §1: preto moved to the ethnic-tokens overlay with its color/food contexts.
      const rule = e.term === 'preto' ? holder('ethnic-tokens', 'preto') : holder(pack, e.term);
      expect(rule, `${pack}: ${e.term}`).toBeDefined();
      expect(rule!.action, `${pack}: ${e.term}`).toBe(e.action);
    }
  });

  it('allowlist keeps every v0.1 term; substance keeps rewrite hints and explicitly allowed drinks', () => {
    for (const e of v01Allow.entries) expect(allowPack.terms).toContain(e.term);
    expect(substancePack.rewrite_hints).toEqual(v01Substance.rewrite_hints);
    expect(substancePack.explicitly_allowed).toEqual(v01Substance.explicitly_allowed);
  });

  it('PII keeps every v0.1 fixture and example; any changed regex says why', () => {
    const eng = piiPack.patterns as (PiiPatternJson & { hardening?: string; canon_regex?: string })[];
    for (const f of v01Pii.fixtures) {
      const p = eng.find((x) => x.id === f.id);
      expect(p, f.id).toBeDefined();
      for (const s of f.examples_match) expect(p!.match, f.id).toContain(s);
      for (const s of f.examples_nomatch.filter((x) => !x.includes('—') && !x.includes("'"))) expect(p!.noMatch, f.id).toContain(s);
      if (p!.regex !== f.pattern.replace(/^\(\?i\)/, '')) {
        expect(p!.hardening, `${f.id} regex changed without a reason`).toBeTruthy();
        expect(p!.canon_regex).toBe(f.pattern);
      }
    }
  });

  it('public chat keeps every v0.1 example; divergences carry the canonical value', () => {
    for (const e of v01Public.examples) {
      const f = PUBLIC.find((x) => x.id === e.id);
      expect(f, e.id).toBeDefined();
      expect(f!.text).toBe(e.text);
      for (const [k, v] of Object.entries(e.labels)) {
        if (f!.canon && k in f!.canon) expect(f!.canon[k], `${e.id}.${k}`).toEqual(v);
        else expect(f![k], `${e.id}.${k}`).toEqual(v);
      }
    }
    expect(PUBLIC.filter((f) => f.canon).map((f) => f.id)).toEqual(['pc18']);
  });

  it('NPC reply keeps every v0.1 example and both question packs keep the v0.1 options', () => {
    for (const e of v01Npc.examples) expect(npcPack.jev_fixtures.find((x) => x.id === e.id)).toMatchObject({ npc_prompt: e.npc_prompt, text: e.player, ...e.labels });
    for (const [eng, v01] of [
      [publicPack.questions, v01Public.typed_questions],
      [npcPack.questions, v01Npc.typed_questions],
    ] as const)
      for (const q of v01) expect(eng.find((x) => x.id === q.id)).toMatchObject({ type: q.type, ...('choices' in q ? { options: q.choices } : {}) });
  });
});

describe('Jev stub vs jev/public-chat-pack.json fixtures', () => {
  const options = publicPack.questions.find((q) => q.id === 'content_class')!.options!;

  it.each(PUBLIC.map((f) => [f.source, f.id ?? '', f.text, f] as const))('%s %s: %s', (_s, _id, text, f) => {
    const a = jevPublicChat(text);
    const v = classifyChat(text);
    const why = JSON.stringify(v);
    expect(options).toContain(a.content_class);
    expect(a.action, why).toBe(f.action);
    expect(a.content_class, why).toBe(f.content_class);
    if (f.label) expect(v.labels[0], why).toBe(f.label);
    if (f.source === 'v0.1') {
      expect(a.contains_english_majority, 'contains_english_majority').toBe(f.contains_english_majority);
      expect(a.looks_like_real_name_or_phone, 'looks_like_real_name_or_phone').toBe(f.looks_like_real_name_or_phone);
      expect(Math.abs(a.toxicity - (f.toxicity as number)), `toxicity ${a.toxicity} vs ${f.toxicity}`).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('Jev stub vs jev/npc-reply-pack.json jev_fixtures', () => {
  it.each(npcPack.jev_fixtures.map((f) => [f.id, f.text, f] as const))('%s: %s', (_id, text, f) => {
    const { answers_the_npc_question, uses_target_lexeme, language, task_success, constitution_ok } = f;
    expect(jevNpcReply(f.npc_prompt, text)).toEqual({ answers_the_npc_question, uses_target_lexeme, language, task_success, constitution_ok });
  });

  it('Carlos prompt examples pass the constitution themselves', () => {
    for (const line of npcPack.npc_prompt_examples) expect(classifyChat(line.replace(/^Carlos:\s*/, '')).action, line).toBe('allow');
  });
});

describe('PII regex fixtures (pii/regex-fixtures.json)', () => {
  it.each((piiPack.patterns as PiiPatternJson[]).map((p) => [p.id, p] as const))('%s matches its examples and blocks through the full stack', (_id, p) => {
    const re = compilePii(p);
    const subject = (s: string) => (p.normalized ? normalize(s) : s);
    for (const s of p.match) {
      expect(re.test(subject(s)), `should match: ${s}`).toBe(true);
      expect(classifyChat(s).action, `should block: ${s}`).toBe('block');
    }
    for (const s of p.noMatch) expect(re.test(subject(s)), `should not match: ${s}`).toBe(false);
  });

  it('under-13 stricter rules stay design-only (Phase 0 is 18+)', () => {
    expect(piiPack.under13_stricter.status).toMatch(/design-only/);
    expect(classifyChat('eu gosto de @mentions no jogo').action).toBe('allow');
  });
});

describe('obfuscation (stub de-obfuscation, client + server)', () => {
  it('wildcards, spaced and dotted letters hit the same rules as the plain word', () => {
    for (const m of ['f*ck you', 'f#ck', 'sh!t', 'f u c k you', 'f.u.c.k off', 'vai se f*der', 'p o r r a', 'p.o.r.r.a', 'f.d.p', 'b*tch'])
      expect(classifyChat(m), m).toMatchObject({ action: 'block', labels: expect.arrayContaining(['profanity']) });
  });

  it('leaves ordinary text and short letter runs alone', () => {
    expect(deobfuscate(normalize('eu e a ana vamos pra praca'))).toBe(normalize('eu e a ana vamos pra praca'));
    for (const ok of ['a e i o u são as vogais', 'oi! tudo bem?', 'que?! sério?', 'nota 5*', 'c u later', 'o b r i g a d o']) expect(classifyChat(ok).action, ok).toBe('allow');
  });
});

describe('PT slang allowlist — false-block KPI', () => {
  it('never blocks, warns or escalates allowlisted slang and sentences', () => {
    const cases = [...allowPack.terms, ...allowPack.sentences, ...substancePack.explicitly_allowed.map((e) => e.term)];
    const falseBlocks = cases.filter((c) => classifyChat(c).action !== 'allow');
    const rate = falseBlocks.length / cases.length;
    expect(falseBlocks, `false-block rate ${(rate * 100).toFixed(1)}%`).toEqual([]);
  });
});

describe('CEO locks 2026-09-25', () => {
  it('§1 macaco / japa / portuga block; preto / preta escalate except color / food', () => {
    for (const m of ['seu macaco', 'ô japa', 'esse portuga']) expect(classifyChat(m).action, m).toBe('block');
    for (const ok of ['feijão preto', 'café preto', 'camiseta preta', 'gato preto', 'preto e branco', 'cabelo preto', 'vestido de preto']) expect(classifyChat(ok).action, ok).toBe('allow');
    for (const bad of ['oi preto', 'aquela preta', 'seu pretinho']) expect(classifyChat(bad)).toMatchObject({ action: 'escalate', labels: ['ethnic_review'] });
  });

  it('§2 cu is an exact whole word; gostoso / gostosa / pelada / bar warn, person-directed forms block', () => {
    expect(classifyChat('cu').action).toBe('block');
    expect(classifyChat('cuidado, custa caro').action).toBe('allow');
    for (const w of ['Essa coxinha tá gostosa!', 'bora jogar uma pelada?', 'vamos no bar depois?']) expect(classifyChat(w).action, w).toBe('warn');
    for (const b of ['você é gostosa', 'oi gostoso', 'manda foto pelada']) expect(classifyChat(b).action, b).toBe('block');
    expect(classifyChat('o Largo do Bar fica perto da praça').action).toBe('allow');
  });

  it('§3 rewrite_not_used — warn delivers verbatim, block / escalate deliver nothing', () => {
    for (const msg of ['Essa coxinha tá gostosa!', 'bora jogar uma pelada no parque?', 'vamos no bar depois?', 'te amo, galera!']) {
      const v = classifyChat(msg);
      expect(v.action).toBe('warn');
      expect(v.text).toBe(msg);
    }
    for (const msg of ['bora tomar uma cerveja', 'seu macaco', 'aquele preto ali', 'eu quero morrer']) expect(classifyChat(msg).text).toBe('');
    for (const f of PUBLIC) expect(jevPublicChat(f.text).action).not.toBe('rewrite_not_used');
  });

  it('alcohol and politics block (constitution)', () => {
    for (const m of ['bora tomar uma cerveja', 'wanna grab a beer?', 'vote no Bolsonaro', 'vote no candidato X 2026']) expect(classifyChat(m).action, m).toBe('block');
  });

  it('notes never echo the matched term', () => {
    for (const [msg, term] of [['seu macaco', 'macaco'], ['cu', 'cu'], ['bora tomar uma cerveja', 'cerveja'], ['aquele preto ali', 'preto'], ['shut up bitch', 'bitch'], ['vamos no bar depois?', 'bar']]) {
      const { note } = classifyChat(msg);
      expect(note, msg).toBeDefined();
      expect(normalize(`${note!.pt} ${note!.en}`), msg).not.toMatch(new RegExp(`\\b${term}\\b`));
    }
  });
});

describe('general', () => {
  it('validates display names', () => {
    expect(validateName('Jonny').ok).toBe(true);
    expect(validateName('Maria Clara').ok).toBe(true);
    expect(validateName('a').ok).toBe(false);
    expect(validateName('ana12345').ok).toBe(false);
    expect(validateName('fuck').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
  });
});
