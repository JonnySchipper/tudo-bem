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

/** The party boat's own lines (PRAIA-PLAN.md 5.2, 5.3), spoken by `ui`. The summary and the aboard toasts carry names: shown, not spoken. */
export const PARTY_LINES = {
  bora: { pt: 'Bora pro barco de festa?', en: 'Coming to the party boat?' },
  voltou: { pt: 'O barco voltou pro píer.', en: 'The boat is back at the pier.' },
  encerrar: { pt: 'Encerrar a festa? Todo mundo volta pro píer.', en: 'End the party? Everyone goes back to the pier.' },
  desembarcou: { pt: 'Você desembarcou no píer.', en: 'You went ashore at the pier.' },
  quaseAcabando: { pt: 'quase acabando', en: 'almost over' },
} as const satisfies Record<string, Bilingual>;

/** The party pill's time left as words: "quase acabando" in the last two minutes, nothing before (never a countdown). */
export function partyTimeWords(endsAt: number, now: number): Bilingual | null {
  return endsAt - now <= 2 * 60_000 ? PARTY_LINES.quaseAcabando : null;
}

/**
 * The messages in the party boat's bottle (PRAIA-PLAN.md 5.5): short, kind, no names, no contact details. `pescaWords.test.ts` runs each
 * through `classifyChat`. needs_br: true
 */
export const BOTTLE_MESSAGES: readonly Bilingual[] = [
  { pt: 'Quem lê isso, me manda um “oi” da praia!', en: 'Whoever reads this, send me a “hi” from the beach!' },
  { pt: 'Hoje o mar estava calmo e eu estava feliz.', en: 'Today the sea was calm and I was happy.' },
  { pt: 'Se você achou esta garrafa, faça um pedido.', en: 'If you found this bottle, make a wish.' },
  { pt: 'Aprendi uma palavra nova hoje: saudade.', en: 'I learned a new word today: saudade.' },
  { pt: 'O pôr do sol daqui é o mais bonito do mundo.', en: 'The sunset here is the most beautiful in the world.' },
  { pt: 'Não esqueça o protetor solar!', en: 'Don’t forget the sunscreen!' },
  { pt: 'Um dia eu volto pra essa praia.', en: 'One day I’ll come back to this beach.' },
  { pt: 'Peixe grande gosta de gente paciente.', en: 'Big fish like patient people.' },
  { pt: 'Boa sorte na pescaria, amigo!', en: 'Good luck fishing, friend!' },
  { pt: 'Obrigado por ler até aqui. Tenha um bom dia!', en: 'Thanks for reading this far. Have a good day!' },
];

/** Every runtime line of the Praia, with who says it. */
export function pescaSpokenLines(): { speaker: 'ui' | NpcId; text: string }[] {
  const out: { speaker: 'ui' | NpcId; text: string }[] = [];
  for (const l of Object.values(PARTY_LINES)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of BOTTLE_MESSAGES) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(PESCA_STAGE)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(SIZE_WORDS)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(JUNK)) out.push({ speaker: 'ui', text: l.pt });
  for (const l of Object.values(NEIDE_COACH)) out.push({ speaker: 'neide', text: l.pt });
  for (const l of Object.values(JO_SELL)) out.push({ speaker: 'jo', text: l.pt });
  for (const l of Object.values(BENTO_LINES)) out.push({ speaker: 'bento', text: l.pt });
  return out;
}
