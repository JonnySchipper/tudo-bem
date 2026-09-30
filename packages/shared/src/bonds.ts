import type { Bilingual } from './types.js';
import { OFFSTAGE_NPCS, ROOMS, type NpcId } from './rooms.js';

/**
 * NPC friendship (HOWTO Phase 8 step 4). Points 0-100 per NPC; 10 points = 1 heart.
 * Pure rules only. The milestone effects (uses your name, a new Conversa subject, a furniture gift)
 * are data here and are wired by a later track.
 */
export const BOND_MAX = 100;
export const POINTS_PER_HEART = 10;

/** Points per source. A finished recado pays its own `reward.bond`. */
export const BOND_GAIN = {
  /** First talk with an NPC in a game day. */
  talk: 2,
  /** A 'pass' Conversa grade (once per NPC per game day). */
  conversaGood: 3,
} as const;

export type BondMap = Partial<Record<NpcId, number>>;

/** Every NPC that exists in a room (`ROOMS`) plus the givers that have no room yet (`OFFSTAGE_NPCS`). */
export const NPC_IDS: readonly NpcId[] = [
  ...new Set<NpcId>([...Object.values(ROOMS).flatMap((r) => r.npcs.map((n) => n.id)), ...(Object.keys(OFFSTAGE_NPCS) as NpcId[])]),
];
export const isNpcId = (v: unknown): v is NpcId => typeof v === 'string' && (NPC_IDS as readonly string[]).includes(v);

export const clampBond = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(BOND_MAX, Math.floor(n))) : 0);

/** Whole hearts for a point total (0-10). */
export const hearts = (points: number): number => Math.floor(clampBond(points) / POINTS_PER_HEART);

export type BondMilestoneKind = 'uses_name' | 'conversa_subject' | 'furniture_gift';

export interface BondMilestone {
  hearts: number;
  kind: BondMilestoneKind;
  label: Bilingual;
}

// needs_br: true (labels; listed for the native pass)
export const BOND_MILESTONES: readonly BondMilestone[] = [
  { hearts: 2, kind: 'uses_name', label: { pt: 'Usa o seu nome e lembra de você', en: 'Uses your name and remembers you' } },
  { hearts: 4, kind: 'conversa_subject', label: { pt: 'Novo assunto de Conversa', en: 'New Conversa subject' } },
  { hearts: 6, kind: 'furniture_gift', label: { pt: 'Presente pra sua kitnet', en: 'A gift for your kitnet' } },
];

/** Milestones reached going from `before` points to `after` points (empty when points did not rise past one). */
export function milestonesCrossed(before: number, after: number): BondMilestone[] {
  const a = hearts(before);
  const b = hearts(after);
  return BOND_MILESTONES.filter((m) => m.hearts > a && m.hearts <= b);
}

export interface BondChange {
  bond: BondMap;
  before: number;
  after: number;
  milestones: BondMilestone[];
}

/** Add (or remove) points for one NPC. Returns a new map; the input is never mutated. */
export function addBond(bond: BondMap, npc: NpcId, delta: number): BondChange {
  const before = clampBond(bond[npc] ?? 0);
  const after = clampBond(before + (Number.isFinite(delta) ? delta : 0));
  return { bond: { ...bond, [npc]: after }, before, after, milestones: milestonesCrossed(before, after) };
}

/** Old or hand-edited saves: keep only known NPCs with finite numbers. Never throws. */
export function normalizeBond(raw: unknown): BondMap {
  const out: BondMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const npc of NPC_IDS) {
    const v = (raw as Record<string, unknown>)[npc];
    if (typeof v === 'number' && Number.isFinite(v)) out[npc] = clampBond(v);
  }
  return out;
}
