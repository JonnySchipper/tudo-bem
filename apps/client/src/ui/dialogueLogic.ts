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

/** One English setting: the dialogue's "Mostrar inglês" and the gear's "Inglês" (`game.englishHelp`) share this key. */
export const SHOW_EN_KEY = 'tb_english';

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
