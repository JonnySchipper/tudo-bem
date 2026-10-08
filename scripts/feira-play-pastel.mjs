/** Drives Pastel with real mouse clicks: dough, filling, fork, oil, pull, and one pastel left until it catches fire. */
import { sleep } from './lib/meveum-play.mjs';

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

async function orderParts(page) {
  const text = await page.evaluate(() => document.querySelector('.ps-customer .ps-pt')?.textContent ?? '');
  const hit = RECIPES.find(([name]) => text.toLowerCase().includes(name));
  return hit ? hit[1] : null;
}

async function stageOf(page, slot) {
  return page.getAttribute(`#pastel-slot-${slot}`, 'data-doneness');
}

/** Poll until the pastel reaches `want`, or a later stage of the ladder. */
async function waitStage(page, slot, want, timeout = 15_000) {
  const order = ['empty', 'raw', 'golden', 'dark', 'black', 'block', 'fire'];
  const need = order.indexOf(want);
  const deadline = Date.now() + timeout;
  let stage = await stageOf(page, slot);
  while (Date.now() < deadline) {
    stage = await stageOf(page, slot);
    if (order.indexOf(stage) >= need && need >= 0) return stage;
    await sleep(120);
  }
  return stage;
}

export async function play(page, { shot, mclick, log }) {
  await page.waitForSelector('#pastel-root', { timeout: 15_000 });
  await page.waitForSelector('.ps-customer .ps-pt', { timeout: 12_000 });
  await sleep(400);
  const parts = await orderParts(page);
  if (!parts) throw new Error('no pastel order to cook');
  log('order', parts.join('+'));

  await mclick('#pastel-dough');
  await sleep(120);
  for (const part of parts) {
    await mclick(`#pastel-bowl-${part}`);
    await sleep(100);
  }
  await shot('pastel-filling');
  await mclick('#pastel-crimp');
  await sleep(120);
  await mclick('#pastel-slot-0');
  await sleep(200);
  await shot('pastel-frying');

  // A second pastel goes in once the first is already dark, so the fire shot shows two stages.
  await mclick('#pastel-dough');
  for (const part of parts) await mclick(`#pastel-bowl-${part}`);
  await mclick('#pastel-crimp');
  const mid = await waitStage(page, 0, 'black');
  log('slot0 before second drop', mid);
  await mclick('#pastel-slot-1');

  const dropped = await page.getAttribute('#pastel-slot-1', 'data-state');
  if (dropped === 'empty') await mclick('#pastel-slot-1');
  const burnt = await waitStage(page, 0, 'fire', 12_000);
  log('slot0', burnt, 'slot1', await stageOf(page, 1));
  if (burnt !== 'fire') throw new Error(`expected an on-fire pastel, saw ${burnt}`);
  await sleep(300);
  await shot('pastel-fire');

  await mclick('#pastel-apaga-0');
  await sleep(200);
  const pulled = await stageOf(page, 1);
  if (pulled && pulled !== 'empty' && pulled !== 'ready') await mclick('#pastel-slot-1');
  await sleep(150);
  const serve = await page.$('#pastel-serve-0');
  if (serve) await mclick('#pastel-serve-0');
  else if (await page.$('.ps-serve')) await mclick('.ps-serve');
  log('served after the fire');
  await sleep(300);
  await mclick('#pastel-quit');
  await page.waitForSelector('#pastel-end', { timeout: 20_000 });
  await sleep(500);
  await shot('pastel-end');
}
