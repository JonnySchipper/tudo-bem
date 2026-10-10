/**
 * Design mode's API (`/api/admin/design/*`, routed by adminApi.ts behind the admin cookie).
 *
 * The editor autosaves a draft per room; nothing a player sees changes until a publish. Publish, revert (the version before the last
 * publish) and reset (the code layout) put a layout live for everyone and each appends an `admin_audit` row with the layout it replaced.
 * The pull request path writes nothing live: it opens a GitHub PR with the JSON, or hands the file back when no token is configured.
 */
import { ROOM_IDS, ROOMS, bundledObjects, isRoomId, layoutDiff, layoutDiffSummary, serializeLayout, validateRoomLayout, type PropDef, type RoomId } from '@tudobem/shared';
import type { AdminCtx, OpResult } from './adminOps.js';

type Body = Record<string, unknown>;

const fail = (status: number, error: string): OpResult => ({ ok: false, status, error });

/** The layout everyone walks now: the override, or the code layout. */
function liveOf(ctx: AdminCtx, room: RoomId): PropDef[] {
  return ctx.world.layouts().live(room) ?? bundledObjects(room);
}

function roomOf(v: unknown): RoomId | null {
  return isRoomId(v) ? v : null;
}

/** Everything the editor needs to open a room. */
export function designState(ctx: AdminCtx, roomParam: string | null): OpResult {
  const room = roomOf(roomParam);
  if (!room) return fail(400, 'Unknown room.');
  const store = ctx.world.layouts();
  const def = ROOMS[room];
  const draft = store.draft(room);
  const drafts = new Set(store.draftRooms());
  return {
    ok: true,
    room,
    name: def.name,
    cols: def.cols,
    rows: def.rows,
    rev: store.rev(room),
    source: store.has(room) ? 'override' : 'code',
    live: liveOf(ctx, room),
    code: bundledObjects(room),
    draft,
    history: store.history(room).map((v) => ({ at: v.at, by: v.by, objects: v.objects ? v.objects.length : null })),
    github: ctx.world.githubConfigured(),
    rooms: ROOM_IDS.filter((id) => id !== 'andar').map((id) => ({ id, name: ROOMS[id].name, override: store.has(id), draft: drafts.has(id) })),
  };
}

/** Autosave. Validated like a publish so a draft can always be published, but not audited: nobody else sees it. */
export function saveDraft(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const v = validateRoomLayout(String(body.room ?? ''), body.objects);
  if (!v.ok) return fail(400, v.en);
  const store = ctx.world.layouts();
  const baseRev = Number.isInteger(body.baseRev) ? (body.baseRev as number) : store.rev(v.room);
  const draft = store.setDraft(v.room, v.objects, actor, baseRev)!;
  return { ok: true, at: draft.at, baseRev: draft.baseRev };
}

export function discardDraft(ctx: AdminCtx, _actor: string, body: Body): OpResult {
  const room = roomOf(body.room);
  if (!room) return fail(400, 'Unknown room.');
  ctx.world.layouts().setDraft(room, null);
  return { ok: true };
}

/**
 * Put a layout live. `baseRev` is the live rev the editor started from: when someone published the room since, the answer is 409 unless
 * `force` is set, so two admins do not overwrite each other without knowing.
 */
export function publishDesign(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const v = validateRoomLayout(String(body.room ?? ''), body.objects);
  if (!v.ok) return fail(400, v.en);
  const store = ctx.world.layouts();
  if (Number.isInteger(body.baseRev) && body.baseRev !== store.rev(v.room) && body.force !== true) {
    return fail(409, 'This room was published by someone else since you opened it. Reload it, or publish again to overwrite.');
  }
  const before = liveOf(ctx, v.room);
  const diff = layoutDiff(before, v.objects);
  store.publish(v.room, v.objects, actor);
  ctx.world.applyLayout(v.room, v.objects);
  const auditId = ctx.audit.append({
    actor,
    action: 'design.publish',
    target: v.room,
    summary: `published ${v.room} layout (${v.objects.length} objects, ${layoutDiffSummary(diff)})`,
    before: { objects: before.length },
    after: { objects: v.objects.length, ...diff },
    snapshot: { room: v.room, objects: before },
  });
  return { ok: true, rev: store.rev(v.room), auditId, diff };
}

/** Back to the version that was live before the last publish. */
export function revertDesign(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const room = roomOf(body.room);
  if (!room) return fail(400, 'Unknown room.');
  const store = ctx.world.layouts();
  const before = liveOf(ctx, room);
  const prev = store.rollback(room);
  if (!prev) return fail(409, 'No earlier published version of this room to go back to.');
  ctx.world.applyLayout(room, prev.objects);
  const after = liveOf(ctx, room);
  const auditId = ctx.audit.append({
    actor,
    action: 'design.revert',
    target: room,
    summary: `reverted ${room} to the version published ${new Date(prev.at).toISOString()}${prev.objects ? '' : ' (code layout)'} (${layoutDiffSummary(layoutDiff(before, after))})`,
    before: { objects: before.length },
    after: { objects: after.length, source: prev.objects ? 'override' : 'code' },
    snapshot: { room, objects: before },
  });
  return { ok: true, rev: store.rev(room), auditId };
}

/** Back to the layout shipped in the repo. What was live is kept in the history, so this can be reverted too. */
export function resetDesign(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const room = roomOf(body.room);
  if (!room) return fail(400, 'Unknown room.');
  const store = ctx.world.layouts();
  if (!store.has(room)) {
    store.setDraft(room, null);
    return fail(409, 'That room already uses the layout in the code.');
  }
  const before = liveOf(ctx, room);
  store.publish(room, null, actor);
  ctx.world.applyLayout(room, null);
  const auditId = ctx.audit.append({
    actor,
    action: 'design.reset',
    target: room,
    summary: `reset ${room} to the code layout (${layoutDiffSummary(layoutDiff(before, bundledObjects(room)))})`,
    before: { objects: before.length },
    after: { objects: bundledObjects(room).length, source: 'code' },
    snapshot: { room, objects: before },
  });
  return { ok: true, rev: store.rev(room), auditId };
}

/** Open a pull request with the layout file (TB_GITHUB_TOKEN), or return the file to download when no token is set. Nothing goes live. */
export async function designPullRequest(ctx: AdminCtx, actor: string, body: Body): Promise<OpResult> {
  const v = validateRoomLayout(String(body.room ?? ''), body.objects);
  if (!v.ok) return fail(400, v.en);
  const file = serializeLayout(v.room, v.objects);
  const r = await ctx.world.layoutPullRequest(v.room, v.objects);
  if (r.ok) {
    ctx.audit.append({ actor, action: 'design.pr', target: v.room, summary: `opened a pull request with the ${v.room} layout: ${r.url}`, after: { url: r.url, objects: v.objects.length } });
    return { ok: true, url: r.url };
  }
  if (r.reason === 'no-token') {
    ctx.audit.append({ actor, action: 'design.download', target: v.room, summary: `downloaded the ${v.room} layout file (no GitHub token)`, after: { objects: v.objects.length } });
    return { ok: true, fallback: true, file, name: `${v.room}.json` };
  }
  return fail(502, 'Could not open the pull request (see the server log). Download the file instead.');
}
