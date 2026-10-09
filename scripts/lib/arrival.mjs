/**
 * A new account lands at the airport (the arrival tutorial). Play paths that are about something else skip it: Célia's hand-over (as her
 * "Obrigada!" chip sends it), the note's word cards dismissed, then straight to the praça. An account that already finished it lands in
 * the praça (or the room it was in) and is only waited for. Either way the page ends in the praça.
 */
export async function finishArrival(page) {
  await page.waitForFunction(() => window.__tb?.game?.profile && window.__tb.game.room, null, { timeout: 20_000 });
  const needs = await page.evaluate(() => window.__tb.game.profile.arrivalIntroDone === false);
  // a brand-new account starts in the arrivals hall (the guided tutorial): mark it done and go on to the airport
  const hall = await page.evaluate(() => window.__tb.game.profile.desembarqueDone === false);
  if (hall) {
    await page.waitForFunction(() => window.__tb.game.room?.room === 'desembarque', null, { timeout: 10_000 });
    await page.evaluate(() => {
      window.__tb.net.send({ t: 'arrival', action: 'landed' });
      window.__tb.net.send({ t: 'join', room: 'aeroporto' });
    });
    // showAirportNext() is scheduled 700ms after desembarque → aeroporto; dismiss before praça clicks.
    await page.waitForSelector('#aero-next-ok', { state: 'visible', timeout: 8_000 });
    await page.click('#aero-next-ok');
    await page.waitForFunction(() => !document.getElementById('aero-next'), null, { timeout: 5_000 });
  }
  if (needs) {
    await page.waitForFunction(() => window.__tb.game.room?.room === 'aeroporto', null, { timeout: 10_000 });
    await page.evaluate(() => window.__tb.net.send({ t: 'arrival', action: 'finish' }));
    await page.waitForFunction(() => window.__tb.game.profile.arrivalIntroDone === true, null, { timeout: 8_000 });
    // the note's words then celebrate, one at a time. The card ignores the pointer, but "Que bom!" does not,
    // and on the praça that button sits on the tile the play path clicks next.
    await dismissWordCards(page);
  }
  const room = await page.evaluate(() => window.__tb.game.room?.room);
  if (room === 'aeroporto' || room === 'desembarque') await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'praca' }));
  await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 10_000 });
  await dismissWordCards(page);
  if (await page.$('#aero-next-ok')) await page.click('#aero-next-ok');
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
