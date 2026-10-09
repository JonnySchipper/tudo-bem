#!/usr/bin/env node
/**
 * Screenshots of Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md), the jiu-jitsu game on the Academia mat, at 1280x800 and 390x844:
 *
 *   node scripts/jiu-jitsu-shots.mjs      # builds the solo client (VITE_LOCAL_WORLD=1) into a temp dir and serves it itself
 *   BASE_URL=http://localhost:9211/ node scripts/jiu-jitsu-shots.mjs     # or shoot a solo build you already serve
 *   --out=dir (or SHOTS_DIR, default docs/lifesim/shots/jiu-jitsu-v3), --views=desktop,phone, --bouts=N (max matches per view, default 2),
 *   --partners=0 skips the first look at the other partners
 * `?rolltest` squeezes the server's resolve beats to 5% for the e2e; `boutpace=100` holds them five times as long as in play, so a
 * slow headless screenshot (software GL, a few frames a second on the 2x phone) still catches the call on the panel. The command and
 * defense windows are the game's own: the timed pad beats are shot at CSS pixels (`fast`) so the capture does not outlast them.
 *
 * A white belt with three stripes (Bia still calls the defenses) plays Mateus: holds until Mateus attacks and is defended, then the first card
 * that scores (the finish when it is on offer), every command tapped fast on the pad (Perfeito!), every defense answered. It shoots the lobby, the pick, a chain as the first
 * word comes up, the same chain mid-way with its Perfeito!, a Defendeu!, a takedown landing on the mat, the finish, and the end card. The
 * extras play a first match (Bia's coach note, the defense pad with her call, then Virar on offer with Lia underneath) and a fifth win
 * into the stripe's drill. It checks the moves play their baked clips driven by the taps (the wind-up frames) as it goes.
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
/** `--extras=0` skips the first-match coach note and the stripe drill. */
const EXTRAS = (flag('extras') ?? '1') !== '0';
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
const WANT = ['pick', 'chain', 'chain_perfeito', 'defendeu', 'throw_land', 'finish', 'end'];

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
  const shot = async (label, fast = false) => {
    took.add(label);
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    // the headless page paints a few frames a second: finish the panel's slide-in instead of shooting it half-faded. `fast` shoots at
    // CSS pixels (a 2x phone capture with software GL can outlast a command's window, and the grade on screen would be Tarde! by then)
    await page.screenshot({ path: path.join(SHOTS, file), animations: 'disabled', ...(fast ? { scale: 'css' } : {}) });
    log(file);
  };
  /** Shoot a moment only the first time it shows up. */
  const once = async (label, fast = false) => {
    if (took.has(label)) return false;
    await shot(label, fast);
    return true;
  };
  const stage = () => page.evaluate(() => window.__tb.renderer?.info?.()?.bout ?? null).catch(() => null);
  const checks = { meter: false, plan: false, chevrons: false, windup: new Set(), clips: new Set(), perfect: 0 };
  try {
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}solo&notype=1&rolltest&boutpace=100&tbclockmin=${offsetMinFor(DAY_MIN)}`);
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

    // the arrivals card can come up late, after the helper looked for it: close it so it does not sit over the mat
    await page.evaluate(() => document.getElementById('aero-next-ok')?.click());
    // shots only: the panel's 0.18 s slide-in takes seconds on a software-GL phone page (a few frames a second); paint views at once
    await page.addStyleTag({ content: '.bout-view, .bout-banner.pop, .cmd-grade.pop, .cmd-word.pulse, .pad-btn.hit, .pad-btn.miss { animation: none !important; }' });
    await openBout(page);
    await sleep(900);
    await shot('lobby');
    await startBout(page, 'mateus');

    let bouts = 0;
    while (bouts < BOUTS) {
      bouts++;
      const result = await playBout(page, {
        // hold (up to three picks) until Mateus attacks and Lia defends it (a Defendeu!), then go for the takedown, the pass, the finish
        pick: (n) => (n < 3 && !took.has('defendeu') ? 'safe' : 'bold'),
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
            await once('chain', true);
          } else if (b.phase === 'resolve' && b.resolve) {
            const r = b.resolve;
            if (r.how === 'defended' && r.actor === 'partner') {
              await sleep(150);
              await once('defendeu');
            } else if (r.actor === 'you' && r.correct && THROWS.includes(r.move ?? '') && !took.has('throw_land')) {
              // the landing: the impact frame has passed, the partner is on the mat
              await sleep(200);
              await once('throw_land');
            } else if (r.actor === 'you' && r.correct && SUBS.includes(r.move ?? '') && !took.has('finish')) {
              // the finish lands in slow motion: the squeeze, then the tap
              await sleep(350);
              await once('finish');
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
            if (perfect) await once('chain_perfeito', true);
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
    // a first match (wins 0): Bia's coach note at the first pick; then the fifth win and the stripe's drill, a slow chain
    if (EXTRAS) {
      await page.click('#bout-leave');
      await sleep(800);
      const setBjj = (bjj) =>
        page.evaluate((b) => {
          window.__tb.net.session.profile.bjj = { ...b };
          window.__tb.game.profile.bjj = { ...b };
        }, bjj);
      await setBjj({ belt: 'branca', stripes: 0, wins: 0, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar'] });
      await openBout(page);
      await startBout(page, 'mateus');
      await waitFor(page, () => document.querySelector('#bout')?.getAttribute('data-phase') === 'pick', null, 20_000, 'first-match pick');
      await sleep(400);
      assert(await page.evaluate(() => !!document.querySelector('#bout-pick .bout-coach:not([hidden])')), 'a first match shows Bia’s coach note at the first pick');
      await shot('first_match_coach');
      // the defense pad with Bia's call, then Virar on offer: hold until Mateus attacks, shoot the open pad and do not answer it, so his
      // takedown lands and the next pick has Lia underneath (a slow capture outlasts a defense window anyway: this match is thrown away)
      for (let i = 0; i < 8 && !(took.has('defense') && took.has('virar_card')); i++) {
        const pick = await page.evaluate(() => ({
          phase: document.querySelector('#bout')?.getAttribute('data-phase'),
          seq: document.querySelector('#bout-moves')?.getAttribute('data-seq') ?? '',
          virar: !!document.querySelector('#bout-moves .bout-move[data-move="virar"]'),
        }));
        if (pick.phase === 'pick' && pick.virar && !took.has('virar_card')) {
          await sleep(300);
          await shot('virar_card');
          continue;
        }
        await page.evaluate(() => document.querySelector('#bout-hold')?.click());
        const next = await page
          .waitForFunction(
            (prev) => {
              const phase = document.querySelector('#bout')?.getAttribute('data-phase');
              if (phase === 'defend') {
                const want = document.querySelector('#bout-cmd')?.getAttribute('data-want');
                const btn = want ? document.querySelector(`#bout-cmd .pad-btn[data-cmd="${want}"]`) : null;
                return btn && !btn.disabled ? 'defend' : false;
              }
              return phase === 'pick' && document.querySelector('#bout-moves')?.getAttribute('data-seq') !== prev ? 'pick' : false;
            },
            pick.seq,
            { timeout: 30_000, polling: 100 },
          )
          .then((h) => h.jsonValue())
          .catch(() => null);
        if (next === 'defend' && !took.has('defense')) await shot('defense', true);
        if (next === 'defend')
          await page.waitForFunction((prev) => document.querySelector('#bout')?.getAttribute('data-phase') === 'pick' && document.querySelector('#bout-moves')?.getAttribute('data-seq') !== prev, pick.seq, { timeout: 30_000, polling: 100 }).catch(() => {});
        else if (!next) break;
      }
      // quit is two presses within 3 s: press both in the page (a slow phone page can outlast the arming between two pointer clicks)
      await page.evaluate(() => {
        const q = document.querySelector('#bout-quit');
        q?.click();
        q?.click();
      });
      await waitFor(page, () => !document.querySelector('#bout-root'), null, 15_000, 'left the first match');
      await sleep(800);
      await setBjj({ belt: 'branca', stripes: 0, wins: 4, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar'] });
      await openBout(page);
      await startBout(page, 'mateus');
      let drillShot = false;
      const res = await playBout(page, {
        pick: 'bold',
        tapMs: 90,
        onBeat: async (b) => {
          if (b.phase === 'drill' && !drillShot) {
            drillShot = true;
            await sleep(300);
            await shot('drill');
          }
        },
      });
      log('drill run', res.winner, res.reason, `${res.drills} drill`);
      if (res.winner === 'you') {
        assert(res.drills === 1, 'the fifth win opens the stripe drill, played as a chain');
        await sleep(1200);
        await shot('drill_end');
        assert(await page.evaluate(() => window.__tb.game.profile.bjj.unlocked.includes('sleeve_grip')), 'the drill hands over the new move');
      }
    }
    // each other sparring partner on the mat: their own gi, skin and hair (the unlocked ones)
    if (PARTNERS) {
      if (await page.$('#bout-leave')) await page.click('#bout-leave');
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
    if (took.has('chain')) assert(checks.windup.size > 0, 'the taps drive the moves’ baked clips (wind-up frames)');
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
