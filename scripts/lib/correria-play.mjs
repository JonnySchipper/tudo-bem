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
/** Same window as `chapaPhase` in the shared rules: ready just before cookMs, burnt after burnMs. */
const BURN_MS = 5400;
const READY_AT = COOK_MS - 150;
/** Wall-clock wait after a put before we tap the grill even if the painted state is still raw. */
const GRILL_FORCE_MS = 2600;

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

const trayCounts = (tray) => {
  const have = {};
  for (const id of tray ?? []) have[id] = (have[id] ?? 0) + 1;
  return have;
};

/** The tray, bag/plate and coffee mods match the order the customer is waiting on. */
export async function orderReady(page, want) {
  const now = await snap(page);
  if (!now) return false;
  const have = trayCounts(now.tray);
  if (!want.lines.every((l) => (have[l.itemId] ?? 0) >= l.qty)) return false;
  for (const m of want.mods) {
    if (m === 'pra_viagem') { if (now.pack !== 'bag') return false; }
    else if (m === 'pra_comer_aqui') { if (now.pack !== 'plate') return false; }
    else if (!now.mods?.includes(m)) return false;
  }
  return true;
}

/** Shelf / grill / bag taps. A covered spot still runs its handler: Playwright's hit-test click would wait until the strip moves. */
async function tap(page, selector) {
  const clicked = await page.locator(selector).click({ timeout: 2500 }).then(() => true).catch(() => false);
  if (clicked) return;
  await page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
}

/**
 * Grill slots from the snapshot clock (age at the last message, plus time since it arrived) and from the painted `data-state`.
 * A stalled frame can leave the spot painted `raw` straight through the green window; the snapshot clock does not wait on that frame.
 */
async function grillView(page) {
  return page.evaluate(({ readyAt, burnAt }) => {
    const feed = window.__tb?.correria?.feed;
    const snap = feed?.snap ?? null;
    let extra = snap ? performance.now() - (feed.snapAt || performance.now()) : 0;
    if (!Number.isFinite(extra) || extra < 0 || extra > 12_000) extra = 0;
    const buttons = [...document.querySelectorAll('.cr-grill')];
    const n = Math.max(snap?.chapa?.length ?? 0, buttons.length);
    const slots = [];
    for (let i = 0; i < n; i++) {
      const el = document.querySelector(`#cr-grill-${i}`);
      const hidden = !el || el.style.display === 'none';
      const dom = el?.dataset.state || 'empty';
      const c = snap?.chapa?.[i] ?? null;
      const age = c ? c.age + extra : 0;
      let phase = 'empty';
      if (c) phase = age < readyAt ? 'raw' : age <= burnAt ? 'ready' : 'burnt';
      else if (!hidden && (dom === 'raw' || dom === 'ready' || dom === 'burnt')) phase = dom;
      slots.push({ i, phase, age: Math.round(age), dom, hidden });
    }
    return { slots, tray: snap?.tray ?? [] };
  }, { readyAt: READY_AT, burnAt: BURN_MS });
}

async function clickGrill(page, i) {
  const sel = `#cr-grill-${i}`;
  // The handler is a click listener. Calling it in the page still works when the spot sits under the counter strip.
  const clicked = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.click();
    return true;
  }, sel);
  if (!clicked) await page.locator(sel).click({ timeout: 1500, force: true }).catch(() => {});
}

/** One bread on the chapa, then onto the tray. A burnt one is trashed and tried again. */
async function grillOne(page, itemId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = trayCounts((await snap(page))?.tray)[itemId] ?? 0;
    const busy = (await grillView(page)).slots.some((s) => !s.hidden && s.phase !== 'empty');
    if (busy) await takeGrilled(page);
    await tap(page, hit(`item-${itemId}`));
    // the put is a network round-trip; taking before the snapshot shows the bread would see an empty grill and give up
    const landed = Date.now() + 2500;
    while (Date.now() < landed) {
      const view = await grillView(page);
      const onGrill = view.slots.some((s) => !s.hidden && s.phase !== 'empty');
      if (onGrill || (trayCounts(view.tray)[itemId] ?? 0) > before) break;
      await sleep(80);
    }
    await takeGrilled(page);
    const after = trayCounts((await snap(page))?.tray)[itemId] ?? 0;
    if (after > before) return;
    const view = await grillView(page);
    console.log(`  · grill ${itemId} missed the tray (attempt ${attempt + 1}) ${JSON.stringify(view.slots)}`);
  }
}

export async function buildOrder(page, want, { quick = false } = {}) {
  trace('build', JSON.stringify(want));
  const fast = (await snap(page))?.pourMs <= POUR_FAST;
  const pourMs = fast ? POUR_FAST : POUR_FULL;
  await page.click('#cr-clear:not([disabled])', { timeout: 300 }).catch(() => {});
  for (const line of want.lines) {
    for (let i = 0; i < line.qty; i++) {
      if (CHAPA.has(line.itemId)) await grillOne(page, line.itemId);
      else if (CAFE.has(line.itemId)) {
        // a slow frame can stretch the hold past the window (the server judges it on its own clock): pour again, like a player would
        for (let attempt = 0; attempt < 4; attempt++) {
          const before = (await snap(page)).tray.length;
          trace('pour', line.itemId, attempt);
          const box = await page.locator(hit(`item-${line.itemId}`)).boundingBox();
          if (!box) {
            await tap(page, hit(`item-${line.itemId}`));
            await sleep(200);
          } else {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await sleep(pourMs * 0.88);
            await page.mouse.up();
            await sleep(250);
          }
          if ((await snap(page)).tray.length > before) break;
        }
        trace('poured');
      } else await tap(page, hit(`item-${line.itemId}`));
    }
  }
  await takeGrilled(page);
  for (const m of want.mods) {
    if (m === 'pra_viagem') await tap(page, hit('bag'));
    else if (m === 'pra_comer_aqui') await tap(page, hit('plate'));
    else if ((await page.getAttribute(`.cr-mod[data-mod="${m}"]`, 'aria-pressed')) !== 'true') await tap(page, `.cr-mod[data-mod="${m}"]`);
  }
}

/**
 * Take everything on the grill once it is ready (the green spot), before it burns.
 * A painted state that never leaves `raw` still gets a tap once the cook time has passed on the wall clock:
 * the server accepts the take when its own clock is in the window, and a burnt spot is cleared so the next put can start.
 */
export async function takeGrilled(page) {
  const started = Date.now();
  while (Date.now() - started < BURN_MS + 2200) {
    const view = await grillView(page);
    const live = view.slots.filter((s) => !s.hidden && s.phase !== 'empty');
    if (!live.length) return;
    const elapsed = Date.now() - started;
    let tapped = false;
    for (const s of live) {
      const due = s.phase === 'ready' || s.phase === 'burnt' || (s.phase === 'raw' && elapsed >= GRILL_FORCE_MS);
      if (!due) continue;
      await clickGrill(page, s.i);
      tapped = true;
    }
    await sleep(tapped ? 180 : 90);
  }
}

/** The "Jogar Correria no Balcão" button after the Pedido rápido scene opens the first shift. */
export async function startShiftFromPedido(page) {
  await page.click('#btn-pedido-play-mg');
  await page.waitForSelector('#cr-order', { timeout: 12_000 });
  await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'the first shift state');
}

export async function serve(page) {
  trace('serve');
  // Entregar stays disabled while the tray is empty or the customer in front is not waiting. Don't sit on that for the default click timeout.
  const enabled = await page
    .waitForFunction(() => {
      const b = document.querySelector('#cr-serve');
      return !!b && !b.disabled;
    }, null, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!enabled) {
    const diag = await page.evaluate(() => {
      const s = window.__tb?.correria?.feed?.snap;
      const b = document.querySelector('#cr-serve');
      const front = s?.customers?.find((c) => c.state === 'front' || c.state === 'asking');
      return { disabled: !!b?.disabled, tray: s?.tray ?? null, chapa: s?.chapa ?? null, pack: s?.pack ?? null, front: front ? { state: front.state, pt: front.pt } : null };
    }).catch(() => null);
    throw new Error(`#cr-serve stayed disabled (${JSON.stringify(diag)})`);
  }
  await page.click('#cr-serve');
}

/** Build the order, and once more if the tray (or the bag / mods) does not match yet. */
async function deliver(page, want, log) {
  await buildOrder(page, want);
  if (await orderReady(page, want)) return;
  log('  tray incomplete → rebuild');
  await buildOrder(page, want);
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
    await deliver(page, want, log);
    let now = await snap(page);
    let cur = now.customers.find((x) => x.id === c.id);
    // a follow-up changed the order while we built it
    if (cur && cur.follow && !c.follow) {
      const w2 = await wantOf(page, cur);
      log('  follow-up:', cur.follow.pt);
      await deliver(page, w2, log);
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
      await deliver(page, w2, log);
      await serve(page);
      await sleep(150);
    }
    if (onAsk) await onAsk();
    await answerAsk(page);
    n++;
  }
  throw new Error('the shift did not end in time');
}
