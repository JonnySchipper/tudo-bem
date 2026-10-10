import { describe, expect, it } from 'vitest';
import { DESEMBARQUE_EXIT, DESEMBARQUE_HOST, HOTSPOTS, ROOMS, buildGrid, isWalkable, snacksAt, wordForLine, wordForSign } from '@tudobem/shared';
import { DESEMB_STEPS, RV_EXPLAINER, desembDone, desembGateHint, desembLeft, drankWater, firstRoom, nextDesembStep } from './desembarqueLogic';

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
  it('walks every topic of the onboarding, in order, ending at the door', () => {
    expect(DESEMB_STEPS.map((s) => s.id)).toEqual(['andar', 'falar', 'diario', 'placa', 'chat', 'pegar', 'beber', 'dinheiro', 'mapa', 'fala', 'porta']);
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
    expect(nextDesembStep(desembDone({ andar: true, chat: true, falar: true, diario: true }))?.id).toBe('placa');
    const all = Object.fromEntries(DESEMB_STEPS.map((s) => [s.id, true]));
    expect(nextDesembStep(desembDone(all))).toBeNull();
  });

  it('counts the water as drunk only after it was in hand', () => {
    expect(drankWater('agua', 'copo_vazio')).toBe(true);
    expect(drankWater('agua', null)).toBe(true);
    expect(drankWater(null, 'copo_vazio')).toBe(false);
    expect(drankWater('agua', 'agua')).toBe(false);
  });

  it('sends a new account to the hall, then the airport; a returning player (no flag on the save) to neither', () => {
    expect(firstRoom({ arrivalIntroDone: false, desembarqueDone: false })).toBe('desembarque');
    expect(firstRoom({ arrivalIntroDone: false, desembarqueDone: true })).toBe('aeroporto');
    expect(firstRoom({ arrivalIntroDone: false })).toBe('aeroporto');
    expect(firstRoom({ arrivalIntroDone: true })).toBeNull();
    expect(firstRoom({})).toBeNull();
  });

  it('says RV is earned by playing, never bought', () => {
    const text = [RV_EXPLAINER.note.en, ...RV_EXPLAINER.lines.map((l) => l.en)].join(' ').toLowerCase();
    expect(text).toContain('earn');
    expect(text).toContain('never bought');
    expect(text).not.toMatch(/\bbuy rv\b|purchase|\$\d/);
  });

  it('keeps the doors to the airport shut until every step before them is done, with a short PT + EN hint naming what is left', () => {
    const none = desembGateHint(new Set());
    expect(none?.pt).toBe(`Calma! Faltam ${DESEMB_STEPS.length - 1} passos antes do aeroporto.`);
    expect(none?.en).toContain('Next: walk around.');
    const allButMap = new Set(DESEMB_STEPS.filter((s) => s.id !== 'mapa' && s.id !== 'porta').map((s) => s.id));
    expect(desembLeft(allButMap).map((s) => s.id)).toEqual(['mapa']);
    expect(desembGateHint(allButMap)).toEqual({ pt: 'Quase lá! Só falta um passo: o mapa.', en: 'Almost there! One step left before the airport: open the map.' });
    // the door itself is not something to do before the door
    expect(desembGateHint(new Set(DESEMB_STEPS.filter((s) => s.id !== 'porta').map((s) => s.id)))).toBeNull();
    for (const h of [none!, desembGateHint(allButMap)!]) expect(h.pt.length + h.en.length).toBeLessThan(160);
  });
});
