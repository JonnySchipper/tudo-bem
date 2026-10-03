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

const wantedPack = (mods) => (mods.includes('pra_viagem') ? 'bag' : mods.includes('pra_comer_aqui') ? 'plate' : null);

/** Exact tray: the game rejects extras, and a short count is not ready either. */
function trayExact(tray, want) {
  const have = trayCounts(tray);
  const ids = new Set(want.lines.map((l) => l.itemId));
  if (want.lines.some((l) => (have[l.itemId] ?? 0) !== l.qty)) return false;
  return Object.keys(have).every((id) => ids.has(id));
}

/** The tray, bag/plate and coffee mods match the order the customer is waiting on. */
export async function orderReady(page, want) {
  const now = await snap(page);
  if (!now || !trayExact(now.tray, want)) return false;
  if ((now.pack ?? null) !== wantedPack(want.mods)) return false;
  const mods = now.mods ?? [];
  return want.mods.every((m) => m === 'pra_viagem' || m === 'pra_comer_aqui' || mods.includes(m)) && mods.every((m) => want.mods.includes(m));
}

/** Extras, the wrong bag, or a coffee mod that was not ordered — clear before adding more. */
function needsReset(now, want) {
  if (!now) return false;
  const have = trayCounts(now.tray);
  if (Object.keys(have).some((id) => have[id] > (want.lines.find((l) => l.itemId === id)?.qty ?? 0))) return true;
  const pack = wantedPack(want.mods);
  if (now.pack && now.pack !== pack) return true;
  return (now.mods ?? []).some((m) => !want.mods.includes(m));
}

async function waitUntil(pred, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pred()) return true;
    await sleep(60);
  }
  return false;
}

const itemCount = async (page, itemId) => trayCounts((await snap(page))?.tray)[itemId] ?? 0;

/** False once the end card is up or the shift snapshot says it is over. Retrying the grill after that never moves the tray. */
async function shiftLive(page) {
  return page.evaluate(() => {
    if (document.querySelector('#mg-end')) return false;
    const feed = window.__tb?.correria?.feed;
    return !!(feed?.active && feed.snap && !feed.snap.over);
  });
}

/**
 * A real tap first (short, and it may be covered or still moving after a viewport change). If the snapshot does not
 * change, call the same handler the button uses. Playwright's default click will otherwise wait out a disabled Entregar.
 */
async function nudge(page, selector) {
  await page.locator(selector).click({ timeout: 500, force: true }).catch(() => {});
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
    if (!Number.isFinite(extra) || extra < 0) extra = 0;
    // A gap longer than a heartbeat used to be thrown away, which froze the loaf on the last snapshot age
    // (still "ready") while the spot was already painted burnt. Keep extrapolating through the burn line.
    if (extra > 20_000) extra = 20_000;
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
      // A painted spot with nothing in the snapshot is empty. Chasing that paint waits out the whole burn window.
      // A spot already painted burnt wins over a stale "ready" age.
      if (snap) phase = !c ? 'empty' : dom === 'burnt' || age > burnAt ? 'burnt' : age < readyAt ? 'raw' : 'ready';
      else if (!hidden && (dom === 'raw' || dom === 'ready' || dom === 'burnt')) phase = dom;
      slots.push({ i, phase, age: Math.round(age), dom, hidden });
    }
    return { slots, tray: snap?.tray ?? [] };
  }, { readyAt: READY_AT, burnAt: BURN_MS });
}

async function clickGrill(page, i) {
  const gone = async () => {
    const s = (await grillView(page)).slots.find((x) => x.i === i);
    return !s || s.phase === 'empty';
  };
  await nudge(page, `#cr-grill-${i}`);
  if (await waitUntil(gone, 1500)) return;
  await page.evaluate((slot) => window.__tb.correria.feed.on.chapaTake(slot), i);
  await waitUntil(gone, 1500);
}

async function grillOccupied(page) {
  return (await grillView(page)).slots.some((s) => !s.hidden && s.phase !== 'empty');
}

/** Put one item on the chapa and wait until the snapshot shows it there. */
async function putOnChapa(page, itemId) {
  const on = () => grillOccupied(page);
  await nudge(page, hit(`item-${itemId}`));
  // The shelf tap and the handler both put a bread down. Wait out the tap before the fallback so a slow ack is not a second loaf.
  if (await waitUntil(on, 1500)) return true;
  if (await on()) return true;
  await page.evaluate((id) => window.__tb.correria.feed.on.chapaPut(id), itemId);
  return waitUntil(on, 2000);
}

/** One bread on the chapa, then onto the tray. A burnt one is trashed and tried again. */
async function grillOne(page, itemId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await shiftLive(page))) return;
    const before = await itemCount(page, itemId);
    if (await grillOccupied(page)) {
      await takeGrilled(page);
      if (await grillOccupied(page)) {
        console.log(`  · grill stuck, leaving ${itemId}`);
        return;
      }
    }
    if (!(await putOnChapa(page, itemId))) {
      console.log(`  · chapa did not start ${itemId} (attempt ${attempt + 1})`);
      continue;
    }
    await takeGrilled(page);
    if ((await itemCount(page, itemId)) > before) return;
    const view = await grillView(page);
    console.log(`  · grill ${itemId} missed the tray (attempt ${attempt + 1}) ${JSON.stringify(view.slots)}`);
  }
}

/**
 * Add `itemId` until the tray holds `qty`. A second grab is sent only after the first one has had time to show up
 * in the snapshot — on a busy runner the ack is slower than a short nudge, and the extra loaf makes the serve a miss.
 */
async function grabUntil(page, itemId, qty) {
  let misses = 0;
  while ((await itemCount(page, itemId)) < qty && misses < 3) {
    const before = await itemCount(page, itemId);
    if (before >= qty) return;
    const grew = async () => (await itemCount(page, itemId)) > before;
    await nudge(page, hit(`item-${itemId}`));
    if (await waitUntil(grew, 2000)) continue;
    if (await grew()) continue;
    await page.evaluate((id) => window.__tb.correria.feed.on.grab(id), itemId);
    if (await waitUntil(grew, 2500)) continue;
    misses++;
    console.log(`  · grab ${itemId} missed the tray (${before}→${await itemCount(page, itemId)}, want ${qty})`);
  }
}

async function pourOne(page, itemId, pourMs) {
  const before = (await snap(page))?.tray.length ?? 0;
  const grew = async () => ((await snap(page))?.tray.length ?? 0) > before;
  const box = await page.locator(hit(`item-${itemId}`)).boundingBox().catch(() => null);
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await sleep(pourMs * 0.88);
    await page.mouse.up();
    if (await waitUntil(grew, 1500)) return;
  }
  if (await grew()) return;
  // The hold is judged on the server clock. A direct start/end pair still has to wait out the real pour window.
  await page.evaluate((id) => window.__tb.correria.feed.on.pourStart(id), itemId);
  await sleep(pourMs * 0.88);
  await page.evaluate(() => window.__tb.correria.feed.on.pourEnd());
  await waitUntil(grew, 800);
}

async function choosePack(page, kind) {
  const sel = kind === 'bag' ? hit('bag') : hit('plate');
  const ready = async () => (await snap(page))?.pack === kind;
  if (await ready()) return;
  await nudge(page, sel);
  if (await waitUntil(ready, 1500)) return;
  // pack() toggles when the snapshot already shows this bag. Don't send that once the tap has landed.
  await page.evaluate((k) => {
    if (window.__tb.correria.feed.snap?.pack === k) return;
    window.__tb.correria.feed.on.pack(k);
  }, kind);
  await waitUntil(ready, 1500);
}

async function chooseMod(page, mod) {
  const ready = async () => !!(await snap(page))?.mods?.includes(mod);
  if (await ready()) return;
  const sel = `.cr-mod[data-mod="${mod}"]`;
  await nudge(page, sel);
  if (await waitUntil(ready, 1500)) return;
  await page.evaluate((m) => {
    if (window.__tb.correria.feed.snap?.mods?.includes(m)) return;
    document.querySelector(`.cr-mod[data-mod="${m}"]`)?.click();
  }, mod);
  await waitUntil(ready, 1500);
}

/** Empty the tray and wait until the snapshot says so. A clear that has not landed yet makes the next grabs stack on the old order. */
async function clearTray(page) {
  const clean = async () => {
    const s = await snap(page);
    return !!s && s.tray.length === 0 && !s.pack && !(s.mods?.length);
  };
  if (await clean()) return true;
  await page.evaluate(() => window.__tb.correria.feed.on.clear());
  if (await waitUntil(clean, 3000)) return true;
  await page.evaluate(() => window.__tb.correria.feed.on.clear());
  return waitUntil(clean, 2000);
}

export async function buildOrder(page, want, { quick = false } = {}) {
  trace('build', JSON.stringify(want));
  const fast = (await snap(page))?.pourMs <= POUR_FAST;
  const pourMs = fast ? POUR_FAST : POUR_FULL;
  if (needsReset(await snap(page), want)) {
    const now = await snap(page);
    console.log(`  · reset tray ${JSON.stringify(now?.tray ?? [])} pack=${now?.pack ?? null}`);
    await clearTray(page);
  }
  for (const line of want.lines) {
    if (CHAPA.has(line.itemId)) {
      let guard = 0;
      while ((await itemCount(page, line.itemId)) < line.qty && guard++ < line.qty + 2) {
        const before = await itemCount(page, line.itemId);
        await grillOne(page, line.itemId);
        if ((await itemCount(page, line.itemId)) <= before) break;
      }
    } else if (CAFE.has(line.itemId)) {
      // a slow frame can stretch a mouse-hold past the window (the server judges it on its own clock): pour again
      let guard = 0;
      while ((await itemCount(page, line.itemId)) < line.qty && guard++ < line.qty + 2) {
        const before = await itemCount(page, line.itemId);
        trace('pour', line.itemId, guard);
        await pourOne(page, line.itemId, pourMs);
        if ((await itemCount(page, line.itemId)) <= before) break;
      }
      trace('poured');
    } else await grabUntil(page, line.itemId, line.qty);
  }
  if (await grillOccupied(page)) await takeGrilled(page);
  for (const m of want.mods) {
    if (m === 'pra_viagem') await choosePack(page, 'bag');
    else if (m === 'pra_comer_aqui') await choosePack(page, 'plate');
    else await chooseMod(page, m);
  }
}

/**
 * Take everything on the grill once it is ready (the green spot), before it burns.
 * A painted state that never leaves `raw` still gets a tap once the cook time has passed on the wall clock:
 * the server accepts the take when its own clock is in the window, and a burnt spot is cleared so the next put can start.
 */
export async function takeGrilled(page) {
  const started = Date.now();
  let taps = 0;
  while (Date.now() - started < BURN_MS + 2200) {
    if (!(await shiftLive(page))) return;
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
      taps++;
    }
    // A spot that survives a few takes is not going to land on the tray. Stop instead of waiting out the burn window.
    if (taps >= 2 && (await grillOccupied(page))) return;
    await sleep(tapped ? 180 : 90);
  }
}

/** The "Jogar Correria no Balcão" button after the Pedido rápido scene opens the first shift. */
export async function startShiftFromPedido(page) {
  await page.click('#btn-pedido-play-mg');
  await page.waitForSelector('#cr-order', { timeout: 12_000 });
  await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'the first shift state');
}

const serveDiag = (page) =>
  page.evaluate(() => {
    const s = window.__tb?.correria?.feed?.snap;
    const b = document.querySelector('#cr-serve');
    const front = s?.customers?.find((c) => c.state === 'front' || c.state === 'asking');
    return {
      disabled: !!b?.disabled,
      ended: !!document.querySelector('#mg-end'),
      tray: s?.tray ?? null,
      chapa: s?.chapa ?? null,
      pack: s?.pack ?? null,
      front: front ? { state: front.state, pt: front.pt } : null,
    };
  });

export async function serve(page) {
  trace('serve');
  // Entregar stays disabled while the tray is empty or nobody is waiting. A customer who already walked
  // off (patience, or a second miss) must not abort the rest of the shift.
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    const st = await serveDiag(page).catch(() => null);
    if (!st || st.ended || !st.front) {
      console.log(`  · Entregar skipped (${JSON.stringify(st)})`);
      return false;
    }
    if (!st.disabled) {
      // A moving counter camera keeps Playwright from treating Entregar as stable, so the click waits until the customer has already left.
      await page.evaluate(() => {
        const b = document.querySelector('#cr-serve');
        if (b && !b.disabled) b.click();
        else window.__tb.correria.feed.on.serve();
      });
      return true;
    }
    await sleep(80);
  }
  const diag = await serveDiag(page).catch(() => null);
  throw new Error(`#cr-serve stayed disabled (${JSON.stringify(diag)})`);
}

/** Build the order, and once more from an empty tray if the counts (or the bag / mods) are not exact yet. */
async function deliver(page, want, log) {
  await buildOrder(page, want);
  if (await orderReady(page, want)) return;
  const now = await snap(page);
  log(`  tray incomplete → rebuild have=${JSON.stringify(now?.tray ?? [])} want=${JSON.stringify(want.lines)} pack=${now?.pack ?? null} mods=${JSON.stringify(now?.mods ?? [])}`);
  await clearTray(page);
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
  const tries = new Map();
  while (Date.now() < until) {
    if (await page.$('#mg-end')) return n;
    const c = await waitFront(page, 60_000);
    if (!c) return n;
    const attempt = (tries.get(c.id) ?? 0) + 1;
    tries.set(c.id, attempt);
    if (attempt > 2) {
      log(`  giving up on “${c.pt}” after ${attempt - 1} tries`);
      const st = await serveDiag(page).catch(() => null);
      if (st?.front && st.tray?.length) await serve(page);
      else await waitUntil(async () => !(await snap(page))?.customers?.some((x) => x.id === c.id && x.state === 'front'), 20_000);
      continue;
    }
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
    const stillHere = async () => {
      if (await page.$('#mg-end')) return false;
      const s = await snap(page);
      return !!s?.customers?.some((x) => x.id === c.id && (x.state === 'front' || x.state === 'asking'));
    };
    if (!(await stillHere())) {
      log('  customer left before Entregar');
      continue;
    }
    if (!(await serve(page))) continue;
    await sleep(150);
    // a wrong tray gets one correction: rebuild from the (possibly updated) order and serve again
    const still = (await snap(page))?.customers.find((x) => x.id === c.id && x.state === 'front');
    if (still && still.mistakes > 0) {
      const w2 = await wantOf(page, still);
      log('  correction → rebuild', JSON.stringify((await snap(page))?.tray ?? []));
      await deliver(page, w2, log);
      if (await stillHere()) await serve(page);
      await sleep(150);
    }
    if (onAsk) await onAsk();
    await answerAsk(page);
    const movedOn = await waitUntil(async () => {
      const s = await snap(page);
      const x = s?.customers?.find((c0) => c0.id === c.id);
      return !x || x.state !== 'front';
    }, 2000);
    if (!movedOn) {
      log(`  still at the counter after Entregar (${JSON.stringify((await snap(page))?.tray ?? [])})`);
      continue;
    }
    n++;
  }
  throw new Error('the shift did not end in time');
}
