import {
  key,
  npcAvatarId,
  npcDefById,
  npcPoseAt,
  npcPosesIn,
  poseWalk,
  type NpcId,
  type NpcPose,
  type PublicAvatar,
  type RoomDef,
  type RoomGrid,
  type RoomId,
  type ServerMsg,
  type Tile,
} from '@tudobem/shared';

/** How often the world checks whether an NPC started a new walk, entered or left a room (ms). */
export const NPC_TICK_MS = 1000;

/**
 * The neighbours (Seu Carlos, Dona Graça, Nanda, Júlia, Professora Bia) as the server sees them. Their whole day is a pure function of the
 * game clock (`npcMotion.ts`), so this holds no state: it turns poses into the messages and lookups the world needs. Every instance of a
 * room shows the same NPCs at the same tiles.
 */
export class NpcDirector {
  /** `clock` returns the game-clock timestamp (real time plus any test offset). */
  constructor(private readonly clock: () => number) {}

  now() {
    return this.clock();
  }

  pose(npc: NpcId): NpcPose | null {
    return npcPoseAt(npc, this.clock());
  }

  /** Everyone standing or walking in `room` right now. */
  posesIn(room: RoomId): NpcPose[] {
    return npcPosesIn(room, this.clock());
  }

  /** The NPC as an avatar, at the tile it has reached. */
  avatar(p: NpcPose): PublicAvatar {
    const def = npcDefById(p.npc)!;
    const w = poseWalk(p, this.clock());
    const moving = w.pos.moving;
    return {
      id: npcAvatarId(p.npc),
      name: def.name,
      pronoun: 'nome',
      appearance: def.appearance,
      hat: def.hat,
      parrot: false,
      nameplate: 'verde',
      x: w.tile.x,
      y: w.tile.y,
      dir: moving ? w.pos.dir : p.dir,
      sitting: !moving && p.sit,
      npc: p.npc,
      npcInteract: p.interact,
      activity: p.activity,
    };
  }

  avatarsIn(room: RoomId): PublicAvatar[] {
    return this.posesIn(room).map((p) => this.avatar(p));
  }

  /** The walk still to do from where the NPC is now, as an `avatarMoved`; null when it is standing. */
  moved(p: NpcPose): Extract<ServerMsg, { t: 'avatarMoved' }> | null {
    const w = poseWalk(p, this.clock());
    if (!w.rest.length) return null;
    return { t: 'avatarMoved', id: npcAvatarId(p.npc), from: w.tile, path: w.rest, sit: p.sit };
  }

  /** Where `npc` is, if it is in the world: its room, the tile it has reached and where to stand to talk to it. */
  where(npc: NpcId): { room: RoomId; tile: Tile; interact: Tile; activity: NpcPose['activity'] } | null {
    const p = this.pose(npc);
    if (!p) return null;
    return { room: p.room, tile: poseWalk(p, this.clock()).tile, interact: p.interact, activity: p.activity };
  }

  /** Every NPC in `room` with its current tile (for adjacency checks and nearby-NPC lookups). */
  whoIn(room: RoomId): { id: NpcId; tile: Tile; interact: Tile; activity: NpcPose['activity'] }[] {
    return this.posesIn(room).map((p) => ({ id: p.npc, tile: poseWalk(p, this.clock()).tile, interact: p.interact, activity: p.activity }));
  }

  /** The tiles NPCs stand on now, in `room`: blocked for players (a fixed NPC's tile is also blocked statically). */
  blockedIn(room: RoomId): Tile[] {
    return this.posesIn(room).map((p) => poseWalk(p, this.clock()).tile);
  }

  /** Tiles the NPCs are standing on or heading for (CPUs stay off them). */
  reservedIn(room: RoomId): Tile[] {
    return this.posesIn(room).map((p) => p.dest);
  }

  /** `grid` plus the NPCs' current tiles as blocked. Returns the same object it was given. */
  block(room: RoomDef, grid: RoomGrid): RoomGrid {
    for (const t of this.blockedIn(room.id)) grid.blocked.add(key(t.x, t.y));
    return grid;
  }

}
