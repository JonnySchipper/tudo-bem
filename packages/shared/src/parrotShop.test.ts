import { describe, expect, it } from 'vitest';
import { buyParrotColor, ownedParrotColorIds, type ParrotBuyer } from './parrotShop.js';

function owner(over: Partial<ParrotBuyer> = {}): ParrotBuyer {
  return { coins: 40, parrotOwned: false, parrotEquipped: false, parrotColors: [], parrotColor: null, ...over };
}

describe('papagaio colours', () => {
  it('buying blue keeps the green bird and grants blue', () => {
    const p = owner({ parrotOwned: true, parrotEquipped: true, parrotColor: 'verde', parrotColors: ['verde'] });
    expect(buyParrotColor(p, 'azul')).toBe('ok');
    expect(p.parrotColors).toEqual(['verde', 'azul']);
    expect(p.parrotColor).toBe('azul');
    expect(p.parrotEquipped).toBe(true);
    expect(p.coins).toBe(28);
  });

  it('keeps a green bird that was never written into the colour list', () => {
    const p = owner({ parrotOwned: true, parrotEquipped: true, parrotColor: 'verde', parrotColors: undefined });
    expect(ownedParrotColorIds(p)).toEqual(['verde']);
    expect(buyParrotColor(p, 'azul')).toBe('ok');
    expect(p.parrotColors).toEqual(['verde', 'azul']);
    expect(p.coins).toBe(28);
  });

  it('repairs a string colour list instead of throwing the green bird away', () => {
    const p = owner({ parrotOwned: true, parrotEquipped: true, parrotColor: 'verde', parrotColors: 'verde' as unknown as string[] });
    expect(buyParrotColor(p, 'azul')).toBe('ok');
    expect(p.parrotColors).toEqual(['verde', 'azul']);
  });

  it('does not wipe the green bird when the blue one cannot be paid for', () => {
    const p = owner({ coins: 5, parrotOwned: true, parrotEquipped: true, parrotColor: 'verde', parrotColors: undefined });
    expect(buyParrotColor(p, 'azul')).toBe('coins');
    expect(p.parrotColors).toBeUndefined();
    expect(p.parrotColor).toBe('verde');
    expect(p.parrotOwned).toBe(true);
    expect(p.coins).toBe(5);
    expect(ownedParrotColorIds(p)).toEqual(['verde']);
  });

  it('an empty list does not mean no birds when one is still equipped', () => {
    expect(ownedParrotColorIds({ parrotOwned: true, parrotColors: [], parrotColor: 'azul' })).toEqual(['verde', 'azul']);
    expect(ownedParrotColorIds({ parrotOwned: true, parrotColors: [], parrotColor: null })).toEqual(['verde']);
    expect(ownedParrotColorIds({ parrotOwned: true, parrotColors: ['azul'], parrotColor: 'azul' })).toEqual(['azul']);
  });

  it('buying a colour they already own equips it and does not charge or drop the others', () => {
    const p = owner({ parrotOwned: true, parrotEquipped: true, parrotColor: 'verde', parrotColors: ['verde', 'azul'] });
    expect(buyParrotColor(p, 'azul')).toBe('equipped');
    expect(p.parrotColors).toEqual(['verde', 'azul']);
    expect(p.parrotColor).toBe('azul');
    expect(p.coins).toBe(40);
  });

  it('a first blue bird does not invent a green one they never had', () => {
    const p = owner();
    expect(buyParrotColor(p, 'azul')).toBe('ok');
    expect(p.parrotColors).toEqual(['azul']);
    expect(p.parrotOwned).toBe(true);
  });
});
