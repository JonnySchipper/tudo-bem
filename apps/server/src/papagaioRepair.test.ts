import { describe, expect, it } from 'vitest';
import { normalizeProfile, type StoredProfile } from './store.js';
import { grantPapagaio, repairPapagaios } from './papagaioRepair.js';

function wiped(): StoredProfile {
  return { parrotOwned: true, parrotEquipped: false, parrotColors: [], parrotColor: null } as unknown as StoredProfile;
}

describe('Rafaella papagaio repair', () => {
  it('gives her the green bird back and the blue one she bought', () => {
    const p = wiped();
    normalizeProfile(p);
    expect(grantPapagaio(p, ['verde', 'azul'], 'azul')).toBe(true);
    expect(p.parrotColors).toEqual(['verde', 'azul']);
    expect(p.parrotOwned).toBe(true);
    expect(p.parrotColor).toBe('verde');
    expect(grantPapagaio(p, ['verde', 'azul'], 'azul')).toBe(false);
  });

  it('equips blue when the save has neither bird', () => {
    const p = { parrotOwned: false, parrotEquipped: false, parrotColors: [], parrotColor: null } as unknown as StoredProfile;
    expect(grantPapagaio(p, ['verde', 'azul'], 'azul')).toBe(true);
    expect(p.parrotColors).toEqual(['verde', 'azul']);
    expect(p.parrotColor).toBe('azul');
    expect(p.parrotEquipped).toBe(true);
  });

  it('writes the repair through the account email and leaves a worn colour alone', () => {
    const p = { id: 'p1', parrotOwned: true, parrotEquipped: true, parrotColors: ['azul'], parrotColor: 'azul' } as unknown as StoredProfile;
    let flushes = 0;
    const fixed = repairPapagaios(
      (email) => (email === 'rafaellaschipper@gmail.com' ? 'p1' : undefined),
      {
        get: (id) => (id === 'p1' ? p : undefined),
        save: () => {},
        flush: () => {
          flushes += 1;
        },
      },
    );
    expect(fixed).toEqual(['rafaellaschipper@gmail.com']);
    expect(p.parrotColors).toEqual(['azul', 'verde']);
    expect(p.parrotColor).toBe('azul');
    expect(p.parrotEquipped).toBe(true);
    expect(flushes).toBe(1);
    expect(
      repairPapagaios(
        (email) => (email === 'rafaellaschipper@gmail.com' ? 'p1' : undefined),
        {
          get: (id) => (id === 'p1' ? p : undefined),
          save: () => {},
          flush: () => {
            flushes += 1;
          },
        },
      ),
    ).toEqual([]);
    expect(flushes).toBe(1);
  });
});
