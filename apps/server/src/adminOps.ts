/**
 * Admin dashboard actions (adminApi.ts routes them). Every caller has passed the admin cookie check.
 *
 * Writes change the same in-memory objects the running world uses (ProfileStore, AccountStore, ...) and then mark them for
 * the normal debounced write, so memory and SQLite never disagree. Online players get the change pushed live
 * (AdminWorldHost). Every write appends one `admin_audit` row; destructive ones store the full rows first so the
 * dashboard can restore them.
 */
import {
  ALL_HATS,
  BAG_MAX_PER_ITEM,
  COMP_MAX_DAYS,
  FOUNDER_BANNER_ID,
  FURNITURE,
  GI_ITEM_ID,
  GI_PRICE,
  ITEMS,
  MUTE_MAX_MINUTES,
  PARROT_COLORS,
  TUTORIAL_STEPS,
  addToBag,
  applyAdminBelt,
  furnitureById,
  freshCartela,
  freshEscola,
  freshMission,
  freshRecadoState,
  grantCompSubscription,
  hasPerkAccess,
  isBelt,
  isRoomId,
  itemById,
  mutedCopy,
  normalizeBjj,
  normalizeDiary,
  normalizeEscola,
  parrotColorById,
  revokeCompSubscription,
  takeFromBag,
  validateName,
  type Belt,
  type FeiraCartMode,
  type TutorialStep,
} from '@tudobem/shared';
import type { Account, AccountStore } from './auth.js';
import type { AcademyStore } from './academyStore.js';
import type { PadariaStore } from './padariaStore.js';
import type { FeedbackRow, FeedbackStore } from './feedbackStore.js';
import type { FeiraGamesStore } from './feiraGames.js';
import { normalizeProfile, today, type ProfileStore, type StoredProfile } from './store.js';
import type { AdminWorldHost } from './adminWorld.js';
import type { GameConfig } from './gameConfig.js';
import { redact, isFeedbackStatus, type AdminAudit, type BillingEventLog, type FeedbackTriage } from './adminStores.js';
import { deleteAccountCascade } from './accountDelete.js';
import type { ModerationEvent } from './services/interfaces.js';

export interface AdminModeration {
  recent(n: number): ModerationEvent[];
  scrub(ids: readonly string[]): number;
}

export interface AdminCtx {
  store: ProfileStore;
  accounts: AccountStore;
  academies: AcademyStore;
  padarias: PadariaStore;
  feedback: FeedbackStore;
  feiraGames: FeiraGamesStore;
  moderation: AdminModeration;
  world: AdminWorldHost;
  config: GameConfig;
  audit: AdminAudit;
  billingEvents: BillingEventLog;
  triage: FeedbackTriage;
}

export type OpResult = ({ ok: true } & Record<string, unknown>) | { ok: false; status: number; error: string };

const fail = (status: number, error: string): OpResult => ({ ok: false, status, error });
const notFound = () => fail(404, 'No player with that id.');

type Body = Record<string, unknown>;
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

// ---------------------------------------------------------------- lookups

/** A profile id, or an account id (resolved to its profile). */
export function findProfile(ctx: AdminCtx, id: unknown): StoredProfile | undefined {
  const key = str(id, 100);
  if (!key) return undefined;
  return ctx.store.get(key) ?? ctx.store.get(ctx.accounts.get(key)?.profileId ?? '');
}

/** The account that owns a profile: the stored link, or the account whose profileId points at it. */
export function accountOf(ctx: AdminCtx, p: StoredProfile): Account | undefined {
  if (p.accountId) {
    const a = ctx.accounts.get(p.accountId);
    if (a) return a;
  }
  return ctx.accounts.all().find((a) => a.profileId === p.id);
}

function subView(p: StoredProfile, now: number) {
  const sub = p.subscription;
  return sub
    ? { status: sub.status, provider: sub.provider ?? 'lemonsqueezy', currentPeriodEnd: sub.currentPeriodEnd, active: hasPerkAccess(sub, now), comp: sub.provider === 'comp' }
    : null;
}

export interface PlayerRow {
  /** Profile id, or the account id for an account that never made an avatar. */
  id: string;
  profileId: string | null;
  accountId: string | null;
  name: string | null;
  email: string | null;
  google: boolean;
  createdAt: number;
  lastSeen: number | null;
  coins: number | null;
  belt: Belt | null;
  stripes: number | null;
  words: number;
  nameplate: string | null;
  online: boolean;
  room: string | null;
  sub: ReturnType<typeof subView>;
  founder: boolean;
  banned: boolean;
  muted: boolean;
  testUser: boolean;
}

export function playerRows(ctx: AdminCtx): PlayerRow[] {
  const now = ctx.world.now();
  const online = new Map(ctx.world.online().map((o) => [o.profileId, o]));
  const rows: PlayerRow[] = [];
  const seenAccounts = new Set<string>();
  for (const p of ctx.store.all()) {
    const a = accountOf(ctx, p);
    if (a) seenAccounts.add(a.id);
    const bjj = normalizeBjj(p.bjj);
    rows.push({
      id: p.id,
      profileId: p.id,
      accountId: a?.id ?? null,
      name: p.name,
      email: a?.email ?? null,
      google: !!a?.googleSub,
      createdAt: p.createdAt,
      lastSeen: p.lastSeen ?? null,
      coins: p.coins,
      belt: bjj.belt,
      stripes: bjj.stripes,
      words: normalizeDiary(p.diary).length,
      nameplate: p.nameplate,
      online: online.has(p.id),
      room: online.get(p.id)?.room ?? null,
      sub: subView(p, now),
      founder: p.founder === true,
      banned: !!p.banned,
      muted: (p.mutedUntil ?? 0) > now,
      testUser: p.testUser === true,
    });
  }
  for (const a of ctx.accounts.all()) {
    if (seenAccounts.has(a.id)) continue;
    rows.push({
      id: a.id,
      profileId: null,
      accountId: a.id,
      name: null,
      email: a.email,
      google: !!a.googleSub,
      createdAt: a.createdAt,
      lastSeen: a.lastLoginAt ?? null,
      coins: null,
      belt: null,
      stripes: null,
      words: 0,
      nameplate: null,
      online: false,
      room: null,
      sub: null,
      founder: false,
      banned: false,
      muted: false,
      testUser: false,
    });
  }
  return rows;
}

const moderationOf = (ctx: AdminCtx, ids: Set<string>) =>
  ctx.moderation
    .recent(1000)
    .filter((e) => ids.has(e.playerId) || (e.targetId != null && ids.has(e.targetId)))
    .reverse()
    .map((e) => ({ kind: e.kind, surface: e.surface, playerId: e.playerId, playerName: e.playerName, targetId: e.targetId ?? null, targetName: e.targetName ?? null, room: e.room, text: e.text, labels: e.labels, reason: e.reason ?? null, lines: e.lines ?? null, at: e.at }));

/** Everything the player detail page shows. `raw` is the stored profile minus credentials and photo bytes. */
export function playerDetail(ctx: AdminCtx, id: unknown): OpResult {
  const p = findProfile(ctx, id);
  if (!p) {
    const a = ctx.accounts.get(str(id, 100));
    if (!a) return notFound();
    return { ok: true, account: accountView(ctx, a), profile: null };
  }
  const a = accountOf(ctx, p);
  const now = ctx.world.now();
  const bjj = normalizeBjj(p.bjj);
  const diary = normalizeDiary(p.diary);
  const escola = normalizeEscola(p.escola, diary);
  const live = ctx.world.online().find((o) => o.profileId === p.id) ?? null;
  const raw = redact({ ...p, photos: (p.photos ?? []).map((ph) => ({ id: ph.id, at: ph.at, wordId: ph.wordId ?? null, bytes: ph.image.length })) });
  const academy = ctx.academies.list().find((x) => x.ownerId === p.id || x.members.includes(p.id)) ?? null;
  const padaria = ctx.padarias.ownedBy(p.id) ?? null;
  const ids = new Set([p.id, ...(a ? [a.id] : [])]);
  return {
    ok: true,
    account: a ? accountView(ctx, a) : null,
    live,
    profile: {
      id: p.id,
      name: p.name,
      pronoun: p.pronoun,
      createdAt: p.createdAt,
      lastSeen: p.lastSeen,
      coins: p.coins,
      nameplate: p.nameplate,
      belt: bjj.belt,
      stripes: bjj.stripes,
      wins: bjj.wins,
      giOwned: p.giOwned === true,
      hats: p.hats,
      hat: p.hat,
      furniture: p.furniture,
      apartment: p.apartment.length,
      parrotColors: p.parrotColors ?? [],
      parrotColor: p.parrotColor ?? null,
      bag: p.bag ?? {},
      pet: p.pet ?? null,
      petNames: p.petNames ?? {},
      bubbleStyle: p.bubbleStyle ?? 'classic',
      diaryWords: diary.length,
      escola: { xp: escola.xp, streak: escola.streak, best: escola.best, words: Object.keys(escola.words).length },
      tutorial: p.tutorial,
      tutorialRewarded: p.tutorialRewarded,
      arrivalIntroDone: p.arrivalIntroDone !== false,
      desembarqueDone: p.desembarqueDone !== false,
      replayFlight: p.replayFlight === true,
      correria: p.correria ?? null,
      cartela: p.cartela ?? null,
      friends: p.friends.length,
      blocked: p.blocked?.length ?? 0,
      founder: p.founder === true,
      founderBadge: p.founderBadge === true,
      founderBanner: p.founderBanner === true,
      subscription: subView(p, now),
      mutedUntil: p.mutedUntil && p.mutedUntil > now ? p.mutedUntil : null,
      banned: p.banned ?? null,
      testUser: p.testUser === true,
      feiraMedals: p.feiraMedals ?? [],
    },
    academy: academy ? { id: academy.id, name: academy.name, owner: academy.ownerId === p.id, members: academy.members.length } : null,
    padaria: padaria ? { id: padaria.id, name: padaria.name, size: padaria.size } : null,
    billingEvents: ctx.billingEvents.list({ profileId: p.id, limit: 50 }),
    feedback: ctx.feedback.filter((r) => r.profileId === p.id || (!!a && r.accountId === a.id)).map((r) => ({ ...r, triage: ctx.triage.get(r.id) })),
    moderation: moderationOf(ctx, ids),
    audit: ctx.audit.list({ target: p.id, limit: 50 }),
    raw,
  };
}

function accountView(ctx: AdminCtx, a: Account) {
  return {
    id: a.id,
    email: a.email,
    google: !!a.googleSub,
    profileId: a.profileId ?? null,
    createdAt: a.createdAt,
    lastLoginAt: a.lastLoginAt ?? null,
    confirmed18At: a.confirmed18At ?? null,
    sessions: ctx.accounts.sessionsOf(a.id),
  };
}

// ---------------------------------------------------------------- player writes

function withProfile(ctx: AdminCtx, body: Body, fn: (p: StoredProfile) => OpResult): OpResult {
  const p = findProfile(ctx, body.id);
  return p ? fn(p) : notFound();
}

export function giveCoins(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const delta = int(body.delta);
    const max = ctx.config.get('adminGrantMax');
    const reason = str(body.reason, 200);
    if (delta === null || delta === 0 || Math.abs(delta) > max) return fail(400, `Amount must be a whole number from 1 to ${max} (negative to take).`);
    if (reason.length < 3) return fail(400, 'Give a reason (3+ characters). It goes in the audit log.');
    const before = p.coins;
    p.coins = Math.max(0, p.coins + delta);
    ctx.store.save(p.id);
    const moved = p.coins - before;
    ctx.world.coins(p.id, moved, p.coins, moved > 0 ? { pt: 'Presente da equipe Tudo Bem', en: 'A gift from the Tudo Bem team' } : { pt: `A equipe ajustou seus RV (${moved}).`, en: `The team adjusted your RV (${moved}).` });
    ctx.audit.append({ actor, action: 'player.coins', target: p.id, summary: `${moved >= 0 ? 'gave' : 'took'} ${Math.abs(moved)} RV (${p.name}): ${reason}`, before: { coins: before }, after: { coins: p.coins, reason } });
    return { ok: true, coins: p.coins };
  });
}

export const ITEM_KINDS = ['hat', 'furniture', 'parrot', 'bag', 'gi'] as const;
type ItemKind = (typeof ITEM_KINDS)[number];

/** The real catalogs, for the dashboard's pickers. */
export function itemCatalogs() {
  return {
    hat: ALL_HATS.map((h) => ({ id: h.id, label: `${h.en} (${h.pt})`, price: h.price })),
    furniture: FURNITURE.map((f) => ({ id: f.id, label: `${f.en} (${f.pt})`, price: f.price })),
    parrot: PARROT_COLORS.map((c) => ({ id: c.id, label: `${c.en} bird`, price: c.price })),
    bag: ITEMS.map((i) => ({ id: i.id, label: `${i.name.en} (${i.name.pt})`, price: 0 })),
    gi: [{ id: GI_ITEM_ID, label: 'Kimono (gi)', price: GI_PRICE }],
  };
}

export function setItem(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const kind = body.kind as ItemKind;
    const itemId = str(body.itemId, 64);
    const op = body.op === 'remove' ? 'remove' : body.op === 'grant' ? 'grant' : null;
    const qty = int(body.qty) ?? 1;
    if (!(ITEM_KINDS as readonly string[]).includes(kind) || !op) return fail(400, 'Pick a kind and grant or remove.');
    if (qty < 1 || qty > BAG_MAX_PER_ITEM) return fail(400, `Quantity 1 to ${BAG_MAX_PER_ITEM}.`);
    const before = itemSlice(p, kind);
    let avatar = false;
    if (kind === 'hat') {
      if (!ALL_HATS.some((h) => h.id === itemId)) return fail(400, 'Unknown hat.');
      if (op === 'grant') {
        if (p.hats.includes(itemId)) return fail(409, 'Already owns that hat.');
        p.hats.push(itemId);
      } else {
        if (!p.hats.includes(itemId)) return fail(409, 'Does not own that hat.');
        p.hats = p.hats.filter((h) => h !== itemId);
        if (p.hat === itemId) p.hat = null;
        avatar = true;
      }
    } else if (kind === 'furniture') {
      if (!furnitureById(itemId)) return fail(400, 'Unknown furniture.');
      const have = p.furniture[itemId] ?? 0;
      if (op === 'grant') p.furniture[itemId] = Math.min(99, have + qty);
      else {
        if (have < qty) return fail(409, `Only ${have} unplaced in the inventory. Placed pieces stay in the kitnet.`);
        if (have - qty <= 0) delete p.furniture[itemId];
        else p.furniture[itemId] = have - qty;
      }
    } else if (kind === 'parrot') {
      const color = parrotColorById(itemId);
      if (!color) return fail(400, 'Unknown bird colour.');
      const owned = new Set(p.parrotColors ?? []);
      if (op === 'grant') {
        if (owned.has(color.id)) return fail(409, 'Already owns that bird.');
        owned.add(color.id);
        p.parrotOwned = true;
      } else {
        if (!owned.has(color.id)) return fail(409, 'Does not own that bird.');
        owned.delete(color.id);
        if (!owned.size) {
          p.parrotOwned = false;
          p.parrotEquipped = false;
        }
      }
      p.parrotColors = [...owned];
      if (p.parrotColor === color.id && op === 'remove') p.parrotColor = null;
      normalizeProfile(p);
      avatar = true;
    } else if (kind === 'bag') {
      if (!itemById(itemId)) return fail(400, 'Unknown item.');
      const bag = p.bag ?? {};
      if (op === 'grant') p.bag = addToBag(bag, itemId, qty);
      else {
        const next = takeFromBag(bag, itemId, qty);
        if (!next) return fail(409, `The bag holds ${bag[itemId] ?? 0}.`);
        p.bag = next;
      }
    } else {
      if (itemId !== GI_ITEM_ID) return fail(400, 'Unknown item.');
      if (op === 'grant') {
        if (p.giOwned) return fail(409, 'Already owns the gi.');
        p.giOwned = true;
        if (!p.bjj) p.bjj = normalizeBjj({ belt: 'branca', stripes: 0, wins: 0 });
      } else {
        if (!p.giOwned) return fail(409, 'Does not own the gi.');
        p.giOwned = false;
      }
      avatar = true;
    }
    ctx.store.save(p.id);
    ctx.world.changed(p.id, { avatar });
    ctx.audit.append({ actor, action: 'player.item', target: p.id, summary: `${op} ${kind} ${itemId}${kind === 'furniture' || kind === 'bag' ? ` x${qty}` : ''} (${p.name})`, before, after: itemSlice(p, kind) });
    return { ok: true };
  });
}

function itemSlice(p: StoredProfile, kind: ItemKind): unknown {
  if (kind === 'hat') return { hats: [...p.hats], hat: p.hat };
  if (kind === 'furniture') return { furniture: { ...p.furniture } };
  if (kind === 'parrot') return { parrotColors: [...(p.parrotColors ?? [])], parrotColor: p.parrotColor ?? null };
  if (kind === 'bag') return { bag: { ...(p.bag ?? {}) } };
  return { giOwned: p.giOwned === true };
}

export function setBelt(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const wins = int(body.wins);
    const stripes = int(body.stripes);
    if (wins === null && !isBelt(body.belt)) return fail(400, 'Pick a belt (and stripes), or a win count.');
    const before = normalizeBjj(p.bjj);
    const r = wins !== null ? applyAdminBelt(p.bjj, { wins }) : applyAdminBelt(p.bjj, { belt: body.belt as Belt, stripes: stripes ?? 0 });
    if (!r.ok) return fail(400, 'That rank is not on the ladder.');
    p.bjj = r.bjj;
    ctx.store.save(p.id);
    ctx.world.changed(p.id, { avatar: true });
    ctx.audit.append({
      actor,
      action: 'player.belt',
      target: p.id,
      summary: `belt ${before.belt}/${before.stripes} -> ${r.bjj.belt}/${r.bjj.stripes} (${p.name})`,
      before: { belt: before.belt, stripes: before.stripes, wins: before.wins },
      after: { belt: r.bjj.belt, stripes: r.bjj.stripes, wins: r.bjj.wins },
    });
    return { ok: true, belt: r.bjj.belt, stripes: r.bjj.stripes, wins: r.bjj.wins };
  });
}

export const INTRO_RESETS = ['tutorial', 'desembarque', 'arrivalIntro', 'flight'] as const;

export function resetIntro(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const which = body.which as (typeof INTRO_RESETS)[number];
    if (!(INTRO_RESETS as readonly string[]).includes(which)) return fail(400, 'Pick tutorial, desembarque, arrivalIntro or flight.');
    const before = { tutorial: { ...p.tutorial }, desembarqueDone: p.desembarqueDone, arrivalIntroDone: p.arrivalIntroDone, replayFlight: p.replayFlight ?? false };
    // tutorialRewarded stays: walking the steps again must not pay the bonus twice
    if (which === 'tutorial') p.tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, false])) as Record<TutorialStep, boolean>;
    if (which === 'desembarque' || which === 'flight') p.desembarqueDone = false;
    if (which === 'arrivalIntro') p.arrivalIntroDone = false;
    if (which === 'flight') p.replayFlight = true;
    ctx.store.save(p.id);
    ctx.world.changed(p.id);
    if (which !== 'tutorial') ctx.world.notify(p.id, 'info', { pt: 'A equipe reiniciou sua chegada. Ela começa no próximo login.', en: 'The team reset your arrival. It starts on your next sign-in.' });
    const after = { tutorial: { ...p.tutorial }, desembarqueDone: p.desembarqueDone, arrivalIntroDone: p.arrivalIntroDone, replayFlight: p.replayFlight ?? false };
    ctx.audit.append({ actor, action: 'player.reset-intro', target: p.id, summary: `reset ${which} (${p.name})`, before, after });
    return { ok: true };
  });
}

/** Gameplay progress back to a new player's, keeping the login, the name and looks, friends, photos, founder marks and any subscription. */
export function wipeProgress(p: StoredProfile, startingCoins: number, padarias: PadariaStore): void {
  p.coins = startingCoins;
  p.bjj = normalizeBjj(null);
  p.giOwned = false;
  p.diary = [];
  p.escola = freshEscola();
  p.verdeMode = false;
  p.nameplate = 'verde';
  p.correria = undefined;
  p.feira = undefined;
  p.recados = freshRecadoState();
  p.bag = {};
  p.bond = {};
  p.bondGifts = [];
  p.caderno = {};
  p.cadernoPaid = [];
  p.mission = freshMission(today());
  p.tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, false])) as Record<TutorialStep, boolean>;
  p.tutorialRewarded = false;
  p.kitnetGiftPaid = false;
  p.hats = [];
  p.hat = null;
  const banner = p.founderBanner ? 1 : 0;
  p.furniture = banner ? { [FOUNDER_BANNER_ID]: banner } : {};
  p.apartment = [];
  p.parrotOwned = false;
  p.parrotEquipped = false;
  p.parrotColors = [];
  p.parrotColor = null;
  p.daily = { date: today(), sceneClears: {} };
  p.cartela = freshCartela();
  p.feiraMedals = [];
  p.npcMemory = {};
  p.testDayOffset = undefined;
  p.testClockOffsetMs = undefined;
  p.testFeiraPaid = undefined;
  const owned = padarias.ownedBy(p.id);
  if (owned) padarias.remove(owned.id);
  normalizeProfile(p);
}

const profileSnapshot = (p: StoredProfile) => {
  const { photos: _photos, ...rest } = structuredClone(p);
  return rest;
};

/** Typed confirmation: the player's name for a profile, the email for an account. Case and outer spaces do not matter. */
const confirmed = (typed: unknown, expected: string) => str(typed, 200).toLowerCase() === expected.trim().toLowerCase();

export function resetProgress(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    if (!confirmed(body.confirm, p.name)) return fail(400, `Type the player name (${p.name}) to confirm.`);
    const padaria = ctx.padarias.ownedBy(p.id);
    const snapshot = { profile: profileSnapshot(p), padaria: padaria ? structuredClone(padaria) : null };
    const id = ctx.audit.append({ actor, action: 'player.reset-progress', target: p.id, summary: `reset progress (${p.name}), ${p.coins} RV, ${normalizeDiary(p.diary).length} words`, snapshot });
    wipeProgress(p, ctx.config.get('startingCoins'), ctx.padarias);
    ctx.store.save(p.id);
    ctx.world.kick(p.id, 'admin');
    ctx.world.markBoardsDirty();
    return { ok: true, auditId: id };
  });
}

export function deleteAccount(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const p = findProfile(ctx, body.id);
  const account = p ? accountOf(ctx, p) : ctx.accounts.get(str(body.id, 100));
  if (!p && !account) return notFound();
  const expected = account?.email ?? p!.name;
  if (!confirmed(body.confirm, expected)) return fail(400, `Type ${account ? 'the account email' : 'the player name'} (${expected}) to confirm.`);
  const profiles = account ? ctx.store.all().filter((x) => x.id === account.profileId || x.accountId === account.id) : [p!];
  const ids = new Set(profiles.map((x) => x.id));
  const feedback = ctx.feedback.filter((r) => (account && r.accountId === account.id) || (r.profileId != null && ids.has(r.profileId)));
  const snapshot = { account: account ? structuredClone(account) : null, profiles: profiles.map(profileSnapshot), feedback };
  const label = account?.email ?? p!.name;
  const auditId = ctx.audit.append({ actor, action: 'player.delete', target: p?.id ?? account!.id, summary: `deleted ${label} (${profiles.length} profile(s), ${feedback.length} note(s))`, snapshot });
  if (account) {
    deleteAccountCascade(
      { accounts: ctx.accounts, store: ctx.store, academies: ctx.academies, padarias: ctx.padarias, feedback: ctx.feedback, feiraGames: ctx.feiraGames, moderation: ctx.moderation, forgetLive: (a, id) => ctx.world.forgetAccount(a, id) },
      account.id,
    );
  } else {
    ctx.world.kick(p!.id, 'admin');
    ctx.store.remove(p!.id);
    ctx.world.markBoardsDirty();
  }
  return { ok: true, auditId };
}

export function signOutAll(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const p = findProfile(ctx, body.id);
  const account = p ? accountOf(ctx, p) : ctx.accounts.get(str(body.id, 100));
  if (!account) return fail(404, 'No account for that player.');
  const n = ctx.accounts.revokeAllSessions(account.id);
  ctx.world.dropAccount(account.id);
  ctx.audit.append({ actor, action: 'player.signout', target: p?.id ?? account.id, summary: `signed out ${account.email} (${n} session(s))` });
  return { ok: true, sessions: n };
}

export function mute(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const m = int(body.minutes);
    if (m === null || m < 0 || m > MUTE_MAX_MINUTES) return fail(400, `Minutes 0 to ${MUTE_MAX_MINUTES} (0 lifts the mute).`);
    const before = p.mutedUntil ?? null;
    if (m === 0) delete p.mutedUntil;
    else p.mutedUntil = ctx.world.now() + m * 60_000;
    ctx.store.save(p.id);
    if (m > 0) ctx.world.notify(p.id, 'warn', mutedCopy(m * 60_000));
    ctx.audit.append({ actor, action: m ? 'player.mute' : 'player.unmute', target: p.id, summary: m ? `muted ${p.name} for ${m} min` : `unmuted ${p.name}`, before: { mutedUntil: before }, after: { mutedUntil: p.mutedUntil ?? null } });
    return { ok: true, mutedUntil: p.mutedUntil ?? null };
  });
}

export function kick(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    if (!ctx.world.kick(p.id, 'admin')) return fail(409, `${p.name} is not online.`);
    ctx.audit.append({ actor, action: 'player.kick', target: p.id, summary: `kicked ${p.name}` });
    return { ok: true };
  });
}

export function ban(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const on = body.ban === true;
    const before = p.banned ?? null;
    if (on) p.banned = { at: ctx.world.now() };
    else delete p.banned;
    ctx.store.save(p.id);
    if (on) ctx.world.kick(p.id, 'banned');
    ctx.audit.append({ actor, action: on ? 'player.ban' : 'player.unban', target: p.id, summary: `${on ? 'banned' : 'unbanned'} ${p.name}`, before: { banned: before }, after: { banned: p.banned ?? null } });
    return { ok: true };
  });
}

/** Same name rules as the avatar creator, then the chat classifier: only an `allow` verdict renames. */
export async function rename(ctx: AdminCtx, actor: string, body: Body): Promise<OpResult> {
  const p = findProfile(ctx, body.id);
  if (!p) return notFound();
  const shape = validateName(str(body.name, 64));
  if (!shape.ok) return fail(400, shape.reason.en);
  const verdict = await ctx.world.classify(shape.name, p.nameplate);
  if (verdict.action !== 'allow') return fail(422, `Moderation said ${verdict.action}${verdict.labels.length ? ` (${verdict.labels.join(', ')})` : ''}. Pick another name.`);
  // the profile may have been deleted while the classifier ran
  if (ctx.store.get(p.id) !== p) return notFound();
  const before = p.name;
  p.name = shape.name;
  ctx.store.save(p.id);
  ctx.world.changed(p.id, { avatar: true });
  ctx.world.notify(p.id, 'info', { pt: `A equipe mudou seu nome para ${p.name}.`, en: `The team changed your name to ${p.name}.` });
  ctx.audit.append({ actor, action: 'player.rename', target: p.id, summary: `renamed ${before} -> ${p.name}`, before: { name: before }, after: { name: p.name } });
  return { ok: true, name: p.name };
}

export function setFounder(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const on = body.founder === true;
    const before = p.founder === true;
    p.founder = on;
    ctx.store.save(p.id);
    ctx.world.changed(p.id, { avatar: true });
    ctx.audit.append({ actor, action: 'player.founder', target: p.id, summary: `founder flag ${on ? 'on' : 'off'} (${p.name})`, before: { founder: before }, after: { founder: on } });
    return { ok: true };
  });
}

// ---------------------------------------------------------------- subscriptions

export function subscriptions(ctx: AdminCtx) {
  const now = ctx.world.now();
  const rows = ctx.store
    .all()
    .filter((p) => p.subscription || p.founderBadge)
    .map((p) => ({ id: p.id, name: p.name, email: accountOf(ctx, p)?.email ?? null, ...(subView(p, now) ?? { status: 'none', provider: null, currentPeriodEnd: null, active: false, comp: false }), founderBadge: p.founderBadge === true }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt'));
  return { ok: true as const, rows, events: ctx.billingEvents.list({ limit: 200 }) };
}

export function comp(ctx: AdminCtx, actor: string, body: Body): OpResult {
  return withProfile(ctx, body, (p) => {
    const now = ctx.world.now();
    const before = subView(p, now);
    if (body.grant === true) {
      const days = int(body.days) ?? 30;
      if (days < 1 || days > COMP_MAX_DAYS) return fail(400, `Days 1 to ${COMP_MAX_DAYS}.`);
      if (!grantCompSubscription(p, now, days)) return fail(409, 'They already have an active Lemon Squeezy subscription.');
      ctx.audit.append({ actor, action: 'sub.comp-grant', target: p.id, summary: `COMP supporter perks for ${days} day(s) (${p.name})`, before, after: subView(p, now) });
    } else {
      if (!revokeCompSubscription(p, now)) return fail(409, 'No comp to revoke (Lemon Squeezy subscriptions are managed in Lemon Squeezy).');
      ctx.audit.append({ actor, action: 'sub.comp-revoke', target: p.id, summary: `revoked COMP (${p.name})`, before, after: subView(p, now) });
    }
    ctx.store.save(p.id);
    ctx.world.changed(p.id, { avatar: true });
    return { ok: true, subscription: subView(p, now) };
  });
}

// ---------------------------------------------------------------- moderation and feedback

export const MODERATION_KINDS = ['report', 'escalate', 'block', 'warn'] as const;

export function moderationList(ctx: AdminCtx, q: { kind?: string | null; search?: string | null; limit?: number }) {
  const search = (q.search ?? '').trim().toLowerCase();
  const now = ctx.world.now();
  const items = ctx.moderation
    .recent(1000)
    .filter((e) => !q.kind || e.kind === q.kind)
    .filter((e) => !search || [e.playerName, e.targetName ?? '', e.text, e.playerId, e.targetId ?? ''].some((s) => s.toLowerCase().includes(search)))
    .reverse()
    .slice(0, Math.max(1, Math.min(500, q.limit ?? 200)))
    .map((e) => {
      const p = ctx.store.get(e.kind === 'report' && e.targetId ? e.targetId : e.playerId);
      return {
        kind: e.kind,
        surface: e.surface,
        playerId: e.playerId,
        playerName: e.playerName,
        targetId: e.targetId ?? null,
        targetName: e.targetName ?? null,
        room: e.room,
        text: e.text,
        labels: e.labels,
        reason: e.reason ?? null,
        lines: e.lines ?? null,
        toxicity: e.toxicity ?? null,
        status: e.status ?? null,
        at: e.at,
        /** The player an action would hit: the reported one for a report, else the author. */
        subject: p ? { id: p.id, name: p.name, muted: (p.mutedUntil ?? 0) > now, banned: !!p.banned } : null,
      };
    });
  const restricted = ctx.store
    .all()
    .filter((p) => p.banned || (p.mutedUntil ?? 0) > now)
    .map((p) => ({ id: p.id, name: p.name, banned: p.banned?.at ?? null, mutedUntil: (p.mutedUntil ?? 0) > now ? p.mutedUntil! : null }));
  return { ok: true as const, items, restricted };
}

export function feedbackList(ctx: AdminCtx, q: { status?: string | null; search?: string | null; category?: string | null }) {
  const search = (q.search ?? '').trim().toLowerCase();
  const names = new Map(ctx.store.all().map((p) => [p.id, p.name]));
  const items = ctx.feedback
    .list({ limit: 5000 })
    .map((r) => ({ ...r, playerName: r.profileId ? names.get(r.profileId) ?? null : null, triage: ctx.triage.get(r.id) }))
    .filter((r) => !q.status || r.triage.status === q.status)
    .filter((r) => !q.category || r.category === q.category)
    .filter((r) => !search || [r.text, r.playerName ?? '', r.contact ?? ''].some((s) => s.toLowerCase().includes(search)));
  return { ok: true as const, items };
}

export function triageFeedback(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const id = str(body.id, 40);
  if (!ctx.feedback.filter((r) => r.id === id).length) return fail(404, 'No feedback note with that id.');
  if (!isFeedbackStatus(body.status)) return fail(400, 'Status is new, seen or done.');
  const note = typeof body.note === 'string' ? body.note.slice(0, 1000) : ctx.triage.get(id).note;
  const before = ctx.triage.get(id);
  const after = ctx.triage.set(id, body.status, note);
  ctx.audit.append({ actor, action: 'feedback.triage', target: id, summary: `feedback ${id}: ${before.status} -> ${after.status}`, before, after });
  return { ok: true, triage: after };
}

// ---------------------------------------------------------------- world and config

export function worldView(ctx: AdminCtx) {
  const overrides = new Map(ctx.world.layoutOverrides().map((o) => [o.room, o.objects]));
  return {
    ok: true as const,
    instances: ctx.world.instances(),
    layouts: overrides.size ? [...overrides].map(([room, objects]) => ({ room, objects })) : [],
    feiraCart: ctx.world.feiraCartView(),
    roomCap: { value: ctx.config.get('roomCap'), overridden: ctx.config.isOverridden('roomCap') },
  };
}

export function resetLayout(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const room = body.room;
  if (!isRoomId(room)) return fail(400, 'Unknown room.');
  if (!ctx.world.revertLayout(room)) return fail(409, 'That room already uses the layout in the code.');
  ctx.audit.append({ actor, action: 'world.layout-reset', target: room, summary: `layout override removed for ${room}` });
  return { ok: true };
}

const CART_MODES: readonly FeiraCartMode[] = ['off', 'on', 'rotation'];

export function setFeiraCart(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const game = str(body.game, 40);
  const mode = body.mode as FeiraCartMode;
  if (!CART_MODES.includes(mode)) return fail(400, 'Mode is off, on or rotation.');
  const before = ctx.world.feiraCartView().games.find((g) => g.id === game)?.mode ?? null;
  if (!ctx.world.setFeiraCart(game, mode)) return fail(400, 'Unknown cart game.');
  ctx.audit.append({ actor, action: 'world.feira-cart', target: game, summary: `feira cart ${game}: ${before} -> ${mode}`, before: { mode: before }, after: { mode } });
  return { ok: true, feiraCart: ctx.world.feiraCartView() };
}

export function setConfig(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const r = body.reset === true ? ctx.config.reset(body.key) : ctx.config.set(body.key, body.value);
  if (!r.ok) return fail(400, r.error);
  ctx.audit.append({ actor, action: body.reset === true ? 'config.reset' : 'config.set', target: String(body.key), summary: `${String(body.key)}: ${r.before} -> ${r.value}`, before: { value: r.before }, after: { value: r.value } });
  return { ok: true, value: r.value };
}

// ---------------------------------------------------------------- restore

/** Undo a reset-progress or a delete from the snapshot its audit row holds. */
export function restore(ctx: AdminCtx, actor: string, body: Body): OpResult {
  const id = int(body.id);
  const row = id === null ? null : ctx.audit.rawSnapshot(id);
  if (!row) return fail(404, 'That audit entry has no snapshot.');
  if (row.action === 'player.reset-progress') {
    const snap = row.snapshot as { profile: StoredProfile; padaria: Parameters<PadariaStore['add']>[0] | null };
    const p = ctx.store.get(snap.profile.id);
    if (!p) return fail(409, 'That profile is gone (deleted since). Restore the delete instead.');
    const keep = { token: p.token, accountId: p.accountId, photos: p.photos };
    for (const k of Object.keys(p)) delete (p as unknown as Record<string, unknown>)[k];
    Object.assign(p, structuredClone(snap.profile), keep);
    normalizeProfile(p);
    if (snap.padaria && !ctx.padarias.ownedBy(p.id) && !ctx.padarias.byNameKey(snap.padaria.nameKey)) ctx.padarias.add(snap.padaria);
    ctx.store.save(p.id);
    ctx.world.kick(p.id, 'admin');
    ctx.world.markBoardsDirty();
    ctx.audit.append({ actor, action: 'audit.restore', target: p.id, summary: `restored progress of ${p.name} from audit #${id}` });
    return { ok: true };
  }
  if (row.action === 'player.delete') {
    const snap = row.snapshot as { account: Account | null; profiles: StoredProfile[]; feedback: FeedbackRow[] };
    if (snap.profiles.some((x) => ctx.store.get(x.id))) return fail(409, 'A profile with that id exists again.');
    if (snap.account && !ctx.accounts.restoreAccount(snap.account)) return fail(409, 'That account id or email is in use again.');
    for (const x of snap.profiles) ctx.store.add(structuredClone(x));
    ctx.store.flush();
    for (const r of snap.feedback ?? []) ctx.feedback.add(r);
    ctx.world.markBoardsDirty();
    ctx.audit.append({ actor, action: 'audit.restore', target: row.target, summary: `restored deleted ${snap.account?.email ?? snap.profiles[0]?.name ?? row.target} from audit #${id} (sessions, photos and moderation entries are not restored)` });
    return { ok: true };
  }
  return fail(400, 'Only reset-progress and delete entries can be restored.');
}
