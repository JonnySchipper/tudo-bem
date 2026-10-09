import { CONVERSA_AXES, type ConversaLine, type ConversaScores, type NpcId, type Score03 } from '@tudobem/shared';

/**
 * Server-side state of each running Conversa (one per player per NPC). The grade at `end` comes only from here:
 * the turns the server answered and the scores it computed, never from what the client says it scored.
 * Everything is in memory and bounded: a session expires after `ttlMs` without a turn, and a server restart
 * simply forgets it (the client then plays on offline and earns nothing, as before).
 */
export interface ConversaSession {
  npc: NpcId;
  subjectId: string;
  /** Player lines the server answered (Gate A blocks do not count). */
  turns: number;
  /** Turns waiting on the model (they hold a slot so parallel requests cannot pass the cap). */
  pending: number;
  /** One entry per answered turn, as the server returned it. */
  scores: ConversaScores[];
  /** The transcript the server saw (opener, player lines that passed the gate, NPC replies), capped. */
  lines: ConversaLine[];
  /** Chip strings sent on the last response, so the next turn can avoid repeating them. */
  lastChips: string[];
  at: number;
}

export interface ConversaSessionsOptions {
  now?: () => number;
  ttlMs?: number;
  maxSessions?: number;
  /** Turn requests per player per rolling minute. */
  turnsPerMinute?: number;
  /** Turn requests per player per rolling day. */
  turnsPerDay?: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 5000;
const MAX_LINES = 16;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface TurnBudget {
  minute: number[];
  dayStart: number;
  dayCount: number;
}

export class ConversaSessions {
  private readonly sessions = new Map<string, ConversaSession>();
  private readonly budgets = new Map<string, TurnBudget>();

  constructor(private readonly o: ConversaSessionsOptions = {}) {}

  private now() {
    return (this.o.now ?? Date.now)();
  }

  private static key(playerId: string, npc: NpcId) {
    return `${playerId}|${npc}`;
  }

  /** A fresh Conversa (replaces any running one with the same NPC). */
  start(playerId: string, npc: NpcId, subjectId: string, opener: string, chips: string[]): ConversaSession {
    const key = ConversaSessions.key(playerId, npc);
    this.sessions.delete(key);
    const session: ConversaSession = { npc, subjectId, turns: 0, pending: 0, scores: [], lines: [{ who: 'npc', pt: opener }], lastChips: chips, at: this.now() };
    this.sessions.set(key, session);
    const max = this.o.maxSessions ?? DEFAULT_MAX_SESSIONS;
    while (this.sessions.size > max) this.sessions.delete(this.sessions.keys().next().value as string);
    return session;
  }

  /** The running Conversa, or undefined when there is none or it expired. */
  get(playerId: string, npc: NpcId): ConversaSession | undefined {
    const key = ConversaSessions.key(playerId, npc);
    const s = this.sessions.get(key);
    if (!s) return undefined;
    if (this.now() - s.at > (this.o.ttlMs ?? DEFAULT_TTL_MS)) {
      this.sessions.delete(key);
      return undefined;
    }
    return s;
  }

  /** Record a turn the server answered. */
  turn(s: ConversaSession, playerLine: string, npcLine: string, scores: ConversaScores, chips: string[]) {
    s.turns++;
    s.scores.push(scores);
    s.lines.push({ who: 'player', pt: playerLine }, { who: 'npc', pt: npcLine });
    while (s.lines.length > MAX_LINES) s.lines.shift();
    s.lastChips = chips;
    s.at = this.now();
  }

  /** Remove and return the running Conversa (each one can end once). */
  take(playerId: string, npc: NpcId): ConversaSession | undefined {
    const s = this.get(playerId, npc);
    this.sessions.delete(ConversaSessions.key(playerId, npc));
    return s;
  }

  /** Count a turn request against the player's budget. False when over the per-minute or per-day limit. */
  allowTurn(playerId: string): boolean {
    const now = this.now();
    let b = this.budgets.get(playerId);
    if (!b) {
      b = { minute: [], dayStart: now, dayCount: 0 };
      this.budgets.set(playerId, b);
      if (this.budgets.size > (this.o.maxSessions ?? DEFAULT_MAX_SESSIONS)) this.budgets.delete(this.budgets.keys().next().value as string);
    }
    if (now - b.dayStart >= DAY_MS) {
      b.dayStart = now;
      b.dayCount = 0;
    }
    b.minute = b.minute.filter((t) => now - t < MINUTE_MS);
    if (b.minute.length >= (this.o.turnsPerMinute ?? 20) || b.dayCount >= (this.o.turnsPerDay ?? 300)) return false;
    b.minute.push(now);
    b.dayCount++;
    return true;
  }
}

/** The scores a Conversa ends with: each axis averaged over the server's turns and rounded (what the client showed). */
export function finalScores(scores: ConversaScores[]): ConversaScores {
  const out = { portuguese: 0, grammar: 0, conversation: 0 } as ConversaScores;
  if (!scores.length) return out;
  for (const axis of CONVERSA_AXES) {
    out[axis.id] = Math.round(scores.reduce((a, s) => a + s[axis.id], 0) / scores.length) as Score03;
  }
  return out;
}
