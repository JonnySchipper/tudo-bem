/**
 * A new account lands on the plane intro. Dismiss it so the rest of the play path can click the world.
 * Accounts that already finished it have no `#arrival-done`. After the card comes the airport hall; this leaves it too.
 */
export async function finishArrival(page) {
  await page.waitForFunction(() => window.__tb?.game?.profile, null, { timeout: 10_000 }).catch(() => {});
  const needs = await page.evaluate(() => window.__tb?.game?.profile?.arrivalIntroDone === false).catch(() => false);
  if (!needs) return;
  await page.click('#arrival-done');
  await page.waitForFunction(() => window.__tb.game.profile.arrivalIntroDone === true, null, { timeout: 8_000 });
  // the card turns into the airport hall (a postcard to photograph); leave it for the square
  const hall = await page.waitForSelector('#hall-done', { timeout: 3_000 }).catch(() => null);
  if (hall) await hall.click();
  // the card's words then celebrate, one at a time. The card ignores the pointer, but "Que bom!" does not,
  // and on the praça that button sits on the tile the play path clicks next.
  await dismissWordCards(page);
}

/** Click through the new-word cards in the page. Night phase A only has a few seconds before 21:00, so this does not wait on Playwright. */
async function dismissWordCards(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 8; i++) {
      let btn = document.getElementById('photo-close');
      if (!btn) {
        await sleep(i === 0 ? 400 : 100);
        btn = document.getElementById('photo-close');
        if (!btn) return;
      }
      btn.click();
      const gone = btn;
      const started = performance.now();
      while (document.getElementById('photo-close') === gone && performance.now() - started < 700) await sleep(30);
    }
  });
}
