import {
  CONVERSA_CAST,
  CONVERSA_SUBJECTS,
  templateMemory,
  vetMemory,
  type ConversaLine,
  type ConversaOrder,
  type ConversaSubject,
  type NpcId,
} from '@tudobem/shared';
import { isXaiReady, summarizeConversa } from './services/xai.js';
import type { ProfileStore } from './store.js';

/** What the summarizer is given. The transcript is only ever read, never stored on the profile. */
export interface SummaryInput {
  npc: NpcId;
  npcName: string;
  subjectTitle: string;
  lines: ConversaLine[];
}

export interface ConversaMemoryDeps {
  store: ProfileStore;
  /** One-sentence PT summary from the model, or null when there is no key, it failed or it timed out. */
  aiSummary?: (input: SummaryInput) => Promise<string | null>;
  /** Called when a late (AI) summary replaces the template one, so the live session gets the new profile. */
  onProfileChanged?: (playerId: string) => void;
  now?: () => number;
  /** How long to wait for the model before keeping the template line. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 4000;
const MAX_LOGS = 200;
const LOG_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_LINES = 14;
const MAX_LINE_CHARS = 240;

interface Log {
  subjectId: string;
  lines: ConversaLine[];
  at: number;
}

const defaultAi = async (input: SummaryInput): Promise<string | null> => ((await isXaiReady()) ? summarizeConversa(input) : null);

/**
 * NPC memory for the Conversa HTTP flow (HOWTO Phase 8 step 5). The API reports each line here, and when the
 * Conversa ends a short vetted PT summary lands in `profile.npcMemory[npc]`.
 *
 * The transcript lives only in this process's memory while the Conversa runs (bounded, expires, dropped at the
 * end) so the summarizer can read it; it is never written to the profile, and a summary that repeats a run of
 * the player's own words is rejected by `vetMemory`.
 */
export class ConversaMemory {
  private readonly logs = new Map<string, Log>();
  private readonly latest = new Map<string, number>();
  private seq = 0;

  constructor(private readonly d: ConversaMemoryDeps) {}

  private now() {
    return (this.d.now ?? Date.now)();
  }

  private static key(playerId: string, npc: NpcId) {
    return `${playerId}|${npc}`;
  }

  /** The stored memory line for the prompt of this player's next Conversa with the NPC, if any. */
  get(playerId: string | undefined, npc: NpcId): string | undefined {
    return (playerId ? this.d.store.get(playerId)?.npcMemory?.[npc] : undefined) || undefined;
  }

  /** A line was said in this player's Conversa (the opener, a player line that passed the gate, the NPC's reply). */
  record(playerId: string | undefined, npc: NpcId, subjectId: string, who: ConversaLine['who'], pt: string) {
    if (!playerId || typeof pt !== 'string' || !pt.trim()) return;
    const key = ConversaMemory.key(playerId, npc);
    const now = this.now();
    let log = this.logs.get(key);
    if (!log || log.subjectId !== subjectId || now - log.at > LOG_TTL_MS) {
      this.logs.delete(key);
      log = { subjectId, lines: [], at: now };
      this.logs.set(key, log);
      while (this.logs.size > MAX_LOGS) this.logs.delete(this.logs.keys().next().value as string);
    }
    log.lines.push({ who, pt: pt.slice(0, MAX_LINE_CHARS) });
    if (log.lines.length > MAX_LINES) log.lines.shift();
    log.at = now;
  }

  /**
   * The Conversa ended. The deterministic template line is stored right away (never blocks, never lost);
   * with AI available a better summary replaces it if it arrives in time and passes the vetting.
   * The returned promise never rejects; callers can ignore it (tests await it).
   */
  end(playerId: string, npc: NpcId, order?: ConversaOrder): Promise<void> {
    const key = ConversaMemory.key(playerId, npc);
    const log = this.logs.get(key);
    this.logs.delete(key);
    const p = this.d.store.get(playerId);
    const subject: ConversaSubject | undefined = log ? (CONVERSA_SUBJECTS[log.subjectId] ?? CONVERSA_CAST[npc]?.subjects[0]) : undefined;
    const playerLines = log?.lines.filter((l) => l.who === 'player').map((l) => l.pt) ?? [];
    if (!p || !log || !subject || !playerLines.length) return Promise.resolve();

    const token = ++this.seq;
    this.latest.set(key, token);
    const template = vetMemory(templateMemory({ subject, playerLines, order }), playerLines);
    if (template) this.save(playerId, npc, template, false);

    const ai = this.d.aiSummary ?? defaultAi;
    const input: SummaryInput = { npc, npcName: CONVERSA_CAST[npc]?.name ?? npc, subjectTitle: subject.title.pt, lines: log.lines };
    return this.withTimeout(async () => ai(input))
      .then((raw) => {
        const vetted = vetMemory(raw, playerLines);
        if (vetted && this.latest.get(key) === token) this.save(playerId, npc, vetted, true);
      })
      .catch(() => {})
      .finally(() => {
        // a newer end() owns the key now; otherwise nothing is waiting on it
        if (this.latest.get(key) === token) this.latest.delete(key);
      });
  }

  private save(playerId: string, npc: NpcId, text: string, late: boolean) {
    const p = this.d.store.get(playerId);
    if (!p) return;
    p.npcMemory = { ...p.npcMemory, [npc]: text };
    this.d.store.save(playerId);
    if (late) this.d.onProfileChanged?.(playerId);
  }

  private withTimeout(work: () => Promise<string | null>): Promise<string | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), this.d.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      (timer as unknown as { unref?: () => void }).unref?.();
    });
    return Promise.race([work().catch(() => null), timeout]).finally(() => clearTimeout(timer));
  }
}
