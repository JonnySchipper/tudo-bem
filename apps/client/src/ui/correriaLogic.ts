/**
 * Pure view-model of the "Correria no Balcão" overlay (no DOM, no Phaser): what the order line, the tray chips, the HUD and the end card
 * say, and which sounds and cues a server event causes. `ui/correria.ts` only draws what these return.
 */
import {
  EXTRA_QUENTE,
  HOT_MOD,
  LEVELS,
  UNLOCKS,
  mgItemById,
  modWords,
  moneyLabel,
  replayPatiencePips,
  type Bilingual,
  type CEvent,
  type CorreriaEnd,
  type CorreriaSnap,
  type CustomerView,
  type MenuLadderView,
} from '@tudobem/shared';
import type { CorreriaSfx } from '../audio/correriaSfx';

/** English glosses are locked on at Verde, otherwise the learner's own preference. */
export const glossOn = (level: number, pref: boolean): boolean => !!LEVELS[Math.min(LEVELS.length - 1, Math.max(0, level))]?.glossLocked || pref;

export const frontOf = (snap: CorreriaSnap): CustomerView | undefined => snap.customers.find((c) => c.state === 'front');

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

/** The mods on the tray: an extra-hot pour (🔥 extra quente) plus the bag / plate. */
export function modChips(snap: Pick<CorreriaSnap, 'mods' | 'pack'>): Bilingual[] {
  const ids = [...snap.mods, ...(snap.pack === 'bag' ? ['pra_viagem'] : snap.pack === 'plate' ? ['pra_comer_aqui'] : [])];
  return ids.flatMap((id) => {
    const m = modWords(id);
    return m ? [{ pt: id === HOT_MOD ? `🔥 ${m.pt}` : m.pt, en: m.en }] : [];
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
  /** Next replay patience cost in pips, or 0 when further taps are ignored. */
  replayPips: number;
  /** The coffee is wanted extra quente: a 🔥 tag on the ticket (written orders only; a listening order keeps it in the voice). */
  hot: Bilingual | null;
}

export function orderMirror(c: CustomerView | undefined, level: number): OrderMirror | null {
  if (!c || c.state === 'queue' || c.state === 'walk') return null;
  void level;
  // listening: hide words until a replay reveals them (replay also replays audio)
  const hidden = c.mode === 'listening' && c.state === 'front' && c.replays === 0;
  const nextPips = c.mode === 'listening' ? replayPatiencePips(c.replays) : null;
  return {
    who: c.who.name,
    pt: hidden ? 'Escute o pedido…' : c.pt,
    en: hidden ? 'Listen to the order…' : c.en,
    hidden,
    follow: c.follow,
    canReplay: c.mode === 'listening' && c.state === 'front',
    replayPips: nextPips ?? 0,
    hot: c.hot && !hidden ? { pt: `🔥 ${EXTRA_QUENTE.pt}`, en: EXTRA_QUENTE.en } : null,
  };
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
      return { sfx: 'pop', toast: { pt: 'Queimou!', en: 'It burned!', tone: 'bad' } };
    case 'chapa_trash':
      return { sfx: 'nope' };
    case 'pour_start':
      return { sfx: 'glug' };
    case 'pour_ok':
      return e.hot ? { sfx: 'ready', toast: { pt: `🔥 Café ${EXTRA_QUENTE.pt}!`, en: 'Extra-hot coffee!', tone: 'good' } } : { sfx: 'ready' };
    case 'pour_bad':
      return { sfx: 'nope', toast: e.why === 'short' ? { pt: 'Faltou café!', en: 'Not enough coffee!', tone: 'info' } : { pt: 'Derramou!', en: 'Spilled!', tone: 'bad' } };
    case 'juice_drop':
      return { sfx: 'juicer' };
    case 'juice_ok':
      return { sfx: 'ready' };
    case 'juice_bad':
      return { sfx: e.why === 'spill' ? 'glug' : 'nope', toast: e.why === 'short' ? { pt: 'Faltou suco! Pare na linha.', en: 'Not enough juice! Stop at the line.', tone: 'info' } : { pt: 'Transbordou!', en: 'It overflowed!', tone: 'bad' } };
    case 'pack':
      return { sfx: 'paper' };
    case 'serve':
      return {
        sfx: e.outcome === 'perfeito' && e.combo >= 3 ? (e.combo === 3 ? 'chain' : 'combo') : 'ding',
        toast: { ...e.line, tone: 'good' },
      };
    case 'correct':
      return { sfx: 'nope', toast: { ...e.line, tone: 'bad' } };
    case 'front':
      return { sfx: 'slap' };
    case 'replay':
      return { sfx: 'slap' };
    case 'replay_deny':
      return { sfx: 'sigh', toast: { ...e.line, tone: 'info' } };
    case 'leave':
      return { sfx: 'nope', toast: { ...e.line, tone: 'bad' } };
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

/** The one "next" line of the end card: a counter unlock just earned (gold), the item the next shift opens (gold), or the countdown to the next item. */
export interface EndNext extends Bilingual {
  tone: 'new' | 'plain';
}

export interface EndModel {
  big: string;
  stars: string;
  words: Bilingual[];
  next: EndNext | null;
  note: Bilingual | null;
}

/** What the next shift brings, in one line. A new unlock leads (its hint), then the item that opens next shift, then the countdown or the full-menu line. */
export function endNext(end: Pick<CorreriaEnd, 'newUnlocks' | 'ladder'>): EndNext | null {
  const u = end.newUnlocks[0];
  if (u) {
    const def = UNLOCKS.find((x) => x.id === u.id);
    return { pt: def?.hint.pt ?? u.pt, en: def?.hint.en ?? u.en, tone: 'new' };
  }
  const { fresh, next } = ladderEnd(end.ladder);
  if (fresh) return { ...fresh, tone: 'new' };
  return next ? { ...next, tone: 'plain' } : null;
}

export function endModel(end: CorreriaEnd, carlos: Bilingual): EndModel {
  return {
    big: end.coins > 0 ? `+${end.coins} RV` : '0 RV',
    stars: '★'.repeat(end.stars) + '☆'.repeat(3 - end.stars),
    words: end.words,
    next: endNext(end),
    note: carlos,
  };
}

/** The line about the next item, "Próximo: água em 2 turnos", or the full-menu line. Null without a ladder. */
export function ladderNext(l: MenuLadderView | undefined): Bilingual | null {
  if (!l) return null;
  if (!l.next) return { pt: `Cardápio completo: ${l.open.length} de ${l.total} itens!`, en: `Full menu: ${l.open.length} of ${l.total} items!` };
  const it = mgItemById(l.next)?.card;
  const pt = it?.form ?? l.next;
  const en = it?.gloss_en ?? l.next;
  return {
    pt: `Próximo: ${pt} em ${l.nextIn} ${l.nextIn === 1 ? 'turno' : 'turnos'}`,
    en: `Next: ${en} in ${l.nextIn} ${l.nextIn === 1 ? 'shift' : 'shifts'}`,
  };
}

/** End card: what the next shift brings. Items that open next time lead ("Próximo turno: água no cardápio!"), else the countdown. */
export function ladderEnd(l: MenuLadderView | undefined): { fresh: Bilingual | null; next: Bilingual | null } {
  if (!l) return { fresh: null, next: null };
  const names = l.fresh.map((id) => mgItemById(id)?.card).filter((c) => !!c);
  const fresh = names.length
    ? { pt: `Próximo turno: ${names.map((c) => c.form).join(' e ')} no cardápio!`, en: `Next shift: ${names.map((c) => c.gloss_en).join(' and ')} on the menu!` }
    : null;
  return { fresh, next: ladderNext(l) };
}

/** What the baker says, spoken, for a cheer event. */
export const cheerLine = (e: Extract<CEvent, { k: 'cheer' }>): Bilingual => e.line;
