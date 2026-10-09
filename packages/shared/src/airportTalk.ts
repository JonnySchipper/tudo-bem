import { CARTELA_GOAL, CARTELA_REWARD } from './cartela.js';
import type { Greeting } from './clock.js';
import type { Bilingual } from './types.js';

/**
 * What the airport staff say (`ROOMS.aeroporto`): Célia at the information desk hands over Júlia's package, Agente Paulo stamps the
 * passport. The client's `airportTutorial.ts` shows these; `collectSpokenLines` finds them here so `pnpm tts` bakes them.
 * Needs_br: every Portuguese line here.
 */

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const GREETINGS: readonly Greeting[] = ['bom dia', 'boa tarde', 'boa noite'];
const GREETING_EN: Record<Greeting, string> = { 'bom dia': 'Good morning', 'boa tarde': 'Good afternoon', 'boa noite': 'Good evening' };

export const CELIA_LINES = {
  /** After the hand-over, over her head. */
  photo: { pt: 'Agora tira uma foto do avião! Aqui é de graça.', en: 'Now take a photo of the plane! It’s free here.' },
  help: { pt: 'Precisa de ajuda?', en: 'Need any help?' },
  answers: [
    { pt: 'Clica em Câmera, mira e clica de novo. A palavra do que aparece vai pro diário.', en: 'Click Camera, aim, and click again. The word for what’s in the picture goes into your diary.' },
    { pt: 'Lá fora, depois das portas. O 875 vai direto pra Vila Ipê.', en: 'Outside, past the doors. The 875 goes straight to Vila Ipê.' },
    {
      pt: `Cada coisa nova que você faz no bairro vale um carimbo. Com ${CARTELA_GOAL}, você ganha ${CARTELA_REWARD} RV!`,
      en: `Every new thing you do in the neighborhood is worth a stamp. With ${CARTELA_GOAL}, you win ${CARTELA_REWARD} RV!`,
    },
  ],
} as const satisfies Record<string, Bilingual | readonly Bilingual[]>;

/** Célia's first line: the package from Júlia. `spoken` is the same line without the player's name (one clip for every player). */
export function celiaWelcome(name: string): Bilingual & { spoken: string } {
  const who = name.trim();
  return {
    pt: `Bem-vindo ao Brasil${who ? `, ${who}` : ''}! A Júlia deixou este pacote pra você.`,
    en: `Welcome to Brazil${who ? `, ${who}` : ''}! Júlia left this package for you.`,
    spoken: 'Bem-vindo ao Brasil! A Júlia deixou este pacote pra você.',
  };
}

export const AGENTE_LINES = {
  reason: { pt: 'Qual é o motivo da viagem?', en: 'What is the reason for your trip?' },
  stamped: { pt: 'Bem-vindo ao Brasil! Pode passar. Boa estadia!', en: 'Welcome to Brazil! You may go through. Enjoy your stay!' },
  /** Over his head, after the stamp. */
  next: { pt: 'Próximo, por favor!', en: 'Next, please!' },
} as const satisfies Record<string, Bilingual>;

/** Agente Paulo asks for the passport with the greeting of the hour; `again` is his hint after the wrong one. */
export function agenteAsk(g: Greeting, again: boolean): Bilingual {
  return again
    ? { pt: `Hmm… agora é ${g}. Tenta de novo!`, en: `Hmm… right now it’s “${g}” (${GREETING_EN[g].toLowerCase()}). Try again!` }
    : { pt: `${cap(g)}! Passaporte, por favor.`, en: `${GREETING_EN[g]}! Passport, please.` };
}

/** Every line the airport staff speak aloud, for the bake (`collectSpokenLines`). */
export function airportSpokenLines(): { speaker: 'celia' | 'agente'; text: string }[] {
  return [
    { speaker: 'celia', text: celiaWelcome('').spoken },
    ...[CELIA_LINES.help, ...CELIA_LINES.answers].map((l) => ({ speaker: 'celia' as const, text: l.pt })),
    ...GREETINGS.flatMap((g) => [agenteAsk(g, false), agenteAsk(g, true)]).map((l) => ({ speaker: 'agente' as const, text: l.pt })),
    { speaker: 'agente', text: AGENTE_LINES.reason.pt },
    { speaker: 'agente', text: AGENTE_LINES.stamped.pt },
  ];
}
