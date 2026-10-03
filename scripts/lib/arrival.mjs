/**
 * A new account lands on the plane intro. Dismiss it so the rest of the play path can click the world.
 * Accounts that already finished it have no `#arrival-done`.
 */
export async function finishArrival(page) {
  await page.waitForFunction(() => window.__tb?.game?.profile, null, { timeout: 10_000 }).catch(() => {});
  const needs = await page.evaluate(() => window.__tb?.game?.profile?.arrivalIntroDone === false).catch(() => false);
  if (!needs) return;
  await page.click('#arrival-done');
  await page.waitForFunction(() => window.__tb.game.profile.arrivalIntroDone === true, null, { timeout: 8_000 });
}
