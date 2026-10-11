/**
 * The line a click-to-talk opens with. An idle line whose conversation word is still unlearned leads the first line of the one box that
 * click opens (the greeting, a hand-over, an errand: `leadNextBox` in dialogue.ts), never a box of its own. Neighbours chatting on their own
 * are not this: those bubbles teach nothing.
 */
import { localizeGreeting, unheardIdleLine, type Bilingual } from '@tudobem/shared';

export interface TalkIdleOpen {
  /** `<npc>.idle<N>`: the diary grants the word from this anchor. */
  anchor: string;
  line: Bilingual;
}

/** The first unheard idle line, greeting swapped for the hour, or null when the diary already has every one. */
export function talkIdleOpen(npc: string, idleLines: readonly Bilingual[], earned: readonly string[] | undefined, minute: number): TalkIdleOpen | null {
  const next = unheardIdleLine(npc, idleLines.length, earned);
  if (next === null) return null;
  const line = idleLines[next];
  if (!line) return null;
  return { anchor: `${npc}.idle${next}`, line: localizeGreeting(line, minute) };
}
