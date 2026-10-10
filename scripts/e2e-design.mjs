#!/usr/bin/env node
/**
 * Admin design mode (the level editor, issue #231): the dashboard's `/?design=<room>` link, the admin sign-in, select and drag a praça bench,
 * overlays, palette placement, the pre-publish checks, publish (a second player sees it only then, and the audit log has it), the change list,
 * the cheat sheet, live preview, a room switch to the padaria (a blocked arrival is an error) and the feira at tablet size.
 *
 *   node scripts/e2e-design.mjs   (BASE_URL, CHROME_PATH, TB_ADMIN_PASSWORD)
 *
 * Writes 1280x800 and 1024x768 shots to docs/screenshots/design-mode/ unless SHOTS=0.
 * Resets the praça to the code layout before exiting so a shared server is left as it was.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const CHROME = findChrome();
const PASSWORD = 'pao-de-queijo-2026';
const ADMIN = process.env.TB_ADMIN_PASSWORD || 'tb-admin-praca';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs/screenshots/design-mode');
const SAVE = process.env.SHOTS !== '0';
const log = (...a) => console.log('  ·', ...a);

const DESKTOP = { width: 1280, height: 800 };
const TABLET = { width: 1024, height: 768 };

async function shot(page, name) {
  if (!SAVE) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await sleep(250);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('shot', name);
}

async function enter(page, name) {
  await page.goto(`${BASE}/?notype=1`);
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

/** The dashboard's link: reload into `/?design=<room>`, sign in when asked, wait for the editor. */
async function openEditor(page, room, { signIn = false } = {}) {
  await page.goto(`${BASE}/?notype=1&design=${room}`);
  if (signIn) {
    await page.waitForSelector('#design-admin-password', { timeout: 20_000 });
    await shot(page, '1280x800-0-sign-in');
    await page.fill('#design-admin-name', 'Jonny');
    await page.fill('#design-admin-password', ADMIN);
    await page.click('#design-admin-go');
  }
  await page.waitForSelector('#design-root', { timeout: 20_000 });
  await page.waitForFunction((r) => window.__tb?.design?.room === r && window.__tb.game.room?.room === r, room, { timeout: 10_000 });
  await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
  await sleep(600);
}

const propX = (page, id) => page.evaluate((id) => window.__tb.rooms.praca.props.find((p) => p.id === id)?.x ?? null, id);
const draftX = (page, id) => page.evaluate((id) => window.__tb.design.objects().find((p) => p.id === id)?.x ?? null, id);

/** Click the middle of a prop's footprint, after panning it into view. */
async function clickProp(page, id, opts = {}) {
  await page.evaluate((id) => window.__tb.design.focus([id]), id);
  await sleep(400);
  const pt = await page.evaluate((id) => {
    const p = window.__tb.design.objects().find((q) => q.id === id);
    return window.__tb.tileToClient(p.x + ((p.w ?? 1) - 1) / 2, p.y + (p.h ?? 1) - 1);
  }, id);
  await page.mouse.click(pt.px, pt.py, opts);
  return pt;
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
  let published = false;
  try {
    await enter(admin, 'Lia');
    await enter(guest, 'Bia');
    const before = await propX(guest, 'banco_4');
    assert(typeof before === 'number', 'banco_4 is in the praça');

    // ---- the dashboard link: sign in with the admin password, editor opens on the praça
    await openEditor(admin, 'praca', { signIn: true });
    await shot(admin, '1280x800-1-praca-overview');

    // ---- select and drag the bench three tiles east (snap on)
    const at = await clickProp(admin, 'banco_4');
    await admin.waitForFunction(() => window.__tb.design.selected().includes('banco_4'), null, { timeout: 4_000 });
    await admin.waitForSelector('#design-insp-id', { timeout: 4_000 });
    const to = await admin.evaluate(() => {
      const p = window.__tb.design.objects().find((q) => q.id === 'banco_4');
      return window.__tb.tileToClient(p.x + 3, p.y);
    });
    await admin.mouse.move(at.px, at.py);
    await admin.mouse.down();
    await admin.mouse.move(to.px, to.py, { steps: 12 });
    await admin.mouse.up();
    await sleep(300);
    const moved = await draftX(admin, 'banco_4');
    assert(moved === before + 3, `drag left banco_4 at ${moved}, expected ${before + 3}`);
    await shot(admin, '1280x800-2-praca-selected');
    // nothing is live yet: the guest still walks the old bench
    await sleep(300);
    assert((await propX(guest, 'banco_4')) === before, 'the guest saw a draft');

    // ---- multi-select with a marquee, then the collision overlay
    await admin.keyboard.press('Escape');
    await admin.evaluate(() => window.__tb.design.focus(['banco_4']));
    await sleep(300);
    // start on empty ground (a press on a prop drags the prop), then sweep over the bench and its neighbours
    const box = await admin.evaluate(() => {
      const p = window.__tb.design.objects().find((q) => q.id === 'banco_4');
      const b = window.__tb.tileToClient(p.x + 3, p.y + 2);
      for (let dy = -3; dy <= 0; dy++) {
        for (let dx = -5; dx <= -2; dx++) {
          const a = window.__tb.tileToClient(p.x + dx, p.y + dy);
          if (!window.__tb.design.hitAt(a.px, a.py)) return { a, b };
        }
      }
      return null;
    });
    assert(box, 'no empty ground near the bench to start a marquee');
    await admin.mouse.move(box.a.px, box.a.py);
    await admin.mouse.down();
    await admin.mouse.move(box.b.px, box.b.py, { steps: 8 });
    const marquee = await admin.evaluate(() => window.__tb.design.selected().length);
    await admin.keyboard.press('c');
    await shot(admin, '1280x800-3-praca-marquee-collision');
    await admin.mouse.up();
    assert(marquee >= 2, `the marquee selected ${marquee}`);
    assert((await draftX(admin, 'banco_4')) === before + 3, 'the marquee moved the bench');
    log('marquee selected', marquee);
    await admin.keyboard.press('c');
    await admin.keyboard.press('Escape');

    // ---- place a plant from the palette
    await admin.click('.dm-chip[data-cat="plants"]');
    await admin.locator('#design-palette .dm-asset').first().click();
    const spot = await admin.evaluate(() => {
      window.__tb.design.focusTile(14, 18);
      return null;
    });
    void spot;
    await sleep(300);
    const ghost = await admin.evaluate(() => window.__tb.tileToClient(14, 18));
    await admin.mouse.move(ghost.px, ghost.py);
    await shot(admin, '1280x800-4-praca-palette-placing');
    const n0 = await admin.evaluate(() => window.__tb.design.objects().length);
    await admin.mouse.click(ghost.px, ghost.py);
    await admin.keyboard.press('Escape');
    assert((await admin.evaluate(() => window.__tb.design.objects().length)) === n0 + 1, 'palette click did not place');

    // ---- undo / redo the placement
    await admin.keyboard.press('Control+z');
    assert((await admin.evaluate(() => window.__tb.design.objects().length)) === n0, 'undo did not remove the plant');
    await admin.keyboard.press('Control+Shift+z');
    assert((await admin.evaluate(() => window.__tb.design.objects().length)) === n0 + 1, 'redo did not bring it back');

    // ---- the change list, and the draft autosave
    await admin.click('.dm-tab[data-tab="changes"]');
    await admin.waitForFunction(() => window.__tb.design.saveState() === 'saved', null, { timeout: 8_000 });
    await shot(admin, '1280x800-5-praca-changes');

    // ---- publish: the dialog, then everyone sees it
    const auditRows = () => admin.evaluate(async () => (await (await fetch('/api/admin/audit?action=design.publish')).json()).items);
    const audited = (await auditRows()).length;
    await admin.keyboard.press('Control+Enter');
    await admin.waitForSelector('#design-publish-go', { timeout: 4_000 });
    await shot(admin, '1280x800-6-praca-publish-dialog');
    await admin.click('#design-publish-go');
    await waitFor(guest, (x) => window.__tb.rooms.praca.props.find((p) => p.id === 'banco_4')?.x === x, before + 3, 8_000, 'guest sees the publish');
    published = true;
    const audit = await auditRows();
    assert(audit.length === audited + 1 && audit[0].target === 'praca' && audit[0].actor.startsWith('Jonny'), `audit: ${JSON.stringify(audit[0])}`);
    log('published, audited as', audit[0].actor);
    await guest.evaluate(() => window.__tb.walkTo(16, 18, false));
    await sleep(600);
    await shot(guest, '1280x800-7-praca-guest-after-publish');

    // ---- the cheat sheet
    await admin.keyboard.press('?');
    await admin.waitForSelector('.dm-cheats', { timeout: 4_000 });
    await shot(admin, '1280x800-8-cheat-sheet');
    await admin.keyboard.press('Escape');

    // ---- live preview: walk the draft, nobody else sees it
    await admin.keyboard.press('p');
    for (let i = 0; i < 4; i++) {
      await admin.keyboard.down('ArrowRight');
      await sleep(260);
      await admin.keyboard.up('ArrowRight');
    }
    await sleep(500);
    await shot(admin, '1280x800-9-praca-preview');
    await admin.keyboard.press('p');

    // ---- room switch: the padaria, a blocker on the arrival tile is an error
    await admin.selectOption('#design-room', 'padaria');
    await admin.waitForURL(/design=padaria/, { timeout: 10_000 });
    await openEditor(admin, 'padaria');
    await admin.click('.dm-chip[data-cat="all"]');
    await admin.fill('#design-search', 'lixeira');
    await admin.locator('#design-palette .dm-asset').first().click();
    const arrive = await admin.evaluate(() => {
      window.__tb.design.focusTile(1, 6);
      return window.__tb.tileToClient(1, 6);
    });
    await sleep(300);
    const arrive2 = await admin.evaluate(() => window.__tb.tileToClient(1, 6));
    void arrive;
    await admin.mouse.click(arrive2.px, arrive2.py);
    await admin.keyboard.press('Escape');
    await admin.click('#design-checks');
    await admin.waitForFunction(() => window.__tb.design.issues().some((i) => i.kind === 'door' && i.severity === 'error'), null, { timeout: 4_000 });
    await shot(admin, '1280x800-10-padaria-checks');
    await admin.keyboard.press('Control+Enter');
    await admin.waitForSelector('#design-publish-anyway', { timeout: 4_000 });
    assert(await admin.locator('#design-publish-go').isDisabled(), 'publish with an error must need the confirm');
    await shot(admin, '1280x800-11-padaria-publish-blocked');
    await admin.keyboard.press('Escape');
    await admin.keyboard.press('Control+z');

    // ---- the feira at tablet size, layers tab
    await admin.setViewportSize(TABLET);
    await admin.selectOption('#design-room', 'feira');
    await admin.waitForURL(/design=feira/, { timeout: 10_000 });
    await openEditor(admin, 'feira');
    await admin.click('.dm-tab[data-tab="layers"]');
    await shot(admin, '1024x768-12-feira-tablet-layers');
    await admin.click('#design-layer-objects-eye');
    await shot(admin, '1024x768-13-feira-objects-hidden');
    await admin.click('#design-layer-objects-eye');
    await admin.click('#design-exit');
    await admin.waitForSelector('#design-root', { state: 'detached', timeout: 4_000 });

    assert(errors.length === 0, errors.join('\n'));
    log('design mode e2e ok');
  } finally {
    // leave a shared server as it was: the code layout in the praça, no drafts
    await admin
      .evaluate(async (published) => {
        const post = (p, b) => fetch(`/api/admin/design/${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
        if (published) await post('reset', { room: 'praca' });
        for (const room of ['praca', 'padaria', 'feira']) await post('draft/discard', { room });
      }, published)
      .catch(() => {});
    await sleep(300);
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
