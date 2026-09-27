/** Browser helpers shared by the e2e scripts: drive Me vê um… from the Portuguese ticket text alone. */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

export async function waitFor(page, fn, arg, timeout = 10_000, label = 'condition') {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 100 });
  } catch (e) {
    throw new Error(`timeout waiting for ${label}`);
  }
}

const NUM = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3 };
const PLURALS = {
  pao: 'pães', pao_na_chapa: 'pães na chapa', pastel: 'pastéis', coxinha: 'coxinhas', bolo: 'bolos', cafe: 'cafés', cafe_com_leite: 'cafés com leite',
  suco_de_laranja: 'sucos de laranja', agua: 'águas', pao_de_queijo: 'pães de queijo', misto_quente: 'mistos-quentes', guarana: 'guaranás',
};
const MG_PREP = {
  chapa: new Set(['pao_na_chapa', 'misto_quente', 'pastel', 'coxinha']),
  bebidas: new Set(['cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua', 'guarana']),
};
export const MOD_IDS = { 'pra viagem': 'pra_viagem', 'pra comer aqui': 'pra_comer_aqui', 'sem açúcar': 'sem_acucar', 'bem quente': 'bem_quente' };

/** Read the shelf labels once the panel is open, so `trayFor` can parse tickets. */
export async function learnShelf(page) {
  const forms = await page.evaluate(() => [...document.querySelectorAll('#mg-shelves button')].map((b) => ({ id: b.dataset.item, form: b.querySelector('.pt').textContent })));
  await page.evaluate((list) => (window.__tbItems = list), forms.map((f) => ({ ...f, plural: PLURALS[f.id] })));
}

/** Parse a Portuguese order back into a tray (proves the order text alone is solvable). */
export async function trayFor(page, orderText) {
  const list = (await page.evaluate(() => window.__tbItems)) ?? [];
  const tray = {};
  // Longest forms first so "pão na chapa" wins over "pão".
  const forms = list.flatMap((i) => [[i.plural, i.id], [i.form, i.id]]).sort((a, b) => b[0].length - a[0].length);
  let rest = orderText.toLowerCase();
  const re = (prefix, form) => new RegExp(`${prefix}${form.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}-])`, 'u');
  for (const [form, id] of forms) {
    let m;
    while ((m = rest.match(re('(um|uma|dois|duas|três|tres)\\s+', form)))) {
      tray[id] = (tray[id] ?? 0) + NUM[m[1]];
      rest = rest.replace(m[0], ' ');
    }
  }
  // Bare noun with no count ("Café sem açúcar, bem quente.") means one.
  for (const [form, id] of forms) {
    const m = rest.match(re('(^|[\\s,])', form));
    if (m) {
      tray[id] = (tray[id] ?? 0) + 1;
      rest = rest.replace(m[0], ' ');
    }
  }
  const mods = ['pra viagem', 'pra comer aqui', 'sem açúcar', 'bem quente'].filter((m) => orderText.toLowerCase().includes(m));
  return { tray, mods };
}

/** Ticket + Seu Carlos line, so a stalled shift says why (e.g. “repita” after a wrong tray). */
export function mgState(page) {
  return page
    .evaluate(() => {
      const t = document.querySelector('#mg-ticket');
      const carlos = document.querySelector('#minigame .carlos-says')?.textContent ?? '';
      return `ticket round ${t?.dataset.round} repeat ${t?.dataset.repeat} · ${document.querySelector('#mg-order')?.textContent ?? ''} · ${carlos}`;
    })
    .catch(() => 'minigame panel gone');
}

/** Fraction of the order bar still left (1 = full, 0 = empty). */
export function mgBar(page) {
  return page.evaluate(() => {
    const m = /scaleX\(([\d.e-]+)\)/.exec(document.querySelector('#minigame .timer > div')?.style.transform ?? '');
    return m ? Number(m[1]) : null;
  });
}

async function wipHint(page) {
  return (await page.textContent('#mg-wip')) ?? '';
}

export async function buildTrayItem(page, itemId, needsPack, coffeeMods) {
  const wipBusy = await page.locator('#mg-wip img').isVisible();
  if (!wipBusy) await page.click(`#mg-shelves [data-item="${itemId}"]`);
  const hint = await wipHint(page);
  if (MG_PREP.chapa.has(itemId) && /Chapa|Grill/.test(hint)) await page.click('#mg-station-chapa .station-go');
  if (MG_PREP.bebidas.has(itemId) && /Bebidas|Drinks|Pour/.test(hint)) {
    for (const m of coffeeMods) {
      const pressed = await page.getAttribute(`#mg-mods [data-mod="${MOD_IDS[m]}"]`, 'aria-pressed');
      if (pressed !== 'true') await page.click(`#mg-mods [data-mod="${MOD_IDS[m]}"]`);
    }
    await page.click('#mg-station-bebidas .station-go');
  }
  if (needsPack && /Embalagem|Pack/.test(await wipHint(page))) await page.click('#mg-station-pack .station-go');
  await page.click('#mg-tray-place');
}

/** Wait for the first attempt of `round` (not the “de novo, devagar” retry). */
export async function waitForTicket(page, round, timeout = 8000) {
  await waitFor(
    page,
    (n) => {
      const ticket = document.querySelector('#mg-ticket');
      return ticket?.dataset.round === String(n) && ticket.dataset.repeat !== '1';
    },
    round,
    timeout,
    `order ${round + 1}`,
  ).catch(async (e) => {
    throw new Error(`${e.message} — ${await mgState(page)}`);
  });
}

/**
 * Serve all six orders from the ticket text, then wait for the end card.
 * `onRound(round)` runs with the tray built, just before Entregar.
 */
export async function playShift(page, { log = () => {}, dwell = () => Promise.resolve(), onRound } = {}) {
  for (let round = 0; round < 6; round++) {
    await waitForTicket(page, round);
    const text = await page.textContent('#mg-order');
    const { tray, mods } = await trayFor(page, text);
    const items = Object.values(tray).reduce((a, b) => a + b, 0);
    if (!items) throw new Error(`could not parse Me vê um order: ${text}`);
    log(`order ${round + 1}: “${text}” →`, JSON.stringify(tray), mods.join(', '));
    await dwell(round < 2 ? 1400 : 700);
    const needsPack = mods.some((m) => m.startsWith('pra '));
    const coffeeMods = mods.filter((m) => m === 'sem açúcar' || m === 'bem quente');
    const whereMods = mods.filter((m) => m.startsWith('pra '));
    for (const m of whereMods) await page.click(`#mg-mods [data-mod="${MOD_IDS[m]}"]`);
    for (const [id, n] of Object.entries(tray)) for (let k = 0; k < n; k++) await buildTrayItem(page, id, needsPack, coffeeMods);
    const onTray = await page.$$eval('#mg-tray button span', (els) => els.reduce((s, e) => s + Number(e.textContent.replace('×', '')), 0));
    assert(onTray === items, `tray holds ${onTray}, order “${text}” wants ${items} (one tap placed two units?)`);
    if (onRound) await onRound(round);
    await page.click('#mg-submit');
  }
  await page.waitForSelector('#mg-end', { timeout: 20_000 }).catch(async (e) => {
    throw new Error(`${e.message} — ${await mgState(page)}`);
  });
}

/**
 * Let the first attempt of Pedido 1 run out and check Carlos re-arms it:
 * same ticket, “de novo, devagar”, a refilled bar, and a shelf + Limpar that still respond.
 */
export async function expectFirstTimeoutRearms(page, log = () => {}) {
  await waitForTicket(page, 0);
  const pt = await page.textContent('#mg-order');
  log(`Pedido 1 “${pt}” — letting the bar run out`);
  await waitFor(
    page,
    () => {
      const t = document.querySelector('#mg-ticket');
      const m = /scaleX\(([\d.e-]+)\)/.exec(document.querySelector('#minigame .timer > div')?.style.transform ?? '');
      return t?.dataset.round === '0' && t.dataset.repeat === '1' && m && Number(m[1]) > 0.95;
    },
    null,
    // Order clocks cap at 120 s.
    135_000,
    'Pedido 1 “de novo, devagar” with a refilled bar',
  ).catch(async (e) => {
    throw new Error(`${e.message} — ${await mgState(page)} · bar ${await mgBar(page)}`);
  });
  const bar = await mgBar(page);
  const again = await page.textContent('#mg-order');
  assert(again === pt, `retry repeats the same ticket (“${pt}” → “${again}”)`);
  assert(/de novo, devagar/.test((await page.textContent('#mg-ticket .customer')) ?? ''), 'ticket says “de novo, devagar”');
  const first = await page.$eval('#mg-shelves button', (b) => b.dataset.item);
  await page.click(`#mg-shelves [data-item="${first}"]`);
  await waitFor(page, () => !!document.querySelector('#mg-wip img'), null, 3000, 'shelf still grabs on the retry');
  await page.click('#mg-clear');
  await waitFor(page, () => !document.querySelector('#mg-wip img'), null, 3000, 'Limpar still clears on the retry');
  log(`Pedido 1 re-armed “de novo, devagar” · bar ${bar?.toFixed(2)} · shelf + Limpar respond`);
  return { pt, bar };
}
