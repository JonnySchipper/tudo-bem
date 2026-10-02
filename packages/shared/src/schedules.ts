/**
 * NPC daily schedules (HOWTO Phase 8 step 6, decisions D11 and D12). Pure data plus lookups; no imports of room data at run time
 * (rooms.ts imports this file to attach `NpcDef.schedule`), so the walking between slots lives in `npcMotion.ts`.
 *
 * A schedule is a list of slots that tile the game day exactly: minutes 0..1440, `from` inclusive, `to` exclusive
 * (05:59 belongs to the slot that ends at 06:00, 06:00 to the next). A slot that crosses midnight is two slots.
 * D12 (every learning activity is reachable at every hour): the padaria always has a baker at the counter (Seu Carlos 06:00-22:00,
 * Dona Graça 22:00-06:00, same scene graph, same Me vê um), Nanda's hat shop stays open from her closed stall, Júlia is always in the praça.
 */
import type { Dir, RoomId, Tile } from './types.js';
import type { NpcId } from './rooms.js';

/** What the NPC is doing. `em_casa` = not in the world (the slot's room and tile are only the door they come and go through). */
export type NpcActivity = 'trabalhando' | 'passeando' | 'sentado' | 'em_casa';

export interface ScheduleSlot {
  npc: NpcId;
  /** Game minute the slot starts (inclusive), 0..1439. */
  from: number;
  /** Game minute it ends (exclusive), 1..1440. */
  to: number;
  room: RoomId;
  tile: Tile;
  dir: Dir;
  activity: NpcActivity;
  /** Where the player stands to talk to (or hand something to) the NPC while they are in this slot. */
  interact?: Tile;
}

const at = (h: number, m = 0) => h * 60 + m;

/// Home doors: the padaria's own door, and the Edifício Ipê entrance on the Rua dos Ipês (the neighbourhood's residents live upstairs).
// Split into areas: the NPCs walk between the rua, the praça and the feira through the edge portals (`npcMotion.ts` routes them).
const HOME_PADARIA: Tile = { x: 1, y: 6 };
const HOME_RUA: Tile = { x: 12, y: 6 };

function slot(npc: NpcId, from: number, to: number, room: RoomId, tile: Tile, dir: Dir, activity: NpcActivity, interact?: Tile): ScheduleSlot {
  return { npc, from, to, room, tile, dir, activity, ...(interact ? { interact } : {}) };
}

// Standing spots. The padaria counter is the same for whoever is on duty (behind the balcão, facing the shop).
const COUNTER: Tile = { x: 3, y: 1 };
const COUNTER_INTERACT: Tile = { x: 3, y: 3 };

const CARLOS: ScheduleSlot[] = [
  slot('carlos', at(0), at(6), 'rua', HOME_RUA, 'SW', 'em_casa'),
  slot('carlos', at(6), at(22), 'padaria', COUNTER, 'SE', 'trabalhando', COUNTER_INTERACT),
  // off shift: a bench in the praça (banco_2), then home
  slot('carlos', at(22), at(23, 30), 'praca', { x: 24, y: 20 }, 'SW', 'sentado', { x: 24, y: 21 }),
  slot('carlos', at(23, 30), at(24), 'rua', HOME_RUA, 'SW', 'em_casa'),
];

const GRACA: ScheduleSlot[] = [
  slot('graca', at(0), at(6), 'padaria', COUNTER, 'SE', 'trabalhando', COUNTER_INTERACT),
  slot('graca', at(6), at(17), 'padaria', HOME_PADARIA, 'SE', 'em_casa'),
  // evening coffee at a padaria table (mesa_2, the chair on its west side)
  slot('graca', at(17), at(22), 'padaria', { x: 6, y: 6 }, 'SE', 'sentado', { x: 6, y: 5 }),
  slot('graca', at(22), at(24), 'padaria', COUNTER, 'SE', 'trabalhando', COUNTER_INTERACT),
];

const NANDA: ScheduleSlot[] = [
  slot('nanda', at(0), at(8), 'rua', HOME_RUA, 'SW', 'em_casa'),
  slot('nanda', at(8), at(20), 'praca', { x: 20, y: 1 }, 'SW', 'trabalhando', { x: 19, y: 3 }),
  slot('nanda', at(20), at(24), 'rua', HOME_RUA, 'SW', 'em_casa'),
];

const JULIA: ScheduleSlot[] = [
  // early morning by the banca on the rua (also the small hours: she is always somewhere outside)
  slot('julia', at(0), at(7), 'rua', { x: 9, y: 6 }, 'SW', 'passeando', { x: 8, y: 6 }),
  // by day on the path to the fountain
  slot('julia', at(7), at(17), 'praca', { x: 13, y: 9 }, 'SW', 'trabalhando', { x: 13, y: 10 }),
  // evening on a bench south-west of the fountain (banco_3; banco_1 by the kiosk stays free: the e2e clicks it for real)
  slot('julia', at(17), at(23), 'praca', { x: 12, y: 17 }, 'SW', 'sentado', { x: 12, y: 18 }),
  slot('julia', at(23), at(24), 'rua', { x: 9, y: 6 }, 'SW', 'passeando', { x: 8, y: 6 }),
];

// The feira vendors (Phase 9): at their stall in the Feira Livre while it is open (06:00-13:00), home otherwise. Tia Lu rests on a bench in the praça
// in the afternoon (banco_4; Carlos has banco_2 at night, Júlia banco_3 in the evening). The vendor stands in FRONT of the stall (V2: visible,
// facing the aisle), customers talk from the tile after (see `feiraStall` in rooms.ts).
const FEIRA_FROM = at(6);
const FEIRA_TO = at(13);
function vendor(npc: NpcId, tile: Tile, interact: Tile): ScheduleSlot[] {
  return [
    slot(npc, at(0), FEIRA_FROM, 'rua', HOME_RUA, 'SW', 'em_casa'),
    slot(npc, FEIRA_FROM, FEIRA_TO, 'feira', tile, 'SW', 'trabalhando', interact),
    slot(npc, FEIRA_TO, at(24), 'rua', HOME_RUA, 'SW', 'em_casa'),
  ];
}
const TIA_LU: ScheduleSlot[] = [
  slot('tia_lu', at(0), FEIRA_FROM, 'rua', HOME_RUA, 'SW', 'em_casa'),
  slot('tia_lu', FEIRA_FROM, FEIRA_TO, 'feira', { x: 7, y: 5 }, 'SW', 'trabalhando', { x: 7, y: 6 }),
  slot('tia_lu', FEIRA_TO, at(17), 'praca', { x: 18, y: 17 }, 'SW', 'sentado', { x: 18, y: 18 }),
  slot('tia_lu', at(17), at(24), 'rua', HOME_RUA, 'SW', 'em_casa'),
];
const ZE = vendor('ze', { x: 13, y: 5 }, { x: 13, y: 6 });
const CHICO = vendor('chico', { x: 7, y: 13 }, { x: 7, y: 14 });
const ROSA = vendor('rosa', { x: 13, y: 13 }, { x: 13, y: 14 });

/** Schedules by NPC. An NPC with no entry (Professora Bia) stands at its room's `x, y` at every hour. */
export const SCHEDULES: Partial<Record<NpcId, ScheduleSlot[]>> = {
  carlos: CARLOS,
  graca: GRACA,
  nanda: NANDA,
  julia: JULIA,
  tia_lu: TIA_LU,
  ze: ZE,
  chico: CHICO,
  rosa: ROSA,
};

/** Doors the NPCs walk through to and from `em_casa`, per room: `exit` is the tile they walk to and vanish at, `entry` where they appear. */
export const NPC_HOME_DOORS: Partial<Record<RoomId, { exit: Tile; entry: Tile }>> = {
  padaria: { exit: { x: 0, y: 6 }, entry: HOME_PADARIA },
  rua: { exit: { x: 12, y: 5 }, entry: HOME_RUA },
};

export const scheduleFor = (npc: NpcId): ScheduleSlot[] | undefined => SCHEDULES[npc];

/** Index of the slot that covers `minute` (0..1439 or fractional up to 1440, wrapped). */
export function slotIndexAt(slots: ScheduleSlot[], minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  const i = slots.findIndex((s) => m >= s.from && m < s.to);
  return i < 0 ? 0 : i;
}

/** What `npc` is doing at a game minute. Undefined for an NPC with no schedule. */
export function scheduleAt(npc: NpcId, minute: number): ScheduleSlot | undefined {
  const slots = SCHEDULES[npc];
  return slots ? slots[slotIndexAt(slots, minute)] : undefined;
}

/** Is `npc` out in the world at this minute? (`em_casa` = no.) NPCs without a schedule are always out. */
export function npcIsOut(npc: NpcId, minute: number): boolean {
  const s = scheduleAt(npc, minute);
  return !s || s.activity !== 'em_casa';
}

/** The padaria's baker on duty at a minute: whoever works the counter (Carlos by day, Graça at night). Never null (D12). */
export function bakerOnDuty(minute: number): NpcId {
  for (const npc of ['carlos', 'graca'] as const) {
    const s = scheduleAt(npc, minute);
    if (s && s.room === 'padaria' && s.activity === 'trabalhando') return npc;
  }
  return 'carlos';
}

/** Does an event or action aimed at `stepNpc` count when it happened with `actual`? Dona Graça stands in for Seu Carlos at the counter. */
export const sameNpcRole = (stepNpc: NpcId, actual: NpcId): boolean => stepNpc === actual || (stepNpc === 'carlos' && actual === 'graca');
