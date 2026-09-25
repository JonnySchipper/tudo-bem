/**
 * Typing forgiveness per content/curriculum/phase0/accept-list-rules.md.
 * Used by the stub Jev NPC-reply scorer for typed answers (chips stay exact).
 */
import { detectLang } from './gloss.js';

const NUM_WORDS: Record<string, string> = {
  '1': 'um', '2': 'dois', '3': 'tres', '4': 'quatro', '5': 'cinco', '6': 'seis', '7': 'sete', '8': 'oito', '9': 'nove', '10': 'dez',
};

/** Rules 1–5: accents optional, case-insensitive, punctuation ignored, spaces collapsed, obrigado ≡ obrigada; digits ≡ words; gender-flexible counts. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/c\/\s*/g, 'com ')
    .replace(/[!?.,…;:"“”'()«»¿¡]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => NUM_WORDS[w] ?? w)
    .map((w) => (w === 'obrigada' ? 'obrigado' : w === 'uma' ? 'um' : w === 'duas' ? 'dois' : w === 'pf' || w === 'porfavor' ? 'por favor' : w))
    .join(' ');
}

type SpeechAct = 'me_ve' | 'me_da' | 'quero' | null;

const ACTS: [RegExp, SpeechAct][] = [
  [/^(por favor )?me ve /, 'me_ve'],
  [/^(por favor )?me da /, 'me_da'],
  [/^(eu )?(quero|queria|gostaria de|gostaria) /, 'quero'],
];

export interface ParsedReply {
  act: SpeechAct;
  polite: boolean;
  /** The noun phrase / content after removing the speech act, "por favor" and a leading article (rule 6). */
  core: string;
}

export function parseReply(s: string): ParsedReply {
  let t = normalizeAnswer(s);
  let act: SpeechAct = null;
  for (const [re, a] of ACTS)
    if (re.test(t + ' ')) {
      act = a;
      t = (t + ' ').replace(re, '').trim();
      break;
    }
  const polite = /\bpor favor\b/.test(t) || act !== null;
  t = t.replace(/\bpor favor\b/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(um|o|a|os|as) /, '');
  return { act, polite, core: t };
}

export interface AcceptResult {
  match: boolean;
  /** Max score the answer can earn (accept-list-rules.md “Me vê construction”). */
  cap: 0 | 1 | 2 | 3;
  english: boolean;
  why: string;
}

/** Does a typed answer match a target utterance (chip text or accept variant)? */
export function acceptAnswer(input: string, target: string): AcceptResult {
  const english = detectLang(input) === 'en';
  if (!normalizeAnswer(input)) return { match: false, cap: 0, english, why: 'empty' };
  if (normalizeAnswer(input) === normalizeAnswer(target)) return { match: true, cap: 3, english, why: 'exact (forgiving)' };
  const a = parseReply(input);
  const b = parseReply(target);
  if (!a.core || a.core !== b.core) return { match: false, cap: 0, english, why: 'different content' };
  if (a.act === 'me_da' || a.act === 'quero') return { match: true, cap: 2, english, why: `${a.act} accepted — nudge toward “me vê”` };
  if (b.polite && !a.polite) return { match: true, cap: 1, english, why: 'bare order without softener — rephrase' };
  return { match: true, cap: 3, english, why: 'same intent (articles/speech act flexible)' };
}
