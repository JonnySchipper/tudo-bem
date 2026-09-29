/**
 * Hit testing over the boxes collected while drawing a frame (HOWTO §5.4). Pure: no Phaser, no `game` state.
 *
 * Boxes are in world px. `pickHit` returns the topmost box under a world point; the caller falls back to the tile under the pointer.
 */
import type { Hit } from '../view';

export interface HitBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  hit: Hit;
  /** bottom-edge world y of whatever the box belongs to; higher draws in front */
  depth: number;
}

export interface HitOptions {
  /** the local avatar's id: clicking yourself passes through to whatever is behind you */
  selfId?: string | null;
  isCpu: (avatarId: string) => boolean;
  /** decorate mode: only furniture can be picked */
  editMode?: boolean;
  /** placing a new piece: nothing but the tile under the pointer counts */
  placing?: boolean;
}

/**
 * Priority (HOWTO §5.4): avatars, NPCs, props with an action, portals, seats, furniture. Scripted CPU neighbours rank below
 * everything (a click on one just walks there). Ties go to the box that is drawn in front (higher depth).
 */
export function hitRank(h: Hit, isCpu: (id: string) => boolean): number {
  switch (h.kind) {
    case 'avatar':
      return isCpu(h.id) ? 0 : 6;
    case 'npc':
      return 5;
    case 'prop':
      return 4;
    case 'portal':
      return 3;
    case 'seat':
      return 2;
    case 'furniture':
      return 1;
    default:
      return 0;
  }
}

export const boxContains = (b: HitBox, wx: number, wy: number) => wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1;

export function pickHit(boxes: readonly HitBox[], wx: number, wy: number, o: HitOptions): Hit | null {
  if (o.placing) return null;
  const under = boxes.filter((b) => boxContains(b, wx, wy));
  if (o.editMode) {
    const f = under.filter((b) => b.hit.kind === 'furniture').sort((a, b) => b.depth - a.depth)[0];
    return f ? f.hit : null;
  }
  if (!under.length) return null;
  under.sort((a, b) => hitRank(b.hit, o.isCpu) - hitRank(a.hit, o.isCpu) || b.depth - a.depth);
  const top = under[0].hit;
  if (!(top.kind === 'avatar' && top.id === o.selfId)) return top;
  return under[1]?.hit ?? null;
}
