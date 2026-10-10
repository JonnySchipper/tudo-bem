/**
 * Pure logic of the in-world dialogue box (HOWTO Phase 7 step 1): the typewriter, the keys and the preferences. No DOM here, so it is unit-tested.
 */

/** The PT line types out at this speed (characters per second). */
export const TYPE_CPS = 45;

/** Number of characters shown `elapsedMs` after the line started (whole code points, so an emoji is never cut). */
export function typedCount(total: number, elapsedMs: number, cps = TYPE_CPS): number {
  if (total <= 0) return 0;
  if (!(elapsedMs > 0)) return 0;
  return Math.min(total, Math.floor((elapsedMs / 1000) * cps));
}

/** A line being typed out. `finish()` (Space or a click) shows the rest at once. */
export class Typewriter {
  private chars: string[] = [];
  private t0 = 0;
  private forced = false;
  private instant = false;

  /** Start a new line. `instant` shows it whole (reduced motion, `?notype`). */
  start(text: string, now: number, instant = false): void {
    this.chars = Array.from(text);
    this.t0 = now;
    this.forced = false;
    this.instant = instant;
  }

  get text(): string {
    return this.chars.join('');
  }

  visibleCount(now: number): number {
    return this.instant || this.forced ? this.chars.length : typedCount(this.chars.length, now - this.t0);
  }

  visible(now: number): string {
    return this.chars.slice(0, this.visibleCount(now)).join('');
  }

  isDone(now: number): boolean {
    return this.visibleCount(now) >= this.chars.length;
  }

  finish(): void {
    this.forced = true;
  }

  /** Time (ms after the start) at which the whole line is visible. */
  durationMs(cps = TYPE_CPS): number {
    return this.instant ? 0 : Math.ceil((this.chars.length / cps) * 1000);
  }
}

export type DialogueKeyAction = { kind: 'chip'; index: number } | { kind: 'skip' } | { kind: 'close' } | null;

export interface DialogueKeyCtx {
  /** how many reply chips are on screen */
  chips: number;
  /** the line is still typing out */
  typing: boolean;
  /** focus is inside a text field */
  inInput: boolean;
}

/** Chips are numbered 1-4. */
export const MAX_CHIP_KEYS = 4;

/** A box shows at most 3 content chips and one way out ("Tchau", "Agora não"): 4 in all, so keys 1-4 reach every one. */
export const MAX_CONTENT_CHIPS = 3;
export const MAX_CHIPS = MAX_CONTENT_CHIPS + 1;

/** At most `n` of `items`, the wanted ones first (each group keeps its order). For a menu longer than the box has room for. */
export function firstChoices<T>(items: readonly T[], wanted: (item: T) => boolean, n = MAX_CONTENT_CHIPS): T[] {
  return [...items.filter(wanted), ...items.filter((x) => !wanted(x))].slice(0, Math.max(0, n));
}

// ---------------------------------------------------------------- one click, one box

interface LeadLine {
  pt: string;
  en?: string;
}

/**
 * The idle line a click on an NPC opens with, waiting for the first box that click opens for that NPC (a hand-over, an errand, the
 * greeting, the counter): it is said first in that box's bubble. A re-render of that beat keeps it; the next line, another key or another
 * NPC does not.
 */
export class LeadSlot {
  private pending: { npcId: string; line: LeadLine } | null = null;
  private led: { key: string; line: string; lead: LeadLine } | null = null;

  /** Wait for `npcId`'s next box. The returned check drops the lead if no box took it and says whether one did. */
  set(npcId: string, line: LeadLine): () => boolean {
    const mine = { npcId, line };
    this.pending = mine;
    return () => {
      if (this.pending !== mine) return true;
      this.pending = null;
      return false;
    };
  }

  /** The lead for this beat of the box, or null. */
  apply(beat: { key: string; npcId: string | null; line: { pt: string } | null; thinking?: boolean }): LeadLine | null {
    if (this.pending && beat.npcId === this.pending.npcId && beat.line && !beat.thinking) {
      this.led = { key: beat.key, line: beat.line.pt, lead: this.pending.line };
      this.pending = null;
    }
    if (this.led && this.led.key === beat.key && beat.line?.pt === this.led.line) return this.led.lead;
    this.led = null;
    return null;
  }

  /** The box closed. */
  closed(): void {
    this.led = null;
  }
}

/** The lead and the line as one bubble's text. */
export const joinLead = (lead: string | undefined, line: string): string => (lead ? `${lead} ${line}` : line);

// ---------------------------------------------------------------- what the box shows once it is earned

/** Friendship hearts in the header: only once this NPC has at least one bond point (the profile's `bond`, 0-100). */
export const showsHearts = (bondPoints: number | undefined): boolean => (bondPoints ?? 0) >= 1;

/**
 * "Vamos bater um papo?" (and the counter's "Bater papo"): once the player has ordered from Seu Carlos (`tutorial.carlos`) and has at least one
 * bond point with this NPC (a greeting talked through pays one), and only when the NPC has a bate-papo to start.
 */
export const offersPapo = (o: { bondPoints: number | undefined; carlosDone: boolean | undefined; hasPapo: boolean }): boolean => o.carlosDone === true && showsHearts(o.bondPoints) && o.hasPapo;

/**
 * The padaria counter's menu chips (3 content chips at most). Until the first order (`tutorial.carlos`) the cheapest come first; after, the
 * menu in its order. What an errand wants is always kept, and the bate-papo chip only joins when the whole menu fits beside it.
 */
export function counterChoices<T extends string>(menu: readonly T[], o: { price: (id: T) => number; always: readonly T[]; carlosDone: boolean | undefined; papo: boolean }): { items: T[]; papo: boolean } {
  const ordered = o.carlosDone === true ? [...menu] : [...menu].sort((a, b) => o.price(a) - o.price(b));
  const keep = firstChoices(ordered, (id) => !o.always.includes(id));
  return { items: ordered.filter((id) => keep.includes(id)), papo: o.papo && menu.length < MAX_CONTENT_CHIPS };
}

/**
 * What a key does in the dialogue box: 1-4 pick a reply chip (not while typing in the text field), Space finishes the typing line (not in the
 * field), Escape closes (always). Everything else is left alone.
 */
export function dialogueKeyAction(key: string, ctx: DialogueKeyCtx): DialogueKeyAction {
  if (key === 'Escape') return { kind: 'close' };
  if (ctx.inInput) return null;
  if (key === ' ' || key === 'Spacebar') return ctx.typing ? { kind: 'skip' } : null;
  if (/^[1-4]$/.test(key)) {
    const index = Number(key) - 1;
    return index < Math.min(ctx.chips, MAX_CHIP_KEYS) ? { kind: 'chip', index } : null;
  }
  return null;
}

// ---------------------------------------------------------------- "Mostrar inglês" preference

export const SHOW_EN_KEY = 'tb_show_en';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Default on; a stored 'off' wins. Storage can throw (private windows), so every access is guarded. */
export function readShowEnglish(store: Store | null = safeStorage()): boolean {
  try {
    return store?.getItem(SHOW_EN_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeShowEnglish(on: boolean, store: Store | null = safeStorage()): void {
  try {
    store?.setItem(SHOW_EN_KEY, on ? 'on' : 'off');
  } catch {
    /* not persisted */
  }
}

function safeStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- name tag colours

/** The name tag takes the colour of the NPC's look (Carlos' terracotta shirt, Nanda's mustard top, Júlia's blue blouse, ...). */
export const NPC_TAG_COLORS: Record<string, string> = {
  carlos: '#c45c26',
  nanda: '#b8860b',
  julia: '#3b78b0',
  graca: '#7a5a8c',
  tia_lu: '#d9772b',
  ze: '#66753f',
  chico: '#b89a2c',
  rosa: '#c4708a',
  prof: '#4a7c59',
  // the Praia: Bento's faded blue shirt, Neide's sea teal, Jô's terracotta visor
  bento: '#3f6a9a',
  neide: '#2f8f8c',
  jo: '#c45c26',
};

export const npcTagColor = (npcId: string | null | undefined): string => (npcId && NPC_TAG_COLORS[npcId]) || '#8b5e3c';

// ---------------------------------------------------------------- camera focus

/** The middle of two world points (the player and the NPC): what the camera centres on while a dialogue is open. */
export const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
