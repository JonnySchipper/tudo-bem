/**
 * Phase 0 chat safety — deterministic stand-in for the Jev classifier, driven by TB Safety v0.1.
 *
 * Stack (content/safety/phase0/README.md):
 *   1. client regex PII      (pii/regex-fixtures.json)
 *   2. stub Jev              (politics-religion / scam-rmt / harassment-selfharm overlays; answers
 *                             jev/public-chat-pack.json + jev/npc-reply-pack.json typed questions)
 *   3. EN+PT blocklists      (en-pt-slurs, ethnic-tokens, dating-flirting, prohibited-substance; allowlist consulted first)
 *   4. escalate queue        (server ModerationQueue)
 *
 * The phase0 JSON is the v0.1 pack converted to the engineering ingest shape (`rules` / `terms` /
 * `patterns`); the verbatim v0.1 snapshot lives in content/safety/source-v0.1 and CI checks the conversion.
 *
 * Actions: allow / warn / block / escalate only. Player chat is NEVER rewritten or masked
 * (CEO-LOCKS-2026-09-25 §3, rewrite_not_used). The same function runs on the client (instant feedback)
 * and the server (authoritative). Swap for a real Jev gateway behind the server's `ChatSafetyService`.
 */
import allowPack from '../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';
import slursPack from '../../../content/safety/phase0/blocklists/en-pt-slurs.json';
import ethnicPack from '../../../content/safety/phase0/blocklists/ethnic-tokens.json';
import datingPack from '../../../content/safety/phase0/blocklists/dating-flirting.json';
import substancePack from '../../../content/safety/phase0/blocklists/prohibited-substance.json';
import politicsPack from '../../../content/safety/phase0/blocklists/politics-religion.json';
import scamPack from '../../../content/safety/phase0/blocklists/scam-rmt.json';
import harassPack from '../../../content/safety/phase0/blocklists/harassment-selfharm.json';
import piiPack from '../../../content/safety/phase0/pii/regex-fixtures.json';
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
  | 'ethnic_review'
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

export interface RuleJson {
  id: string;
  label: string;
  action: string;
  terms?: string[];
  patterns?: string[];
  allowContexts?: string[];
  note?: Bilingual;
}

export interface PiiPatternJson {
  id: string;
  label: string;
  category: string;
  regex: string;
  flags: string;
  normalized?: boolean;
  match: string[];
  noMatch: string[];
}

interface CompiledRule {
  id: string;
  label: SafetyLabel;
  action: HitAction;
  terms: RegExp[];
  patterns: RegExp[];
  allow: RegExp[];
  note?: Bilingual;
}

const LABELS: SafetyLabel[] = ['pii', 'off_platform_contact', 'slur', 'profanity', 'sexual', 'dating', 'prohibited_substance', 'politics', 'scam', 'bullying', 'self_harm', 'ethnic_review', 'spam'];

function asLabel(l: string, where: string): SafetyLabel {
  if ((LABELS as string[]).includes(l)) return l as SafetyLabel;
  throw new Error(`safety: ${where} has unknown label "${l}"`);
}

function asAction(a: string, where: string): HitAction {
  if (a === 'warn' || a === 'block' || a === 'escalate') return a;
  throw new Error(`safety: ${where} has unsupported action "${a}" (allow / warn / block / escalate only)`);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-token (or whole-phrase) match over normalized text; v0.1 `exact` and `word_boundary` both land here. */
function termRegex(term: string): RegExp {
  const body = normalize(term).split(/\s+/).map(esc).join('[\\s.,_-]+');
  return new RegExp(`(^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`, 'g');
}

/** Stub-Jev overlays first, then blocklists (stack order; the most severe action wins regardless). */
export const RULE_PACKS: Record<string, { rules: RuleJson[] }> = {
  'harassment-selfharm': harassPack,
  'politics-religion': politicsPack,
  'scam-rmt': scamPack,
  'en-pt-slurs': slursPack,
  'ethnic-tokens': ethnicPack,
  'dating-flirting': datingPack,
  'prohibited-substance': substancePack,
};

const RULES: CompiledRule[] = Object.entries(RULE_PACKS).flatMap(([pack, { rules }]) =>
  rules.map((r) => ({
    id: `${pack}.${r.id}`,
    label: asLabel(r.label, `${pack}.${r.id}`),
    action: asAction(r.action, `${pack}.${r.id}`),
    terms: (r.terms ?? []).map(termRegex),
    patterns: (r.patterns ?? []).map((p) => new RegExp(p, 'g')),
    allow: (r.allowContexts ?? []).map((p) => new RegExp(p, 'g')),
    note: r.note,
  })),
);

/** Everyday Brazilian slang (+ the substance pack's explicitly allowed drinks), consulted before any term rule. */
const ALLOW_TERMS = [...allowPack.terms, ...substancePack.explicitly_allowed.map((e) => e.term)];
export const ALLOWLIST = new Set(ALLOW_TERMS.map(normalize));
const ALLOW_RES = [...ALLOWLIST].map(termRegex);

interface CompiledPii {
  id: string;
  label: SafetyLabel;
  category: string;
  re: RegExp;
  normalized: boolean;
}

export function compilePii(p: PiiPatternJson): RegExp {
  return new RegExp(p.regex, p.flags.replace('g', ''));
}

const PII: CompiledPii[] = (piiPack.patterns as PiiPatternJson[]).map((p) => ({
  id: p.id,
  label: asLabel(p.label, `pii.${p.id}`),
  category: p.category,
  re: compilePii(p),
  normalized: !!p.normalized,
}));

const NOTES: Record<SafetyLabel, Bilingual> = {
  pii: { pt: 'Opa! Nada de dados pessoais aqui, tá?', en: 'Oops! No personal info here (phone, email, address, school, links).' },
  off_platform_contact: { pt: 'Vamos conversar aqui mesmo na praça!', en: 'Let’s keep chatting here in the world — no outside apps or contacts.' },
  slur: { pt: 'Essa mensagem não pode ser enviada.', en: 'That message can’t be sent.' },
  profanity: { pt: 'Sem palavrão, por favor!', en: 'No swearing, please!' },
  sexual: { pt: 'Esse assunto não é pra praça.', en: 'That topic isn’t for this space.' },
  dating: { pt: 'Aqui é lugar de amizade — sem paquera!', en: 'This is a friendship space — no flirting or dating.' },
  prohibited_substance: { pt: 'Aqui a gente fica no suco e no guaraná!', en: 'We stick to juice and guaraná here — no alcohol or drugs.' },
  politics: { pt: 'Sem política nem briga de religião na praça, tá?', en: 'No politics or religious arguments in the square, okay?' },
  scam: { pt: 'Cuidado! Nunca compartilhe senhas ou dinheiro.', en: 'Careful! Never share passwords or money.' },
  bullying: { pt: 'Vamos ser gentis uns com os outros!', en: 'Let’s be kind to each other!' },
  self_harm: { pt: 'Você é importante. Fale com alguém de confiança.', en: 'You matter. Please reach out to someone you trust or a local helpline. A moderator has been notified.' },
  ethnic_review: { pt: 'Sua mensagem foi para a revisão da moderação.', en: 'Your message was sent to moderator review.' },
  spam: { pt: 'Calma! Uma mensagem de cada vez.', en: 'Easy! One message at a time.' },
};
const ESCALATE_NOTE: Bilingual = { pt: 'Sua mensagem foi para a revisão da moderação.', en: 'Your message was sent to moderator review.' };

const SEVERITY: Record<SafetyAction, number> = { allow: 0, warn: 1, block: 2, escalate: 3 };
/** Among hits with the most severe action, the later label wins (pc08 phone + WhatsApp = pii; pc10 vendo conta + pix = scam). */
const LABEL_ORDER: SafetyLabel[] = ['spam', 'bullying', 'prohibited_substance', 'politics', 'off_platform_contact', 'dating', 'profanity', 'scam', 'pii', 'sexual', 'slur', 'ethnic_review', 'self_harm'];
const priority = (l: SafetyLabel) => LABEL_ORDER.indexOf(l);

/** Per-label medians of the v0.1 public-chat-pack toxicity labels. */
const TOXICITY: Record<SafetyLabel, number> = {
  spam: 0.2,
  bullying: 0.55,
  prohibited_substance: 0.3,
  politics: 0.4,
  off_platform_contact: 0.35,
  dating: 0.55,
  profanity: 0.85,
  scam: 0.7,
  pii: 0.3,
  sexual: 0.95,
  slur: 0.95,
  ethnic_review: 0.95,
  self_harm: 0.9,
};
const ACTION_FACTOR: Record<HitAction, number> = { warn: 0.5, block: 1, escalate: 0.7 };

type Span = [number, number];

function spans(re: RegExp, s: string, group = false): Span[] {
  const out: Span[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = group ? m.index + m[1].length : m.index;
    out.push([start, start + (group ? m[2].length : m[0].length)]);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

const inside = (allowed: Span[], [s, e]: Span) => allowed.some(([a, b]) => a <= s && e <= b);

interface Hit {
  id: string;
  label: SafetyLabel;
  category: string;
  action: HitAction;
  note?: Bilingual;
}

function ruleHits(norm: string): Hit[] {
  const globalAllow = ALLOW_RES.flatMap((re) => spans(re, norm, true));
  const hits: Hit[] = [];
  for (const rule of RULES) {
    const allowed = [...globalAllow, ...rule.allow.flatMap((re) => spans(re, norm))];
    const matched = rule.terms.some((re) => spans(re, norm, true).some((span) => !inside(allowed, span))) || rule.patterns.some((re) => spans(re, norm).length > 0);
    if (matched) hits.push({ id: rule.id, label: rule.label, category: rule.label, action: rule.action, note: rule.note });
  }
  return hits;
}

function evaluate(raw: string): { verdict: SafetyVerdict; hits: Hit[] } {
  const text = raw.trim();
  if (!text) return { verdict: { action: 'block', labels: ['spam'], rules: ['empty'], text: '', toxicity: 0 }, hits: [] };

  const norm = normalize(text);
  const hits: Hit[] = [];
  for (const p of PII) {
    p.re.lastIndex = 0;
    if (p.re.test(p.normalized ? norm : text)) hits.push({ id: `pii.${p.id}`, label: p.label, category: p.category, action: 'block' });
  }
  hits.push(...ruleHits(norm));
  // Laughter (kkkkkkkk, hahaha, rsrsrs) is normal chat, not spam.
  if (/([^ksahr\s])\1{7,}/i.test(text) || (text.length > 24 && text === text.toUpperCase() && /[A-Z]{12,}/.test(text)))
    hits.push({ id: 'spam.shout', label: 'spam', category: 'spam', action: 'warn' });

  if (!hits.length) return { verdict: { action: 'allow', labels: [], rules: [], text, toxicity: 0 }, hits };
  hits.sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action] || priority(b.label) - priority(a.label));
  const top = hits[0];
  const toxicity = Math.max(...hits.map((h) => TOXICITY[h.label] * ACTION_FACTOR[h.action]));
  const verdict: SafetyVerdict = {
    action: top.action,
    labels: [...new Set(hits.map((h) => h.label))],
    rules: hits.map((h) => h.id),
    text: top.action === 'warn' ? text : '',
    note: top.note ?? (top.action === 'escalate' && top.label !== 'self_harm' ? ESCALATE_NOTE : NOTES[top.label]),
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

const PT_FUNCTION = new Set(['na', 'no', 'de', 'da', 'do', 'com', 'sem', 'e', 'o', 'a', 'um', 'uma']);
const EN_FUNCTION = new Set(['and', 'with', 'the', 'a', 'an', 'of', 'or', 'little', 'soft']);
/** Everyday English chat words the gloss phrasebook doesn't list. */
const EN_CHAT = ['shut', 'up', 'grab', 'wanna', 'gonna', 'gotta', 'add', 'on', 'get', 'say', 'bakery', 'portuguese', 'date', 'hot', 'crypto', 'bitcoin', 'everyone', 'guys', 'dude', 'whats', 'slur', 'word'];

const FOOD_CARDS = CARDS.filter((c) => c.tags.includes('food') || c.tags.includes('drink'));
const FOOD_PT = new Set(FOOD_CARDS.flatMap((c) => words(c.form.replace(/-/g, ' '))).filter((w) => !PT_FUNCTION.has(w)));
const FOOD_EN = new Set(FOOD_CARDS.flatMap((c) => words(c.gloss_en.replace(/\(.*?\)/g, ''))).filter((w) => !EN_FUNCTION.has(w)));
const POLITENESS = CARDS.filter((c) => c.tags.includes('politeness')).map((c) => termRegex(c.form));
const ALCOHOL = substancePack.rules.filter((r) => r.id === 'alcohol').flatMap((r) => r.terms ?? []).map(termRegex);

const termLang = Object.entries({ ...slursPack.term_lang, ...datingPack.term_lang, ...substancePack.term_lang } as Record<string, string>);
const PT_TOKENS = new Set([...termLang.filter(([, l]) => l !== 'en').flatMap(([t]) => words(t)), ...ALLOW_TERMS.flatMap(words), ...FOOD_PT]);
const EN_TOKENS = new Set([...termLang.filter(([, l]) => l !== 'pt-BR').flatMap(([t]) => words(t)), ...EN_CHAT]);

function langCounts(text: string) {
  let en = 0;
  let pt = 0;
  for (const w of words(text)) {
    const lex = lexiconLang(w);
    const isEn = lex === 'en' || lex === 'both' || EN_TOKENS.has(w);
    const isPt = lex === 'pt' || lex === 'both' || PT_TOKENS.has(w);
    if (isEn && !isPt) en++;
    else if (isPt && !isEn) pt++;
  }
  return { en, pt };
}

// ---------------------------------------------------------------- Jev typed questions (GDD §12.4)

/** public-chat-pack.json `content_class` options (v0.1). */
export type ContentClass = 'ok' | 'insult' | 'sexual' | 'pii' | 'scam' | 'slurs' | 'prohibited_substance' | 'dating' | 'off_platform_contact';

/** v0.1 has no politics / self-harm class; both answer "insult" as pc18 does. The precise label stays in `labels`. */
const LABEL_TO_CLASS: Record<SafetyLabel, ContentClass> = {
  pii: 'pii',
  off_platform_contact: 'off_platform_contact',
  slur: 'slurs',
  ethnic_review: 'slurs',
  profanity: 'insult',
  bullying: 'insult',
  politics: 'insult',
  self_harm: 'insult',
  sexual: 'sexual',
  dating: 'dating',
  prohibited_substance: 'prohibited_substance',
  scam: 'scam',
  spam: 'ok',
};

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
  return {
    content_class: verdict.action === 'allow' || !topLabel ? 'ok' : LABEL_TO_CLASS[topLabel],
    contains_english_majority: en > pt,
    looks_like_real_name_or_phone: hits.some((h) => h.category === 'phone' || h.category === 'real_name' || h.id === 'pii.cep_br'),
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
  const uses_target_lexeme = replyWords.some((w) => targets.has(w)) || POLITENESS.some((re) => spans(re, norm).length > 0);
  const answers_the_npc_question = replyWords.some((w) => FOOD_PT.has(w) || FOOD_EN.has(w)) || ALCOHOL.some((re) => spans(re, norm).length > 0);
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
