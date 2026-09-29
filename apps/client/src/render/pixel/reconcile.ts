/**
 * Reconcile game state against the objects that draw it, every frame (HOWTO §6 Phase 2 step 3, D3): the scene never owns truth,
 * it only makes its sprites match `game`. Pure helpers, so add / update / remove is unit tested without Phaser.
 */

export interface Diff {
  /** ids present in the state but not drawn yet */
  add: string[];
  /** ids drawn and still in the state */
  keep: string[];
  /** ids drawn that are gone from the state */
  remove: string[];
}

export function diffIds(drawn: Iterable<string>, wanted: Iterable<string>): Diff {
  const want = new Set(wanted);
  const have = new Set(drawn);
  const add: string[] = [];
  const keep: string[] = [];
  const remove: string[] = [];
  for (const id of want) (have.has(id) ? keep : add).push(id);
  for (const id of have) if (!want.has(id)) remove.push(id);
  return { add, keep, remove };
}

/**
 * Make `views` match `items`: create a view for new ids, update the existing ones, destroy views whose id is gone.
 * Returns the diff (useful for logging and tests).
 */
export function syncViews<S, V>(
  views: Map<string, V>,
  items: ReadonlyMap<string, S>,
  fns: { create: (id: string, item: S) => V; update: (view: V, item: S, id: string) => void; destroy: (view: V, id: string) => void },
): Diff {
  const diff = diffIds(views.keys(), items.keys());
  for (const id of diff.remove) {
    const v = views.get(id) as V;
    views.delete(id);
    fns.destroy(v, id);
  }
  for (const id of diff.add) views.set(id, fns.create(id, items.get(id) as S));
  for (const id of [...diff.keep, ...diff.add]) fns.update(views.get(id) as V, items.get(id) as S, id);
  return diff;
}

/** Identity of the room being drawn: when it changes the whole room layer is rebuilt. */
export const roomKey = (r: { room: string; instanceId: string; ownerId: string | null } | null): string => (r ? `${r.room}|${r.instanceId}|${r.ownerId ?? ''}` : '');
