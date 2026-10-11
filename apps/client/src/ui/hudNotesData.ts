/**
 * What each stat on the top bar means, for a player who has never seen it: the belt, the nameplate (Verde), today's Escola goal (Meta XP)
 * and the Cartela chip. A click on the chip opens its note (ui/hudNotes.ts). English first (the player may have no Portuguese yet), with
 * the Portuguese being explained beside it. Pure data, tested. Needs_br: every PT line.
 */
import { CARTELA_GOAL, CARTELA_MAX_STAMPS_PER_DAY, CARTELA_REWARD, NAMEPLATE_TIERS, STRIPES_PER_BELT } from '@tudobem/shared';

export type HudNoteId = 'belt' | 'plate' | 'goal';

export interface HudNote {
  id: HudNoteId;
  title: { pt: string; en: string };
  lines: { en: string; pt?: string }[];
  note?: string;
}

const tiers = NAMEPLATE_TIERS.slice(1)
  .map((t) => `${t.en} at ${t.mastered}`)
  .join(', ');

export const HUD_NOTES: Record<HudNoteId, HudNote> = {
  belt: {
    id: 'belt',
    title: { pt: 'Sua faixa', en: 'Your jiu-jitsu belt' },
    lines: [
      { en: 'The bar is your belt. The small squares are its stripes.', pt: 'faixa · listras' },
      { en: 'Train at the Academia do Bairro, on the east side of Rua dos Ipês: buy a gi once, then roll with Professora Bia’s partners.' },
      { en: `Each win counts toward a stripe. ${STRIPES_PER_BELT} stripes make the next belt. A loss never takes a stripe away.` },
    ],
    note: 'Belts are earned on the mat, never bought.',
  },
  plate: {
    id: 'plate',
    title: { pt: 'Sua placa', en: 'Your nameplate colour' },
    lines: [
      { en: 'This is the colour of your name tag. Everyone starts on Verde (green).', pt: 'placa verde' },
      { en: 'Master words in Dona Lúcia’s lessons at the Escola to earn the next colour.' },
      { en: `Words mastered: ${tiers} (gold also needs a 30-day streak).` },
    ],
    note: 'Plates come from learning, never from money.',
  },
  goal: {
    id: 'goal',
    title: { pt: 'Meta de hoje', en: 'Today’s Escola goal' },
    lines: [
      { en: 'Meta x/y XP: the points from today’s lessons with Dona Lúcia at the Escola, against your daily goal.', pt: 'meta · XP' },
      { en: 'Meet the goal on a day to grow your streak: the flame counts the days in a row.', pt: 'dias seguidos' },
      { en: 'You can change the goal at the Escola. The chip hides once today’s goal is met.' },
    ],
    note: 'A gentle reminder, never a penalty.',
  },
};

/** The Cartela rules in one line, for the chip's tooltip. */
export const CARTELA_RULE = `One stamp per activity per day (up to ${CARTELA_MAX_STAMPS_PER_DAY}). ${CARTELA_GOAL} stamps pay ${CARTELA_REWARD} RV. Click for the card.`;

/** What the top bar shows lives with the disclosure ladder (ui/disclosure.ts); re-exported here for the old import path. */
export { hudShows } from './disclosure';
