#!/usr/bin/env node
/**
 * Screenshots of Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md), the jiu-jitsu game on the Academia mat, at 1280x800 and 390x844:
 *
 *   node scripts/jiu-jitsu-shots.mjs      # builds the solo client (VITE_LOCAL_WORLD=1) into a temp dir and serves it itself
 *   BASE_URL=http://localhost:9211/ node scripts/jiu-jitsu-shots.mjs     # or shoot a solo build you already serve
 *   --out=dir (or SHOTS_DIR, default docs/lifesim/shots/jiu-jitsu-v3), --views=desktop,phone, --bouts=N (max matches per view, default 2),
 *   --partners=0 skips the first look at the other partners
 *
 * A white belt with three stripes (Bia still calls the defenses) plays Mateus: the first card that scores (the finish when it is on
 * offer), every command tapped fast on the pad (Perfeito!), every defense answered. It shoots the lobby, the pick, a chain as the first
 * word comes up, the same chain mid-way with its Perfeito!, the partner's attack with the defense pad, a Defendeu!, a takedown landing on
 * the mat, the finish, and the end card. It checks the moves play their baked clips driven by the taps (the wind-up frames) as it goes.
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
const SHOTS = path.resolve(ROOT, flag('out') ?? process.env.SHOTS_DIR ?? 'docs/lifesim/shots/jiu-jitsu-v3');
const VIEWS = (flag('views') ?? process.env.VIEWS ?? 'desktop,phone').split(',');
const BOUTS = Number(flag('bouts') ?? process.env.BOUTS ?? 2);
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

/** Three white stripes: every white move but the last award (Base), so the grips, the throws, the passes and Braço are in play. */
const WHITE3 = {
  belt: 'branca',
  stripes: 3,
  wins: 15,
  unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip', 'knee_on_belly', 'body_lock'],
};
const THROWS = ['double_leg', 'body_lock', 'collar_drag', 'hip_throw', 'single_leg', 'sleeve_pull'];
const SUBS = ['armbar', 'americana', 'rnc'];
/** The moments the brief asks for: if one is still missing after a match, play another (up to --bouts). */
const WANT = ['pick', 'chain', 'chain_perfeito', 'defense', 'defendeu', 'throw_land', 'finish', 'end'];

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
    if (took.has(label)) return false;
    await shot(label);
    return true;
  };
  const stage = () => page.evaluate(() => window.__tb.renderer?.info?.()?.bout ?? null).catch(() => null);
  /** Wait for the mat clip to reach a frame (`:4` the impact, `:5` the landing) and the resolve panel to have painted. */
  const clipAt = (frames) =>
    page
      .waitForFunction(
        (fs) => {
          const clip = window.__tb.renderer?.info?.()?.bout?.clip ?? '';
          const res = document.querySelector('#bout-resolve');
          return fs.some((k) => clip.endsWith(`:${k}`)) && !!res && getComputedStyle(res).opacity === '1';
        },
        frames,
        { timeout: 2500, polling: 'raf' },
      )
      .then(() => true)
      .catch(() => false);
  const checks = { meter: false, plan: false, chevrons: false, windup: new Set(), clips: new Set(), perfect: 0 };
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
    }, WHITE3);

    await openBout(page);
    await sleep(900);
    await shot('lobby');
    await startBout(page, 'mateus');

    let bouts = 0;
    while (bouts < BOUTS) {
      bouts++;
      const result = await playBout(page, {
        pick: 'bold',
        tapMs: 90,
        onBeat: async (b) => {
          if (b.phase === 'pick') {
            const hud = await readBoutHud(page);
            if (hud.meter !== null) checks.meter = true;
            if (hud.plan) checks.plan = true;
            if (hud.chevrons.length) checks.chevrons = true;
            await sleep(250);
            await once('pick');
            if (hud.you.length) await once('grip_held');
          } else if (b.phase === 'chain' && b.step === 0 && b.total >= 2 && !took.has('chain')) {
            await sleep(120);
            await once('chain');
          } else if (b.phase === 'defend' && !took.has('defense')) {
            await once('defense');
          } else if (b.phase === 'resolve' && b.resolve) {
            const r = b.resolve;
            if (r.how === 'defended' && r.actor === 'partner') {
              await sleep(150);
              await once('defendeu');
            } else if (r.actor === 'you' && r.correct && THROWS.includes(r.move ?? '') && !took.has('throw_land')) {
              if (await clipAt([5, 6])) await once('throw_land');
            } else if (r.actor === 'you' && r.correct && SUBS.includes(r.move ?? '') && !took.has('finish')) {
              if (await clipAt([5, 6, 7])) await once('finish');
              else await once('finish');
            }
          }
        },
        onTap: async (b) => {
          if (b.phase === 'chain') {
            const s = await stage();
            if (s?.clip?.includes(':windup:')) checks.windup.add(s.clip.split('@')[0]);
          }
          if (b.phase === 'chain' && b.step === 0 && b.total >= 2 && !took.has('chain_perfeito')) {
            const perfect = await page
              .waitForFunction(() => !!document.querySelector('#bout-grade.g-perfeito'), null, { timeout: 600 })
              .then(() => true)
              .catch(() => false);
            if (perfect) await once('chain_perfeito');
          }
        },
      });
      checks.perfect += result.perfect;
      log('result', result.winner, result.reason, `${result.moves} picks, ${result.taps} taps, ${result.perfect} perfect`);
      await sleep(1600);
      await once('end');
      const missing = WANT.filter((l) => !took.has(l));
      if (!missing.length || bouts >= BOUTS) {
        if (missing.length) log('not caught this run:', missing.join(', '));
        break;
      }
      log('rematch for', missing.join(', '));
      took.delete('end');
      await page.click('#bout-again');
      await waitFor(page, () => ['intro', 'pick'].includes(document.querySelector('#bout')?.getAttribute('data-phase') ?? ''), null, 20_000, 'rematch');
    }
    // each other sparring partner on the mat: their own gi, skin and hair (the unlocked ones)
    if (PARTNERS) {
      await page.click('#bout-leave');
      await sleep(800);
      for (const id of ['felipe', 'helena', 'daniel']) {
        await openBout(page);
        await startBout(page, id);
        await waitFor(page, () => document.querySelector('#bout')?.getAttribute('data-phase') === 'pick', null, 20_000, `${id} first pick`);
        await sleep(700);
        await shot(`partner_${id}`);
        await page.click('#bout-quit');
        await page.click('#bout-quit');
        await waitFor(page, () => !document.querySelector('#bout-root'), null, 10_000, `${id} left`);
        await sleep(900);
      }
    }
    assert(checks.windup.size > 0, 'the taps drive the moves’ baked clips (wind-up frames)');
    assert(checks.meter, 'the control meter is on the pick screen');
    assert(checks.plan, 'the partner telegraphs its next move');
    assert(checks.chevrons, 'the cards show the chain length as chevrons');
    const art = await page.evaluate(() => window.__tb.artMissing.filter((k) => k.startsWith('bjj/') || k === 'props/placar'));
    assert(art.length === 0, `no bout art is missing (${art.join(', ')})`);
    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
    log('checks', JSON.stringify({ ...checks, windup: [...checks.windup], clips: [...checks.clips] }));
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
