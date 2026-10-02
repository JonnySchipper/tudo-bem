/**
 * Praça / Academia ambiance CPUs + daily kiosk (TB Live Ops, spawn vitality — Phase 0).
 *
 * CPUs are scripted scenery: they sit, walk a short loop and wave. They never chat, never enter
 * the Padaria or a Kitnet, and never count against the 16-seat player cap (TB Product lock).
 */
import namePack from '../../../content/curriculum/phase0/cpu-names.json';
import { buildGrid, key, openMatTiles, type RoomDef, type RoomGrid } from './rooms.js';
import type { Bilingual, RoomId, Tile } from './types.js';

/** Curriculum allowlist (cpu-name-allowlist.md → cpu-names.json): first names only. */
export const CPU_NAMES: readonly string[] = namePack.names;

export const CPU_ID_PREFIX = 'cpu-';
export const isCpuId = (id: string) => id.startsWith(CPU_ID_PREFIX);

/** Visible CPUs for a Praça instance with `humans` players in it (Live Ops §1 targets). */
export function cpuTarget(humans: number, room: RoomId = 'academia'): number {
  if (room === 'praca') {
    // Vila Ipê is 56 x 40 tiles: more neighbours on the street, and the same rule as ever, the more humans the fewer CPUs (max 8 at 0-1 humans)
    if (humans <= 1) return 8;
    if (humans === 2) return 6;
    if (humans <= 4) return 5;
    if (humans <= 6) return 3;
    if (humans <= 8) return 2;
    if (humans <= 12) return 1;
    return 0;
  }
  if (humans <= 1) return 5; // 0–1 humans → 4–6
  if (humans === 2) return 4; // 2–4 → 3–4
  if (humans <= 4) return 3;
  if (humans <= 6) return 2; // 5–8 → 1–2
  if (humans <= 12) return 1; // 9+ → 0–1
  return 0;
}

/** Share of CPUs that idle on a bench; the rest walk the edge → Padaria door → bench loop. */
export const CPU_SITTER_SHARE = 0.6;

/** Vila Ipê tiles the CPUs use. Kept off doors, arrival tiles, spawn and every interact tile. */
export const PRACA_AMBIANCE: { spots: Tile[]; doorSpots: Tile[]; entries: Tile[]; feiraSpots?: Tile[] } = {
  /** Places to stand for a bit: sidewalks, the brick bar, the lawns' edges. */
  spots: [
    { x: 11, y: 7 },
    { x: 27, y: 13 },
    { x: 37, y: 13 },
    { x: 46, y: 7 },
    { x: 11, y: 13 },
    { x: 17, y: 22 },
    { x: 33, y: 22 },
    { x: 19, y: 25 },
    { x: 34, y: 27 },
    { x: 50, y: 9 },
    // V2: the coreto's steps, the playground's edge, the lawn by the picnic, the coconut cart, the pipoqueiro
    { x: 35, y: 21 },
    { x: 18, y: 22 },
    { x: 14, y: 22 },
    { x: 27, y: 15 },
    { x: 32, y: 28 },
  ],
  /** Near the Padaria entrance (CPUs never go in). */
  doorSpots: [
    { x: 15, y: 7 },
    { x: 14, y: 7 },
    { x: 16, y: 7 },
  ],
  /** Where CPUs walk in from / out to when the crowd grows or thins: the street ends. */
  entries: [
    { x: 2, y: 9 },
    { x: 53, y: 10 },
    { x: 2, y: 33 },
    { x: 53, y: 34 },
  ],
  /** Where the shoppers browse while the feira is open (06:00-13:00): in front of the stalls and along the aisle, never on a vendor's talking spot. */
  feiraSpots: [
    { x: 43, y: 20 },
    { x: 47, y: 20 },
    { x: 48, y: 19 },
    { x: 53, y: 20 },
    { x: 46, y: 21 },
    { x: 52, y: 22 },
    { x: 43, y: 27 },
    { x: 47, y: 26 },
    { x: 53, y: 27 },
  ],
};

/**
 * Academia do Bairro idle and wander targets. Sidelines, the fila wall, and the wood
 * in front of the benches — never the open-mat footprint. The roll queue still uses the mat.
 */
export const ACADEMIA_AMBIANCE: { spots: Tile[]; doorSpots: Tile[]; entries: Tile[] } = {
  /** Stand along the walls and the spectator floor, not on the tatame. */
  spots: [
    { x: 1, y: 3 },
    { x: 1, y: 5 },
    { x: 8, y: 3 },
    { x: 10, y: 3 },
    { x: 4, y: 6 },
  ],
  /** Near the Praça exit (CPUs never leave through it). */
  doorSpots: [
    { x: 2, y: 6 },
    { x: 1, y: 6 },
    { x: 3, y: 7 },
  ],
  entries: [
    { x: 10, y: 7 },
    { x: 10, y: 8 },
    { x: 8, y: 8 },
  ],
};

/**
 * Grid ambiance CPUs path on. The open mat is blocked so a wander between sidelines
 * does not cut across it. Player movement and the roll queue keep the normal room grid.
 */
export function ambianceNavGrid(room: RoomDef): RoomGrid {
  const grid = buildGrid(room);
  for (const t of openMatTiles(room)) grid.blocked.add(key(t.x, t.y));
  return grid;
}

export const ROOM_AMBIANCE: Partial<Record<RoomId, { spots: Tile[]; doorSpots: Tile[]; entries: Tile[]; feiraSpots?: Tile[] }>> = {
  praca: PRACA_AMBIANCE,
  academia: ACADEMIA_AMBIANCE,
};

export const ambianceRoomIds = (): RoomId[] => Object.keys(ROOM_AMBIANCE) as RoomId[];

// ---------------------------------------------------------------- daily kiosk

export type MissionStep = 'cumprimenta' | 'pede' | 'monta';

/** Set A (Social + Padaria + Minigame). Informal você register per Curriculum (Cumprimenta / Pede / Monta). */
export const MISSION_STEPS: ({ id: MissionStep } & Bilingual)[] = [
  { id: 'cumprimenta', pt: 'Cumprimenta alguém na praça', en: 'Greet someone in the plaza' },
  { id: 'pede', pt: 'Pede o café da manhã com o Seu Carlos', en: 'Order breakfast with Seu Carlos' },
  { id: 'monta', pt: 'Monte um pedido na Correria no Balcão', en: 'Fill an order in Correria no Balcão' },
];

export const MISSION_COPY = {
  header: { pt: 'Missão do dia', en: 'Daily mission' },
  cta: { pt: 'Pegar missão', en: 'Take mission' },
  done: { pt: 'Missão completa! +25 RV', en: 'Mission complete! +25 RV' },
} satisfies Record<string, Bilingual>;

export const MISSION_REWARD = 25;

export interface DailyMission {
  /** YYYY-MM-DD (server day). A new day resets the mission. */
  date: string;
  taken: boolean;
  steps: Record<MissionStep, boolean>;
  rewarded: boolean;
}

export const freshMission = (date: string): DailyMission => ({ date, taken: false, steps: { cumprimenta: false, pede: false, monta: false }, rewarded: false });
