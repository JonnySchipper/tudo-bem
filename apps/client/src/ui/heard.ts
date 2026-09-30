/**
 * The Caderno counts a card as "heard" when the player plays 🔊 for it. The UI modules don't own the socket, so `main.ts` registers a sink
 * (`net.send({ t: 'heard', cardIds })`) and every 🔊 button goes through `noteHeard`.
 */
import { CADERNO_HEARD_MAX_IDS, cardsInText } from '@tudobem/shared';

let sink: ((cardIds: string[]) => void) | null = null;

export function setHeardSink(fn: ((cardIds: string[]) => void) | null): void {
  sink = fn;
}

/** The card ids to report for a played PT text (plus any the caller already knows), unique, capped at what the server accepts. */
export function heardIds(pt: string, extra: readonly string[] = []): string[] {
  return [...new Set([...cardsInText(pt), ...extra])].slice(0, CADERNO_HEARD_MAX_IDS);
}

/** Tell the server the player listened to `pt`. Nothing is sent when the text holds no known card. */
export function noteHeard(pt: string, extra: readonly string[] = []): void {
  const ids = heardIds(pt, extra);
  if (ids.length) sink?.(ids);
}
