/** Drives Tapioca with real clicks: spread, flip on time, fill what the front customer asked for, roll, serve. */
import { sleep } from './lib/meveum-play.mjs';

export async function play(page, { shot, mclick, log }) {
  await page.waitForSelector('#tapioca-root', { timeout: 15_000 });
  await sleep(2500);
  let served = 0;
  const t0 = Date.now();
  let midShot = false;
  while (Date.now() - t0 < 100_000) {
    if (await page.$('#tapioca-end')) break;
    const want = await page.evaluate(() => {
      const c = document.querySelector('.tp-customer .tp-pt');
      return c?.textContent ?? '';
    });
    const filling = ['queijo', 'coco', 'chocolate', 'goiabada'].find((f) => want.toLowerCase().includes(f));
    if (!filling) { await sleep(400); continue; }
    const pans = await page.$$eval('.tp-pan', (els) => els.length);
    // start every empty pan, so the shot shows juggling
    for (let i = 0; i < pans; i++) {
      const cls = await page.$eval(`#tapioca-pan-${i}`, (e) => e.className);
      if (cls.includes('tp-empty')) await mclick(`#tapioca-pan-${i}`);
    }
    await sleep(2600);
    if (!midShot) { await shot('tapioca-cooking'); midShot = true; }
    await mclick('#tapioca-pan-0');
    await sleep(150);
    await mclick(`#tapioca-bowl-${filling}`);
    await sleep(150);
    const cls = await page.$eval('#tapioca-pan-0', (e) => e.className);
    if (cls.includes('tp-filled')) await mclick('#tapioca-pan-0');
    await sleep(150);
    if (served === 1) await shot('tapioca-rolled');
    const serve = await page.$('.tp-serve');
    if (serve) await mclick('.tp-serve');
    served++;
    log('served', served, filling, cls);
    if (served === 2) { await sleep(100); await shot('tapioca-serve-pop'); }
    if (served >= 4) { await mclick('#tapioca-quit'); break; }
  }
  await page.waitForSelector('#tapioca-end', { timeout: 20_000 });
  await sleep(600);
  await shot('tapioca-end');
}
