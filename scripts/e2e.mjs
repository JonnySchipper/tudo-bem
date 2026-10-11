#!/usr/bin/env node
/**
 * End-to-end smoke test of the Phase 0 play path in a real browser.
 *
 *   pnpm build && pnpm start            # in one terminal
 *   pnpm e2e                            # in another (BASE_URL / CHROME_PATH / SHOTS_DIR optional)
 *
 * Plays: age gate → avatar → Praça (ambiance CPUs, daily kiosk, walk, sit, wave, chat) → Padaria →
 * Seu Carlos (today's recado, then the counter: pay and carry the order) → Correria no Balcão (the
 * shelf taps fill the tray from each order) → hat shop → Kitnet chair, plus a second player for chat
 * gloss + friend request. Expects LIVEOPS_CPU_AMBIANCE on (the default); set CPU_AMBIANCE=off when the
 * server runs with it off.
 *
 * PINNED CLOCK (Phase 10): the game clock is real time (1 game day = 48 real minutes), so this script needs a server whose clock reads daytime
 * (about 08:30; the baker, Nanda and the feira all depend on the hour). Start it pinned and with the recado offer fixed:
 *     TB_TEST_CLOCK_CONTROL=1 TB_TEST_OFFER=carlos_cafe_pra_nanda TB_TEST_ROLL=1 pnpm start      # the script sets 08:30 itself
 *     (or TB_TEST_CLOCK_OFFSET_MIN=<n> from `node scripts/lib/clock-pin.mjs 08:30` instead of TB_TEST_CLOCK_CONTROL=1)
 * It fails fast with that message when the clock is not daytime. The whole recado (offer from the baker, café com leite, hand it to Nanda, RV and
 * bond) is part of every run; set SKIP_RECADO=1 to run without TB_TEST_OFFER. 'pnpm e2e:all' starts such a server and stops it afterwards.
 * SOLO builds have no server to pin: the in-page world gets `?tbclockmin=` instead (the same 08:30), and the recado part is skipped.
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAY_MIN, assertPageClock, offsetMinFor, requirePinnedClock } from './lib/clock-pin.mjs';
import { assert, playShift, sleep, startShiftFromPedido, waitFor } from './lib/correria-play.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { openBout, playBout, readBoutHud, startBout, waitBoutPhase } from './lib/bout-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME = findChrome();
const SHOTS = process.env.SHOTS_DIR ?? '';
const VIDEO = process.env.VIDEO_DIR ?? '';
const HEADLESS = process.env.HEADED ? false : true;
/** Static solo build: no second player, world runs in the page. */
const SOLO = !!process.env.SOLO;
const AMBIANCE = (process.env.CPU_AMBIANCE ?? 'on') !== 'off';
const CPU_NAMES = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/curriculum/phase0/cpu-names.json'), 'utf8')).names;

const log = (...a) => console.log('  ·', ...a);
/** Extra dwell time on key moments when recording a video. */
const dwell = (ms) => (VIDEO ? sleep(ms) : Promise.resolve());

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('screenshot', name);
}

const room = (page) => page.evaluate(() => window.__tb.game.room?.room);
const cpus = (page) => page.evaluate(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).map((a) => ({ ...a.pub, bubbles: a.bubbles.length })));
const profile = (page) => page.evaluate(() => window.__tb.game.profile);
/** D12: the padaria's baker at the game clock the server runs (Seu Carlos 06:00-22:00, Dona Graça 22:00-06:00). The e2e must pass at any hour. */
const bakerNow = (page) => page.evaluate(() => (window.__tb.clock.minutes() >= 360 && window.__tb.clock.minutes() < 1320 ? { id: 'carlos', name: 'Seu Carlos' } : { id: 'graca', name: 'Dona Graça' }));

/** Tap a floor tile (pointer events — the world listens on pointerup, not click). */
async function clickTile(page, x, y, lift = 0) {
  const p = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);
  const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
  const px = p.px;
  const py = p.py - lift * scale;
  const canvas = page.locator('canvas#world');
  await canvas.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: px, clientY: py });
  await canvas.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: px, clientY: py });
}

/**
 * Renderer-independent input (Phase 0): reach a prop / NPC / portal by id through the same handler a click uses.
 * Real pointer input stays covered by clickTile (one floor tile, one bench).
 */
async function interact(page, target) {
  const ok = await page.evaluate((t) => window.__tb.interact(t), target);
  assert(ok, `interact target exists in the current room: ${JSON.stringify(target)}`);
}
const walkTo = (page, x, y, sit = false) => page.evaluate(([x, y, sit]) => window.__tb.walkTo(x, y, sit), [x, y, sit]);
/** A tile click routed through the click handler without pointer coordinates (decor placement needs a tile hit). */
const clickTileHit = (page, x, y) => page.evaluate(([x, y]) => window.__tb.clickHit({ kind: 'tile', tile: { x, y } }), [x, y]);

/**
 * Open an NPC's dialogue. One click opens one box (a learned idle line leads its first line); Phase 8a may open with an errand (Pode deixar! /
 * Agora não) or a hand-over (Trouxe … pra você!) in place of the usual box (`finalKey`, the `data-dialogue` of the box we want). `offer: 'accept'` takes the errand and returns
 * 'accepted'; `give: true` hands the item over and returns 'gave'; otherwise offers are declined ("Agora não" / "Só conversar") until the usual box
 * is open ('open').
 */
async function openNpc(page, npc, finalKey, { offer = 'decline', give = false } = {}) {
  await interact(page, { npc });
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
    const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
    if (key === finalKey) return 'open';
    if (key?.startsWith('offer-')) {
      if (offer === 'accept') {
        await page.click('#dialogue-box [data-chip="0"]');
        return 'accepted';
      }
      await page.click('#dialogue-box [data-chip="1"]');
    } else if (key?.startsWith('give-')) {
      if (give) {
        await page.click('#dialogue-box [data-chip="0"]');
        return 'gave';
      }
      await page.click('#dialogue-box [data-chip="1"]'); // Só conversar
    }
    await sleep(350);
  }
  throw new Error(`could not reach the ${finalKey} dialogue of ${npc}`);
}

async function waitIdleAt(page, x, y, label) {
  await waitFor(page, ([x, y]) => {
    const t = window.__tb.selfTile();
    return t && !t.moving && t.tile.x === x && t.tile.y === y;
  }, [x, y], 12_000, label ?? `avatar at ${x},${y}`);
}

const PASSWORD = 'pao-de-queijo-2026';
const RUN = Date.now().toString(36);
const emailFor = (name) => `${name.toLowerCase()}+${RUN}@exemplo.com`;
/** Solo builds need `?rolltest` for the Academia bout debug hints (the server build uses TB_TEST_ROLL=1). */
// SOLO: `?rolltest` for the Academia bout hints and `?tbclockmin=<n>` (the solo twin of TB_TEST_CLOCK_OFFSET_MIN) so the in-page world reads about 08:30 too
const START_URL = SOLO ? `${BASE}${BASE.includes('?') ? '&' : '?'}rolltest&tbclockmin=${offsetMinFor(DAY_MIN)}` : BASE;

/** Title screen → sign-in card (the intro's own skip keeps runs short). */
async function toSignInCard(page) {
  // One tap starts the intro (music + flock together), then the title beat can be skipped.
  await page.waitForSelector('#intro-enter', { timeout: 12_000 });
  await page.click('#intro-enter');
  // The beat also reveals the card on its own after 4.4s and hides Pular, so a slow second
  // window must not insist on clicking a button that has already gone.
  assert(!(await page.$('#birth-month')) && !(await page.$('#birth-year')), 'no birth-date step before play');
  try {
    await page.locator('#intro-skip').click({ timeout: 3_000 });
  } catch {
    // The beat already opened the sign-in card.
  }
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
}

/** Guest path (“Explorar como visitante”): shipped by the intro, so it must reach the world. */
async function enterAsGuest(page) {
  await toSignInCard(page);
  await page.click('#intro-guest');
}

/** Create account: email + password; 18+ is an optional tick on register only. */
async function signUp(page, name, tick18) {
  await toSignInCard(page);
  assert(!(await page.isVisible('#intro-18')), '18+ tick is not on the login form');
  await page.click('#intro-tab-register');
  assert(await page.isVisible('#intro-18'), '18+ tick is on the register form');
  await page.fill('#intro-email', emailFor(name));
  await page.fill('#intro-password', PASSWORD);
  if (tick18) await page.check('#intro-18');
  await page.click('#intro-submit');
}

async function signIn(page, name, password = PASSWORD) {
  await toSignInCard(page);
  if (await page.isVisible('#intro-18')) await page.click('#intro-tab-login');
  await page.fill('#intro-email', emailFor(name));
  await page.fill('#intro-password', password);
  await page.click('#intro-submit');
}

async function createAvatar(page, name, pronoun, { tick18 = false, guest = SOLO } = {}) {
  await page.goto(START_URL);
  if (guest) await enterAsGuest(page);
  else await signUp(page, name, tick18);
  await page.waitForSelector('#avatar-name', { timeout: 12_000 });
  assert(!(await page.$('#birth-month')), 'avatar creator has no birth-date step');
  await page.fill('#avatar-name', name);
  // A new account only names itself: the look is picked on the plane (a passenger) and changed later in Menu → Visual.
  const labels = await page.$$eval('.field > label', (els) => els.map((e) => (e.childNodes[0]?.textContent ?? '').trim()));
  for (const gone of ['Corpo', 'Rosto', 'Cabelo', 'Detalhe', 'Visual inicial', 'Tom de pele']) {
    assert(!labels.includes(gone), `the name card no longer asks for ${gone} (${labels.join(' | ')})`);
  }
  assert(!(await page.$('#avatar-preview')), 'no avatar preview before the flight');
  const label = { ele: 'ele (he)', ela: 'ela (she)', nome: 'só meu nome (name only)' }[pronoun];
  await page.click(`button:has-text("${label}")`);
  assert(!(await page.$('#confirm-18')), 'the avatar creator asks no age question');
  return async () => {
    await page.click('#enter-praca');
    await finishArrival(page);
    await sleep(400);
  };
}

async function main() {
  assert(CHROME, 'Chrome/Chromium not found — set CHROME_PATH');
  console.log(`\nTudo Bem e2e → ${BASE}`);
  if (!SOLO) await requirePinnedClock(BASE, { label: 'daytime, about 08:30' });
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

  // 0. The title screen comes first: no avatar creator, no world, no birth date
  await page.goto(START_URL);
  await page.waitForSelector('#intro-enter', { timeout: 12_000 });
  assert(!(await page.$('#avatar-name')) && !(await room(page)) && !(await page.$('#birth-month')), 'intro first: no DOB, no creator, no world');
  if (!SOLO) {
    // Multiplayer is account-only: no guest door on the sign-in card, and no game nouns (Fase 0, RV, kitnet) before the game.
    await toSignInCard(page);
    assert(!(await page.$('#intro-guest')), 'no guest CTA in multiplayer');
    const card = await page.textContent('.intro-panel');
    assert(!/Fase 0|kitnet|\bRV\b/.test(card ?? ''), 'the sign-in card names no game nouns');
    log('sign-in card: no guest CTA, no game nouns');
  }

  // 1. Account (email + password, optional 18+ tick) → avatar creation. Solo builds enter as guests.
  const enter = await createAvatar(page, 'Jonny', 'ele', { tick18: true });
  await sleep(300);
  await shot(page, '01_avatar_creator');
  await enter();
  await dwell(1500);
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 10_000, 'praça');
  await assertPageClock(page, { min: DAY_MIN - 20, max: 12 * 60, label: 'daytime, about 08:30' });
  if (!SOLO) {
    // The session cookie survives a reload: straight back into the Praça, same avatar.
    const before = (await profile(page)).id;
    await page.reload();
    await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 10_000, 'praça after reload');
    assert(!(await page.$('#intro-skip')), 'no title screen after reload');
    assert((await profile(page)).id === before, 'same avatar after reload');
    log('session persists across reload');
    await sleep(400);
  }
  const start = await profile(page);
  log('landed in', await room(page), 'coins', start.coins, 'plate', start.nameplate);
  const artGaps = await page.evaluate(() => window.__tb.artMissing);
  log('pixel art placeholders in the praça:', artGaps.length ? artGaps.join(', ') : 'none');
  assert(artGaps.length === 0, `every sprite of the praça comes from the manifest (missing: ${artGaps.join(', ')})`);
  assert(start.nameplate === 'verde', 'Verde nameplate');
  // Phase 8a: the old checklist is Júlia's welcome chain in the recado tracker (also on phones)
  assert(!(await page.$('#checklist')), 'the old checklist is gone');
  assert(((await page.textContent('#recado-tracker')) ?? '').includes('Bem-vindo à Vila Ipê'), 'the tracker shows the welcome chain');
  // skipping the flight keeps the random passenger the account was made with: a starter outfit
  assert(['camiseta', 'blusa'].includes(start.appearance.top) && ['calca', 'saia'].includes(start.appearance.bottom), 'a passenger look in a starter outfit');
  // Menu → Visual: the look editor (what the creator used to be) changes the look any time (the button joins the bar at the resident stage)
  await page.evaluate(() => document.getElementById('btn-look').click());
  await page.waitForSelector('.look-editor #avatar-preview', { timeout: 5_000 });
  const lookLabels = await page.$$eval('.look-editor .field > label', (els) => els.map((e) => (e.childNodes[0]?.textContent ?? '').trim()));
  assert(['Corpo', 'Rosto', 'Cabelo', 'Detalhe', 'Visual inicial', 'Tom de pele'].every((l) => lookLabels.includes(l)), `the look editor has body, face, hair, detail, skin and outfit (${lookLabels.join(' | ')})`);
  // Clothing is two whole starter outfits (tee + jeans, blouse + skirt), not separate blouse / bottom / shoe pickers.
  for (const gone of ['Blusa', 'Cor da blusa', 'Parte de baixo', 'Tênis']) assert(!lookLabels.includes(gone), `the look editor does not ask for ${gone}`);
  const outfits = await page.$$eval('.look-editor [data-outfit]', (els) => els.map((e) => e.getAttribute('data-outfit')));
  assert(outfits.includes('visual_inicial') && outfits.includes('visual_saia') && outfits.length === 2, `two starter outfits (${outfits.join(', ')})`);
  await page.click('.look-editor [data-outfit="visual_inicial"]');
  await page.click('.look-editor .cr-wide:has(label:has-text("Detalhe")) button:has-text("Nenhum")');
  await page.click('#look-save');
  await waitFor(page, () => window.__tb.game.profile.appearance.top === 'camiseta' && window.__tb.game.profile.appearance.bottom === 'calca' && window.__tb.game.profile.appearance.extra === 'nenhum', null, 5_000, 'the saved look');
  assert(!(await page.$('.look-editor')), 'the look editor closes on save');
  log('look editor: tee + jeans, no extra, saved');
  assert(/Música/.test((await page.textContent('#btn-music')) ?? ''), 'room music toggle on the praça bar');
  assert(/Voz/.test((await page.textContent('#btn-sound')) ?? ''), 'voice toggle on the praça bar');

  // 1b. Praça ambiance: Verde CPUs from the Curriculum allowlist, outside the 16-seat count
  if (AMBIANCE) {
    await waitFor(page, () => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 4, null, 8000, 'ambiance CPUs');
    const crowd = await cpus(page);
    assert(crowd.length >= 4 && crowd.length <= 8, `4–8 CPUs for one player on the big map (got ${crowd.length})`);
    assert(crowd.every((c) => c.nameplate === 'verde' && CPU_NAMES.includes(c.name) && !/\s/.test(c.name)), 'CPU plates: Verde, allowlisted first names only');
    const head = await page.textContent('.topbar .room small');
    // a newcomer's plate is the room's name and gloss: the head count waits for the resident stage (SIMPLIFICATION-REVIEW §3)
    assert(!/ aqui/.test(head), `no head count for a newcomer (${head})`);
    log('ambiance:', crowd.map((c) => c.name).join(', '), '·', head.trim());
  }

  // 1c. Daily kiosk: Missão do dia (Set A). A regular's loop (S3): for a newcomer the kiosk is scenery, no panel
  await interact(page, { prop: 'quiosque' });
  await sleep(1200);
  assert(!(await page.$('[data-modal="kiosk"]')), 'a newcomer gets no kiosk panel (SIMPLIFICATION-REVIEW B5)');
  assert(!(await page.isVisible('#mission-pill')), 'no Missão do dia pill before a mission is taken');
  // the rules are unchanged: take it over the socket so the steps below still tick, and the pill turns up once taken
  await page.evaluate(() => window.__tb.net.send({ t: 'mission', action: 'take' }));
  await waitFor(page, () => window.__tb.game.profile?.mission?.taken, null, 5000, 'mission taken');
  await page.waitForSelector('#mission-pill', { state: 'visible', timeout: 5000 });
  assert(((await page.textContent('#mission-pill')) ?? '').includes('Missão do dia'), 'the pill shows once a mission is taken');
  await shot(page, '01b_praca_kiosk');
  await page.keyboard.press('Escape');

  // 2. Walk, sit on a bench, wave, chat
  await clickTile(page, 14, 6);
  await waitIdleAt(page, 14, 6);
  await clickTile(page, 12, 6, 4); // banco_1 (Praça Central, by the kiosk): a real click on a bench
  // the welcome chain no longer has the hall-taught steps (done when the hall is): the avatar itself says it sat
  await waitFor(page, () => { const me = window.__tb.game.avatars.get(window.__tb.game.room.selfId); return !!(me?.pub.sitting || me?.sitOnArrive); }, null, 8000, 'sat on bench');
  // a newcomer's emotes wait behind the smiley next to the chat field, on desktop too
  if (!(await page.isVisible('[data-emote="oi"]'))) await page.click('#btn-emotes');
  await page.click('[data-emote="oi"]');
  await page.fill('#chat-input', 'Oi, tudo bem? Bom dia, pessoal!');
  await page.press('#chat-input', 'Enter');
  await waitFor(page, () => document.getElementById('chat-input')?.value === '', null, 5000, 'chat sent');
  // Alone with CPUs off there's nobody to greet yet, so Cumprimenta (and the mission) only complete with ambiance.
  if (AMBIANCE) await waitFor(page, () => window.__tb.game.profile?.mission?.steps.cumprimenta, null, 5000, 'mission: Cumprimenta');
  let pageB = null;
  let aId = null;
  if (!SOLO) {
    // Second player joins to chat + befriend
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    pageB = await ctxB.newPage();
    const enterB = await createAvatar(pageB, 'Bia', 'ela');
    await enterB();
    // Log out, fail once with a wrong password, then sign back in to the same avatar.
    const biaId = (await profile(pageB)).id;
    await pageB.click('#btn-menu'); // the gear menu holds Sair
    await pageB.click('#btn-logout');
    await signIn(pageB, 'Bia', 'senha-errada-123');
    await pageB.waitForSelector('.intro-feedback:has-text("E-mail ou senha incorretos")');
    if (SHOTS) await sleep(1200);
    await shot(pageB, '02a_login_error');
    await pageB.fill('#intro-password', PASSWORD);
    await pageB.click('#intro-submit');
    await waitFor(pageB, () => window.__tb.game.room?.room === 'praca', null, 10_000, 'Bia back in the praça');
    assert((await profile(pageB)).id === biaId, 'login returns the same avatar');
    log('logout → wrong password → login ok');
    await walkTo(pageB, 17, 19);
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
    // Amigos joins the bar at the resident stage; this newcomer opens the panel straight from its button
    await page.evaluate(() => document.getElementById('btn-friends').click());
    await page.waitForSelector('button:has-text("Aceitar")');
    await page.click('button:has-text("Aceitar")');
    await waitFor(page, (id) => window.__tb.game.profile.friends.includes(id), bId, 5000, 'friends');
    await page.keyboard.press('Escape');
    log('friends ok');
  }

  // 3. Walk off the north edge of the praça into the Rua dos Ipês and enter the Padaria through its door
  await goArea(page, 'rua');
  log('walked off the praça edge into the rua');
  await interact(page, { portal: 'praca_padaria' });
  await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 15_000, 'padaria');
  await sleep(700);
  await shot(page, '03_padaria');
  assert((await cpus(page)).length === 0, 'CPUs stay out of the Padaria');
  await dwell(1200);

  // 3b. Readable world: walk up to the padaria menu, the card opens (Ouvir and close) and the read counts its words as seen
  await interact(page, { hotspot: 'padaria_cardapio' });
  await page.waitForSelector('.hotspot-card', { timeout: 20_000 });
  assert(await page.$('.hotspot-card #hs-listen'), 'sign card has a listen button');
  assert(!(await page.$('.hotspot-card #hs-save')), 'sign card has no Guardar button: the Diário is the one word home');
  await waitFor(page, () => Object.keys(window.__tb.game.profile.caderno ?? {}).length >= 5, null, 5000, 'reading the menu marks its words as seen');
  await shot(page, '03b_hotspot_cardapio');
  // a programmatic interact does not take focus away from the chat field (a real click would); Escape is ignored inside inputs
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Escape');
  await page.click('#btn-caderno');
  // the Diário opens on its Início, with Início, the chapters that hold a word and Fotos (no Caderno tab). The book first swings its
  // cover open and the pages slap in (about 2s of animation).
  await waitFor(
    page,
    () => {
      const book = document.querySelector('[data-modal="caderno"] .panel.jb');
      return !!book && !book.getAnimations({ subtree: true }).some((a) => a.playState === 'running' && !a.effect?.target?.closest?.('.jb-spread'));
    },
    null,
    15_000,
    'the Diário cover is open',
  );
  const tabs = await page.$$eval('[data-modal="caderno"] [data-journal-tab]', (els) => els.map((e) => e.dataset.journalTab));
  assert(tabs[0] === 'inicio' && tabs.at(-1) === 'fotos' && !tabs.includes('caderno'), `the Diário tabs are Início, chapters, Fotos (${tabs.join(', ')})`);
  await shot(page, '03c_diario');
  await page.keyboard.press('Escape');

  // 4. The baker on duty: today's recado, then the counter (pay, carry it, it goes in the bag). Pedido rápido is gone.
  await waitFor(page, () => window.__tb.game.liveNpcs(performance.now()).some((n) => n.id === 'carlos' || n.id === 'graca'), null, 8000, 'the baker on duty is at the counter');
  const baker = await bakerNow(page);
  log('baker on duty:', baker.name, 'game time', await page.evaluate(() => window.__tb.clock.minutes()));
  // Phase 8a: the baker offers today's recado first. The server run takes it (TB_TEST_OFFER=carlos_cafe_pra_nanda: a café com leite for Nanda).
  // Solo and SKIP_RECADO decline, the way a player who is not on that errand would.
  const counterKey = `counter-${baker.id}`;
  const skipRecado = SOLO || process.env.SKIP_RECADO === '1';
  const offerState = await openNpc(page, baker.id, counterKey, { offer: skipRecado ? 'decline' : 'accept' });
  let recadoRun = false;
  if (offerState === 'accepted') {
    await waitFor(page, () => window.__tb.game.board?.active.length >= 1, null, 5000, 'the recado is active');
    const accepted = await page.evaluate(() => window.__tb.game.board?.active.map((a) => a.id) ?? []);
    recadoRun = baker.id === 'carlos' && accepted.includes('carlos_cafe_pra_nanda');
    log('recado accepted from', baker.name, JSON.stringify(accepted));
    await shot(page, '04a_recado_accepted');
    await openNpc(page, baker.id, counterKey);
  } else if (skipRecado) log('no recado taken (SOLO / SKIP_RECADO): the recado part is skipped');
  else throw new Error('The baker did not offer the recado. Start the server with TB_TEST_OFFER=carlos_cafe_pra_nanda (or set SKIP_RECADO=1 to skip the recado part).');
  const counter = page.locator(`#dialogue-box[data-dialogue="${counterKey}"]`);
  await counter.waitFor({ timeout: 8_000 });
  const counterName = ((await counter.locator('.npc-name').textContent()) ?? '').trim();
  assert(counterName === baker.name, `the counter is ${baker.name}'s (${counterName})`);
  assert(await counter.locator('.dbx-portrait').count(), 'the counter shows the baker portrait');
  const itemId = recadoRun ? 'cafe_com_leite' : 'cafe';
  const chip = recadoRun
    ? counter.locator('[data-chip]', { hasText: /café com leite/i })
    : counter.locator('[data-chip]', { hasText: /café/i }).filter({ hasNotText: /com leite/i });
  await shot(page, '04_padaria_counter');
  await chip.first().click();
  await waitFor(page, (id) => window.__tb.game.self?.pub.carry === id, itemId, 8000, `carrying the ${itemId}`);
  await waitFor(page, () => window.__tb.game.profile?.tutorial?.carlos && window.__tb.game.profile?.mission?.steps?.pede, null, 8000, 'padaria step and Pede');
  await dwell(800);
  await shot(page, '06_padaria_ordered');
  const afterScene = await profile(page);
  log('ordered', itemId, 'coins', start.coins, '→', afterScene.coins);
  assert(afterScene.tutorial.carlos, 'ordering at the counter completed the padaria step');
  assert(afterScene.mission?.steps.pede, 'ordering counts as Pede');
  if (recadoRun) assert((afterScene.bag?.cafe_com_leite ?? 0) >= 1, `the café com leite is in the bag (${JSON.stringify(afterScene.bag)})`);

  // 5. Correria no Balcão: one full shift through the real taps (a first shift: 2 waves, 9 customers) behind the padaria counter
  await startShiftFromPedido(page);
  assert(await page.isVisible('#cr-panel'), 'the counter strip is up');
  assert(!(await page.$('[data-modal="minigame"]')), 'no modal over the padaria');
  // Viewport checks used to run here, while the first customer was already losing patience and the counter camera
  // jumped under the phone strip. They run on the throwaway "Jogar de novo" shift below, after this one is served.
  let mgShot = false;
  const served = await playShift(page, {
    log,
    dwell,
    onCustomer: async (_c, i) => {
      if (i === 3 && !mgShot) {
        mgShot = true;
        await shot(page, '07_correria_tray');
      }
    },
  });
  await sleep(300);
  await shot(page, '08_correria_end');
  await dwell(2200);
  const afterMg = await profile(page);
  log('shift served', served, 'customers; payout →', afterMg.coins - afterScene.coins, 'RV');
  assert(served >= 7, `the bot served most of the 9 customers of a first shift (${served})`);
  assert(afterMg.coins - afterScene.coins >= 8, 'the shift pays RV');
  assert(afterMg.correria?.shifts === 1 && afterMg.correria.stars >= 1, `stars and the shift counter are on the profile (${JSON.stringify(afterMg.correria)})`);
  if (AMBIANCE) {
    assert(afterMg.mission?.rewarded && Object.values(afterMg.mission.steps).every(Boolean), 'daily mission complete (+25 RV)');
    log('mission complete: Cumprimenta ✓ Pede ✓ Monta ✓');
  } else assert(afterMg.mission?.steps.pede && afterMg.mission?.steps.monta, 'mission: Pede + Monta');
  assert(!(await page.isVisible('#cr-serve')), 'Fim do turno hides the counter strip');
  assert(/\+\d+ RV/.test((await page.textContent('#mg-end .big')) ?? ''), 'the end card headlines the RV');

  // 5a. Jogar de novo opens a fresh shift; closing it with nothing served leaves the counter and pays nothing.
  const coinsBeforeAgain = (await profile(page)).coins;
  await page.click('#mg-end button:has-text("Jogar de novo")');
  await waitFor(page, () => !!window.__tb.correria.feed.snap && window.__tb.correria.feed.snap.stats.served === 0, null, 8000, 'a fresh shift');
  await shot(page, '08a_correria_again');
  // Entregar has to stay on screen at phone size. This shift is closed with nothing served, so the resize does not eat the shift we just played.
  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await sleep(400);
    const m = await page.evaluate(() => {
      const el = document.querySelector('#cr-serve');
      const panel = document.querySelector('#cr-panel');
      if (!el || !panel) return null;
      const r = el.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      return { inView: r.width > 0 && r.height > 0 && r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1, share: pr.height / window.innerHeight };
    });
    assert(m?.inView, `Entregar stays tappable at ${size.width}×${size.height}`);
    if (size.width < 500) assert(m.share <= 0.35, `the counter strip stays under 35% of a phone (${(m.share * 100).toFixed(0)}%)`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // A new counter only has café and pão (the grill and pão na chapa open later on the ladder). Those two taps have to land on screen again.
  await waitFor(
    page,
    () => {
      const machine = document.querySelector('#cr-machine');
      const item = document.querySelector('#cr-item-pao');
      if (!machine || !item || machine.style.display === 'none' || item.style.display === 'none') return false;
      const mr = machine.getBoundingClientRect();
      const ir = item.getBoundingClientRect();
      return mr.width > 8 && ir.width > 8 && mr.bottom > 0 && mr.top < window.innerHeight && ir.bottom > 0 && ir.top < window.innerHeight;
    },
    null,
    5000,
    'counter taps laid out after the viewport restore',
  );
  for (let tap = 0; tap < 2; tap++) {
    const quit = await page.$('#cr-quit');
    if (!quit) break;
    await quit.click();
    await sleep(300);
    if (!(await page.$('#correria'))) break;
  }
  await waitFor(page, () => !document.querySelector('#correria'), null, 5000, 'the counter closes after ✕ with nothing served');
  const coinsAfterAgain = (await profile(page)).coins;
  assert(coinsAfterAgain === coinsBeforeAgain, `a fresh shift closed with nothing served pays 0 RV (${coinsBeforeAgain} → ${coinsAfterAgain})`);

  // 6. Back out of the door onto the rua, down the brick path to the praça, buy + equip a hat at Nanda's stall
  await interact(page, { portal: 'padaria_praca' });
  await waitFor(page, () => window.__tb.game.room?.room === 'rua', null, 15_000, 'back on the rua');
  await goArea(page, 'praca');
  log('walked off the rua edge into the praça');
  await sleep(500);
  if (AMBIANCE) {
    const crowd = await cpus(page);
    assert(crowd.length > 0, 'CPUs still in the praça');
    assert(crowd.every((c) => c.bubbles === 0), 'CPUs never chat');
    // a finished mission leaves the HUD (the kiosk panel is a regular's)
    assert(!(await page.isVisible('#mission-pill')), 'the Missão do dia pill leaves once the mission pays');
    log('mission paid: the pill is gone');
  }
  // 6a. Nanda greets in the dialogue box (and the server hears the talk). She keeps shop hours, so pin the clock to midday for this step.
  await page.evaluate(() => window.__tb.setClock({ time: '12:00' }));
  await waitFor(page, () => window.__tb.game.liveNpcs(performance.now()).some((n) => n.id === 'nanda'), null, 8000, 'Nanda is at her stall');
  if (recadoRun) {
    // the first scene above ordered a café com leite for the recado: it is in the bag, and Nanda takes it
    const bag = (await profile(page)).bag ?? {};
    assert(bag.cafe_com_leite >= 1, `the ordered café com leite is in the bag (${JSON.stringify(bag)})`);
    const before = await profile(page);
    const gave = await openNpc(page, 'nanda', 'talk-nanda', { give: true });
    assert(gave === 'gave', 'Nanda takes the café com leite (Trouxe … pra você!)');
    await page.waitForSelector('#recado-done', { timeout: 8000 });
    await shot(page, '08b2_recado_done');
    const after = await profile(page);
    const board = await page.evaluate(() => window.__tb.game.board);
    assert(board.done.includes('carlos_cafe_pra_nanda') && !board.active.length, 'the recado is done');
    assert(after.coins - before.coins >= 10, `recado RV reward (+${after.coins - before.coins})`);
    assert((after.bond.carlos ?? 0) - (before.bond?.carlos ?? 0) === 4, 'recado bond (+4) for Seu Carlos');
    assert((after.bag.cafe_com_leite ?? 0) === (before.bag.cafe_com_leite ?? 0) - 1, 'one coffee left the bag');
    log('recado complete: +' + (after.coins - before.coins) + ' RV, Seu Carlos bond', after.bond.carlos);
    await sleep(500);
  }
  log('opening Nanda talk'); await openNpc(page, 'nanda', 'talk-nanda'); log('Nanda talk open');
  // "Ver chapéus" waits for her last line: the greeting, "Agora não", then the goodbye with the button
  assert(!(await page.$('#btn-ver-chapeus')), 'Ver chapéus is not on the first line');
  await page.click('#dialogue-box [data-chip="0"]');
  await page.waitForFunction(() => document.querySelectorAll('#dialogue-box .dbx-chip').length === 2 && document.querySelector('#dialogue-box')?.textContent?.includes('Agora não'), null, { timeout: 5000 });
  await page.click('#dialogue-box [data-chip="1"]');
  await page.waitForSelector('#btn-ver-chapeus', { timeout: 5000 });
  assert(await page.$('#btn-ver-chapeus'), 'Nanda offers Ver chapéus on her last line');
  await waitFor(page, () => (window.__tb.game.profile.bond?.nanda ?? 0) >= 2, null, 5000, 'talk bond with Nanda');
  await shot(page, '08c_nanda_dialogue');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__tb.setClock({ time: null }));
  log('clock unpinned'); await interact(page, { prop: 'barraca' }); log('barraca clicked');
  await page.waitForSelector('[data-modal="hats"]', { timeout: 12_000 });
  await page.click('[data-hat="boina_vermelha"]');
  await page.click('[data-hat-action="boina_vermelha"]');
  await waitFor(page, () => window.__tb.game.profile.hat === 'boina_vermelha', null, 5000, 'hat equipped');
  await sleep(300);
  await shot(page, '09_hat_shop');
  await dwell(1800);
  await page.keyboard.press('Escape');
  // Adopt the parrot (optional cosmetic) and ask for a hint
  await interact(page, { prop: 'poleiro' });
  await page.waitForSelector('[data-modal="parrot-shop"]', { timeout: 12_000 });
  await page.click('[data-modal="parrot-shop"] [data-parrot="verde"] button.primary');
  await waitFor(page, () => window.__tb.game.profile.parrotOwned, null, 5000, 'parrot');
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.click('#btn-parrot');
  await page.waitForSelector('.parrot-whisper', { timeout: 5000 });
  await sleep(400);
  await shot(page, '10_praca_hat_parrot');
  await dwell(1500);

  // 6b. Academia do Bairro (its door is on the east half of the street, rua_leste) — enter + one full Treino no tatame match (TB_TEST_ROLL on the server)
  await goArea(page, 'rua_leste');
  await interact(page, { portal: 'praca_academia' });
  await waitFor(page, () => window.__tb.game.room?.room === 'academia', null, 15_000, 'academia');
  await waitFor(
    page,
    () => document.querySelector('.topbar .room')?.textContent?.includes('Academia do Bairro'),
    null,
    5000,
    'academia header name',
  );
  await sleep(500);
  await shot(page, '09b_academia');
  await interact(page, { prop: 'vestiario' });
  await page.waitForSelector('#dialogue-box[data-dialogue="gi-buy"]', { timeout: 8000 });
  await page.click('#dialogue-box [data-chip="0"]');
  await waitFor(page, () => window.__tb.game.profile.giOwned, null, 8000, 'gi purchased');
  // White's first stripe is 5 wins. Stay under that: one grip (collar), level 0, four partners still locked.
  // A stripe the account is sitting on without its move becomes a one-beat drill and the match never starts.
  await waitFor(
    page,
    () => {
      const b = window.__tb.game.profile.bjj;
      return !!b && b.belt === 'branca' && (b.wins ?? 0) < 5 && b.stripes === 0 && b.unlocked?.includes('collar_tie') && !b.pendingDrill;
    },
    null,
    8000,
    'white belt with the starter grip and no drill waiting',
  );
  await sleep(400);
  // the bout is in the world (no modal): the lobby, one full match played by tapping the commands on the pad, the end card
  const coins0 = (await profile(page)).coins;
  await openBout(page);
  assert((await page.$$('.bout-card-partner')).length === 5, 'the lobby lists five partners');
  assert((await page.$$('.bout-card-partner.locked')).length === 4, 'a new player has four partners still locked');
  assert(await page.evaluate(() => document.body.classList.contains('bout-on') && window.__tb.bout.feed.camera), 'the mat camera and the bout HUD are on');
  await sleep(900);
  await shot(page, '09b2_bout_lobby');
  await startBout(page);
  await waitBoutPhase(page, 'pick', 30_000);
  const stage = await page.evaluate(() => window.__tb.renderer.info()?.bout);
  assert(stage && stage.mode !== 'off', `the bout stage is on the mat (${JSON.stringify(stage)})`);
  assert(await page.evaluate(() => window.__tb.bout.feed.active), 'the bout feed is active');
  await shot(page, '09b3_bout_pick');
  // Tatame v3, staged (TATAME-V3 "Staging"): no meters row before the first stripe; the partner's telegraph is on the pick; at most four
  // cards and no percentages
  const staged = (await profile(page)).bjj?.wins ?? 0;
  const hud = await readBoutHud(page);
  assert(hud.meter === null, `no control meter before the first stripe (${JSON.stringify(hud)})`);
  assert((await page.$$('#bout-grips-you .grip-chip[data-grip]')).length === 0, 'no grip chips before the first stripe');
  assert(hud.plan && hud.plan.text.includes('Mateus'), `the partner telegraphs its next move (${JSON.stringify(hud.plan)})`);
  assert(hud.cards.length >= 1 && hud.cards.length <= 4, `one to four cards on the pick (${hud.cards.join(', ')})`);
  assert(!(await page.evaluate(() => /\d+\s*%/.test(document.querySelector('#bout')?.textContent ?? ''))), 'no percentages on the overlay');
  // one full match: the first card that scores, every command Bia calls tapped on the pad, every defense answered
  let sawChain = false;
  let sawDefend = false;
  const result = await playBout(page, {
    pick: 'bold',
    onBeat: async (b) => {
      if (b.phase === 'chain') sawChain = true;
      if (b.phase === 'defend') sawDefend = true;
    },
  });
  assert(['you', 'partner', 'draw'].includes(result.winner), `the match ended with a result (${result.winner} / ${result.reason})`);
  assert(result.moves >= 2, `at least two picks were played (${result.moves}, ${result.winner} by ${result.reason})`);
  assert(sawChain && result.taps >= 2, `commands were tapped on the pad (${result.taps} taps, defense beats: ${sawDefend})`);
  // the first wins have no defense pad: the partner's attacks are braced for you
  assert(staged >= 3 || !sawDefend, `no defense beat in the staged first wins (wins ${staged})`);
  assert(await page.$('#bout-perfect'), 'the end card counts the perfect commands');
  assert(await page.$('#bout-today .bt-chip'), 'the end card lists the words of the day');
  const score = await page.evaluate(() => ({ you: document.querySelector('.bout-side.you .pts')?.textContent, them: document.querySelector('.bout-side.partner .pts')?.textContent }));
  assert(score.you !== undefined && score.them !== undefined, 'the scoreboard shows the points for both');
  const art = await page.evaluate(() => window.__tb.artMissing.filter((k) => k.startsWith('bjj/') || k === 'props/placar'));
  assert(art.length === 0, `no bout art is missing (${art.join(', ')})`);
  await sleep(1500);
  await shot(page, '09c_bout_end');
  const prof = await profile(page);
  assert(prof.coins > coins0, `the match paid RV (${coins0} -> ${prof.coins})`);
  assert(result.winner !== 'you' || prof.bjj?.wins >= 1, 'a win is on the belt record');
  await page.click('#bout-leave');
  await waitFor(page, () => !document.body.classList.contains('bout-on') && !window.__tb.bout.feed.camera, null, 5000, 'the bout HUD steps aside');
  await interact(page, { portal: 'academia_praca' });
  await waitFor(page, () => window.__tb.game.room?.room === 'rua_leste', null, 15_000, 'back from academia');
  await goArea(page, 'rua'); // the kitnet door is on the west half
  log(`academia bout ok: ${result.winner} by ${result.reason}, ${result.moves} picks, ${result.taps} taps, ${result.perfect} perfect`);

  // 7. Kitnet: the first-visit gift (10 RV) buys the wooden chair, then place it (there is no free starter chair)
  await interact(page, { portal: 'praca_kitnet' });
  await waitFor(page, () => window.__tb.game.room?.room === 'kitnet', null, 15_000, 'kitnet');
  await sleep(500);
  // a first visit: the Decorar guide comes up and pulses the control it wants next (force: the bounce never reads as "stable")
  assert(await page.evaluate(() => window.__tb.kitnetGuide().running), 'the Decorar guide greets a first kitnet visit');
  await page.click('#btn-decor', { force: true });
  await page.click('#tab-loja', { force: true });
  await page.click('[data-buy-furniture="cadeira_madeira"]', { force: true });
  await waitFor(page, () => (window.__tb.game.profile?.furniture.cadeira_madeira ?? 0) >= 1, null, 5000, 'chair bought');
  await page.click('#tab-meus', { force: true });
  await page.click('[data-furniture="cadeira_madeira"]', { force: true });
  await clickTileHit(page, 3, 4);
  await waitFor(page, () => window.__tb.game.furniture.length === 1, null, 5000, 'chair placed');
  // Buy + place a plant too
  await page.click('#tab-loja', { force: true });
  await page.click('[data-buy-furniture="planta"]', { force: true });
  await sleep(300);
  await page.click('button:has-text("Meus móveis")', { force: true });
  await page.click('[data-furniture="planta"]', { force: true });
  await clickTileHit(page, 5, 4);
  await waitFor(page, () => window.__tb.game.furniture.length === 2, null, 5000, 'plant placed');
  await page.click('#decor-exit');
  await sleep(400);
  await walkTo(page, 3, 4, true);
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

  if (!SOLO) {
    // Refresh keeps the session, the avatar, its RV, hat and kitnet.
    const before = await profile(page);
    // A long session reboots Phaser (and the kitnet) more slowly than the reload at the start of the run.
    // One attempt can miss the welcome entirely; load again before giving up.
    let back = false;
    for (let attempt = 0; attempt < 2 && !back; attempt++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      back = await page
        .waitForFunction(() => !!window.__tb?.game?.room, null, { timeout: attempt === 0 ? 25_000 : 30_000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!back) {
      const diag = await page
        .evaluate(() => ({
          intro: !!document.querySelector('#intro-enter, #intro-skip'),
          tb: !!window.__tb,
          room: window.__tb?.game?.room?.room ?? null,
          text: (document.body?.innerText ?? '').slice(0, 180),
        }))
        .catch((e) => String(e));
      throw new Error(`timeout waiting for back in the world after reload (${JSON.stringify(diag)})`);
    }
    assert(!(await page.$('#intro-skip')), 'still signed in after reload (no title screen)');
    const after = await profile(page);
    assert(after.id === before.id && after.coins === before.coins && after.hat === before.hat, `avatar + RV survive reload (${before.coins} → ${after.coins} RV)`);
    assert(after.apartment.length === before.apartment.length, 'kitnet furniture survives reload');
    log('reload keeps auth, avatar and', after.coins, 'RV');

  }

  const final = await profile(page);
  // Júlia's welcome chain (TUTORIAL_STEPS): the padaria, a hat, a chair
  const missing = ['carlos', 'chapeu', 'cadeira'].filter((k) => !final.tutorial[k]);
  log('final coins', final.coins, 'hat', final.hat, 'missing steps', missing.length ? missing : 'none', 'bonus', final.tutorialRewarded);
  assert(!missing.length && final.tutorialRewarded, 'all first steps done + bonus');
  assert(!errors.length, `no page errors: ${errors.join(' | ')}`);

  const video = VIDEO ? await page.video()?.path() : null;
  await ctxA.close();
  await browser.close();
  if (video) log('video', video);
  console.log('\n  ✓ Phase 0 play path passed\n');
}

main().catch((e) => {
  fs.writeSync(2, `\n  ✗ e2e failed: ${e.message}\n\n`);
  process.exit(1);
});
