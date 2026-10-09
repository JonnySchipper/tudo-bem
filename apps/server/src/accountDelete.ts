/**
 * Account deletion and data export (the privacy page promises both).
 *
 * Deletion order matters with the live world: the account's sockets are closed and its profile leaves the
 * in-memory store first, then every store writes at once. A debounced profile save that fires later only
 * sees the store without the profile, so it cannot bring the row back.
 */
import type { Account, AccountStore } from './auth.js';
import type { AcademyStore } from './academyStore.js';
import type { PadariaStore } from './padariaStore.js';
import type { FeedbackStore } from './feedbackStore.js';
import type { FeiraGamesStore } from './feiraGames.js';
import type { ProfileStore, StoredProfile } from './store.js';

export interface AccountDeleteDeps {
  accounts: AccountStore;
  store: ProfileStore;
  academies: AcademyStore;
  padarias: PadariaStore;
  feedback: FeedbackStore;
  feiraGames?: FeiraGamesStore;
  /** The moderation log (`moderation.jsonl` and its memory copy). */
  moderation?: { scrub(ids: readonly string[]): number };
  /** Close the account's live sockets and drop what the world holds in memory (World.forgetAccount). */
  forgetLive?: (accountId: string, profileId?: string) => void;
}

export interface DeleteSummary {
  accountId: string;
  profileIds: string[];
  academies: number;
  padarias: number;
  feedback: number;
  moderation: number;
  friendLinks: number;
}

/** Profiles that belong to an account: the linked one, plus any that name the account (older links). */
function profilesOf(deps: Pick<AccountDeleteDeps, 'store'>, account: Account): StoredProfile[] {
  const out = new Map<string, StoredProfile>();
  const linked = account.profileId ? deps.store.get(account.profileId) : undefined;
  if (linked) out.set(linked.id, linked);
  for (const p of deps.store.all()) if (p.accountId === account.id) out.set(p.id, p);
  return [...out.values()];
}

/** Delete an account and everything tied to it. Synchronous: nothing else runs in between. */
export function deleteAccountCascade(deps: AccountDeleteDeps, accountId: string): DeleteSummary | null {
  const account = deps.accounts.get(accountId);
  if (!account) return null;
  const profiles = profilesOf(deps, account);
  const profileIds = profiles.map((p) => p.id);
  const gone = new Set(profileIds);

  // 1. Live state first: sockets closed, friend requests and boards forgotten.
  deps.forgetLive?.(accountId, profileIds[0]);
  for (const id of profileIds.slice(1)) deps.forgetLive?.(accountId, id);

  // 2. Places they own, and their seat in other academies.
  let academies = 0;
  for (const row of deps.academies.list()) {
    if (gone.has(row.ownerId)) {
      if (deps.academies.remove(row.id)) academies++;
    } else if (row.members.some((m) => gone.has(m))) {
      row.members = row.members.filter((m) => !gone.has(m));
      deps.academies.save();
    }
  }
  let padarias = 0;
  for (const row of deps.padarias.list()) if (gone.has(row.ownerId) && deps.padarias.remove(row.id)) padarias++;

  // 3. Other players' friend lists, then the profiles themselves (remove() writes at once).
  let friendLinks = 0;
  for (const p of deps.store.all()) {
    if (gone.has(p.id) || !p.friends?.some((f) => gone.has(f))) continue;
    const before = p.friends.length;
    p.friends = p.friends.filter((f) => !gone.has(f));
    friendLinks += before - p.friends.length;
  }
  for (const id of profileIds) deps.store.remove(id);
  deps.store.flush();

  // 4. Feira board, medals and paid-run counters keyed by profile id.
  const fg = deps.feiraGames;
  if (fg) {
    let touched = false;
    for (const id of profileIds) {
      for (const bucket of [fg.state.scores, fg.state.medals, fg.state.paid] as Record<string, unknown>[]) {
        if (id in bucket) {
          delete bucket[id];
          touched = true;
        }
      }
    }
    if (touched) fg.persist();
  }

  // 5. Notes and moderation entries that name the account or a profile.
  const ids = [accountId, ...profileIds];
  const feedback = deps.feedback.removeWhere((row) => row.accountId === accountId || (row.profileId != null && gone.has(row.profileId)));
  const moderation = deps.moderation?.scrub(ids) ?? 0;

  // 6. The account row and every session.
  deps.accounts.removeAccount(accountId);
  console.log(`[account] deleted ${accountId} profiles=${profileIds.length} academies=${academies} padarias=${padarias} feedback=${feedback} moderation=${moderation}`);
  return { accountId, profileIds, academies, padarias, feedback, moderation, friendLinks };
}

/** Profile fields that are credentials or internal bookkeeping, not the player's data. */
const PROFILE_SECRET_KEYS = ['token', 'billingEventIds'] as const;

/** Everything the server keeps for one account, minus password and session hashes (GET /api/account/export). */
export function exportAccountData(deps: Pick<AccountDeleteDeps, 'store' | 'academies' | 'padarias' | 'feedback' | 'feiraGames'>, account: Account) {
  const profiles = profilesOf(deps, account);
  const ids = new Set(profiles.map((p) => p.id));
  const fg = deps.feiraGames?.state;
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: account.id,
      email: account.email,
      signsInWithGoogle: !!account.googleSub,
      createdAt: new Date(account.createdAt).toISOString(),
      lastLoginAt: account.lastLoginAt ? new Date(account.lastLoginAt).toISOString() : null,
      confirmed18At: account.confirmed18At ? new Date(account.confirmed18At).toISOString() : null,
      profileId: account.profileId ?? null,
    },
    profiles: profiles.map((p) => {
      const copy: Record<string, unknown> = structuredClone(p) as unknown as Record<string, unknown>;
      for (const k of PROFILE_SECRET_KEYS) delete copy[k];
      return copy;
    }),
    academiesOwned: deps.academies.list().filter((a) => ids.has(a.ownerId)),
    academiesJoined: deps.academies.list().filter((a) => !ids.has(a.ownerId) && a.members.some((m) => ids.has(m))).map((a) => ({ id: a.id, name: a.name })),
    padariasOwned: deps.padarias.list().filter((p) => ids.has(p.ownerId)),
    feira: fg ? [...ids].map((id) => ({ profileId: id, today: fg.scores[id] ?? null, medals: fg.medals[id] ?? [] })) : [],
    feedback: deps.feedback.filter((row) => row.accountId === account.id || (row.profileId != null && ids.has(row.profileId))),
  };
}
