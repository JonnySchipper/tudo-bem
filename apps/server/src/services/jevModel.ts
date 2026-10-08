import fs from 'node:fs';
import path from 'node:path';
import {
  ESCALATE_NOTE,
  SAFETY_NOTES,
  SAFETY_SEVERITY,
  deobfuscate,
  normalize,
  type JevModelTrace,
  type SafetyAction,
  type SafetyLabel,
  type SafetyVerdict,
} from '@tudobem/shared';
import modelPack from '../../../../content/safety/phase0/jev/model-pack.json';
import type { ChatSafetyCtx, ChatSafetyService } from './interfaces.js';

/**
 * Jev model layer (server, authoritative). The stub's instant rules run first; whatever they let through
 * (allow / warn) is scored by a small multilingual toxicity classifier, in-process on CPU:
 *
 *   Horizon-Labs/multilingual-toxicity-small: Apache-2.0, mmBERT-small (141M params), 34 languages incl. pt + en,
 *   Detoxify labels, int8-embedding ONNX (268 MB), ~25 ms per message on one core. See DECISIONS.md.
 *
 * The model can only make a verdict stricter, never looser, and chat is never rewritten. On load failure,
 * error or timeout the stub verdict stands (logged as `jev.fallback`).
 */

export const TOX_LABELS = ['toxicity', 'severe_toxicity', 'obscene', 'threat', 'insult', 'identity_attack', 'sexual_explicit'] as const;
export type ToxLabel = (typeof TOX_LABELS)[number];
export type ToxScores = Record<ToxLabel, number>;

export interface ToxModel {
  readonly id: string;
  /** One score set per text (sigmoid probabilities). */
  score(texts: string[]): Promise<ToxScores[]>;
}

/**
 * Thresholds, tuned on the v0.1 public-chat fixtures, the PT-slang allowlist (0% false blocks) and
 * content/safety/phase0/jev/model-pack.json (harassment, banter and compliment guards).
 * "Directed" = the message addresses someone (você / seu / you / ...). The model scores friendly banter
 * ("você é fera", "you're a beast") up to ~0.75, so a directed message only warns from 0.77 unless it also
 * carries an insult cue word (lixo, nojo, worthless, ...), which lowers the bar to the `cue*` values.
 */
export const JEV_THRESHOLDS = {
  /** threat label → escalate (human review). PT idioms score high ("quero matar essa saudade" 0.92), so undirected needs 0.97. */
  threat: 0.97,
  threatDirected: 0.88,
  block: 0.95,
  blockDirected: 0.88,
  cueBlock: 0.7,
  /** Undirected warn sits above "quero matar essa saudade" (toxicity 0.88). */
  warn: 0.9,
  warnDirected: 0.77,
  cueWarn: 0.6,
  /** Sender's recent lines + this one: judged like one message, only if it scores this much above their earlier lines. */
  contextLift: 0.3,
} as const;

export const JEV_TIMEOUT_MS = 400;
/** Recent room lines the world passes in; the model reads the sender's own last few of them. */
export const JEV_CONTEXT_LINES = 6;
const OWN_CONTEXT = 3;

const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Insult cue words from the model pack (normalized, whole words / phrases). */
const CUES = new RegExp(`(^|[^a-z])(${modelPack.directed_insult_cues.map((c) => normalize(c).split(/\s+/).map(esc).join('\\s+')).join('|')})(?=$|[^a-z])`);
const DIRECTED = /(^|[^a-z])(voce|voces|vc|vcs|tu|te|ti|contigo|seu|sua|seus|suas|teu|tua|teus|tuas|you|your|youre|yours|yourself|ur|u)(?=$|[^a-z])/;
const LEET = /[a-z][013457@$]|[013457@$][a-z]/i;

/** The sender's own last few delivered lines in this room, oldest first. */
const ownLines = (ctx: ChatSafetyCtx) => (ctx.recent ?? []).filter((r) => r.playerId === ctx.playerId).slice(-OWN_CONTEXT).map((r) => r.text);
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Abuse score of one variant: every label except threat (threat has its own rule). */
const abuse = (s: ToxScores) => Math.max(s.toxicity, s.severe_toxicity, s.insult, s.obscene, s.identity_attack, s.sexual_explicit);
const worst = (all: ToxScores[]) => all.reduce((a, b) => (abuse(b) > abuse(a) ? b : a));

function labelFor(s: ToxScores): SafetyLabel {
  const parts: [SafetyLabel, number][] = [
    ['bullying', Math.max(s.insult, s.toxicity * 0.9)],
    ['profanity', s.obscene],
    ['sexual', s.sexual_explicit],
    ['slur', s.identity_attack],
  ];
  return parts.sort((a, b) => b[1] - a[1])[0][0];
}

export interface ModelDecision {
  action: SafetyAction;
  label?: SafetyLabel;
  rule?: string;
  score: number;
  scores: ToxScores;
  context?: number;
}

const threatOf = (all: ToxScores[]) => Math.max(...all.map((v) => v.threat));

/** One message (or one stitched context block) → action. */
function judgeText(text: string, variants: ToxScores[]): ModelDecision {
  const T = JEV_THRESHOLDS;
  const s = worst(variants);
  const score = abuse(s);
  const threat = threatOf(variants);
  const plain = deobfuscate(normalize(text));
  const directed = DIRECTED.test(plain);
  const cue = directed && CUES.test(plain);
  const blockAt = cue ? T.cueBlock : directed ? T.blockDirected : T.block;
  const warnAt = cue ? T.cueWarn : directed ? T.warnDirected : T.warn;
  const rule = cue ? 'jev-model.directed-cue' : directed ? 'jev-model.directed' : 'jev-model.toxic';
  const base = { score: r2(Math.max(score, threat)), scores: s };
  if (threat >= (directed ? T.threatDirected : T.threat)) return { ...base, action: 'escalate', label: 'bullying', rule: 'jev-model.threat' };
  if (score >= blockAt) return { ...base, action: 'block', label: labelFor(s), rule };
  if (score >= warnAt) return { ...base, action: 'warn', label: labelFor(s), rule };
  return { ...base, action: 'allow' };
}

/**
 * Map model scores to an action. Pure; unit-tested.
 * `variants` = scores of the message as typed (+ its de-obfuscated form). `ctx` = the sender's own recent lines
 * (oldest first), the score of those lines + this message stitched together, and each earlier line's score: a
 * message split over several lines ("você é" / "um lixo") is judged as one, but only when the stitched block is
 * clearly worse than what they had already said (no punishing a clean line for an older one).
 */
export function decide(text: string, variants: ToxScores[], ctx?: { lines: string[]; combined: ToxScores; prev: ToxScores[] }): ModelDecision {
  const single = judgeText(text, variants);
  if (!ctx) return single;
  const stitched = judgeText([...ctx.lines, text].join('\n'), [ctx.combined]);
  const prevMax = Math.max(0, ...ctx.prev.map((p) => Math.max(abuse(p), p.threat)));
  if (stitched.score - prevMax >= JEV_THRESHOLDS.contextLift && SAFETY_SEVERITY[stitched.action] > SAFETY_SEVERITY[single.action])
    return { ...stitched, rule: 'jev-model.context', context: stitched.score };
  return { ...single, context: stitched.score };
}

/** Stricter of stub and model; the stub's precise labels win ties. Never rewrites: warn keeps the text verbatim. */
export function mergeVerdict(base: SafetyVerdict, text: string, d: ModelDecision, trace: JevModelTrace): SafetyVerdict {
  if (SAFETY_SEVERITY[d.action] <= SAFETY_SEVERITY[base.action] || !d.label) return { ...base, jev: trace };
  const action = d.action;
  return {
    action,
    labels: [...new Set([...base.labels, d.label])],
    rules: [...base.rules, d.rule ?? 'jev-model'],
    text: action === 'warn' || action === 'allow' ? text.trim() : '',
    note: action === 'escalate' ? ESCALATE_NOTE : SAFETY_NOTES[d.label],
    toxicity: Math.max(base.toxicity, d.score),
    jev: trace,
  };
}

class Lru<V> {
  private m = new Map<string, V>();
  constructor(private cap: number) {}
  get(k: string) {
    const v = this.m.get(k);
    if (v !== undefined) {
      this.m.delete(k);
      this.m.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.m.set(k, v);
    if (this.m.size > this.cap) this.m.delete(this.m.keys().next().value!);
  }
}

/** Load the ONNX model + tokenizer from a folder written by scripts/fetch-jev-model.py. Warm (one dummy run) before resolving. */
export async function loadOnnxToxModel(dir: string, opts: { threads?: number } = {}): Promise<ToxModel> {
  const ortMod = await import('onnxruntime-node');
  // CommonJS package: Node ESM exposes it as `default` (esbuild's bundle as the namespace itself).
  const ort = ortMod.default ?? (ortMod as unknown as typeof ortMod.default);
  const { Tokenizer } = await import('@huggingface/tokenizers');
  const onnxDir = path.join(dir, 'onnx');
  // model_ext.onnx (external weights, Docker) needs about half the resident memory of the single-file export.
  const file = ['model_ext.onnx', 'model_quantized.onnx'].map((f) => path.join(onnxDir, f)).find((f) => fs.existsSync(f));
  if (!file) throw new Error(`jev: no model in ${onnxDir} (run scripts/fetch-jev-model.py)`);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')) as { id2label: Record<string, string>; pad_token_id?: number };
  const labels = Object.keys(config.id2label)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => config.id2label[k] as ToxLabel);
  for (const l of TOX_LABELS) if (!labels.includes(l)) throw new Error(`jev: model has no "${l}" label`);
  const tokenizer = new Tokenizer(
    JSON.parse(fs.readFileSync(path.join(dir, 'tokenizer.json'), 'utf8')),
    JSON.parse(fs.readFileSync(path.join(dir, 'tokenizer_config.json'), 'utf8')),
  );
  const threads = opts.threads ?? 1;
  const session = await ort.InferenceSession.create(file, { intraOpNumThreads: threads, interOpNumThreads: 1, enableCpuMemArena: false, graphOptimizationLevel: 'all' });
  const pad = BigInt(config.pad_token_id ?? 0);
  const MAX_TOKENS = 256;
  const revision = (() => {
    try {
      return fs.readFileSync(path.join(dir, 'REVISION'), 'utf8').trim();
    } catch {
      return path.basename(dir);
    }
  })();

  const model: ToxModel = {
    id: revision.replace(/@([0-9a-f]{7})[0-9a-f]+$/, '@$1'),
    async score(texts) {
      if (!texts.length) return [];
      const enc = texts.map((t) => {
        const ids = tokenizer.encode(t).ids;
        // Keep the start token and the newest tokens (context is oldest-first, the new message last).
        return ids.length > MAX_TOKENS ? [ids[0], ...ids.slice(ids.length - MAX_TOKENS + 1)] : ids;
      });
      const len = Math.max(...enc.map((e) => e.length));
      const ids = new BigInt64Array(texts.length * len).fill(pad);
      const mask = new BigInt64Array(texts.length * len);
      enc.forEach((e, i) =>
        e.forEach((id, j) => {
          ids[i * len + j] = BigInt(id);
          mask[i * len + j] = 1n;
        }),
      );
      const out = await session.run({
        input_ids: new ort.Tensor('int64', ids, [texts.length, len]),
        attention_mask: new ort.Tensor('int64', mask, [texts.length, len]),
      });
      const logits = out[session.outputNames[0]].data as Float32Array;
      const n = labels.length;
      return texts.map((_, i) => {
        const s = {} as ToxScores;
        labels.forEach((l, j) => (s[l] = 1 / (1 + Math.exp(-logits[i * n + j]))));
        return s;
      });
    },
  };
  await model.score(['oi, tudo bem?']);
  return model;
}

export interface JevStatus {
  state: 'loading' | 'ready' | 'failed';
  model?: string;
  error?: string;
  loadMs?: number;
  /** Model latency over the last few hundred checks (ms). */
  n: number;
  p50?: number;
  p95?: number;
  fallbacks: number;
}

/** Server ChatSafetyService: stub first (instant, also the fallback), then the Jev model on what the stub lets through. */
export class JevModelSafety implements ChatSafetyService {
  private model: ToxModel | null = null;
  private state: JevStatus['state'] = 'loading';
  private error?: string;
  private loadMs?: number;
  private readonly lat: number[] = [];
  private fallbacks = 0;
  private readonly cache = new Lru<ToxScores>(4000);
  private readonly timeoutMs: number;

  constructor(
    private readonly stub: ChatSafetyService,
    model: ToxModel | Promise<ToxModel>,
    opts: { timeoutMs?: number } = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? JEV_TIMEOUT_MS;
    const t0 = performance.now();
    Promise.resolve(model).then(
      (m) => {
        this.model = m;
        this.state = 'ready';
        this.loadMs = Math.round(performance.now() - t0);
      },
      (e: unknown) => {
        this.state = 'failed';
        this.error = e instanceof Error ? e.message : String(e);
      },
    );
  }

  /** Resolves once the model is ready or has failed (startup logging, tests). */
  async ready(): Promise<JevStatus> {
    while (this.state === 'loading') await new Promise((r) => setTimeout(r, 25));
    return this.status();
  }

  status(): JevStatus {
    const sorted = [...this.lat].sort((a, b) => a - b);
    const q = (p: number) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 10) / 10 : undefined);
    return { state: this.state, model: this.model?.id, error: this.error, loadMs: this.loadMs, n: sorted.length, p50: q(0.5), p95: q(0.95), fallbacks: this.fallbacks };
  }

  async classify(text: string, ctx: ChatSafetyCtx): Promise<SafetyVerdict> {
    const base = await this.stitchedStub(text, ctx, await this.stub.classify(text, ctx));
    // The stub already stops it (blocklist / PII / overlays): no model call needed.
    if (base.action === 'block' || base.action === 'escalate') return base;
    const model = this.model;
    if (!model) return this.fallback(base, ctx, 'unavailable', 0, this.state === 'failed' ? 'failed' : 'loading');
    const t0 = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const judged = await Promise.race([
        this.judge(model, text, ctx),
        new Promise<never>((_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), this.timeoutMs))),
      ]);
      const ms = performance.now() - t0;
      this.lat.push(ms);
      if (this.lat.length > 500) this.lat.shift();
      const trace: JevModelTrace = {
        model: model.id,
        score: judged.score,
        scores: Object.fromEntries(TOX_LABELS.map((l) => [l, r2(judged.scores[l])])),
        ...(judged.context !== undefined ? { context: judged.context } : {}),
        ...(judged.rule && SAFETY_SEVERITY[judged.action] > SAFETY_SEVERITY[base.action] ? { rule: judged.rule } : {}),
        ms: Math.round(ms * 10) / 10,
      };
      return mergeVerdict(base, text, judged, trace);
    } catch (e) {
      const ms = performance.now() - t0;
      return this.fallback(base, ctx, e instanceof Error && e.message === 'timeout' ? 'timeout' : 'error', ms, model.id);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Context for the instant rules: run the stub on the sender's recent lines + this one joined ("kill" / "yourself",
   * "f" / "u" / "c" / "k"). Only counts when the joined text is stricter than both this line and the earlier lines.
   */
  private async stitchedStub(text: string, ctx: ChatSafetyCtx, base: SafetyVerdict): Promise<SafetyVerdict> {
    if (base.action === 'block' || base.action === 'escalate') return base;
    const own = ownLines(ctx);
    if (!own.length) return base;
    const solo = { playerId: ctx.playerId, room: ctx.room, nameplate: ctx.nameplate };
    const joined = await this.stub.classify([...own, text.trim()].join(' '), solo);
    if (SAFETY_SEVERITY[joined.action] <= SAFETY_SEVERITY[base.action]) return base;
    const before = await this.stub.classify(own.join(' '), solo);
    if (SAFETY_SEVERITY[joined.action] <= SAFETY_SEVERITY[before.action]) return base;
    return { ...joined, rules: joined.rules.map((r) => `${r}+context`), text: joined.action === 'warn' ? text.trim() : '' };
  }

  private async judge(model: ToxModel, text: string, ctx: ChatSafetyCtx): Promise<ModelDecision> {
    const norm = normalize(text);
    const deob = deobfuscate(norm);
    const variants = [text.trim()];
    if (deob !== norm || LEET.test(text)) variants.push(deob);
    const own = ownLines(ctx);
    const combined = own.length ? [...own, text.trim()].join('\n') : null;
    const all = [...variants, ...own, ...(combined ? [combined] : [])];
    const scores = await this.scoreCached(model, all);
    const v = scores.slice(0, variants.length);
    const prev = scores.slice(variants.length, variants.length + own.length);
    return decide(text.trim(), v, combined ? { lines: own, combined: scores[scores.length - 1], prev } : undefined);
  }

  private async scoreCached(model: ToxModel, texts: string[]): Promise<ToxScores[]> {
    const out: (ToxScores | undefined)[] = texts.map((t) => this.cache.get(t));
    const miss = [...new Set(texts.filter((_, i) => !out[i]))];
    if (miss.length) {
      const got = await model.score(miss);
      miss.forEach((t, i) => this.cache.set(t, got[i]));
    }
    return texts.map((t, i) => out[i] ?? this.cache.get(t)!);
  }

  /**
   * Model down / slow: the stub verdict stands. For an under-13 sender (not live in Phase 0, which is 18+) a stub
   * "warn" is held for review instead of delivered, since nothing confirmed it.
   */
  private fallback(base: SafetyVerdict, ctx: ChatSafetyCtx, why: NonNullable<JevModelTrace['fallback']>, ms: number, model: string): SafetyVerdict {
    this.fallbacks++;
    const jev: JevModelTrace = { model, ms: Math.round(ms * 10) / 10, fallback: why };
    if (ctx.under13 && base.action === 'warn') return { ...base, action: 'escalate', text: '', note: ESCALATE_NOTE, rules: [...base.rules, 'jev-model.fallback-hold'], jev };
    return { ...base, jev };
  }
}

/**
 * Startup self-check (logged): the model pack's catches and banter guards through the live safety path, with
 * latency. Proves on the deployed machine that the model loaded, thresholds hold and the latency budget fits.
 */
export async function jevSelfCheck(safety: ChatSafetyService): Promise<{ pass: number; total: number; failed: string[]; p50: number; p95: number }> {
  const cases = [
    ...modelPack.fixtures.map((f) => ({ text: f.text, recent: f.recent ?? [], want: f.action })),
    ...modelPack.guards.map((g) => ({ text: g.text, recent: g.recent ?? [], want: 'allow' })),
  ];
  const lat: number[] = [];
  const failed: string[] = [];
  for (const c of cases) {
    const t0 = performance.now();
    const v = await safety.classify(c.text, {
      playerId: 'jev-selfcheck',
      room: 'selfcheck',
      nameplate: 'verde',
      recent: c.recent.map((text) => ({ playerId: 'jev-selfcheck', text })),
    });
    lat.push(performance.now() - t0);
    if (v.action !== c.want || v.jev?.fallback) failed.push(`${c.text} → ${v.action}${v.jev?.fallback ? ` (${v.jev.fallback})` : ''}`);
  }
  lat.sort((a, b) => a - b);
  const q = (p: number) => Math.round(lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] * 10) / 10;
  return { pass: cases.length - failed.length, total: cases.length, failed, p50: q(0.5), p95: q(0.95) };
}
