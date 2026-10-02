import { describe, expect, it } from 'vitest';
import { bakerOnDuty, npcIsOut, NPC_HOME_DOORS, sameNpcRole, scheduleAt, SCHEDULES, slotIndexAt } from './schedules.js';
import { buildGrid, isWalkable, npcDefById, ROOMS, seatTiles, type NpcId } from './rooms.js';
import { findPath } from './path.js';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, gameMinutesExact, MS_PER_GAME_MINUTE } from './clock.js';
import { legsBetween, npcNavGrid, npcPoseAt, npcPosesIn, poseWalk } from './npcMotion.js';
import { stepMatches } from './recados.js';

const at = (h: number, m = 0) => h * 60 + m;
/** A timestamp whose game clock reads `minute` (fractional ok) on day `day`. */
const msAt = (minute: number, day = 3) => day * GAME_DAY_MS + minute * MS_PER_GAME_MINUTE - CLOCK_OFFSET_MS;

describe('schedules: shape', () => {
  it('every schedule tiles the game day exactly (sorted, no gaps, no overlaps, 0..1440)', () => {
    for (const [npc, slots] of Object.entries(SCHEDULES)) {
      expect(slots![0]!.from, npc).toBe(0);
      expect(slots!.at(-1)!.to, npc).toBe(1440);
      for (let i = 0; i < slots!.length; i++) {
        const s = slots![i]!;
        expect(s.npc).toBe(npc);
        expect(s.to, `${npc} slot ${i}`).toBeGreaterThan(s.from);
        if (i) expect(s.from, `${npc} slot ${i}`).toBe(slots![i - 1]!.to);
      }
    }
  });

  it('every slot tile is a walkable tile in its room; interact tiles are walkable and next to the slot tile', () => {
    for (const slots of Object.values(SCHEDULES)) {
      for (const s of slots!) {
        if (s.activity === 'em_casa') continue;
        const g = npcNavGrid(s.room);
        expect(isWalkable(g, s.tile.x, s.tile.y), `${s.npc} ${s.from} tile`).toBe(true);
        expect(s.interact, `${s.npc} ${s.from} interact`).toBeTruthy();
        const solid = buildGrid(ROOMS[s.room]);
        expect(isWalkable(solid, s.interact!.x, s.interact!.y), `${s.npc} ${s.from} interact walkable`).toBe(true);
        expect(Math.max(Math.abs(s.interact!.x - s.tile.x), Math.abs(s.interact!.y - s.tile.y)), `${s.npc} ${s.from} interact distance`).toBeLessThanOrEqual(3); // a feira stall is 2 deep: the vendor stands behind it, customers in front
        if (s.activity === 'sentado') expect(seatTiles(ROOMS[s.room]).some((t) => t.x === s.tile.x && t.y === s.tile.y), `${s.npc} sits on a seat`).toBe(true);
      }
    }
  });

  it('a scheduled NPC has its schedule on its NpcDef; only Professora Bia has none', () => {
    for (const id of ['carlos', 'graca', 'nanda', 'julia'] as NpcId[]) expect(npcDefById(id)!.schedule, id).toBe(SCHEDULES[id]);
    expect(npcDefById('prof')!.schedule).toBeUndefined();
  });
});

describe('scheduleAt boundaries', () => {
  it('Seu Carlos: at the counter 06:00-22:00, on a praça bench 22:00-23:30, then em_casa', () => {
    expect(scheduleAt('carlos', at(5, 59))!.activity).toBe('em_casa');
    expect(scheduleAt('carlos', at(6))).toMatchObject({ room: 'padaria', activity: 'trabalhando', tile: { x: 3, y: 1 } });
    expect(scheduleAt('carlos', at(21, 59))).toMatchObject({ room: 'padaria', activity: 'trabalhando' });
    expect(scheduleAt('carlos', at(22))).toMatchObject({ room: 'praca', activity: 'sentado' });
    expect(scheduleAt('carlos', at(23, 29))!.activity).toBe('sentado');
    expect(scheduleAt('carlos', at(23, 30))!.activity).toBe('em_casa');
    expect(scheduleAt('carlos', at(0))!.activity).toBe('em_casa');
    expect(scheduleAt('carlos', 1439)!.activity).toBe('em_casa');
  });

  it('Dona Graça: the counter 22:00-06:00, em_casa by day, a padaria table 17:00-22:00', () => {
    expect(scheduleAt('graca', at(21, 59))).toMatchObject({ activity: 'sentado', room: 'padaria' });
    expect(scheduleAt('graca', at(22))).toMatchObject({ activity: 'trabalhando', tile: { x: 3, y: 1 } });
    expect(scheduleAt('graca', at(0))!.activity).toBe('trabalhando');
    expect(scheduleAt('graca', at(5, 59))!.activity).toBe('trabalhando');
    expect(scheduleAt('graca', at(6))!.activity).toBe('em_casa');
    expect(scheduleAt('graca', at(16, 59))!.activity).toBe('em_casa');
    expect(scheduleAt('graca', at(17))!.activity).toBe('sentado');
  });

  it('Nanda: at her stall 08:00-20:00, em_casa otherwise', () => {
    expect(scheduleAt('nanda', at(7, 59))!.activity).toBe('em_casa');
    expect(scheduleAt('nanda', at(8))!.activity).toBe('trabalhando');
    expect(scheduleAt('nanda', at(19, 59))!.activity).toBe('trabalhando');
    expect(scheduleAt('nanda', at(20))!.activity).toBe('em_casa');
  });

  it('Júlia is out in the rua or the praça at every minute of the day (never at home)', () => {
    for (let m = 0; m < 1440; m++) {
      const s = scheduleAt('julia', m)!;
      expect(['rua', 'praca']).toContain(s.room);
      expect(s.activity).not.toBe('em_casa');
    }
    expect(scheduleAt('julia', at(6, 59))).toMatchObject({ room: 'rua', tile: { x: 9, y: 6 } });
    expect(scheduleAt('julia', at(7))).toMatchObject({ room: 'praca', activity: 'trabalhando' });
    expect(scheduleAt('julia', at(17))).toMatchObject({ room: 'praca', activity: 'sentado', tile: { x: 12, y: 17 } });
  });

  it('slotIndexAt wraps and takes fractional minutes', () => {
    const s = SCHEDULES.carlos!;
    expect(slotIndexAt(s, 359.99)).toBe(0);
    expect(slotIndexAt(s, 360)).toBe(1);
    expect(slotIndexAt(s, 1440)).toBe(0);
    expect(slotIndexAt(s, -1)).toBe(s.length - 1);
  });

  it('scheduleAt is undefined for an NPC without a schedule, who is always out', () => {
    expect(scheduleAt('prof', 600)).toBeUndefined();
    expect(npcIsOut('prof', 0)).toBe(true);
    expect(npcIsOut('carlos', at(3))).toBe(false);
    expect(npcIsOut('carlos', at(7))).toBe(true);
  });
});

describe('D12: the padaria always has a baker', () => {
  it('exactly one of Carlos and Graça works the counter at every minute, and it is bakerOnDuty', () => {
    for (let m = 0; m < 1440; m++) {
      const onDuty = (['carlos', 'graca'] as NpcId[]).filter((n) => {
        const s = scheduleAt(n, m)!;
        return s.room === 'padaria' && s.activity === 'trabalhando';
      });
      expect(onDuty.length, `minute ${m}`).toBe(1);
      expect(bakerOnDuty(m)).toBe(onDuty[0]);
    }
    expect(bakerOnDuty(at(5, 59))).toBe('graca');
    expect(bakerOnDuty(at(6))).toBe('carlos');
    expect(bakerOnDuty(at(21, 59))).toBe('carlos');
    expect(bakerOnDuty(at(22))).toBe('graca');
  });

  it('Graça stands in for Carlos in recado steps, not the other way round', () => {
    expect(sameNpcRole('carlos', 'graca')).toBe(true);
    expect(sameNpcRole('graca', 'carlos')).toBe(false);
    expect(sameNpcRole('nanda', 'graca')).toBe(false);
    expect(stepMatches({ kind: 'pedir', npc: 'carlos', itemId: 'cafe', qty: 1 }, { kind: 'ordered', npc: 'graca', items: [{ itemId: 'cafe', qty: 1 }] })).toBe(true);
    expect(stepMatches({ kind: 'falar', npc: 'carlos' }, { kind: 'talked', npc: 'graca' })).toBe(true);
    expect(stepMatches({ kind: 'falar', npc: 'graca' }, { kind: 'talked', npc: 'carlos' })).toBe(false);
  });
});

describe('npcMotion: the timeline', () => {
  it('gameMinutesExact agrees with the test helper', () => {
    expect(gameMinutesExact(msAt(6 * 60))).toBeCloseTo(360, 6);
    expect(gameMinutesExact(msAt(1439.5))).toBeCloseTo(1439.5, 6);
  });

  it('every transition between slots has a real route (no broken legs, no instant teleports)', () => {
    for (const slots of Object.values(SCHEDULES)) {
      for (let i = 0; i < slots!.length; i++) {
        const prev = slots![(i - 1 + slots!.length) % slots!.length]!;
        for (const l of legsBetween(prev, slots![i]!)) expect(l.broken, `${prev.npc} ${prev.from}>${slots![i]!.from}`).toBe(false);
      }
    }
  });

  it('each walk is short enough to finish long before the next boundary (under 30 real seconds)', () => {
    for (const slots of Object.values(SCHEDULES)) {
      for (let i = 0; i < slots!.length; i++) {
        const prev = slots![(i - 1 + slots!.length) % slots!.length]!;
        const ms = legsBetween(prev, slots![i]!).reduce((n, l) => n + l.ms, 0);
        expect(ms, `${prev.npc} ${prev.from}>${slots![i]!.from}`).toBeLessThan(30_000);
      }
    }
  });

  it('Carlos hands the counter to Graça at 22:00 and walks to the praça bench; the padaria never stands empty of a baker', () => {
    // 05:59: Graça at the counter, Carlos at home
    expect(npcPoseAt('carlos', msAt(at(5, 59)))).toBeNull();
    expect(npcPoseAt('graca', msAt(at(5, 59)))).toMatchObject({ room: 'padaria', from: { x: 3, y: 1 }, path: [], activity: 'trabalhando' });
    // 06:00 sharp: Carlos comes in at the door and starts to walk to the counter, Graça starts walking out
    const carlos6 = npcPoseAt('carlos', msAt(at(6)))!;
    // (split into areas: he comes out of the Edifício door on the rua, walks to the padaria door, then in and to the counter)
    expect(carlos6).toMatchObject({ room: 'rua', from: { x: 12, y: 6 } });
    expect(carlos6.path.at(-1)).toEqual({ x: 4, y: 5 });
    const legsIn = legsBetween(SCHEDULES.carlos![0]!, SCHEDULES.carlos![1]!);
    expect(legsIn.map((l) => l.room)).toEqual(['rua', 'padaria']);
    expect(legsIn[1]!.from).toEqual({ x: 1, y: 6 });
    expect(legsIn[1]!.path.length).toBeGreaterThan(5);
    expect(legsIn[1]!.path.at(-1)).toEqual({ x: 3, y: 1 });
    expect(npcPoseAt('graca', msAt(at(6)))).toMatchObject({ room: 'padaria', from: { x: 3, y: 1 } });
    // a few game minutes later (each is 2 real seconds) both have finished: Carlos stands at the counter, Graça is gone
    expect(npcPoseAt('carlos', msAt(at(6, 15)))).toMatchObject({ from: { x: 3, y: 1 }, path: [], activity: 'trabalhando' });
    expect(npcPoseAt('graca', msAt(at(6, 15)))).toBeNull();
    // 21:59 Carlos works, at 22:00 he walks to the door of the padaria...
    expect(npcPoseAt('carlos', msAt(at(21, 59)))).toMatchObject({ room: 'padaria', activity: 'trabalhando', path: [] });
    expect(npcPoseAt('carlos', msAt(at(22)))).toMatchObject({ room: 'padaria', from: { x: 3, y: 1 } });
    // ...shows up on the rua at the padaria door tile, walks to the brick path, crosses into the praça and sits on the bench (three legs)
    const legs = legsBetween(SCHEDULES.carlos![1]!, SCHEDULES.carlos![2]!);
    expect(legs.map((l) => l.room)).toEqual(['padaria', 'rua', 'praca']);
    expect(legs.map((l) => l.vanish)).toEqual([true, true, false]);
    const s = npcPoseAt('carlos', msAt(at(22)) + legs[0]!.ms + 300)!;
    expect(s.room).toBe('rua');
    expect(s.from).toEqual({ x: 4, y: 6 });
    const s2 = npcPoseAt('carlos', msAt(at(22)) + legs[0]!.ms + legs[1]!.ms + 300)!;
    expect(s2.room).toBe('praca');
    expect(s2.sit).toBe(true);
    expect(npcPoseAt('carlos', msAt(at(22, 15)))).toMatchObject({ room: 'praca', from: { x: 24, y: 20 }, path: [], sit: true, activity: 'sentado' });
    expect(npcPoseAt('graca', msAt(at(22, 15)))).toMatchObject({ room: 'padaria', from: { x: 3, y: 1 }, activity: 'trabalhando' });
  });

  it('cross-room: the NPC is in exactly one room at every instant of a transition, and only vanishes at the door tile', () => {
    const t0 = msAt(at(22));
    const seen = new Set<string>();
    let last: string | null = null;
    for (let ms = 0; ms < 40_000; ms += 100) {
      const p = npcPoseAt('carlos', t0 + ms);
      const here = (['padaria', 'rua', 'praca'] as const).filter((r) => npcPosesIn(r, t0 + ms).some((q) => q.npc === 'carlos'));
      expect(here.length).toBeLessThanOrEqual(1);
      if (p) expect(p.room).toBe(here[0]);
      const room = here[0] ?? null;
      if (room) seen.add(room);
      // a hop appears at the arrival tile of the portal it took: padaria -> rua at the padaria door's sidewalk, rua -> praca on the north edge of the praça
      if (last === 'padaria' && room === 'rua') expect(p!.from).toEqual({ x: 4, y: 6 });
      if (last === 'rua' && room === 'praca') expect(p!.from.y).toBe(1);
      last = room;
    }
    expect([...seen].sort()).toEqual(['padaria', 'praca', 'rua']);
  });

  it('em_casa transitions vanish at the home door and appear at the home entry', () => {
    // Nanda 20:00: walks from her stall in the praça up to the rua and to the Edifício door (12,5), then is gone
    const n = npcPoseAt('nanda', msAt(at(20)))!;
    expect(n).toMatchObject({ room: 'praca', from: { x: 20, y: 1 } });
    const down = legsBetween(SCHEDULES.nanda![1]!, SCHEDULES.nanda![2]!);
    expect(down.map((l) => l.room)).toEqual(['praca', 'rua']);
    expect(down.at(-1)!.path.at(-1)).toEqual(NPC_HOME_DOORS.rua!.exit);
    expect(down.at(-1)!.vanish).toBe(true);
    expect(npcPoseAt('nanda', msAt(at(20, 15)))).toBeNull();
    // Nanda 08:00: appears at the Edifício entry on the rua and walks to the stall in the praça
    const m = npcPoseAt('nanda', msAt(at(8)))!;
    expect(m).toMatchObject({ room: 'rua' });
    expect(m.from).toEqual(NPC_HOME_DOORS.rua!.entry);
    const up = legsBetween(SCHEDULES.nanda![0]!, SCHEDULES.nanda![1]!);
    expect(up.map((l) => l.room)).toEqual(['rua', 'praca']);
    expect(up.at(-1)!.path.at(-1)).toEqual({ x: 20, y: 1 });
    expect(npcPoseAt('nanda', msAt(at(7, 59)))).toBeNull();
    expect(npcPoseAt('nanda', msAt(at(8, 15)))).toMatchObject({ room: 'praca', from: { x: 20, y: 1 }, path: [], activity: 'trabalhando', interact: { x: 19, y: 3 } });
  });

  it('a walk in progress resumes from any moment: the position advances with the clock and ends on the slot tile', () => {
    const t0 = msAt(at(22));
    const a = npcPoseAt('carlos', t0 + 500)!;
    const b = npcPoseAt('carlos', t0 + 2500)!;
    expect(a.legId).toBe(b.legId);
    expect(a.startMs).toBeCloseTo(t0, 0);
    const wa = poseWalk(a, t0 + 500);
    const wb = poseWalk(b, t0 + 2500);
    expect(wb.rest.length).toBeLessThan(wa.rest.length);
    expect(wa.rest.at(-1)).toEqual(a.path.at(-1));
    // a client that reconnects mid-walk gets the tile reached and the rest of the path
    expect(a.path.slice(a.path.length - wa.rest.length)).toEqual(wa.rest);
  });

  it('the padaria pose tiles are never a blocked tile of the shared nav grid, and paths never cross a blocked tile (except the counter gap)', () => {
    const g = npcNavGrid('padaria');
    const p = findPath(g, { x: 1, y: 6 }, { x: 3, y: 1 })!;
    expect(p.some((t) => t.x === 9 && t.y === 2)).toBe(true);
    for (const t of p) expect(isWalkable(g, t.x, t.y)).toBe(true);
  });

  it('a fixed NPC (Professora Bia) is in the academia at every hour, on her own tile, never walking', () => {
    for (const m of [0, at(5, 59), at(6), at(12), at(22), 1439]) {
      const p = npcPoseAt('prof', msAt(m))!;
      expect(p).toMatchObject({ room: 'academia', from: { x: 8, y: 4 }, path: [], interact: { x: 8, y: 5 } });
    }
    expect(npcPosesIn('academia', msAt(600)).map((q) => q.npc)).toEqual(['prof']);
    // her tile blocks statically (she never moves), the scheduled NPCs' tiles do not
    expect(buildGrid(ROOMS.academia).blocked.has('8,4')).toBe(true);
    expect(buildGrid(ROOMS.padaria).blocked.has('3,1')).toBe(false);
    expect(buildGrid(ROOMS.praca).blocked.has('20,1')).toBe(false);
  });

  it('at any time of day Júlia is out in the rua or the praça, and the padaria has a baker', () => {
    for (let m = 0; m < 1440; m += 7) {
      const there = new Set([...npcPosesIn('praca', msAt(m + 30)), ...npcPosesIn('rua', msAt(m + 30))].map((q) => q.npc));
      expect(there.has('julia'), `minute ${m}`).toBe(true);
      const padaria = npcPosesIn('padaria', msAt(m + 30)).map((q) => q.npc);
      expect(padaria.some((n) => n === 'carlos' || n === 'graca'), `padaria minute ${m}`).toBe(true);
    }
  });
});

describe('multi-area routes (split into areas)', () => {
  it('the feira vendors walk home -> rua -> praça -> feira before the stalls open, and back (every leg walkable, under 30 s in all)', () => {
    for (const id of ['ze', 'chico', 'rosa'] as const) {
      const slots = SCHEDULES[id]!;
      const toWork = legsBetween(slots[0]!, slots[1]!);
      expect(toWork.map((l) => l.room), id).toEqual(['rua', 'praca', 'feira']);
      expect(toWork.every((l) => !l.broken)).toBe(true);
      expect(toWork.reduce((n, l) => n + l.ms, 0)).toBeLessThan(30_000);
      const toHome = legsBetween(slots[1]!, slots[2]!);
      expect(toHome.map((l) => l.room), id).toEqual(['feira', 'praca', 'rua']);
      expect(toHome.at(-1)!.vanish).toBe(true);
    }
    // Tia Lu closes the stall at 13:00 and walks to the praça bench (feira -> praça, two legs)
    const tia = SCHEDULES.tia_lu!;
    expect(legsBetween(tia[1]!, tia[2]!).map((l) => l.room)).toEqual(['feira', 'praca']);
  });

  it('an edge hop takes the portal tile nearest to where the NPC is (the opening is several tiles wide)', () => {
    const legs = legsBetween(SCHEDULES.carlos![1]!, SCHEDULES.carlos![2]!);
    const edgeTile = legs[1]!.path.at(-1)!;
    expect(ROOMS.rua.portals.some((p) => p.edge && p.to === 'praca' && p.x === edgeTile.x && p.y === edgeTile.y)).toBe(true);
  });
});
