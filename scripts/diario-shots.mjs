#!/usr/bin/env node
/**
 * Screenshots of the Diário as a sticker album (solo build), and checks that it works: the new-word count on the Diário button, the Início,
 * a chapter (a page turn caught mid-flight, the stickers, a source filter, the search), a word's card (opened out of its sticker, Escape
 * closes the card before the book), Fotos, the phone layout and reduced motion. The diary is filled from the page (a spread of
 * words over every place, Escola boxes, two Feira medals and a few photos) so every state is on screen.
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 / &
 *   SHOTS_DIR=docs/lifesim/shots/diario-album node scripts/diario-shots.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS_DIR ?? 'docs/lifesim/shots/diario-album';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });
const WORDS = JSON.parse(fs.readFileSync('content/curriculum/phase0/diary-words.json', 'utf8')).words.map((w) => w.id);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function newPlayer(viewport) {
  const page = await (await browser.newContext({ viewport, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.click('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-guest', { timeout: 12_000 });
  await page.fill('#avatar-name', 'Lia', { timeout: 15_000 });
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(800);
  await page.evaluate(() => document.getElementById('aero-next-ok')?.click());
  return page;
}

/** A diary of about a third of the catalog over every place, with Escola boxes, medals and photos; the last 12 words are new. */
async function fill(page) {
  await page.evaluate((all) => {
    const tb = window.__tb;
    const p = tb.game.profile;
    const diary = all.filter((_, i) => i % 3 === 0 || i < 25);
    localStorage.setItem(`tb_diario_visto:${p.id}`, String(diary.length - 12));
    p.diary = diary;
    const now = Date.now();
    const words = {};
    diary.forEach((id, i) => {
      const b = [0, 1, 2, 3, 4, 5, 5, 5, 3, 2][i % 10];
      if (b) words[id] = { b, due: now + (i % 4 ? 1e8 : -1), last: now, n: b * 2, miss: 0 };
    });
    p.escola = { ...(p.escola ?? {}), words, xp: 420, lessons: 14, perfect: 3, goal: 10, dayXp: 4, streak: 6, best: 9, freezes: 1, tier: 'azul', lastDay: new Date().toISOString().slice(0, 10) };
    p.feiraMedals = [
      { day: '2026-10-01', game: 'tapioca', medal: 'gold', score: 9 },
      { day: '2026-10-03', game: 'pastel', medal: 'silver', score: 7 },
    ];
    // photos are crops of the world canvas (the camera's own source)
    const src = document.getElementById('world');
    const crop = (x, y) => {
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = 160;
      c.getContext('2d').drawImage(src, x, y, 480, 320, 0, 0, 240, 160);
      return c.toDataURL('image/jpeg', 0.7);
    };
    const shotOf = ['seed.praca.fonte', 'diary.praca.banco', 'diary.praca.papagaio', null, 'diary.chegada.mala'];
    tb.game.photos = shotOf.map((wordId, i) => ({ id: `p${i}`, at: now - i * 3600e3, image: crop(160 + i * 90, 100 + i * 40), ...(wordId ? { wordId } : {}) }));
    tb.game.emit('profile');
  }, WORDS);
  await sleep(300);
}

/** Click, then hold every animation of the book `ms` in (a page turn or a card caught mid-flight). */
async function clickFrozen(page, sel, ms) {
  await page.evaluate(
    ([sel, ms]) => {
      document.querySelector(sel).click();
      for (const a of document.getAnimations()) {
        if (!a.effect?.target?.closest?.('.jb-spread, .jb-detail-host')) continue;
        const end = a.effect.getComputedTiming().endTime ?? 0;
        a.pause();
        a.currentTime = Math.max(0, Math.min(ms, end - 1));
      }
    },
    [sel, ms],
  );
}

const shot = (page) => async (name) => {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log('shot', name);
};

try {
  // ---------------------------------------------------------------- desktop
  const page = await newPlayer({ width: 1280, height: 800 });
  const s = shot(page);
  await fill(page);
  assert((await page.textContent('#btn-caderno .jb-badge')) === '12', 'the Diário button counts the 12 new words');
  await page.click('#btn-caderno');
  await sleep(450);
  await s('01-cover-opening');
  await sleep(1700);
  await s('02-inicio');
  assert((await page.$$('.jb-shelf .jb-stk.fresh')).length === 10, 'the Início shelves the newest 10 of the new stickers');
  assert(!(await page.$('#btn-caderno .jb-badge')), 'opening the Diário clears the count');
  await clickFrozen(page, '[data-journal-tab="praca"]', 330);
  await s('03-page-turn');
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await sleep(1400);
  await s('04-chapter-praca');
  const praca = await page.evaluate(() => ({ slots: document.querySelectorAll('.jb-grid .jb-stk').length, gaps: document.querySelectorAll('.jb-grid .jb-stk.gap').length }));
  assert(praca.gaps > 0 && praca.gaps <= 6, `the Praça shows its stickers and only the next empty slots (${praca.slots} slots, ${praca.gaps} empty)`);
  assert(!(await page.$('[data-journal-tab="caderno"]')), 'the Diário has no Caderno tab');
  // a source filter, and the search
  await page.click('[data-jb-source="conversation"]');
  await sleep(500);
  assert(await page.$$eval('.jb-grid .jb-stk', (els) => els.every((e) => e.classList.contains('src-conversation'))), 'the Conversa filter keeps talk words only');
  await page.click('[data-jb-source="conversation"]');
  await page.fill('.jb-searchbar .jb-search', 'BANCO');
  await sleep(500);
  assert((await page.$$eval('.jb-grid .jb-stk', (els) => els.map((e) => e.dataset.word))).includes('diary.praca.banco'), 'the chapter search finds banco, case aside');
  await page.fill('.jb-searchbar .jb-search', '');
  await sleep(300);
  // a word's card out of its sticker
  await page.click('[data-journal-tab="padaria"]');
  await sleep(1300);
  await page.click('.jb-grid [data-word="diary.padaria.cafezinho"]');
  await sleep(900);
  await s('05-card-conversation');
  assert((await page.textContent('.jb-card .jbc-context mark'))?.toLowerCase() === 'cafezinho', 'the card marks the word in the line it was heard in');
  await page.keyboard.press('Escape');
  await sleep(350);
  assert(!(await page.$('.jb-detail')) && (await page.$('[data-modal="caderno"]')), 'Escape closes the card, not the book');
  await page.click('.jb-grid .jb-stk.gap');
  await sleep(800);
  await s('06-card-missing');
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.click('[data-journal-tab="praca"]');
  await sleep(1300);
  await clickFrozen(page, '.jb-grid [data-word="diary.praca.papagaio"]', 220);
  await s('07-card-opening');
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await sleep(500);
  await s('08-card-photo');
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.click('[data-journal-tab="fotos"]');
  await sleep(1500);
  await s('09-fotos');
  await page.click('[data-journal-tab="inicio"]');
  await sleep(1300);
  await page.fill('#jb-search-all', 'ca');
  await sleep(700);
  await s('11-search');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await sleep(300);
  assert(!(await page.$('[data-modal="caderno"]')), 'Escape on an empty search closes the book');

  // ---------------------------------------------------------------- phone
  const phone = await newPlayer({ width: 390, height: 844 });
  const ps = shot(phone);
  await fill(phone);
  await phone.click('#btn-burger');
  await sleep(500);
  await ps('12-phone-menu');
  await phone.click('#btn-caderno');
  await sleep(2100);
  await ps('13-phone-inicio');
  await phone.click('[data-journal-tab="padaria"]');
  await sleep(1500);
  await ps('14-phone-chapter');
  await phone.evaluate(() => document.querySelector('.jb-right').scrollIntoView());
  await phone.click('.jb-grid .jb-stk.got');
  await sleep(900);
  await ps('15-phone-card');

  // ---------------------------------------------------------------- reduced motion
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('#btn-caderno');
  await sleep(150);
  await s('16-reduced-motion');
  assert(!(await page.$('.jb-cover:not([hidden])')) || (await page.$eval('.jb-cover', (e) => getComputedStyle(e).display === 'none')), 'reduced motion drops the cover');
  console.log('diario shots: ok');
} finally {
  await browser.close();
}
