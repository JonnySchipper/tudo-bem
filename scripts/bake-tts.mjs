#!/usr/bin/env node
/**
 * Neural voices for everything the game says aloud (replaces the robotic browser voice). No paid TTS: Microsoft Edge's free pt-BR voices via edge-tts.
 *
 *   pnpm tts              bake every spoken line that has no clip yet (finds them in the game data), update the manifest
 *   pnpm tts:check        no network: list the lines that would fall back to the robot voice; exit 1 if any
 *                         (+ `-- --update-pending` to record the gaps in pending.json when you cannot bake right now)
 *   pnpm tts -- --force   re-bake everything        pnpm tts -- --speaker=graca   re-bake one speaker's clips
 *
 * The lines come from `collectSpokenLines` (packages/shared/src/spokenLines.ts) plus content/tts/extra-lines.json; who says them and how they
 * sound is content/voices.json. Adding dialogue to the game needs nothing else: write it, run `pnpm tts`, commit the new mp3s + manifest.json.
 * Needs `pip install edge-tts` (or EDGE_TTS=/path/to/edge-tts) and outbound access to speech.platform.bing.com.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createServer } = createRequire(path.join(ROOT, 'apps/client/package.json'))('vite');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const CHECK = args.includes('--check');
const ONLY = args.find((a) => a.startsWith('--speaker='))?.slice('--speaker='.length);

// the plan is TypeScript (it walks the shared game data): load it through Vite, as audio-lab does
const vite = await createServer({ root: path.join(ROOT, 'apps/client'), logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
let plan;
try {
  plan = await vite.ssrLoadModule(path.join(ROOT, 'apps/client/src/audio/plan.ts'));
} catch (e) {
  await vite.close();
  throw e;
}
const { buildPlan, loadCast, hasClip, pendingKey, AUDIO_DIR, MANIFEST_PATH, PENDING_PATH } = plan;

const cast = loadCast();
const lines = buildPlan();
const todo = lines.filter((l) => (!ONLY || l.speaker === ONLY) && (FORCE || ONLY ? true : !hasClip(l)));
const missing = lines.filter((l) => !hasClip(l));

function writePending() {
  const keys = lines.filter((l) => !hasClip(l)).map(pendingKey).sort();
  fs.writeFileSync(PENDING_PATH, JSON.stringify({ _readme: JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'))._readme, lines: keys }, null, 2) + '\n');
}

if (CHECK) {
  await vite.close();
  if (args.includes('--update-pending')) writePending(); // accept the current gaps as known (only when you cannot bake right now)
  const by = new Map();
  for (const l of missing) by.set(l.source.split(' ')[0] + ' / ' + l.speaker, (by.get(l.source.split(' ')[0] + ' / ' + l.speaker) ?? 0) + 1);
  console.log(`${lines.length} spoken lines, ${missing.length} without a clip (they would use the robot voice).`);
  for (const [k, n] of [...by].sort()) console.log(`  ${String(n).padStart(4)}  ${k}`);
  for (const l of missing.slice(0, 15)) console.log(`        ${l.speaker}: ${l.text.slice(0, 90)}`);
  if (missing.length > 15) console.log(`        … and ${missing.length - 15} more`);
  if (missing.length) console.log('\nFix: pnpm tts   (needs edge-tts and network access to speech.platform.bing.com)');
  process.exit(missing.length ? 1 : 0);
}

const TTS = [process.env.EDGE_TTS, 'edge-tts', '/workspace/venvs/tts/bin/edge-tts'].filter(Boolean).find((c) => spawnSync(c, ['--help'], { stdio: 'ignore' }).status === 0);

function synth(speaker, text, file) {
  const c = cast[speaker];
  const argv = ['--voice', c.voice, '--text', text, '--write-media', file];
  if (c.rate) argv.push(`--rate=${c.rate}`);
  if (c.pitch) argv.push(`--pitch=${c.pitch}`);
  return new Promise((resolve, reject) => {
    const child = spawn(TTS, argv, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${speaker} failed (${code}): ${err.trim().split('\n').pop()?.slice(0, 300)}`))));
  });
}

async function pool(jobs, n) {
  const q = [...jobs];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await q.shift()(); }));
}

fs.mkdirSync(AUDIO_DIR, { recursive: true });
let failed = 0;
let firstError = '';
if (todo.length) {
  if (!TTS) {
    await vite.close();
    console.error('edge-tts not found. Install it: pip install edge-tts   (or set EDGE_TTS=/path/to/edge-tts)');
    process.exit(2);
  }
  // one probe first: a blocked network should stop here with a clear message, not fail 400 times
  const probe = path.join(os.tmpdir(), `tts-probe-${process.pid}.mp3`);
  try {
    await synth(todo[0].speaker, 'Tudo bem?', probe);
    fs.rmSync(probe, { force: true });
  } catch (e) {
    await vite.close();
    console.error(`Cannot reach the voice service: ${e.message}\nedge-tts talks to speech.platform.bing.com:443; allow that host (cloud sessions: environment network settings) and run again.`);
    process.exit(2);
  }
}
console.log(`Baking ${todo.length} of ${lines.length} clips${ONLY ? ` (speaker ${ONLY})` : ''} → ${path.relative(ROOT, AUDIO_DIR)}`);
await pool(
  todo.map((l) => async () => {
    const dest = path.join(AUDIO_DIR, l.file);
    const tmp = `${dest}.part`;
    try {
      await synth(l.speaker, l.text, tmp);
      fs.renameSync(tmp, dest);
      process.stdout.write(`  ${l.speaker} ${l.file}\n`);
    } catch (e) {
      failed++;
      firstError ||= e.message;
      fs.rmSync(tmp, { force: true });
    }
  }),
  5,
);
await vite.close();

const baked = lines.filter(hasClip);
if (!failed) {
  const keep = new Set(lines.map((l) => l.file));
  for (const name of fs.readdirSync(AUDIO_DIR)) if (name.endsWith('.mp3') && !keep.has(name)) fs.unlinkSync(path.join(AUDIO_DIR, name));
}
const voices = Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v.voice]));
const manifest = { version: 2, voices, lines: baked.map(({ id, speaker, text, file }) => ({ id, voice: speaker, text, file })) };
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
writePending();
console.log(`Manifest: ${baked.length}/${lines.length} lines → ${path.relative(ROOT, MANIFEST_PATH)}`);
if (failed) {
  console.error(`${failed} clip(s) failed (first: ${firstError}). Run again to retry; nothing was pruned.`);
  process.exit(1);
}
