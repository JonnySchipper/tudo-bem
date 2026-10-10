/**
 * The flight in: the cutscene a new account plays between the name card and the arrivals hall (apps/client/src/ui/flightIntro.ts).
 * The backstory, in the player's own head (English: they have no Portuguese yet), Júlia's letter, then Comissária Lia (the flight
 * attendant who later welcomes them in the arrivals hall) walks the aisle calling the player's name: the player clicks the passenger
 * they are (PASSENGER_LOOKS: that look becomes their avatar, changed any time later from the HUD's Visual), answers "Sou eu!", and
 * the two chat on the night flight in, until the captain calls the descent.
 *
 * Lia speaks Portuguese (voiced: `flightSpokenLines` feeds `pnpm tts`), always with the English under it, and her questions have
 * replies the player can pick, Animal Crossing style. Nothing here is saved or taught: the first diary word stays Lia's "Bem-vindo"
 * in the arrivals hall. needs_br: every PT line.
 */

import type { Appearance } from './types.js';
import { STARTER_OUTFITS } from './constants.js';

export interface FlightLine {
  pt: string;
  en: string;
}

export interface FlightReply {
  /** What the player says (Portuguese the line just taught, or a sound anyone can make). */
  pt: string;
  en: string;
  /** Lia's answer to this reply. */
  react: FlightLine;
}

/** A beat of the cabin conversation: a line, or a question with replies (each with its own reaction). */
export type FlightBeat =
  | { kind: 'lia'; line: FlightLine; mood?: 'smile' | 'laugh' | 'wave' }
  | { kind: 'ask'; line: FlightLine; replies: FlightReply[] }
  | { kind: 'think'; en: string }
  | { kind: 'captain'; line: FlightLine };

/** The prologue over the night sky, in the player's head. */
export const FLIGHT_PROLOGUE: readonly string[] = [
  'You have never been to Brazil.',
  'You don’t speak a single word of Portuguese… not yet.',
  'But then, one ordinary day, a letter arrived.',
];

/** After the letter. */
export const FLIGHT_PROLOGUE_AFTER: readonly string[] = ['So you packed a bag, bought a ticket…', '…and said yes.'];

/** Júlia's letter: English with a little Portuguese in it, the way a friend who wants you to come would write. `{name}` is the player. */
export const JULIA_LETTER = {
  stamp: 'BRASIL',
  postmark: 'VILA IPÊ · SP',
  greeting: 'Oi, {name}!',
  body: [
    'Come to Vila Ipê! The ipê trees are in bloom, the pão de queijo is always warm, and there’s a little kitnet here waiting for you.',
    'Don’t worry about the language. Everybody here will help you, and you’ll learn faster than you think.',
    'I’ll be waiting for you in the praça, the town square.',
  ],
  signoff: 'Beijos,',
  signature: 'Júlia',
} as const;

/** The caption over the plane in the night sky. */
export const FLIGHT_CAPTION = { pt: 'Em algum lugar sobre o Atlântico…', en: 'Somewhere over the Atlantic…' } as const;

/** The cabin, from Lia's first "Oi!" to the seatbelt sign: three questions, short enough not to keep a player from the game. */
export const FLIGHT_CABIN: readonly FlightBeat[] = [
  { kind: 'think', en: 'Ten hours in. The cabin lights are low, and you’re far too excited to sleep.' },
  {
    kind: 'ask',
    line: { pt: 'Oi! Tudo bem?', en: 'Hi! How are you? (Literally: “All good?”)' },
    replies: [
      { pt: 'Tudo bem!', en: 'All good!', react: { pt: 'Muito bem! Você já fala português!', en: 'Very good! You already speak Portuguese!' } },
      { pt: 'Hã…?', en: 'Huh…?', react: { pt: 'Tudo bem, tudo bem!', en: 'It’s OK, it’s OK! “Tudo bem” means “all good”: you ask it, and you answer it.' } },
    ],
  },
  {
    kind: 'ask',
    line: { pt: 'E o que te traz ao Brasil?', en: 'And what brings you to Brazil?' },
    replies: [
      { pt: 'Uma amiga!', en: 'A friend!', react: { pt: 'Uma amiga te esperando? Que sorte!', en: 'A friend waiting for you? Lucky you!' } },
      { pt: 'Aprender português!', en: 'To learn Portuguese!', react: { pt: 'Que ótimo! O português é uma língua linda.', en: 'Great! Portuguese is a beautiful language.' } },
      { pt: 'Pão de queijo!', en: 'Cheese bread!', react: { pt: 'Boa escolha! Pão de queijo é tudo!', en: 'Good choice! Pão de queijo is everything!' } },
    ],
  },
  { kind: 'think', en: 'You show her Júlia’s letter. Her eyes light up at the address.' },
  { kind: 'lia', line: { pt: 'Vila Ipê! Eu conheço. É um bairro lindo.', en: 'Vila Ipê! I know it. It’s a lovely neighbourhood.' }, mood: 'smile' },
  {
    kind: 'ask',
    line: { pt: 'Você fala português?', en: 'Do you speak Portuguese?' },
    replies: [
      { pt: 'Não… ainda não.', en: 'No… not yet.', react: { pt: 'Não tem problema! Você vai aprender rapidinho.', en: 'No problem! You’ll learn in no time.' } },
      { pt: 'Um pouquinho?', en: 'A tiny bit?', react: { pt: 'Não tem problema! Você vai aprender rapidinho.', en: 'No problem! You’ll learn in no time.' } },
    ],
  },
  { kind: 'lia', line: { pt: 'Lá, todo mundo ajuda. É só ouvir, falar e tentar.', en: 'Over there, everybody helps. Just listen, speak, and give it a try.' }, mood: 'laugh' },
  { kind: 'lia', line: { pt: 'Olha! O sol está nascendo.', en: 'Look! The sun is coming up.' }, mood: 'wave' },
  { kind: 'think', en: 'Outside the window the sky turns gold. Somewhere down there, a whole new life is waking up.' },
  { kind: 'captain', line: { pt: 'Senhoras e senhores, aqui fala o comandante.', en: 'Ladies and gentlemen, this is your captain speaking.' } },
  { kind: 'captain', line: { pt: 'Iniciamos a descida. Apertem os cintos, por favor.', en: 'We are beginning our descent. Please fasten your seatbelts.' } },
];

const TEE = STARTER_OUTFITS[0]!.set;
const SKIRT = STARTER_OUTFITS[1]!.set;

/**
 * The passengers Lia's call can find you among, left to right along the row. Only the free choices (body, skin, face, hair, an extra)
 * and the two starter outfits, in a few colours: the same things the Visual editor offers, so picking one gives away nothing a shop sells.
 * Adjacent seats differ in body, skin and hair.
 */
export const PASSENGER_LOOKS: readonly Appearance[] = [
  { body: 'medio', skin: 1, hair: 'ondulado', hairColor: 4, face: 'suave', extra: 'sardas', idle: 'solto', ...TEE, topColor: 3 },
  { body: 'forte', skin: 6, hair: 'raspado', hairColor: 0, face: 'marcante', extra: 'barba', idle: 'solto', ...TEE, topColor: 2 },
  { body: 'esguio', skin: 3, hair: 'longo', hairColor: 2, face: 'doce', extra: 'brincos', idle: 'solto', ...SKIRT },
  { body: 'medio', skin: 4, hair: 'cacheado', hairColor: 1, face: 'suave', extra: 'nenhum', idle: 'solto', ...TEE },
  { body: 'esguio', skin: 7, hair: 'trancas', hairColor: 0, face: 'doce', extra: 'oculos', idle: 'solto', ...SKIRT, topColor: 1 },
  { body: 'forte', skin: 0, hair: 'curto', hairColor: 3, face: 'maduro', extra: 'bigode', idle: 'solto', ...TEE, topColor: 0 },
  { body: 'medio', skin: 5, hair: 'coque', hairColor: 6, face: 'marcante', extra: 'nenhum', idle: 'solto', ...SKIRT, topColor: 5 },
];

/** A random passenger look: what a new account wears until the player picks their seat on the plane (or if they skip the flight). */
export const randomPassengerLook = (r = Math.random()): Appearance => ({ ...PASSENGER_LOOKS[Math.floor(r * PASSENGER_LOOKS.length) % PASSENGER_LOOKS.length]! });

/** A line with the player's name on screen (`{nome}`) and a clip without it (`spoken`): one recording serves every player. */
export interface NamedLine extends FlightLine {
  spoken: string;
}

/** Lia walks the aisle calling the player's name, the player says which passenger they are, and she says hello. */
export const FLIGHT_CALL = {
  call: { pt: 'Com licença! {nome}? {nome}?', en: 'Excuse me! {nome}? {nome}?', spoken: 'Com licença!' },
  where: { pt: '{nome}… cadê você?', en: '{nome}… where are you?', spoken: 'Cadê você?' },
  /** The prompt over the row, in the player's head (not Lia's: she doesn't know yet). */
  pick: { pt: 'Qual é você?', en: 'Which one is you? Click your seat.' },
  /** What the player answers from the seat they picked. */
  me: { pt: 'Sou eu!', en: 'It’s me!' },
  met: { pt: 'Ah, é você! Muito prazer!', en: 'Oh, it’s you! Nice to meet you!' },
} as const satisfies Record<string, FlightLine | NamedLine>;

/** A named line with the player's name filled in (or dropped, when there is none). */
export const withName = (text: string, name: string): string =>
  name.trim() ? text.replace(/\{nome\}/g, name.trim()) : text.replace(/\s*\{nome\}[?…,]*/g, '').trim();

/** Lia asks for the seatbelt; the player clicks it shut. */
export const FLIGHT_SEATBELT = {
  ask: { pt: 'Aperte o cinto, por favor!', en: 'Fasten your seatbelt, please!' },
  button: { pt: 'Apertar o cinto', en: 'Fasten seatbelt' },
  done: { pt: 'Perfeito! A gente se vê lá embaixo.', en: 'Perfect! See you down there.' },
} as const;

/** The landing's title card. */
export const FLIGHT_TITLE = { big: 'BRASIL', pt: 'Dia 1', en: 'Day 1' } as const;

/** The letter's greeting with the player's name. */
export const letterGreeting = (name: string): string => (name.trim() ? JULIA_LETTER.greeting.replace('{name}', name.trim()) : 'Oi!');

/** Every Portuguese line said aloud in the cutscene, for `pnpm tts` (collectSpokenLines). */
export function flightSpokenLines(): { speaker: 'comissaria' | 'comandante'; text: string }[] {
  const out: { speaker: 'comissaria' | 'comandante'; text: string }[] = [];
  out.push({ speaker: 'comissaria', text: FLIGHT_CALL.call.spoken }, { speaker: 'comissaria', text: FLIGHT_CALL.where.spoken }, { speaker: 'comissaria', text: FLIGHT_CALL.met.pt });
  for (const b of FLIGHT_CABIN) {
    if (b.kind === 'lia' || b.kind === 'ask') out.push({ speaker: 'comissaria', text: b.line.pt });
    if (b.kind === 'ask') for (const r of b.replies) out.push({ speaker: 'comissaria', text: r.react.pt });
    if (b.kind === 'captain') out.push({ speaker: 'comandante', text: b.line.pt });
  }
  out.push({ speaker: 'comissaria', text: FLIGHT_SEATBELT.ask.pt }, { speaker: 'comissaria', text: FLIGHT_SEATBELT.done.pt });
  const seen = new Set<string>();
  return out.filter((l) => (seen.has(`${l.speaker}|${l.text}`) ? false : (seen.add(`${l.speaker}|${l.text}`), true)));
}
