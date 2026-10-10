import { describe, expect, it } from 'vitest';
import { CARD_MS, WordQueue, cardMs, momentsOfShot } from './diaryWordQueue';

const w = (pt: string) => ({ pt, en: pt, areaPt: 'Praça', progress: '1/98' });

describe('the new-word cards of a shot', () => {
  it('numbers the words of a shot in the order sent, and only the last card carries the print', () => {
    const print = { id: 'photo-print' };
    const cards = momentsOfShot([w('fonte'), w('moeda'), w('musgo')], print);
    expect(cards.map((c) => [c.pt, c.index, c.total])).toEqual([['fonte', 1, 3], ['moeda', 2, 3], ['musgo', 3, 3]]);
    expect(cards.map((c) => c.print)).toEqual([undefined, undefined, print]);
    expect(momentsOfShot([w('fonte')], print)[0]).toMatchObject({ index: 1, total: 1, print });
    expect(momentsOfShot([w('fonte')])[0]).not.toHaveProperty('print');
  });

  it('gives every card of a shot its print to burst out of, and none to a word that came without a photo', () => {
    const print = { id: 'photo-print' };
    expect(momentsOfShot([w('fonte'), w('moeda')], print).map((c) => c.shot)).toEqual([print, print]);
    expect(momentsOfShot([w('fonte')])[0]).not.toHaveProperty('shot');
  });

  it('hands out one card at a time, in order, and never while a card is up or a game is on', () => {
    const q = new WordQueue();
    q.push(momentsOfShot([w('fonte'), w('moeda'), w('musgo')]));
    expect(q.take(true, false)).toBeNull();
    expect(q.take(false, true)).toBeNull();
    expect(q.length).toBe(3);
    expect(q.take(false, false)?.pt).toBe('fonte');
    expect(q.take(true, false)).toBeNull();
    expect(q.take(false, false)?.pt).toBe('moeda');
    expect(q.take(false, false)?.pt).toBe('musgo');
    expect(q.take(false, false)).toBeNull();
  });

  it('keeps the words of a shot that lands while another shot is still showing, after the first one’s, dropping none', () => {
    const q = new WordQueue();
    q.push(momentsOfShot([w('fonte'), w('moeda')]));
    expect(q.take(false, false)?.pt).toBe('fonte');
    // the second shot, and a sign read right after it, arrive while the first card is up
    q.push(momentsOfShot([w('pombo'), w('musgo')]));
    q.push(momentsOfShot([w('coreto')]));
    const shown: string[] = [];
    for (let card = q.take(false, false); card; card = q.take(false, false)) shown.push(card.pt);
    expect(shown).toEqual(['moeda', 'pombo', 'musgo', 'coreto']);
  });

  it('lets the cards before the last of a shot hand over sooner', () => {
    expect(cardMs({ index: 1, total: 4 })).toBe(CARD_MS.more);
    expect(cardMs({ index: 3, total: 4 })).toBe(CARD_MS.more);
    expect(cardMs({ index: 4, total: 4 })).toBe(CARD_MS.last);
    expect(cardMs({ index: 1, total: 1 })).toBe(CARD_MS.last);
    expect(CARD_MS.more).toBeLessThan(CARD_MS.last);
    // a dozen words in one shot go by faster, and the last still lingers
    expect(cardMs({ index: 2, total: 12 })).toBe(CARD_MS.many);
    expect(cardMs({ index: 12, total: 12 })).toBe(CARD_MS.last);
    expect(CARD_MS.many).toBeLessThan(CARD_MS.more);
  });
});
