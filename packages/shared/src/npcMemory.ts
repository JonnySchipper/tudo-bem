import { cardsInText, maskCards } from './caderno.js';
import { cardById } from './cards.js';
import { filterNpcLine, MEMORY_MAX_CHARS, type ConversaOrder, type ConversaSubject } from './conversa.js';
import { isNpcId } from './bonds.js';
import { itemById } from './recados.js';
import { classifyChat } from './safety.js';
import type { NpcId } from './rooms.js';

/**
 * NPC memory (HOWTO Phase 8 step 5): one short PT line per NPC about the player's last Conversa. Only a
 * vetted summary is ever kept, never the player's own words.
 */

/** Old or hand-edited saves: keep known NPCs with a non-empty string, clipped to the cap. Never throws. */
export function normalizeNpcMemory(raw: unknown): Partial<Record<NpcId, string>> {
  const out: Partial<Record<NpcId, string>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isNpcId(k) || typeof v !== 'string') continue;
    const t = v.replace(/\s+/g, ' ').trim().slice(0, MEMORY_MAX_CHARS);
    if (t) out[k] = t;
  }
  return out;
}

const wordsOf = (s: string) => maskCards(s).split(' ').filter(Boolean);

/**
 * A run of this many of the player's own free words (words that are not curriculum card forms, so a restated
 * order like "um pão na chapa" is fine) copied into the summary counts as quoting them.
 */
const QUOTE_WINDOW = 4;

/**
 * Gate for a summary before it is stored. Returns the cleaned line, or null when it must not be kept:
 * empty, over 200 chars, fails the NPC-line filter (Gate B) or the chat safety classifier, carries a link,
 * or repeats a run of the player's own words.
 */
export function vetMemory(summary: string | null | undefined, playerLines: readonly string[] = []): string | null {
  if (typeof summary !== 'string') return null;
  const t = summary
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”'`]+|["“”'`]+$/g, '')
    .trim();
  if (!t || t.length > MEMORY_MAX_CHARS) return null;
  if (!filterNpcLine(t) || /https?:|www\./i.test(t)) return null;
  if (classifyChat(t).action !== 'allow') return null;
  const own = ` ${wordsOf(t).join(' ')} `;
  for (const line of playerLines) {
    const w = wordsOf(line);
    for (let i = 0; i + QUOTE_WINDOW <= w.length; i++) {
      const run = w.slice(i, i + QUOTE_WINDOW);
      if (!run.includes('¤') && own.includes(` ${run.join(' ')} `)) return null;
    }
  }
  return t;
}

const withArticle = (id: string): string => {
  const c = cardById(id);
  if (!c) return '';
  return `${c.gender === 'f' ? 'uma ' : c.gender === 'm' ? 'um ' : ''}${c.form}`;
};

/**
 * Offline summary from what is known: the food and drink cards the player named (or the order the server
 * tracked), else the subject. Deterministic. Only card names and the subject title appear in it.
 */
export function templateMemory(input: { subject: Pick<ConversaSubject, 'title'>; playerLines?: readonly string[]; order?: ConversaOrder }): string {
  const ids = new Set<string>();
  for (const key of ['food', 'drink'] as const) {
    const card = itemById(input.order?.[key])?.cardId;
    if (card) ids.add(card);
  }
  for (const line of input.playerLines ?? [])
    for (const id of cardsInText(line)) {
      const tags = cardById(id)?.tags ?? [];
      if (tags.includes('food') || tags.includes('drink')) ids.add(id);
    }
  const things = [...ids].slice(0, 2).map(withArticle).filter(Boolean);
  // needs_br: true
  if (things.length) return `Pediu ${things.join(' e ')}.`;
  return `Conversou sobre ${input.subject.title.pt.toLowerCase()}.`;
}
