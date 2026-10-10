/**
 * Teach by doing (no DOM): the coach marks of "Correria no Balcão". One short hint, pinned next to the thing to tap, for each action the
 * player has never done: the coffee machine, the green "Agora!", the red "extra quente", each shelf item, the chapa, the juicer, the bag or
 * the plate, Entregar. A hint goes away for good once its action is done (`coachDone`); the practice order and every real shift share the
 * one list of what was learnt, so a new player meets each hint once. needs_br: true on every Portuguese line here.
 */
import { CAFE_ITEMS, CHAPA_ITEMS, JUICE, SUCO_ITEMS, chapaPhase, mgItemByIdAny, type Bilingual, type CEvent, type CorreriaSnap } from '@tudobem/shared';

export interface CoachMark extends Bilingual {
  /** What is being taught (stored once done). */
  key: string;
  /** The element id it points at (a counter tap target or a strip button). */
  target: string;
}

const mark = (key: string, target: string, pt: string, en: string): CoachMark => ({ key, target, pt, en });

/** The extra-hot hint, at the machine (from the first tap of a hot order until a hot pour lands). */
const HOT = (): CoachMark => mark('hot', 'cr-machine', 'Extra quente 🔥: passe do verde, toque no vermelho', 'Extra hot: go past the green, tap in the red');

/** The hint to show now, or null: the front customer's next untaught step, in the order the tray is built. */
export function coachMark(snap: Pick<CorreriaSnap, 'customers' | 'tray' | 'pour' | 'juice' | 'chapa' | 'pack' | 'pourMs' | 'menu'>, seen: ReadonlySet<string>, pouring = false): CoachMark | null {
  const f = snap.customers.find((c) => c.state === 'front');
  if (!f) return null;
  if (f.mode === 'listening' && f.replays === 0 && !seen.has('listen')) return mark('listen', 'cr-replay', 'Escute o pedido 🔊', 'Listen to the order');
  // a pour is running: wait for the green (or, for an extra-hot order, the red)
  if (snap.pour || pouring) {
    if (f.hot && !seen.has('hot')) return HOT();
    if (!f.hot && !seen.has('agora')) return mark('agora', 'cr-machine', 'Toque de novo no verde: Agora!', 'Tap again on the green: now!');
    return null;
  }
  // something is ready to take off a station
  if (snap.juice && snap.juice.fill >= JUICE.goodMin && !seen.has('suco_take')) return mark('suco_take', 'cr-juice-glass', 'Na linha! Toque no copo', 'At the line! Tap the glass');
  const ready = snap.chapa.findIndex((s) => s && chapaPhase(s.age) === 'ready');
  if (ready >= 0 && !seen.has('chapa_take')) return mark('chapa_take', `cr-grill-${ready}`, 'Dourou! Toque pra tirar', 'Golden! Tap to take it off');
  const want = f.want;
  if (!want) return null;
  const have = (id: string) => snap.tray.includes(id);
  for (const id of want.items) {
    if (have(id)) continue;
    if (CAFE_ITEMS.includes(id)) {
      if (!seen.has('cafe')) return mark('cafe', 'cr-machine', 'Toque na cafeteira', 'Tap the coffee machine');
      if (f.hot && !seen.has('hot')) return HOT();
      continue;
    }
    if (SUCO_ITEMS.includes(id)) {
      if (!snap.juice && !seen.has('suco')) return mark('suco', 'cr-juicer', 'Uma laranja por toque', 'One orange per tap');
      continue;
    }
    const card = mgItemByIdAny(id)?.card;
    const the = (card?.gender ?? 'm') === 'f' ? 'a' : 'o';
    if (CHAPA_ITEMS.includes(id)) {
      if (snap.chapa.some((s) => s?.item === id)) continue;
      if (!seen.has('chapa')) return mark('chapa', `cr-item-${id}`, 'Toque aqui: vai pra chapa', 'Tap here: it goes on the grill');
      continue;
    }
    const key = `item:${id}`;
    if (!seen.has(key)) return mark(key, `cr-item-${id}`, `Pegue ${the} ${card?.form ?? id}`, `Take the ${card?.gloss_en ?? id}`);
  }
  // packing, once the orders say pra viagem / pra comer aqui
  const where = want.mods.find((m) => m === 'pra_viagem' || m === 'pra_comer_aqui');
  const packed = where === 'pra_viagem' ? snap.pack === 'bag' : where === 'pra_comer_aqui' ? snap.pack === 'plate' : true;
  if (where && !packed && !seen.has('pack'))
    return where === 'pra_viagem' ? mark('pack', 'cr-bag', 'Pra viagem: a sacola', 'To go: the bag') : mark('pack', 'cr-plate', 'Pra comer aqui: o prato', 'For here: the plate');
  if (want.items.every(have) && packed && !seen.has('serve')) return mark('serve', 'cr-serve', 'Tudo pronto? Entregar 🔔', 'All set? Serve');
  return null;
}

/** What an event shows the player has learnt (the hints that never come back). */
export function coachDone(e: CEvent): string[] {
  switch (e.k) {
    case 'pour_start':
      return ['cafe'];
    case 'pour_ok':
      return e.hot ? ['agora', 'hot'] : ['agora'];
    case 'grab':
      return [`item:${e.item}`];
    case 'chapa_put':
      return ['chapa'];
    case 'chapa_ok':
      return ['chapa_take'];
    case 'juice_drop':
      return ['suco'];
    case 'juice_ok':
      return ['suco_take'];
    case 'pack':
      return e.kind ? ['pack'] : [];
    case 'serve':
      return ['serve'];
    case 'replay':
      return ['listen'];
    default:
      return [];
  }
}

/** Where the learnt hints are kept (per browser, like the practice flag). */
export const COACH_KEY = 'tb_cr_coach_v1';
export function readCoach(raw: string | null): Set<string> {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 64) : []);
  } catch {
    return new Set();
  }
}

/** Done once: a player who finished (or skipped) the practice, or already played a shift, goes straight to a real one. */
export const PRACTICE_KEY = 'tb_cr_practice';
export function practiceNeeded(stored: string | null, playedShift: boolean): boolean {
  return stored !== '1' && !playedShift;
}

/** The practice is over: one line, then the real shift. */
export const PRACTICE_DONE: Bilingual = { pt: 'Boa! 🎉 Agora é pra valer.', en: 'Nice! Now for real.' };
