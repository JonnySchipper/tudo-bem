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

/** Same window as `chapaPhase`: ready just before cookMs, burnt after burnMs. */
const BURN_MS = 5400;
const READY_AT = COOK_MS - 150;
/**
 * Latest extrapolated age we'll still take to land. A busy runner's timer can wake late; a take
 * sent near the burn line is applied after the server's catch-up and comes back trashed (`lost`).
 * Above this we clear the slot and start a fresh loaf.
 */
const LAND_HI = 4600;
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

/** The customer we were serving has walked. Keep building and the late items land on the next person. */
async function frontGone(page) {
  if (!(await shiftLive(page))) return true;
  const s = await snap(page);
  return !s?.customers?.some((c) => c.state === 'front');
}

/**
 * The shelf, grill, and bag buttons sit on a camera that moves every frame, so a Playwright click often never lands
 * and the wait eats the customer's patience. Call the handler the button uses. One action, then a sync if the
 * snapshot has not caught up — a second grab on top of a slow ack is an extra the game rejects.
 */
async function callHandler(page, fn, arg) {
  await page.evaluate(fn, arg);
}

async function nudgeSnap(page) {
  const before = await page.evaluate(() => window.__tb?.correria?.feed?.snapAt ?? 0).catch(() => 0);
  await page.evaluate(() => window.__tb?.net?.send?.({ t: 'mg', action: 'sync' })).catch(() => {});
  // The sync is only useful once the fresh snapshot has landed. Reading the old one is how a take looks "ready" and never moves the tray.
  await waitUntil(async () => (await page.evaluate(() => window.__tb?.correria?.feed?.snapAt ?? 0).catch(() => before)) !== before, 800);
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
      if (snap) phase = c ? (age < readyAt ? 'raw' : age <= burnAt ? 'ready' : 'burnt') : 'empty';
      else if (!hidden && (dom === 'raw' || dom === 'ready' || dom === 'burnt')) phase = dom;
      slots.push({ i, phase, age: Math.round(age), dom, hidden });
    }
    return { slots, tray: snap?.tray ?? [] };
  }, { readyAt: READY_AT, burnAt: BURN_MS });
}

async function clickGrill(page, i) {
  await callHandler(page, (slot) => window.__tb.correria.feed.on.chapaTake(slot), i);
}

async function grillOccupied(page) {
  return (await grillView(page)).slots.some((s) => !s.hidden && s.phase !== 'empty');
}

/**
 * Put one loaf on the chapa and take it when it is ready, all inside one page call.
 * A Playwright round trip between the put and the take is long enough on the Phase 0 runner for the
 * server clock to cross the burn line first (run 37230872315: `grill take pao_na_chapa lost`, slots empty).
 */
async function grillOne(page, itemId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const outcome = await page.evaluate(({ itemId, readyAt, burnAt, landHi }) => {
      const feed = window.__tb?.correria?.feed;
      if (!feed?.on?.chapaPut || !feed?.on?.chapaTake || !feed.snap) return Promise.resolve({ outcome: 'gone', slots: [] });
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const count = () => (feed.snap?.tray ?? []).filter((id) => id === itemId).length;
      const alive = () => {
        if (document.querySelector('#mg-end')) return false;
        return !!(feed.active && feed.snap && !feed.snap.over && feed.snap.customers?.some((c) => c.state === 'front'));
      };
      const ageOf = (entry) => {
        let extra = performance.now() - (feed.snapAt || performance.now());
        if (!Number.isFinite(extra) || extra < 0) extra = 0;
        if (extra > 8_000) extra = 8_000;
        return entry.age + extra;
      };
      const slotOf = (id) => {
        const chapa = feed.snap?.chapa;
        if (!chapa) return null;
        const i = chapa.findIndex((s) => s && (!id || s.item === id));
        if (i < 0) return null;
        return { i, item: chapa[i].item, age: ageOf(chapa[i]) };
      };
      const slots = () => (feed.snap?.chapa ?? []).map((s, i) => (s ? { i, item: s.item, age: Math.round(ageOf(s)) } : null));
      const beforeCount = count();
      const deadline = performance.now() + burnAt + 1_200;
      let putAt = 0;
      let lastTake = 0;
      const report = (outcome) => ({ outcome, before: beforeCount, count: count(), slots: slots() });
      const afterTake = (kind) => {
        const snapAt = feed.snapAt;
        const until = performance.now() + 1_200;
        const wait = () => {
          if (count() > beforeCount) return Promise.resolve(report('landed'));
          const answered = feed.snapAt !== snapAt;
          if ((answered && !slotOf(itemId)) || performance.now() > until) {
            return Promise.resolve(report(count() > beforeCount ? 'landed' : kind));
          }
          return sleep(40).then(wait);
        };
        return wait();
      };
      const tick = () => {
        if (!alive()) return Promise.resolve(report(count() > beforeCount ? 'landed' : 'gone'));
        if (count() > beforeCount) return Promise.resolve(report('landed'));
        if (performance.now() > deadline) return Promise.resolve(report('timeout'));
        const other = slotOf(null);
        const slot = slotOf(itemId);
        if (other && (!slot || other.i !== slot.i)) {
          if (other.age < readyAt) return sleep(Math.min(50, Math.max(16, readyAt - other.age))).then(tick);
          feed.on.chapaTake(other.i);
          return sleep(80).then(tick);
        }
        if (!slot) {
          if (!putAt) {
            feed.on.chapaPut(itemId);
            putAt = performance.now();
          } else if (performance.now() > putAt + 2_000) {
            return Promise.resolve(report('empty'));
          }
          return sleep(40).then(tick);
        }
        if (slot.age > landHi) {
          feed.on.chapaTake(slot.i);
          return afterTake('burnt');
        }
        if (slot.age >= readyAt) {
          if (performance.now() - lastTake < 200) return sleep(40).then(tick);
          lastTake = performance.now();
          feed.on.chapaTake(slot.i);
          return afterTake('lost');
        }
        return sleep(Math.min(50, Math.max(16, readyAt - slot.age))).then(tick);
      };
      return tick();
    }, { itemId, readyAt: READY_AT, burnAt: BURN_MS, landHi: LAND_HI });
    if (!outcome || outcome.outcome === 'gone') return;
    if (outcome.outcome === 'landed' || outcome.count > outcome.before) return;
    const late = await itemCount(page, itemId);
    if (late > outcome.before) return;
    console.log(`  · grill ${itemId} ${outcome.outcome} (attempt ${attempt + 1}) ${JSON.stringify(outcome.slots)}`);
    if (!(await shiftLive(page)) || (await frontGone(page))) return;
  }
}

/**
 * Add `itemId` until the tray holds `qty`. A second grab is sent only after the first one has had time to show up
 * in the snapshot — on a busy runner the ack is slower than a short nudge, and the extra loaf makes the serve a miss.
 */
async function grabUntil(page, itemId, qty) {
  let misses = 0;
  while ((await itemCount(page, itemId)) < qty && misses < 2) {
    if (await frontGone(page)) return;
    const before = await itemCount(page, itemId);
    if (before >= qty) return;
    const grew = async () => (await itemCount(page, itemId)) > before;
    await callHandler(page, (id) => window.__tb.correria.feed.on.grab(id), itemId);
    if (await waitUntil(grew, 900)) continue;
    await nudgeSnap(page);
    if (await waitUntil(grew, 700)) continue;
    misses++;
    console.log(`  · grab ${itemId} missed the tray (${before}→${await itemCount(page, itemId)}, want ${qty})`);
  }
}

const sayOf = (page) => page.evaluate(() => document.querySelector('#cr-say')?.textContent ?? '');

/** Release a cup that is still under the machine so the next pour_start is not ignored. A finished cup stays on the tray. */
async function endPour(page) {
  if (!(await snap(page))?.pour) return;
  await callHandler(page, () => window.__tb.correria.feed.on.pourEnd());
  if (await waitUntil(async () => !(await snap(page))?.pour, 700)) return;
  await nudgeSnap(page);
  await waitUntil(async () => !(await snap(page))?.pour, 500);
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Hold as a fraction of pourMs. The server accepts 70%–108%. The page timer starts with pour_start.
 * On the post-merge runner the timer woke late: hold 0.86 landed at fill 1.11, then 0.81 at 1.13
 * (run 37230872315). Both are spills, and a floor of 0.78 could not absorb ~0.30 of slop.
 * `start` sits where lag 0 and lag ~0.32 both still land (0.74 and 1.06). A measured miss steps
 * toward `aim` by the whole error, and never outside [lo, hi]. A cup that landed does not move the hold.
 */
export const POUR_HOLD = { start: 0.74, hi: 0.8, lo: 0.7, aim: 0.88, step: 0.03 };

/** @param {{ hold: number, spills: number }} state @param {'ok'|'short'|'spill'|'miss'|'gone'} result @param {number | null} [fill] */
export function nextPourHold(state, result, fill = null) {
  const hold = clamp(round2(state.hold), POUR_HOLD.lo, POUR_HOLD.hi);
  if (result === 'ok' || result === 'gone') return { hold, spills: result === 'ok' ? 0 : state.spills };
  const measured = typeof fill === 'number' && Number.isFinite(fill) ? Math.max(POUR_HOLD.step, Math.abs(fill - POUR_HOLD.aim)) : POUR_HOLD.step;
  if (result === 'spill') {
    return { hold: clamp(round2(hold - measured), POUR_HOLD.lo, POUR_HOLD.hi), spills: state.spills + 1 };
  }
  return { hold: clamp(round2(hold + measured), POUR_HOLD.lo, POUR_HOLD.hi), spills: 0 };
}

export function pourTargetMs(pourMs, hold) {
  return Math.round(pourMs * clamp(hold, POUR_HOLD.lo, POUR_HOLD.hi));
}

/** Kept for the whole process: the same runner's lag does not reset between customers. */
let pourState = { hold: POUR_HOLD.start, spills: 0 };

/**
 * One cup. The good window is 70%–108% of pourMs on the server clock. The hold is a page timer started with
 * pour_start: waiting until a snapshot says the cup is full counts the trip there and then the trip back, so
 * the release lands past the spill line whenever the runner is slow. Returns ok / short / spill / miss / gone.
 * A missing feed is a miss, not "the customer left" — bailing there used to skip the coffee and serve the water alone.
 */
async function pourOne(page, itemId, pourMs, qty) {
  const target = pourTargetMs(pourMs, pourState.hold);
  // One round trip. The hold starts in this call: three snapshot reads before pour_start were ~10s of
  // patience on the Phase 0 runner (run 37230872315, first café at 12s).
  const released = await page.evaluate(({ itemId, target, qty }) => {
    const feed = window.__tb?.correria?.feed;
    const count = () => (feed?.snap?.tray ?? []).filter((id) => id === itemId).length;
    const alive = () => {
      if (!feed?.snap || !feed.active || feed.snap.over) return false;
      if (document.querySelector('#mg-end')) return false;
      return !!feed.snap.customers?.some((c) => c.state === 'front');
    };
    if (!feed?.on?.pourStart || !alive()) return { status: 'gone', count: count() };
    if (count() >= qty) return { status: 'have', count: count() };
    if (!feed.__tbPourTap) {
      const orig = feed.push.bind(feed);
      feed.push = (c) => {
        const e = c?.e;
        if (c?.t === 'ev' && e && (e.k === 'pour_ok' || e.k === 'pour_bad')) {
          feed.__tbLastPour = { k: e.k, fill: e.fill, why: e.why ?? null, at: performance.now() };
        }
        return orig(c);
      };
      feed.__tbPourTap = true;
    }
    return new Promise((resolve) => {
      const startHold = () => {
        if (!alive()) return resolve({ status: 'gone', count: count() });
        if (count() >= qty) return resolve({ status: 'have', count: count() });
        feed.__tbLastPour = null;
        feed.on.pourStart(itemId);
        const mark = performance.now();
        const beforeCount = count();
        const releaseAt = mark + target;
        const tick = () => {
          if (!alive()) return resolve({ status: 'gone', count: count() });
          if (performance.now() < releaseAt) {
            setTimeout(tick, Math.min(30, Math.max(0, releaseAt - performance.now())));
            return;
          }
          feed.__tbLastPour = null;
          const releasedAt = performance.now();
          feed.on.pourEnd();
          const until = performance.now() + 1_200;
          const wait = () => {
            const n = count();
            const p = feed.__tbLastPour;
            const fresh = p && p.at >= releasedAt - 5 ? p : null;
            if (fresh || n > beforeCount || performance.now() > until || !alive()) {
              resolve({
                status: alive() ? 'ended' : 'gone',
                k: fresh?.k ?? (n > beforeCount ? 'pour_ok' : null),
                fill: typeof fresh?.fill === 'number' ? fresh.fill : null,
                why: fresh?.why ?? null,
                grew: n > beforeCount,
                count: n,
              });
              return;
            }
            setTimeout(wait, 40);
          };
          wait();
        };
        tick();
      };
      if (!feed.snap.pour) return startHold();
      feed.on.pourEnd();
      const until = performance.now() + 700;
      const waitClear = () => {
        if (!feed.snap?.pour || performance.now() > until || !alive()) return startHold();
        setTimeout(waitClear, 40);
      };
      waitClear();
    });
  }, { itemId, target, qty });
  const fill = typeof released?.fill === 'number' ? released.fill : null;
  const count = released?.count ?? 0;
  if (!released || released.status === 'gone') return { result: 'gone', fill, count };
  if (released.status === 'have' || released.grew || released.k === 'pour_ok' || count >= qty) return { result: 'ok', fill, count };
  if (released.why === 'spill') return { result: 'spill', fill, count };
  if (released.why === 'short') return { result: 'short', fill, count };
  return { result: 'miss', fill, count };
}

/** Pour until the tray holds `qty`. A miss steps the next hold; a cup the server already accepted is not poured again. */
async function pourUntil(page, itemId, qty, pourMs) {
  let misses = 0;
  for (let tries = 0; tries < 4 && misses < 3; tries++) {
    const { result, fill, count } = await pourOne(page, itemId, pourMs, qty);
    if (result === 'gone') return;
    if (count >= qty) {
      pourState = nextPourHold(pourState, 'ok', fill);
      return;
    }
    // pour_ok already put a cup on the server tray. Pouring again stacks a second one and the order is rejected.
    if (result === 'ok') {
      console.log(`  · pour ${itemId} ok but not on the tray yet`);
      return;
    }
    pourState = nextPourHold(pourState, result, fill);
    misses++;
    const fillNote = fill == null ? '' : ` fill=${fill.toFixed(2)}`;
    console.log(`  · pour ${itemId} ${result}${fillNote} → hold ${pourState.hold.toFixed(2)}`);
  }
}

async function choosePack(page, kind) {
  const ready = async () => (await snap(page))?.pack === kind;
  if (await ready()) return;
  // pack() toggles when the snapshot already shows this bag.
  await callHandler(page, (k) => {
    if (window.__tb.correria.feed.snap?.pack === k) return;
    window.__tb.correria.feed.on.pack(k);
  }, kind);
  if (await waitUntil(ready, 1000)) return;
  await nudgeSnap(page);
  await waitUntil(ready, 800);
}

async function chooseMod(page, mod) {
  const ready = async () => !!(await snap(page))?.mods?.includes(mod);
  if (await ready()) return;
  await callHandler(page, (m) => {
    if (window.__tb.correria.feed.snap?.mods?.includes(m)) return;
    document.querySelector(`.cr-mod[data-mod="${m}"]`)?.click();
  }, mod);
  if (await waitUntil(ready, 1000)) return;
  await nudgeSnap(page);
  await waitUntil(ready, 800);
}

/** Empty the tray and wait until the snapshot says so. A clear that has not landed yet makes the next grabs stack on the old order. */
async function clearTray(page) {
  // Finish an open pour first. Otherwise pour_end can land the cup *after* the clear and the next customer inherits it.
  await endPour(page);
  const clean = async () => {
    const s = await snap(page);
    return !!s && s.tray.length === 0 && !s.pack && !(s.mods?.length) && !s.pour;
  };
  if (await clean()) return true;
  await page.evaluate(() => window.__tb.correria.feed.on.clear());
  if (await waitUntil(clean, 1500)) return true;
  await nudgeSnap(page);
  if (await clean()) return true;
  await page.evaluate(() => window.__tb.correria.feed.on.clear());
  return waitUntil(clean, 1200);
}

export async function buildOrder(page, want, { quick = false } = {}) {
  if (await frontGone(page)) return;
  trace('build', JSON.stringify(want));
  const now0 = await snap(page);
  // A missing pourMs used to look "fast" (1300ms) and every full cup came out short.
  const pourMs = now0?.pourMs > 0 ? now0.pourMs : POUR_FULL;
  // A loaf left from the previous customer has to come off before we pour, or the take drops it on top of a good cup and the whole tray is a miss.
  if ((await grillOccupied(page)) && !(await frontGone(page))) await takeGrilled(page);
  if (needsReset(await snap(page), want)) {
    const now = await snap(page);
    console.log(`  · reset tray ${JSON.stringify(now?.tray ?? [])} pack=${now?.pack ?? null}`);
    await clearTray(page);
  }
  // Coffee first: the hold is the fragile step, and a grilled loaf already on the tray survives a second pour.
  const lines = [
    ...want.lines.filter((l) => CAFE.has(l.itemId)),
    ...want.lines.filter((l) => CHAPA.has(l.itemId)),
    ...want.lines.filter((l) => !CAFE.has(l.itemId) && !CHAPA.has(l.itemId)),
  ];
  for (const line of lines) {
    if (await frontGone(page)) return;
    if (CHAPA.has(line.itemId)) {
      let guard = 0;
      while ((await itemCount(page, line.itemId)) < line.qty && guard++ < line.qty + 1) {
        const before = await itemCount(page, line.itemId);
        await grillOne(page, line.itemId);
        if ((await itemCount(page, line.itemId)) <= before) break;
      }
    } else if (CAFE.has(line.itemId)) {
      trace('pour', line.itemId, pourMs);
      await pourUntil(page, line.itemId, line.qty, pourMs);
      trace('poured');
    } else await grabUntil(page, line.itemId, line.qty);
  }
  if (await grillOccupied(page) && !(await frontGone(page))) await takeGrilled(page);
  if (await frontGone(page)) return;
  for (const m of want.mods) {
    if (await frontGone(page)) return;
    if (m === 'pra_viagem') await choosePack(page, 'bag');
    else if (m === 'pra_comer_aqui') await choosePack(page, 'plate');
    else await chooseMod(page, m);
  }
}

/**
 * Take everything on the grill once a fresh snapshot says it is ready, and trash a burnt spot so the next put can start.
 * The sync runs first: a stalled server clock is applied on that message, and the take itself then moves only a few milliseconds.
 */
export async function takeGrilled(page) {
  const started = Date.now();
  while (Date.now() - started < BURN_MS + 600) {
    if (!(await shiftLive(page)) || (await frontGone(page))) return;
    await nudgeSnap(page);
    const view = await grillView(page);
    const live = view.slots.filter((s) => !s.hidden && s.phase !== 'empty');
    if (!live.length) return;
    let waiting = false;
    for (const s of live) {
      if (s.phase === 'raw' && s.age < READY_AT - 40 && Date.now() - started < GRILL_FORCE_MS) {
        waiting = true;
        await sleep(Math.min(220, Math.max(60, READY_AT - s.age)));
        continue;
      }
      await clickGrill(page, s.i);
    }
    if (!waiting) {
      if (await waitUntil(async () => !(await grillOccupied(page)), 450)) return;
    }
  }
}

/** Open a shift from the counter rail in the padaria (the "Me vê um…" spot behind the counter). */
export async function startShiftFromPedido(page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__tb.interact({ prop: 'trilho' }));
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
  // off (patience, or a second miss) must not abort the rest of the shift. "Quanto é?" also disables it;
  // that question is answered by the caller, and waiting here used to fail the whole play path.
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    const st = await serveDiag(page).catch(() => null);
    if (!st || st.ended || !st.front || st.front.state === 'asking') {
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
  if (!diag?.front || diag.front.state === 'asking' || diag.ended) {
    console.log(`  · Entregar skipped (${JSON.stringify(diag)})`);
    return false;
  }
  throw new Error(`#cr-serve stayed disabled (${JSON.stringify(diag)})`);
}

const trayDesc = (now, want) => `have=${JSON.stringify(now?.tray ?? [])} want=${JSON.stringify(want.lines)} pack=${now?.pack ?? null} mods=${JSON.stringify(now?.mods ?? [])}`;

/**
 * Build the order. A short tray (right items, not enough of them) is topped up — clearing two finished pães to retry one cup
 * is how the rest of the wave walks out. Extras and the wrong bag still get one clear and a fresh build.
 */
async function deliver(page, want, log) {
  if (await frontGone(page)) return;
  await buildOrder(page, want);
  if (await frontGone(page)) return;
  if (await orderReady(page, want)) return;
  const now = await snap(page);
  if (!needsReset(now, want)) {
    log(`  tray short → top up ${trayDesc(now, want)}`);
    await buildOrder(page, want);
    return;
  }
  log(`  tray incomplete → rebuild ${trayDesc(now, want)}`);
  await clearTray(page);
  if (await frontGone(page)) return;
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
      // A pour still open would finish onto the next customer's tray (the "reset tray [cafe…]" spiral).
      if (await shiftLive(page)) await clearTray(page);
      continue;
    }
    if (!(await snap(page))?.tray?.length) {
      // One more pass on this same customer (the attempt counter above). Waiting them out here just drains the queue.
      log('  nothing on the tray yet');
      if (await shiftLive(page)) await clearTray(page);
      continue;
    }
    if (!(await serve(page))) {
      // Entregar stays disabled through "Quanto é?". Answer it here; a customer who already left is a no-op.
      await answerAsk(page);
      continue;
    }
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
