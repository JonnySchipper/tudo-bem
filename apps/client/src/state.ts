import type { EmoteKind, FriendInfo, NpcId, PlacedFurniture, PrivateProfile, PublicAvatar, RoomDef, RoomStateMsg, Tile } from '@tudobem/shared';
import { ROOMS } from '@tudobem/shared';

export interface Bubble {
  text: string;
  gloss: string | null;
  at: number;
}

export interface ClientAvatar {
  pub: PublicAvatar;
  from: Tile;
  path: Tile[];
  /** performance.now() when the current path started. */
  start: number;
  sitOnArrive: boolean;
  emote: { kind: EmoteKind; t0: number } | null;
  bubbles: Bubble[];
  seed: number;
}

export type PendingAction =
  | { kind: 'portal'; portalId: string; tile: Tile }
  | { kind: 'npc'; npc: NpcId; tile: Tile }
  | { kind: 'prop'; action: string; tile: Tile };

type Listener = () => void;

class Game {
  profile: PrivateProfile | null = null;
  room: RoomStateMsg | null = null;
  avatars = new Map<string, ClientAvatar>();
  furniture: PlacedFurniture[] = [];
  friends: FriendInfo[] = [];
  incoming: { id: string; name: string }[] = [];
  npcBubbles = new Map<string, Bubble>();
  pending: PendingAction | null = null;
  editMode = false;
  placing: { itemId: string; rot: 0 | 1 } | null = null;
  selectedFurniture: string | null = null;
  hoverTile: Tile | null = null;
  modalOpen = false;
  /** Solo (static) build: the world runs in this tab; no other humans. */
  solo = false;
  sound = localStorage.getItem('tb_sound') !== 'off';
  private listeners = new Map<string, Set<Listener>>();

  get roomDef(): RoomDef | null {
    return this.room ? ROOMS[this.room.room] : null;
  }

  get self(): ClientAvatar | undefined {
    return this.room ? this.avatars.get(this.room.selfId) : undefined;
  }

  get isOwnKitnet(): boolean {
    return !!this.room && !!this.profile && this.room.ownerId === this.profile.id;
  }

  on(evt: string, fn: Listener) {
    let set = this.listeners.get(evt);
    if (!set) this.listeners.set(evt, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(evt: string) {
    this.listeners.get(evt)?.forEach((fn) => fn());
  }
}

export const game = new Game();
