/**
 * Everything the Praia says at runtime (PRAIA-PLAN.md 6.4): the fishing stage's words (spoken by `ui`), Dona Neide's one-time coaching,
 * Jô buying fish, Seu Bento's rental lines. The spoken-line collector (`spokenLines.ts`) walks them so `pnpm tts` bakes every clip.
 * needs_br: true (every line)
 */
import type { Bilingual } from './types.js';
import type { NpcId } from './rooms.js';
import { JUNK, SIZE_WORDS } from './fish.js';

/** The stage's words: big, bilingual, never a number. */
export const PESCA_STAGE = {
  segura: { pt: 'Segura… solta!', en: 'Hold… let go!' },
  enrolou: { pt: 'Ih, enrolou!', en: 'Oops, it tangled!' },
  fisgou: { pt: 'Fisgou!', en: 'Hooked!' },
  cedo: { pt: 'Cedo demais!', en: 'Too early!' },
  escapou: { pt: 'Escapou…', en: 'It got away…' },
  arrebentou: { pt: 'Arrebentou a linha!', en: 'The line snapped!' },
  pegou: { pt: 'Pegou!', en: 'Got it!' },
  baiacu: { pt: 'Ih, um baiacu!', en: 'Oh, a pufferfish!' },
  devolve: { pt: 'Volta pro mar, baiacu!', en: 'Back to the sea, pufferfish!' },
  novo: { pt: 'Novo!', en: 'New!' },
  recorde: { pt: 'Recorde!', en: 'Record!' },
  corre: { pt: 'Ele corre! Solta!', en: 'It’s running! Let go!' },
  puxa: { pt: 'Puxa!', en: 'Reel in!' },
  boaPescaria: { pt: 'Boa pescaria!', en: 'Good fishing!' },
} as const satisfies Record<string, Bilingual>;

/** Dona Neide's one-time lines (spoken by `neide`). */
export const NEIDE_COACH = {
  snap: { pt: 'Arrebentou. Da próxima, solta quando ele correr.', en: 'It snapped. Next time, let go when it runs.' },
  trophy: { pt: 'Olha isso! Esse vai pro recorde.', en: 'Look at that! That’s one for the record.' },
  baiacu: { pt: 'Baiacu não se come, se devolve.', en: 'Pufferfish aren’t for eating, you give them back.' },
} as const satisfies Record<string, Bilingual>;

/** Jô at her kiosk. */
export const JO_SELL = {
  sold: { pt: 'Peixe bom! Toma aqui.', en: 'Nice fish! Here you go.' },
  cap: { pt: 'Hoje já comprei o que dava. Amanhã tem mais.', en: 'I’ve bought all I can today. More tomorrow.' },
  empty: { pt: 'Balde vazio, meu bem. Vai pescar!', en: 'Empty bucket, dear. Go fish!' },
} as const satisfies Record<string, Bilingual>;

/** Seu Bento at the shack. */
export const BENTO_LINES = {
  rented: { pt: 'Tá alugado. Volta antes da maré virar!', en: 'It’s rented. Be back before the tide turns!' },
  broke: { pt: 'RV insuficiente, viu? Pesca na praia e vende pra Jô.', en: 'Not enough RV. Fish from the beach and sell to Jô.' },
  back: { pt: 'O barco voltou. Como foi lá fora?', en: 'The boat is back. How was it out there?' },
} as const satisfies Record<string, Bilingual>;

/** Every runtime line of the Praia, with who says it. */
export function pescaSpokenLines(): { speaker: 'ui' | NpcId; text: string }[] {
  const out: { speaker: 'ui' | NpcId; text: string }[] = [];
  for (const l of Object.values(PESCA_STAGE)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(SIZE_WORDS)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(JUNK)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(NEIDE_COACH)) out.push({ speaker: 'neide', text: l.pt });
  for (const l of Object.values(JO_SELL)) out.push({ speaker: 'jo', text: l.pt });
  for (const l of Object.values(BENTO_LINES)) out.push({ speaker: 'bento', text: l.pt });
  return out;
}
