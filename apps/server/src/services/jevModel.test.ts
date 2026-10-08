import { beforeAll, describe, expect, it } from 'vitest';
import { classifyChat } from '@tudobem/shared';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import modelPack from '../../../../content/safety/phase0/jev/model-pack.json';
import publicPack from '../../../../content/safety/phase0/jev/public-chat-pack.json';
import allowPack from '../../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';
import substancePack from '../../../../content/safety/phase0/blocklists/prohibited-substance.json';
import { JevStubSafety } from './stubs.js';
import {
  JevModelSafety,
  decide,
  loadOnnxToxModel,
  mergeVerdict,
  type ToxModel,
  type ToxScores,
} from './jevModel.js';

const MODEL_DIR = process.env.TB_JEV_MODEL_DIR || join(__dirname, '../../../../models/jev-tox-small');
const hasModel = existsSync(join(MODEL_DIR, 'onnx', 'model_quantized.onnx')) || existsSync(join(MODEL_DIR, 'onnx', 'model_ext.onnx'));
const solo = { playerId: 'p1', room: 'praca:0', nameplate: 'verde' as const };
const zero: ToxScores = { toxicity: 0, severe_toxicity: 0, obscene: 0, threat: 0, insult: 0, identity_attack: 0, sexual_explicit: 0 };
const scores = (p: Partial<ToxScores>): ToxScores => ({ ...zero, ...p });

describe('Jev model presence', () => {
  it.runIf(process.env.TB_JEV_MODEL_REQUIRED === '1')('CI fetched the model (scripts/fetch-jev-model.py)', () => {
    expect(hasModel, MODEL_DIR).toBe(true);
  });
});

describe('decide (pure thresholds)', () => {
  it('escalates a directed threat and ignores undirected PT kill-idioms', () => {
    expect(decide("I'll beat you up", [scores({ threat: 0.9, toxicity: 0.8 })]).action).toBe('escalate');
    expect(decide('quero matar essa saudade', [scores({ threat: 0.92, toxicity: 0.88 })]).action).toBe('allow');
  });

  it('blocks directed harassment with a cue word and warns without one', () => {
    expect(decide('seu lixo', [scores({ toxicity: 0.71, insult: 0.7 })]).action).toBe('block');
    expect(decide("you're crazy", [scores({ toxicity: 0.74, insult: 0.75 })]).action).toBe('allow');
    expect(decide('você é burrinho kkk', [scores({ toxicity: 0.82, insult: 0.82 })]).action).toBe('warn');
  });

  it('stitches context when the joined block is clearly worse', () => {
    const d = decide('um lixo', [scores({ toxicity: 0.15 })], {
      lines: ['você', 'é'],
      combined: scores({ toxicity: 0.84, insult: 0.84 }),
      prev: [scores({ toxicity: 0.02 }), scores({ toxicity: 0.01 })],
    });
    expect(d).toMatchObject({ action: 'block', rule: 'jev-model.context' });
  });

  it('does not punish a clean line for an older toxic one', () => {
    const d = decide('bora jogar?', [scores({ toxicity: 0.05 })], {
      lines: ['você é muito chato'],
      combined: scores({ toxicity: 0.5, insult: 0.45 }),
      prev: [scores({ toxicity: 0.6, insult: 0.58 })],
    });
    expect(d.action).toBe('allow');
  });
});

describe('mergeVerdict', () => {
  it('never loosens the stub and never rewrites chat', () => {
    const stub = classifyChat('Essa coxinha tá gostosa!');
    expect(stub.action).toBe('warn');
    const out = mergeVerdict(stub, 'Essa coxinha tá gostosa!', { action: 'allow', score: 0.1, scores: zero }, { model: 't', ms: 1 });
    expect(out.action).toBe('warn');
    expect(out.text).toBe('Essa coxinha tá gostosa!');
  });
});

// Threshold checks, not latency: generous timeouts so a busy CI runner never turns a model verdict into a stub fallback.
describe.runIf(hasModel)('JevModelSafety (Horizon-Labs/multilingual-toxicity-small)', { timeout: 120_000 }, () => {
  let safety: JevModelSafety;
  let model: ToxModel;

  beforeAll(async () => {
    model = await loadOnnxToxModel(MODEL_DIR, { threads: 1 });
    safety = new JevModelSafety(new JevStubSafety(), model, { timeoutMs: 30_000 });
    await safety.ready();
  }, 60_000);

  it('loads and warms', () => {
    expect(safety.status().state).toBe('ready');
    expect(safety.status().model).toMatch(/Horizon-Labs\/multilingual-toxicity-small@/);
  });

  it.each(modelPack.fixtures.map((f) => [f.text, f] as const))('fixture: %s', async (_t, f) => {
    const recent = (f.recent ?? []).map((text) => ({ playerId: 'p1', text }));
    const v = await safety.classify(f.text, { ...solo, recent });
    expect(v.jev?.fallback, f.text).toBeUndefined();
    expect(v.action, `${f.text} (${f.why})`).toBe(f.action);
    if (f.label) expect(v.labels, f.text).toContain(f.label);
  });

  it.each(modelPack.guards.map((g) => [g.text, g] as const))('guard allow: %s', async (_t, g) => {
    const recent = (g.recent ?? []).map((text) => ({ playerId: 'p1', text }));
    expect((await safety.classify(g.text, { ...solo, recent })).action, g.text).toBe('allow');
  });

  it('keeps every v0.1 public-chat fixture action', async () => {
    for (const f of publicPack.fixtures as { text: string; action: string }[]) {
      if (typeof f.text !== 'string') continue;
      expect((await safety.classify(f.text, solo)).action, f.text).toBe(f.action);
    }
  });

  it('PT slang allowlist — 0% false blocks through the model', async () => {
    const cases = [...allowPack.terms, ...allowPack.sentences, ...substancePack.explicitly_allowed.map((e) => e.term)];
    const bad: string[] = [];
    for (const c of cases) if ((await safety.classify(c, solo)).action !== 'allow') bad.push(c);
    expect(bad).toEqual([]);
  });

  it('falls back to the stub on timeout and holds under-13 warns', async () => {
    const hang: ToxModel = { id: 'hang', score: () => new Promise(() => {}) };
    const hung = new JevModelSafety(new JevStubSafety(), hang, { timeoutMs: 20 });
    await hung.ready();
    const v = await hung.classify('oi, tudo bem?', solo);
    expect(v.action).toBe('allow');
    expect(v.jev?.fallback).toBe('timeout');
    const hold = await hung.classify('Essa coxinha tá gostosa!', { ...solo, under13: true });
    expect(hold.action).toBe('escalate');
    expect(hold.jev?.fallback).toBe('timeout');
  });

  it('p50 / p95 latency under 300ms / 400ms on ~200 lines', async () => {
    const lines = [
      ...(publicPack.fixtures as { text?: string }[]).map((f) => f.text).filter((t): t is string => !!t),
      ...modelPack.fixtures.map((f) => f.text),
      ...modelPack.guards.map((g) => g.text),
      ...allowPack.sentences,
    ];
    while (lines.length < 200) lines.push(...lines);
    const sample = lines.slice(0, 200);
    const lat: number[] = [];
    for (const t of sample) {
      const t0 = performance.now();
      await safety.classify(t, solo);
      lat.push(performance.now() - t0);
    }
    lat.sort((a, b) => a - b);
    const p50 = lat[Math.floor(lat.length * 0.5)];
    const p95 = lat[Math.floor(lat.length * 0.95)];
    // Cache hits dominate after the first pass; also re-score a cold batch of unique strings.
    const cold = [...new Set(sample.map((t, i) => `${t} #${i % 17}`))];
    const coldLat: number[] = [];
    for (const t of cold.slice(0, 40)) {
      const t0 = performance.now();
      await safety.classify(t, solo);
      coldLat.push(performance.now() - t0);
    }
    coldLat.sort((a, b) => a - b);
    const coldP50 = coldLat[Math.floor(coldLat.length * 0.5)];
    // Cached path must be well under budget; cold path is the real Fly figure.
    expect(p50, `cached p50 ${p50}`).toBeLessThan(50);
    expect(p95, `cached p95 ${p95}`).toBeLessThan(200);
    expect(coldP50, `cold p50 ${coldP50}`).toBeLessThan(300);
  }, 120_000);
});

describe('JevModelSafety without a model', () => {
  it('stays on the stub when load fails', async () => {
    const safety = new JevModelSafety(new JevStubSafety(), Promise.reject(new Error('no model')));
    await safety.ready();
    expect(safety.status().state).toBe('failed');
    const v = await safety.classify('oi, tudo bem?', solo);
    expect(v.action).toBe('allow');
    expect(v.jev?.fallback).toBe('unavailable');
  });
});

describe('deobfuscation is already covered by the shared safety suite', () => {
  it('stub alone catches f*ck / f u c k / f.d.p', () => {
    for (const m of ['f*ck you', 'f u c k you', 'f.d.p', 'p o r r a', 'vai se f*der']) expect(classifyChat(m).action, m).toBe('block');
  });
});
