/**
 * Browser helpers shared by the e2e scripts: play "Correria no Balcão" through the real taps (the DOM buttons over the world), reading the
 * order from the client's own snapshot. With the test hint on (TB_TEST_MG=1 on the server, `?crtest` in solo) each customer carries its lines,
 * so a bot never has to parse Portuguese; without it the bot falls back to parsing the Portuguese text like a learner would.
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

export async function waitFor(page, fn, arg, timeout = 10_000, label = 'condition') {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 100 });
  } catch {
    throw new Error(`timeout waiting for ${label}`);
  }
}

export const CHAPA = new Set(['pao_na_chapa', 'misto_quente']);
export const CAFE = new Set(['cafe', 'cafe_com_leite']);
const COOK_MS = 2400;
const POUR_FULL = 1800;
const POUR_FAST = 1300;

export const snap = (page) => page.evaluate(() => window.__tb.correria.feed.snap ?? null);

export async function startShift(page) {
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'start' }));
  await page.waitForSelector('#cr-order', { timeout: 8000 });
  await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'the first shift state');
}

/** Wait for a customer at the counter (state front); returns the snapshot view of them. */
export async function waitFront(page, timeout = 30_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await page.$('#mg-end')) return null;
    const c = await page.evaluate(() => window.__tb.correria.feed.snap?.customers.find((x) => x.state === 'front') ?? null);
    if (c) return c;
    await sleep(120);
  }
  throw new Error('no customer came to the counter');
}

const hit = (id) => `#cr-${id}`;

/** Parse a Portuguese order back into lines when the snapshot has no debug lines (proves the text alone is solvable). */
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3 };
const PLURALS = {
  pao: 'pães', pao_na_chapa: 'pães na chapa', pastel: 'pastéis', coxinha: 'coxinhas', bolo: 'bolos', cafe: 'cafés', cafe_com_leite: 'cafés com leite',
  suco_de_laranja: 'sucos de laranja', agua: 'águas', pao_de_queijo: 'pães de queijo', misto_quente: 'mistos-quentes', guarana: 'guaranás',
};
const MODS = { 'pra viagem': 'pra_viagem', 'pra comer aqui': 'pra_comer_aqui', 'sem açúcar': 'sem_acucar', 'bem quente': 'bem_quente' };
export async function parseOrder(page, text) {
  const forms = await page.evaluate(() => [...document.querySelectorAll('.cr-item')].map((b) => ({ id: b.dataset.hit.replace('item-', ''), form: b.querySelector('.cr-lab')?.textContent ?? '' })));
  const list = forms.flatMap((i) => [[PLURALS[i.id], i.id], [i.form, i.id]]).filter(([f]) => f).sort((a, b) => b[0].length - a[0].length);
  const lines = {};
  let rest = text.toLowerCase();
  const re = (prefix, form) => new RegExp(`${prefix}${form.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}-])`, 'u');
  for (const [form, id] of list) {
    let m;
    while ((m = rest.match(re('(um|uma|dois|duas|três|tres)\\s+', form)))) {
      lines[id] = (lines[id] ?? 0) + NUM[m[1]];
      rest = rest.replace(m[0], ' ');
    }
  }
  for (const [form, id] of list) {
    const m = rest.match(re('(^|[\\s,])', form));
    if (m) {
      lines[id] = (lines[id] ?? 0) + 1;
      rest = rest.replace(m[0], ' ');
    }
  }
  const mods = Object.entries(MODS).filter(([k]) => text.toLowerCase().includes(k)).map(([, v]) => v);
  return { lines: Object.entries(lines).map(([itemId, qty]) => ({ itemId, qty })), mods };
}

export async function wantOf(page, c) {
  if (c.debug) return c.debug;
  const o = await parseOrder(page, `${c.pt} ${c.follow?.pt ?? ''}`);
  return o;
}

/** Click the order together: grab, grill (wait, take), pour (hold), then the bag / plate and coffee mods. */
const trace = (...a) => process.env.CR_TRACE && console.log(`    [${new Date().toISOString().slice(14, 23)}]`, ...a);
export async function buildOrder(page, want, { quick = false } = {}) {
  trace("build", JSON.stringify(want));
  const fast = (await snap(page))?.pourMs <= POUR_FAST;
  const pourMs = fast ? POUR_FAST : POUR_FULL;
  await page.click('#cr-clear:not([disabled])', { timeout: 300 }).catch(() => {});
  let slot = 0;
  const grilled = [];
  for (const line of want.lines) {
    for (let i = 0; i < line.qty; i++) {
      if (CHAPA.has(line.itemId)) {
        await page.click(hit(`item-${line.itemId}`));
        grilled.push(Date.now());
        slot++;
        if (slot >= (await snap(page)).chapa.length) await takeGrilled(page);
      } else if (CAFE.has(line.itemId)) {
        // a slow frame can stretch the hold past the window (the server judges it on its own clock): pour again, like a player would
        for (let attempt = 0; attempt < 4; attempt++) {
          const before = (await snap(page)).tray.length;
          trace('pour', line.itemId, attempt);
          const box = await page.locator(hit(`item-${line.itemId}`)).boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await sleep(pourMs * 0.88);
          await page.mouse.up();
          await sleep(250);
          if ((await snap(page)).tray.length > before) break;
        }
        trace('poured');
      } else await page.click(hit(`item-${line.itemId}`));
    }
  }
  await takeGrilled(page);
  for (const m of want.mods) {
    if (m === 'pra_viagem') await page.click(hit('bag'));
    else if (m === 'pra_comer_aqui') await page.click(hit('plate'));
    else if ((await page.getAttribute(`.cr-mod[data-mod="${m}"]`, 'aria-pressed')) !== 'true') await page.click(`.cr-mod[data-mod="${m}"]`);
  }
}

/** Take everything on the grill once it is ready (the green spot), before it burns. */
export async function takeGrilled(page) {
  await sleep(160); // the taps catch up with the server's state a frame later
  for (let guard = 0; guard < 60; guard++) {
    const states = await page.evaluate(() => [...document.querySelectorAll('.cr-grill')].map((b) => b.dataset.state));
    const busy = states.some((s) => s && s !== 'empty');
    if (!busy) return;
    for (let i = 0; i < states.length; i++) if (states[i] === 'ready') await page.click(`#cr-grill-${i}`);
    await sleep(100);
  }
}

/** Open a shift from the counter rail in the padaria (the "Me vê um…" spot behind the counter). */
export async function startShiftFromPedido(page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__tb.interact({ prop: 'trilho' }));
  await page.waitForSelector('#cr-order', { timeout: 12_000 });
  await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'the first shift state');
}

export async function serve(page) {
  trace("serve");
  await page.click('#cr-serve');
}

/** If the front customer asks "Quanto é?", answer right (choose the chip, or type the digits). */
export async function answerAsk(page, { wrong = false } = {}) {
  const ask = await page.evaluate(() => window.__tb.correria.feed.snap?.customers.find((c) => c.state === 'asking')?.ask ?? null);
  if (!ask) return false;
  const total = ask.items.reduce((s, i) => s + i.qty * i.price, 0);
  if (ask.type === 'choice') {
    const pick = wrong ? ask.options.find((o) => o !== total) : total;
    await page.click(`.cr-opt[data-value="${pick}"]`);
  } else {
    await page.fill('#cr-ask-input', String(wrong ? total + 1 : total));
    await page.press('#cr-ask-input', 'Enter');
  }
  return true;
}

/**
 * Play a whole shift through the taps until the end card. `onCustomer(c, i)` runs with the order built, just before Entregar.
 * Returns the number of customers served.
 */
export async function playShift(page, { log = () => {}, dwell = () => Promise.resolve(), onCustomer, onAsk, maxMs = 420_000 } = {}) {
  const until = Date.now() + maxMs;
  let n = 0;
  while (Date.now() < until) {
    if (await page.$('#mg-end')) return n;
    const c = await waitFront(page, 60_000);
    if (!c) return n;
    const want = await wantOf(page, c);
    if (!want.lines.length) throw new Error(`could not read the order: ${c.pt}`);
    // a follow-up may change the order: wait for it to be said, then rebuild
    if (c.follow === null && c.debug) {
      const pending = await page.evaluate(() => 0);
      void pending;
    }
    log(`customer ${n + 1}: “${c.pt}” →`, JSON.stringify(want.lines), want.mods.join(','));
    await dwell(n < 2 ? 1200 : 500);
    await buildOrder(page, want);
    let now = await snap(page);
    let cur = now.customers.find((x) => x.id === c.id);
    // a follow-up changed the order while we built it
    if (cur && cur.follow && !c.follow) {
      const w2 = await wantOf(page, cur);
      log('  follow-up:', cur.follow.pt);
      await buildOrder(page, w2);
      cur = (await snap(page)).customers.find((x) => x.id === c.id);
    }
    if (onCustomer) await onCustomer(c, n);
    if (await page.$('#mg-end')) return n;
    await serve(page);
    await sleep(150);
    // a wrong tray gets one correction: rebuild from the (possibly updated) order and serve again
    const still = (await snap(page))?.customers.find((x) => x.id === c.id && x.state === 'front');
    if (still && still.mistakes > 0) {
      const w2 = await wantOf(page, still);
      log('  correction → rebuild');
      await buildOrder(page, w2);
      await serve(page);
      await sleep(150);
    }
    if (onAsk) await onAsk();
    await answerAsk(page);
    n++;
  }
  throw new Error('the shift did not end in time');
}
