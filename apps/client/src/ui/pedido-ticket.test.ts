import { describe, expect, it } from 'vitest';
import { ticketLinesFromSaid } from './pedido-ticket.js';

describe('Pedido ticket slots', () => {
  it('fills COMIDA when typed food omits accents', () => {
    const lines = ticketLinesFromSaid({ pt: 'me ve um pao na chapa', en: '' });
    expect(lines.find((l) => l.kind === 'food')).toEqual({
      kind: 'food',
      pt: 'Pão na chapa',
      en: 'Grilled bread',
    });
  });

  it('still matches canonical chip text', () => {
    const lines = ticketLinesFromSaid({ pt: 'Um pão na chapa, por favor.', en: 'Grilled bread, please.' });
    expect(lines.some((l) => l.kind === 'food')).toBe(true);
  });
});
