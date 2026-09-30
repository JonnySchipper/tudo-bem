/**
 * View-model of the Caderno de palavras panel (HOWTO Phase 7 step 3): the backend's groups (Padaria, Cumprimentos, Números), each card as a
 * row with its seen / heard / used state, and the progress and reward of the group. Pure: the panel only draws it.
 */
import { CADERNO_GROUP_RV, cadernoGroups, cardById, isLearned, type Bilingual, type Caderno, type CadernoEntry } from '@tudobem/shared';

/** unseen: never met ("???"); seen: met, not heard yet; heard: listened, not used; used: typed or chatted it; learned: counts toward the group. */
export type WordState = 'unseen' | 'seen' | 'heard' | 'used';

export interface WordView {
  id: string;
  /** "???" until the word has been met (an NPC line, a sign). */
  form: string;
  gloss: string;
  /** the word has been met, so its text is shown and 🔊 works */
  known: boolean;
  state: WordState;
  seen: number;
  heard: number;
  used: number;
  /** learned = used, or seen and heard (the rule the group reward uses) */
  learned: boolean;
}

export interface GroupView {
  id: string;
  label: Bilingual;
  total: number;
  learned: number;
  /** 0..100 */
  percent: number;
  complete: boolean;
  /** the one-time reward has been paid */
  paid: boolean;
  reward: number;
  words: WordView[];
}

export interface CadernoViewModel {
  groups: GroupView[];
  /** learned cards over all cards */
  learned: number;
  total: number;
  /** words met (shown, not "???") */
  met: number;
}

export const UNKNOWN_WORD = '???';

export function wordState(e: CadernoEntry | undefined): WordState {
  if (!e || e.seen + e.heard + e.used <= 0) return 'unseen';
  if (e.used > 0) return 'used';
  if (e.heard > 0) return 'heard';
  return 'seen';
}

export function wordView(id: string, e: CadernoEntry | undefined): WordView {
  const card = cardById(id);
  const state = wordState(e);
  const known = state !== 'unseen';
  return {
    id,
    form: known ? card?.form ?? UNKNOWN_WORD : UNKNOWN_WORD,
    gloss: known ? card?.gloss_en_tray ?? card?.gloss_en ?? '' : '',
    known,
    state,
    seen: e?.seen ?? 0,
    heard: e?.heard ?? 0,
    used: e?.used ?? 0,
    learned: isLearned(e),
  };
}

export function cadernoView(caderno: Caderno | undefined, paid: readonly string[] | undefined): CadernoViewModel {
  const paidSet = new Set(paid ?? []);
  const groups: GroupView[] = cadernoGroups().map((g) => {
    const words = g.cardIds.map((id) => wordView(id, caderno?.[id]));
    const learned = words.filter((w) => w.learned).length;
    return {
      id: g.id,
      label: g.label,
      total: words.length,
      learned,
      percent: words.length ? Math.round((learned / words.length) * 100) : 0,
      complete: words.length > 0 && learned === words.length,
      paid: paidSet.has(g.id),
      reward: CADERNO_GROUP_RV,
      words,
    };
  });
  return {
    groups,
    learned: groups.reduce((n, g) => n + g.learned, 0),
    total: groups.reduce((n, g) => n + g.total, 0),
    met: groups.reduce((n, g) => n + g.words.filter((w) => w.known).length, 0),
  };
}

/** The form to play for 🔊: the first spoken form of a card ("Obrigado / Obrigada" plays "Obrigado"). */
export const spokenForm = (form: string): string => form.split('/')[0]!.trim();
