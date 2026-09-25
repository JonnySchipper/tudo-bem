import type { Bilingual, Nameplate, PrivateProfile, SafetyVerdict, SceneCtx, SceneView } from '@tudobem/shared';

/**
 * Seams for the AI services described in GDD §5.9 / §12.3.
 * Phase 0 wires deterministic stubs; later phases swap implementations without touching the world code.
 */

/** Jev chat classifier: safe / warn / block / escalate on every message (<400ms p95 target). */
export interface ChatSafetyService {
  classify(text: string, ctx: { playerId: string; room: string; nameplate: Nameplate }): Promise<SafetyVerdict>;
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
  choose(npcId: string, nodeId: string, chip: number, ctx: SceneCtx): { view: SceneView; score: 0 | 1 | 2 | 3; ctx: SceneCtx; said: Bilingual; cards: string[] } | null;
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
}

/** Student model: per-player, per-card memory (GDD §5.4). Writes on every graded act. */
export interface StudentModelService {
  record(act: GradedAct): void;
  /** Card ids this player should see next (spaced repetition later). */
  scheduled(playerId: string, place: string, n: number): string[];
  nameplateFor(profile: PrivateProfile): Nameplate;
}

export interface ModerationEvent {
  kind: 'escalate' | 'block' | 'warn' | 'report';
  playerId: string;
  playerName: string;
  room: string;
  text: string;
  labels: string[];
  targetId?: string;
  at: number;
}

/** Human review queue for Jev escalations and player reports. */
export interface ModerationQueue {
  push(ev: ModerationEvent): void;
  recent(n: number): ModerationEvent[];
}
