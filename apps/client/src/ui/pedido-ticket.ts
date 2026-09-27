import type { Bilingual } from '@tudobem/shared';
import { normalizeAnswer } from '@tudobem/shared';

export interface TicketLine {
  kind: 'food' | 'drink' | 'where' | 'pay';
  pt: string;
  en: string;
}

function includesNorm(haystack: string, needle: string): boolean {
  return normalizeAnswer(haystack).includes(normalizeAnswer(needle));
}

/** Map a chip or typed reply onto receipt slots (accents optional, same rules as accept-list). */
export function ticketLinesFromSaid(said?: Bilingual): TicketLine[] {
  const lines: TicketLine[] = [];
  const saidPt = said?.pt ?? '';

  if (includesNorm(saidPt, 'pão na chapa')) lines.push({ kind: 'food', pt: 'Pão na chapa', en: 'Grilled bread' });
  else if (includesNorm(saidPt, 'coxinha')) lines.push({ kind: 'food', pt: 'Coxinha', en: 'Coxinha' });
  else if (includesNorm(saidPt, 'pastel')) lines.push({ kind: 'food', pt: 'Pastel', en: 'Pastel' });

  if (includesNorm(saidPt, 'café com leite')) lines.push({ kind: 'drink', pt: 'Café com leite', en: 'Coffee w/ milk' });
  else if (includesNorm(saidPt, 'suco')) lines.push({ kind: 'drink', pt: 'Suco de laranja', en: 'Orange juice' });
  else if (includesNorm(saidPt, 'água')) lines.push({ kind: 'drink', pt: 'Água', en: 'Water' });
  else if (includesNorm(saidPt, 'café')) lines.push({ kind: 'drink', pt: 'Café', en: 'Coffee' });

  if (includesNorm(saidPt, 'viagem')) lines.push({ kind: 'where', pt: 'Pra viagem', en: 'To go' });
  else if (includesNorm(saidPt, 'aqui')) lines.push({ kind: 'where', pt: 'Pra comer aqui', en: 'For here' });

  return lines;
}
