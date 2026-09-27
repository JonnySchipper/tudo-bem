import { describe, expect, it } from 'vitest';
import { AUTHORED_ORDERS, MG_ITEMS, makeOrder, mulberry32, type MgOrderLine } from './meveum.js';

const NUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3 };
const MOD_PT: Record<string, string> = {
  pra_viagem: 'pra viagem',
  pra_comer_aqui: 'pra comer aqui',
  sem_acucar: 'sem açúcar',
  bem_quente: 'bem quente',
};

/** Same solver the e2e uses to turn a ticket back into a tray. */
function trayFor(orderText: string, list: { id: string; form: string; plural?: string }[]) {
  const tray: Record<string, number> = {};
  const forms = list.flatMap((i) => [[i.plural, i.id] as const, [i.form, i.id] as const]).filter((x) => x[0]).sort((a, b) => b[0]!.length - a[0]!.length);
  let rest = orderText.toLowerCase();
  const re = (prefix: string, form: string) => new RegExp(`${prefix}${form.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}-])`, 'u');
  for (const [form, id] of forms) {
    let m: RegExpMatchArray | null;
    while ((m = rest.match(re('(um|uma|dois|duas|três|tres)\\s+', form!)))) {
      tray[id!] = (tray[id!] ?? 0) + NUM[m[1]];
      rest = rest.replace(m[0], ' ');
    }
  }
  for (const [form, id] of forms) {
    const m = rest.match(re('(^|[\\s,])', form!));
    if (m) {
      tray[id!] = (tray[id!] ?? 0) + 1;
      rest = rest.replace(m[0], ' ');
    }
  }
  const mods = ['pra viagem', 'pra comer aqui', 'sem açúcar', 'bem quente'].filter((m) => orderText.toLowerCase().includes(m));
  return { tray, mods };
}

const list = MG_ITEMS.map((i) => ({ id: i.id, form: i.card.form, plural: i.card.plural }));

function expectSolvable(pt: string, lines: MgOrderLine[] | [string, number][], mods: string[]) {
  const { tray, mods: got } = trayFor(pt, list);
  const want: Record<string, number> = {};
  for (const line of lines) {
    const itemId = Array.isArray(line) ? line[0] : line.itemId;
    const qty = Array.isArray(line) ? line[1] : line.qty;
    want[itemId] = qty;
  }
  expect(tray, pt).toEqual(want);
  expect(got, pt).toEqual([...mods].map((id) => MOD_PT[id] ?? id));
}

describe('Me vê um ticket text is solvable', () => {
  it('parses every authored ticket and a sweep of generated combos', () => {
    for (const o of AUTHORED_ORDERS) expectSolvable(o.pt, o.lines, o.mods);
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed);
      for (let round = 0; round < 6; round++) {
        const o = makeOrder(rng, round, []);
        expectSolvable(o.pt, o.lines, o.mods);
      }
    }
  });
});
