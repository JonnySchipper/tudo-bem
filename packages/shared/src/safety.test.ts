import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANON_PII, CONDITIONS, EXTRA_PII, SAFETY_ENGINE, classifyChat, jevNpcReply, jevPublicChat, normalize, validateName, type PiiFixture } from './safety.js';
import publicPack from '../../../content/safety/phase0/jev/public-chat-pack.json';
import npcPack from '../../../content/safety/phase0/jev/npc-reply-pack.json';
import piiPack from '../../../content/safety/phase0/pii/regex-fixtures.json';
import allowPack from '../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';
import slursPack from '../../../content/safety/phase0/blocklists/en-pt-slurs.json';
import datingPack from '../../../content/safety/phase0/blocklists/dating-flirting.json';
import substancePack from '../../../content/safety/phase0/blocklists/prohibited-substance.json';
import regression from '../../../content/safety/engine/regression-fixtures.json';

const SAFETY_DIR = join(__dirname, '../../../content/safety');
const divergence = (pack: string, id: string, field: string) =>
  SAFETY_ENGINE.fixture_divergences.find((d) => d.pack === pack && d.id === id && d.field === field);

/** Engine value for a canonical label: the canonical one unless engine.json lists a divergence. */
function expected<T>(pack: string, id: string, field: string, canonical: T): T {
  const d = divergence(pack, id, field);
  if (!d) return canonical;
  expect(d.canonical, `${id}.${field} divergence is stale`).toEqual(canonical);
  return d.engine as T;
}

describe('TB Safety v0.1 pack is folded in', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

  it('ships the documented phase0 layout and nothing else', () => {
    const rel = files(join(SAFETY_DIR, 'phase0')).map((f) => f.slice(join(SAFETY_DIR, 'phase0').length + 1)).sort();
    expect(rel).toEqual(
      [
        'CEO-LOCKS-2026-09-25.md',
        'README.md',
        'blocklists/allowlist-pt-slang.json',
        'blocklists/dating-flirting.json',
        'blocklists/en-pt-slurs.json',
        'blocklists/prohibited-substance.json',
        'constitution.md',
        'jev/npc-reply-pack.json',
        'jev/public-chat-pack.json',
        'ops/report-mute-kick-phase0.md',
        'pii/regex-fixtures.json',
        'under13/design-notes.md',
      ].sort(),
    );
    for (const pack of [publicPack, npcPack, piiPack, allowPack, slursPack, datingPack, substancePack]) expect(pack.version).toBe('0.1');
  });

  it('has no engineering-draft or TODO(T&S) stubs left', () => {
    for (const f of files(SAFETY_DIR)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/engineering-draft|TODO\(T&S/);
  });

  it('defines every condition the canonical pack references, with passing examples', () => {
    const referenced = [slursPack, datingPack, substancePack].flatMap((p) =>
      (p.entries as { block_if?: string; allow_if?: string; allowlist_senses?: string[] }[]).flatMap((e) => [e.block_if, e.allow_if, ...(e.allowlist_senses ?? [])]),
    );
    for (const name of referenced.filter(Boolean) as string[]) expect(CONDITIONS[name], name).toBeDefined();
    for (const [name, c] of Object.entries(SAFETY_ENGINE.conditions)) {
      const hits = (s: string) => CONDITIONS[name].some((re) => ((re.lastIndex = 0), re.test(normalize(s))));
      for (const s of c.examples_match) expect(hits(s), `${name} should match: ${s}`).toBe(true);
      for (const s of c.examples_nomatch) expect(hits(s), `${name} should not match: ${s}`).toBe(false);
    }
  });

  it('only diverges from canonical labels where engine.json says why', () => {
    for (const d of SAFETY_ENGINE.fixture_divergences) {
      expect(d.pack).toBe('jev/public-chat-pack.json');
      const ex = publicPack.examples.find((e) => e.id === d.id);
      expect(ex, d.id).toBeDefined();
      expect((ex!.labels as Record<string, unknown>)[d.field]).toEqual(d.canonical);
    }
  });
});

describe('Jev stub vs jev/public-chat-pack.json (v0.1 examples)', () => {
  const P = 'jev/public-chat-pack.json';
  const classes = publicPack.typed_questions.find((q) => q.id === 'content_class')!.choices!;

  it.each(publicPack.examples.map((e) => [e.id, e.text, e] as const))('%s: %s', (id, text, e) => {
    const a = jevPublicChat(text);
    const why = JSON.stringify(classifyChat(text));
    expect(classes).toContain(a.content_class);
    expect(a.action, why).toBe(expected(P, id, 'action', e.labels.action));
    expect(a.content_class, why).toBe(expected(P, id, 'content_class', e.labels.content_class));
    expect(a.contains_english_majority, 'contains_english_majority').toBe(expected(P, id, 'contains_english_majority', e.labels.contains_english_majority));
    expect(a.looks_like_real_name_or_phone, 'looks_like_real_name_or_phone').toBe(expected(P, id, 'looks_like_real_name_or_phone', e.labels.looks_like_real_name_or_phone));
    expect(Math.abs(a.toxicity - e.labels.toxicity), `toxicity ${a.toxicity} vs ${e.labels.toxicity}`).toBeLessThanOrEqual(0.15);
  });

  it('never answers rewrite_not_used (CEO-LOCKS §3)', () => {
    for (const e of publicPack.examples) expect(jevPublicChat(e.text).action).not.toBe('rewrite_not_used');
  });
});

describe('Jev stub vs jev/npc-reply-pack.json (v0.1 examples)', () => {
  it.each(npcPack.examples.map((e) => [e.id, e.player, e] as const))('%s: %s', (_id, player, e) => {
    expect(jevNpcReply(e.npc_prompt, player)).toEqual(e.labels);
  });

  it('Carlos prompt examples pass the constitution themselves', () => {
    for (const line of npcPack.npc_prompt_examples) expect(classifyChat(line.replace(/^Carlos:\s*/, '')).action, line).toBe('allow');
  });
});

describe('PII regex fixtures (pii/regex-fixtures.json + engine pii_extra)', () => {
  /** v0.1 examples_nomatch sometimes hold a reviewer note instead of a sample; test any 'quoted' sample, skip bare notes. */
  const nomatchSamples = (s: string): string[] => {
    const quoted = [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (quoted.length) return quoted;
    return s.includes('—') ? [] : [s];
  };
  const cases: [string, PiiFixture, RegExp][] = [
    ...(piiPack.fixtures as PiiFixture[]).map((f, i) => [`v0.1 ${f.id}`, f, CANON_PII[i].re] as [string, PiiFixture, RegExp]),
    ...SAFETY_ENGINE.pii_extra.map((f, i) => [`engine ${f.id}`, f, EXTRA_PII[i].re] as [string, PiiFixture, RegExp]),
  ];

  it.each(cases)('%s matches its examples and blocks through the full stack', (_n, f, re) => {
    const subject = (s: string) => (f.normalized ? normalize(s) : s);
    for (const s of f.examples_match) {
      expect(re.test(subject(s)), `should match: ${s}`).toBe(true);
      expect(classifyChat(s).action, `should block: ${s}`).toBe('block');
    }
    for (const s of f.examples_nomatch.flatMap(nomatchSamples)) expect(re.test(subject(s)), `should not match: ${s}`).toBe(false);
  });

  it('hardening only overrides fixtures that exist in v0.1', () => {
    const ids = (piiPack.fixtures as PiiFixture[]).map((x) => x.id);
    for (const id of Object.keys(SAFETY_ENGINE.pii_hardening)) expect(ids, id).toContain(id);
  });

  it('under-13 stricter rules stay design-only (Phase 0 is 18+)', () => {
    expect(JSON.stringify(SAFETY_ENGINE)).not.toMatch(/under13/);
    expect(classifyChat('I like discord the game concept').action).toBe('block');
    expect(classifyChat('eu gosto de @mentions no jogo').action).toBe('allow');
  });
});

describe('PT slang allowlist — false-block KPI', () => {
  it('never blocks, warns or escalates allowlisted slang', () => {
    const cases = allowPack.entries.map((e) => e.term);
    const falseBlocks = cases.filter((c) => classifyChat(c).action !== 'allow');
    const rate = falseBlocks.length / cases.length;
    expect(falseBlocks, `false-block rate ${(rate * 100).toFixed(1)}%`).toEqual([]);
  });

  it('never flags the explicitly allowed drinks and rewrite targets', () => {
    for (const e of substancePack.explicitly_allowed) expect(classifyChat(e.term).action, e.term).toBe('allow');
  });
});

describe('engine regression fixtures (content/safety/engine/regression-fixtures.json)', () => {
  it.each(regression.cases.map((c) => [c.text, c] as const))('%s', (text, c) => {
    const v = classifyChat(text);
    expect(v.action, JSON.stringify(v)).toBe(c.action);
    if ('label' in c) expect(v.labels[0], JSON.stringify(v)).toBe(c.label);
  });
});

describe('CEO locks 2026-09-25', () => {
  it('§3 never rewrites player chat — warn delivers verbatim', () => {
    for (const msg of ['Essa coxinha tá gostosa!', 'bora jogar uma pelada no parque?', 'vamos no bar depois?', 'te amo, galera!']) {
      const v = classifyChat(msg);
      expect(v.action).toBe('warn');
      expect(v.text).toBe(msg);
    }
  });

  it('§3 block and escalate never deliver any text', () => {
    for (const msg of ['bora tomar uma cerveja', 'seu macaco', 'aquele preto ali', 'eu quero morrer']) expect(classifyChat(msg).text).toBe('');
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
