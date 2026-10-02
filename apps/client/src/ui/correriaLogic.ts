/**
 * Pure view-model of the "Correria no Balcão" overlay (no DOM, no Phaser): what the order mirror, the tray chips, the HUD, the "Quanto é?"
 * card and the end card say, and which sounds and cues a server event causes. `ui/correria.ts` only draws what these return.
 */
import {
  LEVELS,
  UNLOCKS,
  mgItemById,
  mgModById,
  moneyLabel,
  moneyPt,
  numberPt,
  type Bilingual,
  type CEvent,
  type CorreriaEnd,
  type CorreriaSnap,
  type CustomerView,
} from '@tudobem/shared';
import type { CorreriaSfx } from '../audio/correriaSfx';

/** English glosses are locked on at Verde, otherwise the learner's own preference. */
export const glossOn = (level: number, pref: boolean): boolean => !!LEVELS[Math.min(LEVELS.length - 1, Math.max(0, level))]?.glossLocked || pref;

export const frontOf = (snap: CorreriaSnap): CustomerView | undefined => snap.customers.find((c) => c.state === 'front' || c.state === 'asking');

export interface TrayChip {
  id: string;
  pt: string;
  en: string;
  qty: number;
}

/** The tray as chips in the order the items were put on, "2 x pão na chapa". */
export function trayChips(tray: readonly string[]): TrayChip[] {
  const out: TrayChip[] = [];
  for (const id of tray) {
    const found = out.find((c) => c.id === id);
    if (found) found.qty++;
    else {
      const it = mgItemById(id);
      out.push({ id, pt: it?.card.form ?? id, en: it?.card.gloss_en ?? id, qty: 1 });
    }
  }
  return out;
}

/** The mods on the tray: the ones tapped (coffee) plus the bag / plate. */
export function modChips(snap: Pick<CorreriaSnap, 'mods' | 'pack'>): Bilingual[] {
  const ids = [...snap.mods, ...(snap.pack === 'bag' ? ['pra_viagem'] : snap.pack === 'plate' ? ['pra_comer_aqui'] : [])];
  return ids.flatMap((id) => {
    const m = mgModById(id);
    return m ? [{ pt: m.pt, en: m.en }] : [];
  });
}

export interface OrderMirror {
  who: string;
  /** What to show for the order; a listening order hides the words until the customer has been served. */
  pt: string;
  en: string;
  hidden: boolean;
  /** The follow-up or change of mind said after the order, if any. */
  follow: Bilingual | null;
  canReplay: boolean;
  replayCost: number;
}

export function orderMirror(c: CustomerView | undefined, level: number): OrderMirror | null {
  if (!c || c.state === 'queue' || c.state === 'walk') return null;
  const lv = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, level))]!;
  // a listening order stays words-free until it is served (then the customer is asking for the total, and the words come back)
  const hidden = c.mode === 'listening' && c.state === 'front';
  return { who: c.who.name, pt: hidden ? 'Escute o pedido…' : c.pt, en: hidden ? 'Listen to the order…' : c.en, hidden, follow: c.follow, canReplay: hidden && c.state === 'front', replayCost: Math.round(lv.replayCost * 100) };
}

/** Patience left (0..1) of a customer `ageMs` after the snapshot. */
export function patienceFrac(c: Pick<CustomerView, 'patience' | 'patienceMax' | 'rate'>, ageMs: number): number {
  return c.patienceMax ? Math.max(0, Math.min(1, (c.patience - c.rate * ageMs) / c.patienceMax)) : 0;
}

export interface Hud {
  wave: string;
  waveEn: string;
  left: string;
  points: number;
  combo: number;
  tips: string;
  level: string;
}

export function hud(snap: CorreriaSnap): Hud {
  const lv = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, snap.level))]!;
  const done = snap.stats.served + snap.stats.left;
  return {
    wave: `Onda ${snap.wave + 1}/${snap.waves}`,
    waveEn: `Wave ${snap.wave + 1}/${snap.waves}`,
    left: `${done}/${snap.total}`,
    points: snap.stats.points,
    combo: snap.stats.combo,
    tips: moneyLabel(snap.stats.tips * 100),
    level: lv.pt,
  };
}

export interface AskCard {
  title: Bilingual;
  items: { pt: string; qty: number; price: string }[];
  type: 'choice' | 'type';
  options: { value: number; pt: string; label: string }[];
  /** seconds left */
  secs: number;
}

export function askCard(c: CustomerView, ageMs: number): AskCard | null {
  const a = c.ask;
  if (!a) return null;
  return {
    title: { pt: 'Quanto é?', en: 'How much is it?' },
    items: a.items.map((i) => ({ pt: mgItemById(i.itemId)?.card.form ?? i.itemId, qty: i.qty, price: moneyLabel(i.price * 100) })),
    type: a.type,
    options: a.options.map((n) => ({ value: n, pt: moneyPt(n * 100), label: moneyLabel(n * 100) })),
    secs: Math.max(0, Math.ceil((a.ms - ageMs) / 1000)),
  };
}

/** The sound and the one-line toast a server event causes. */
export function cueFor(e: CEvent): { sfx?: CorreriaSfx; toast?: Bilingual & { tone: 'good' | 'bad' | 'info' } } {
  switch (e.k) {
    case 'grab':
      return { sfx: 'grab' };
    case 'chapa_put':
      return { sfx: 'sizzle' };
    case 'chapa_ok':
      return { sfx: 'grab' };
    case 'chapa_raw':
      return { sfx: 'nope', toast: { pt: 'Ainda está cru!', en: 'Still raw!', tone: 'info' } };
    case 'chapa_burnt':
      return { sfx: 'burnt', toast: { pt: 'Queimou!', en: 'It burned!', tone: 'bad' } };
    case 'chapa_trash':
      return { sfx: 'nope' };
    case 'pour_start':
      return { sfx: 'pour' };
    case 'pour_ok':
      return { sfx: 'ready' };
    case 'pour_bad':
      return { sfx: 'nope', toast: e.why === 'short' ? { pt: 'Faltou café!', en: 'Not enough coffee!', tone: 'info' } : { pt: 'Derramou!', en: 'Spilled!', tone: 'bad' } };
    case 'pack':
      return { sfx: 'paper' };
    case 'serve':
      return { sfx: e.combo >= 3 ? 'combo' : 'ding', toast: { ...e.line, tone: 'good' } };
    case 'correct':
      return { sfx: 'nope', toast: { ...e.line, tone: 'bad' } };
    case 'leave':
      return { sfx: 'nope', toast: { ...e.line, tone: 'bad' } };
    case 'ask_result':
      return { sfx: e.ok ? 'cash' : 'nope', toast: { ...e.line, tone: e.ok ? 'good' : 'info' } };
    case 'ask':
      return { sfx: 'tick' as CorreriaSfx };
    case 'arrive':
      return { sfx: 'chime' };
    case 'wave':
      return { sfx: 'chime', toast: { ...e.line, tone: 'info' } };
    case 'cheer':
      return { sfx: 'clink' };
    case 'no':
      return { sfx: 'nope', toast: { ...e.line, tone: 'info' } };
    default:
      return {};
  }
}

export interface EndModel {
  big: string;
  stars: string;
  rows: { label: Bilingual; value: string }[];
  words: Bilingual[];
  unlocks: Bilingual[];
  note: Bilingual | null;
}

export function endModel(end: CorreriaEnd, carlos: Bilingual): EndModel {
  const rows: EndModel['rows'] = [
    { label: { pt: 'Clientes atendidos', en: 'Customers served' }, value: `${end.served}/${end.served + end.left}` },
    { label: { pt: 'Pedidos perfeitos', en: 'Perfect orders' }, value: String(end.perfect) },
    { label: { pt: 'Melhor combo', en: 'Best combo' }, value: `x${end.bestCombo}` },
    { label: { pt: 'Gorjetas', en: 'Tips' }, value: moneyLabel(end.tips * 100) },
  ];
  if (end.askTotal) rows.push({ label: { pt: '“Quanto é?” certos', en: '“How much?” right' }, value: `${end.askRight}/${end.askTotal}` });
  return {
    big: end.coins > 0 ? `+${end.coins} RV` : '0 RV',
    stars: '★'.repeat(end.stars) + '☆'.repeat(3 - end.stars),
    rows,
    words: end.words,
    unlocks: end.newUnlocks.map((u) => ({ pt: UNLOCKS.find((x) => x.id === u.id)?.hint.pt ?? u.pt, en: UNLOCKS.find((x) => x.id === u.id)?.hint.en ?? u.en })),
    note: carlos,
  };
}

/** What the baker says, spoken, for a cheer event. */
export const cheerLine = (e: Extract<CEvent, { k: 'cheer' }>): Bilingual => e.line;

/** "doze reais" for the spoken total. */
export const sayTotal = (n: number): string => `${numberPt(n)} reais`;
