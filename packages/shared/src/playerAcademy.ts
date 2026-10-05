/**
 * Player-owned academies, slice 1: a named club off Academia do Bairro.
 * The elevator is a directory. Each academy is one instance of the empty `andar` room
 * (`andar@<id>`), the same instance pattern as a kitnet, not a new shard model.
 *
 * Fundar gates on the belt the account already earned (`normalizeBjj`). Wins stay the
 * source of truth. Brown (`marrom`) and black (`preta`, which has passed brown) may found.
 * The live stripe table is `BELT_LADDER` in academia.ts. Product’s 2026-10-05 table
 * (5 / 10 / 20 / 40 / 80, brown near 100 wins) is a later belt pass. This slice does not
 * add a second win counter.
 *
 * Join is a free membership flag so members wear the gi and guests do not. No dues,
 * treasury, cup scoring, or floor expansion live here.
 *
 * needs_br: true — every Portuguese string in this file is new.
 */
import type { BjjProgress, Belt } from './academia.js';
import { normalizeBjj } from './academia.js';
import { validateName } from './safety.js';
import type { Appearance, Bilingual } from './types.js';

export const CREST_IDS = ['ipe', 'sol', 'onda', 'estrela', 'coracao', 'folha'] as const;
export type CrestId = (typeof CREST_IDS)[number];
/** Logo stamp on the academy gi. Same family-friendly set as the crest. */
export type GiStampId = CrestId;

export const GI_COLOR_IDS = ['branco', 'azul', 'preto', 'vermelho', 'verde', 'amarelo'] as const;
export type GiColorId = (typeof GI_COLOR_IDS)[number];

export interface CrestDef {
  pt: string;
  en: string;
  /** Swatch used in the directory and on the nameplate mark. */
  fill: string;
  glyph: string;
}

export const CRESTS: Record<CrestId, CrestDef> = {
  ipe: { pt: 'Ipê', en: 'Ipê tree', fill: '#e07a5f', glyph: '✿' },
  sol: { pt: 'Sol', en: 'Sun', fill: '#e0ae3c', glyph: '☀' },
  onda: { pt: 'Onda', en: 'Wave', fill: '#3d5d8f', glyph: '≈' },
  estrela: { pt: 'Estrela', en: 'Star', fill: '#d4a017', glyph: '★' },
  coracao: { pt: 'Coração', en: 'Heart', fill: '#b03a46', glyph: '♥' },
  folha: { pt: 'Folha', en: 'Leaf', fill: '#3a8a5c', glyph: '♣' },
};

export interface GiColorDef {
  pt: string;
  en: string;
  /** Index into `CLOTH_COLORS` for the uniform (camisa + calça). */
  cloth: number;
  fill: string;
}

export const GI_COLORS: Record<GiColorId, GiColorDef> = {
  branco: { pt: 'Branco', en: 'White', cloth: 4, fill: '#eee6d9' },
  azul: { pt: 'Azul', en: 'Blue', cloth: 2, fill: '#3d5d8f' },
  preto: { pt: 'Preto', en: 'Black', cloth: 5, fill: '#34343c' },
  vermelho: { pt: 'Vermelho', en: 'Red', cloth: 6, fill: '#b03a46' },
  verde: { pt: 'Verde', en: 'Green', cloth: 0, fill: '#3a8a5c' },
  amarelo: { pt: 'Amarelo', en: 'Yellow', cloth: 1, fill: '#e0ae3c' },
};

/** Shown in the directory until slice 2. Beta does not charge a join fee. */
export const ACADEMY_FEES_STUB: Bilingual = { pt: 'Grátis', en: 'Free' };
/** Shown in the directory until the weekly cup exists. */
export const ACADEMY_CUP_STUB: Bilingual = { pt: 'Sem copa', en: 'No cup yet' };

export const ACADEMY_NAME_MAX = 24;
/** Phone width where the elevator stacks its rows. ~390 CSS px sits under this. */
export const ELEVATOR_STACK_WIDTH = 420;

const FOUNDER_BELTS: readonly Belt[] = ['marrom', 'preta'];

export interface PlayerAcademy {
  id: string;
  name: string;
  /** Folded name. First-come uniqueness. Never renamed here. */
  nameKey: string;
  ownerId: string;
  crest: CrestId;
  giColor: GiColorId;
  giStamp: GiStampId;
  /** Profile ids. The founder is always included. */
  members: string[];
  createdAt: number;
}

/** One directory / floor card. `member` and `owner` are about the player looking. */
export interface AcademyCard {
  id: string;
  name: string;
  crest: CrestId;
  giColor: GiColorId;
  giStamp: GiStampId;
  ownerId: string;
  ownerName: string;
  size: number;
  fees: Bilingual;
  cup: Bilingual;
  member: boolean;
  owner: boolean;
}

export interface AcademyGi {
  color: GiColorId;
  stamp: GiStampId;
}

export function isCrestId(v: unknown): v is CrestId {
  return typeof v === 'string' && (CREST_IDS as readonly string[]).includes(v);
}

export function isGiColorId(v: unknown): v is GiColorId {
  return typeof v === 'string' && (GI_COLOR_IDS as readonly string[]).includes(v);
}

/** Brown belt or further, from the wins already stored on the profile. */
export function canFoundAcademy(bjj?: Partial<BjjProgress> | null): boolean {
  return FOUNDER_BELTS.includes(normalizeBjj(bjj).belt);
}

export function academyNameKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function validateAcademyName(raw: string): { ok: true; name: string; key: string } | { ok: false; reason: Bilingual } {
  const checked = validateName(raw, ACADEMY_NAME_MAX);
  if (!checked.ok) return { ok: false, reason: checked.reason };
  return { ok: true, name: checked.name, key: academyNameKey(checked.name) };
}

export function academyInstanceId(academyId: string): string {
  return `andar@${academyId}`;
}

export function academyIdFromInstance(instanceId: string | undefined | null): string | null {
  if (!instanceId?.startsWith('andar@')) return null;
  const id = instanceId.slice('andar@'.length);
  return /^[a-f0-9]{8,32}$/.test(id) ? id : null;
}

/** Elevator directory layout. Stacked full-width actions at phone width. */
export function elevatorLayout(width: number): { stacked: boolean; actionWidth: 'full' | 'auto' } {
  const stacked = Number.isFinite(width) && width <= ELEVATOR_STACK_WIDTH;
  return { stacked, actionWidth: stacked ? 'full' : 'auto' };
}

/** Street clothes become the academy uniform. Personal belt is not part of this. */
export function academyOutfit(base: Appearance, color: GiColorId): Appearance {
  const cloth = GI_COLORS[color].cloth;
  return { ...base, top: 'camisa', topColor: cloth, bottom: 'calca', bottomColor: cloth, garb: undefined };
}

export function academyCard(a: PlayerAcademy, ownerName: string, viewerId: string): AcademyCard {
  return {
    id: a.id,
    name: a.name,
    crest: a.crest,
    giColor: a.giColor,
    giStamp: a.giStamp,
    ownerId: a.ownerId,
    ownerName: ownerName || '—',
    size: a.members.length,
    fees: ACADEMY_FEES_STUB,
    cup: ACADEMY_CUP_STUB,
    member: a.members.includes(viewerId),
    owner: a.ownerId === viewerId,
  };
}

function cleanId(v: unknown): string | null {
  return typeof v === 'string' && /^[a-f0-9]{8,32}$/.test(v) ? v : null;
}

/** Old or hand-edited rows come back coherent. Never throws. Null drops a broken row. */
export function normalizeAcademy(raw: unknown): PlayerAcademy | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PlayerAcademy>;
  const id = cleanId(r.id);
  const ownerId = cleanId(r.ownerId);
  const named = validateAcademyName(typeof r.name === 'string' ? r.name : '');
  if (!id || !ownerId || !named.ok) return null;
  if (!isCrestId(r.crest) || !isGiColorId(r.giColor) || !isCrestId(r.giStamp)) return null;
  const members: string[] = [];
  if (Array.isArray(r.members)) {
    for (const m of r.members) {
      const mid = cleanId(m);
      if (mid && !members.includes(mid)) members.push(mid);
    }
  }
  if (!members.includes(ownerId)) members.unshift(ownerId);
  const createdAt = Number.isFinite(Number(r.createdAt)) ? Math.max(0, Math.floor(Number(r.createdAt))) : 0;
  return {
    id,
    name: named.name,
    nameKey: named.key,
    ownerId,
    crest: r.crest,
    giColor: r.giColor,
    giStamp: r.giStamp,
    members,
    createdAt,
  };
}
