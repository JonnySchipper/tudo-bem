#!/usr/bin/env node
/**
 * Phase 7 review screenshots: the in-world dialogue box (Seu Carlos' Conversa, Nanda, Júlia), a sign card with its 👁 cue, and
 * the Diário, at desktop and phone size.
 *
 *   pnpm build && PORT=8802 TB_TEST_ROLL=1 pnpm start          # then, in another terminal:
 *   BASE_URL=http://localhost:8802 node scripts/lifesim-shots-p7.mjs          # → docs/lifesim/shots/p7/
 *
 * Env: BASE_URL, CHROME_PATH, SHOTS_DIR (default docs/lifesim/shots/p7). Flags: --only=1280x800 | 390x844.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { requirePinnedClock } from './lib/clock-pin.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'p7');
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true },
].filter((v) => !argv.only || v.name === argv.only);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, vp, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${vp.name}_${name}.png`) });
  console.log('  ·', vp.name, name);
}
async function interact(page, target) {
  const ok = await page.evaluate((t) => window.__tb.interact(t), target);
  if (!ok) throw new Error(`no such interact target: ${JSON.stringify(target)}`);
}
const waitRoom = (page, id) => page.waitForFunction((id) => window.__tb.game.room?.room === id, id, { timeout: 15_000 });
const box = async (page, key) => {
  const sel = `#dialogue-box[data-dialogue="${key}"]`;
  // one click, one box: a learned idle line leads the talk's first line, never a box of its own
  await page.waitForSelector(sel, { timeout: 20_000 });
};
/** The line finished typing (45 chars/s): wait for the rest of it to be gone. */
const typed = (page) => page.waitForFunction(() => !document.querySelector('#dialogue-box .tw-rest')?.textContent, null, { timeout: 15_000 }).catch(() => {});
const boxPct = (page) => page.evaluate(() => { const b = document.querySelector('#dialogue-box')?.getBoundingClientRect(); return b ? +(100 * b.height / innerHeight).toFixed(1) : 0; });

async function toWorld(page, vp) {
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `p7+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitRoom(page, 'praca');
  await page.evaluate(() => window.__tb.setClock({ time: '17:30', weather: 'sol' }));
  await sleep(1500);
}

async function run(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await toWorld(page, vp);

  // Nanda: the greeting in the box (2 reply chips; "Ver chapéus" waits for her last line)
  await interact(page, { npc: 'nanda' });
  await box(page, 'talk-nanda');
  await typed(page);
  await sleep(700);
  await shot(page, vp, 'nanda_dialogue');
  console.log('    box height', await boxPct(page), '% of the screen');
  await page.click('#dialogue-box [data-chip="0"]');
  await sleep(300);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#dialogue-box'));
  await sleep(700);

  // Júlia: greeting then her help menu
  await interact(page, { npc: 'julia' });
  await box(page, 'talk-julia');
  await typed(page);
  await page.keyboard.press('1');
  await sleep(300);
  await page.keyboard.press('1');
  await typed(page);
  await sleep(500);
  await page.keyboard.press('1');
  await typed(page);
  await sleep(500);
  await shot(page, vp, 'julia_help');
  await page.keyboard.press('Escape');
  await sleep(700);

  // a sign in the praça: walk up, the card, the 👁 cue
  await interact(page, { hotspot: 'banca_manchetes' });
  await page.waitForSelector('.hotspot-card', { timeout: 20_000 });
  await sleep(500);
  await shot(page, vp, 'hotspot_card_banca');
  await page.click('#hs-listen');
  await page.keyboard.press('Escape');
  await sleep(900);
  await shot(page, vp, 'hotspot_cue');

  // the padaria: the menu card, then Seu Carlos
  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(1200);
  await interact(page, { hotspot: 'padaria_cardapio' });
  await page.waitForSelector('.hotspot-card', { timeout: 20_000 });
  await sleep(500);
  await shot(page, vp, 'hotspot_card_cardapio');
  await page.keyboard.press('Escape');
  await sleep(500);

  await interact(page, { npc: 'carlos' });
  await box(page, 'conversa');
  await typed(page);
  await sleep(900);
  await shot(page, vp, 'conversa_box');
  console.log('    conversa box height', await boxPct(page), '% of the screen');
  await page.fill('#conversa-input', 'Bom dia, Seu Carlos! Tudo bem?');
  await page.press('#conversa-input', 'Enter');
  await sleep(250);
  await shot(page, vp, 'conversa_thinking');
  await page.waitForFunction(() => document.querySelector('#dialogue-box .line-bubble:not(.thinking)') && !document.querySelector('#dialogue-box .dots'), null, { timeout: 15_000 });
  await typed(page);
  await sleep(500);
  await shot(page, vp, 'conversa_turn');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#dialogue-box'));

  // the Diário after the menu and the greeting (the Caderno spread is gone: the Diário is the one word home)
  await page.click('#btn-caderno');
  await page.waitForSelector('[data-modal="caderno"]', { timeout: 5000 });
  await sleep(500);
  await shot(page, vp, 'diario');
  console.log('  artMissing:', JSON.stringify(await page.evaluate(() => window.__tb.artMissing)));
  await ctx.close();
}

if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
console.log(`\nphase 7 shots → ${OUT}  (${BASE})`);
if (!process.env.SOLO) await requirePinnedClock(BASE, { label: 'daytime, about 08:30' });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const vp of VIEWPORTS) await run(browser, vp);
} finally {
  await browser.close();
}
