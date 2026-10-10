/**
 * The rules behind a found word (achado.ts): which reading words hide in a room, how many this player has, the streak that raises the
 * chime, and where the word's letters land on screen. Pure, so it is tested without a DOM.
 */
import { hotspotsInRoom, normalizeDiary, wordForSign, type RoomId } from '@tudobem/shared';

/** The reading words hidden on the signs of a room, each once (two signs may teach the same word), in hotspot order. */
export function roomReadingWords(room: RoomId): string[] {
  const out: string[] = [];
  for (const hs of hotspotsInRoom(room)) {
    const w = wordForSign(hs.id);
    if (w && !out.includes(w.id)) out.push(w.id);
  }
  return out;
}

export interface Tally {
  found: number;
  total: number;
}

/** How many of the room's hidden words the player has, counting `plus` (the one being found now) as had. */
export function roomTally(room: RoomId, diary: readonly string[] | undefined, plus?: string): Tally {
  const words = roomReadingWords(room);
  const have = new Set(normalizeDiary(diary));
  if (plus) have.add(plus);
  return { found: words.filter((w) => have.has(w)).length, total: words.length };
}

/** Finds closer together than this keep the streak going (time to walk to the next star and read it). */
export const STREAK_MS = 75_000;

/** The streak after a find at `now`: 1 for a first find or after a long pause, else one more. */
export function nextStreak(prev: { n: number; at: number } | null, now: number): number {
  if (!prev || now - prev.at > STREAK_MS) return 1;
  return prev.n + 1;
}

/** Semitones of the major pentatonic, climbing one step per find in a streak (two octaves, then it stays at the top). */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function streakSemitones(streak: number): number {
  return PENTA[Math.max(0, Math.min(PENTA.length - 1, streak - 1))]!;
}

/** Type size of the found word: big, but a long word still fits the screen. */
export function letterSize(word: string, viewW: number): number {
  const fit = (viewW - 48) / Math.max(1, [...word].length * 0.62);
  return Math.round(Math.max(30, Math.min(64, fit)));
}

/**
 * Where the word hangs: centered above the star, kept inside the screen (and below the HUD at the top).
 * Returns the center of the word in client px.
 */
export function lockupSpot(star: { x: number; y: number }, box: { w: number; h: number }, view: { w: number; h: number; top: number; bottom: number }): { x: number; y: number } {
  const pad = 16;
  const x = Math.max(pad + box.w / 2, Math.min(view.w - pad - box.w / 2, star.x));
  const above = star.y - 70 - box.h / 2;
  const minY = view.top + pad + box.h / 2;
  // no room above (a sign at the top of the screen): hang under the star instead
  const y = above >= minY ? above : Math.min(view.h - view.bottom - pad - box.h / 2, star.y + 70 + box.h / 2);
  return { x, y };
}
