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

/**
 * Visible CPUs for an instance with  players in it (Live Ops §1 targets). Split into areas: each outdoor area is small and calm, so
 * each gets fewer CPUs than the old 56 x 40 map's 8 (Rua 3, Praça 4, Feira 3 at 0-1 humans); the more humans the fewer CPUs.
 */
export function cpuTarget(humans: number, room: RoomId = 'academia'): number {
  if (room === 'praca' || room === 'rua' || room === 'feira') {
    const max = room === 'praca' ? 4 : 3;
    if (humans <= 1) return max;
    if (humans === 2) return max - 1;
    if (humans <= 6) return Math.max(1, max - 2);
    if (humans <= 12) return room === 'praca' ? 1 : 0;
    return 0;
  }
  if (humans <= 1) return 5; // 0–1 humans → 4–6
  if (humans === 2) return 4; // 2–4 → 3–4
  if (humans <= 4) return 3;
  if (humans <= 6) return 2; // 5–8 → 1–2
  if (humans <= 12) return 1; // 9+ → 0–1
  return 0;
}

/** Share of CPUs that idle on a bench; the rest walk the edge → door → bench loop. */
export const CPU_SITTER_SHARE = 0.6;

type AmbMap = { spots: Tile[]; doorSpots: Tile[]; entries: Tile[]; feiraSpots?: Tile[] };

/** Rua dos Ipês: the sidewalks and the lawn strip. Kept off doors, arrival tiles, spawn and every interact tile. */
export const RUA_AMBIANCE: AmbMap = {
  spots: [{ x: 13, y: 7 }, { x: 20, y: 6 }, { x: 24, y: 7 }, { x: 33, y: 6 }, { x: 30, y: 13 }, { x: 8, y: 13 }, { x: 16, y: 13 }, { x: 5, y: 13 }, { x: 37, y: 6 }],
  /** Near the Padaria entrance (CPUs never go in). */
  doorSpots: [{ x: 3, y: 7 }, { x: 4, y: 7 }, { x: 6, y: 6 }],
  /** Where CPUs walk in from / out to: the street ends, and the brick path to the praça. */
  entries: [{ x: 2, y: 9 }, { x: 37, y: 10 }, { x: 3, y: 10 }, { x: 36, y: 9 }],
};

/** Praça Central. */
export const PRACA_AMBIANCE: AmbMap = {
  spots: [{ x: 13, y: 13 }, { x: 19, y: 13 }, { x: 13, y: 6 }, { x: 17, y: 19 }, { x: 14, y: 19 }, { x: 9, y: 13 }, { x: 25, y: 13 }, { x: 8, y: 10 }, { x: 24, y: 12 }, { x: 10, y: 21 }],
  doorSpots: [{ x: 15, y: 3 }, { x: 16, y: 3 }, { x: 14, y: 4 }],
  entries: [{ x: 15, y: 1 }, { x: 16, y: 1 }, { x: 30, y: 11 }, { x: 30, y: 12 }],
};

/** Feira Livre: the aisle and the free paving; while the feira is open (06:00-13:00) the shoppers browse in front of the stalls, never on a vendor's talking spot. */
export const FEIRA_AMBIANCE: AmbMap = {
  spots: [{ x: 4, y: 9 }, { x: 15, y: 9 }, { x: 18, y: 8 }, { x: 20, y: 6 }, { x: 22, y: 14 }, { x: 19, y: 15 }, { x: 26, y: 8 }, { x: 10, y: 16 }, { x: 24, y: 15 }, { x: 3, y: 13 }],
  doorSpots: [{ x: 4, y: 8 }, { x: 3, y: 9 }, { x: 4, y: 10 }],
  entries: [{ x: 1, y: 8 }, { x: 1, y: 9 }],
  feiraSpots: [{ x: 6, y: 6 }, { x: 8, y: 6 }, { x: 12, y: 6 }, { x: 14, y: 6 }, { x: 6, y: 14 }, { x: 8, y: 14 }, { x: 12, y: 14 }, { x: 14, y: 14 }, { x: 9, y: 9 }, { x: 11, y: 9 }],
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
  rua: RUA_AMBIANCE,
  feira: FEIRA_AMBIANCE,
  academia: ACADEMIA_AMBIANCE,
};

export const ambianceRoomIds = (): RoomId[] => Object.keys(ROOM_AMBIANCE) as RoomId[];

// ---------------------------------------------------------------- daily kiosk

export type MissionStep = 'cumprimenta' | 'pede' | 'monta';

/** Set A (Social + Padaria + Minigame). Informal você register per Curriculum (Cumprimenta / Pede / Monta). */
export const MISSION_STEPS: ({ id: MissionStep } & Bilingual)[] = [
  { id: 'cumprimenta', pt: 'Cumprimenta alguém na praça', en: 'Greet someone in the plaza' },
  { id: 'pede', pt: 'Pede o café da manhã com o Seu Carlos', en: 'Order breakfast with Seu Carlos' },
  { id: 'monta', pt: 'Monta um pedido em Me vê um…', en: 'Build an order in Me vê um…' },
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
