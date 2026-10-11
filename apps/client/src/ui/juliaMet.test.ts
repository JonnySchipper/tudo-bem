import { beforeAll, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

describe('Júlia met flag on a profile', () => {
  let game: typeof import('../state').game;
  let profileMetJulia: typeof import('./juliaMet').profileMetJulia;
  let rememberJuliaMet: typeof import('./juliaMet').rememberJuliaMet;

  beforeAll(async () => {
    game = (await import('../state')).game;
    ({ profileMetJulia, rememberJuliaMet } = await import('./juliaMet'));
  });

  it('remembers the first meeting for that profile id, and also trusts saved bond', () => {
    mem.clear();
    game.profile = { id: 'ana', bond: {} } as typeof game.profile;
    expect(profileMetJulia()).toBe(false);
    rememberJuliaMet();
    expect(profileMetJulia()).toBe(true);

    mem.clear();
    game.profile = { id: 'bia', bond: { julia: 2 } } as typeof game.profile;
    expect(profileMetJulia()).toBe(true);

    game.profile = { id: 'bia', bond: {} } as typeof game.profile;
    expect(profileMetJulia()).toBe(false);
  });
});

describe('metJulia: a profile plainly past her', () => {
  let metJulia: typeof import('./juliaMet').metJulia;
  beforeAll(async () => {
    ({ metJulia } = await import('./juliaMet'));
  });
  const vila = { desembarqueDone: true, arrivalIntroDone: true, tutorial: { carlos: false }, recadosDoneTotal: 0, bond: {} };

  it('a newcomer with no bond and no flag has not met her', () => {
    expect(metJulia(vila, false)).toBe(false);
    expect(metJulia(null, false)).toBe(false);
    expect(metJulia(vila, true)).toBe(true);
    expect(metJulia({ ...vila, bond: { julia: 1 } }, false)).toBe(true);
  });

  it('a veteran on a new browser with Júlia at 0 has (a resident, a recado ever done, or Seu Carlos done)', () => {
    expect(metJulia({ ...vila, tutorialRewarded: true }, false)).toBe(true);
    expect(metJulia({ ...vila, recadosDoneTotal: 3 }, false)).toBe(true);
    expect(metJulia({ ...vila, recadosDoneTotal: 1 }, false)).toBe(true);
    expect(metJulia({ ...vila, tutorial: { carlos: true } }, false)).toBe(true);
  });
});
