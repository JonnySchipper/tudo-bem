/**
 * Every line a conversation word can be heard in. An anchor id is one of:
 *   `<npc>.<node>`    a node of the NPC's greeting talk (npcTalk.ts)
 *   `<npc>.idle<N>`   the Nth line from the NPC's own list (rooms.ts idleLines), said to the player who chose to talk to them
 *   `<npc>.greet`     a feira vendor's opening line at the stall (feira.ts)
 *   `<npc>.closed`    the same vendor's line when the stall is shut
 *   `carlos.viagem`   the counter line when an order goes to-go (conversa.ts)
 *   `julia.chegada_*` the arrival card, Júlia speaking
 * The server checks the player is next to the speaker. Lines said to nobody in particular (the ambient bubbles) teach nothing.
 */
import { ARRIVAL_LINES } from './arrival.js';
import { VENDORS } from './feira.js';
import { NPC_TALK } from './npcTalk.js';
import { npcDefById } from './rooms.js';

export type DiaryLineKind = 'talk' | 'idle' | 'greet' | 'closed' | 'counter' | 'arrival';

export interface DiaryLine {
  id: string;
  npc: string;
  kind: DiaryLineKind;
  pt: string;
}

/** The to-go answer at the counter. conversa.ts holds the same string (a test keeps them equal). */
export const COUNTER_LINES: Record<string, string> = {
  'carlos.viagem': 'Pra viagem, então. Tá na mão. Volte sempre!',
};

/** Speakers that stand in for each other at the same counter (Dona Graça takes the night shift of Seu Carlos). */
export const COUNTER_STAND_INS: Record<string, string[]> = { carlos: ['graca'] };

export function diaryLine(id: string): DiaryLine | undefined {
  const dot = id.indexOf('.');
  if (dot < 1) return undefined;
  const npc = id.slice(0, dot);
  const rest = id.slice(dot + 1);
  const arrival = ARRIVAL_LINES[id];
  if (arrival) return { id, npc, kind: 'arrival', pt: arrival.pt };
  const counter = COUNTER_LINES[id];
  if (counter) return { id, npc, kind: 'counter', pt: counter };
  const idle = /^idle(\d+)$/.exec(rest);
  if (idle) {
    const line = npcDefById(npc)?.idleLines[Number(idle[1])];
    return line ? { id, npc, kind: 'idle', pt: line.pt } : undefined;
  }
  if (rest === 'greet' || rest === 'closed') {
    const vendor = (VENDORS as Record<string, (typeof VENDORS)[keyof typeof VENDORS] | undefined>)[npc];
    return vendor ? { id, npc, kind: rest, pt: vendor[rest].pt } : undefined;
  }
  const node = (NPC_TALK as Record<string, { nodes: Record<string, { line: { pt: string } }> } | undefined>)[npc]?.nodes[rest];
  return node ? { id, npc, kind: 'talk', pt: node.line.pt } : undefined;
}
