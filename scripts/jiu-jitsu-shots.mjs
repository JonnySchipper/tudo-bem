#!/usr/bin/env node
/**
 * Screenshots of Tatame v2, the grip game on the Academia mat (#129), at 1280x800 and 390x844:
 *
 *   node scripts/jiu-jitsu-shots.mjs      # builds the solo client (VITE_LOCAL_WORLD=1) into a temp dir and serves it itself
 *   BASE_URL=http://localhost:9211/ node scripts/jiu-jitsu-shots.mjs     # or shoot a solo build you already serve
 *   SHOTS_DIR (default docs/lifesim/shots/jiu-jitsu), VIEWS=desktop,phone, BOUTS (max matches per view, default 3)
 *
 * A blue belt plays Mateus reading the telegraph (the card that answers it, else the best percent). It shoots the lobby, the first pick
 * (meter, chips, telegraph), a brace answer on offer, a grip held, a combo on offer, each big move at its big frame (the grip snap, the
 * body in the air) and at its landing (Queda, Arrastar, Puxar, Arremesso, Postura, Base), a Vantagem pop, ground gained and lost, and the
 * end card. Then (`--partners=0` to skip) a first look at each of the other sparring partners on the mat. It also checks the HUD and
 * that the moves play their baked clips (#166) while it plays.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { openBout, playBout, readBoutHud, startBout } from './lib/bout-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** `--views=desktop --bouts=1 --out=dir` override the env vars. */
const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SHOTS = path.resolve(ROOT, flag('out') ?? process.env.SHOTS_DIR ?? 'docs/lifesim/shots/jiu-jitsu');
const VIEWS = (flag('views') ?? process.env.VIEWS ?? 'desktop,phone').split(',');
const BOUTS = Number(flag('bouts') ?? process.env.BOUTS ?? 3);
const PARTNERS = (flag('partners') ?? '1') !== '0';
const PORT = Number(process.env.JJ_PORT ?? 9213);
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

/** The blue belt's moves: the whole white belt and the blue belt award, so Base, the combos and Tesoura are all in play. */
const BLUE = {
  belt: 'azul',
  stripes: 0,
  wins: 20,
  unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip', 'knee_on_belly', 'body_lock', 'sprawl', 'scissor_sweep'],
};
const BIG_MOVES = ['double_leg', 'collar_drag', 'sleeve_pull', 'hip_throw', 'posture', 'sprawl'];

async function serveSolo() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL, stop: () => {} };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-jj-solo-'));
  const vite = path.join(ROOT, 'apps/client/node_modules/vite/bin/vite.js');
  const ok = await new Promise((resolve) => {
    const c = spawn(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'warn'], { cwd: path.join(ROOT, 'apps/client'), env: { ...process.env, VITE_LOCAL_WORLD: '1' }, stdio: 'inherit' });
    c.on('exit', (code) => resolve(code === 0));
  });
  assert(ok, 'solo build failed');
  const web = spawn(process.execPath, [path.join(ROOT, 'scripts/serve-static.mjs'), out, String(PORT), '/'], { cwd: ROOT, stdio: 'ignore' });
  await sleep(1000);
  return {
    base: `http://localhost:${PORT}/`,
    stop: () => {
      web.kill();
      fs.rmSync(out, { recursive: true, force: true });
    },
  };
}

async function run(name, base) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext(VIEW[name])).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let n = 0;
  const took = new Set();
  const shot = async (label) => {
    took.add(label);
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  /** Shoot a moment only the first time it shows up. */
  const once = async (label) => {
    if (took.has(label)) return;
    await shot(label);
  };
  const checks = { meter: false, chips: false, plan: false, answer: false, brace: false, combo: false, ground: new Set(), moves: new Set(), vantagem: false, clips: new Set() };
  const stage = () => page.evaluate(() => window.__tb.renderer?.info?.()?.bout ?? null).catch(() => null);
  try {
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}solo&notype=1&rolltest&tbclockmin=${offsetMinFor(DAY_MIN)}`);
    await page.click('#intro-enter');
    await page.click('#intro-skip');
    await page.waitForSelector('#intro-guest', { state: 'visible' });
    await page.click('#intro-guest');
    await page.fill('#avatar-name', 'Lia');
    await page.click('button:has-text("ela (she)")');
    await page.click('#enter-praca');
    await finishArrival(page);
    await sleep(600);
    await goArea(page, 'rua');
    await goArea(page, 'rua_leste');
    await page.evaluate(() => window.__tb.interact({ portal: 'praca_academia' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'academia', null, 20_000, 'academia');
    await sleep(1200);
    await page.evaluate(() => {
      window.__tb.net.session.profile.coins = 120;
      window.__tb.game.profile.coins = 120;
    });
    await page.evaluate(() => window.__tb.interact({ prop: 'vestiario' }));
    await page.waitForSelector('#dialogue-box[data-dialogue="gi-buy"]', { timeout: 15_000 });
    await page.click('#dialogue-box [data-chip="0"]');
    await waitFor(page, () => window.__tb.game.profile.giOwned, null, 8000, 'gi purchased');
    await sleep(600);
    await page.evaluate((bjj) => {
      window.__tb.net.session.profile.bjj = { ...bjj };
      window.__tb.game.profile.bjj = { ...bjj };
    }, BLUE);

    await openBout(page);
    await sleep(900);
    await shot('lobby');
    await startBout(page, 'mateus');

    // the resolve moments: polled while the match plays, each shot once
    let polling = true;
    const poll = (async () => {
      while (polling) {
        const r = await page
          .evaluate(() => {
            const res = document.querySelector('#bout-resolve');
            return {
              cartoon: res?.getAttribute('data-cartoon') ?? null,
              correct: res?.getAttribute('data-correct') === 'true',
              ground: res?.getAttribute('data-ground') ?? null,
              vantagem: !!document.querySelector('#bout-pops .bout-word.kind-vantagem'),
              word: !!document.querySelector('#bout-pops .bout-word'),
              chips: !!document.querySelector('#bout-ctl .grip-chip.on'),
            };
          })
          .catch(() => null);
        if (r?.chips) checks.chips = true;
        if (r?.cartoon) {
          const s = await stage();
          if (s?.mode === 'clip' && s.frame) checks.clips.add(r.cartoon);
        }
        if (r?.vantagem && !checks.vantagem) {
          checks.vantagem = true;
          await once('vantagem');
        }
        if (r?.cartoon && r.correct && BIG_MOVES.includes(r.cartoon) && !checks.moves.has(r.cartoon)) {
          checks.moves.add(r.cartoon);
          // the clip's big frame (the snap, the body in the air), then its landing: wait for the stage to show them (a slow phone run
          // would otherwise shoot the idle after the move)
          // (the headless phone renders a few frames a second: also wait for the panel's slide-in to have painted)
          const frame = (n) =>
            page
              .waitForFunction(
                (k) => {
                  const res = document.querySelector('#bout-resolve');
                  return (window.__tb.renderer?.info?.()?.bout?.clip ?? '').endsWith(`:${k}`) && !!res && getComputedStyle(res).opacity === '1';
                },
                n,
                { timeout: 2500, polling: 'raf' },
              )
              .then(() => true)
              .catch(() => false);
          if (await frame(4)) await once(`move_${r.cartoon}`);
          if (await frame(5)) await once(`move_${r.cartoon}_land`);
        }
        if (r?.ground && r.ground !== 'even' && r.word && !checks.ground.has(r.ground)) {
          checks.ground.add(r.ground);
          await once(`ground_${r.ground}`);
        }
        await sleep(90);
      }
    })();

    let bouts = 0;
    while (bouts < BOUTS) {
      bouts++;
      const result = await playBout(page, {
        pick: 'read',
        onPhase: async (phase) => {
          if (phase !== 'intent') return;
          const hud = await readBoutHud(page);
          if (hud.meter !== null) checks.meter = true;
          if (hud.plan) checks.plan = true;
          if (hud.answers.length) checks.answer = true;
          if (hud.braces.length) checks.brace = true;
          if (hud.combos.length) checks.combo = true;
          if (hud.you.length || hud.partner.length) checks.chips = true;
          await once('first_pick');
          if (hud.braces.some((b) => hud.answers.includes(b))) await once('brace_answers_telegraph');
          if (hud.you.includes('collar') || hud.you.includes('sleeve')) await once('grip_held');
          if (hud.combos.length) await once('combo_open');
          if (hud.partner.length) await once('partner_grips');
        },
      });
      log('result', result.winner, result.reason, `${result.moves} moves`);
      await sleep(1600);
      await once('end');
      const missing = ['vantagem', ...BIG_MOVES.slice(0, 4).map((m) => `move_${m}`)].filter((l) => !took.has(l));
      if (!missing.length || bouts >= BOUTS) break;
      log('rematch for', missing.join(', '));
      await page.click('#bout-again');
      await waitFor(page, () => ['intro', 'intent'].includes(document.querySelector('#bout')?.getAttribute('data-phase') ?? ''), null, 20_000, 'rematch');
    }
    polling = false;
    await poll;
    // each other sparring partner on the mat: their own gi, skin and hair
    if (PARTNERS) {
      await page.click('#bout-leave');
      await sleep(800);
      for (const id of ['felipe', 'helena', 'daniel', 'rafael']) {
        await openBout(page);
        await startBout(page, id);
        await waitFor(page, () => document.querySelector('#bout')?.getAttribute('data-phase') === 'intent', null, 20_000, `${id} first pick`);
        await sleep(700);
        await shot(`partner_${id}`);
        await page.click('.bout-quit');
        await page.click('.bout-quit');
        await waitFor(page, () => !document.querySelector('#bout-root'), null, 10_000, `${id} left`);
        await sleep(900);
      }
    }
    assert(checks.clips.size > 0, 'the moves play their baked clips');
    assert(checks.meter, 'the control meter is on the pick screen');
    assert(checks.plan, 'the partner telegraphs its next move');
    assert(checks.brace, 'a brace card is offered');
    assert(checks.chips, 'grip chips lit up during the match');
    assert(checks.ground.size > 0, 'a move read as ground gained or lost');
    const art = await page.evaluate(() => window.__tb.artMissing.filter((k) => k.startsWith('bjj/') || k === 'props/placar'));
    assert(art.length === 0, `no bout art is missing (${art.join(', ')})`);
    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
    log('checks', JSON.stringify({ ...checks, ground: [...checks.ground], moves: [...checks.moves], clips: [...checks.clips] }));
  } finally {
    await browser.close();
  }
}

const served = await serveSolo();
try {
  for (const v of VIEWS) {
    console.log(`\n${v}`);
    await run(v, served.base);
  }
} finally {
  served.stop();
}
