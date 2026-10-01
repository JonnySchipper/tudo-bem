/**
 * "Quanto custa?" at the feira (HOWTO Phase 9): a vendor in the dialogue box. Ask the price (chips or typed, scored with the accept-list rules in
 * `feira.ts`), hear it said in words, pick a quantity, then pay from a coin and note tray. The server judges the payment (exact, change, short);
 * this file only presents what it answers. The same flow serves the stalls and the Hortifrúti corner at the banca (D12).
 */
import {
  COINS,
  FEIRA_CLOSED_NOTE,
  VENDORS,
  askChip,
  goodById,
  localizeGreeting,
  makeChange,
  moneyLabel,
  moneyPt,
  parseQty,
  priceFor,
  qtyChip,
  scoreAsk,
  sumCoins,
  totalLine,
  type Bilingual,
  type ClientMsg,
  type NpcId,
  type ServerMsg,
  type VendorId,
} from '@tudobem/shared';
import { game } from '../state';
import { clock } from '../gameClock';
import { speak } from '../audio';
import { h } from './dom';
import { closeDialogueBox, showDialogueBox, type BoxChip } from './dialogue';
import { foodIcon, type Expression } from './pixelArt';
import { noteHeard } from './heard';

export interface FeiraHooks {
  send: (m: ClientMsg) => void;
}

type FeiraMsg = Extract<ServerMsg, { t: 'feira' }>;

interface State {
  vendor: VendorId;
  phase: 'ask' | 'qty' | 'pay' | 'done';
  itemId: string | null;
  qty: number;
  tray: number[];
  line: Bilingual;
  expression: Expression;
  /** A small note under the line (the "Dica", or what is missing). */
  feedback: Bilingual | null;
  /** The last payment's receipt, once it was accepted. */
  receipt: { price: number; paid: number; change: number } | null;
  waiting: boolean;
}

let st: State | null = null;
let hooks: FeiraHooks | null = null;

export const isFeiraOpen = (): boolean => st !== null;

/** The portrait shows this NPC (the Hortifrúti corner is Tia Lu's box). */
const npcOf = (v: VendorId): NpcId => VENDORS[v].npc;

const obrigad = () => (game.profile?.pronoun === 'ela' ? 'obrigada' : 'obrigado');

function say(line: Bilingual) {
  speak(line.pt);
  noteHeard(line.pt);
}

function endNow() {
  st = null;
  closeDialogueBox();
}

function feedbackEl(b: Bilingual | null): HTMLElement | null {
  return b ? h('div', { class: 'feira-hint you-said', id: 'feira-hint' }, b.pt, h('span', { class: 'en plain' }, ` ${b.en}`)) : null;
}

/** Coins and notes as little pixel pieces: a round coin for R$ 0,50 and 1, a rectangular note above. */
function pieceButton(cents: number, onTap: () => void, label?: string): HTMLElement {
  const isNote = cents >= 200;
  return h(
    'button',
    { type: 'button', class: `feira-piece ${isNote ? 'cash-note' : 'cash-coin'} v${cents}`, 'data-cents': String(cents), 'aria-label': moneyLabel(cents), onclick: onTap },
    h('span', { class: 'amt' }, label ?? moneyLabel(cents).replace('R$ ', '')),
  );
}

function trayEl(s: State): HTMLElement {
  const total = sumCoins(s.tray);
  const price = priceFor(s.itemId, s.qty) ?? 0;
  const pieces = h(
    'div',
    { class: 'feira-pieces', id: 'feira-pieces' },
    ...COINS.map((c) =>
      pieceButton(c, () => {
        if (!st || st.waiting || st.tray.length >= 40) return;
        st.tray.push(c);
        render();
      }),
    ),
  );
  const onCounter = h(
    'div',
    { class: 'feira-counter', id: 'feira-counter' },
    s.tray.length ? s.tray.map((c) => h('span', { class: `feira-piece mini ${c >= 200 ? 'cash-note' : 'cash-coin'}`, 'aria-hidden': 'true' }, moneyLabel(c).replace('R$ ', ''))) : h('span', { class: 'feira-empty' }, 'Toque nas moedas e notas'),
  );
  return h(
    'div',
    { class: 'feira-tray', id: 'feira-tray' },
    h('div', { class: 'feira-sum' }, h('span', { class: 'lbl' }, 'Preço '), h('b', { id: 'feira-price' }, moneyLabel(price)), h('span', { class: 'lbl' }, ' · Você deu '), h('b', { id: 'feira-paid' }, moneyLabel(total))),
    onCounter,
    pieces,
    h(
      'div',
      { class: 'feira-actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'primary',
          id: 'feira-pay',
          disabled: !s.tray.length || s.waiting,
          onclick: () => {
            if (!st || !st.itemId || !st.tray.length || st.waiting) return;
            st.waiting = true;
            hooks?.send({ t: 'feira', action: 'pay', vendor: st.vendor, itemId: st.itemId, qty: st.qty, paid: [...st.tray] });
            render();
          },
        },
        'Pagar',
      ),
      h(
        'button',
        {
          type: 'button',
          id: 'feira-clear',
          disabled: !s.tray.length || s.waiting,
          onclick: () => {
            if (!st) return;
            st.tray = [];
            render();
          },
        },
        'Limpar',
      ),
    ),
  );
}

function receiptEl(s: State): HTMLElement | null {
  const r = s.receipt;
  const g = goodById(s.itemId);
  if (!r || !g) return null;
  const change = makeChange(r.change);
  return h(
    'div',
    { class: 'feira-receipt', id: 'feira-receipt' },
    foodIcon(g.itemId, 3, g.pt.one),
    h('span', { class: 'txt' }, h('b', null, moneyLabel(r.price)), r.change ? h('span', null, ` · troco ${moneyLabel(r.change)}`) : null),
    change.length ? h('span', { class: 'feira-change' }, ...change.map((c) => h('span', { class: `feira-piece mini ${c >= 200 ? 'cash-note' : 'cash-coin'}` }, moneyLabel(c).replace('R$ ', '')))) : null,
  );
}

function render() {
  if (!st) return;
  const s = st;
  const v = VENDORS[s.vendor];
  const g = goodById(s.itemId);
  let chips: BoxChip[] = [];
  let onChip: (i: number) => void = () => {};
  let input: Parameters<typeof showDialogueBox>[0]['input'] = null;
  let extras: HTMLElement | null = null;

  if (s.phase === 'ask') {
    const goods = v.goods.map((id) => goodById(id)!);
    chips = [...goods.map((x) => ({ pt: askChip(x).pt, en: askChip(x).en })), { pt: `Só estou olhando, ${obrigad()}.`, en: 'I’m just looking, thanks.' }];
    onChip = (i) => (i < goods.length ? ask(askChip(goods[i]!).pt) : endNow());
    input = { id: 'feira-input', placeholder: 'Pergunte o preço em português…', send: 'Perguntar', onSend: (text, el) => ((el.value = ''), ask(text)), disabled: s.waiting };
  } else if (s.phase === 'qty' && g) {
    const cents = (q: number) => priceFor(g.itemId, q) ?? 0;
    chips = [...g.qtys.map((q) => ({ pt: qtyChip(g, q).pt, en: `${qtyChip(g, q).en} · ${moneyLabel(cents(q))}` })), { pt: `Agora não, ${obrigad()}.`, en: 'Not now, thanks.' }];
    onChip = (i) => (i < g.qtys.length ? pickQty(g.qtys[i]!) : back('Pois não. Mais alguma coisa?', 'Sure. Anything else?'));
    input = { id: 'feira-input', placeholder: 'Quantos? Responda em português…', send: 'Responder', onSend: (text, el) => ((el.value = ''), typedQty(text)) };
  } else if (s.phase === 'pay') {
    extras = trayEl(s);
  } else if (s.phase === 'done') {
    extras = receiptEl(s);
    chips = [
      { pt: 'Quero mais uma coisa.', en: 'I want one more thing.' },
      { pt: 'Tchau, valeu!', en: 'Bye, thanks!' },
    ];
    onChip = (i) => (i === 0 ? back('Pois não! O que mais vai ser?', 'Sure! What else will it be?') : endNow());
  }

  showDialogueBox({
    key: 'feira',
    npcId: npcOf(s.vendor),
    speaker: v.name,
    role: s.vendor === 'banca' ? 'Hortifrúti' : 'Barraca da feira',
    expression: s.expression,
    line: s.line,
    feedback: feedbackEl(s.feedback),
    extras,
    chips,
    input,
    onChip,
    onClose: endNow,
    onDismiss: () => {
      st = null;
    },
  });
}

function back(pt: string, en: string) {
  if (!st) return;
  st.phase = 'ask';
  st.itemId = null;
  st.tray = [];
  st.feedback = null;
  st.receipt = null;
  st.expression = 'neutro';
  st.line = { pt, en };
  say(st.line);
  render();
}

function ask(text: string) {
  if (!st || st.waiting) return;
  const r = scoreAsk(text, VENDORS[st.vendor].goods);
  if (!r.itemId) {
    st.expression = 'surpreso';
    const eg = askChip(goodById(VENDORS[st.vendor].goods[0])!);
    st.line = { pt: `Como? Pode repetir? Pergunte: “${eg.pt}”`, en: `Sorry? Can you repeat? Ask: “${eg.pt}”` };
    st.feedback = null;
    render();
    return;
  }
  st.itemId = r.itemId;
  st.feedback = r.hint ?? null;
  st.expression = 'neutro';
  st.waiting = true;
  hooks?.send({ t: 'feira', action: 'price', vendor: st.vendor, itemId: r.itemId });
  render();
}

function typedQty(text: string) {
  const g = goodById(st?.itemId);
  if (!st || !g) return;
  const q = parseQty(text, g);
  if (q === null) {
    st.feedback = { pt: `Dica: diga “${qtyChip(g, g.qtys[0]!).pt.replace(', por favor.', '')}” ou toque numa opção.`, en: 'Tip: say how many, or tap an option.' };
    st.expression = 'surpreso';
    render();
    return;
  }
  pickQty(q);
}

function pickQty(q: number) {
  const g = goodById(st?.itemId);
  if (!st || !g) return;
  st.qty = q;
  st.phase = 'pay';
  st.tray = [];
  st.feedback = null;
  st.expression = 'neutro';
  st.line = totalLine(g.itemId, q);
  say(st.line);
  render();
}

/** Open the vendor's counter. `talked` tells the server about the greeting (the recados' `falar` and the daily bond). */
export function openFeira(vendor: VendorId, h2: FeiraHooks, opts: { talked?: (npc: NpcId) => void } = {}): void {
  hooks = h2;
  if (vendor !== 'banca') opts.talked?.(VENDORS[vendor].npc);
  // the vendor greets by the hour (Bom dia at 17:30 breaks the world)
  const greet = localizeGreeting(VENDORS[vendor].greet, clock.minutes());
  st = { vendor, phase: 'ask', itemId: null, qty: 1, tray: [], line: greet, expression: 'neutro', feedback: null, receipt: null, waiting: false };
  say(greet);
  render();
}

/** A stall that is closed: the vendor's own line, the note, and where to buy instead (D12). */
export function openFeiraClosed(vendor: VendorId): void {
  hooks = null;
  const v = VENDORS[vendor];
  st = null;
  showDialogueBox({
    key: 'feira-fechada',
    npcId: npcOf(vendor),
    speaker: v.name,
    role: 'Barraca da feira',
    expression: 'pensativo',
    line: { pt: `${v.closed.pt} ${FEIRA_CLOSED_NOTE.pt}`, en: `${v.closed.en} ${FEIRA_CLOSED_NOTE.en}` },
    chips: [{ pt: `Tá bom, ${obrigad()}!`, en: 'Okay, thanks!' }],
    onChip: () => closeDialogueBox(),
    onClose: () => closeDialogueBox(),
  });
}

/** The server's answer to `price` or `pay`. */
export function onFeiraMsg(m: FeiraMsg): void {
  if (!st) return;
  st.waiting = false;
  if (m.phase === 'price') {
    st.itemId = m.itemId;
    st.phase = 'qty';
    st.line = m.line;
    st.expression = 'neutro';
    say(m.line);
    render();
    return;
  }
  st.line = m.line;
  say(m.line);
  if (m.result === 'short') {
    st.expression = 'surpreso';
    st.feedback = null;
    render();
    return;
  }
  st.phase = 'done';
  st.expression = 'feliz';
  st.feedback = null;
  st.receipt = { price: m.price, paid: m.paid, change: m.change ?? 0 };
  render();
}

/** An error the server sent while a purchase was waiting (closed, too far): stop waiting so the box does not hang. */
export function onFeiraError(): void {
  if (!st || !st.waiting) return;
  st.waiting = false;
  render();
}

/** Spoken price for tests and the hotspot cards. */
export const spokenPrice = (cents: number): string => moneyPt(cents);
