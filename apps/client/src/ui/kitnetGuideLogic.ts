/**
 * The kitnet first-visit guide's steps and rules, with no DOM (ui/kitnetGuide.ts draws the card and the arrows).
 *
 * The step on screen is derived from what the player can see right now (Decorar open or not, which tab, a piece in hand, a piece selected)
 * plus three things that happened during the guide (bought, placed, rotated). Closing the panel halfway just sends the guide back to
 * "open Decorar" without losing what is already done.
 * Needs_br: every Portuguese line here.
 */
import { FURNITURE, canPlaceFurniture, type PlacedFurniture, type RoomDef, type Tile } from '@tudobem/shared';

export type KitnetGuideStepId = 'abrir' | 'loja' | 'comprar' | 'meus' | 'escolher' | 'colocar' | 'girar' | 'sair';

export interface KitnetGuideStep {
  id: KitnetGuideStepId;
  /** The checklist line. */
  pt: string;
  en: string;
  /** How, under the line of the current step. */
  how: { pt: string; en: string };
}

export const KITNET_GUIDE_STEPS: readonly KitnetGuideStep[] = [
  {
    id: 'abrir',
    pt: 'Abra o Decorar',
    en: 'Open Decorar',
    how: { pt: 'Clique em Decorar, lá em cima. No celular, abra o Menu primeiro.', en: 'Click Decorar at the top. On a phone, open the Menu first.' },
  },
  {
    id: 'loja',
    pt: 'Abra o Atelier',
    en: 'Open the Atelier',
    how: { pt: 'É a aba Atelier do painel: os móveis à venda ficam lá.', en: 'It is the Atelier tab in the panel: the furniture for sale is there.' },
  },
  {
    id: 'comprar',
    pt: 'Compre um móvel',
    en: 'Buy a piece',
    how: { pt: 'Escolha um e clique nele. O preço sai dos seus RV (o saldo fica lá em cima).', en: 'Pick one and click it. The price comes out of your RV (your balance is at the top).' },
  },
  {
    id: 'meus',
    pt: 'Abra Meus móveis',
    en: 'Open My items',
    how: { pt: 'O que você compra fica guardado nessa aba.', en: 'What you buy is kept in this tab.' },
  },
  {
    id: 'escolher',
    pt: 'Pegue o móvel',
    en: 'Pick up the piece',
    how: { pt: 'Clique no móvel da lista pra segurar ele.', en: 'Click the piece in the list to hold it.' },
  },
  {
    id: 'colocar',
    pt: 'Coloque no chão',
    en: 'Put it on the floor',
    how: { pt: 'Clique num quadrado livre: verde pode, vermelho não. A tecla R gira antes de colocar.', en: 'Click a free tile: green is fine, red is not. The R key turns it before you place it.' },
  },
  {
    id: 'girar',
    pt: 'Gire o móvel',
    en: 'Rotate it',
    how: { pt: 'Clique no móvel que você colocou e depois em Girar.', en: 'Click the piece you placed, then Girar (Rotate).' },
  },
  {
    id: 'sair',
    pt: 'Saia do Decorar',
    en: 'Leave Decorar',
    how: { pt: 'Clique no ✕ do painel, ou em Decorar de novo.', en: 'Click the ✕ on the panel, or Decorar again.' },
  },
];

/** What the player can see right now. */
export interface KitnetGuideView {
  editMode: boolean;
  tab: 'meus' | 'loja';
  /** a piece in hand, waiting for a floor tile */
  placing: boolean;
}

/** What happened since the guide started. */
export interface KitnetGuideProgress {
  bought: boolean;
  placed: boolean;
  rotated: boolean;
}

export const NO_PROGRESS: KitnetGuideProgress = { bought: false, placed: false, rotated: false };

/** The step to show, or null when the guide is finished (bought, placed, rotated, and Decorar closed again). */
export function kitnetGuideStep(v: KitnetGuideView, p: KitnetGuideProgress): KitnetGuideStepId | null {
  if (!p.bought) {
    if (!v.editMode) return 'abrir';
    return v.tab === 'loja' ? 'comprar' : 'loja';
  }
  if (!p.placed) {
    if (!v.editMode) return 'abrir';
    if (v.placing) return 'colocar';
    return v.tab === 'meus' ? 'escolher' : 'meus';
  }
  if (!p.rotated) return v.editMode ? 'girar' : 'abrir';
  return v.editMode ? 'sair' : null;
}

/** The checklist ticks: a step is done once the thing it asks for has happened (or, for the early ones, a later phase has). */
export function kitnetGuideDone(v: KitnetGuideView, p: KitnetGuideProgress): Set<KitnetGuideStepId> {
  const done = new Set<KitnetGuideStepId>();
  const buy = p.bought;
  if (v.editMode || buy) done.add('abrir');
  if (buy) done.add('loja').add('comprar');
  else if (v.editMode && v.tab === 'loja') done.add('loja');
  if (p.placed) done.add('meus').add('escolher').add('colocar');
  else if (v.placing) done.add('meus').add('escolher');
  else if (buy && v.editMode && v.tab === 'meus') done.add('meus');
  if (p.rotated) done.add('girar');
  if (kitnetGuideStep(v, p) === null) done.add('sair');
  return done;
}

/** The cheapest piece the Atelier sells (what "you can't afford anything yet" is measured against). */
export const cheapestFurniture = () => FURNITURE.filter((d) => !d.earned).reduce((a, b) => (b.price < a.price ? b : a));

/** A piece to suggest on the buy step: the cheapest one the player can pay for, or null when there is none. */
export function suggestPurchase(coins: number): string | null {
  const ok = FURNITURE.filter((d) => !d.earned && d.price <= coins).sort((a, b) => a.price - b.price);
  return ok[0]?.id ?? null;
}

/** A furniture purchase between two profile snapshots: more pieces in storage for fewer RV. */
export function boughtBetween(prev: { coins: number; furniture: Record<string, number> }, next: { coins: number; furniture: Record<string, number> }): boolean {
  const sum = (f: Record<string, number>) => Object.values(f).reduce((a, n) => a + n, 0);
  return next.coins < prev.coins && sum(next.furniture) > sum(prev.furniture);
}

/** The free floor tile the arrow suggests while a piece is in hand: the valid one closest to the middle of the room, not under the player. */
export function suggestTile(room: RoomDef, furniture: readonly PlacedFurniture[], avoid: readonly Tile[]): Tile | null {
  const cx = (room.cols - 1) / 2, cy = (room.rows - 1) / 2;
  let best: Tile | null = null;
  let bestD = Infinity;
  for (let y = 0; y < room.rows; y++)
    for (let x = 0; x < room.cols; x++) {
      if (avoid.some((t) => t.x === x && t.y === y)) continue;
      if (!canPlaceFurniture(room, furniture as PlacedFurniture[], x, y)) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  return best;
}

export type PointerDir = 'down' | 'up' | 'right';

/**
 * Where the DOM arrow goes for a HUD / panel target (`rect` in CSS px): above it pointing down, unless the target hugs the top of the screen
 * (then below it, pointing up) or sits on the right half with room on its left (then beside it, pointing right). Returns the arrow tip.
 */
export function pointerFor(rect: { left: number; top: number; right: number; bottom: number }, view: { w: number; h: number }, arrowH: number): { x: number; y: number; dir: PointerDir } {
  const cx = Math.round((rect.left + rect.right) / 2);
  const cy = Math.round((rect.top + rect.bottom) / 2);
  const gap = 4;
  if (rect.top < arrowH + 16) return { x: cx, y: Math.round(rect.bottom + gap), dir: 'up' };
  if (cx > view.w / 2 && rect.left > arrowH + 16) return { x: Math.round(rect.left - gap), y: cy, dir: 'right' };
  return { x: cx, y: Math.round(rect.top - gap), dir: 'down' };
}

/** Per-profile "seen it" flag (localStorage), like the airport tutorial's. */
export const kitnetGuideKey = (profileId: string) => `tb_kitnet_guia:${profileId}`;

/** The guide starts by itself on the first visit to your own kitnet: never seen it, and the free chair is not down yet. */
export function shouldAutoStart(opts: { ownKitnet: boolean; seen: boolean; placedChair: boolean }): boolean {
  return opts.ownKitnet && !opts.seen && !opts.placedChair;
}
