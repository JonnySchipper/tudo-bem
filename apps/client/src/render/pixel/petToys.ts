/**
 * Where a pet's toy shows (#234, docs/PET-STORE-PLAN.md §6). The toy is a small baked sprite (`fx/<toy>`, petshop.mjs) drawn next to the
 * pet, never a pose of its own: on a fetch (`busca`) it lands ahead of the owner and comes back in the dog's mouth; a cat at play
 * (`brinca`) bats its mouse in front of it; a lying pet keeps its toy between the front paws. No toy, no overlay. Pure: tested in
 * petToys.test.ts.
 */

export const TOY_FX: Record<string, string> = {
  bolinha: 'fx/bolinha',
  ratinho: 'fx/ratinho',
  ossinho: 'fx/ossinho',
  pelucia: 'fx/pelucia',
};

export interface ToyOverlay {
  key: string;
  /** World px of the toy's feet (its sprite is anchored bottom-centre). */
  x: number;
  y: number;
  /** Drawn behind the pet (a pet walking away carries it out of sight). */
  behind: boolean;
}

export interface ToyMoment {
  /** A fetch in progress (petFollow): the landing spot, and whether the dog is on the way back with it. */
  fetch?: { x: number; y: number; back: boolean } | null;
  /** Seconds of play left (a cat's `brinca`). */
  play?: number;
}

/**
 * The toy overlay of a pet at (`x`, `y`) (its feet) playing strip `pose` (`walkE`, `lieS`...), mirrored when `flip` (facing west).
 * Null when there is no toy or this pose has nowhere to show it.
 */
export function toyOverlay(toy: string | null | undefined, pose: string, flip: boolean, x: number, y: number, now: ToyMoment = {}): ToyOverlay | null {
  const key = toy ? TOY_FX[toy] : undefined;
  if (!key) return null;
  const side = flip ? -1 : 1;
  if (now.fetch) {
    // out: the toy waits where it landed; back: in the mouth
    if (!now.fetch.back) return { key, x: Math.round(now.fetch.x), y: Math.round(now.fetch.y), behind: false };
    if (pose === 'walkE') return { key, x: x + side * 9, y: y - 6, behind: false };
    if (pose === 'walkS') return { key, x, y: y - 3, behind: false };
    if (pose === 'walkN') return { key, x, y: y - 9, behind: true };
    return null;
  }
  if ((now.play ?? 0) > 0) return { key, x: x + 7, y: y + 1, behind: false };
  if (pose === 'lieS') return { key, x: x + side * 5, y: y + 1, behind: false };
  if (pose === 'lieE') return { key, x: x + side * 10, y, behind: false };
  return null;
}
