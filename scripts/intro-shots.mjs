#!/usr/bin/env node
/**
 * Intro → sign-in art review screenshots (TB Art brief 2026-09-27).
 *
 *   VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
 *   SHOTS_DIR=docs/art/intro-signin/after node scripts/intro-shots.mjs
 *
 * Captures 390×844, 1280×800 and 1440×900: title beat mid-flock, settled auth card
 * (natural reveal, no skip), register (18+), reduced-motion.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/tudo-bem/';
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? 'docs/art/intro-signin/after';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
  { tag: '390', width: 390, height: 844, dpr: 2, mobile: true },
  { tag: '1280', width: 1280, height: 800, dpr: 1, mobile: false },
  { tag: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
].filter((vp) => !process.env.SHOTS_ONLY || process.env.SHOTS_ONLY.split(',').includes(vp.tag));
/** Title-beat capture time (ms after load) — mid-flock. */
const TITLE_AT = Number(process.env.TITLE_AT ?? 1800);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const vp of VIEWPORTS) {
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', String(e)));
    await page.goto(BASE);
    await page.waitForSelector('.intro-gate');
    const shot = async (name) => {
      await page.screenshot({ path: path.join(OUT, `${vp.tag}-${name}.png`) });
      console.log('  ·', `${vp.tag}-${name}`);
    };
    if (reduced) {
      await sleep(600);
      await shot('reduced-motion');
      await ctx.close();
      continue;
    }
    await sleep(TITLE_AT);
    await shot('title-beat');
    await page.waitForSelector('.intro-phase-auth', { timeout: 12_000 });
    await sleep(2200);
    await shot('sign-in');
    await page.click('#intro-tab-register');
    await page.click('#intro-submit');
    await sleep(500);
    await shot('register-error');
    await ctx.close();
  }
}
await browser.close();
