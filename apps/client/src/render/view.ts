import type { HotspotDef, NpcDef, PathPos, PlacedFurniture, PortalDef, PropDef, Tile } from '@tudobem/shared';
import type { ClientAvatar } from '../state';

/** What a pointer can land on. Renderer-independent: every WorldView returns this same union. */
export type Hit =
  | { kind: 'avatar'; id: string }
  | { kind: 'npc'; npc: NpcDef }
  | { kind: 'prop'; prop: PropDef }
  | { kind: 'hotspot'; hotspot: HotspotDef }
  | { kind: 'portal'; portal: PortalDef }
  | { kind: 'seat'; tile: Tile }
  | { kind: 'furniture'; f: PlacedFurniture }
  | { kind: 'tile'; tile: Tile };

/** A tutorial arrow pointing at a tile. */
export interface Guide {
  x: number;
  y: number;
  lift: number;
  label: string;
}

/**
 * The seam between game logic (main.ts, state.ts, ui/*) and whatever draws the world.
 * `main.ts` owns input, networking and state; a view only reads `game` and draws it.
 */
export interface WorldView {
  readonly cam: { scale: number };
  guides: Guide[];
  resize(): void;
  frame(now: number): void;
  avatarPos(a: ClientAvatar, now: number): PathPos;
  tileToClient(x: number, y: number): { px: number; py: number };
  hitTest(px: number, py: number): Hit | null;
  tileAt(px: number, py: number): Tile | null;
  /** A dialogue box opened (`npc`: the NPC's tile, null for something that is not a person) or closed (null): the camera eases one zoom step in. */
  setDialogueFocus?(f: { npc: Tile | null } | null): void;
  /** Height of the dialogue box in CSS px (the speakers are kept above it). */
  setDialogueBox?(px: number): void;
}
