import type { Bilingual, JevModelTrace, ReportReason, JevNpcReplyAnswers, Nameplate, PrivateProfile, SafetyVerdict, SceneCtx, SceneView, TypedReplyScore } from '@tudobem/shared';

/**
 * Seams for the AI services described in GDD §5.9 / §12.3.
 * Phase 0 wires deterministic stubs; later phases swap implementations without touching the world code.
 */

export interface ChatSafetyCtx {
  playerId: string;
  room: string;
  nameplate: Nameplate;
  /** The room's last few delivered lines, oldest first (the Jev model reads the sender's own recent lines). */
  recent?: ReadonlyArray<{ playerId: string; text: string }>;
  /** Under-13 sender: hold unconfirmed warns when the model is down (design-only in Phase 0, which is 18+). */
  under13?: boolean;
}

/** Jev chat classifier: safe / warn / block / escalate on every message (<400ms p95 target). */
export interface ChatSafetyService {
  classify(text: string, ctx: ChatSafetyCtx): Promise<SafetyVerdict>;
}

/** English gloss under Portuguese bubbles for Verde/Amarelo viewers. */
export interface GlossService {
  gloss(text: string): Promise<{ gloss: string | null; lang: 'pt' | 'en' | 'mix' }>;
}

/**
 * NPC dialogue. Phase 0: authored graph + chips only.
 * Phase 1: an LLM writes lines under constraints (word caps, must-include cards), gated by Jev.
 * If Jev is down the world falls back to this authored provider.
 */
export interface NpcDialogueService {
  start(npcId: string, ctx: SceneCtx): SceneView;
  choose(npcId: string, nodeId: string, chip: number, ctx: SceneCtx, scoreCap?: 0 | 1 | 2 | 3): { view: SceneView; score: 0 | 1 | 2 | 3; ctx: SceneCtx; said: Bilingual; cards: string[] } | null;
  /** Map a free-typed reply onto the node's chips (curriculum accept-list rules). */
  scoreTyped(npcId: string, nodeId: string, text: string, ctx: SceneCtx): TypedReplyScore;
}

export interface GradedAct {
  playerId: string;
  itemIds: string[];
  channel: 'read' | 'listen' | 'type' | 'speak' | 'chip';
  score: number;
  latencyMs: number;
  place: string;
  nameplate: Nameplate;
  at: number;
  /** Typed NPC replies: stub Jev answers to content/safety/phase0/jev/npc-reply-pack.json. */
  jev?: JevNpcReplyAnswers;
}

/** Student model: per-player, per-card memory (GDD §5.4). Writes on every graded act. */
export interface StudentModelService {
  record(act: GradedAct): void;
  /** Card ids this player should see next (spaced repetition later). */
  scheduled(playerId: string, place: string, n: number): string[];
  nameplateFor(profile: PrivateProfile): Nameplate;
  /** Forget in-memory state for players not in `keep` (the world's idle sweep). */
  prune?(keep: ReadonlySet<string>): void;
}

/** Escalation-queue row (content/safety/phase0/ops/report-mute-kick-phase0.md). `text` is the frozen snapshot. */
export interface ModerationEvent {
  kind: 'escalate' | 'block' | 'warn' | 'report';
  surface: 'chat' | 'npc_reply' | 'profile' | 'feedback';
  playerId: string;
  playerName: string;
  room: string;
  text: string;
  labels: string[];
  rules?: string[];
  toxicity?: number;
  /** Jev model layer: score, per-label scores, latency, fallback reason. */
  jev?: JevModelTrace;
  targetId?: string;
  /** Reports: who was reported, why, and their recent lines as the server saw them (never client-sent text). */
  targetName?: string;
  reason?: ReportReason;
  lines?: string[];
  /** Escalations and reports wait for a human; nothing is auto-actioned in Phase 0. */
  status?: 'pending';
  at: number;
}

/** Human review queue for Jev escalations and player reports. */
export interface ModerationQueue {
  push(ev: ModerationEvent): void;
  recent(n: number): ModerationEvent[];
}
