/**
 * Jev model latency on this machine: cold (uncached) checks through JevModelSafety over ~200 chat lines.
 *   TB_JEV_MODEL_DIR=models/jev-tox-small pnpm --filter @tudobem/server exec tsx scripts/bench-jev.ts
 */
import publicPack from '../../../content/safety/phase0/jev/public-chat-pack.json';
import modelPack from '../../../content/safety/phase0/jev/model-pack.json';
import allowPack from '../../../content/safety/phase0/blocklists/allowlist-pt-slang.json';
import { JevStubSafety } from '../src/services/stubs.js';
import { JevModelSafety, loadOnnxToxModel } from '../src/services/jevModel.js';

const dir = process.env.TB_JEV_MODEL_DIR || new URL('../../../models/jev-tox-small', import.meta.url).pathname;
const t0 = performance.now();
const safety = new JevModelSafety(new JevStubSafety(), loadOnnxToxModel(dir, { threads: Number(process.env.TB_JEV_THREADS) || 1 }), { timeoutMs: 5000 });
const st = await safety.ready();
console.log(`load ${Math.round(performance.now() - t0)}ms state=${st.state} rss=${Math.round(process.memoryUsage().rss / 1e6)}MB`);
const base = [
  ...(publicPack.fixtures as { text?: string }[]).map((f) => f.text).filter((t): t is string => !!t),
  ...modelPack.fixtures.map((f) => f.text),
  ...modelPack.guards.map((g) => g.text),
  ...allowPack.sentences,
];
const lines: string[] = [];
for (let i = 0; lines.length < 200; i++) lines.push(i < base.length ? base[i] : `${base[i % base.length]} ${['kkk', 'né', 'mano', 'lol', 'pô'][i % 5]}`);
const solo = { playerId: 'bench', room: 'bench', nameplate: 'verde' as const };
const lat: number[] = [];
let modelRuns = 0;
for (const t of lines) {
  const s = performance.now();
  const v = await safety.classify(t, solo);
  if (v.jev && !v.jev.fallback) {
    lat.push(performance.now() - s);
    modelRuns++;
  }
}
lat.sort((a, b) => a - b);
const q = (p: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(1);
console.log(`lines=${lines.length} model-scored=${modelRuns} (rest stopped by the stub) p50=${q(0.5)}ms p95=${q(0.95)}ms max=${q(1)}ms rss=${Math.round(process.memoryUsage().rss / 1e6)}MB`);
