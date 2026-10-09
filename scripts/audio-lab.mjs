// Offline renders and loudness of the music (apps/client/src/audio). Dev tool: needs Chromium (PLAYWRIGHT_BROWSERS_PATH or /opt/pw-browsers).
//   node scripts/audio-lab.mjs calibrate         measure everything at unity gain → apps/client/src/audio/calibration.json
//   node scripts/audio-lab.mjs levels            in-game loudness of every bed, phrase and stinger (after audio/mix, through the master)
//   node scripts/audio-lab.mjs stems <kind>      loudness of each voice of one arrangement (intro, padaria, ...)
//   node scripts/audio-lab.mjs sfx               loudness of the bout's sound effects
//   node scripts/audio-lab.mjs mp3 [dir] [name]  listening copies (default docs/audio); `name` renders just that one
// How a new piece goes from idea to the game: docs/audio/COMPOSING.md.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'apps/client');
const { createServer } = createRequire(path.join(CLIENT, 'package.json'))('vite');

const [mode = 'levels', arg] = process.argv.slice(2);

const exe = ['/opt/pw-browsers/chromium', process.env.CHROMIUM].find((p) => p && fs.existsSync(p)) ?? findChrome();
const server = await createServer({ root: CLIENT, configFile: false, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(`${url}tools/audio-lab.html`);
await page.waitForFunction(() => 'lab' in window, null, { timeout: 60000 });

const { levels } = await server.ssrLoadModule('/src/audio/mix.ts');
const run = (job) => page.evaluate((j) => window.lab.render(j), job);
const fmt = (r) => `${r.lufs.toFixed(1).padStart(6)} LUFS  max ${r.mmax.toFixed(1).padStart(6)}  peak ${(20 * Math.log10(r.peak || 1e-9)).toFixed(1).padStart(6)} dBFS`;

function wav(file, r) {
  const data = Buffer.from(r.b64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(r.sr, 24);
  h.writeUInt32LE(r.sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

const BEDS = ['intro', 'radio', 'padaria', 'padariaNight', 'kitnet', 'academia', 'bout', 'feira', 'voo'];
const STINGS = ['recado', 'heart', 'coin', 'mission', 'caderno', 'win', 'lose', 'door', 'diario', 'pouso'];

const MOOD_PHRASES = (await server.ssrLoadModule('/src/audio/conductor.ts')).MOOD_PHRASES;
const bedJob = (kind) => ({ what: 'arr', kind, boost: kind === 'intro' ? 1 : 0 });

if (mode === 'calibrate') {
  const cal = { bed: {}, phrase: {}, sting: {} };
  for (const kind of BEDS) cal.bed[kind] = +(await run(bedJob(kind))).lufs.toFixed(2);
  for (const [mood, ids] of Object.entries(MOOD_PHRASES)) {
    // a mood's level is the energy mean of all of its phrases
    let p = 0;
    for (const kind of ids) p += Math.pow(10, (await run({ what: 'phrase', kind, mood })).lufs / 10);
    cal.phrase[mood] = +(10 * Math.log10(p / ids.length)).toFixed(2);
  }
  for (const kind of STINGS) cal.sting[kind] = +(await run({ what: 'sting', kind })).lufs.toFixed(2);
  fs.writeFileSync(path.join(CLIENT, 'src/audio/calibration.json'), JSON.stringify(cal, null, 2) + '\n');
  console.log(JSON.stringify(cal, null, 2));
} else if (mode === 'levels') {
  for (const kind of BEDS) console.log(`bed    ${kind.padEnd(16)}`, fmt(await run({ ...bedJob(kind), gain: levels.bed(kind), master: true })));
  for (const [mood, ids] of Object.entries(MOOD_PHRASES)) for (const kind of ids) console.log(`phrase ${(mood + '/' + kind).padEnd(16)}`, fmt(await run({ what: 'phrase', kind, mood, gain: levels.phrase(mood), master: true })));
  for (const kind of STINGS) console.log(`sting  ${kind.padEnd(16)}`, fmt(await run({ what: 'sting', kind, gain: levels.sting(kind), master: true })));
} else if (mode === 'sfx') {
  for (const kind of ['slap', 'cheer', 'gasp', 'claps', 'whistle', 'tapout', 'gong', 'tick']) console.log(`sfx    ${kind.padEnd(16)}`, fmt(await run({ what: 'sfx', kind, master: true })));
} else if (mode === 'stems') {
  const kind = arg ?? 'intro';
  const all = await run({ what: 'arr', kind, boost: 1 });
  console.log(`${kind} (all, boost 1)`.padEnd(24), fmt(all));
  for (const voice of await page.evaluate((k) => window.lab.voices(k), kind)) console.log(`  ${voice}`.padEnd(24), fmt(await run({ what: 'stem', kind, voice, boost: 1 })));
} else if (mode === 'mp3') {
  const dir = path.resolve(ROOT, arg ?? 'docs/audio');
  fs.mkdirSync(dir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'tb-audio-'));
  const out = [
    ['theme-intro', { what: 'arr', kind: 'intro', boost: 1, gain: levels.bed('intro') }],
    ['padaria-day', { what: 'arr', kind: 'padaria', bars: 16, gain: levels.bed('padaria') }],
    ['padaria-night', { what: 'arr', kind: 'padariaNight', gain: levels.bed('padariaNight') }],
    ['kitnet', { what: 'arr', kind: 'kitnet', gain: levels.bed('kitnet') }],
    ['academia', { what: 'arr', kind: 'academia', gain: levels.bed('academia') }],
    ['bout', { what: 'arr', kind: 'bout', gain: levels.bed('bout') }],
    ['feira', { what: 'arr', kind: 'feira', gain: levels.bed('feira') }],
    ['voo', { what: 'arr', kind: 'voo', gain: levels.bed('voo') }],
    ['praca-golden', { what: 'phrase', kind: 'bridge', mood: 'golden', gain: levels.phrase('golden') }],
    ['praca-night', { what: 'phrase', kind: 'close', mood: 'night', gain: levels.phrase('night') }],
    ...['recado', 'mission', 'win', 'lose', 'diario', 'pouso'].map((k) => [`sting-${k}`, { what: 'sting', kind: k, gain: levels.sting(k) }]),
  ];
  const only = process.argv[4];
  for (const [name, job] of out.filter(([n]) => !only || n === only)) {
    // listening copies are normalized up so a bed can be heard on its own; the in-game balance is what `levels` prints
    const r = await run({ ...job, gain: 1, wav: true });
    const w = path.join(tmp, `${name}.wav`);
    wav(w, r);
    const lift = Math.min(-16 - r.lufs, -1 - 20 * Math.log10(r.peak));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', w, '-af', `volume=${lift.toFixed(1)}dB`, '-codec:a', 'libmp3lame', '-b:a', '112k', path.join(dir, `${name}.mp3`)]);
    console.log(name.padEnd(16), fmt(r));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
await browser.close();
await server.close();
