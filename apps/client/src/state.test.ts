import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicAvatar } from '@tudobem/shared';
import { DEFAULT_APPEARANCE } from '@tudobem/shared';
import type { ClientAvatar } from './state';

// state.ts reads localStorage when the singleton is built
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
let game: typeof import('./state').game;
beforeAll(async () => {
  game = (await import('./state')).game;
});

const avatar = (over: Partial<PublicAvatar>): ClientAvatar => ({
  pub: { id: 'x', name: 'X', pronoun: 'nome', appearance: DEFAULT_APPEARANCE, hat: null, parrot: false, nameplate: 'verde', x: 0, y: 0, dir: 'SE', sitting: false, ...over },
  from: { x: over.x ?? 0, y: over.y ?? 0 },
  path: [],
  start: 0,
  sitOnArrive: false,
  emote: null,
  bubbles: [],
  seed: 1,
});

describe('game.liveNpcs', () => {
  beforeEach(() => {
    game.avatars = new Map();
  });

  it('turns the flagged avatars into NpcDefs at their live tile, with the interact tile of their slot', () => {
    game.avatars.set('npc-julia', avatar({ id: 'npc-julia', name: 'Júlia', npc: 'julia', x: 21, y: 17, npcInteract: { x: 21, y: 18 }, activity: 'sentado' }));
    game.avatars.set('someone', avatar({ id: 'someone' }));
    game.avatars.set('cpu-1', avatar({ id: 'cpu-1', cpu: true }));
    const live = game.liveNpcs(0);
    expect(live.map((n) => n.id)).toEqual(['julia']);
    expect(live[0]).toMatchObject({ x: 21, y: 17, interact: { x: 21, y: 18 }, name: 'Júlia' });
    expect(live[0]!.idleLines.length).toBeGreaterThan(0);
  });

  it('follows the walk: the tile reached moves along the path with time', () => {
    const a = avatar({ id: 'npc-carlos', name: 'Seu Carlos', npc: 'carlos', x: 16, y: 6, npcInteract: { x: 28, y: 18 } });
    a.path = [
      { x: 17, y: 6 },
      { x: 18, y: 6 },
      { x: 19, y: 6 },
    ];
    game.avatars.set('npc-carlos', a);
    expect(game.liveNpcs(0)[0]).toMatchObject({ x: 16, y: 6 });
    expect(game.liveNpcs(300)[0]).toMatchObject({ x: 17, y: 6 });
    expect(game.liveNpcs(5000)[0]).toMatchObject({ x: 19, y: 6 });
  });
});
