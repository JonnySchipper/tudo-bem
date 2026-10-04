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

/** Click through the new-word cards until none is left. A short gap between cards is normal. */
async function dismissWordCards(page) {
  for (let i = 0; i < 8; i++) {
    const up = await page.locator('#photo-close').isVisible().catch(() => false);
    if (!up) {
      const next = await page.waitForSelector('#photo-close', { state: 'visible', timeout: i === 0 ? 2_000 : 800 }).catch(() => null);
      if (!next) return;
    }
    await page.locator('#photo-close').click();
    await page.waitForSelector('#photo-close', { state: 'detached', timeout: 2_000 }).catch(() => {});
  }
}
