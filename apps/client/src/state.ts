import type { BoardRow, EmoteKind, FriendInfo, NpcDef, NpcId, PlacedFurniture, PrivateProfile, PublicAvatar, RoomDef, RoomStateMsg, Tile } from '@tudobem/shared';
import { feiraCartShown, npcDefById, positionAlong, ROOMS, withoutHiddenFeiraCart } from '@tudobem/shared';
import type { RecadoBoard } from './ui/recadoView';

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
  | { kind: 'prop'; action: string; tile: Tile; propId?: string }
  /** Walk to a spot within 3 tiles of a sign, then read it. */
  | { kind: 'hotspot'; hotspotId: string; tile: Tile }
  /** Walk close to a tagged prop, then photograph it into the diary. */
  | { kind: 'photo'; anchor: string; tile: Tile };

type Listener = () => void;

class Game {
  profile: PrivateProfile | null = null;
  /** Today's recados board (offered / active / done), from the server's `recados` message. */
  board: RecadoBoard | null = null;
  room: RoomStateMsg | null = null;
  avatars = new Map<string, ClientAvatar>();
  furniture: PlacedFurniture[] = [];
  friends: FriendInfo[] = [];
  incoming: { id: string; name: string }[] = [];
  /** Dual Praça leaderboards from the server. */
  leaderboards: { words: BoardRow[]; streak: BoardRow[]; at: number } | null = null;
  npcBubbles = new Map<string, Bubble>();
  pending: PendingAction | null = null;
  /** The last Comer / Beber / Jogar fora this player pressed (performance.now()), so the scene can tell eating finger food from tossing it. */
  carryIntent: { action: 'consume' | 'toss'; at: number } | null = null;
  editMode = false;
  placing: { itemId: string; rot: 0 | 1 } | null = null;
  selectedFurniture: string | null = null;
  hoverTile: Tile | null = null;
  /** Label key under the pointer (`av:<id>` or `npc:<id>`), so a CPU nameplate can show on hover. */
  hoverKey: string | null = null;
  modalOpen = false;
  /** Júlia's camera is up: the next tagged thing you click is a photo, not a walk. */
  cameraOn = false;
  /** Diary photos (the server's `photos` message; they are not part of the profile). */
  photos: import('@tudobem/shared').DiaryPhoto[] = [];
  /** Solo (static) build: the world runs in this tab; no other humans. */
  solo = false;
  /** Live Fada da Feira (today's top Feira score). Display only; cleared at midnight ET. */
  feiraCrownId: string | null = null;
  /** Feira cart switch from the server. Null until a Feira enter or an admin broadcast. */
  feiraCart: { closed: boolean; game: import('@tudobem/shared').FeiraGameId | null } | null = null;
  /** Which Feira panel to open when the next board message arrives. */
  pendingFeiraOpen: 'cart' | 'sign' | null = null;
  sound = localStorage.getItem('tb_sound') !== 'off';
  /** Background beds. Separate from voice so Carlos can stay on while the room is quiet. */
  music = localStorage.getItem('tb_music') !== 'off';
  /**
   * English glosses under other players' Portuguese chat. The player's own setting (Ajustes), on by default; earning a nameplate colour in
   * the escola never turns it off (DECISIONS.md, "nameplate colour vs English help").
   */
  englishHelp = localStorage.getItem('tb_english') !== 'off';
  /** Admin design mode: world props can be moved. Player walking and clicks pause. */
  designMode = false;
  /** Extra camera offset (world px) while designing, so a phone can pan props out from under the panel. */
  designPan = { x: 0, y: 0 };
  /** Bumped when a room's props change so the scene and walk grid rebuild. */
  layoutEpoch = 0;
  /** Last layout pushed by the server (the design editor listens). */
  layoutNotice: { room: import('@tudobem/shared').RoomId; objects: import('@tudobem/shared').PropDef[] | null } | null = null;
  private listeners = new Map<string, Set<Listener>>();
  /** Feira with the game cart and sign removed. Stable so the scene does not rebuild every frame. */
  private hiddenFeira: RoomDef | null = null;

  /** Props changed: drop the cached Feira-without-cart view and rebuild the scene. */
  bumpLayout(): void {
    this.hiddenFeira = null;
    this.layoutEpoch++;
  }

  get roomDef(): RoomDef | null {
    if (!this.room) return null;
    const base = ROOMS[this.room.room];
    if (this.designMode) return base;
    if (base.id !== 'feira' || feiraCartShown(this.feiraCart)) return base;
    return (this.hiddenFeira ??= withoutHiddenFeiraCart(base, false));
  }

  /**
   * The neighbours in this room right now, as NpcDefs at their LIVE tile: the server walks them along their schedules (Phase 8b) and sends
   * them as avatars flagged with their NpcId. `x, y` is the tile reached at `now` (performance.now()), `interact` where to stand to talk.
   */
  liveNpcs(now: number): NpcDef[] {
    const out: NpcDef[] = [];
    for (const a of this.avatars.values()) {
      const base = a.pub.npc ? npcDefById(a.pub.npc) : undefined;
      if (!base) continue;
      const tile = positionAlong(a.from, a.path, now - a.start, a.pub.dir).tile;
      out.push({ ...base, x: tile.x, y: tile.y, interact: a.pub.npcInteract ?? base.interact });
    }
    return out;
  }

  get self(): ClientAvatar | undefined {
    return this.room ? this.avatars.get(this.room.selfId) : undefined;
  }

  get isOwnKitnet(): boolean {
    return !!this.room && this.room.room === 'kitnet' && !!this.profile && this.room.ownerId === this.profile.id;
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
