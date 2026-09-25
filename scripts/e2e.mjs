#!/usr/bin/env node
/**
 * End-to-end smoke test of the Phase 0 play path in a real browser.
 *
 *   pnpm build && pnpm start            # in one terminal
 *   pnpm e2e                            # in another (BASE_URL / CHROME_PATH / SHOTS_DIR optional)
 *
 * Plays: age gate → avatar → Praça (walk, sit, wave, chat) → Padaria → Seu Carlos chips →
 * Me vê um… (parses each Portuguese order to fill the tray) → hat shop → Kitnet chair,
 * plus a second player for chat gloss + friend request.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
const SHOTS = process.env.SHOTS_DIR ?? '';
const VIDEO = process.env.VIDEO_DIR ?? '';
const HEADLESS = process.env.HEADED ? false : true;
/** Static solo build: no second player, world runs in the page. */
const SOLO = !!process.env.SOLO;

const log = (...a) => console.log('  ·', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Extra dwell time on key moments when recording a video. */
const dwell = (ms) => (VIDEO ? sleep(ms) : Promise.resolve());

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('screenshot', name);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function waitFor(page, fn, arg, timeout = 10_000, label = 'condition') {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 100 });
  } catch (e) {
    throw new Error(`timeout waiting for ${label}`);
  }
}

const room = (page) => page.evaluate(() => window.__tb.game.room?.room);
const profile = (page) => page.evaluate(() => window.__tb.game.profile);

async function clickTile(page, x, y, lift = 0) {
  const p = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);
  const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
  await page.mouse.click(p.px, p.py - lift * scale);
}

async function waitIdleAt(page, x, y, label) {
  await waitFor(page, ([x, y]) => {
    const t = window.__tb.selfTile();
    return t && !t.moving && t.tile.x === x && t.tile.y === y;
  }, [x, y], 12_000, label ?? `avatar at ${x},${y}`);
}

async function createAvatar(page, name, pronoun) {
  await page.goto(BASE);
  await page.waitForSelector('#birth-month');
  await page.selectOption('#birth-month', '5');
  await page.selectOption('#birth-year', '2001');
  await page.click('#age-next');
  await page.waitForSelector('#avatar-name');
  await page.fill('#avatar-name', name);
  const label = { ele: 'ele (he)', ela: 'ela (she)', nome: 'só meu nome (name only)' }[pronoun];
  await page.click(`button:has-text("${label}")`);
  assert(await page.isDisabled('#enter-praca'), 'cannot enter before confirming 18+');
  await page.check('#confirm-18');
  return async () => {
    await page.click('#enter-praca');
    await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 10_000, 'praça');
    await sleep(400);
  };
}

// ---- parse a Portuguese order back into a tray (proves the order text alone is solvable)
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3 };
async function trayFor(page, orderText) {
  const items = await page.evaluate(() => window.__tb.rooms && window.__tbItems);
  const list = items ?? [];
  const text = orderText.toLowerCase();
  const tray = {};
  // Longest forms first so "pão de queijo" wins over "pão".
  const forms = list.flatMap((i) => [[i.plural, i.id], [i.form, i.id]]).sort((a, b) => b[0].length - a[0].length);
  let rest = text;
  for (const [form, id] of forms) {
    const re = new RegExp(`(um|uma|dois|duas|três|tres)\\s+${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}-])`, 'u');
    let m;
    while ((m = rest.match(re))) {
      tray[id] = (tray[id] ?? 0) + NUM[m[1]];
      rest = rest.replace(m[0], ' ');
    }
  }
  return tray;
}

async function main() {
  assert(CHROME, 'Chrome/Chromium not found — set CHROME_PATH');
  console.log(`\nTudo Bem e2e → ${BASE}`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: HEADLESS, slowMo: VIDEO ? 90 : 0, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctxA = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ...(VIDEO ? { recordVideo: { dir: VIDEO, size: { width: 1440, height: 900 } } } : {}),
  });
  const page = await ctxA.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));

  // 0. Under-18 is turned away at the gate
  {
    const ctxMinor = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pm = await ctxMinor.newPage();
    await pm.goto(BASE);
    await pm.waitForSelector('#birth-month');
    await pm.selectOption('#birth-month', '1');
    await pm.selectOption('#birth-year', String(new Date().getFullYear() - 16));
    await pm.click('#age-next');
    await pm.waitForSelector('text=Só para maiores de 18 anos');
    assert(!(await pm.$('#avatar-name')), 'no avatar creator for under-18');
    await ctxMinor.close();
    log('under-18 blocked');
  }

  // 1. Age gate + avatar creation (18+ confirmation required)
  const enter = await createAvatar(page, 'Jonny', 'ele');
  await sleep(300);
  await shot(page, '01_avatar_creator');
  await enter();
  await dwell(1500);
  const start = await profile(page);
  log('landed in', await room(page), 'coins', start.coins, 'plate', start.nameplate);
  const art = await page.evaluate(() => window.__tb.artStats());
  log('baked art sprites loaded', `${art.loaded}/${art.total}`);
  assert(art.total > 0 && art.loaded === art.total, 'baked art manifest + sprites load');
  assert(start.nameplate === 'verde', 'Verde nameplate');

  // 2. Walk, sit on a bench, wave, chat
  await clickTile(page, 8, 6);
  await waitIdleAt(page, 8, 6);
  await clickTile(page, 7, 7, 14);
  await waitFor(page, () => window.__tb.game.profile?.tutorial.sentar, null, 8000, 'sat on bench');
  await page.click('[data-emote="oi"]');
  await page.fill('#chat-input', 'Oi, tudo bem? Bom dia, pessoal!');
  await page.press('#chat-input', 'Enter');
  await waitFor(page, () => window.__tb.game.profile?.tutorial.conversar, null, 5000, 'chat step');
  let pageB = null;
  let aId = null;
  if (!SOLO) {
    // Second player joins to chat + befriend
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    pageB = await ctxB.newPage();
    const enterB = await createAvatar(pageB, 'Bia', 'ela');
    await enterB();
    await clickTile(pageB, 8, 8);
    await sleep(1200);
    await pageB.fill('#chat-input', 'Oi, Jonny! Eu sou de Chicago. Vamos na padaria?');
    await pageB.press('#chat-input', 'Enter');
    await sleep(300);
  }
  await page.fill('#chat-input', 'Legal! Eu quero um pão de queijo');
  await page.press('#chat-input', 'Enter');
  await sleep(900);
  const glossSeen = await page.evaluate(() => [...window.__tb.game.avatars.values()].some((a) => a.bubbles.some((b) => b.gloss)));
  assert(glossSeen, 'English gloss under Portuguese bubble');
  await shot(page, '02_praca_chat_gloss');
  await dwell(2500);

  // Filter check: PII and alcohol are blocked; player chat is never rewritten.
  const sender = pageB ?? page;
  for (const text of ['me liga 11 98765-4321', 'bora tomar uma cerveja']) {
    await sender.fill('#chat-input', text);
    await sender.press('#chat-input', 'Enter');
  }
  await sender.fill('#chat-input', 'Essa coxinha tá gostosa!');
  await sender.press('#chat-input', 'Enter');
  await sleep(800);
  const texts = await page.evaluate(() => [...window.__tb.game.avatars.values()].flatMap((a) => a.bubbles.map((b) => b.text)));
  assert(!texts.some((t) => t.includes('98765')), 'phone number blocked');
  assert(!texts.some((t) => /cerveja/i.test(t)), 'alcohol blocked');
  assert(!texts.some((t) => t.includes('•••')), 'no auto-rewrite of player chat');
  assert(texts.includes('Essa coxinha tá gostosa!'), 'warned message delivered unchanged');
  log('filter ok: PII + alcohol blocked, warn delivered verbatim');

  if (!SOLO) {
    // Friend request B → A, accept on A
    const bId = await pageB.evaluate(() => window.__tb.game.room.selfId);
    aId = await page.evaluate(() => window.__tb.game.room.selfId);
    await pageB.evaluate((id) => window.__tb.net.send({ t: 'friend', action: 'request', targetId: id }), aId);
    await page.click('#btn-friends');
    await page.waitForSelector('button:has-text("Aceitar")');
    await page.click('button:has-text("Aceitar")');
    await waitFor(page, (id) => window.__tb.game.profile.friends.includes(id), bId, 5000, 'friends');
    await page.keyboard.press('Escape');
    log('friends ok');
  }

  // 3. Enter the Padaria through its door
  await clickTile(page, 5, 0, 40);
  await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 15_000, 'padaria');
  await sleep(700);
  await shot(page, '03_padaria');
  await dwell(1200);

  // 4. Seu Carlos breakfast scene (chips only)
  await clickTile(page, 3, 1, 50);
  await page.waitForSelector('#dialogue [data-chip="0"]', { timeout: 12_000 });
  await sleep(300);
  await shot(page, '04_carlos_scene_start');
  const picks = [0, 1, 0, 0, 1];
  for (let i = 0; i < picks.length; i++) {
    const before = await page.textContent('#dialogue .line');
    await dwell(1600);
    await page.click(`#dialogue [data-chip="${picks[i]}"]`);
    await waitFor(page, (b) => document.querySelector('#dialogue .line')?.textContent !== b, before, 5000, 'next Carlos line');
    if (i === 2) await shot(page, '05_carlos_scene_mid');
  }
  await page.waitForSelector('#btn-play-mg');
  await shot(page, '06_carlos_scene_end');
  await dwell(2200);
  const afterScene = await profile(page);
  log('scene payout →', afterScene.coins - start.coins, 'RV');
  assert(afterScene.tutorial.carlos, 'carlos step');

  // 5. Me vê um… minigame
  await page.click('#btn-play-mg');
  await page.waitForSelector('#mg-order');
  const forms = await page.evaluate(() => [...document.querySelectorAll('#mg-shelves button')].map((b) => ({ id: b.dataset.item, form: b.querySelector('.pt').textContent })));
  const plurals = {
    pao_frances: 'pães franceses', pao_na_chapa: 'pães na chapa', pao_de_queijo: 'pães de queijo', coxinha: 'coxinhas', misto_quente: 'mistos-quentes',
    sonho: 'sonhos', bolo_de_fuba: 'bolos de fubá', cafezinho: 'cafezinhos', cafe_com_leite: 'cafés com leite', suco_de_laranja: 'sucos de laranja', guarana: 'guaranás',
  };
  await page.evaluate((list) => (window.__tbItems = list), forms.map((f) => ({ ...f, plural: plurals[f.id] })));
  for (let round = 0; round < 6; round++) {
    await page.waitForSelector('#mg-order');
    const text = await page.textContent('#mg-order');
    const tray = await trayFor(page, text);
    log(`order ${round + 1}: “${text}” →`, JSON.stringify(tray));
    await dwell(round < 2 ? 1400 : 700);
    for (const [id, n] of Object.entries(tray)) for (let k = 0; k < n; k++) await page.click(`#mg-shelves [data-item="${id}"]`);
    if (round === 2) await shot(page, '07_meveum_tray');
    await page.click('#mg-submit');
    if (round < 5) await waitFor(page, (t) => document.querySelector('#mg-order')?.textContent !== t, text, 6000, 'next order');
  }
  await page.waitForSelector('#mg-end', { timeout: 8000 });
  await sleep(300);
  await shot(page, '08_meveum_end');
  await dwell(2200);
  const afterMg = await profile(page);
  log('minigame payout →', afterMg.coins - afterScene.coins, 'RV');
  assert(afterMg.coins - afterScene.coins >= 18, 'perfect-ish minigame payout');
  await page.click('#mg-end button:has-text("Sair")');

  // 6. Back to the praça via the door, buy + equip a hat at Nanda's stall
  await clickTile(page, 0, 6, 40);
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 15_000, 'back in praça');
  await sleep(500);
  await clickTile(page, 11, 6, 50);
  await page.waitForSelector('[data-modal="hats"]', { timeout: 12_000 });
  await page.click('[data-hat="boina_vermelha"]');
  await page.click('[data-hat-action="boina_vermelha"]');
  await waitFor(page, () => window.__tb.game.profile.hat === 'boina_vermelha', null, 5000, 'hat equipped');
  await sleep(300);
  await shot(page, '09_hat_shop');
  await dwell(1800);
  await page.keyboard.press('Escape');
  // Adopt the parrot (optional cosmetic) and ask for a hint
  await clickTile(page, 10, 9, 50);
  await page.waitForSelector('#dialogue [data-chip="0"]', { timeout: 12_000 });
  await page.click('#dialogue [data-chip="0"]');
  await waitFor(page, () => window.__tb.game.profile.parrotOwned, null, 5000, 'parrot');
  await page.click('#btn-parrot');
  await page.waitForSelector('.parrot-whisper', { timeout: 5000 });
  await sleep(400);
  await shot(page, '10_praca_hat_parrot');
  await dwell(1500);

  // 7. Kitnet: place the free chair
  await clickTile(page, 0, 4, 40);
  await waitFor(page, () => window.__tb.game.room?.room === 'kitnet', null, 15_000, 'kitnet');
  await sleep(500);
  await page.click('#btn-decor');
  await page.click('[data-furniture="cadeira_madeira"]');
  await clickTile(page, 3, 4);
  await waitFor(page, () => window.__tb.game.furniture.length === 1, null, 5000, 'chair placed');
  // Buy + place a plant too
  await page.click('#tab-loja');
  await page.click('[data-buy-furniture="planta"]');
  await sleep(300);
  await page.click('button:has-text("Meus móveis")');
  await page.click('[data-furniture="planta"]');
  await clickTile(page, 5, 4);
  await waitFor(page, () => window.__tb.game.furniture.length === 2, null, 5000, 'plant placed');
  await page.click('#decor-panel button.ghost');
  await sleep(400);
  await clickTile(page, 3, 4, 10);
  await waitIdleAt(page, 3, 4, 'sit on chair');
  await sleep(600);
  await shot(page, '11_kitnet_chair');

  if (!SOLO) {
    // Friend visits the kitnet
    await pageB.evaluate((id) => window.__tb.net.send({ t: 'join', room: 'kitnet', ownerId: id }), aId);
    await waitFor(pageB, () => window.__tb.game.room?.room === 'kitnet', null, 5000, 'friend visits kitnet');
    await sleep(500);
    await pageB.fill('#chat-input', 'Que kitnet legal!');
    await pageB.press('#chat-input', 'Enter');
    await sleep(800);

  }
  await shot(page, '12_kitnet_friend_visit');
  await dwell(2500);

  const final = await profile(page);
  const steps = Object.entries(final.tutorial).filter(([, v]) => !v).map(([k]) => k);
  log('final coins', final.coins, 'hat', final.hat, 'missing steps', steps.length ? steps : 'none', 'bonus', final.tutorialRewarded);
  assert(!steps.length && final.tutorialRewarded, 'all first steps done + bonus');
  assert(!errors.length, `no page errors: ${errors.join(' | ')}`);

  const video = VIDEO ? await page.video()?.path() : null;
  await ctxA.close();
  await browser.close();
  if (video) log('video', video);
  console.log('\n  ✓ Phase 0 play path passed\n');
}

main().catch((e) => {
  console.error('\n  ✗ e2e failed:', e.message, '\n');
  process.exit(1);
});
