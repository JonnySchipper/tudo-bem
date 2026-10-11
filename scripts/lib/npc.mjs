import { assert } from './meveum-play.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Click an NPC the way the game does (`__tb.interact`) and walk through any recado offer ("Agora não") or hand-over ("Só conversar") the NPC
 * opens with, until the dialogue box with `data-dialogue === finalKey` is open. `finalKey` null accepts the first box that is not an offer or
 * a hand-over. Returns the key reached. (A learned idle line has no box of its own: it leads the first line of the box the click opens.)
 */
export async function openNpc(page, npc, finalKey = null) {
  const ok = await page.evaluate((t) => window.__tb.interact(t), { npc });
  assert(ok, `interact target exists: npc ${npc}`);
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
    const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
    const isOffer = key?.startsWith('offer-') || key?.startsWith('give-');
    if (key === finalKey || (finalKey === null && !isOffer)) return key;
    if (isOffer) await page.click('#dialogue-box [data-chip="1"]');
    await sleep(350);
  }
  throw new Error(`could not reach the ${finalKey ?? 'plain'} dialogue of ${npc}`);
}
