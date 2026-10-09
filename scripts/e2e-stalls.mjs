#!/usr/bin/env node
/**
 * Market-stall panels e2e (#157): Nanda's hats and the Puleiro dos Pássaros as stalls.
 *
 *   pnpm build && pnpm start &
 *   pnpm e2e:stalls        (BASE_URL, CHROME_PATH, VIEW=390x844 optional)
 *
 * A new player opens the hat stall: everything is on the "À venda" shelf, the wallet shows their RV, what they cannot afford says how much is
 * missing and cannot be bought. Taking the free straw hat moves it to the "Seus chapéus" shelf with a stamp and costs nothing. At the Puleiro
 * every bird has its pixel icon and its catalog price; adopting the free green one puts it on the "Seus pássaros" shelf, on the shoulder.
 * Then the feira at night in the rain draws without page errors. Works at any server hour (the hat stall opens while Nanda is away, D12);
 * a server with TB_TEST_CLOCK_CONTROL=1 is pinned to 08:30 first.
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { goArea } from './lib/areas.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { DAY_MIN, requirePinnedClock } from './lib/clock-pin.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME = findChrome();
const [VW, VH] = (process.env.VIEW ?? '1280x800').split('x').map(Number);
const log = (...a) => console.log('  ·', ...a);
const PRICES = { verde: 0, azul: 12, canarinho: 15, vermelha: 18, periquito: 20 };

async function main() {
  assert(CHROME, 'set CHROME_PATH');
  try {
    await requirePinnedClock(BASE, { min: 0, max: 1439, target: DAY_MIN, label: 'any hour' });
  } catch {
    /* any hour works */
  }
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
    await page.click('#intro-enter', { timeout: 15_000 });
    await page.click('#intro-skip', { timeout: 12_000 });
    await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
    await page.click('#intro-tab-register');
    await page.fill('#intro-email', `stalls+${Date.now().toString(36)}@exemplo.com`);
    await page.fill('#intro-password', 'pao-de-queijo-2026');
    await page.click('#intro-submit');
    await page.fill('#avatar-name', 'Freguesa', { timeout: 15_000 });
    await page.click('button:has-text("ela (she)")');
    await page.click('#enter-praca');
    await finishArrival(page);
    const coins = await page.evaluate(() => window.__tb.game.profile.coins);
    log('in the praça with', coins, 'RV');

    // ---- Nanda's hats
    await page.evaluate(() => window.__tb.interact({ prop: 'barraca' }));
    await page.waitForSelector('[data-modal="hats"] .stall-panel', { timeout: 25_000 });
    assert(!(await page.$('[data-modal="hats"] [data-shelf="owned"]')), 'a new player owns no hats yet');
    assert(await page.$('[data-modal="hats"] [data-shelf="sale"] [data-hat="chapeu_palha"]'), 'the straw hat is for sale');
    assert(((await page.textContent('#shop-coins')) ?? '').includes(`${coins} RV`), 'the wallet shows the RV');
    const cant = await page.$$eval('[data-modal="hats"] .stall-card.cant', (els) => els.map((e) => ({ short: e.querySelector('.short')?.textContent ?? '', disabled: !!e.querySelector('button[disabled]') })));
    assert(cant.length > 0 && cant.every((c) => /Faltam \d+ RV/.test(c.short) && c.disabled), 'unaffordable hats say what is missing and cannot be bought');
    await page.click('[data-hat-action="chapeu_palha"]');
    await waitFor(page, () => window.__tb.game.profile.hats.includes('chapeu_palha'), null, 8000, 'the free hat is owned');
    await page.waitForSelector('[data-shelf="owned"] [data-hat="chapeu_palha"] .stall-stamp', { timeout: 3000 });
    assert(!(await page.$('[data-shelf="sale"] [data-hat="chapeu_palha"]')), 'the straw hat left the sale shelf');
    assert((await page.evaluate(() => window.__tb.game.profile.coins)) === coins, 'a free hat costs nothing');
    log('hat stall: bought the free hat, it moved to the owned shelf');
    await page.keyboard.press('Escape');
    await sleep(300);

    // ---- the Puleiro
    await page.evaluate(() => window.__tb.interact({ prop: 'poleiro' }));
    await page.waitForSelector('[data-modal="parrot-shop"] .stall-panel, [data-modal="parrot-shop"].stall-panel, .parrot-shop.stall-panel', { timeout: 25_000 });
    await waitFor(page, () => document.querySelectorAll('.parrot-shop [data-parrot] img[src^="data:image/png"]').length === 5, null, 8000, 'every bird has its icon');
    const tags = await page.$$eval('.parrot-shop [data-parrot]', (els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-parrot'), (e.querySelector('.price-tag')?.textContent ?? '').trim()])));
    for (const [id, price] of Object.entries(PRICES)) assert(tags[id] === (price === 0 ? 'Grátis' : String(price)), `${id} tag reads ${price} (got ${tags[id]})`);
    await page.click('[data-modal="parrot-shop"] [data-parrot="verde"] button.primary');
    await waitFor(page, () => window.__tb.game.profile.parrotOwned, null, 8000, 'the green bird is adopted');
    await page.waitForSelector('.parrot-shop [data-shelf="owned"] [data-parrot="verde"] .stall-tag.using', { timeout: 3000 });
    assert((await page.$$('.parrot-shop [data-shelf="sale"] [data-parrot]')).length === 4, 'four birds stay for sale');
    log('puleiro: adopted the green bird, it sits on the owned shelf, on the shoulder');
    await page.keyboard.press('Escape');
    await sleep(300);

    // ---- the feira at night in the rain
    await goArea(page, 'feira');
    await page.evaluate(() => window.__tb.setClock({ time: '22:30', weather: 'chuva' }));
    await sleep(3000);
    await page.evaluate(() => window.__tb.setClock({ time: null, weather: null }));
    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
    console.log('\n  ✓ e2e-stalls passed');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('\n  ✗ e2e-stalls failed:', e.message);
  process.exit(1);
});
