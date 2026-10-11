import { describe, expect, it } from 'vitest';
import { DESEMBARQUE_EXIT, DESEMBARQUE_HOST, HOTSPOTS, ROOMS, buildGrid, isWalkable, snacksAt, wordForLine, wordForSign } from '@tudobem/shared';
import { DESEMB_STEPS, desembDone, firstRoom, nextDesembStep } from './desembarqueLogic';

const room = ROOMS.desembarque;

describe('the arrivals hall (desembarque)', () => {
  it('is a small room whose only door leads into the airport, next to the gate', () => {
    expect(room.cols * room.rows).toBeLessThanOrEqual(15 * 15);
    expect(room.portals).toHaveLength(1);
    const exit = room.portals[0]!;
    expect(exit.id).toBe(DESEMBARQUE_EXIT);
    expect(exit.to).toBe('aeroporto');
    expect(isWalkable(buildGrid(ROOMS.aeroporto), exit.arrive.x, exit.arrive.y)).toBe(true);
    // every way through the hall is open: spawn, the host's talking tile, the cooler, the sign's reading spot and the door
    const grid = buildGrid(room);
    const host = room.npcs.find((n) => n.id === DESEMBARQUE_HOST)!;
    for (const t of [room.spawn, host.interact, room.props.find((p) => p.id === 'desemb_bebedouro')!.interact!, { x: exit.x, y: exit.y }]) {
      expect(isWalkable(grid, t.x, t.y), `${t.x},${t.y}`).toBe(true);
    }
  });

  it('teaches its first word by the comissária, and the sign teaches another', () => {
    expect(wordForLine(`${DESEMBARQUE_HOST}.idle0`)?.pt).toBe('bem-vindo');
    expect(wordForSign('desemb_s_desembarque')?.pt).toBe('desembarque');
  });

  it('has a free cup of water to pick up', () => {
    const menu = snacksAt('desemb_bebedouro');
    expect(menu.map((s) => [s.id, s.price])).toEqual([['agua', 0]]);
  });
});

describe('the guided tutorial', () => {
  it('walks five steps, in order, ending at the door', () => {
    expect(DESEMB_STEPS.map((s) => s.id)).toEqual(['andar', 'falar', 'placa', 'chat', 'porta']);
    expect(DESEMB_STEPS.at(-1)!.guide).toMatchObject({ kind: 'portal', id: DESEMBARQUE_EXIT });
  });

  it('points every arrow at something that is in the hall, and every other step at the HUD', () => {
    for (const s of DESEMB_STEPS) {
      const g = s.guide;
      expect(s.en.length, s.id).toBeGreaterThan(3);
      expect(s.how.length, s.id).toBeGreaterThan(10);
      if (!g) {
        expect(s.hud, `${s.id} points at the HUD`).toBeTruthy();
        continue;
      }
      const there =
        g.kind === 'npc'
          ? room.npcs.some((n) => n.id === g.id)
          : g.kind === 'prop'
            ? room.props.some((p) => p.id === g.id)
            : g.kind === 'portal'
              ? room.portals.some((p) => p.id === g.id)
              : g.kind === 'hotspot'
                ? HOTSPOTS.some((h) => h.id === g.id && h.room === 'desembarque')
                : isWalkable(buildGrid(room), g.x!, g.y!);
      expect(there, `${s.id} → ${g.kind} ${g.id}`).toBe(true);
    }
  });

  it('goes one step at a time; a step done early is skipped when its turn comes', () => {
    expect(nextDesembStep(desembDone({}))?.id).toBe('andar');
    expect(nextDesembStep(desembDone({ andar: true }))?.id).toBe('falar');
    expect(nextDesembStep(desembDone({ andar: true, chat: true, falar: true }))?.id).toBe('placa');
    expect(nextDesembStep(desembDone({ andar: true, falar: true, placa: true, chat: true }))?.id).toBe('porta');
    const all = Object.fromEntries(DESEMB_STEPS.map((s) => [s.id, true]));
    expect(nextDesembStep(desembDone(all))).toBeNull();
  });

  it('sends a new account to the hall, then the airport; a returning player (no flag on the save) to neither', () => {
    expect(firstRoom({ arrivalIntroDone: false, desembarqueDone: false })).toBe('desembarque');
    expect(firstRoom({ arrivalIntroDone: false, desembarqueDone: true })).toBe('aeroporto');
    expect(firstRoom({ arrivalIntroDone: false })).toBe('aeroporto');
    expect(firstRoom({ arrivalIntroDone: true })).toBeNull();
    expect(firstRoom({})).toBeNull();
  });

  it('reads ≤150 words over its five cards', () => {
    const words = DESEMB_STEPS.flatMap((s) => `${s.en} ${s.how}`.split(/\s+/)).length;
    expect(words).toBeLessThanOrEqual(150);
  });

  it('keeps an old save’s flags for steps that are gone from counting or getting in the way', () => {
    const old = { andar: true, falar: true, diario: true, pegar: true, beber: true, dinheiro: true, mapa: true, fala: true } as Record<string, boolean>;
    expect([...desembDone(old)]).toEqual(['andar', 'falar']);
    expect(nextDesembStep(desembDone(old))?.id).toBe('placa');
  });
});
