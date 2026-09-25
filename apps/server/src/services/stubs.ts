import {
  CARDS,
  chooseChip,
  classifyChat,
  glossPt,
  detectLang,
  SCENE_START,
  viewNode,
  type Nameplate,
  type SceneCtx,
} from '@tudobem/shared';
import type {
  ChatSafetyService,
  GlossService,
  GradedAct,
  ModerationEvent,
  ModerationQueue,
  NpcDialogueService,
  StudentModelService,
} from './interfaces.js';

export class JevStubSafety implements ChatSafetyService {
  private cache = new Map<string, ReturnType<typeof classifyChat>>();
  async classify(text: string) {
    const hit = this.cache.get(text);
    if (hit) return hit;
    const v = classifyChat(text);
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(text, v);
    return v;
  }
}

export class PhrasebookGloss implements GlossService {
  async gloss(text: string) {
    return { gloss: glossPt(text), lang: detectLang(text) };
  }
}

export class AuthoredNpcDialogue implements NpcDialogueService {
  start(_npcId: string, ctx: SceneCtx) {
    return viewNode(SCENE_START, ctx)!;
  }
  choose(_npcId: string, nodeId: string, chip: number, ctx: SceneCtx) {
    const r = chooseChip(nodeId, chip, ctx);
    if (!r) return null;
    const view = viewNode(r.next, r.ctx);
    if (!view) return null;
    return { view, score: r.score, ctx: r.ctx, said: r.said, cards: r.cards };
  }
}

interface CardStat {
  seen: number;
  correct: number;
  hinted: number;
  failed: number;
  lastSeen: number;
  places: Set<string>;
}

/** In-memory student model. Phase 1: Postgres + half-life regression. */
export class InMemoryStudentModel implements StudentModelService {
  private stats = new Map<string, Map<string, CardStat>>();
  readonly log: GradedAct[] = [];

  record(act: GradedAct) {
    this.log.push(act);
    if (this.log.length > 10_000) this.log.splice(0, 5_000);
    let per = this.stats.get(act.playerId);
    if (!per) this.stats.set(act.playerId, (per = new Map()));
    for (const id of act.itemIds) {
      const s = per.get(id) ?? { seen: 0, correct: 0, hinted: 0, failed: 0, lastSeen: 0, places: new Set() };
      s.seen++;
      if (act.score >= 3) s.correct++;
      else if (act.score >= 1) s.hinted++;
      else s.failed++;
      s.lastSeen = act.at;
      s.places.add(act.place);
      per.set(id, s);
    }
  }

  scheduled(playerId: string, _place: string, n: number): string[] {
    const per = this.stats.get(playerId);
    const scored = CARDS.map((c) => {
      const s = per?.get(c.id);
      // Weakest-first: unseen cards and cards with hints/fails float up.
      const weight = s ? (s.hinted + s.failed * 2 + 1) / (s.correct + 1) : 0.5;
      return { id: c.id, weight: weight + Math.random() * 0.2 };
    });
    return scored.sort((a, b) => b.weight - a.weight).slice(0, n).map((c) => c.id);
  }

  nameplateFor(): Nameplate {
    return 'verde';
  }
}

export class MemoryModerationQueue implements ModerationQueue {
  protected items: ModerationEvent[] = [];
  push(ev: ModerationEvent) {
    this.items.push(ev);
    if (this.items.length > 1000) this.items.shift();
    if (ev.kind === 'escalate' || ev.kind === 'report') console.warn(`[moderação] ${ev.kind} ${ev.playerName}: ${ev.labels.join(',')}`);
  }
  recent(n: number) {
    return this.items.slice(-n);
  }
}
