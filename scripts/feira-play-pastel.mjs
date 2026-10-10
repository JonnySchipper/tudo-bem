/**
 * Drives Pastel on the Feira stage with real mouse input: dough, the fillings the customer asked for, the fork,
 * drag it into the oil, pull it while golden, drag it from the rack to them. One pastel is left in the oil
 * until it catches fire, then put out.
 */
import { sleep } from './lib/meveum-play.mjs';
import { drag, startRun } from './feira-play-tapioca.mjs';

const RECIPES = [
  ['frango com catupiry', ['frango', 'catupiry']],
  ['camarão com catupiry', ['camarao', 'catupiry']],
  ['romeu e julieta', ['queijo', 'goiabada']],
  ['banana com canela', ['banana', 'canela']],
  ['calabresa', ['calabresa']],
  ['palmito', ['palmito']],
  ['pizza', ['pizza']],
  ['queijo', ['queijo']],
  ['carne', ['carne']],
];

const labelOf = (page, id) => page.evaluate((k) => document.querySelector(`[data-label="${k}"] b`)?.textContent ?? '', id);

async function wantedParts(page) {
  const text = await page.evaluate(() => document.querySelector('.fst-bubble .fst-bubble-pt')?.textContent ?? '');
  const hit = RECIPES.find(([name]) => text.toLowerCase().includes(name));
  return hit ? { name: hit[0], parts: hit[1] } : null;
}

/** Everything by drag: dough to the board, each filling onto it, the fork over it. */
async function assemble(page, parts) {
  await drag(page, '#pastel-dough', '#pastel-board');
  await sleep(150);
  for (const part of parts) {
    await drag(page, `#pastel-bowl-${part}`, '#pastel-board');
    await sleep(80);
  }
  await drag(page, '#pastel-crimp', '#pastel-board');
  await page.waitForFunction(() => document.querySelector('[data-label="ps-board"] b')?.textContent === 'Pro óleo!', null, { timeout: 5000 });
}

async function serveRack(page, name) {
  const to = await page.evaluate((n) => {
    const bs = [...document.querySelectorAll('.fst-bubble:not(.fst-bubble-out)')];
    const b = bs.find((x) => x.querySelector('.fst-bubble-pt')?.textContent?.toLowerCase().includes(n)) ?? bs[0];
    return b?.getAttribute('data-order') ?? null;
  }, name);
  if (to !== null) await drag(page, '#pastel-rack-0', `#pastel-serve-${to}`);
}

export async function play(page, { shot, mclick, log }) {
  await startRun(page, '#pastel-root', () => shot('pastel-howto'));
  await shot('pastel-start');
  const o = await wantedParts(page);
  if (!o) throw new Error('no pastel order to cook');
  log('order', o.name);
  await drag(page, '#pastel-dough', '#pastel-board');
  await sleep(150);
  await drag(page, `#pastel-bowl-${o.parts[0]}`, '#pastel-board');
  await sleep(150);
  await shot('pastel-filling');
  for (const part of o.parts.slice(1)) await drag(page, `#pastel-bowl-${part}`, '#pastel-board');
  await drag(page, '#pastel-crimp', '#pastel-board');
  await page.waitForFunction(() => document.querySelector('[data-label="ps-board"] b')?.textContent === 'Pro óleo!', null, { timeout: 5000 });
  await drag(page, '#pastel-board', '#pastel-slot-0');
  await sleep(300);
  await shot('pastel-frying');

  // a second one goes straight in with the keyboard shortcuts (a slow headless browser burns it otherwise) and is left there
  const key = async (sel) => {
    await page.evaluate((s) => document.querySelector(s)?.click(), sel);
    await sleep(120);
  };
  await key('#pastel-dough');
  for (const part of o.parts) await key(`#pastel-bowl-${part}`);
  await key('#pastel-crimp');
  await page.waitForFunction(() => document.querySelector('[data-label="ps-board"] b')?.textContent === 'Pro óleo!', null, { timeout: 5000 });
  await key('#pastel-slot-1');

  await page.waitForFunction(() => ['Tira!', 'Queimando!', 'Apaga!'].includes(document.querySelector('[data-label="ps-fry-0"] b')?.textContent ?? ''), null, { timeout: 15_000 });
  // out of the oil by hand, onto the rack (no shot first: it would burn while the camera clicks)
  await drag(page, '#pastel-slot-0', '#pastel-rack');
  await sleep(250);
  await shot('pastel-rack');
  await serveRack(page, o.name);
  await sleep(250);
  await shot('pastel-served');
  log('served the first');

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline && (await labelOf(page, 'ps-fry-1')) !== 'Apaga!') await sleep(150);
  log('slot1', await labelOf(page, 'ps-fry-1'));
  await sleep(400);
  await shot('pastel-fire');
  await mclick('#pastel-slot-1');
  await sleep(300);
  await shot('pastel-out');
  // the brick goes into the bin by hand
  await drag(page, '#pastel-slot-1', '#pastel-bin');
  await sleep(300);
  await shot('pastel-binned');
  await mclick('#pastel-quit');
  await page.waitForSelector('#pastel-end', { timeout: 20_000 });
  await sleep(500);
  await shot('pastel-end');
}
