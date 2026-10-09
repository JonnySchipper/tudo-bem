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

async function assemble(page, mclick, parts) {
  await mclick('#pastel-dough');
  await sleep(150);
  for (const part of parts) {
    await mclick(`#pastel-bowl-${part}`);
    await sleep(80);
  }
  await mclick('#pastel-crimp');
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
  await startRun(page, '#pastel-root');
  await shot('pastel-start');
  const o = await wantedParts(page);
  if (!o) throw new Error('no pastel order to cook');
  log('order', o.name);
  await mclick('#pastel-dough');
  await sleep(150);
  await mclick(`#pastel-bowl-${o.parts[0]}`);
  await sleep(150);
  await shot('pastel-filling');
  for (const part of o.parts.slice(1)) await mclick(`#pastel-bowl-${part}`);
  await mclick('#pastel-crimp');
  await page.waitForFunction(() => document.querySelector('[data-label="ps-board"] b')?.textContent === 'Pro óleo!', null, { timeout: 5000 });
  await drag(page, '#pastel-board', '#pastel-slot-0');
  await sleep(300);
  await shot('pastel-frying');

  // a second one goes in and is left there
  await assemble(page, mclick, o.parts);
  await drag(page, '#pastel-board', '#pastel-slot-1');
  await page.waitForFunction(() => ['Tira!', 'Queimando!', 'Apaga!'].includes(document.querySelector('[data-label="ps-fry-0"] b')?.textContent ?? ''), null, { timeout: 8000 });
  await shot('pastel-golden');
  await mclick('#pastel-slot-0');
  await sleep(250);
  await shot('pastel-rack');
  await serveRack(page, o.name);
  log('served the first');
  await sleep(300);

  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline && (await labelOf(page, 'ps-fry-1')) !== 'Apaga!') await sleep(150);
  log('slot1', await labelOf(page, 'ps-fry-1'));
  await sleep(400);
  await shot('pastel-fire');
  await mclick('#pastel-slot-1');
  await sleep(300);
  await shot('pastel-out');
  await mclick('#pastel-quit');
  await page.waitForSelector('#pastel-end', { timeout: 20_000 });
  await sleep(500);
  await shot('pastel-end');
}
