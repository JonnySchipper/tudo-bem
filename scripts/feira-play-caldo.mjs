/** Drives Caldo de cana with real pointer drags: cane into the press, cup under the spout, lever, flavor, ice, serve. */
import { sleep } from './lib/meveum-play.mjs';

const FLAVOR = [
  ['abacaxi e hortelã', 'abacaxi_hortela'],
  ['limão', 'limao'],
  ['maracujá', 'maracuja'],
  ['gengibre', 'gengibre'],
  ['hortelã', 'hortela'],
  ['laranja', 'laranja'],
  ['abacaxi', 'abacaxi'],
];

async function center(page, sel) {
  const el = await page.waitForSelector(sel, { timeout: 8000 });
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Real mouse drag. `mid` runs once, halfway, still holding the button. */
async function drag(page, from, to, mid) {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await sleep(50);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    await sleep(18);
    if (i === 6 && mid) await mid();
  }
  await page.mouse.up();
  await sleep(80);
}

async function crank(page) {
  const b = await center(page, '#caldo-lever');
  await page.mouse.move(b.x - 16, b.y);
  await page.mouse.down();
  await sleep(40);
  await page.mouse.move(b.x + 34, b.y + 16, { steps: 8 });
  await sleep(40);
  await page.mouse.up();
  await sleep(80);
}

export async function play(page, { shot, mclick, log }) {
  await page.waitForSelector('#caldo-root', { timeout: 15_000 });
  await sleep(1400);
  let served = 0;
  let dragged = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 100_000 && served < 3) {
    if (await page.$('#caldo-end')) break;
    const want = await page.evaluate(() => document.querySelector('.cd-customer .cd-pt')?.textContent ?? '');
    if (!want) {
      await sleep(250);
      continue;
    }
    const flavor = FLAVOR.find(([pt]) => want.toLowerCase().includes(pt))?.[1];
    const gelo = want.includes('com gelo');
    if (!flavor) {
      await sleep(200);
      continue;
    }
    const loaded = await page.$('#caldo-press.cd-loaded');
    if (!loaded) {
      await drag(page, '#caldo-cane', '#caldo-press', dragged ? null : async () => {
        await shot('caldo-drag-cane');
        dragged = true;
      });
      if (!(await page.$('#caldo-press.cd-loaded'))) {
        log('fallback', 'cane click');
        await mclick('#caldo-cane');
        await mclick('#caldo-press');
      }
    }
    if (!(await page.$('#caldo-cup-0.at-spout'))) {
      await drag(page, '#caldo-cup-0', '#caldo-spout');
      if (!(await page.$('#caldo-cup-0.at-spout'))) {
        log('fallback', 'cup click');
        await mclick('#caldo-cup-0');
        await mclick('#caldo-spout');
      }
    }
    if (!(await page.$('#caldo-cup-0.cd-full'))) {
      await crank(page);
      if (served === 0) await shot('caldo-pour');
      await page.waitForSelector('#caldo-cup-0.cd-full', { timeout: 8000 });
    }
    await mclick(`#caldo-pump-${flavor}`);
    if (gelo) await mclick('#caldo-ice');
    if (served === 0) await shot('caldo-flavor');
    const serveId = await page.evaluate(() => document.querySelector('.cd-serve')?.id ?? '');
    if (!serveId) {
      await sleep(200);
      continue;
    }
    await mclick(`#${serveId}`);
    served += 1;
    log('served', served, flavor, gelo ? 'gelo' : 'puro');
    if (served === 1) await shot('caldo-serve-pop');
    await sleep(400);
  }
  if (served < 3 && !(await page.$('#caldo-end'))) await mclick('#caldo-quit');
  await page.waitForSelector('#caldo-end', { timeout: 20_000 });
  await sleep(500);
  await shot('caldo-end');
}
