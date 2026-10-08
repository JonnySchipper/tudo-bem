#!/usr/bin/env node
/**
 * Admin design mode: the credits door, move one praça bench, save, and see it on a second player and after a reload.
 *
 *   node scripts/e2e-design.mjs   (BASE_URL, CHROME_PATH, TB_ADMIN_PASSWORD)
 *
 * Writes 1280x800 and 390x844 shots to docs/lifesim/shots/design-mode/ unless SHOTS=0.
 * Reverts the room to the code layout before exiting so a shared server is left as it was.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const CHROME = findChrome();
const PASSWORD = 'pao-de-queijo-2026';
const ADMIN = process.env.TB_ADMIN_PASSWORD || 'tb-admin-praca';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs/lifesim/shots/design-mode');
const SAVE = process.env.SHOTS !== '0';
const log = (...a) => console.log('  ·', ...a);

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function shot(page, name) {
  if (!SAVE) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('shot', name);
}

async function enter(page, name) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `design+${name}-${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PASSWORD);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
}

async function openCredits(page) {
  const visible = await page.locator('#btn-credits').isVisible().catch(() => false);
  if (!visible) await page.click('#btn-menu').catch(() => page.click('#btn-burger'));
  await page.click('#btn-credits');
  await page.waitForSelector('#credits-admin-door', { timeout: 8_000 });
}

async function loginAdmin(page) {
  await openCredits(page);
  await page.click('#credits-admin-door');
  await page.waitForSelector('#admin-password', { timeout: 8_000 });
  await page.fill('#admin-password', ADMIN);
  await page.click('#admin-login-go');
  await page.waitForSelector('#admin-design-toggle', { timeout: 8_000 });
}

async function showAdminToggle(page) {
  await page.locator('#admin-design-toggle').scrollIntoViewIfNeeded();
  await sleep(200);
}

const benchX = (page) => page.evaluate(() => window.__tb.rooms.praca.props.find((p) => p.id === 'banco_4')?.x ?? null);

async function focusProp(page, id) {
  await page.evaluate((id) => {
    const p = window.__tb.rooms.praca.props.find((q) => q.id === id);
    const pt = window.__tb.tileToClient(p.x, p.y);
    const panel = document.getElementById('design-panel')?.getBoundingClientRect();
    const inPanel = !!panel && pt.px >= panel.left && pt.px <= panel.right && pt.py >= panel.top && pt.py <= panel.bottom;
    const bottom = panel && panel.top > window.innerHeight * 0.4 ? panel.top - 24 : window.innerHeight - 80;
    if (pt.px > 36 && pt.px < window.innerWidth - 36 && pt.py > 90 && pt.py < bottom && !inPanel) return;
    const targetX = window.innerWidth / 2;
    const targetY = Math.max(150, Math.min(bottom * 0.55, 300));
    const scale = window.__tb.renderer?.cam?.scale || 1;
    const pan = window.__tb.game.designPan;
    window.__tb.game.designPan = { x: pan.x + (pt.px - targetX) / scale, y: pan.y + (pt.py - targetY) / scale };
  }, id);
  await sleep(350);
}

async function selectProp(page, id) {
  await focusProp(page, id);
  const pt = await page.evaluate((id) => {
    const p = window.__tb.rooms.praca.props.find((q) => q.id === id);
    return window.__tb.tileToClient(p.x, p.y);
  }, id);
  await page.mouse.click(pt.px, pt.py);
  try {
    await page.waitForFunction((id) => document.getElementById('design-meta')?.textContent?.includes(id), id, { timeout: 4_000 });
  } catch (err) {
    const meta = await page.locator('#design-meta').textContent().catch(() => '');
    log('meta after click', id, meta);
    throw err;
  }
}

async function dragProp(page, id) {
  const spots = await page.evaluate((id) => {
    const p = window.__tb.rooms.praca.props.find((q) => q.id === id);
    return { from: window.__tb.tileToClient(p.x, p.y), to: window.__tb.tileToClient(p.x + 3, p.y) };
  }, id);
  await page.mouse.move(spots.from.px, spots.from.py);
  await page.mouse.down();
  await page.mouse.move(spots.to.px, spots.to.py, { steps: 10 });
  await sleep(250);
}

async function editorShots(page, prefix, id) {
  await page.waitForSelector('#design-banner', { timeout: 8_000 });
  await sleep(400);
  await selectProp(page, id);
  await shot(page, `${prefix}-selected`);
  await dragProp(page, id);
  await shot(page, `${prefix}-dragging`);
  await page.mouse.up();
  await sleep(200);
  const moved = await benchX(page);
  await page.locator('#design-palette').scrollIntoViewIfNeeded();
  await sleep(150);
  await shot(page, `${prefix}-palette`);
  return moved;
}

async function main() {
  assert(CHROME, 'set CHROME_PATH');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const adminCtx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const guestCtx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const admin = await adminCtx.newPage();
  const guest = await guestCtx.newPage();
  const errors = [];
  for (const page of [admin, guest]) page.on('pageerror', (e) => errors.push(String(e)));
  let reverted = false;
  try {
    await enter(admin, 'Lia');
    await enter(guest, 'Bia');
    const before = await benchX(admin);
    assert(before === 18, `banco_4 started at ${before}, expected 18`);
    assert((await benchX(guest)) === 18, 'guest did not start on the code layout');

    await loginAdmin(admin);
    await showAdminToggle(admin);
    await shot(admin, '1280x800-admin-toggle');
    await admin.click('#admin-design-toggle');
    const moved = await editorShots(admin, '1280x800', 'banco_4');
    assert(typeof moved === 'number' && moved !== before, `drag left banco_4 at ${moved}`);
    log('dragged banco_4', before, '→', moved);

    await admin.click('#design-save');
    await admin.waitForFunction(() => (document.getElementById('design-status')?.textContent ?? '').includes('Salvo'), null, { timeout: 8_000 });
    await waitFor(guest, (x) => window.__tb.rooms.praca.props.find((p) => p.id === 'banco_4')?.x === x, moved, 8_000, 'guest sees the save');
    assert((await guest.locator('#design-banner').count()) === 0, 'the guest is in design mode');
    await guest.evaluate(() => window.__tb.walkTo(16, 18, false));
    await sleep(700);
    await shot(guest, '1280x800-saved-guest');

    await guest.reload();
    await finishArrival(guest);
    await guest.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
    const afterReload = await benchX(guest);
    assert(afterReload === moved, `reload restored x ${afterReload}, saved ${moved}`);
    log('reload kept banco_4 at', afterReload);

    await admin.click('#design-exit');
    await admin.waitForSelector('#design-banner', { state: 'detached', timeout: 4_000 });
    await admin.setViewportSize(PHONE);
    await guest.setViewportSize(PHONE);
    await sleep(500);
    await openCredits(admin);
    await admin.click('#credits-admin-door');
    await admin.waitForSelector('#admin-design-toggle', { timeout: 8_000 });
    await showAdminToggle(admin);
    await shot(admin, '390x844-admin-toggle');
    await admin.click('#admin-design-toggle');
    await editorShots(admin, '390x844', 'lixeira_p2');
    await admin.click('#design-discard');
    await sleep(300);
    await guest.evaluate(() => window.__tb.walkTo(20, 19, false));
    await guest.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
    await sleep(500);
    await shot(guest, '390x844-saved-guest');
    assert((await benchX(guest)) === moved, 'phone shots changed the saved layout');

    await admin.click('#design-revert');
    await admin.waitForFunction(() => (document.getElementById('design-status')?.textContent ?? '').includes('código'), null, { timeout: 8_000 });
    await waitFor(guest, () => window.__tb.rooms.praca.props.find((p) => p.id === 'banco_4')?.x === 18, null, 8_000, 'reverted for the next test');
    reverted = true;
    assert(errors.length === 0, errors.join('\n'));
    log('design mode e2e ok');
  } finally {
    if (!reverted) {
      await admin.evaluate(() => {
        const send = window.__tb?.net?.send;
        if (send) send({ t: 'admin', action: 'layoutRevert', room: 'praca' });
      }).catch(() => {});
      await sleep(400);
    }
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
