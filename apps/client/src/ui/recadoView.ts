/**
 * View-models of the recado UI (HOWTO Phase 8, steps 2-4): the tracker on the right, the journal panel, the bag, hearts, the give chip, the
 * offer chip and the "what just happened" diffs (a step done, a recado finished, a heart gained). Pure: the DOM modules only draw them, and
 * these are unit-tested.
 */
import {
  RECADOS,
  RECADO_MAX_ACTIVE,
  TUTORIAL_STEPS,
  hearts,
  itemById,
  npcName,
  recadoById,
  sameNpcRole,
  type Bilingual,
  type BondMap,
  type NpcId,
  type PrivateProfile,
  type RecadoActiveView,
  type RecadoDef,
  type RecadoOfferView,
} from '@tudobem/shared';

/** The board the server sends (`{ t: 'recados' }`). */
export interface RecadoBoard {
  day: number;
  offered: RecadoOfferView[];
  active: RecadoActiveView[];
  done: string[];
}

/** The tracker shows at most this many entries (the tutorial chain counts as one). */
export const TRACKER_MAX = 3;

export const WELCOME_TITLE: Bilingual = { pt: 'Bem-vindo à Vila Ipê', en: 'Welcome to Vila Ipê' };

export interface TrackerEntry {
  /** stable key (`tutorial` or the recado id) */
  key: string;
  kind: 'tutorial' | 'recado';
  giver: NpcId;
  title: Bilingual;
  /** the current step, one line */
  step: Bilingual;
  /** "3/8" for the welcome chain, "1/2" for a recado (step being worked on, out of all) */
  progress: string;
  done: number;
  total: number;
}

/** Júlia's welcome chain (the old "Primeiros passos") is shown until every tutorial step is done and the bonus is paid. */
export function tutorialPending(p: Pick<PrivateProfile, 'tutorial' | 'tutorialRewarded'> | null | undefined): boolean {
  if (!p) return false;
  return !(p.tutorialRewarded && TUTORIAL_STEPS.every((s) => p.tutorial[s.id]));
}

export function tutorialEntry(p: Pick<PrivateProfile, 'tutorial'>): TrackerEntry {
  const done = TUTORIAL_STEPS.filter((s) => p.tutorial[s.id]).length;
  const next = TUTORIAL_STEPS.find((s) => !p.tutorial[s.id]);
  return {
    key: 'tutorial',
    kind: 'tutorial',
    giver: 'julia',
    title: WELCOME_TITLE,
    step: next ? { pt: next.pt, en: next.en } : { pt: 'Quase lá! O bônus já vem.', en: 'Almost there! Your bonus is on its way.' },
    progress: `${done}/${TUTORIAL_STEPS.length}`,
    done,
    total: TUTORIAL_STEPS.length,
  };
}

/** Welcome chain first (while it lasts), then the active recados in the order they were accepted; max 3 entries. */
export function trackerEntries(board: RecadoBoard | null, p: PrivateProfile | null | undefined): TrackerEntry[] {
  const out: TrackerEntry[] = [];
  if (p && tutorialPending(p)) out.push(tutorialEntry(p));
  for (const a of board?.active ?? []) {
    if (out.length >= TRACKER_MAX) break;
    out.push({ key: a.id, kind: 'recado', giver: a.giver, title: a.title, step: a.hint, progress: `${Math.min(a.step + 1, a.steps)}/${a.steps}`, done: a.step, total: a.steps });
  }
  return out;
}

// ---------------------------------------------------------------- hearts

export const HEARTS_MAX = 10;

export interface HeartsView {
  hearts: number;
  /** 0..1 progress toward the next heart */
  next: number;
  /** "♥♥♥♡♡♡♡♡♡♡" */
  row: string;
  /** "♥ 3" for tight places (name tag, hover label) */
  short: string;
}

export function heartsView(points: number | undefined): HeartsView {
  const p = Math.max(0, Math.min(100, Math.floor(points ?? 0)));
  const n = hearts(p);
  return { hearts: n, next: n >= HEARTS_MAX ? 1 : (p % 10) / 10, row: '♥'.repeat(n) + '♡'.repeat(HEARTS_MAX - n), short: `♥ ${n}` };
}

/** Hearts the player has with an NPC (0 without a bond yet). */
export const heartsWith = (bond: BondMap | undefined, npc: NpcId | string | null | undefined): number => hearts(bond?.[npc as NpcId] ?? 0);

/** NPCs whose whole-heart count went up between two profile pushes (nothing on the first push: `prev` is null). */
export function heartUps(prev: BondMap | null | undefined, next: BondMap | null | undefined): { npc: NpcId; hearts: number }[] {
  if (!prev || !next) return [];
  return (Object.keys(next) as NpcId[]).flatMap((npc) => (hearts(next[npc] ?? 0) > hearts(prev[npc] ?? 0) ? [{ npc, hearts: hearts(next[npc] ?? 0) }] : []));
}

// ---------------------------------------------------------------- board diffs

/** Recados that moved into `done` between two boards. */
export function finishedRecados(prev: RecadoBoard | null, next: RecadoBoard | null): RecadoDef[] {
  if (!prev || !next) return [];
  return next.done.filter((id) => !prev.done.includes(id)).flatMap((id) => recadoById(id) ?? []);
}

/** Keys of tracker entries whose step advanced (or that just finished): they get the ✓ animation. */
export function advancedKeys(prev: RecadoBoard | null, next: RecadoBoard | null): string[] {
  if (!prev || !next) return [];
  const out: string[] = [];
  for (const a of prev.active) {
    const now = next.active.find((x) => x.id === a.id);
    if (now ? now.step > a.step : next.done.includes(a.id)) out.push(a.id);
  }
  return out;
}

/** Tutorial steps newly done between two profile pushes. */
export function tutorialAdvanced(prev: PrivateProfile['tutorial'] | null | undefined, next: PrivateProfile['tutorial'] | null | undefined): boolean {
  if (!prev || !next) return false;
  return TUTORIAL_STEPS.some((s) => next[s.id] && !prev[s.id]);
}

// ---------------------------------------------------------------- talking to an NPC

/** The offer an NPC makes today: one of their own offered recados not declined this session, while there is room to accept it. */
export function offerFrom(board: RecadoBoard | null, npc: NpcId, declined: ReadonlySet<string> = new Set()): RecadoOfferView | null {
  if (!board || board.active.length >= RECADO_MAX_ACTIVE) return null;
  return board.offered.find((o) => o.giver === npc && !declined.has(o.id)) ?? null;
}

export interface GiveOption {
  itemId: string;
  qty: number;
  name: Bilingual;
  /** the recado this hand-over belongs to */
  recadoId: string;
}

/** What the player can hand to an NPC right now: active `entregar` steps for them whose item is in the bag. */
export function giveOptions(board: RecadoBoard | null, bag: Record<string, number> | undefined, npc: NpcId): GiveOption[] {
  const out: GiveOption[] = [];
  for (const a of board?.active ?? []) {
    const step = recadoById(a.id)?.steps[a.step];
    if (step?.kind !== 'entregar' || !sameNpcRole(step.npc, npc) || (bag?.[step.itemId] ?? 0) < step.qty) continue;
    if (out.some((o) => o.itemId === step.itemId)) continue;
    out.push({ itemId: step.itemId, qty: step.qty, name: itemById(step.itemId)?.name ?? { pt: step.itemId, en: step.itemId }, recadoId: a.id });
  }
  return out;
}

// ---------------------------------------------------------------- journal

export interface BagItemView {
  itemId: string;
  name: Bilingual;
  qty: number;
}

export function bagView(bag: Record<string, number> | undefined): BagItemView[] {
  return Object.entries(bag ?? {})
    .filter(([id, q]) => q > 0 && itemById(id))
    .map(([itemId, qty]) => ({ itemId, qty, name: itemById(itemId)!.name }));
}

export interface FriendView {
  npc: NpcId;
  name: string;
  points: number;
  hearts: HeartsView;
}

/** The neighbours the journal lists hearts for. */
export const JOURNAL_FRIENDS: readonly NpcId[] = ['carlos', 'graca', 'nanda', 'julia', 'prof'];

export interface JournalView {
  tutorial: { entry: TrackerEntry; steps: { id: string; pt: string; en: string; done: boolean }[] } | null;
  active: (RecadoActiveView & { reward: RecadoDef["reward"] })[];
  offered: RecadoOfferView[];
  done: RecadoDef[];
  bag: BagItemView[];
  friends: FriendView[];
}

export function journalView(board: RecadoBoard | null, p: PrivateProfile | null | undefined): JournalView {
  const defOf = (id: string) => RECADOS.find((d) => d.id === id);
  return {
    tutorial: p && tutorialPending(p) ? { entry: tutorialEntry(p), steps: TUTORIAL_STEPS.map((s) => ({ id: s.id, pt: s.pt, en: s.en, done: !!p.tutorial[s.id] })) } : null,
    active: (board?.active ?? []).flatMap((a) => {
      const d = defOf(a.id);
      return d ? [{ ...a, reward: d.reward }] : [];
    }),
    offered: board?.offered ?? [],
    done: (board?.done ?? []).flatMap((id) => defOf(id) ?? []),
    bag: bagView(p?.bag),
    friends: JOURNAL_FRIENDS.map((npc) => ({ npc, name: npcName(npc), points: p?.bond?.[npc] ?? 0, hearts: heartsView(p?.bond?.[npc]) })),
  };
}

/** One line per step of an active recado with its done / current / later state (for the journal's step list). */
export function stepStates(a: RecadoActiveView, def: RecadoDef | undefined, describe: (s: RecadoDef['steps'][number]) => Bilingual): { text: Bilingual; state: 'done' | 'now' | 'later' }[] {
  return (def?.steps ?? []).map((s, i) => ({ text: describe(s), state: i < a.step ? 'done' : i === a.step ? 'now' : 'later' }));
}
