import type { Bilingual } from './types.js';

/** Júlia's tutorial Q&A (authored, client-only chips: no rewards, so no server authority). Spoken by the 'julia' voice. */
export const JULIA_TREE: { q: Bilingual; a: Bilingual }[] = [
  { q: { pt: 'Como eu ando?', en: 'How do I walk?' }, a: { pt: 'É só clicar no chão! Pra sentar, clique num banco.', en: 'Just click the floor! To sit, click a bench.' } },
  {
    q: { pt: 'Como eu falo com as pessoas?', en: 'How do I talk to people?' },
    a: { pt: 'Escreva no chat lá embaixo e aperte Enter. O botão “Oi!” faz você acenar.', en: 'Type in the chat at the bottom and press Enter. The “Oi!” button makes you wave.' },
  },
  {
    q: { pt: 'Onde fica a padaria?', en: 'Where is the bakery?' },
    a: { pt: 'Ali, na porta com o toldo vermelho! O Seu Carlos adora conversar.', en: 'Right there — the door with the red awning! Seu Carlos loves to chat.' },
  },
  {
    q: { pt: 'Como ganho reais virtuais?', en: 'How do I earn RV coins?' },
    a: {
      pt: 'Tome café com o Seu Carlos e jogue a “Correria no Balcão” no balcão. Depois compre um chapéu com a Nanda!',
      en: 'Have breakfast with Seu Carlos and play “Correria no Balcão” (Counter Rush) at the counter. Then buy a hat from Nanda!',
    },
  },
];

/** Her opener while the box has not met her yet (the client adds the player's name on screen; it is not spoken). */
export const JULIA_INTRO: Bilingual = { pt: 'Oi, {nome}! Eu sou a Júlia, guia da praça. Posso te ajudar?', en: 'Hi! I’m Júlia, the square’s guide. Can I help you?' };
/** When the greeting already introduced her. */
export const JULIA_INTRO_FROM_GREETING: Bilingual = { pt: 'Claro! O que você quer saber?', en: 'Of course! What do you want to know?' };
