import type { PathPos, PlacedFurniture, PortalDef, PropDef, NpcDef, Tile } from '@tudobem/shared';
import type { ClientAvatar } from '../state';

export type Hit =
  | { kind: 'avatar'; id: string }
  | { kind: 'npc'; npc: NpcDef }
  | { kind: 'prop'; prop: PropDef }
  | { kind: 'portal'; portal: PortalDef }
  | { kind: 'seat'; tile: Tile }
  | { kind: 'furniture'; f: PlacedFurniture }
  | { kind: 'tile'; tile: Tile };

export interface Guide {
  x: number;
  y: number;
  lift: number;
  label: string;
}

/**
 * What main.ts needs from a world renderer. The isometric canvas and the Phaser
 * pixel view both implement this. Phaser never owns input or game truth.
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
}
