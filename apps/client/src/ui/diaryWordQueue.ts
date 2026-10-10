/**
 * The new-word cards of the language diary, one at a time. A shot can teach several words at once (and a sign, a line or a game can
 * land while a card is still up): every word goes into this queue in the order it was earned, and a card is taken only when none is
 * showing and no game is on. Nothing is dropped and nothing is replaced. Pure: the panel draws what this hands out.
 */
import { normalizeDiary } from '@tudobem/shared';
import type { WordSource } from './wordFlight';

/** The journal reveal (ui/journalReveal.ts) instead of the card: only for the first word of a fresh diary, and only once. */
export function shouldReveal(diary: readonly string[] | undefined, seen: boolean): boolean {
  return !seen && normalizeDiary(diary).length <= 1;
}

export interface WordMoment {
  pt: string;
  en: string;
  areaPt?: string;
  progress?: string;
  /** Where the word was read on screen (a line of dialogue): the card's word flies in from there. */
  from?: WordSource;
}

export interface QueuedWord<P = unknown> extends WordMoment {
  /** 1-based place in its shot (1 for a word that came alone). */
  index: number;
  /** Words in its shot. */
  total: number;
  /** The print of the shot, carried by the shot's last card: it flies into the diary when that card closes. */
  print?: P;
  /** The print of the shot, on every card of it: each word bursts out of the photo (ui/photoFind.ts). */
  shot?: P;
}

/**
 * How long a card stays when nobody presses its button: the last card of a shot lingers, the ones before it hand over sooner, and a long
 * run (a crowded corner of the praça can give a dozen words) hands over faster still.
 */
export const CARD_MS = { last: 3400, more: 2000, many: 1400 } as const;
export const LONG_RUN = 5;
export const cardMs = (w: { index: number; total: number }): number => (w.index >= w.total ? CARD_MS.last : w.total > LONG_RUN ? CARD_MS.many : CARD_MS.more);

/**
 * The full "Nova palavra!" card is for the first few words of a session; after that a new word flies into the Diário on its own (the
 * small word flight) and the Diário's badge counts it. A photo's word bursting out of its print and the journal reveal are not cards.
 */
export const FULL_CARDS_PER_SESSION = 3;
export const wantsFullCard = (shown: number): boolean => shown < FULL_CARDS_PER_SESSION;

/** The cards of one shot (or of one word that came alone), in the order the server sent them. */
export function momentsOfShot<P>(words: readonly WordMoment[], print?: P): QueuedWord<P>[] {
  return words.map((w, i) => ({ ...w, index: i + 1, total: words.length, ...(print ? { shot: print } : {}), ...(i === words.length - 1 && print ? { print } : {}) }));
}

export class WordQueue<P = unknown> {
  private readonly items: QueuedWord<P>[] = [];

  push(words: readonly QueuedWord<P>[]): void {
    this.items.push(...words);
  }

  get length(): number {
    return this.items.length;
  }

  /** The next card to show, or null while a card is still up, a game is on (a word found meanwhile waits for it to end) or nothing is waiting. */
  take(cardUp: boolean, gameOn: boolean): QueuedWord<P> | null {
    if (cardUp || gameOn) return null;
    return this.items.shift() ?? null;
  }
}
