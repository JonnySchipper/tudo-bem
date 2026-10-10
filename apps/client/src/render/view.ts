import type { HotspotDef, NpcDef, PathPos, PlacedFurniture, PortalDef, PropDef, Tile } from '@tudobem/shared';
import type { ClientAvatar } from '../state';
import type { TapCue } from './pixel/tapMark';

/** What a pointer can land on. Renderer-independent: every WorldView returns this same union. */
export type Hit =
  | { kind: 'avatar'; id: string }
  | { kind: 'npc'; npc: NpcDef }
  | { kind: 'prop'; prop: PropDef }
  | { kind: 'hotspot'; hotspot: HotspotDef }
  | { kind: 'portal'; portal: PortalDef }
  | { kind: 'seat'; tile: Tile }
  | { kind: 'furniture'; f: PlacedFurniture }
  /** A pet resting in a kitnet (#234): its owner gets the Levar / Fechar card. */
  | { kind: 'homePet'; petId: string; name: string | null }
  | { kind: 'tile'; tile: Tile };

/** A tutorial arrow pointing at a tile. */
export interface Guide {
  x: number;
  y: number;
  lift: number;
  label: string;
  /** English line under the label (a sign for learners). */
  en?: string;
  /**
   * 'play': a game's start spot (a glowing ring on the floor tile, a gold sign over the bobbing arrow);
   * 'door': a shop sign on a street door (no arrow, the plate sits just under the door).
   */
  kind?: 'play' | 'door';
  /** First visit: a "Comece aqui! · Start here!" kicker and a stronger pulse. */
  first?: boolean;
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
  /** Tap feedback (render/pixel/tapMark.ts): the ring on the tile the avatar walks to, or the refused cross on a tile or at a client point. */
  markTap?(kind: TapCue, at: { tile: Tile } | { px: number; py: number }): void;
  /** A sign's star on screen (client px, drawn size in CSS px), or null when that sign has no star in this room. */
  glintClient?(hotspotId: string): { px: number; py: number; size: number } | null;
  /** A find animation takes a sign's star over (`on`: the world stops drawing it), or gives it back. */
  claimGlint?(hotspotId: string, on: boolean): void;
  /** HUD space kept clear at the screen edges, CSS px. */
  hudInsets?(): { top: number; bottom: number; left: number; right: number };
  /** Stop drawing while a full-screen scene covers the world (the flight-in cutscene), and start again. */
  hold?(on: boolean): void;
}
