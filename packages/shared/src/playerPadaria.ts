/**
 * Player-owned padarias (Fundar): one named room off the praça door, same instance pattern as kitnet (`padaria@<id>`).
 * Gate is RV only (900 for size 1). Chef hat comes only from Fundar.
 *
 * needs_br: true — every Portuguese string in this file is new.
 */
import { validateName } from './safety.js';
import { PADARIA_OWNERSHIP_RV, PADARIA_SIZE_RV } from './padariaEconomy.js';
import { OWNED_SHELF, type OwnedShelfId } from './padariaOwnedItems.js';
import type { Bilingual } from './types.js';

/** Founder-only hat id (not sold at Nanda’s stall). Renders like the baker’s toque. */
export const PADARIA_FOUNDER_HAT = 'chapeu_padeiro_casa';

export const PADARIA_NAME_MAX = 24;

export type PadariaSize = 1 | 2 | 3;

export interface PadariaSweets {
  brigadeiro?: boolean;
  boloCenoura?: boolean;
  sonho?: boolean;
}

export interface PlayerPadaria {
  id: string;
  name: string;
  nameKey: string;
  ownerId: string;
  size: PadariaSize;
  sweets: PadariaSweets;
  /** Optional house gear (size 2+). */
  chapaDaCasa?: boolean;
  garrafaDaCasa?: boolean;
  createdAt: number;
}

/** Savings meter on the door before Fundar completes. */
export interface PadariaDoorState {
  goalRv: number;
  coins: number;
  canFundar: boolean;
  ownedId: string | null;
  ownedName: string | null;
}

export interface PadariaCard {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  size: PadariaSize;
  sweets: PadariaSweets;
  owner: boolean;
}

/** Size tier names shown on the floor bar and the door list (Jonny lock: Balcão / Padaria / Restaurante). */
export const PADARIA_SIZE_NAMES: Record<PadariaSize, Bilingual> = {
  1: { pt: 'Balcão', en: 'Counter' },
  2: { pt: 'Padaria', en: 'Bakery' },
  3: { pt: 'Restaurante', en: 'Restaurant' },
};

export type PadariaUpgradeKind = 'size2' | 'size3' | 'brigadeiro' | 'boloCenoura' | 'sonho';

export type PadariaUpgradeCheck = { ok: true; cost: number; label: Bilingual } | { ok: false; code: 'owned' | 'gate' | 'padaria'; reason: Bilingual };

const SWEET_LABELS: Record<keyof PadariaSweets, Bilingual> = {
  brigadeiro: { pt: 'Brigadeiro', en: 'Brigadeiro' },
  boloCenoura: { pt: 'Bolo de cenoura', en: 'Carrot cake' },
  sonho: { pt: 'Sonho', en: 'Sonho' },
};

/** Whether an upgrade can be bought now and what it costs. Pure: the row is not changed (coins are checked by the caller). */
export function checkPadariaUpgrade(row: PlayerPadaria, kind: PadariaUpgradeKind): PadariaUpgradeCheck {
  if (kind === 'size2') {
    if (row.size >= 2) return { ok: false, code: 'owned', reason: { pt: 'Sua padaria já passou do balcão.', en: 'Your bakery is already past the counter size.' } };
    return { ok: true, cost: upgradeSizeCostRv(2), label: PADARIA_SIZE_NAMES[2] };
  }
  if (kind === 'size3') {
    if (row.size < 2) return { ok: false, code: 'gate', reason: { pt: 'Primeiro vire Padaria (tamanho 2).', en: 'Get size 2 Padaria first.' } };
    if (row.size >= 3) return { ok: false, code: 'owned', reason: { pt: 'Você já tem o restaurante.', en: 'You already have the restaurant.' } };
    return { ok: true, cost: upgradeSizeCostRv(3), label: PADARIA_SIZE_NAMES[3] };
  }
  if (kind === 'brigadeiro' || kind === 'boloCenoura' || kind === 'sonho') {
    if (row.size < 2) return { ok: false, code: 'gate', reason: { pt: 'Doces só a partir do tamanho Padaria.', en: 'Sweets need the Padaria size.' } };
    if (!canBuySweet(row, kind)) return { ok: false, code: 'owned', reason: { pt: 'Esse doce já está na vitrine.', en: 'That sweet is already in the case.' } };
    return { ok: true, cost: sweetCostRv(kind), label: SWEET_LABELS[kind] };
  }
  return { ok: false, code: 'padaria', reason: { pt: 'Upgrade desconhecido.', en: 'Unknown upgrade.' } };
}

/** The upgrade to point an owner at next: the Padaria size, then the sweets (cheapest first), then the Restaurante. Null when all are bought. */
export function nextPadariaUpgrade(row: Pick<PlayerPadaria, 'size' | 'sweets'>): { kind: PadariaUpgradeKind; label: Bilingual; cost: number } | null {
  const order: PadariaUpgradeKind[] = ['size2', 'brigadeiro', 'boloCenoura', 'sonho', 'size3'];
  for (const kind of order) {
    const check = checkPadariaUpgrade({ ...(row as PlayerPadaria), sweets: { ...row.sweets } }, kind);
    if (check.ok) return { kind, label: check.label, cost: check.cost };
  }
  return null;
}

/** Apply an upgrade that `checkPadariaUpgrade` allowed. */
export function applyPadariaUpgrade(row: PlayerPadaria, kind: PadariaUpgradeKind) {
  if (kind === 'size2') row.size = 2;
  else if (kind === 'size3') row.size = 3;
  else row.sweets[kind] = true;
}

export function padariaNameKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function validatePadariaName(raw: string): { ok: true; name: string; key: string } | { ok: false; reason: Bilingual } {
  const checked = validateName(raw, PADARIA_NAME_MAX);
  if (!checked.ok) return { ok: false, reason: checked.reason };
  return { ok: true, name: checked.name, key: padariaNameKey(checked.name) };
}

export function padariaInstanceId(padariaId: string): string {
  return `padaria@${padariaId}`;
}

export function padariaIdFromInstance(instanceId: string | undefined | null): string | null {
  if (!instanceId?.startsWith('padaria@')) return null;
  const id = instanceId.slice('padaria@'.length);
  return /^[a-f0-9]{8,32}$/.test(id) ? id : null;
}

/** Shared Seu Carlos padaria and the outdoor door cofre (rua facade); not player-owned instances. */
export function isPadariaDoorRoom(roomId: string | undefined | null, instanceId: string | undefined | null): boolean {
  if (!roomId) return false;
  if (roomId === 'rua' || roomId === 'praca') return true;
  return roomId === 'padaria' && !padariaIdFromInstance(instanceId);
}

export function fundarCostRv(): number {
  return PADARIA_SIZE_RV.balcao;
}

export function upgradeSizeCostRv(target: 2 | 3): number {
  return target === 2 ? PADARIA_SIZE_RV.padaria : PADARIA_SIZE_RV.restaurante;
}

export function sweetCostRv(tier: 'brigadeiro' | 'boloCenoura' | 'sonho'): number {
  if (tier === 'brigadeiro') return PADARIA_OWNERSHIP_RV.tier1Brigadeiro;
  if (tier === 'boloCenoura') return PADARIA_OWNERSHIP_RV.tier2BoloCenoura;
  return PADARIA_OWNERSHIP_RV.tier3Sonho;
}

export function padariaDoorState(coins: number, owned: PlayerPadaria | null | undefined): PadariaDoorState {
  const goalRv = fundarCostRv();
  return {
    goalRv,
    coins,
    canFundar: !owned && coins >= goalRv,
    ownedId: owned?.id ?? null,
    ownedName: owned?.name ?? null,
  };
}

export function padariaCard(row: PlayerPadaria, ownerName: string, viewerId: string): PadariaCard {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    ownerName: ownerName || '—',
    size: row.size,
    sweets: { ...row.sweets },
    owner: row.ownerId === viewerId,
  };
}

/** Item ids allowed in Correria for this owned padaria (undefined = shared Seu Carlos rules). */
export function ownedCorreriaMenuIds(row: PlayerPadaria): readonly string[] | undefined {
  if (row.size === 1) return ['cafe', 'pao'];
  const ids = new Set<string>(['pao', 'pao_na_chapa', 'pastel', 'coxinha', 'bolo', 'cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua', 'pao_de_queijo', 'misto_quente', 'guarana']);
  if (row.size >= 3) {
    for (const id of OWNED_SHELF) {
      if (id === 'brigadeiro' || id === 'bolo_de_cenoura' || id === 'sonho') continue;
      ids.add(id);
    }
  }
  if (row.sweets.brigadeiro) ids.add('brigadeiro');
  if (row.sweets.boloCenoura) ids.add('bolo_de_cenoura');
  if (row.sweets.sonho) ids.add('sonho');
  return [...ids];
}

export function canBuySweet(row: PlayerPadaria, tier: keyof PadariaSweets): boolean {
  if (row.size < 2) return false;
  if (tier === 'brigadeiro') return !row.sweets.brigadeiro;
  if (tier === 'boloCenoura') return !row.sweets.boloCenoura;
  return !row.sweets.sonho;
}

const RESTAURANT: readonly OwnedShelfId[] = ['prato_feito', 'arroz_feijao', 'bife_acebolado', 'salada', 'feijoada', 'pudim'];

/** The caixa da casa's menu (works on the row or the client's card). */
export function counterMenuForOwned(row: Pick<PlayerPadaria, 'size' | 'sweets'>): string[] {
  if (row.size === 1) return ['cafe', 'pao'];
  const ids = ['coxinha', 'cafe', 'cafe_com_leite', 'pao_na_chapa', 'suco_de_laranja', 'agua', 'pao', 'misto_quente', 'pastel', 'bolo', 'pao_de_queijo', 'guarana'];
  if (row.size >= 3) ids.push(...RESTAURANT);
  if (row.sweets?.brigadeiro) ids.push('brigadeiro');
  if (row.sweets?.boloCenoura) ids.push('bolo_de_cenoura');
  if (row.sweets?.sonho) ids.push('sonho');
  return ids;
}

function cleanId(v: unknown): string | null {
  return typeof v === 'string' && /^[a-f0-9]{8,32}$/.test(v) ? v : null;
}

export function normalizePadaria(raw: unknown): PlayerPadaria | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PlayerPadaria>;
  const id = cleanId(r.id);
  const ownerId = cleanId(r.ownerId);
  const named = validatePadariaName(typeof r.name === 'string' ? r.name : '');
  const size = r.size === 2 || r.size === 3 ? r.size : 1;
  if (!id || !ownerId || !named.ok) return null;
  const sweets: PadariaSweets = {};
  if (r.sweets && typeof r.sweets === 'object') {
    const s = r.sweets as PadariaSweets;
    if (s.brigadeiro) sweets.brigadeiro = true;
    if (s.boloCenoura) sweets.boloCenoura = true;
    if (s.sonho) sweets.sonho = true;
  }
  const createdAt = Number.isFinite(Number(r.createdAt)) ? Math.max(0, Math.floor(Number(r.createdAt))) : 0;
  return {
    id,
    name: named.name,
    nameKey: named.key,
    ownerId,
    size,
    sweets,
    chapaDaCasa: !!r.chapaDaCasa,
    garrafaDaCasa: !!r.garrafaDaCasa,
    createdAt,
  };
}

/** Social rooms where the founder hat is on by default (kitnet mirror is the exception). */
export const CHEF_HAT_SOCIAL_ROOMS = new Set(['praca', 'rua', 'rua_leste', 'feira', 'padaria', 'academia', 'escola', 'praia', 'lagoa']);

export function displayFounderHat(profileHat: string | null, hasFounderHat: boolean, roomId: string | undefined, inOwnKitnet: boolean): string | null {
  if (!hasFounderHat) return profileHat;
  if (roomId === 'kitnet' && inOwnKitnet) return profileHat;
  if (roomId && CHEF_HAT_SOCIAL_ROOMS.has(roomId)) return profileHat ?? PADARIA_FOUNDER_HAT;
  return profileHat;
}
