import type { Bilingual } from './types.js';

/**
 * Júlia's tutorial Q&A (authored, client-only chips: no rewards, so no server authority). Spoken by the 'julia' voice.
 * `guide`: the answer also opens the Vila Ipê guide card (what there is to do). Needs_br: every PT line.
 */
export const JULIA_TREE: { q: Bilingual; a: Bilingual; guide?: true }[] = [
  {
    q: { pt: 'O que tem pra fazer aqui?', en: 'What is there to do here?' },
    a: { pt: 'Muita coisa! Dá uma olhada no guia da Vila.', en: 'Lots! Take a look at the Vila guide.' },
    guide: true,
  },
  { q: { pt: 'Como eu ando?', en: 'How do I walk?' }, a: { pt: 'É só clicar no chão! Pra sentar, clique num banco.', en: 'Just click the floor! To sit, click a bench.' } },
  {
    q: { pt: 'Como eu falo com as pessoas?', en: 'How do I talk to people?' },
    a: { pt: 'Escreva no chat lá embaixo e aperte Enter. O botão “Oi!” faz você acenar.', en: 'Type in the chat at the bottom and press Enter. The “Oi!” button makes you wave.' },
  },
  {
    q: { pt: 'Onde fica a padaria?', en: 'Where is the bakery?' },
    a: { pt: 'Na Rua dos Ipês, logo acima da praça! É a porta com o toldo vermelho.', en: 'On Rua dos Ipês, just north of the square! The door with the red awning.' },
  },
  {
    q: { pt: 'Como ganho reais virtuais?', en: 'How do I earn RV coins?' },
    a: {
      pt: 'Faça uns recados pros vizinhos e jogue a “Correria no Balcão” na padaria. Depois compre um chapéu com a Nanda!',
      en: 'Do errands (recados) for the neighbours and play “Correria no Balcão” (Counter Rush) at the bakery. Then buy a hat from Nanda!',
    },
  },
];

/** Her opener while the box has not met her yet (the client adds the player's name on screen; it is not spoken). */
export const JULIA_INTRO: Bilingual = { pt: 'Oi, {nome}! Eu sou a Júlia, guia da praça. Posso te ajudar?', en: 'Hi! I’m Júlia, the square’s guide. Can I help you?' };
/** When the greeting already introduced her. Already voiced, so a return visit can reuse it. */
export const JULIA_INTRO_FROM_GREETING: Bilingual = { pt: 'Claro! O que você quer saber?', en: 'Of course! What do you want to know?' };

/** Browser key for “this profile has already heard Júlia introduce herself.” */
export const juliaMetKey = (profileId: string): string => `tb_julia_met:${profileId}`;

/**
 * True after the first meeting on a profile.
 * `bond` is the friendship points already saved (the first talk still has 0 when the line is chosen).
 * `remembered` is the same profile's browser flag, set when that intro was shown.
 */
export function juliaAlreadyMet(input?: { bond?: number; remembered?: boolean } | number): boolean {
  if (typeof input === 'number') return input > 0;
  return input?.remembered === true || (input?.bond ?? 0) > 0;
}

/** Help-menu opener. After the first meeting, reuse the voiced follow-up instead of “Eu sou a Júlia”. */
export function juliaHelpOpener(alreadyMet: boolean): Bilingual {
  return alreadyMet ? JULIA_INTRO_FROM_GREETING : JULIA_INTRO;
}
