/**
 * Phase 0 chat safety — deterministic stand-in for the Jev classifier.
 *
 * Stack (content/safety/phase0/README.md):
 *   1. client regex PII      (pii/regex-fixtures.json)
 *   2. stub Jev              (jev/public-chat-pack.json — typed questions, see `jevPublicChat`)
 *   3. EN+PT blocklists      (blocklists/*.json; allowlist consulted first)
 *   4. escalate queue        (server ModerationQueue)
 *
 * Actions: allow / warn / block / escalate only. Player chat is NEVER rewritten or masked
 * (CEO-LOCKS-2026-09-25 §3). The same function runs on the client (instant feedback) and the
 * server (authoritative). Swap for a real Jev gateway behind the server's `ChatSafetyService`.
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
import { detectLang } from './gloss.js';

export type SafetyAction = 'allow' | 'warn' | 'block' | 'escalate';

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

export interface SafetyVerdict {
  action: SafetyAction;
  labels: SafetyLabel[];
  /** Rule ids that fired (for logs / fixture debugging). */
  rules: string[];
  /** Text to broadcast: the player's message verbatim for allow/warn; empty for block/escalate. */
  text: string;
  /** Friendly note shown to the sender (PT + EN gloss). */
  note?: { pt: string; en: string };
}

/** Lowercase, strip accents, undo light leetspeak, collapse 3+ repeated letters. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[013457@$]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' })[c] ?? c)
    .replace(/(.)\1{2,}/g, '$1');
}

interface RuleJson {
  id: string;
  label: string;
  action: string;
  terms?: string[];
  patterns?: string[];
  allowContexts?: string[];
  note?: { pt: string; en: string };
}

interface CompiledRule {
  id: string;
  label: SafetyLabel;
  action: Exclude<SafetyAction, 'allow'>;
  terms: { term: string; re: RegExp }[];
  patterns: RegExp[];
  allow: RegExp[];
  note?: { pt: string; en: string };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termRegex(term: string): RegExp {
  const body = term.split(' ').map(esc).join('[\\s.,_-]+');
  return new RegExp(`(^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`, 'g');
}

const RULE_PACKS = [harassPack, slursPack, ethnicPack, datingPack, substancePack, politicsPack, scamPack] as { rules: RuleJson[] }[];

const RULES: CompiledRule[] = RULE_PACKS.flatMap((pack) =>
  pack.rules.map((r) => ({
    id: r.id,
    label: r.label as SafetyLabel,
    action: r.action as CompiledRule['action'],
    terms: (r.terms ?? []).map((t) => {
      const term = normalize(t);
      return { term, re: termRegex(term) };
    }),
    patterns: (r.patterns ?? []).map((p) => new RegExp(p, 'g')),
    allow: (r.allowContexts ?? []).map((p) => new RegExp(p, 'g')),
    note: r.note,
  })),
);

/** Everyday Brazilian slang that must never trip a rule (false-block KPI). */
export const ALLOWLIST = new Set(allowPack.terms.map((t) => normalize(t)));

interface PiiPattern {
  id: string;
  label: SafetyLabel;
  re: RegExp;
  normalized: boolean;
}

const PII: PiiPattern[] = (piiPack.patterns as { id: string; label: string; regex: string; flags: string; normalized?: boolean }[]).map((p) => ({
  id: p.id,
  label: p.label as SafetyLabel,
  re: new RegExp(p.regex, p.flags),
  normalized: !!p.normalized,
}));

const NOTES: Record<SafetyLabel, { pt: string; en: string }> = {
  pii: { pt: 'Opa! Nada de dados pessoais aqui, tá?', en: 'Oops! No personal info here (phone, email, address, school, links).' },
  off_platform_contact: { pt: 'Vamos conversar aqui mesmo na praça!', en: 'Let’s keep chatting here in the world — no outside apps or contacts.' },
  slur: { pt: 'Essa palavra não rola aqui.', en: 'That word isn’t allowed here.' },
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

const SEVERITY: Record<SafetyAction, number> = { allow: 0, warn: 1, block: 2, escalate: 3 };
const LABEL_ORDER: SafetyLabel[] = ['spam', 'bullying', 'prohibited_substance', 'politics', 'off_platform_contact', 'dating', 'profanity', 'scam', 'pii', 'sexual', 'slur', 'ethnic_review', 'self_harm'];

function spans(re: RegExp, s: string): [number, number][] {
  const out: [number, number][] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push([m.index, m.index + m[0].length]);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

interface Hit {
  id: string;
  label: SafetyLabel;
  action: Exclude<SafetyAction, 'allow'>;
  note?: { pt: string; en: string };
}

function ruleHits(norm: string): Hit[] {
  const hits: Hit[] = [];
  for (const rule of RULES) {
    const allowed = rule.allow.flatMap((re) => spans(re, norm));
    let matched = false;
    for (const { term, re } of rule.terms) {
      if (ALLOWLIST.has(term)) continue;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(norm))) {
        const s = m.index + m[1].length;
        const e = s + m[2].length;
        if (!allowed.some(([a, b]) => a <= s && e <= b)) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) matched = rule.patterns.some((re) => spans(re, norm).length > 0);
    if (matched) hits.push({ id: rule.id, label: rule.label, action: rule.action, note: rule.note });
  }
  return hits;
}

export function classifyChat(raw: string): SafetyVerdict {
  const text = raw.trim();
  if (!text) return { action: 'block', labels: ['spam'], rules: ['empty'], text: '' };

  const norm = normalize(text);
  const hits: Hit[] = [];
  for (const p of PII) {
    p.re.lastIndex = 0;
    if (p.re.test(p.normalized ? norm : text)) hits.push({ id: `pii.${p.id}`, label: p.label, action: 'block' });
  }
  hits.push(...ruleHits(norm));
  // Laughter (kkkkkkkk, hahaha, rsrsrs) is normal chat, not spam.
  if (/([^ksahr\s])\1{7,}/i.test(text) || (text.length > 24 && text === text.toUpperCase() && /[A-Z]{12,}/.test(text))) hits.push({ id: 'spam.shout', label: 'spam', action: 'warn' });

  if (!hits.length) return { action: 'allow', labels: [], rules: [], text };
  hits.sort((a, b) => SEVERITY[b.action] - SEVERITY[a.action] || LABEL_ORDER.indexOf(b.label) - LABEL_ORDER.indexOf(a.label));
  const top = hits[0];
  const labels = [...new Set(hits.map((h) => h.label))];
  const verdict: SafetyVerdict = {
    action: top.action,
    labels,
    rules: hits.map((h) => h.id),
    text: top.action === 'warn' ? text : '',
    note: top.note ?? NOTES[top.label],
  };
  return verdict;
}

// ---------------------------------------------------------------- Jev typed questions (GDD §12.4)

export type ContentClass =
  | 'ok'
  | 'insult'
  | 'sexual'
  | 'pii'
  | 'scam'
  | 'slurs'
  | 'prohibited_substance'
  | 'dating'
  | 'off_platform_contact'
  | 'politics'
  | 'self_harm'
  | 'ethnic_review'
  | 'spam';

const LABEL_TO_CLASS: Record<SafetyLabel, ContentClass> = {
  pii: 'pii',
  off_platform_contact: 'off_platform_contact',
  slur: 'slurs',
  profanity: 'insult',
  bullying: 'insult',
  sexual: 'sexual',
  dating: 'dating',
  prohibited_substance: 'prohibited_substance',
  politics: 'politics',
  scam: 'scam',
  self_harm: 'self_harm',
  ethnic_review: 'ethnic_review',
  spam: 'spam',
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
  const v = classifyChat(text);
  const top = v.labels.length ? LABEL_TO_CLASS[v.labels.sort((a, b) => LABEL_ORDER.indexOf(b) - LABEL_ORDER.indexOf(a))[0]] : 'ok';
  const toxicity = { allow: 0.02, warn: 0.35, block: 0.8, escalate: 0.9 }[v.action];
  return {
    content_class: v.action === 'allow' ? 'ok' : top,
    contains_english_majority: detectLang(text) === 'en',
    looks_like_real_name_or_phone: v.rules.some((r) => r === 'pii.phone' || r === 'pii.full_name_bait'),
    toxicity,
    action: v.action,
  };
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
