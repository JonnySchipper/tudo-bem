/**
 * Drives Tapioca on the Feira stage with a real mouse or finger: hold a pan to spread the goma, flip in the
 * green arc, drag the filling the front customer asked for onto it, fold, and drag the tapioca to them.
 */
import { sleep } from './lib/meveum-play.mjs';

const FILLINGS = ['queijo', 'coco', 'chocolate', 'goiabada'];

async function center(page, sel) {
  const el = await page.waitForSelector(sel, { timeout: 8000 });
  const b = await el.boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Press, move in steps, release: a drag the stage reads as a drag (not a tap). */
export async function drag(page, from, to) {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
    await sleep(16);
  }
  await page.mouse.up();
}

export async function hold(page, sel, ms) {
  const a = await center(page, sel);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

/** Skip the first-time practice, and (when `howto` shoots it) open the "?" card and close it again so the 3-2-1 can run. */
export async function startRun(page, root, howto) {
  await page.waitForSelector(root, { timeout: 15_000 });
  await sleep(700);
  // a new profile's first Tapioca is the one-customer practice: Pular goes on to the real run
  if (await page.$('#tapioca-skip')) {
    await page.click('#tapioca-skip');
    await page.waitForSelector('#tapioca-hud #tapioca-sun', { timeout: 15_000 });
    await sleep(700);
  }
  // the cart games' cards wait for the "?" now: open it for the shot
  if (howto && !(await page.$('#howto-ok')) && (await page.$('#howto-help'))) {
    await page.click('#howto-help');
    await sleep(300);
  }
  if (await page.$('#howto-ok')) {
    if (howto) await howto();
    await page.click('#howto-ok');
  }
  // 3-2-1 and the first customer walking up
  await page.waitForSelector('.fst-bubble', { timeout: 15_000 });
  await sleep(300);
}

async function frontOrder(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.fst-bubble');
    return b ? { i: b.getAttribute('data-order'), text: b.querySelector('.fst-bubble-pt')?.textContent ?? '' } : null;
  });
}

export async function play(page, { shot, mclick, log }) {
  await startRun(page, '#tapioca-root', () => shot('tapioca-howto'));
  await shot('tapioca-start');
  let served = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 100_000 && served < 3) {
    if (await page.$('#tapioca-end')) break;
    const o = await frontOrder(page);
    const filling = o && FILLINGS.find((f) => o.text.toLowerCase().includes(f));
    if (!o || !filling) {
      await sleep(300);
      continue;
    }
    // about a second of holding lands an even disc
    await hold(page, '#tapioca-pan-0', 820);
    await sleep(120);
    if (served === 0) await shot('tapioca-cooking');
    // flip when the pan says so (the ring is in its green arc)
    await page.waitForFunction(() => ['Vira!', 'Grudando!'].includes(document.querySelector('[data-label="tp-0"] b')?.textContent ?? ''), null, { timeout: 15_000 });
    await mclick('#tapioca-pan-0');
    await sleep(380);
    await drag(page, `#tapioca-bowl-${filling}`, '#tapioca-pan-0');
    await sleep(200);
    if (served === 0) await shot('tapioca-filled');
    await mclick('#tapioca-pan-0');
    await sleep(250);
    if (served === 0) await shot('tapioca-folded');
    // whoever is waiting for this filling now (the first one may have run out of patience)
    const to = await page.evaluate((f) => {
      const bs = [...document.querySelectorAll('.fst-bubble:not(.fst-bubble-out)')];
      const b = bs.find((x) => x.querySelector('.fst-bubble-pt')?.textContent?.toLowerCase().includes(f)) ?? bs[0];
      return b?.getAttribute('data-order') ?? null;
    }, filling);
    if (to === null) continue;
    await drag(page, '#tapioca-pan-0', `#tapioca-serve-${to}`);
    await sleep(120);
    if (served === 0) await shot('tapioca-serve');
    served += 1;
    log('served', served, filling);
    if (served === 1) {
      // a botched one: too little goma, then into the lixeira with it
      await hold(page, '#tapioca-pan-0', 250);
      await sleep(300);
      await shot('tapioca-botched');
      const a = await center(page, '#tapioca-pan-0');
      const b = await center(page, '#tapioca-bin');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let k = 1; k <= 6; k++) {
        await page.mouse.move(a.x + ((b.x - a.x) * k) / 8, a.y + ((b.y - a.y) * k) / 8);
        await sleep(16);
      }
      await shot('tapioca-trash-drag');
      await page.mouse.move(b.x, b.y);
      await page.mouse.up();
      await sleep(250);
      await shot('tapioca-trashed');
    }
  }
  await sleep(400);
  await shot('tapioca-midrun');
  await mclick('#tapioca-quit');
  await page.waitForSelector('#tapioca-end', { timeout: 20_000 });
  await sleep(600);
  await shot('tapioca-end');
}
