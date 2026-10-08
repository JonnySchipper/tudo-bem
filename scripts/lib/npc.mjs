import { assert } from './meveum-play.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Click Continuar on the learned-line opener (`idle-<npc>`) until the box is something else. No-op when that opener is not up.
 * The line used to float in a speech bubble while a different line opened in the box; it is the first beat of the talk now.
 */
export async function passIdle(page) {
  for (let i = 0; i < 4; i++) {
    if (!(await page.$('#dialogue-box'))) return;
    const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
    if (!key?.startsWith('idle-')) return;
    await page.click('#dialogue-box [data-chip="0"]');
    await sleep(350);
  }
}

/**
 * Click an NPC the way the game does (`__tb.interact`) and walk through the learned-line opener ("Continuar"), any recado offer ("Agora não")
 * or hand-over ("Só conversar") the NPC opens with, until the dialogue box with `data-dialogue === finalKey` is open. `finalKey` null accepts
 * the first box that is not an opener, an offer or a hand-over. Returns the key reached.
 */
export async function openNpc(page, npc, finalKey = null) {
  const ok = await page.evaluate((t) => window.__tb.interact(t), { npc });
  assert(ok, `interact target exists: npc ${npc}`);
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
    const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
    const isIdle = key?.startsWith('idle-');
    const isOffer = key?.startsWith('offer-') || key?.startsWith('give-');
    if (!isIdle && (key === finalKey || (finalKey === null && !isOffer))) return key;
    if (isIdle || isOffer) await page.click(`#dialogue-box [data-chip="${isIdle ? '0' : '1'}"]`);
    await sleep(350);
  }
  throw new Error(`could not reach the ${finalKey ?? 'plain'} dialogue of ${npc}`);
}
