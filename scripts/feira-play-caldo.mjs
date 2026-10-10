/**
 * Drives Caldo de cana on the Feira stage with real mouse input: cane into the press, a cup under the spout,
 * hold the flywheel until the cup says "Solta!", the flavor and ice the front customer asked for, then drag the
 * cup to them. One cup is cranked with no cup under the spout first, so the spill shows.
 */
import { sleep } from './lib/meveum-play.mjs';
import { drag, startRun } from './feira-play-tapioca.mjs';

const FLAVORS = [
  ['abacaxi e hortelã', 'abacaxi_hortela'],
  ['abacaxi', 'abacaxi'],
  ['limão', 'limao'],
  ['maracujá', 'maracuja'],
  ['gengibre', 'gengibre'],
  ['hortelã', 'hortela'],
  ['laranja', 'laranja'],
];

async function frontOrder(page) {
  return page.evaluate((flavors) => {
    const b = document.querySelector('.fst-bubble:not(.fst-bubble-out)');
    if (!b) return null;
    const text = (b.querySelector('.fst-bubble-pt')?.textContent ?? '').toLowerCase();
    const hit = flavors.find(([name]) => text.includes(name));
    return hit ? { i: b.getAttribute('data-order'), flavor: hit[1], ice: text.includes('com gelo') } : null;
  }, FLAVORS);
}

const label = (page) => page.evaluate(() => document.querySelector('[data-label="cd-press"] b')?.textContent ?? '');

/** Hold the flywheel until the press says to let go (or a deadline). */
async function crank(page, untilLine = true) {
  const el = await page.waitForSelector('#caldo-press');
  const b = await el.boundingBox();
  await page.mouse.move(b.x + 20, b.y + b.height / 2);
  await page.mouse.down();
  const end = Date.now() + 4000;
  while (Date.now() < end) {
    const l = await label(page);
    if (untilLine && l === 'Solta!') break;
    await sleep(40);
  }
  if (!untilLine) await sleep(600);
  await page.mouse.up();
}

export async function play(page, { shot, mclick, log }) {
  await startRun(page, '#caldo-root', () => shot('caldo-howto'));
  await shot('caldo-start');
  // cane, but no cup yet: it runs on the counter
  await mclick('#caldo-cane');
  await sleep(150);
  await crank(page, false);
  await sleep(200);
  await shot('caldo-spill');
  let served = 0;
  const t0 = Date.now();
  while (served < 3 && Date.now() - t0 < 80_000) {
    if (await page.$('#caldo-end')) break;
    const o = await frontOrder(page);
    if (!o) {
      await sleep(300);
      continue;
    }
    log('order', o.flavor, o.ice ? 'gelo' : 'puro');
    await mclick('#caldo-cups');
    await sleep(120);
    if ((await label(page)) === 'Põe cana') await mclick('#caldo-cane');
    await crank(page, true);
    await sleep(150);
    if (served === 0) await shot('caldo-line');
    await drag(page, `#caldo-pump-${o.flavor}`, '#caldo-spout');
    await sleep(120);
    if (o.ice) await mclick('#caldo-ice');
    await sleep(150);
    if (served === 0) await shot('caldo-flavor');
    // whoever wants this flavor now (the first may have run out of patience)
    const to = await page.evaluate((name) => {
      const bs = [...document.querySelectorAll('.fst-bubble:not(.fst-bubble-out)')];
      const b = bs.find((x) => x.querySelector('.fst-bubble-pt')?.textContent?.toLowerCase().includes(name)) ?? bs[0];
      return b?.getAttribute('data-order') ?? null;
    }, FLAVORS.find(([, id]) => id === o.flavor)[0]);
    if (to === null) continue;
    await drag(page, '#caldo-spout', `#caldo-serve-${to}`);
    await sleep(200);
    if (served === 0) await shot('caldo-served');
    served += 1;
  }
  await mclick('#caldo-quit');
  await page.waitForSelector('#caldo-end', { timeout: 20_000 });
  await sleep(500);
  await shot('caldo-end');
}
