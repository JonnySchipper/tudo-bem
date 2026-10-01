import { describe, expect, it } from 'vitest';
import {
  COINS,
  FEIRA_CLOSE_MIN,
  FEIRA_OPEN_MIN,
  GOODS,
  VENDORS,
  VENDOR_IDS,
  askChip,
  askTargets,
  feiraOpen,
  goodById,
  judgePayment,
  makeChange,
  moneyEn,
  moneyLabel,
  moneyPt,
  ownerOf,
  parsePaid,
  parseQty,
  priceFor,
  priceLine,
  priceOptions,
  qtyChip,
  qtyPt,
  resultLine,
  scoreAsk,
  sumCoins,
  totalLine,
} from './feira.js';
import { acceptAnswer } from './accept.js';
import { cardById } from './cards.js';
import { HOTSPOTS } from './hotspots.js';
import { ITEMS } from './recados.js';
import { npcName } from './recados.js';
import { ALL_NPCS, ROOMS } from './rooms.js';
import { scheduleAt, npcIsOut } from './schedules.js';
import { PRICES } from './carlos.js';
import { normalizeAnswer } from './accept.js';

describe('money in words (numbers.ts → PT)', () => {
  it('says prices the way people say them', () => {
    expect(moneyPt(50)).toBe('cinquenta centavos');
    expect(moneyPt(100)).toBe('um real');
    expect(moneyPt(200)).toBe('dois reais');
    expect(moneyPt(350)).toBe('três reais e cinquenta centavos');
    expect(moneyPt(150)).toBe('um real e cinquenta centavos');
    expect(moneyPt(1200)).toBe('doze reais');
    expect(moneyPt(2050)).toBe('vinte reais e cinquenta centavos');
    expect(moneyPt(2100)).toBe('vinte e um reais');
    expect(moneyPt(101)).toBe('um real e um centavo');
    expect(moneyPt(0)).toBe('zero reais');
  });
  it('labels and glosses them', () => {
    expect(moneyLabel(350)).toBe('R$ 3,50');
    expect(moneyLabel(1200)).toBe('R$ 12');
    expect(moneyLabel(50)).toBe('R$ 0,50');
    expect(moneyLabel(105)).toBe('R$ 1,05');
    expect(moneyEn(350)).toBe('three reais and fifty centavos');
    expect(moneyEn(100)).toBe('one real');
  });
});

describe('the tray and the change', () => {
  it('has the six pieces of the brief', () => {
    expect([...COINS]).toEqual([50, 100, 200, 500, 1000, 2000]);
  });
  it('makes change in the fewest pieces, always exactly', () => {
    expect(makeChange(350)).toEqual([200, 100, 50]);
    expect(makeChange(800)).toEqual([500, 200, 100]);
    expect(makeChange(0)).toEqual([]);
    for (let c = 0; c <= 3000; c += 50) expect(sumCoins(makeChange(c))).toBe(c);
  });
  it('judges exact, change and short', () => {
    expect(judgePayment(500, [500])).toEqual({ kind: 'exact' });
    expect(judgePayment(500, [200, 200, 100])).toEqual({ kind: 'exact' });
    expect(judgePayment(200, [500, 50])).toEqual({ kind: 'change', change: 350 });
    expect(judgePayment(300, [200, 50])).toEqual({ kind: 'short', missing: 50 });
  });
  it('the lines the vendor says', () => {
    expect(resultLine({ kind: 'exact' }, 500).pt).toBe('Pronto! Valor certinho. Obrigado!');
    expect(resultLine({ kind: 'change', change: 350 }, 550, true).pt).toBe('Aqui o seu troco: três reais e cinquenta centavos. Obrigada!');
    expect(resultLine({ kind: 'short', missing: 150 }, 350).pt).toBe('Faltam um real e cinquenta centavos.');
    expect(resultLine({ kind: 'short', missing: 200 }, 0).pt).toBe('Você ainda não pagou nada.');
  });
  it('parses a payment from the wire, refusing anything that is not tray pieces', () => {
    expect(parsePaid([500, 50])).toEqual([500, 50]);
    expect(parsePaid([])).toBeNull();
    expect(parsePaid([333])).toBeNull();
    expect(parsePaid(['50'])).toBeNull();
    expect(parsePaid(null)).toBeNull();
    expect(parsePaid(Array(41).fill(50))).toBeNull();
    expect(parsePaid(Array(40).fill(50))).toHaveLength(40);
  });
});

describe('prices (server-authoritative data)', () => {
  it('every price is a multiple of R$ 0,50, so the tray can always pay it exactly', () => {
    for (const g of GOODS) for (const q of g.qtys) {
      const c = priceFor(g.itemId, q)!;
      expect(c % 50, `${g.itemId} x${q}`).toBe(0);
      expect(c).toBeGreaterThan(0);
      const pay: number[] = [];
      let left = c;
      for (const k of [...COINS].reverse()) while (left >= k) (pay.push(k), (left -= k));
      expect(judgePayment(c, pay).kind).toBe('exact');
    }
  });
  it('Tia Lu\'s call is true: three bananas for five', () => {
    expect(priceFor('banana', 1)).toBe(200);
    expect(priceFor('banana', 3)).toBe(500);
    expect(priceFor('banana', 6)).toBe(1000);
    expect(priceFor('alface', 1)).toBe(350);
    expect(priceFor('maca', 3)).toBe(450);
  });
  it('only offered quantities and known goods have a price', () => {
    expect(priceFor('banana', 2)).toBeNull();
    expect(priceFor('banana', '3')).toBeNull();
    expect(priceFor('nope', 1)).toBeNull();
    expect(priceFor(undefined, 1)).toBeNull();
    expect(priceOptions('nope')).toEqual([]);
  });
  it('every good is a bag item with an icon key, and every vendor sells real goods', () => {
    for (const g of GOODS) expect(ITEMS.map((i) => i.id), g.itemId).toContain(g.itemId);
    for (const id of VENDOR_IDS) for (const g of VENDORS[id].goods) expect(goodById(g), `${id} sells ${g}`).toBeDefined();
    // every good is sold by somebody at a stall
    for (const g of GOODS) expect(['tia_lu', 'ze', 'chico', 'rosa'].some((v) => VENDORS[v as 'tia_lu'].goods.includes(g.itemId)), g.itemId).toBe(true);
  });
  it('the Hortifrúti corner sells produce and flowers but not hot food', () => {
    expect(VENDORS.banca.goods).not.toContain('pastel');
    expect(VENDORS.banca.goods).not.toContain('caldo_de_cana');
    for (const g of ['banana', 'laranja', 'maca', 'alface', 'tomate', 'flores']) expect(VENDORS.banca.goods).toContain(g);
  });
  it('a purchase counts as bought from the stall owner (recados say pedir tia_lu ...)', () => {
    expect(ownerOf('banana')).toBe('tia_lu');
    expect(ownerOf('flores')).toBe('tia_lu');
    expect(ownerOf('tomate')).toBe('ze');
    expect(ownerOf('pastel')).toBe('chico');
    expect(ownerOf('caldo_de_cana')).toBe('chico');
  });
  it('says the price and the total aloud in words', () => {
    expect(priceLine('banana').pt).toBe('A banana custa dois reais. Três por cinco reais!');
    expect(priceLine('alface').pt).toBe('A alface custa três reais e cinquenta centavos.');
    expect(priceLine('pastel').pt).toBe('O pastel custa seis reais.');
    expect(totalLine('banana', 3).pt).toBe('Três bananas: cinco reais.');
    expect(totalLine('alface', 2).pt).toBe('Duas alfaces: sete reais.');
    expect(totalLine('banana', 2).pt).toBe('');
    expect(qtyPt(goodById('flores')!, 1)).toBe('um buquê de flores');
    expect(qtyPt(goodById('tomate')!, 2)).toBe('dois tomates');
  });
});

describe('what the player says (accept-list rules)', () => {
  const frutas = VENDORS.tia_lu.goods;
  it('chips score 3, exactly', () => {
    for (const g of GOODS) expect(scoreAsk(askChip(g).pt, [g.itemId])).toEqual({ itemId: g.itemId, score: 3 });
  });
  it('forgives accents, case, punctuation, the article', () => {
    expect(scoreAsk('quanto custa a banana', frutas)).toEqual({ itemId: 'banana', score: 3 });
    expect(scoreAsk('QUANTO CUSTA BANANA???', frutas)).toEqual({ itemId: 'banana', score: 3 });
    expect(scoreAsk('Quanto é a maçã?', frutas)).toEqual({ itemId: 'maca', score: 3 });
    expect(scoreAsk('quanto custa a maca', frutas).itemId).toBe('maca');
    expect(scoreAsk('Qual é o preço da laranja?', frutas)).toEqual({ itemId: 'laranja', score: 3 });
  });
  it('names the item without asking: the price still comes, with a nudge', () => {
    const r = scoreAsk('uma banana, por favor', frutas);
    expect(r.itemId).toBe('banana');
    expect(r.score).toBe(2);
    expect(r.hint?.pt).toContain('Quanto custa');
  });
  it('English gets a score of 1 and the Portuguese to say; nonsense gets nothing', () => {
    expect(scoreAsk('how much is the banana?', frutas)).toMatchObject({ itemId: 'banana', score: 1 });
    expect(scoreAsk('bom dia', frutas)).toMatchObject({ itemId: null, score: 0 });
    expect(scoreAsk('', frutas).score).toBe(0);
  });
  it('only the goods this stall sells can be asked about', () => {
    expect(scoreAsk('Quanto custa o pastel?', frutas).itemId).toBeNull();
    expect(scoreAsk('Quanto custa o pastel?', VENDORS.chico.goods).itemId).toBe('pastel');
  });
  it('every ask target is accepted by acceptAnswer itself', () => {
    for (const g of GOODS) for (const t of askTargets(g)) expect(acceptAnswer(t, askChip(g).pt).match || scoreAsk(t, [g.itemId]).score === 3, t).toBe(true);
  });
  it('picks the quantity from a chip, words, digits, or a sentence', () => {
    const b = goodById('banana')!;
    expect(parseQty(qtyChip(b, 3).pt, b)).toBe(3);
    expect(parseQty('três', b)).toBe(3);
    expect(parseQty('3', b)).toBe(3);
    expect(parseQty('uma por favor', b)).toBe(1);
    expect(parseQty('me vê seis bananas', b)).toBe(6);
    expect(parseQty('nove', b)).toBeNull();
    const t = goodById('tomate')!;
    expect(parseQty('dois tomates, por favor', t)).toBe(2);
    expect(parseQty('4', t)).toBeNull();
  });
  it('the quantity chips use the curriculum lock “Me vê”, never “Give me”', () => {
    for (const g of GOODS) for (const q of g.qtys) {
      expect(qtyChip(g, q).pt).toMatch(/^Me vê /);
      expect(qtyChip(g, q).en).not.toMatch(/give me/i);
    }
  });
});

describe('hours and the vendors on the map', () => {
  it('the feira is open 06:00 to 13:00 (13:00 itself is closed)', () => {
    expect(FEIRA_OPEN_MIN).toBe(360);
    expect(FEIRA_CLOSE_MIN).toBe(780);
    expect(feiraOpen(359)).toBe(false);
    expect(feiraOpen(360)).toBe(true);
    expect(feiraOpen(779)).toBe(true);
    expect(feiraOpen(780)).toBe(false);
    expect(feiraOpen(0)).toBe(false);
    expect(feiraOpen(1440 + 400)).toBe(true);
  });
  it('the four vendors work their stalls exactly while the feira is open, and are real NPCs in the praça', () => {
    for (const id of ['tia_lu', 'ze', 'chico', 'rosa'] as const) {
      expect(ALL_NPCS.find((n) => n.id === id), id).toBeDefined();
      expect(npcName(id)).toBe(VENDORS[id].name);
      for (const m of [0, 359, 360, 500, 779, 780, 900, 1200, 1439]) {
        const s = scheduleAt(id, m)!;
        expect(s.activity === 'trabalhando', `${id} at ${m}`).toBe(feiraOpen(m));
        expect(npcIsOut(id, m) || !feiraOpen(m), `${id} at ${m}`).toBe(true);
      }
    }
    // Tia Lu rests in the praça in the afternoon, the others go home
    expect(scheduleAt('tia_lu', 14 * 60)!.activity).toBe('sentado');
    expect(scheduleAt('ze', 14 * 60)!.activity).toBe('em_casa');
  });
  it('each stall is a prop with its vendor, the vendor stands behind it and the customer spot is in front', () => {
    const stalls = ROOMS.praca.props.filter((p) => p.kind === 'feira');
    expect(stalls.map((p) => p.vendor).sort()).toEqual(['chico', 'rosa', 'tia_lu', 'ze']);
    for (const p of stalls) {
      const npc = ALL_NPCS.find((n) => n.id === VENDORS[p.vendor!].npc)!;
      expect(npc.y, p.id).toBeLessThan(p.y);
      expect(p.interact!.y, p.id).toBe(p.y + 2);
      expect(npc.interact, p.id).toEqual(p.interact);
      expect(`feira/${goodArt(p.vendor!)}`, p.id).toBe(p.art);
    }
  });
  it('the vendors call out their goods in Portuguese, each with a gloss (the same calls as their idle lines)', () => {
    for (const id of ['tia_lu', 'ze', 'chico', 'rosa'] as const) {
      const npc = ALL_NPCS.find((n) => n.id === id)!;
      expect(VENDORS[id].calls.length).toBeGreaterThanOrEqual(2);
      expect(npc.idleLines).toEqual(VENDORS[id].calls);
      for (const c of VENDORS[id].calls) expect(c.pt.length && c.en.length).toBeTruthy();
    }
    expect(VENDORS.tia_lu.calls[0]!.pt).toBe('Olha a banana! Três por cinco!');
  });
});

function goodArt(v: 'tia_lu' | 'ze' | 'chico' | 'rosa'): string {
  return { tia_lu: 'frutas', ze: 'verduras', chico: 'pastel', rosa: 'flores' }[v];
}

describe('price-tag hotspots agree with the price data', () => {
  const feiraSigns = HOTSPOTS.filter((h) => h.id.startsWith('feira_preco') || h.id === 'hortifruti_placa');
  const byName = (s: string) => GOODS.find((g) => [g.pt.one, g.itemId.replace(/_/g, ' '), g.itemId === 'flores' ? 'buquê' : ''].some((nm) => nm && normalizeAnswer(nm) === normalizeAnswer(s)));
  it('every priced line names a real good at its real price (singles, or the 3-for-5 bundle)', () => {
    let checked = 0;
    for (const h of feiraSigns) {
      for (const l of h.pt.split('\n')) {
        const m = /^(.*\S)\s+R\$\s?(\d+)(?:,(\d{2}))?$/.exec(l);
        if (!m) continue;
        const cents = Number(m[2]) * 100 + (m[3] ? Number(m[3]) : 0);
        const bundle = /^(\d+) (.*)s$/.exec(m[1]!);
        if (bundle) {
          const g = byName(bundle[2]!)!;
          expect(g, `${h.id}: ${l}`).toBeDefined();
          expect(priceFor(g.itemId, Number(bundle[1])), `${h.id}: ${l}`).toBe(cents);
        } else {
          const g = byName(m[1]!);
          expect(g, `${h.id}: ${l}`).toBeDefined();
          expect(priceFor(g!.itemId, 1), `${h.id}: ${l}`).toBe(cents);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(14);
  });
  it('each stall sign lists exactly what its vendor sells (flores as the buquê)', () => {
    const listed = (id: string) =>
      HOTSPOTS.find((h) => h.id === id)!
        .pt.split('\n')
        .flatMap((l) => {
          const m = /^(?:\d+ )?(.*\S)\s+R\$/.exec(l);
          return m ? [normalizeAnswer(m[1]!)] : [];
        });
    expect(new Set(listed('feira_preco_verduras'))).toEqual(new Set(['alface', 'tomate']));
    expect(listed('feira_preco_pastel')).toEqual(['pastel', 'caldo de cana']);
    expect(new Set(listed('hortifruti_placa'))).toEqual(new Set(['banana', 'laranja', 'maca', 'alface', 'tomate', 'flores']));
    expect(new Set(listed('feira_preco_frutas'))).toEqual(new Set(['banana', 'bananas', 'laranja', 'maca', 'flores']));
  });
  it('the pastel sign teaches an existing card and the banca headline says the real hours', () => {
    expect(HOTSPOTS.find((h) => h.id === 'feira_preco_pastel')!.cards).toEqual(['lex.padaria.pastel']);
    expect(cardById('lex.padaria.pastel')).toBeDefined();
    expect(HOTSPOTS.find((h) => h.id === 'feira_livre')!.pt).toContain('6h às 13h');
    expect(HOTSPOTS.some((h) => /em breve/i.test(h.pt))).toBe(false);
    // the padaria's own pastel price is different from the feira's on purpose (R$ 8 vs R$ 6): two shops, two prices
    expect(PRICES.pastel).toBe(8);
    expect(priceFor('pastel', 1)).toBe(600);
  });
});
