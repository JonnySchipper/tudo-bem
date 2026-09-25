/**
 * Praça ambiance CPUs + daily kiosk (TB Live Ops, “Praça Central spawn vitality — Phase 0”).
 *
 * CPUs are scripted scenery: they sit, walk a short loop and wave. They never chat, never enter
 * the Padaria or a Kitnet, and never count against the 16-seat player cap (TB Product lock).
 */
import namePack from '../../../content/curriculum/phase0/cpu-names.json';
import type { Bilingual, Tile } from './types.js';

/** Curriculum allowlist (cpu-name-allowlist.md → cpu-names.json): first names only. */
export const CPU_NAMES: readonly string[] = namePack.names;

export const CPU_ID_PREFIX = 'cpu-';
export const isCpuId = (id: string) => id.startsWith(CPU_ID_PREFIX);

/** Visible CPUs for a Praça instance with `humans` players in it (Live Ops §1 targets). */
export function cpuTarget(humans: number): number {
  if (humans <= 1) return 5; // 0–1 humans → 4–6
  if (humans === 2) return 4; // 2–4 → 3–4
  if (humans <= 4) return 3;
  if (humans <= 6) return 2; // 5–8 → 1–2
  if (humans <= 12) return 1; // 9+ → 0–1
  return 0;
}

/** Share of CPUs that idle on a bench; the rest walk the edge → Padaria door → bench loop. */
export const CPU_SITTER_SHARE = 0.6;

/** Praça tiles the CPUs use. Kept off doors, arrival tiles, spawn and every interact tile. */
export const PRACA_AMBIANCE: { spots: Tile[]; doorSpots: Tile[]; entries: Tile[] } = {
  /** Edge-of-praça places to stand for a bit. */
  spots: [
    { x: 13, y: 7 },
    { x: 13, y: 10 },
    { x: 6, y: 11 },
    { x: 10, y: 1 },
    { x: 9, y: 6 },
  ],
  /** Near the Padaria entrance (CPUs never go in). */
  doorSpots: [
    { x: 4, y: 1 },
    { x: 6, y: 1 },
    { x: 6, y: 2 },
  ],
  /** Where CPUs walk in from / out to when the crowd grows or thins. */
  entries: [
    { x: 13, y: 8 },
    { x: 8, y: 11 },
    { x: 0, y: 11 },
  ],
};

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
