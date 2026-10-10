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
export const SUCO = new Set(['suco_de_laranja']);
/** Same numbers as `JUICE` in shared/correria.ts: one orange per cycle, a glass is good from goodMin of the line up to spillAt. */
export const JUICER = { cycleMs: 640, goodMin: 0.8, spillAt: 1.2, sizes: { p: 0.26, m: 0.34, g: 0.4 } };
/** Juicer: another orange while the glass is under the line, then take it. Stopping at the line never overflows (shared test). */
export function nextJuiceTap(fill) {
  return (Number(fill) || 0) < JUICER.goodMin ? 'drop' : 'take';
}
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
    const c = await page.evaluate(() => {
      if (document.querySelector('#mg-end')) return { ended: true };
      return window.__tb.correria.feed.snap?.customers.find((x) => x.state === 'front') ?? null;
    });
    if (c?.ended) return null;
    if (c) return c;
    await sleep(80);
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
const MODS = { 'pra viagem': 'pra_viagem', 'pra comer aqui': 'pra_comer_aqui', 'extra quente': 'bem_quente' };
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

/** Click the order together: grab, grill (wait, take), pour (tap to start, wait, tap to stop), then the bag / plate and coffee mods. */
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

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Wait between the start tap and the stop tap, as a fraction of pourMs. Not a pointer hold: the cup fills on its own.
 * The server accepts 70%–108%. The page timer starts with pour_start and only wakes late, so the server fill is this
 * fraction plus the lateness.
 * Run 37230872315: wait 0.86 → fill 1.11, then 0.81 → 1.13.
 * Run 37232979457: wait 0.74 → fill 1.09 (about 0.35 late). 0.74 + 0.35 spills; 0.70 + 0.35 is 1.05.
 * `start` is the floor, which is still a legal cup when the timer is on time. A measured miss steps
 * toward `aim` by the whole error, and never outside [lo, hi]. A cup that landed does not move the wait.
 */
export const POUR_HOLD = { start: 0.7, hi: 0.8, lo: 0.7, aim: 0.88, step: 0.03 };

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

/** Empty the tray in one page call. A pour left open lands on the next customer after `leave()` wipes the tray. */
async function clearTray(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const feed = window.__tb?.correria?.feed;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clean = () => {
      const s = feed?.snap;
      return !!s && s.tray.length === 0 && !s.pack && !(s.mods?.length) && !s.pour && !document.querySelector('#mg-end');
    };
    const run = async () => {
      if (!feed?.on || document.querySelector('#mg-end') || !feed.snap || feed.snap.over) return false;
      if (feed.snap.pour) {
        feed.on.pourEnd();
        const until = performance.now() + 700;
        while (feed.snap?.pour && performance.now() < until) await sleep(40);
      }
      if (clean()) return true;
      feed.on.clear();
      let until = performance.now() + 1200;
      while (!clean() && performance.now() < until) await sleep(40);
      if (!clean()) {
        feed.on.clear();
        until = performance.now() + 800;
        while (!clean() && performance.now() < until) await sleep(40);
      }
      return clean();
    };
    run().then(resolve);
  }));
}

/**
 * Build one order without coming back to Node between taps.
 * On the Phase 0 runner a Playwright round trip is long enough that two grilled loaves (run 37232979457,
 * ~21s each) outlast the spawn gap, and the next customers reach the counter with their patience already spent.
 * The cook and the pour stay inside this call; only the network ack has to land before the next tap.
 */
async function assembleOrder(page, want) {
  const lines = [
    ...want.lines.filter((l) => CAFE.has(l.itemId)),
    ...want.lines.filter((l) => CHAPA.has(l.itemId)),
    ...want.lines.filter((l) => SUCO.has(l.itemId)),
    ...want.lines.filter((l) => !CAFE.has(l.itemId) && !CHAPA.has(l.itemId) && !SUCO.has(l.itemId)),
  ].map((l) => ({
    itemId: l.itemId,
    qty: l.qty,
    station: CAFE.has(l.itemId) ? 'cafe' : CHAPA.has(l.itemId) ? 'chapa' : SUCO.has(l.itemId) ? 'suco' : 'grab',
  }));
  const report = await page.evaluate((arg) => new Promise((resolve) => {
    const feed = window.__tb?.correria?.feed;
    const notes = [];
    let hold = arg.hold;
    let spills = arg.spills;
    const fail = (status, extra) => resolve({
      status,
      notes,
      pourState: { hold, spills },
      tray: feed?.snap?.tray ?? [],
      pack: feed?.snap?.pack ?? null,
      mods: feed?.snap?.mods ?? [],
      customer: null,
      reset: false,
      ...extra,
    });
    if (!feed?.on?.grab || !feed.snap) return fail('gone');
    const { lines, mods, pourHold, readyAt, burnAt, landHi, pourFull, juicer } = arg;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const wallEnd = performance.now() + 20_000;
    const frontNow = () => feed.snap?.customers?.find((c) => c.state === 'front') ?? null;
    const front0 = frontNow();
    if (!front0) return fail('gone');
    const frontId = front0.id;
    const customer = () => {
      const s = feed.snap;
      const x = s?.customers?.find((c) => c.id === frontId) ?? null;
      if (!x) return null;
      return { id: x.id, state: x.state, pt: x.pt, follow: x.follow ?? null, debug: x.debug ?? null, mistakes: x.mistakes ?? 0 };
    };
    const alive = () => {
      if (document.querySelector('#mg-end')) return false;
      const s = feed.snap;
      if (!s || !feed.active || s.over) return false;
      return !!s.customers?.some((c) => c.id === frontId && c.state === 'front');
    };
    const count = (itemId) => (feed.snap?.tray ?? []).filter((id) => id === itemId).length;
    const sameOrder = () => {
      const d = customer()?.debug;
      if (!d) return true;
      if (d.lines.length !== lines.length || d.mods.length !== mods.length) return false;
      if (!lines.every((l) => d.lines.some((x) => x.itemId === l.itemId && x.qty === l.qty))) return false;
      return mods.every((m) => d.mods.includes(m));
    };
    const counts = (tray) => {
      const have = {};
      for (const id of tray ?? []) have[id] = (have[id] ?? 0) + 1;
      return have;
    };
    const coffeeMods = mods.filter((m) => m !== 'pra_viagem' && m !== 'pra_comer_aqui');
    const packWant = mods.includes('pra_viagem') ? 'bag' : mods.includes('pra_comer_aqui') ? 'plate' : null;
    const dirty = () => {
      const s = feed.snap;
      if (!s) return false;
      const have = counts(s.tray);
      if (Object.keys(have).some((id) => have[id] > (lines.find((l) => l.itemId === id)?.qty ?? 0))) return true;
      if (s.pack && s.pack !== packWant) return true;
      return (s.mods ?? []).some((m) => !coffeeMods.includes(m));
    };
    const ready = () => {
      const s = feed.snap;
      if (!s || dirty()) return false;
      const have = counts(s.tray);
      if (lines.some((l) => (have[l.itemId] ?? 0) !== l.qty)) return false;
      if (Object.keys(have).some((id) => !lines.some((l) => l.itemId === id))) return false;
      if ((s.pack ?? null) !== packWant) return false;
      const got = s.mods ?? [];
      return coffeeMods.every((m) => got.includes(m)) && got.every((m) => coffeeMods.includes(m));
    };
    const base = () => ({
      notes,
      pourState: { hold, spills },
      tray: feed.snap?.tray ?? [],
      pack: feed.snap?.pack ?? null,
      mods: feed.snap?.mods ?? [],
      customer: customer(),
      reset: dirty(),
    });
    const stepHold = (result, fill) => {
      const h = Math.min(pourHold.hi, Math.max(pourHold.lo, Math.round(hold * 100) / 100));
      if (result === 'ok' || result === 'gone') {
        hold = h;
        if (result === 'ok') spills = 0;
        return;
      }
      const measured = typeof fill === 'number' && Number.isFinite(fill) ? Math.max(pourHold.step, Math.abs(fill - pourHold.aim)) : pourHold.step;
      const next = result === 'spill' ? h - measured : h + measured;
      hold = Math.min(pourHold.hi, Math.max(pourHold.lo, Math.round(next * 100) / 100));
      spills = result === 'spill' ? spills + 1 : 0;
    };
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
    const grillSlots = () => (feed.snap?.chapa ?? []).map((s, i) => (s ? { i, item: s.item, age: Math.round(ageOf(s)) } : null));
    const afterTake = async (kind, before, itemId) => {
      const snapAt = feed.snapAt;
      const until = performance.now() + 1_200;
      while (performance.now() < until) {
        if (count(itemId) > before) return { outcome: 'landed', slots: grillSlots() };
        if ((feed.snapAt !== snapAt && !slotOf(itemId)) || !alive()) break;
        await sleep(40);
      }
      return { outcome: count(itemId) > before ? 'landed' : kind, slots: grillSlots() };
    };
    const grillOnce = async (itemId) => {
      const before = count(itemId);
      const deadline = Math.min(wallEnd, performance.now() + burnAt + 1_200);
      let putAt = 0;
      let lastTake = 0;
      while (performance.now() < deadline) {
        if (!alive()) return { outcome: count(itemId) > before ? 'landed' : 'gone', slots: grillSlots() };
        if (count(itemId) > before) return { outcome: 'landed', slots: grillSlots() };
        const any = slotOf(null);
        const slot = slotOf(itemId);
        if (any && (!slot || any.i !== slot.i)) {
          if (any.age < readyAt) {
            await sleep(Math.min(50, Math.max(16, readyAt - any.age)));
            continue;
          }
          feed.on.chapaTake(any.i);
          await sleep(80);
          continue;
        }
        if (!slot) {
          if (!putAt) {
            feed.on.chapaPut(itemId);
            putAt = performance.now();
          } else if (performance.now() > putAt + 2_000) return { outcome: 'empty', slots: grillSlots() };
          await sleep(40);
          continue;
        }
        if (slot.age > landHi) {
          feed.on.chapaTake(slot.i);
          return afterTake('burnt', before, itemId);
        }
        if (slot.age >= readyAt) {
          if (performance.now() - lastTake < 200) {
            await sleep(40);
            continue;
          }
          lastTake = performance.now();
          feed.on.chapaTake(slot.i);
          return afterTake('lost', before, itemId);
        }
        await sleep(Math.min(50, Math.max(16, readyAt - slot.age)));
      }
      return { outcome: count(itemId) > before ? 'landed' : 'timeout', slots: grillSlots() };
    };
    const pourOnce = async (itemId, qty) => {
      const pourMs = feed.snap?.pourMs > 0 ? feed.snap.pourMs : pourFull;
      // extra quente: hold on past the green to the middle of the red
      const target = mods.includes('bem_quente') ? Math.round(pourMs * 1.26) : Math.round(pourMs * Math.min(pourHold.hi, Math.max(pourHold.lo, hold)));
      if (feed.snap?.pour) {
        feed.on.pourEnd();
        const until = performance.now() + 700;
        while (feed.snap?.pour && performance.now() < until && alive()) await sleep(40);
      }
      if (!alive()) return { result: 'gone', fill: null, count: count(itemId) };
      if (count(itemId) >= qty) return { result: 'ok', fill: null, count: count(itemId) };
      feed.__tbLastPour = null;
      // Tap to start. The cup fills on its own; the wait below is not a pointer hold.
      feed.on.pourStart(itemId);
      const before = count(itemId);
      const releaseAt = performance.now() + target;
      while (performance.now() < releaseAt) {
        if (!alive()) {
          feed.on.pourEnd();
          return { result: 'gone', fill: null, count: count(itemId) };
        }
        await sleep(Math.min(30, Math.max(0, releaseAt - performance.now())));
      }
      feed.__tbLastPour = null;
      const releasedAt = performance.now();
      // Tap again to stop inside the good window.
      feed.on.pourEnd();
      const until = performance.now() + 1_200;
      let fresh = null;
      while (performance.now() < until && alive()) {
        const p = feed.__tbLastPour;
        fresh = p && p.at >= releasedAt - 5 ? p : null;
        if (fresh || count(itemId) > before) break;
        await sleep(40);
      }
      const n = count(itemId);
      const fill = typeof fresh?.fill === 'number' ? fresh.fill : null;
      if (!alive() && !fresh && n <= before) return { result: 'gone', fill, count: n };
      if (n > before || fresh?.k === 'pour_ok' || n >= qty) return { result: 'ok', fill, count: n };
      if (fresh?.why === 'spill') return { result: 'spill', fill, count: n };
      if (fresh?.why === 'short') return { result: 'short', fill, count: n };
      return { result: 'miss', fill, count: n };
    };
    /** One glass through the juicer: an orange per tap (waiting out each cut-and-press cycle) until the line, then tap the glass. */
    const juiceOnce = async (itemId) => {
      const before = count(itemId);
      const until = Math.min(wallEnd, performance.now() + 8_000);
      let lastTap = 0;
      while (performance.now() < until) {
        if (!alive()) return count(itemId) > before ? 'landed' : 'gone';
        if (count(itemId) > before) return 'landed';
        const j = feed.snap?.juice ?? null;
        const busy = j ? ageOf(j) < juicer.cycleMs + 40 : false;
        if (busy || performance.now() - lastTap < juicer.cycleMs + 60) {
          await sleep(40);
          continue;
        }
        lastTap = performance.now();
        if ((j?.fill ?? 0) < juicer.goodMin) feed.on.juiceDrop();
        else feed.on.juiceTake();
      }
      return count(itemId) > before ? 'landed' : 'timeout';
    };
    const run = async () => {
      // A loaf still on the chapa has to come off before a new put. Taking it early (raw) is ignored.
      while (alive() && performance.now() < wallEnd) {
        const any = slotOf(null);
        if (!any) break;
        if (any.age < readyAt) await sleep(Math.min(50, Math.max(16, readyAt - any.age)));
        else {
          feed.on.chapaTake(any.i);
          await sleep(80);
        }
      }
      if (!alive()) return resolve({ status: 'gone', ...base() });
      if (dirty()) {
        notes.push(`reset tray ${JSON.stringify(feed.snap?.tray ?? [])} pack=${feed.snap?.pack ?? null}`);
        if (feed.snap?.pour) feed.on.pourEnd();
        feed.on.clear();
        const until = performance.now() + 1200;
        while (dirty() && performance.now() < until && alive()) await sleep(40);
      }
      for (const line of lines) {
        if (!alive()) return resolve({ status: 'gone', ...base() });
        if (!sameOrder()) return resolve({ status: 'follow', ...base() });
        if (performance.now() > wallEnd) return resolve({ status: 'short', ...base() });
        if (line.station === 'cafe') {
          let misses = 0;
          for (let tries = 0; tries < 4 && misses < 3 && count(line.itemId) < line.qty; tries++) {
            const poured = await pourOnce(line.itemId, line.qty);
            if (poured.result === 'gone') return resolve({ status: 'gone', ...base() });
            if (poured.count >= line.qty) {
              stepHold('ok', poured.fill);
              break;
            }
            if (poured.result === 'ok') {
              notes.push(`pour ${line.itemId} ok but not on the tray yet`);
              stepHold('ok', poured.fill);
              break;
            }
            stepHold(poured.result, poured.fill);
            misses++;
            const fillNote = poured.fill == null ? '' : ` fill=${poured.fill.toFixed(2)}`;
            notes.push(`pour ${line.itemId} ${poured.result}${fillNote} → wait ${hold.toFixed(2)}`);
          }
        } else if (line.station === 'chapa') {
          let made = 0;
          while (count(line.itemId) < line.qty && made++ < line.qty + 1) {
            const before = count(line.itemId);
            let landed = false;
            for (let attempt = 0; attempt < 2; attempt++) {
              const outcome = await grillOnce(line.itemId);
              if (!alive()) return resolve({ status: 'gone', ...base() });
              if (outcome.outcome === 'landed' || count(line.itemId) > before) {
                landed = true;
                break;
              }
              notes.push(`grill ${line.itemId} ${outcome.outcome} (attempt ${attempt + 1}) ${JSON.stringify(outcome.slots)}`);
            }
            if (!landed || count(line.itemId) <= before) break;
          }
        } else if (line.station === 'suco') {
          for (let tries = 0; tries < line.qty + 2 && count(line.itemId) < line.qty; tries++) {
            const outcome = await juiceOnce(line.itemId);
            if (outcome === 'gone') return resolve({ status: 'gone', ...base() });
            if (outcome !== 'landed') notes.push(`juice ${line.itemId} ${outcome} ${JSON.stringify(feed.snap?.juice ?? null)}`);
          }
        } else {
          let misses = 0;
          while (count(line.itemId) < line.qty && misses < 2) {
            if (!alive()) return resolve({ status: 'gone', ...base() });
            const before = count(line.itemId);
            feed.on.grab(line.itemId);
            const until = performance.now() + 1200;
            while (count(line.itemId) <= before && performance.now() < until && alive()) await sleep(40);
            if (count(line.itemId) <= before) {
              misses++;
              notes.push(`grab ${line.itemId} missed the tray (${before}→${count(line.itemId)}, want ${line.qty})`);
            }
          }
        }
      }
      if (!alive()) return resolve({ status: 'gone', ...base() });
      if (!sameOrder()) return resolve({ status: 'follow', ...base() });
      if (packWant && feed.snap?.pack !== packWant) {
        feed.on.pack(packWant);
        const until = performance.now() + 1000;
        while (feed.snap?.pack !== packWant && performance.now() < until && alive()) await sleep(40);
      }
      // extra quente is not a toggle: it came with the pour (into the red) above
      void coffeeMods;
      if (!alive()) return resolve({ status: 'gone', ...base() });
      if (!sameOrder()) return resolve({ status: 'follow', ...base() });
      return resolve({ status: ready() ? 'ready' : 'short', ...base() });
    };
    run().catch((err) => fail('short', { notes: [`assemble ${err?.message ?? err}`] }));
  }), {
    lines,
    mods: want.mods ?? [],
    hold: pourState.hold,
    spills: pourState.spills,
    pourHold: POUR_HOLD,
    readyAt: READY_AT,
    burnAt: BURN_MS,
    landHi: LAND_HI,
    pourFull: POUR_FULL,
    juicer: JUICER,
  });
  if (report?.pourState) pourState = report.pourState;
  for (const line of report?.notes ?? []) console.log(`  · ${line}`);
  trace('assembled', report?.status, JSON.stringify(report?.tray ?? []));
  return report;
}

export async function buildOrder(page, want, { quick = false } = {}) {
  void quick;
  trace('build', JSON.stringify(want));
  return assembleOrder(page, want);
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

/** Open a shift from the display case in the padaria (the vitrine, under the "Jogar: Padaria" sign). The first-time practice order is marked done, so this is a real shift. */
export async function startShiftFromPedido(page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    localStorage.setItem('tb_cr_practice', '1');
    window.__tb.interact({ prop: 'vitrine' });
  });
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
  const built = await assembleOrder(page, want);
  if (!built || built.status !== 'short') return built;
  log(built.reset ? `  tray incomplete → rebuild ${trayDesc(built, want)}` : `  tray short → top up ${trayDesc(built, want)}`);
  return assembleOrder(page, want);
}

/** Click Entregar and wait, in the page, until this customer is no longer waiting with the same tray. */
async function finishCustomer(page, id) {
  return page.evaluate((id) => new Promise((resolve) => {
    const feed = window.__tb?.correria?.feed;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const view = () => {
      const s = feed?.snap;
      const x = s?.customers?.find((c) => c.id === id) ?? null;
      return {
        customer: x ? { id: x.id, state: x.state, pt: x.pt, follow: x.follow ?? null, debug: x.debug ?? null, mistakes: x.mistakes ?? 0 } : null,
        tray: s?.tray ?? [],
        served: s?.stats?.served ?? 0,
        ended: !!document.querySelector('#mg-end') || !!s?.over,
      };
    };
    const run = async () => {
      const before = view();
      if (!feed?.on?.serve || before.ended || !before.customer || before.customer.state !== 'front') return { why: 'left', ...before };
      if (!before.tray.length) return { why: 'empty', ...before };
      const servedBefore = before.served;
      const mistakesBefore = before.customer.mistakes;
      feed.on.serve();
      const until = performance.now() + 4_000;
      let now = before;
      while (performance.now() < until) {
        await sleep(40);
        now = view();
        if (now.served > servedBefore) return { why: now.customer?.state === 'asking' ? 'ask' : 'served', ...now };
        if (now.customer?.state === 'front' && now.customer.mistakes > mistakesBefore) return { why: 'correct', ...now };
        if (now.ended || !now.customer || now.customer.state !== 'front') return { why: 'left', ...now };
      }
      now = view();
      if (now.served > servedBefore) return { why: now.customer?.state === 'asking' ? 'ask' : 'served', ...now };
      if (now.customer?.state === 'front' && now.customer.mistakes > mistakesBefore) return { why: 'correct', ...now };
      if (now.ended || !now.customer || now.customer.state !== 'front') return { why: 'left', ...now };
      return { why: 'stuck', ...now };
    };
    run().then(resolve);
  }), id);
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
    log(`customer ${n + 1}: “${c.pt}” →`, JSON.stringify(want.lines), want.mods.join(','));
    await dwell(n < 2 ? 1200 : 500);
    let built = await deliver(page, want, log);
    if (built?.status === 'follow' || (built?.customer?.follow && !c.follow)) {
      const cur = built.customer;
      const w2 = cur?.debug ? { lines: cur.debug.lines, mods: cur.debug.mods } : await wantOf(page, cur ?? c);
      log('  follow-up:', cur?.follow?.pt ?? '');
      if (w2?.lines?.length) built = await deliver(page, w2, log);
    }
    if (!built || built.status === 'gone') {
      log('  customer left before Entregar');
      await clearTray(page);
      continue;
    }
    if (onCustomer) await onCustomer(c, n);
    if (await page.$('#mg-end')) return n;
    let outcome = await finishCustomer(page, c.id);
    if (outcome?.why === 'correct') {
      const w2 = outcome.customer?.debug ? { lines: outcome.customer.debug.lines, mods: outcome.customer.debug.mods } : await wantOf(page, outcome.customer ?? c);
      log('  correction → rebuild', JSON.stringify(outcome.tray ?? []));
      if (w2?.lines?.length) await deliver(page, w2, log);
      outcome = await finishCustomer(page, c.id);
    }
    if (outcome?.why === 'ask') {
      if (onAsk) await onAsk();
      await answerAsk(page);
      n++;
      continue;
    }
    if (outcome?.why === 'served') {
      if (onAsk) await onAsk();
      n++;
      continue;
    }
    if (outcome?.why === 'empty') {
      log('  nothing on the tray yet');
      await clearTray(page);
      continue;
    }
    if (outcome?.why === 'left') {
      log('  customer left before Entregar');
      await clearTray(page);
      continue;
    }
    log(`  still at the counter after Entregar (${JSON.stringify(outcome?.tray ?? [])})`);
  }
  throw new Error('the shift did not end in time');
}
