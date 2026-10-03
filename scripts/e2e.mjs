#!/usr/bin/env node
/**
 * End-to-end smoke test of the Phase 0 play path in a real browser.
 *
 *   pnpm build && pnpm start            # in one terminal
 *   pnpm e2e                            # in another (BASE_URL / CHROME_PATH / SHOTS_DIR optional)
 *
 * Plays: age gate → avatar → Praça (ambiance CPUs, daily kiosk, walk, sit, wave, chat) → Padaria →
 * Seu Carlos (AI Conversa on click, then Pedido rápido chips) → Correria no Balcão (the shelf taps
 * fill the tray from each order) → hat shop → Kitnet chair, plus a second player for chat gloss + friend
 * request. Expects LIVEOPS_CPU_AMBIANCE on (the default); set CPU_AMBIANCE=off when the server
 * runs with it off.
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
import { openBout, playBout, startBout, waitBoutPhase } from './lib/bout-play.mjs';

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

async function clickTile(page, x, y, lift = 0) {
  const p = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);
  const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
  await page.mouse.click(p.px, p.py - lift * scale);
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
 * Open an NPC's dialogue. Since Phase 8a an NPC may start with an offer (Pode deixar! / Agora não) or a hand-over (Entregar …) before the usual box
 * (`finalKey`, the `data-dialogue` of the box we want). `offer: 'accept'` takes the errand and returns 'accepted'; `give: true` hands the item over and
 * returns 'gave'; otherwise offers are declined ("Agora não" / "Só conversar") until the usual box is open ('open').
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
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
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
  const labels = await page.$$eval('.field > label', (els) => els.map((e) => (e.childNodes[0]?.textContent ?? '').trim()));
  assert(labels.includes('Visual inicial'), `visual inicial preset (${labels.join(' | ')})`);
  assert(labels.includes('Corpo') && labels.includes('Rosto') && labels.includes('Cabelo'), `body, face and hair stay (${labels.join(' | ')})`);
  for (const gone of ['Detalhe', 'Blusa', 'Cor da blusa', 'Parte de baixo', 'Tênis']) {
    assert(!labels.includes(gone), `create no longer asks for ${gone}`);
  }
  assert((await page.$$('[data-outfit]')).length === 1 && (await page.$('[data-outfit="visual_inicial"]')), 'one Visual inicial clothing preset');
  const label = { ele: 'ele (he)', ela: 'ela (she)', nome: 'só meu nome (name only)' }[pronoun];
  await page.click(`button:has-text("${label}")`);
  assert(!(await page.$('#confirm-18')), 'the avatar creator asks no age question');
  return async () => {
    await page.click('#enter-praca');
    await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 10_000, 'praça');
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
    // Multiplayer is account-only: the guest CTA steers to Criar conta instead of entering the world.
    await toSignInCard(page);
    await page.click('#intro-guest');
    await page.waitForSelector('.intro-feedback:has-text("crie sua conta")', { timeout: 5000 });
    await sleep(600);
    assert(!(await page.$('#avatar-name')) && !(await room(page)), 'guest does not enter multiplayer');
    assert(await page.isVisible('#intro-18'), 'guest CTA switches to Criar conta');
    log('guest CTA → Criar conta (no multiplayer without an account)');
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
  assert(start.appearance.top === 'camiseta' && start.appearance.bottom === 'calca' && start.appearance.shoes === 0, 'starter outfit is tee + jeans');
  assert(start.appearance.extra === 'nenhum', 'create does not pick glasses/beard/earrings');
  assert(/Música/.test((await page.textContent('#btn-music')) ?? ''), 'room music toggle on the praça bar');
  assert(/Voz/.test((await page.textContent('#btn-sound')) ?? ''), 'voice toggle on the praça bar');

  // 1b. Praça ambiance: Verde CPUs from the Curriculum allowlist, outside the 16-seat count
  if (AMBIANCE) {
    await waitFor(page, () => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 4, null, 8000, 'ambiance CPUs');
    const crowd = await cpus(page);
    assert(crowd.length >= 4 && crowd.length <= 8, `4–8 CPUs for one player on the big map (got ${crowd.length})`);
    assert(crowd.every((c) => c.nameplate === 'verde' && CPU_NAMES.includes(c.name) && !/\s/.test(c.name)), 'CPU plates: Verde, allowlisted first names only');
    const head = await page.textContent('.topbar .room small');
    assert(/ 1\/16 aqui/.test(head), `head-count ignores CPUs (${head})`);
    log('ambiance:', crowd.map((c) => c.name).join(', '), '·', head.trim());
  }

  // 1c. Daily kiosk: Missão do dia (Set A)
  await interact(page, { prop: 'quiosque' });
  await page.waitForSelector('[data-modal="kiosk"] #mission-take', { timeout: 12_000 });
  const steps = await page.$$eval('[data-mission-step]', (els) => els.map((e) => e.textContent));
  assert(steps[0].startsWith('Cumprimenta') && steps[1].startsWith('Pede') && steps[2].startsWith('Monta'), `kiosk steps Cumprimenta / Pede / Monta (${steps})`);
  // Curriculum-locked kiosk copy
  assert((await page.textContent('[data-modal="kiosk"] h2')) === 'Missão do dia', 'kiosk header: Missão do dia');
  assert((await page.textContent('[data-modal="kiosk"] .rv-badge')).trim() === '+25 RV', 'kiosk +25 RV badge');
  assert((await page.textContent('#mission-take .pt')) === 'Pegar missão', 'kiosk CTA: Pegar missão');
  assert((await page.getAttribute('[data-modal="kiosk"] .mission-row', 'aria-label')) === 'Cumprimenta · Pede · Monta', 'kiosk steps row: Cumprimenta · Pede · Monta');
  await page.click('#mission-take');
  await waitFor(page, () => window.__tb.game.profile?.mission?.taken, null, 5000, 'mission taken');
  await shot(page, '01b_praca_kiosk');
  await page.keyboard.press('Escape');

  // 2. Walk, sit on a bench, wave, chat
  await clickTile(page, 14, 6);
  await waitIdleAt(page, 14, 6);
  await clickTile(page, 12, 6, 4); // banco_1 (Praça Central, by the kiosk): a real click on a bench
  await waitFor(page, () => window.__tb.game.profile?.tutorial.sentar, null, 8000, 'sat on bench');
  await page.click('[data-emote="oi"]');
  await page.fill('#chat-input', 'Oi, tudo bem? Bom dia, pessoal!');
  await page.press('#chat-input', 'Enter');
  await waitFor(page, () => window.__tb.game.profile?.tutorial.conversar, null, 5000, 'chat step');
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
    await page.click('#btn-friends');
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

  // 3b. Readable world: walk up to the padaria menu, the card opens and the read counts its words as seen; the Caderno lists them
  await interact(page, { hotspot: 'padaria_cardapio' });
  await page.waitForSelector('.hotspot-card', { timeout: 20_000 });
  assert(await page.$('.hotspot-card #hs-listen'), 'sign card has a listen button');
  assert(await page.$('.hotspot-card #hs-save'), 'sign card has Guardar no caderno');
  await waitFor(page, () => Object.keys(window.__tb.game.profile.caderno ?? {}).length >= 5, null, 5000, 'reading the menu marks its words as seen');
  await shot(page, '03b_hotspot_cardapio');
  // a programmatic interact does not take focus away from the chat field (a real click would); Escape is ignored inside inputs
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Escape');
  await page.click('#btn-caderno');
  await page.waitForSelector('[data-modal="caderno"] [data-card="lex.padaria.coxinha"]', { timeout: 5000 });
  assert(!(await page.textContent('[data-modal="caderno"] [data-card="lex.padaria.coxinha"] .cad-pt')).includes('???'), 'Caderno shows a word the sign taught');
  await shot(page, '03c_caderno');
  await page.keyboard.press('Escape');

  // 4. Clicking Carlos opens AI Conversa. Pedido rápido (footer) is the chip breakfast.
  await waitFor(page, () => window.__tb.game.liveNpcs(performance.now()).some((n) => n.id === 'carlos' || n.id === 'graca'), null, 8000, 'the baker on duty is at the counter');
  const baker = await bakerNow(page);
  log('baker on duty:', baker.name, 'game time', await page.evaluate(() => window.__tb.clock.minutes()));
  // Phase 8a: the baker offers today's recado first; take it (TB_TEST_OFFER=carlos_cafe_pra_nanda pins it: order a café com leite, hand it to Nanda)
  const offerState = await openNpc(page, baker.id, 'conversa', { offer: 'accept' });
  const recadoRun = offerState === 'accepted' && baker.id === 'carlos';
  if (offerState === 'accepted') {
    const accepted = await page.evaluate(() => window.__tb.game.board?.active.map((a) => a.id) ?? []);
    await waitFor(page, () => window.__tb.game.board?.active.length >= 1, null, 5000, 'the recado is active');
    log('recado accepted from', baker.name, JSON.stringify(accepted));
    await shot(page, '04a_recado_accepted');
    await openNpc(page, baker.id, 'conversa');
  } else if (SOLO || process.env.SKIP_RECADO === '1') log('no recado offered by the baker (SOLO / SKIP_RECADO): the recado part is skipped');
  else throw new Error('The baker did not offer the recado. Start the server with TB_TEST_OFFER=carlos_cafe_pra_nanda (or set SKIP_RECADO=1 to skip the recado part).');
  const conversaName = ((await page.textContent('#dialogue-box[data-dialogue="conversa"] .npc-name')) ?? '').trim();
  assert(conversaName === baker.name, `Conversa is ${baker.name} at the mesa (${conversaName})`);
  assert(await page.$('#dialogue-box[data-dialogue="conversa"] .dbx-portrait'), 'Conversa portrait (café mesa)');
  assert(await page.$('#dialogue-box[data-dialogue="conversa"] [data-chip="0"]'), 'Conversa opens with a reply chip');
  await page.waitForSelector('[data-action="pedido-rapido"]', { state: 'visible', timeout: 5_000 });
  await shot(page, '04_carlos_conversa');
  await page.click('[data-action="pedido-rapido"]');
  await page.waitForSelector('#dialogue-box[data-dialogue="pedido"]', { timeout: 12_000 });
  assert(!(await page.$('#dialogue-box[data-dialogue="conversa"]')), 'Pedido rápido closes Conversa');
  assert(await page.$('#dialogue-box[data-dialogue="pedido"] #pedido-ticket'), 'Pedido rápido has ticket visual');
  assert(await page.$('#dialogue-box[data-dialogue="pedido"] .speak-btn'), 'Pedido rápido has speak button on Carlos line');
  await sleep(300);
  await shot(page, '04_carlos_scene_start');
  // First reply is typed (accept-list scoring), the rest are chips.
  const picks = ['Bom dia, Seu Carlos!', 1, 0, 0, 1];
  for (let i = 0; i < picks.length; i++) {
    const before = await page.textContent('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt');
    await dwell(1600);
    if (typeof picks[i] === 'string') {
      await page.fill('#pedido-input', picks[i]);
      await page.press('#pedido-input', 'Enter');
    } else await page.click(`#dialogue-box[data-dialogue="pedido"] [data-chip="${picks[i]}"]`);
    await waitFor(page, (b) => document.querySelector('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt')?.textContent !== b, before, 5000, 'next Carlos line');
    if (i === 2) {
      // Verify ticket items are filling in
      const filledItems = await page.$$eval('.ticket-item.filled', els => els.length);
      assert(filledItems >= 1, `ticket items filling in (${filledItems} filled)`);
      await shot(page, '05_carlos_scene_mid');
    }
  }
  await page.waitForSelector('#btn-pedido-play-mg');
  // Verify payout is shown
  const payoutEl = await page.$('.pedido-payout');
  assert(payoutEl, 'scene end shows RV payout');
  await shot(page, '06_carlos_scene_end');
  await dwell(2200);
  const afterScene = await profile(page);
  log('scene payout →', afterScene.coins - start.coins, 'RV');
  assert(afterScene.tutorial.carlos, 'carlos step');

  // 5. Correria no Balcão: one full shift through the real taps (3 waves, 15 customers) behind the padaria counter
  await startShiftFromPedido(page);
  assert(await page.isVisible('#cr-panel'), 'the counter strip is up');
  assert(!(await page.$('[data-modal="minigame"]')), 'no modal over the padaria');
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
  // The phone check above moves the counter camera while the first customer is already waiting. Let the shelf taps
  // land back on the desktop layout before the shift, so a grill spot is not left under the strip.
  await waitFor(
    page,
    () => {
      const g = document.querySelector('#cr-grill-0');
      const item = document.querySelector('#cr-item-pao_na_chapa');
      if (!g || !item) return false;
      const gr = g.getBoundingClientRect();
      const ir = item.getBoundingClientRect();
      return gr.width > 8 && ir.width > 8 && gr.bottom > 0 && gr.top < window.innerHeight;
    },
    null,
    5000,
    'counter taps laid out after the viewport restore',
  );
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
  assert(served >= 10, `the bot served most of the 15 customers (${served})`);
  assert(afterMg.coins - afterScene.coins >= 8, 'the shift pays RV');
  assert(afterMg.correria?.shifts === 1 && afterMg.correria.stars >= 1, `stars and the shift counter are on the profile (${JSON.stringify(afterMg.correria)})`);
  if (AMBIANCE) {
    assert(afterMg.mission?.rewarded && Object.values(afterMg.mission.steps).every(Boolean), 'daily mission complete (+25 RV)');
    log('mission complete: Cumprimenta ✓ Pede ✓ Monta ✓');
  } else assert(afterMg.mission?.steps.pede && afterMg.mission?.steps.monta, 'mission: Pede + Monta');
  assert(!(await page.isVisible('#cr-serve')), 'Fim do turno hides the counter strip');
  assert(/\+\d+ RV/.test((await page.textContent('#mg-end .big')) ?? ''), 'the end card headlines the RV');

  // 5a. Jogar de novo opens a fresh shift; closing it with nothing served leaves the counter at once.
  await page.click('#mg-end button:has-text("Jogar de novo")');
  await waitFor(page, () => !!window.__tb.correria.feed.snap && window.__tb.correria.feed.snap.stats.served === 0, null, 8000, 'a fresh shift');
  await shot(page, '08a_correria_again');
  await page.click('#cr-quit');
  await waitFor(page, () => !document.querySelector('#correria'), null, 5000, 'the counter closes after ✕ with nothing served');

  // 5b. Test daily RV gate: second Pedido rápido same day → 0 RV, "já pediu hoje" message
  const coinsBeforeSecond = (await profile(page)).coins;
  await openNpc(page, baker.id, 'conversa');
  await page.click('[data-action="pedido-rapido"]');
  await page.waitForSelector('#dialogue-box[data-dialogue="pedido"]', { timeout: 12_000 });
  // Quick path through Pedido rápido again
  const picks2 = [0, 0, 0, 0, 0];
  for (let i = 0; i < picks2.length; i++) {
    const before2 = await page.textContent('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt');
    await page.click(`#dialogue-box[data-dialogue="pedido"] [data-chip="${picks2[i]}"]`);
    await waitFor(page, (b) => document.querySelector('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt')?.textContent !== b, before2, 5000, 'next Carlos line (2nd)');
  }
  await page.waitForSelector('#btn-pedido-play-mg');
  // Should show daily blocked message instead of payout
  const dailyBlocked = await page.$('.daily-blocked');
  const payoutEl2 = await page.$('.pedido-payout');
  assert(dailyBlocked || !payoutEl2, 'second Pedido same day: daily blocked or no payout');
  await shot(page, '05c_daily_rv_gate');
  const coinsAfterSecond = (await profile(page)).coins;
  assert(coinsAfterSecond === coinsBeforeSecond, `second Pedido same day: 0 RV (before ${coinsBeforeSecond}, after ${coinsAfterSecond})`);
  log('daily RV gate ok: second Pedido same day → 0 RV');
  await page.keyboard.press('Escape');

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
    // Kiosk now shows the completion state
    await interact(page, { prop: 'quiosque' });
    await page.waitForSelector('[data-modal="kiosk"] #mission-done', { timeout: 12_000 });
    const done = await page.textContent('#mission-done .big');
    assert(done === 'Missão completa! +25 RV', `kiosk complete copy (${done})`);
    await shot(page, '08b_kiosk_complete');
    await page.keyboard.press('Escape');
    log('kiosk shows “Missão completa! +25 RV”');
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
    assert(gave === 'gave', 'Nanda offers Entregar café com leite');
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
  assert(await page.$('#btn-ver-chapeus'), 'Nanda offers Ver chapéus');
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

  // 6b. Academia do Bairro (its door is on the rua) — enter + one full Treino no tatame match (TB_TEST_ROLL on the server)
  await goArea(page, 'rua');
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
  await sleep(400);
  // the bout is in the world (no modal): the lobby, one full match played from the CI hints (TB_TEST_ROLL=1 / ?rolltest), the end card
  const coins0 = (await profile(page)).coins;
  await openBout(page);
  assert((await page.$$('.bout-card-partner')).length === 5, 'the lobby lists five partners');
  assert((await page.$$('.bout-card-partner.locked')).length === 4, 'a new player has four partners still locked');
  assert(await page.evaluate(() => document.body.classList.contains('bout-on') && window.__tb.bout.feed.camera), 'the mat camera and the bout HUD are on');
  await sleep(900);
  await shot(page, '09b2_bout_lobby');
  await startBout(page);
  await waitBoutPhase(page, 'intent', 30_000);
  const stage = await page.evaluate(() => window.__tb.renderer.info()?.bout);
  assert(stage && stage.mode !== 'off', `the bout stage is on the mat (${JSON.stringify(stage)})`);
  assert(await page.evaluate(() => window.__tb.bout.feed.active), 'the bout feed is active');
  await shot(page, '09b3_bout_intent');
  const result = await playBout(page, {
    pick: 'bold',
    onPhase: async (phase) => {
      if (phase === 'resolve') await sleep(200);
    },
  });
  assert(['you', 'partner', 'draw'].includes(result.winner), `the match ended with a result (${result.winner} / ${result.reason})`);
  assert(result.moves >= 2, 'at least two grip beats were played');
  const score = await page.evaluate(() => ({ you: document.querySelector('.bout-side.you .pts')?.textContent, them: document.querySelector('.bout-side.partner .pts')?.textContent }));
  assert(score.you !== undefined && score.them !== undefined, 'the scoreboard shows passos for both');
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
  await waitFor(page, () => window.__tb.game.room?.room === 'rua', null, 15_000, 'back from academia');
  log(`academia bout ok: ${result.winner} by ${result.reason}, ${result.moves} beats`);

  // 7. Kitnet: place the free chair
  await interact(page, { portal: 'praca_kitnet' });
  await waitFor(page, () => window.__tb.game.room?.room === 'kitnet', null, 15_000, 'kitnet');
  await sleep(500);
  await page.click('#btn-decor');
  await page.click('[data-furniture="cadeira_madeira"]');
  await clickTileHit(page, 3, 4);
  await waitFor(page, () => window.__tb.game.furniture.length === 1, null, 5000, 'chair placed');
  // Buy + place a plant too
  await page.click('#tab-loja');
  await page.click('[data-buy-furniture="planta"]');
  await sleep(300);
  await page.click('button:has-text("Meus móveis")');
  await page.click('[data-furniture="planta"]');
  await clickTileHit(page, 5, 4);
  await waitFor(page, () => window.__tb.game.furniture.length === 2, null, 5000, 'plant placed');
  await page.click('#decor-panel button.ghost');
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
    await page.reload();
    // A long session reboots Phaser (and the kitnet) more slowly than the reload at the start of the run.
    await waitFor(page, () => !!window.__tb.game.room, null, 25_000, 'back in the world after reload');
    assert(!(await page.$('#intro-skip')), 'still signed in after reload (no title screen)');
    const after = await profile(page);
    assert(after.id === before.id && after.coins === before.coins && after.hat === before.hat, `avatar + RV survive reload (${before.coins} → ${after.coins} RV)`);
    assert(after.apartment.length === before.apartment.length, 'kitnet furniture survives reload');
    log('reload keeps auth, avatar and', after.coins, 'RV');

  }

  const final = await profile(page);
  const missing = Object.entries(final.tutorial).filter(([, v]) => !v).map(([k]) => k);
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
