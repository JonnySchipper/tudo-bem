/**
 * Birds at the Puleiro dos Pássaros: cosmetic only (like hats), paid in virtual reais.
 * The same shoulder sprite is recolored; a fuller model is not required.
 */
export interface ParrotColorDef {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Phaser tint on the green base sprite (0xffffff = unchanged). */
  tint: number;
}

export const PARROT_COLORS: ParrotColorDef[] = [
  { id: 'verde', pt: 'Verde', en: 'Green', price: 0, tint: 0xffffff },
  { id: 'azul', pt: 'Azul', en: 'Blue', price: 12, tint: 0x7eb8ff },
  { id: 'canarinho', pt: 'Canarinho', en: 'Canary', price: 15, tint: 0xffe566 },
  { id: 'vermelha', pt: 'Vermelha', en: 'Red', price: 18, tint: 0xff7070 },
  { id: 'periquito', pt: 'Periquito', en: 'Parakeet', price: 20, tint: 0xb6e84a },
];

/** Colour ids from before the puleiro rename. Owning one still owns the bird it became. */
const LEGACY_PARROT_IDS: Record<string, string> = {
  amarelo: 'canarinho',
  vermelho: 'vermelha',
  laranja: 'periquito',
};

function canonicalParrotId(id: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  const next = LEGACY_PARROT_IDS[id] ?? id;
  return PARROT_COLORS.some((c) => c.id === next) ? next : null;
}

export const parrotColorById = (id: string | null | undefined): ParrotColorDef | undefined => {
  const next = canonicalParrotId(id);
  return next ? PARROT_COLORS.find((p) => p.id === next) : undefined;
};

/**
 * Colours this profile owns, in catalog order of first appearance.
 * A parrot adopted before colours were saved is the free green one: an empty or missing list must not erase it.
 * Whatever is equipped stays owned, so a wiped list cannot leave the player with no bird.
 */
export function ownedParrotColorIds(p: { parrotOwned?: boolean; parrotColors?: unknown; parrotColor?: string | null }): string[] {
  const out: string[] = [];
  const add = (id: unknown) => {
    const next = canonicalParrotId(id);
    if (!next || out.includes(next)) return;
    out.push(next);
  };
  const raw = p.parrotColors;
  if (Array.isArray(raw)) for (const id of raw) add(id);
  else if (typeof raw === 'string') add(raw);
  if (p.parrotOwned && out.length === 0) add('verde');
  add(p.parrotColor);
  return out;
}

export interface ParrotBuyer {
  coins: number;
  parrotOwned: boolean;
  parrotEquipped: boolean;
  parrotColors?: string[];
  parrotColor?: string | null;
}

/**
 * Grant `colorId`, keeping every colour already owned.
 * Charges only for a colour they do not have yet. A failed check changes nothing.
 * `equipped` means they already owned it and it is now the one on the shoulder.
 */
export function buyParrotColor(p: ParrotBuyer, colorId: string): 'ok' | 'equipped' | 'unknown' | 'coins' {
  const color = parrotColorById(colorId);
  if (!color) return 'unknown';
  const owned = ownedParrotColorIds(p);
  if (owned.includes(color.id)) {
    p.parrotColors = owned;
    p.parrotOwned = true;
    p.parrotEquipped = true;
    p.parrotColor = color.id;
    return 'equipped';
  }
  if (p.coins < color.price) return 'coins';
  p.coins -= color.price;
  p.parrotColors = [...owned, color.id];
  p.parrotOwned = true;
  p.parrotEquipped = true;
  p.parrotColor = color.id;
  return 'ok';
}
