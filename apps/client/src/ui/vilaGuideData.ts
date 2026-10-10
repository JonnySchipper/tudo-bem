/**
 * The Vila Ipê guide: one card that says what there is to do, shown once when a player first arrives in the Vila (and any time from
 * Ajustes → Guia, or by asking Júlia). It is the map of the game in six lines, so the HUD and the places stop being a wall of new things:
 * each line names one loop and where to find it. English first (the player may have no Portuguese yet), the Portuguese word beside it.
 * Pure data, tested. Needs_br: every PT line.
 */
import { CARTELA_GOAL } from '@tudobem/shared';

export interface VilaGuideLine {
  /** The thing's name in the game (a HUD button, a place). */
  pt: string;
  /** Its English name, shown under it. */
  gloss: string;
  en: string;
}

/**
 * Every Portuguese word on the card carries its English: each line's name has a `gloss`, and a Portuguese word inside the English text is
 * followed by its meaning in brackets the first time it comes up (the test checks the ones the card uses).
 */
export const VILA_GUIDE = {
  title: { pt: 'Bem-vindo à Vila Ipê!', en: 'Welcome to Vila Ipê!' },
  kicker: { pt: 'Guia da Vila', en: 'Your guide to the Vila' },
  ok: { pt: 'Vamos lá!', en: 'Let’s go!' },
  lead: 'A neighbourhood in São Paulo where you learn Portuguese by living in it. There is no rush and nothing to lose: here is what there is to do.',
  lines: [
    { pt: 'Favores', gloss: 'Favors', en: 'A gold ! over a neighbour: they need a small favor. The Favores (favors) list near the top shows your next step and where to go. Favors pay reais virtuais (RV), the play money, and make friends (♥ hearts).' },
    { pt: 'Diário', gloss: 'Your diary', en: 'Your diary. Every word you find is kept here: take photos, read signs, listen to people. Practise them in lessons at the Escola (school).' },
    { pt: 'Cartela', gloss: 'Stamp card', en: `The bakery game, the Feira (street market), jiu-jitsu and a bate-papo (chat) in the Praça (square) each give one stamp a day. ${CARTELA_GOAL} stamps pay RV.` },
    { pt: 'Lugares', gloss: 'Places', en: 'Padaria (bakery: order and play at the counter), Feira (market), Academia (jiu-jitsu gym), Escola (school: lessons), the Pet Shop (pet the animals, learn their words), the Praia (beach: fishing and boats, on the 875 bus), and your own kitnet (studio flat) to decorate.' },
    { pt: 'Relógio', gloss: 'Clock', en: 'The Vila has its own clock: a whole day lasts 48 minutes. People keep hours, but there is always a way to play.' },
  ] satisfies VilaGuideLine[],
  tip: 'Not sure where to start? Follow Júlia’s welcome list, at the top right. The first time you open anything new, a short card explains it, and the ? button brings it back.',
} as const;

/** The Portuguese words (and the RV currency) the card's English text uses: the first mention of each is followed by its English in brackets. */
export const VILA_GUIDE_PT_WORDS = ['Favores', 'Escola', 'Feira', 'bate-papo', 'Praça', 'Padaria', 'Academia', 'kitnet', 'reais virtuais'] as const;

/** Per-profile "seen it" flag (localStorage), like the other first-time cards. */
export const vilaGuideKey = (profileId: string | undefined) => `tb_vila_guia:${profileId ?? 'guest'}`;

/** The guide opens by itself the first time a resident (arrival done) stands in one of the Vila's open-air areas. */
export function shouldShowVilaGuide(opts: { room: string; arrivalIntroDone?: boolean; desembarqueDone?: boolean; seen: boolean }): boolean {
  if (opts.seen || opts.arrivalIntroDone === false || opts.desembarqueDone === false) return false;
  return opts.room === 'rua_leste' || opts.room === 'rua' || opts.room === 'praca' || opts.room === 'feira';
}
