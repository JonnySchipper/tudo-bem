import { describe, expect, it } from 'vitest';
import { checkersOpens, placarOpens, propIsScenery } from './s3Doors';

const resident = { desembarqueDone: true, arrivalIntroDone: true, tutorial: { carlos: true }, recados: { done: ['a'] } };

describe('Placar da Vila and the checkers board open at S3 only', () => {
  it('stay plain props at S0-S2', () => {
    for (const p of [undefined, null, { desembarqueDone: false }, { desembarqueDone: true, arrivalIntroDone: true }, resident]) {
      expect(placarOpens(p)).toBe(false);
      expect(checkersOpens(p)).toBe(false);
    }
  });
  it('open for a Regular', () => {
    for (const p of [{ ...resident, giOwned: true }, { ...resident, recadosDoneTotal: 3 }, { ...resident, escola: { lessons: 1 } }]) {
      expect(placarOpens(p)).toBe(true);
      expect(checkersOpens(p)).toBe(true);
    }
  });
});

describe('propIsScenery: no walk to a prop that would do nothing', () => {
  const regular = { ...resident, recadosDoneTotal: 3 };
  it('the kiosk, the Placar and the checkers board before S3; other props never', () => {
    for (const action of ['kiosk', 'leaderboard', 'checkers']) {
      expect(propIsScenery(action, resident)).toBe(true);
      expect(propIsScenery(action, null)).toBe(true);
      expect(propIsScenery(action, regular)).toBe(false);
    }
    expect(propIsScenery('shop_hats', resident)).toBe(false);
    expect(propIsScenery(undefined, resident)).toBe(false);
  });
});
