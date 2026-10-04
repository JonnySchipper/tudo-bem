/**
 * The plane arrival card and the airport hall behind it. The card is not a walkable room: Júlia speaks it once, and the hall is a
 * postcard the player can photograph and read (the camera words and signs of the Chegada area).
 * Every Portuguese string here is needs_br; the card lines are the ones already on screen, unchanged.
 */
import type { Bilingual } from './types.js';

export const ARRIVAL_CARD = {
  kicker: { pt: 'Aeroporto', en: 'Airport' },
  title: { pt: 'Você chegou ao Brasil', en: 'You made it to Brazil' },
  landed: { pt: 'O avião acabou de pousar. Júlia te espera na praça.', en: 'The plane just landed. Júlia is waiting for you in the square.' },
  camera: { pt: 'Toma a câmera e a cartela do bairro.', en: 'Here, take the camera and the neighborhood stamp card.' },
  diary: { pt: 'Fotografe o que você vê e as palavras ficam no diário.', en: 'Photograph what you see and the words stay in the diary.' },
} as const satisfies Record<string, Bilingual>;

/** Reading anchors of the arrival: the card kicker and the signs in the hall. `text` is what is painted. */
export const ARRIVAL_SIGNS: readonly { id: string; pt: string; en: string }[] = [
  { id: 'arrival.kicker', pt: ARRIVAL_CARD.kicker.pt, en: ARRIVAL_CARD.kicker.en },
  { id: 'hall_s_desembarque', pt: 'DESEMBARQUE', en: 'Arrivals' },
  { id: 'hall_s_bagagem', pt: 'BAGAGEM', en: 'Baggage' },
  { id: 'hall_s_alfandega', pt: 'ALFÂNDEGA', en: 'Customs' },
  { id: 'hall_s_embarque', pt: 'EMBARQUE', en: 'Departures' },
  { id: 'hall_s_terminal', pt: 'TERMINAL', en: 'Terminal' },
];

/** Conversation anchors of the card, all Júlia's. */
export const ARRIVAL_LINES: Record<string, Bilingual> = {
  'julia.chegada_titulo': ARRIVAL_CARD.title,
  'julia.chegada_aviao': ARRIVAL_CARD.landed,
  'julia.chegada_camera': ARRIVAL_CARD.camera,
  'julia.chegada_diario': ARRIVAL_CARD.diary,
};

export const isArrivalSign = (id: string): boolean => ARRIVAL_SIGNS.some((s) => s.id === id);
export const isHallObject = (id: string): boolean => id.startsWith('hall_') && !id.startsWith('hall_s_');
