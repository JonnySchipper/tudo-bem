/**
 * Phase 0 chat safety — deterministic stand-in for the Jev classifier, driven by TB Safety v0.1.
 *
 * Stack (content/safety/phase0/README.md):
 *   1. client regex PII      (pii/regex-fixtures.json + engine pii_extra)
 *   2. stub Jev              (engine jev_rules; answers jev/public-chat-pack.json + jev/npc-reply-pack.json)
 *   3. EN+PT blocklists      (blocklists/en-pt-slurs.json + dating / substance overlays; allowlist consulted first)
 *   4. escalate queue        (server ModerationQueue)
 *
 * `content/safety/phase0` is the canonical pack, read verbatim. `content/safety/engine/engine.json` holds only
 * what the pack references without encoding (named conditions, variants, stub-Jev class rules, PII hardening).
 *
 * Actions: allow / warn / block / escalate only. Player chat is NEVER rewritten or masked
 * (CEO-LOCKS-2026-09-25 §3). The same function runs on the client (instant feedback) and the
 * server (authoritative). Swap for a real Jev gateway behind the server's `ChatSafetyService`.
 */
import allowPack from '../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';
import slursPack from '../../../content/safety/phase0/blocklists/en-pt-slurs.json';
import datingPack from '../../../content/safety/phase0/blocklists/dating-flirting.json';
import substancePack from '../../../content/safety/phase0/blocklists/prohibited-substance.json';
import piiPack from '../../../content/safety/phase0/pii/regex-fixtures.json';
import engineJson from '../../../content/safety/engine/engine.json';
import { CARDS } from './cards.js';
import { lexiconLang } from './gloss.js';

export type SafetyAction = 'allow' | 'warn' | 'block' | 'escalate';
type HitAction = Exclude<SafetyAction, 'allow'>;

export type SafetyLabel =
  | 'pii'
  | 'off_platform_contact'
  | 'slur'
  | 'profanity'
  | 'sexual'
  | 'dating'
  | 'prohibited_substance'
  | 'politics'
  | 'scam'
  | 'bullying'
  | 'self_harm'
  | 'spam';

type Bilingual = { pt: string; en: string };

export interface SafetyVerdict {
  action: SafetyAction;
  labels: SafetyLabel[];
  /** Rule ids that fired (for logs / fixture debugging). */
  rules: string[];
  /** Text to broadcast: the player's message verbatim for allow/warn; empty for block/escalate. */
  text: string;
  /** Friendly note shown to the sender (PT + EN gloss). Never echoes the matched term. */
  note?: Bilingual;
  /** 0 clean → 1 severe (public-chat-pack `toxicity`). */
  toxicity: number;
}

// ---------------------------------------------------------------- pack shapes

interface CanonEntry {
  term: string;
  lang?: string;
  severity: string;
  action: string;
  category: string;
  allow_if?: string;
  block_if?: string;
  allowlist_senses?: string[];
}

export interface PiiFixture {
  id: string;
  pattern: string;
  flags: string;
  category: string;
  action: string;
  examples_match: string[];
  examples_nomatch: string[];
  normalized?: boolean;
}

interface EngineRule {
  id: string;
  label: string;
  action: string;
  terms?: string[];
  when?: string;
  note?: Bilingual;
}

interface EngineConfig {
  category_labels: Record<string, string>;
  label_priority: string[];
  content_class_map: Record<string, string>;
  looks_like_real_name_or_phone: { categories: string[]; fixtures: string[] };
  toxicity: { by_label: Record<string, number>; action_factor: Record<string, number> };
  notes: Record<string, Bilingual>;
  conditions: Record<string, { patterns: string[]; examples_match: string[]; examples_nomatch: string[] }>;
  entry_extensions: Record<string, { variants?: string[]; extra_allow_if?: string[]; note?: Bilingual }>;
  extra_terms: { id: string; category: string; action: string; terms: string[] }[];
  jev_rules: EngineRule[];
  pii_hardening: Record<string, { pattern: string; flags: string }>;
  pii_extra: PiiFixture[];
  fixture_divergences: { pack: string; id: string; field: string; canonical: unknown; engine: unknown }[];
  lexicon: { en_extra: string[] };
}

export const SAFETY_ENGINE = engineJson as unknown as EngineConfig;
const E = SAFETY_ENGINE;

const CANON_BLOCKLISTS: [string, { entries: CanonEntry[] }][] = [
  ['slurs', slursPack as { entries: CanonEntry[] }],
  ['dating', datingPack as { entries: CanonEntry[] }],
  ['substance', substancePack as { entries: CanonEntry[] }],
];

// ---------------------------------------------------------------- normalization + matching

/** Lowercase, unify apostrophes, strip accents, undo light leetspeak, collapse 3+ repeated letters. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[013457@$]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' })[c] ?? c)
    .replace(/(.)\1{2,}/g, '$1');
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-token (or whole-phrase) match over normalized text; v0.1 `exact` and `word_boundary` both land here. */
function termRegex(normTerm: string): RegExp {
  const body = normTerm.split(/\s+/).map(esc).join('[\\s.,_-]+');
  return new RegExp(`(^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`, 'g');
}

type Span = [number, number];

function termSpans(res: RegExp[], s: string): Span[] {
  const out: Span[] = [];
  for (const re of res) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const start = m.index + m[1].length;
      out.push([start, start + m[2].length]);
    }
  }
  return out;
}

function patternSpans(res: RegExp[], s: string): Span[] {
  const out: Span[] = [];
  for (const re of res) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      out.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

const inside = (spans: Span[], [s, e]: Span) => spans.some(([a, b]) => a <= s && e <= b);

// ---------------------------------------------------------------- compile

function labelOf(category: string): SafetyLabel {
  const label = E.category_labels[category];
  if (!label) throw new Error(`safety: category "${category}" has no label in engine.json category_labels`);
  return label as SafetyLabel;
}

function hitAction(a: string, where: string): HitAction {
  if (a === 'warn' || a === 'block' || a === 'escalate') return a;
  throw new Error(`safety: ${where} has unsupported action "${a}" (allow / warn / block / escalate only)`);
}

/** Named conditions referenced by the canonical pack (block_if / allow_if / allowlist_senses). */
export const CONDITIONS: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(E.conditions).map(([name, c]) => [name, c.patterns.map((p) => new RegExp(p, 'g'))]),
);

function condition(name: string, where: string): string {
  if (!CONDITIONS[name]) throw new Error(`safety: ${where} references condition "${name}", which engine.json does not define`);
  return name;
}

interface TermRule {
  id: string;
  stage: 'jev' | 'blocklist';
  label: SafetyLabel;
  category: string;
  action: HitAction;
  res: RegExp[];
  allowIf: string[];
  blockIf?: string;
  when?: string;
  note?: Bilingual;
}

const seenTerms = new Set<string>();
function termRes(terms: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const t of terms) {
    const n = normalize(t);
    if (seenTerms.has(n)) continue;
    seenTerms.add(n);
    out.push(termRegex(n));
  }
  return out;
}

const BLOCKLIST_RULES: TermRule[] = [
  ...CANON_BLOCKLISTS.flatMap(([pack, { entries }]) =>
    entries.map((entry): TermRule => {
      const ext = E.entry_extensions[entry.term];
      const where = `${pack}.${entry.term}`;
      return {
        id: where,
        stage: 'blocklist',
        label: labelOf(entry.category),
        category: entry.category,
        action: hitAction(entry.action, where),
        res: termRes([entry.term, ...(ext?.variants ?? [])]),
        allowIf: [entry.allow_if, ...(entry.allowlist_senses ?? []), ...(ext?.extra_allow_if ?? [])]
          .filter((c): c is string => !!c)
          .map((c) => condition(c, where)),
        blockIf: entry.block_if ? condition(entry.block_if, where) : undefined,
        note: ext?.note,
      };
    }),
  ),
  ...E.extra_terms.map(
    (x): TermRule => ({
      id: `extra.${x.id}`,
      stage: 'blocklist',
      label: labelOf(x.category),
      category: x.category,
      action: hitAction(x.action, x.id),
      res: termRes(x.terms),
      allowIf: [],
    }),
  ),
].filter((r) => r.res.length);

const JEV_RULES: TermRule[] = E.jev_rules.map((r) => ({
  id: `jev.${r.id}`,
  stage: 'jev',
  label: r.label as SafetyLabel,
  category: r.label,
  action: hitAction(r.action, r.id),
  res: (r.terms ?? []).map((t) => termRegex(normalize(t))),
  allowIf: [],
  when: r.when ? condition(r.when, r.id) : undefined,
  note: r.note,
}));

/** Everyday Brazilian slang (+ the substance pack's explicitly allowed drinks) consulted before any term rule. */
const ALLOW_TERMS = [...allowPack.entries.map((e) => e.term), ...substancePack.explicitly_allowed.map((e) => e.term)].map(normalize);
export const ALLOWLIST = new Set(ALLOW_TERMS);
const ALLOW_RES = [...ALLOWLIST].map(termRegex);

interface CompiledPii {
  id: string;
  category: string;
  label: SafetyLabel;
  action: HitAction;
  re: RegExp;
  normalized: boolean;
}

function compilePii(p: PiiFixture): CompiledPii {
  const hard = E.pii_hardening[p.id];
  let pattern = hard?.pattern ?? p.pattern;
  let flags = (hard?.flags ?? p.flags).replace('g', '');
  // v0.1 patterns are PCRE-flavoured; JavaScript has no leading inline-flag group.
  if (pattern.startsWith('(?i)')) {
    pattern = pattern.slice(4);
    if (!flags.includes('i')) flags += 'i';
  }
  return { id: p.id, category: p.category, label: labelOf(p.category), action: hitAction(p.action, `pii.${p.id}`), re: new RegExp(pattern, flags), normalized: !!p.normalized };
}

export const CANON_PII = (piiPack.fixtures as PiiFixture[]).map(compilePii);
export const EXTRA_PII = E.pii_extra.map(compilePii);
const PII = [...CANON_PII, ...EXTRA_PII];

// ---------------------------------------------------------------- classify

const SEVERITY: Record<SafetyAction, number> = { allow: 0, warn: 1, block: 2, escalate: 3 };
const priority = (l: SafetyLabel) => E.label_priority.indexOf(l);

interface Hit {
  id: string;
  label: SafetyLabel;
  category: string;
  action: HitAction;
  note?: Bilingual;
}

function termRuleHit(rule: TermRule, norm: string, globalAllow: Span[]): Hit | null {
  let matched = false;
  if (rule.when) matched = patternSpans(CONDITIONS[rule.when], norm).length > 0;
  else {
    const allowed = [...globalAllow, ...rule.allowIf.flatMap((c) => patternSpans(CONDITIONS[c], norm))];
    matched = termSpans(rule.res, norm).some((span) => !inside(allowed, span));
  }
  if (!matched) return null;
  const upgraded = rule.blockIf && patternSpans(CONDITIONS[rule.blockIf], norm).length > 0;
  return { id: rule.id, label: rule.label, category: rule.category, action: upgraded ? 'block' : rule.action, note: rule.note };
}

function evaluate(raw: string): { verdict: SafetyVerdict; hits: Hit[] } {
  const text = raw.trim();
  if (!text) return { verdict: { action: 'block', labels: ['spam'], rules: ['empty'], text: '', toxicity: 0 }, hits: [] };

  const norm = normalize(text);
  const hits: Hit[] = [];
  for (const p of PII) {
    p.re.lastIndex = 0;
    if (p.re.test(p.normalized ? norm : text)) hits.push({ id: `pii.${p.id}`, label: p.label, category: p.category, action: p.action });
  }
  const globalAllow = termSpans(ALLOW_RES, norm);
  for (const rule of [...JEV_RULES, ...BLOCKLIST_RULES]) {
    const hit = termRuleHit(rule, norm, globalAllow);
    if (hit) hits.push(hit);
  }
  // Laughter (kkkkkkkk, hahaha, rsrsrs) is normal chat, not spam.
  if (/([^ksahr\s])\1{7,}/i.test(text) || (text.length > 24 && text === text.toUpperCase() && /[A-Z]{12,}/.test(text)))
    hits.push({ id: 'spam.shout', label: 'spam', category: 'spam', action: 'warn' });

  if (!hits.length) return { verdict: { action: 'allow', labels: [], rules: [], text, toxicity: 0 }, hits };
  hits.sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action] || priority(b.label) - priority(a.label));
  const top = hits[0];
  const toxicity = Math.max(...hits.map((h) => (E.toxicity.by_label[h.label] ?? 0) * (E.toxicity.action_factor[h.action] ?? 1)));
  const verdict: SafetyVerdict = {
    action: top.action,
    labels: [...new Set(hits.map((h) => h.label))],
    rules: hits.map((h) => h.id),
    text: top.action === 'warn' ? text : '',
    note: top.note ?? (top.action === 'escalate' && top.label !== 'self_harm' ? E.notes.escalate : (E.notes[top.label] ?? E.notes.block)),
    toxicity: Math.round(toxicity * 100) / 100,
  };
  return { verdict, hits };
}

export function classifyChat(raw: string): SafetyVerdict {
  return evaluate(raw).verdict;
}

// ---------------------------------------------------------------- language tokens

const strip = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const words = (s: string) => strip(s).match(/[a-z']+/g) ?? [];

const allCanonEntries = CANON_BLOCKLISTS.flatMap(([, p]) => p.entries);
const PT_FUNCTION = new Set(['na', 'no', 'de', 'da', 'do', 'com', 'sem', 'e', 'o', 'a', 'um', 'uma']);
const EN_FUNCTION = new Set(['and', 'with', 'the', 'a', 'an', 'of', 'or', 'little', 'soft']);

const FOOD_CARDS = CARDS.filter((c) => c.tags.includes('food') || c.tags.includes('drink'));
const FOOD_PT = new Set(FOOD_CARDS.flatMap((c) => words(c.form.replace(/-/g, ' '))).filter((w) => !PT_FUNCTION.has(w)));
const FOOD_EN = new Set(FOOD_CARDS.flatMap((c) => words(c.gloss_en.replace(/\(.*?\)/g, ''))).filter((w) => !EN_FUNCTION.has(w)));
const POLITENESS = CARDS.filter((c) => c.tags.includes('politeness')).map((c) => termRegex(normalize(c.form)));
const ALCOHOL = substancePack.entries.filter((e) => e.category === 'alcohol').map((e) => termRegex(normalize(e.term)));

const PT_TOKENS = new Set([
  ...allCanonEntries.filter((e) => e.lang === 'pt-BR').flatMap((e) => words(e.term)),
  ...ALLOW_TERMS.flatMap(words),
  ...FOOD_PT,
]);
const EN_TOKENS = new Set([...allCanonEntries.filter((e) => e.lang === 'en').flatMap((e) => words(e.term)), ...E.lexicon.en_extra.map(strip)]);

function tokenLang(w: string): 'pt' | 'en' | null {
  const lex = lexiconLang(w);
  const en = lex === 'en' || lex === 'both' || EN_TOKENS.has(w);
  const pt = lex === 'pt' || lex === 'both' || PT_TOKENS.has(w);
  return en && !pt ? 'en' : pt && !en ? 'pt' : null;
}

function langCounts(text: string) {
  let en = 0;
  let pt = 0;
  for (const w of words(text)) {
    const l = tokenLang(w);
    if (l === 'en') en++;
    else if (l === 'pt') pt++;
  }
  return { en, pt };
}

// ---------------------------------------------------------------- Jev typed questions (GDD §12.4)

/** public-chat-pack.json typed_questions.content_class choices. */
export type ContentClass = 'ok' | 'insult' | 'sexual' | 'pii' | 'scam' | 'slurs' | 'prohibited_substance' | 'dating' | 'off_platform_contact';

export interface JevPublicChatAnswers {
  content_class: ContentClass;
  contains_english_majority: boolean;
  looks_like_real_name_or_phone: boolean;
  toxicity: number;
  action: SafetyAction;
}

/** Stub Jev answering the public-chat question pack. */
export function jevPublicChat(text: string): JevPublicChatAnswers {
  const { verdict, hits } = evaluate(text);
  const topLabel = hits.filter((h) => h.action === verdict.action).sort((a, b) => priority(b.label) - priority(a.label))[0]?.label;
  const { en, pt } = langCounts(text);
  const looks = E.looks_like_real_name_or_phone;
  return {
    content_class: verdict.action === 'allow' || !topLabel ? 'ok' : (E.content_class_map[topLabel] as ContentClass),
    contains_english_majority: en > pt,
    looks_like_real_name_or_phone: hits.some((h) => looks.categories.includes(h.category) || looks.fixtures.some((id) => h.id === `pii.${id}`)),
    toxicity: verdict.toxicity,
    action: verdict.action,
  };
}

export interface JevNpcReplyAnswers {
  answers_the_npc_question: boolean;
  uses_target_lexeme: boolean;
  language: 'pt' | 'en' | 'mix' | 'gibberish';
  task_success: 0 | 1 | 2 | 3;
  constitution_ok: boolean;
}

/**
 * Stub Jev answering the NPC-reply question pack for a padaria prompt. Target lexemes are the food/drink
 * cards the prompt primes (all of them when it primes none) plus "por favor". Scene scoring onto chips stays
 * with the curriculum accept-list rules (`scoreTypedReply`); this is the safety + graded-act view.
 */
export function jevNpcReply(npcPrompt: string, reply: string): JevNpcReplyAnswers {
  const verdict = classifyChat(reply);
  const constitution_ok = verdict.action === 'allow' || verdict.action === 'warn';
  const replyWords = words(reply);
  const { en, pt } = langCounts(reply);
  const language = en && pt ? 'mix' : en ? 'en' : pt ? 'pt' : 'gibberish';
  const primed = words(npcPrompt).filter((w) => FOOD_PT.has(w));
  const targets = new Set(primed.length ? primed : FOOD_PT);
  const norm = normalize(reply);
  const uses_target_lexeme = replyWords.some((w) => targets.has(w)) || termSpans(POLITENESS, norm).length > 0;
  const answers_the_npc_question = replyWords.some((w) => FOOD_PT.has(w) || FOOD_EN.has(w)) || termSpans(ALCOHOL, norm).length > 0;
  let task_success: JevNpcReplyAnswers['task_success'] = 0;
  if (constitution_ok && answers_the_npc_question && language !== 'gibberish') task_success = language === 'pt' && uses_target_lexeme ? 3 : 2;
  return { answers_the_npc_question, uses_target_lexeme, language, task_success, constitution_ok };
}

/** Display names and room names: must be fully clean (no warn). */
export function validateName(raw: string, maxLen = 16): { ok: true; name: string } | { ok: false; reason: { pt: string; en: string } } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > maxLen)
    return { ok: false, reason: { pt: `O nome precisa ter de 2 a ${maxLen} letras.`, en: `Name must be 2–${maxLen} characters.` } };
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name))
    return { ok: false, reason: { pt: 'Use só letras, números e espaços.', en: 'Letters, numbers and spaces only.' } };
  if (/\d{4,}/.test(name)) return { ok: false, reason: { pt: 'Nada de números longos no nome.', en: 'No long numbers in names (could be personal info).' } };
  const v = classifyChat(name);
  if (v.action !== 'allow') return { ok: false, reason: { pt: 'Escolha outro nome, por favor.', en: 'Please choose a different name.' } };
  return { ok: true, name };
}
