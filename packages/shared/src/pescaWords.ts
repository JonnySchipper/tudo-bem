/**
 * The Praia's words, one reusable list per water (PRAIA-PLAN.md 4.3, events-requirements.md rule 1: words you only earn by taking part).
 * The rows live in the diary pack (`diary-words.json`, area `praia`, games `pesca.<water>`); this module reads them back as data so the
 * fishing tournament (later) can import the same lists. A grant item is either an `EarnMoment` or a fish id (the species word).
 */
import { DIARY_GAMES, diaryWord, type DiaryWord } from './diary.js';
import { WATER_IDS, type WaterId } from './pesca.js';

/** The moments that earn a water's own words (the species words are earned by the first catch of that fish, anywhere). */
export const EARN_MOMENTS = [
  'first_cast',
  'first_nibble',
  'first_bite',
  'first_catch',
  'first_snap',
  'first_trophy',
  'tide_cast',
  'board',
  'trip_end',
  'sunset_aboard',
  'host_board',
  'guest_board',
  'accept_invite',
  'music',
  'message_bottle',
] as const;
export type EarnMoment = (typeof EARN_MOMENTS)[number];
export const isEarnMoment = (v: unknown): v is EarnMoment => typeof v === 'string' && (EARN_MOMENTS as readonly string[]).includes(v);

export const pescaGameId = (w: WaterId): string => `pesca.${w}`;

/** Each water's moment words, in pack order. */
export const PESCA_WORDS: Record<WaterId, { wordId: string; earn: EarnMoment }[]> = Object.fromEntries(
  WATER_IDS.map((w) => {
    const g = DIARY_GAMES.find((x) => x.id === pescaGameId(w));
    const rows = (g?.grants ?? []).filter((gr) => isEarnMoment(gr.item)).map((gr) => ({ wordId: gr.wordId, earn: gr.item as EarnMoment }));
    return [w, rows];
  }),
) as Record<WaterId, { wordId: string; earn: EarnMoment }[]>;

/** The word a moment earns on a water, if that water has one for it. */
export function momentWord(water: WaterId, moment: EarnMoment): DiaryWord | undefined {
  const row = PESCA_WORDS[water].find((r) => r.earn === moment);
  return row ? diaryWord(row.wordId) : undefined;
}

/** The species word of a fish (`diary.praia.<id>`), from whichever water's game anchors it. */
export function fishWord(fishId: string): DiaryWord | undefined {
  for (const g of DIARY_GAMES) {
    if (!g.id.startsWith('pesca.')) continue;
    const gr = g.grants?.find((x) => x.item === fishId);
    if (gr) return diaryWord(gr.wordId);
  }
  return undefined;
}
