/**
 * What Dona Lúcia says in the escola. Every line is voiced (spokenLines.ts collects them for `pnpm tts`), and every line has its English for
 * the gloss under it. needs_br: true for the whole file (a Brazilian has not signed off yet).
 */
import type { Bilingual, Nameplate } from './types.js';

// needs_br: true
export const LUCIA_LINES = {
  greetEmpty: { pt: 'Seu diário ainda tá vazio. Tire fotos, leia as placas e converse com o pessoal, depois volta aqui!', en: 'Your diary is still empty. Take photos, read the signs and chat with people, then come back!' },
  greetNew: { pt: 'Oi! Bora aprender umas palavras hoje?', en: 'Hi! Shall we learn some words today?' },
  greetBack: { pt: 'Que bom te ver! Vamos manter a sequência?', en: 'Good to see you! Shall we keep the streak going?' },
  greetHot: { pt: 'Olha só, que dedicação! Sua sequência tá pegando fogo.', en: 'Look at that dedication! Your streak is on fire.' },
  greetWeek: { pt: 'Uma semana ou mais sem falhar? Tô orgulhosa de você!', en: 'A week or more without missing a day? I’m proud of you!' },
  greetLost: { pt: 'Que saudade! Vamos começar uma sequência nova?', en: 'I missed you! Shall we start a new streak?' },
  greetDone: { pt: 'Meta de hoje cumprida! Quer treinar mais um pouco?', en: 'Today’s goal is done! Want to practise a little more?' },
  wrong: { pt: 'Não foi dessa vez. Olha a resposta certa.', en: 'Not this time. Here’s the right answer.' },
  accent: { pt: 'Quase! Faltou o acento.', en: 'Almost! You missed the accent.' },
  typo: { pt: 'Quase! Cuidado com a ortografia.', en: 'Almost! Watch the spelling.' },
  combo: { pt: 'Que sequência! Continua assim.', en: 'What a run! Keep it up.' },
  retry: { pt: 'Essa voltou pra você tentar de novo.', en: 'This one is back for another try.' },
  done: { pt: 'Aula concluída! Bom trabalho.', en: 'Class finished! Good work.' },
  perfect: { pt: 'Lição perfeita! Nenhum erro.', en: 'A perfect lesson! Not a single mistake.' },
  goal: { pt: 'Meta do dia cumprida! Até amanhã?', en: 'Daily goal done! See you tomorrow?' },
} as const satisfies Record<string, Bilingual>;

// needs_br: true
export const LUCIA_RIGHT: readonly Bilingual[] = [
  { pt: 'Muito bem!', en: 'Very good!' },
  { pt: 'Isso mesmo!', en: 'That’s right!' },
  { pt: 'Perfeito!', en: 'Perfect!' },
  { pt: 'Mandou muito bem!', en: 'Nicely done!' },
  { pt: 'Arrasou!', en: 'Nailed it!' },
];

// needs_br: true
export const LUCIA_TIER_UP: Record<Exclude<Nameplate, 'verde'>, Bilingual> = {
  amarelo: { pt: 'Parabéns! Sua placa agora é amarela.', en: 'Congratulations! Your nameplate is yellow now.' },
  azul: { pt: 'Parabéns! Sua placa agora é azul.', en: 'Congratulations! Your nameplate is blue now.' },
  roxo: { pt: 'Que orgulho! Sua placa agora é roxa.', en: 'So proud of you! Your nameplate is purple now.' },
  dourado: { pt: 'Incrível! Sua placa agora é dourada.', en: 'Amazing! Your nameplate is gold now.' },
};

/** Dona Lúcia's greeting at the desk, by the streak. */
export function luciaGreeting(o: { words: number; streak: number; best: number; goalMet: boolean }): Bilingual {
  if (o.words <= 0) return LUCIA_LINES.greetEmpty;
  if (o.goalMet) return LUCIA_LINES.greetDone;
  if (o.streak >= 7) return LUCIA_LINES.greetWeek;
  if (o.streak >= 3) return LUCIA_LINES.greetHot;
  if (o.streak >= 1) return LUCIA_LINES.greetBack;
  if (o.best > 0) return LUCIA_LINES.greetLost;
  return LUCIA_LINES.greetNew;
}

/** Instructions above each exercise (on screen, not voiced). */
// needs_br: true
export const EXERCISE_TITLE: Record<'pick' | 'pick_en' | 'listen' | 'type' | 'build' | 'match', Bilingual> = {
  pick: { pt: 'Como se diz…', en: 'How do you say…' },
  pick_en: { pt: 'O que quer dizer?', en: 'What does it mean?' },
  listen: { pt: 'Escute e escolha o significado', en: 'Listen and pick the meaning' },
  type: { pt: 'Escreva em português', en: 'Write it in Portuguese' },
  build: { pt: 'Monte a frase', en: 'Build the sentence' },
  match: { pt: 'Junte os pares', en: 'Match the pairs' },
};

/** Every line Dona Lúcia says aloud, for the voice plan. */
export function luciaSpokenLines(): string[] {
  return [...Object.values(LUCIA_LINES), ...LUCIA_RIGHT, ...Object.values(LUCIA_TIER_UP)].map((l) => l.pt);
}
