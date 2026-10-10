/**
 * The arrival. A new account lands at the airport (`ROOMS.aeroporto`) and walks the tutorial there; at the information desk Célia hands over
 * what Júlia left for them: the camera and a note. The note's lines are Júlia's (they teach the conversation words
 * of the diary's Chegada area); the airport's signs and things teach its reading and camera words like any other room's.
 * Every Portuguese string here is needs_br.
 */
import type { Bilingual } from './types.js';

export const ARRIVAL_CARD = {
  kicker: { pt: 'Aeroporto', en: 'Airport' },
  title: { pt: 'Você chegou ao Brasil', en: 'You made it to Brazil' },
  landed: { pt: 'O avião acabou de pousar. Júlia te espera na praça.', en: 'The plane just landed. Júlia is waiting for you in the square.' },
  camera: { pt: 'Toma a câmera.', en: 'Here, take the camera.' },
  diary: { pt: 'Fotografe o que você vê e as palavras ficam no diário.', en: 'Photograph what you see and the words stay in the diary.' },
} as const satisfies Record<string, Bilingual>;

/** Conversation anchors of Júlia's note. */
export const ARRIVAL_LINES: Record<string, Bilingual> = {
  'julia.chegada_titulo': ARRIVAL_CARD.title,
  'julia.chegada_aviao': ARRIVAL_CARD.landed,
  'julia.chegada_camera': ARRIVAL_CARD.camera,
  'julia.chegada_diario': ARRIVAL_CARD.diary,
};
