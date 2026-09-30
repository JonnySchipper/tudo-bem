/**
 * The in-world dialogue box (HOWTO Phase 7 step 1). One bottom-anchored box that presents whatever conversation is running (Seu Carlos'
 * Pedido rápido scene, Conversa, Júlia's and Nanda's lines, the parrot perch) without changing any protocol: the callers keep their own
 * state and just describe the current beat with a `BoxSpec`. The world stays visible and keeps moving behind it; the camera eases one
 * zoom step in (the host does that), and `game.modalOpen` stops the player from walking.
 *
 * The old modal presentation stays behind `?dialogue=modal` for one release (`dialogueMode()`); callers branch on it.
 */
import { game } from '../state';
import { h, ui } from './dom';
import { speak } from '../audio';
import { reducedMotion } from '../render/pixel/perf';
import { npcPortrait, parrotPortrait, type Expression } from './pixelArt';
import { Typewriter, dialogueKeyAction, npcTagColor, readShowEnglish, writeShowEnglish } from './dialogueLogic';
import { noteHeard } from './heard';
import { modalId } from './modal';

export type DialogueMode = 'box' | 'modal';

/** `?dialogue=modal` keeps the old centred modals for one release. */
export const dialogueMode = (): DialogueMode => (new URLSearchParams(location.search).get('dialogue') === 'modal' ? 'modal' : 'box');

export interface BoxChip {
  pt: string;
  en?: string;
}

export interface BoxSpec {
  /** `data-dialogue` and the `dbx-<key>` class: conversa, pedido, talk-nanda, ... */
  key: string;
  npcId: string | null;
  speaker: string;
  role?: string | null;
  expression: Expression;
  /** The NPC's line: typed out at 45 chars/s, the EN gloss behind the toggle. */
  line: { pt: string; en?: string } | null;
  /** The NPC is thinking (an AI turn is on its way): a pulsing "…" instead of the line. */
  thinking?: boolean;
  /** What the player said last ("Você: …"). */
  said?: string | null;
  feedback?: HTMLElement | null;
  /** Small text next to the name (turn counter, subject). */
  meta?: string | null;
  notes?: (HTMLElement | null)[];
  /** Ticket, conta, banners: anything that sits between the line and the replies. */
  extras?: HTMLElement | null;
  chips: BoxChip[];
  input?: { id: string; placeholder: string; send: string; onSend: (text: string, el: HTMLInputElement) => void; disabled?: boolean } | null;
  footer?: HTMLElement | null;
  onChip?: (index: number) => void;
  /** The player asked to leave (✕, Esc). */
  onClose: () => void;
  /** The box went away (for any reason, including another module closing it): drop state that lived with it. Must be idempotent. */
  onDismiss?: () => void;
}

/** The camera side of the box: implemented in main.ts over the world view. */
export interface DialogueHost {
  open(npcId: string | null): void;
  close(): void;
  /** Height of the box in CSS px, so the camera keeps the two speakers above it. */
  inset(px: number): void;
}

let host: DialogueHost | null = null;
export function setDialogueHost(h: DialogueHost | null): void {
  host = h;
}

let root: HTMLElement | null = null;
let spec: BoxSpec | null = null;
let showEn = readShowEnglish();
const tw = new Typewriter();
let lastKey = '';
let lastLine = '';
let lastNpc: string | null | undefined;
let raf = 0;
let ro: ResizeObserver | null = null;
let typedEl: HTMLElement | null = null;
let restEl: HTMLElement | null = null;

export const isDialogueBoxOpen = (): boolean => root !== null;
/** The key of the conversation currently in the box (`conversa`, `pedido`, `talk-nanda`...), or null. */
export const dialogueBoxKey = (): string | null => (root ? spec?.key ?? null : null);

const noType = () => new URLSearchParams(location.search).has('notype');
const coarse = () => {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

function tick() {
  raf = 0;
  if (!root || !typedEl || !restEl) return;
  const now = performance.now();
  const n = tw.visibleCount(now);
  const chars = Array.from(tw.text);
  typedEl.textContent = chars.slice(0, n).join('');
  restEl.textContent = chars.slice(n).join('');
  if (n < chars.length) raf = requestAnimationFrame(tick);
}

function skip() {
  tw.finish();
  if (!raf) tick();
}

function onKey(e: KeyboardEvent) {
  if (!root || !spec) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  const inInput = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA';
  const a = dialogueKeyAction(e.key, { chips: spec.chips.length, typing: !tw.isDone(performance.now()), inInput });
  if (!a) return;
  e.preventDefault();
  if (a.kind === 'close') spec.onClose();
  else if (a.kind === 'skip') skip();
  else spec.onChip?.(a.index);
}

function buildPortrait(s: BoxSpec): HTMLElement {
  const cls = 'dbx-portrait';
  return s.npcId ? npcPortrait(s.npcId, s.thinking ? 'pensativo' : s.expression, cls) : parrotPortrait(cls);
}

function build(s: BoxSpec): HTMLElement[] {
  const listenText = s.line?.pt ?? '';
  const head = h(
    'div',
    { class: 'dbx-head' },
    h('span', { class: 'dbx-name npc-name', style: `--tag:${npcTagColor(s.npcId)}` }, s.speaker),
    s.role ? h('small', { class: 'dbx-role' }, s.role) : null,
    s.meta ? h('small', { class: 'dbx-meta' }, s.meta) : null,
    h('span', { class: 'spacer' }),
    listenText
      ? h(
          'button',
          {
            class: 'speak-btn dbx-listen',
            title: 'Ouvir / Listen',
            onclick: () => {
              speak(listenText, { force: true });
              noteHeard(listenText);
            },
          },
          '🔊 Ouvir',
        )
      : null,
    h(
      'button',
      {
        class: 'dbx-en-toggle',
        id: 'dbx-en-toggle',
        role: 'switch',
        'aria-checked': String(showEn),
        title: 'Mostrar inglês / Show English',
        onclick: (e: Event) => {
          showEn = !showEn;
          writeShowEnglish(showEn);
          root?.classList.toggle('dbx-noen', !showEn);
          (e.currentTarget as HTMLElement).setAttribute('aria-checked', String(showEn));
        },
      },
      h('span', { class: 'sw' }),
      'Mostrar inglês',
    ),
    h('button', { class: 'dbx-close ghost', onclick: () => s.onClose(), 'aria-label': 'Fechar', title: 'Fechar (Esc)' }, '✕'),
  );

  typedEl = h('span', { class: 'tw-shown' });
  restEl = h('span', { class: 'tw-rest', 'aria-hidden': 'true' });
  const line = s.thinking
    ? h('div', { class: 'line-bubble thinking' }, h('span', { class: 'pt dots', 'aria-label': 'Seu Carlos está pensando' }, h('i'), h('i'), h('i')))
    : s.line
      ? h(
          'div',
          { class: 'line-bubble', title: 'Clique para completar', onclick: skip },
          h('span', { class: 'pt', lang: 'pt-BR', 'aria-label': s.line.pt }, typedEl, restEl),
        )
      : null;

  const chips = s.chips.slice(0, 6).map((c, i) =>
    h(
      'button',
      { class: 'dbx-chip', onclick: () => s.onChip?.(i), 'data-chip': String(i) },
      h('span', { class: 'num' }, String(i + 1)),
      h('span', { class: 'txt' }, h('span', { class: 'pt' }, c.pt), c.en ? h('span', { class: 'en plain' }, c.en) : null),
    ),
  );

  const input = s.input;
  let inputRow: HTMLElement | null = null;
  if (input) {
    const el = h('input', { type: 'text', maxLength: 140, placeholder: input.placeholder, 'aria-label': 'Sua resposta', id: input.id, autocomplete: 'off', disabled: !!input.disabled }) as HTMLInputElement;
    const send = () => {
      const v = el.value.trim();
      if (v) input.onSend(v, el);
    };
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') send();
      else if (e.key === 'Escape') s.onClose();
    });
    inputRow = h('div', { class: 'dbx-input' }, el, h('button', { class: 'primary', id: `${input.id}-send`, onclick: send, disabled: !!input.disabled }, input.send));
  }

  const main = h(
    'div',
    { class: 'dbx-body' },
    head,
    ...(s.notes ?? []),
    s.said ? h('div', { class: 'dbx-said you-said' }, `Você: “${s.said}”`) : null,
    s.feedback ?? null,
    line,
    s.line?.en && !s.thinking ? h('div', { class: 'dbx-en en plain' }, s.line.en) : null,
  );
  const below = h('div', { class: 'dbx-below' }, s.extras ? h('div', { class: 'dbx-extras' }, s.extras) : null, chips.length ? h('div', { class: 'dbx-chips reply-chips' }, ...chips) : null, inputRow, s.footer ? h('div', { class: 'dbx-footer' }, s.footer) : null);
  return [h('div', { class: 'dbx-side' }, buildPortrait(s)), main, below];
}

/** Show (or update in place) the dialogue box. The line only types out again when it changes. */
export function showDialogueBox(s: BoxSpec): void {
  const wasOpen = !!root;
  spec = s;
  if (!root) {
    root = h('div', { id: 'dialogue-box', class: 'dbx', role: 'dialog' });
    ui().append(root);
    document.addEventListener('keydown', onKey);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => root && host?.inset(root.offsetHeight));
      ro.observe(root);
    }
  }
  root.className = `dbx dbx-${s.key}${showEn ? '' : ' dbx-noen'}${s.thinking ? ' dbx-thinking' : ''}`;
  root.dataset.dialogue = s.key;
  root.setAttribute('aria-label', s.speaker);

  const text = s.line?.pt ?? '';
  const keyChanged = s.key !== lastKey;
  if (keyChanged || text !== lastLine) {
    tw.start(text, performance.now(), reducedMotion() || noType());
    lastKey = s.key;
    lastLine = text;
  }
  const active = document.activeElement as HTMLElement | null;
  const hadFocus = active?.tagName === 'INPUT' && root.contains(active);
  const typedValue = hadFocus ? (active as HTMLInputElement).value : '';
  root.replaceChildren(...build(s));
  if (hadFocus && s.input) {
    const el = document.getElementById(s.input.id) as HTMLInputElement | null;
    if (el && !el.disabled) {
      el.value = typedValue;
      el.focus({ preventScroll: true });
    }
  }
  tick();
  game.modalOpen = true;
  if (!wasOpen || lastNpc !== s.npcId) {
    lastNpc = s.npcId;
    host?.open(s.npcId);
  }
  host?.inset(root.offsetHeight);
  if ((!wasOpen || keyChanged) && s.input && !s.input.disabled && !coarse()) (document.getElementById(s.input.id) as HTMLInputElement | null)?.focus({ preventScroll: true });
}

/** Focus the reply field again (after an answer came back). */
export function focusDialogueInput(): void {
  if (!spec?.input || coarse()) return;
  const el = document.getElementById(spec.input.id) as HTMLInputElement | null;
  if (el && !el.disabled) el.focus({ preventScroll: true });
}

export function closeDialogueBox(): void {
  if (!root) return;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  ro?.disconnect();
  ro = null;
  document.removeEventListener('keydown', onKey);
  root.remove();
  root = null;
  const gone = spec;
  spec = null;
  typedEl = null;
  restEl = null;
  lastKey = '';
  lastLine = '';
  lastNpc = undefined;
  game.modalOpen = !!modalId();
  host?.close();
  gone?.onDismiss?.();
}
