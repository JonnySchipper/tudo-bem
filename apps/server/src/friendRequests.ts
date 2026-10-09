import type { ProfileStore } from './store.js';

/** Pending requests kept per player (newest win). */
export const FRIEND_REQUESTS_MAX = 50;

/**
 * Pending friend requests, stored on the target's profile (`friendRequestsIn`, server only) so a restart or a
 * Fly auto-stop does not drop them. Requests from profiles that no longer exist are skipped on read.
 */
export class FriendRequests {
  constructor(private readonly store: ProfileStore) {}

  /** Who asked `toId` to be friends, oldest first. */
  incoming(toId: string): string[] {
    return [...(this.store.get(toId)?.friendRequestsIn ?? [])];
  }

  has(toId: string, fromId: string): boolean {
    return this.store.get(toId)?.friendRequestsIn?.includes(fromId) ?? false;
  }

  add(toId: string, fromId: string): void {
    const p = this.store.get(toId);
    if (!p) return;
    const list = (p.friendRequestsIn ?? []).filter((id) => id !== fromId);
    list.push(fromId);
    p.friendRequestsIn = list.slice(-FRIEND_REQUESTS_MAX);
    this.store.save(toId);
  }

  delete(toId: string, fromId: string): void {
    const p = this.store.get(toId);
    if (!p?.friendRequestsIn?.includes(fromId)) return;
    p.friendRequestsIn = p.friendRequestsIn.filter((id) => id !== fromId);
    this.store.save(toId);
  }

  /** Account deletion: drop every pending request sent by `fromId`. */
  forget(fromId: string): void {
    for (const p of this.store.all()) if (p.friendRequestsIn?.includes(fromId)) this.delete(p.id, fromId);
  }
}
