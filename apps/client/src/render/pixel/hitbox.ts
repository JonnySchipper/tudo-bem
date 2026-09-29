import type { Hit } from '../view';

export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  hit: Hit;
  depth: number;
}

export interface PickOpts {
  editMode: boolean;
  placing: boolean;
  selfId: string | null;
  /** Scripted praça neighbours. They rank below seats, matching WorldRenderer.hitTest. */
  isCpu: (id: string) => boolean;
}

/**
 * Rank used by WorldRenderer.hitTest:
 * npc and player avatar (3) over prop/portal (2) over seat/furniture (1) over a CPU avatar (0).
 * Edit mode returns the front furniture hit and ignores the rest. Placing falls through
 * so the caller can use the tile under the pointer. The local avatar is skipped.
 */
function rank(hit: Hit, isCpu: (id: string) => boolean): number {
  if (hit.kind === 'avatar' && isCpu(hit.id)) return 0;
  if (hit.kind === 'npc' || hit.kind === 'avatar') return 3;
  if (hit.kind === 'prop' || hit.kind === 'portal') return 2;
  return 1;
}

export function pickHit(boxes: readonly ScreenBox[], px: number, py: number, opts: PickOpts): Hit | null {
  const hits = boxes.filter((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
  if (opts.editMode || opts.placing) {
    if (opts.placing) return null;
    const furniture = hits.filter((h) => h.hit.kind === 'furniture').sort((a, b) => b.depth - a.depth);
    return furniture[0]?.hit ?? null;
  }
  if (!hits.length) return null;
  hits.sort((a, b) => rank(b.hit, opts.isCpu) - rank(a.hit, opts.isCpu) || b.depth - a.depth);
  const top = hits[0]?.hit;
  if (!top) return null;
  if (!(top.kind === 'avatar' && top.id === opts.selfId)) return top;
  return hits[1]?.hit ?? null;
}
