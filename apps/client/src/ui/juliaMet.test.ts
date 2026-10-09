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
