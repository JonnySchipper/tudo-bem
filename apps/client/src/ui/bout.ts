/**
 * "Treino no tatame", Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md §H): the overlay along the bottom of the mat. The match itself is in
 * the world (boutStage.ts); the server owns it (apps/server/src/bout.ts) and judges every tap on its own clock.
 *
 *  - pick: the partner's telegraph, at most four cards (chevrons for the chain length, what the move does), Segurar, the quit ×;
 *  - chain: Bia calls each command, big, with a timer ring; the six-button pad; the step dots; Perfeito! / Boa! / Errou! pops;
 *  - defend: "Defenda!", the attack line, the four-button pad and the ring (the Sai! mash against a finish);
 *  - resolve: Bia's call and the ground read; then the end card (Palavras de hoje, Comandos perfeitos).
 * The match views are built once per match and swapped in place (`data-phase`), so nothing jumps between beats. Keys: 1–4 cards, H
 * holds, 1–6 the command pad, 1–4 the defense pad, Enter starts, Esc arms the quit. The word is always on screen, never audio-only.
 *
 * needs_br: true on every new Portuguese string here. The #49 lock: no position or submission names (academia-lock.test.ts).
 */
import {
  BELT_LABELS,
  COMMAND_LABEL,
  DEFENSE_LABEL,
  GRIP_SLIP as MAT_GRIP_SLIP,
  MAT_CALLS,
  MOVE_LABEL,
  cpuLook,
  formatBoutClock,
  isMatMove,
  moveTaughtAt,
  nextStripe,
  progressForWins,
  type BjjProgress,
  type BoutPartnerCard,
  type BoutServerMsg,
  type BoutSnapshot,
  type ClientMsg,
  type MatCommand,
  type MatDefense,
  type PartnerId,
  type TapGrade,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { speak, stopSpeaking } from '../audio';
import { ambience } from '../ambience';
import { readShowEnglish, writeShowEnglish } from './dialogueLogic';
import { beltChip } from './beltChip';
import { boutFeed } from '../render/pixel/boutFeed';
import { CARTOON_MS, LAND_MS } from '../render/pixel/gagCartoon';
import { mountCharPreview } from '../render/pixel/charPreview';
import { reducedMotion } from '../render/pixel/perf';
import {
  COACH_NOTES,
  COMMAND_PAD,
  DEFENSE_PAD,
  DRILL_LINE,
  chevrons,
  coachTip,
  cuesForEnd,
  cuesForGrip,
  cuesForResolve,
  defenseAnswer,
  gradeLine,
  gripEventLine,
  gripLife,
  groundRead,
  matGlossLocked,
  matRootClass,
  meterFrac,
  padBeat,
  padDots,
  padExpired,
  padKey,
  padLabel,
  padTap,
  padTimeout,
  posLine,
  resolveLine,
  resolveSpeech,
  ringFrac,
  windupFrame,
  type CoachMoment,
  type PadBeat,
} from './boutLogic';

type Msg<P extends BoutServerMsg['phase']> = Extract<BoutServerMsg, { phase: P }>;
/** a client bout message without its `t` and `v` (distributed over the actions) */
type BoutBody = Extract<ClientMsg, { t: 'bout' }> extends infer M ? (M extends unknown ? Omit<M, 't' | 'v'> : never) : never;
/** What the overlay shows: the lobby, the walk-on, the pick, the pad (chain, defense, drill), the resolve, the end card. */
type View = 'lobby' | 'intro' | 'pick' | 'cmd' | 'resolve' | 'end' | 'wait';
type Phase = 'idle' | 'lobby' | 'intro' | 'pick' | 'chain' | 'defend' | 'drill' | 'resolve' | 'end';

const VIEW_OF: Record<Phase, View> = { idle: 'wait', lobby: 'lobby', intro: 'intro', pick: 'pick', chain: 'cmd', defend: 'cmd', drill: 'cmd', resolve: 'resolve', end: 'end' };
/** The drill is slow: Bia calls the next command this long after the last tap. */
const DRILL_GAP_MS = 650;
/** Bia's "Que ritmo!" waits for her first call to finish. */
const RITMO_AFTER_MS = 700;

export interface BoutActions {
  send: (m: ClientMsg) => void;
  /** the player closed the overlay (back to the gym) */
  closed: () => void;
}

/** The live beat, for the e2e and the shots (`window.__tb.bout.beat` under `?rolltest`). */
export interface BoutBeatView {
  phase: Phase;
  seq: number;
  kind: PadBeat['kind'] | null;
  want: string[];
  step: number;
  windows: number[];
  over: boolean;
  /** the pad is up and taking presses (after the partner's wind-up) */
  open: boolean;
  /** the right defense (Bia's call, else what the attack needs) */
  answer: MatDefense | null;
  cards: string[];
}

interface MatchViews {
  pick: { root: HTMLElement; plan: HTMLElement; planLine: HTMLElement; cards: HTMLElement; hold: HTMLButtonElement; bar: HTMLElement; coach: HTMLElement };
  cmd: {
    root: HTMLElement;
    tag: HTMLElement;
    move: HTMLElement;
    line: HTMLElement;
    ring: HTMLElement;
    ringFg: SVGRectElement;
    bar: HTMLElement;
    word: HTMLElement;
    dots: HTMLElement;
    grade: HTMLElement;
    escape: HTMLElement;
    coach: HTMLElement;
    pad: HTMLElement;
    dpad: HTMLElement;
  };
  resolve: { root: HTMLElement; who: HTMLElement; call: HTMLElement; line: HTMLElement; ground: HTMLElement };
  intro: { root: HTMLElement };
}

export class BoutUI {
  private root: HTMLElement;
  private top: HTMLElement;
  private panel: HTMLElement;
  private body: HTMLElement;
  private meters: HTMLElement;
  private views = new Map<View, HTMLElement>();
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private showEn = readShowEnglish();
  private phase: Phase = 'idle';
  private seq = 0;
  private locked = false;
  private snap: BoutSnapshot | null = null;
  private partnerName = 'Parceiro';
  private partnerId: PartnerId | null = null;
  private bjj: BjjProgress | null = null;
  private quitArmed = 0;
  private previews: { stop: () => void }[] = [];
  private closedFlag = false;
  private lastEndWinner: Msg<'end'>['winner'] = 'none';
  /** The move of the stripe lesson in progress: its end card is a lesson card, not a match result. */
  private lesson: { id: string; pt: string; en: string } | null = null;
  /** A first-ever match (wins 0): Bia's three coach notes, once each. */
  private first = false;
  private coached = new Set<CoachMoment>();
  private m: MatchViews | null = null;
  /** The scoreboard's live cells (built once). */
  private board: { youName: HTMLElement; youPts: HTMLElement; youAdv: HTMLElement; themName: HTMLElement; themPts: HTMLElement; themAdv: HTMLElement; clock: HTMLElement; turn: HTMLElement; belt: HTMLElement } | null = null;
  /** The control meter's live elements (built once per match, so the bar slides instead of jumping). */
  private ctl: { root: HTMLElement; bar: HTMLElement; fill: HTMLElement; mark: HTMLElement; you: HTMLElement; them: HTMLElement; pos: HTMLElement; ritmo: HTMLElement } | null = null;
  /** The pick timer (the thin bar under the cards). */
  private pickTimer: { end: number; ms: number } | null = null;
  /** The pad beat: what to press, when the word on screen appeared, and the whole chain's clock (the finish's escape bar). */
  private beat: PadBeat | null = null;
  private beatSeq = 0;
  private shownAt = 0;
  private beatT0 = 0;
  private beatTotal = 0;
  private beatSub = false;
  private padOpen = false;
  private answer: MatDefense | null = null;
  private cards: string[] = [];
  /** The move whose clip the taps are driving on the mat (its wind-up is up): its landing plays from the impact. */
  private driven: string | null = null;
  /** performance.now() until the landing on the mat is done; the end card waits for it. */
  private busyUntil = 0;
  private timers: number[] = [];
  private lastPointer = 0;

  constructor(private readonly a: BoutActions) {
    this.top = h('div', { class: 'bout-top', id: 'bout-top', 'aria-live': 'off', 'data-shown': '0' });
    this.meters = h('div', { class: 'bout-meters', id: 'bout-meters' });
    this.body = h('div', { class: 'bout-body', id: 'bout-body' });
    const quit = h(
      'button',
      { class: 'bout-quit ghost', id: 'bout-quit', type: 'button', 'aria-label': 'Sair (Leave)', title: 'Sair / Leave', onclick: () => (this.phase === 'lobby' || this.phase === 'end' ? this.leave() : this.quit()) },
      h('span', { 'aria-hidden': 'true' }, '✕'),
    );
    this.panel = h('div', { class: 'bout-panel', id: 'bout', role: 'region', 'aria-label': 'Treino no tatame (Mat practice)', 'data-phase': 'idle' }, quit, this.meters, this.body);
    this.root = h('div', { class: `${matRootClass(game.profile?.nameplate)}${reducedMotion() ? ' bout-reduced' : ''}`, id: 'bout-root', 'data-phase': 'idle' }, this.top, this.panel);
    for (const v of ['lobby', 'intro', 'pick', 'cmd', 'resolve', 'end', 'wait'] as View[]) {
      const el = h('div', { class: `bout-view bv-${v}`, 'data-view': v, hidden: true });
      this.views.set(v, el);
      this.body.append(el);
    }
    document.body.classList.add('bout-on');
    (document.getElementById('ui') ?? document.body).append(this.root);
    game.modalOpen = true;
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this.panel);
      this.ro.observe(this.top);
    }
    window.addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKey);
    boutFeed.setCamera(true);
    this.tick();
  }

  // ------------------------------------------------------------------ plumbing
  private onResize = () => this.measure();

  private onKey = (e: KeyboardEvent): void => {
    if (this.closedFlag || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const press = (el: Element | null | undefined) => {
      if (el instanceof HTMLButtonElement && !el.disabled) {
        e.preventDefault();
        el.click();
      }
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.phase === 'lobby' || this.phase === 'end') this.leave();
      else this.quit();
      return;
    }
    switch (this.phase) {
      case 'lobby': {
        if (e.key === 'Enter') return press(this.body.querySelector('#bout-start'));
        const i = padKey(e.key, 5);
        if (i !== null) press(this.body.querySelectorAll('.bout-card-partner:not(.locked)')[i]);
        return;
      }
      case 'pick': {
        if (e.key === 'h' || e.key === 'H') return press(this.m?.pick.hold);
        const i = padKey(e.key, 4);
        if (i !== null) press(this.m?.pick.cards.querySelectorAll('.bout-move')[i]);
        return;
      }
      case 'chain':
      case 'drill': {
        const i = padKey(e.key, COMMAND_PAD.length);
        if (i !== null) {
          e.preventDefault();
          this.press(COMMAND_PAD[i]!);
        }
        return;
      }
      case 'defend': {
        const i = padKey(e.key, DEFENSE_PAD.length);
        if (i !== null) {
          e.preventDefault();
          this.press(DEFENSE_PAD[i]!);
        }
        return;
      }
      case 'end':
        if (e.key === 'Enter') press(this.body.querySelector('#bout-again'));
        return;
      default:
        return;
    }
  };

  private measure(): void {
    const ph = this.panel.getBoundingClientRect().height;
    const th = this.top.getBoundingClientRect().height;
    boutFeed.setBoxes(ph, th + (parseFloat(getComputedStyle(this.top).top) || 0));
  }

  get open(): boolean {
    return !this.closedFlag;
  }

  /** The live beat (the e2e and the shots read it through `window.__tb.bout.beat`). */
  debugBeat(): BoutBeatView {
    const b = this.beat;
    return {
      phase: this.phase,
      seq: this.beatSeq || this.seq,
      kind: b?.kind ?? null,
      want: b ? [...b.want] : [],
      step: b?.step ?? 0,
      windows: b ? [...b.windows] : [],
      over: b?.over ?? true,
      open: this.padOpen,
      answer: this.answer,
      cards: [...this.cards],
    };
  }

  /** The player left (or the room changed): take the overlay and the camera away. */
  destroy(): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    this.clearTimers();
    boutFeed.holding = false;
    ambience.setScene(null);
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKey);
    for (const p of this.previews) p.stop();
    this.previews = [];
    stopSpeaking();
    this.root.remove();
    document.body.classList.remove('bout-on');
    boutFeed.setCamera(false);
    game.modalOpen = false;
    game.emit('modal');
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(
      window.setTimeout(() => {
        if (!this.closedFlag) fn();
      }, ms),
    );
  }

  private clearTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }

  private send(m: BoutBody): void {
    this.a.send({ t: 'bout', v: 2, ...m } as ClientMsg);
  }

  private bi(pt: string, enText: string, cls = ''): HTMLElement[] {
    return [h('span', { class: `pt ${cls}`.trim() }, pt), en(enText)];
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.root.dataset.phase = p;
    this.panel.dataset.phase = p;
    const view = VIEW_OF[p];
    for (const [k, el] of this.views) el.hidden = k !== view;
    if (p !== 'chain' && p !== 'defend' && p !== 'drill') this.padOpen = false;
    this.measure();
  }

  private sfx(kind: Parameters<typeof ambience.sfx>[0]): void {
    if (!game.sound) return;
    try {
      ambience.sfx(kind);
    } catch {
      /* audio is optional */
    }
  }

  /** Professora Bia says it (her baked clip, speaker `prof`; see BIA_LINES). `speak` cuts the line before: a fast chain wants that. */
  private bia(text: string, rate?: number): void {
    if (game.sound) speak(text, { rate, speaker: 'prof' });
  }

  // ------------------------------------------------------------------ messages
  handle(m: BoutServerMsg): void {
    if (this.closedFlag) return;
    switch (m.phase) {
      case 'lobby':
        return this.lobby(m);
      case 'intro':
        return this.intro(m);
      case 'pick':
        return this.pick(m);
      case 'chain': {
        if (!m.drill) return this.chain(m);
        // a won match hands over to the stripe's lesson: let the winning move land first
        const wait = this.busyUntil - performance.now();
        if (wait > 0) this.later(() => this.drill(m), wait);
        else this.drill(m);
        return;
      }
      case 'defend':
        return this.defend(m);
      case 'resolve':
        return this.resolve(m);
      case 'end': {
        // the finish lands in slow motion: the end card waits for the mat
        const wait = this.busyUntil - performance.now();
        if (wait > 0) this.later(() => this.end(m), wait);
        else this.end(m);
        return;
      }
    }
  }

  private setSnap(st: BoutSnapshot): void {
    this.snap = st;
    boutFeed.snap = st;
    this.renderTop();
    this.renderMeters();
  }

  private view(v: View): HTMLElement {
    return this.views.get(v)!;
  }

  // ------------------------------------------------------------------ lobby
  private lobby(m: Msg<'lobby'>): void {
    this.clearTimers();
    this.beat = null;
    this.lesson = null;
    this.root.classList.remove('is-lesson');
    ambience.setScene(null);
    this.snap = null;
    boutFeed.snap = null;
    this.bjj = m.bjj;
    this.pickTimer = null;
    this.renderTop();
    this.meters.replaceChildren();
    this.ctl = null;
    for (const p of this.previews) p.stop();
    this.previews = [];
    let chosen: PartnerId = m.suggested;
    const cards = m.partners.map((p) => this.partnerCard(p, () => select(p.id), p.id === chosen));
    const start = h('button', { class: 'bout-go primary', id: 'bout-start', type: 'button', 'data-bout-start': '' }, ...this.bi('Começar', 'Start'));
    const select = (id: PartnerId) => {
      const card = m.partners.find((p) => p.id === id);
      if (!card?.unlocked) return;
      chosen = id;
      cards.forEach((c, i) => c.classList.toggle('on', m.partners[i]!.id === id));
      start.dataset.partner = id;
    };
    start.dataset.partner = chosen;
    start.addEventListener('click', () => {
      if (this.locked) return;
      this.locked = true;
      this.send({ action: 'start', partner: chosen, listen: game.sound });
    });
    this.locked = false;
    this.view('lobby').replaceChildren(
      h(
        'div',
        { class: 'bout-lobby' },
        h('div', { class: 'bout-lobby-head' }, h('b', { class: 'bout-title' }, 'Treino no tatame'), en('Mat practice', true), beltChip(m.bjj.belt, m.bjj.stripes), this.enToggle()),
        h('div', { class: 'bout-cards' }, ...cards),
        h(
          'div',
          { class: 'bout-lobby-foot' },
          // needs_br: true
          h('span', { class: 'bout-hint' }, ...this.bi('Escute a Bia e toque o comando. Parceiros novos abrem com listras.', 'Listen to Bia and tap the command. New partners open with stripes.')),
          start,
        ),
      ),
    );
    this.setPhase('lobby');
  }

  private partnerCard(p: BoutPartnerCard, pick: () => void, on: boolean): HTMLElement {
    const look = cpuLook(p.name);
    const canvas = h('canvas', { class: 'bout-portrait', width: 28, height: 36, 'aria-hidden': 'true' }) as HTMLCanvasElement;
    try {
      this.previews.push(mountCharPreview(canvas, () => ({ appearance: look.appearance, hat: look.hat }), { facing: 'S' }));
    } catch {
      /* the character sheets are not loaded: a blank portrait is fine */
    }
    const stars = h('span', { class: 'bout-stars', 'aria-label': `${p.stars} de 5` }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < p.stars ? 'on' : '' })));
    const lock = p.unlocked
      ? null
      : h('span', { class: 'bout-lock' }, ...this.bi(p.unlockLevel >= 4 ? 'Faixa azul' : `${p.unlockLevel} ${p.unlockLevel === 1 ? 'listra' : 'listras'}`, p.unlockLevel >= 4 ? 'Blue belt' : `${p.unlockLevel} ${p.unlockLevel === 1 ? 'stripe' : 'stripes'}`));
    return h(
      'button',
      { class: `bout-card-partner${on ? ' on' : ''}${p.unlocked ? '' : ' locked'}`, type: 'button', 'data-partner': p.id, 'aria-disabled': String(!p.unlocked), 'aria-pressed': String(on), onclick: pick },
      h('span', { class: 'bout-portrait-wrap' }, canvas),
      h('span', { class: 'bout-card-body' }, h('b', { class: 'bout-pname' }, p.name), h('span', { class: 'bout-pstyle' }, ...this.bi(p.style.pt, p.style.en)), stars, h('span', { class: 'bout-pbio' }, ...this.bi(p.bio.pt, p.bio.en)), lock),
    );
  }

  // ------------------------------------------------------------------ the match views (built once per match)
  private buildMatch(): MatchViews {
    // pick: the telegraph, the cards, Segurar, the pick clock
    const planLine = h('span', { class: 'plan-line' });
    const plan = h('div', { class: 'bout-plan', id: 'bout-plan', role: 'status' }, h('span', { class: 'plan-eye', 'aria-hidden': 'true' }, '!'), planLine);
    const cards = h('div', { class: 'bout-moves', id: 'bout-moves' });
    const hold = h(
      'button',
      { class: 'bout-hold', id: 'bout-hold', type: 'button', 'data-move': 'hold', 'aria-label': `${MOVE_LABEL.hold.pt}: passa a vez (H)`, onclick: () => this.pickMove('hold') },
      h('span', { class: 'pt' }, MOVE_LABEL.hold.pt),
      en(MOVE_LABEL.hold.en),
      h('span', { class: 'kcap', 'aria-hidden': 'true' }, 'H'),
    );
    const bar = h('div', { class: 'bout-timerbar', id: 'bout-timerbar', 'aria-hidden': 'true' }, h('i'));
    const pickCoach = h('p', { class: 'bout-coach', hidden: true });
    const pickRoot = h(
      'div',
      { class: 'bout-pick', id: 'bout-pick' },
      h('div', { class: 'pick-head' }, h('span', { class: 'pick-you' }, ...this.bi('Sua vez', 'Your move')), plan),
      cards,
      h('div', { class: 'pick-foot' }, pickCoach, hold),
      bar,
    );
    this.view('pick').replaceChildren(pickRoot);

    // the pad: the command word in its ring, the dots, the grade, the escape bar, the two pads
    // the timer ring is a pill around the word (a long word like Empurra! does not fit a circle); it empties as the window runs
    const ringFg = ringPath('fg');
    const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ringSvg.setAttribute('viewBox', '0 0 200 80');
    ringSvg.setAttribute('preserveAspectRatio', 'none');
    ringSvg.setAttribute('aria-hidden', 'true');
    ringFg.style.strokeDasharray = String(RING_LEN);
    ringSvg.append(ringPath('bg'), ringFg);
    const word = h('div', { class: 'cmd-word', id: 'bout-cmdword', role: 'status', 'aria-live': 'assertive', 'aria-atomic': 'true' });
    const cmdBar = h('div', { class: 'cmd-bar', 'aria-hidden': 'true' }, h('i'));
    const ring = h('div', { class: 'cmd-ring', id: 'bout-ring', role: 'timer', 'aria-label': 'Tempo (Time)' }, ringSvg, word);
    const dots = h('div', { class: 'cmd-dots', id: 'bout-dots', 'aria-hidden': 'true' });
    const grade = h('div', { class: 'cmd-grade', id: 'bout-grade', 'aria-live': 'polite' });
    // needs_br: true — the partner's escape bar against your finish
    const escape = h('div', { class: 'cmd-escape', id: 'bout-escape', hidden: true }, h('span', { class: 'lbl' }, ...this.bi('Escapando', 'Escaping')), h('span', { class: 'track' }, h('i')));
    const cmdCoach = h('p', { class: 'bout-coach', hidden: true });
    const tag = h('span', { class: 'cmd-tag' });
    const move = h('span', { class: 'cmd-move' });
    const line = h('span', { class: 'cmd-line' });
    const pad = h(
      'div',
      { class: 'bout-pad cmds', id: 'bout-pad', role: 'group', 'aria-label': 'Comandos (Commands)' },
      ...COMMAND_PAD.map((c, i) => this.padButton(c, i, COMMAND_LABEL[c].pt, COMMAND_LABEL[c].en)),
    );
    const dpad = h(
      'div',
      { class: 'bout-pad defs', id: 'bout-dpad', role: 'group', 'aria-label': 'Defesas (Defenses)' },
      ...DEFENSE_PAD.map((d, i) => this.padButton(d, i, DEFENSE_LABEL[d].pt, DEFENSE_LABEL[d].stops.en)),
    );
    const cmdRoot = h(
      'div',
      { class: 'bout-cmd', id: 'bout-cmd' },
      h('div', { class: 'cmd-head' }, tag, move, line),
      h('div', { class: 'cmd-main' }, h('div', { class: 'cmd-left' }, cmdCoach, escape), h('div', { class: 'cmd-center' }, ring, cmdBar), h('div', { class: 'cmd-right' }, dots, grade)),
      pad,
      dpad,
    );
    this.view('cmd').replaceChildren(cmdRoot);

    // resolve: Bia's call and the ground read
    const who = h('span', { class: 'bout-who' });
    const call = h('b', { class: 'bout-banner' });
    const rline = h('span', { class: 'bout-rline' });
    const ground = h('span', { class: 'bout-ground even', id: 'bout-ground' });
    const resRoot = h('div', { class: 'bout-resolve', id: 'bout-resolve' }, who, call, rline, ground);
    this.view('resolve').replaceChildren(resRoot);

    const intro = h('div', { class: 'bout-intro', id: 'bout-intro' });
    this.view('intro').replaceChildren(intro);
    return {
      pick: { root: pickRoot, plan, planLine, cards, hold, bar, coach: pickCoach },
      cmd: { root: cmdRoot, tag, move, line, ring, ringFg, bar: cmdBar, word, dots, grade, escape, coach: cmdCoach, pad, dpad },
      resolve: { root: resRoot, who, call, line: rline, ground },
      intro: { root: intro },
    };
  }

  private padButton(id: MatCommand | MatDefense, i: number, pt: string, gloss: string): HTMLButtonElement {
    const act = () => this.press(id);
    const b = h(
      'button',
      { class: 'pad-btn', type: 'button', 'data-cmd': id, 'aria-label': `${pt} (${gloss})`, disabled: true },
      h('span', { class: 'kcap', 'aria-hidden': 'true' }, String(i + 1)),
      h('b', { class: 'pt' }, pt),
      en(gloss),
    ) as HTMLButtonElement;
    // a timing game reacts on the press, not the release; a click with no press before it (a key, a screen reader) still counts
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.lastPointer = performance.now();
      act();
    });
    b.addEventListener('click', () => {
      if (performance.now() - this.lastPointer > 600) act();
    });
    return b;
  }

  private ensureMatch(): MatchViews {
    if (!this.m) this.m = this.buildMatch();
    return this.m;
  }

  private coach(moment: CoachMoment, el: HTMLElement): void {
    if (!this.first || this.coached.has(moment)) {
      el.hidden = true;
      return;
    }
    this.coached.add(moment);
    const note = COACH_NOTES[moment];
    el.replaceChildren(h('b', null, 'Professora Bia: '), h('span', { class: 'pt' }, note.pt), en(note.en));
    el.hidden = false;
  }

  // ------------------------------------------------------------------ intro
  private intro(m: Msg<'intro'>): void {
    this.clearTimers();
    this.beat = null;
    this.driven = null;
    this.lesson = null;
    this.root.classList.remove('is-lesson');
    ambience.setBoost(0);
    ambience.setScene('bout');
    this.partnerName = m.partner.name;
    this.partnerId = m.partner.id;
    this.first = m.first;
    this.coached.clear();
    this.locked = true;
    for (const p of this.previews) p.stop();
    this.previews = [];
    const look = cpuLook(m.partner.name);
    // the partner is a student at your own belt (the bot fights with your belt's moves), so that is the belt on their blue gi
    const belt = this.bjj?.belt ?? game.profile?.bjj?.belt ?? 'branca';
    boutFeed.begin({ id: m.partner.id, name: m.partner.name, appearance: look.appearance, belt }, belt, m.st);
    boutFeed.push({ t: 'intro', ms: m.introMs });
    boutFeed.push({ t: 'crowd', cue: 'start' });
    this.sfx('claps');
    const v = this.ensureMatch();
    this.board = null;
    this.ctl = null;
    this.setSnap(m.st);
    this.pickTimer = null;
    v.intro.root.replaceChildren(
      h('b', { class: 'bout-vs' }, `${game.profile?.name ?? 'Você'} × ${m.partner.name}`),
      h('span', { class: 'bout-style' }, ...this.bi(m.partner.style.pt, m.partner.style.en)),
    );
    this.setPhase('intro');
    // Bia calls it when the fist bump is done
    this.later(() => {
      if (this.phase !== 'intro') return;
      boutFeed.push({ t: 'ref', signal: 'combate' });
      this.sfx('gong');
      this.bia(m.line.pt);
      v.intro.root.replaceChildren(h('div', { class: 'bout-call', id: 'bout-call' }, h('b', null, m.line.pt), en(m.line.en)));
    }, Math.max(0, m.introMs * 0.8));
  }

  // ------------------------------------------------------------------ pick
  private pick(m: Msg<'pick'>): void {
    const v = this.ensureMatch();
    this.seq = m.seq;
    this.beat = null;
    this.answer = null;
    this.locked = false;
    this.setSnap(m.st);
    this.pickTimer = { end: performance.now() + m.pickMs, ms: m.pickMs };
    this.cards = m.cards.map((c) => c.id);
    const p = v.pick;
    if (m.plan) {
      p.plan.hidden = false;
      p.plan.dataset.kind = m.plan.kind;
      p.plan.dataset.move = m.plan.move;
      p.planLine.replaceChildren(h('span', { class: 'pt' }, m.plan.line.pt), en(m.plan.line.en));
    } else p.plan.hidden = true;
    p.cards.dataset.seq = String(m.seq);
    p.cards.dataset.n = String(m.cards.length);
    p.cards.replaceChildren(
      ...m.cards.map((c, k) => {
        const id = c.id;
        const name = isMatMove(id) ? MOVE_LABEL[id] : { pt: c.pt, en: c.en };
        // needs_br: true — Responde! (this card answers the telegraph)
        const badge = c.answers ? h('span', { class: 'mv-badge' }, h('span', { class: 'pt' }, 'Responde!'), en('Counters it')) : null;
        // needs_br: true — the chain length in words, for the screen reader (the chevrons are the picture)
        const cmds = `${c.chain} ${c.chain === 1 ? 'comando' : 'comandos'}`;
        return h(
          'button',
          {
            class: `bout-move kind-${c.kind}${c.answers ? ' is-answer' : ''}`,
            type: 'button',
            'data-move': id,
            'data-k': String(k + 1),
            'data-kind': c.kind,
            'data-chain': String(c.chain),
            'data-answers': c.answers ? '1' : '0',
            'aria-label': `${name.pt}. ${c.does.pt}. ${cmds}${c.answers ? '. Responde!' : ''}`,
            onclick: () => this.pickMove(id),
          },
          h('span', { class: 'mv-top' }, h('span', { class: 'kcap', 'aria-hidden': 'true' }, String(k + 1)), badge, h('span', { class: 'mv-chev', 'aria-hidden': 'true' }, chevrons(c.chain))),
          h('b', { class: 'pt mv-name' }, name.pt),
          en(name.en),
          c.does.pt ? h('span', { class: 'mv-does' }, h('span', { class: 'pt' }, c.does.pt), en(c.does.en)) : null,
          c.risk ? h('span', { class: 'mv-risk' }, h('span', { class: 'pt' }, c.risk.pt), en(c.risk.en)) : null,
        );
      }),
    );
    p.hold.disabled = false;
    p.hold.classList.remove('picked');
    this.coach('pick', p.coach);
    this.setPhase('pick');
  }

  private pickMove(id: string): void {
    if (this.locked || this.phase !== 'pick') return;
    this.locked = true;
    this.sfx('tick');
    this.send({ action: 'pick', seq: this.seq, move: id });
    const p = this.m!.pick;
    p.cards.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
    p.hold.disabled = true;
    (id === 'hold' ? p.hold : p.cards.querySelector(`[data-move="${id}"]`))?.classList.add('picked');
  }

  // ------------------------------------------------------------------ the pad: your chain, the partner's attack, the drill
  /** Put a beat on the pad: which pad, the head line, the dots; the first word comes up when the pad opens. */
  private showPad(kind: PadBeat['kind'], m: { seq: number; move: { id: string; pt: string; en: string } }, want: (MatCommand | MatDefense)[], windows: number[]): MatchViews['cmd'] {
    const v = this.ensureMatch().cmd;
    this.beat = padBeat(kind, want, windows);
    this.beatSeq = m.seq;
    this.padOpen = false;
    v.root.dataset.mode = kind;
    v.root.dataset.seq = String(m.seq);
    v.root.dataset.want = '';
    v.root.dataset.step = '0';
    v.root.dataset.attack = '';
    v.root.classList.remove('broke', 'landed');
    v.pad.hidden = kind === 'defend';
    v.dpad.hidden = kind !== 'defend';
    v.grade.replaceChildren();
    v.grade.className = 'cmd-grade';
    v.escape.hidden = true;
    v.coach.hidden = true;
    this.paintDots();
    this.enablePad(false);
    return v;
  }

  private chain(m: Msg<'chain'>): void {
    const v = this.showPad('chain', m, m.cmds, m.windowMs);
    this.setSnap(m.st);
    // needs_br: true
    v.tag.replaceChildren(...this.bi('Sua vez', 'Your move'));
    v.move.replaceChildren(h('b', { class: 'pt' }, m.move.pt), en(m.move.en));
    v.line.replaceChildren();
    this.beatSub = m.sub;
    this.beatT0 = performance.now();
    this.beatTotal = m.windowMs.reduce((a, b) => a + b, 0);
    v.escape.hidden = !m.sub;
    v.root.classList.toggle('is-sub', m.sub);
    this.coach('chain', v.coach);
    // the fighter winds up: each command moves the clip on a frame; the resolve plays the landing
    this.driven = m.move.id;
    boutFeed.push({ t: 'windup', move: m.move.id, from: m.from, aheadFrom: m.aheadFrom, actor: 'you' });
    ambience.setBoost(m.sub ? 1 : 0);
    if (m.sub) this.sfx('gasp');
    this.setPhase('chain');
    this.openPad();
  }

  private defend(m: Msg<'defend'>): void {
    const want = Array.from({ length: Math.max(1, m.count) }, (): MatDefense => defenseAnswer(m));
    const v = this.showPad('defend', m, want, want.map(() => m.windowMs));
    this.setSnap(m.st);
    this.answer = defenseAnswer(m);
    this.beatSub = false;
    v.root.classList.remove('is-sub');
    v.root.dataset.attack = m.attack;
    // needs_br: true — Defenda! (the partner attacks: answer it)
    v.tag.replaceChildren(...this.bi('Defenda!', 'Defend!'));
    v.move.replaceChildren(h('b', { class: 'pt' }, `${this.partnerName}: ${m.move.pt}`), en(m.move.en));
    v.line.replaceChildren(h('span', { class: 'pt' }, m.line.pt), en(m.line.en));
    // white belt: Bia's call is on screen (and spoken); from blue the telegraph is all you get
    v.word.replaceChildren(h('b', { class: 'pt' }, '…'));
    v.word.dataset.want = '';
    this.coach('defend', v.coach);
    this.driven = m.move.id;
    boutFeed.push({ t: 'windup', move: m.move.id, from: m.from, aheadFrom: m.aheadFrom, actor: 'partner', ms: m.leadMs });
    ambience.setBoost(m.attack === 'final' ? 1 : 0);
    if (m.attack === 'final') this.sfx('gasp');
    this.setPhase('defend');
    this.later(() => {
      if (this.beat && this.beatSeq === m.seq && this.phase === 'defend') this.openPad(m.call);
    }, Math.max(0, m.leadMs));
  }

  private drill(m: Msg<'chain'>): void {
    // a lesson opened straight from the mat queue (no match before it): put the pair on the mat with Bia's drill partner
    if (!boutFeed.active) {
      this.partnerName = 'Mateus';
      this.partnerId = 'mateus';
      boutFeed.begin({ id: 'mateus', name: 'Mateus', appearance: cpuLook('Mateus').appearance }, this.bjj?.belt ?? game.profile?.bjj?.belt ?? 'branca', m.st);
      boutFeed.push({ t: 'fight' });
    }
    this.clearTimers();
    boutFeed.holding = false;
    this.lesson = m.move;
    this.first = false;
    this.root.classList.add('is-lesson');
    this.pickTimer = null;
    const v = this.showPad('drill', m, m.cmds, m.cmds.map(() => 0));
    this.setSnap(m.st);
    this.beatSub = false;
    v.root.classList.remove('is-sub');
    // needs_br: true — Nova listra! Golpe novo: (the stripe's lesson)
    v.tag.replaceChildren(...this.bi('Nova listra!', 'New stripe!'));
    v.move.replaceChildren(h('b', { class: 'pt' }, `Golpe novo: ${m.move.pt}`), en(`New move: ${m.move.en}`));
    const line = m.line ?? DRILL_LINE;
    v.line.replaceChildren(h('span', { class: 'pt' }, line.pt), en(line.en));
    this.driven = m.move.id;
    boutFeed.push({ t: 'windup', move: m.move.id, from: m.from, aheadFrom: m.aheadFrom, actor: 'you' });
    this.setPhase('drill');
    this.bia(line.pt, 0.9);
    // Bia calls the first command slowly, after "Agora você."
    this.later(() => this.openPad(), 1100);
  }

  /** The pad takes presses: the current word comes up (Bia calls it), its window starts. */
  private openPad(call?: MatDefense): void {
    const b = this.beat;
    if (!b || b.over) return;
    this.padOpen = true;
    this.enablePad(true);
    this.showWord(call);
  }

  private enablePad(on: boolean): void {
    const v = this.m?.cmd;
    if (!v) return;
    for (const btn of [...v.pad.children, ...v.dpad.children] as HTMLButtonElement[]) {
      btn.disabled = !on;
      btn.classList.remove('hit', 'miss', 'want');
    }
  }

  /** The word on screen for this step: Bia calls it (a defense only at white belt: `call`), the window opens now. */
  private showWord(call?: MatDefense): void {
    const b = this.beat;
    const v = this.m?.cmd;
    if (!b || !v || b.step >= b.want.length) return;
    const want = b.want[b.step]!;
    this.shownAt = performance.now();
    v.root.dataset.want = want;
    v.root.dataset.step = String(b.step);
    v.word.dataset.want = want;
    const label = padLabel(want);
    const reading = b.kind === 'defend' && !call && b.step === 0;
    if (reading) {
      // from blue belt Bia is silent: read the line (queda → Base!) — the attack, not the answer, is on screen
      v.word.replaceChildren(h('b', { class: 'pt' }, '?'), en('Read the warning'));
    } else {
      v.word.replaceChildren(h('b', { class: 'pt' }, label.pt), en(label.en));
      this.bia(label.pt, b.kind === 'drill' ? 0.85 : 1.05);
    }
    v.word.classList.remove('pulse');
    void v.word.offsetWidth;
    v.word.classList.add('pulse');
    if (b.kind === 'drill') {
      // the drill shows the way: the button to press is lit
      for (const btn of v.pad.children as HTMLCollectionOf<HTMLButtonElement>) btn.classList.toggle('want', btn.dataset.cmd === want);
    }
    this.paintDots();
    v.ring.classList.toggle('no-timer', b.kind === 'drill');
    v.ring.classList.remove('low');
    v.ringFg.style.strokeDashoffset = '0';
    const barI = v.bar.firstElementChild as HTMLElement | null;
    if (barI) barI.style.width = '100%';
  }

  private paintDots(): void {
    const b = this.beat;
    const v = this.m?.cmd;
    if (!b || !v) return;
    v.dots.replaceChildren(...padDots(b).map((d) => h('i', { class: d })));
    v.dots.dataset.n = String(b.want.length);
  }

  /** A press on either pad. */
  private press(id: MatCommand | MatDefense): void {
    const b = this.beat;
    const v = this.m?.cmd;
    if (!b || !v || b.over || !this.padOpen) return;
    const isDef = b.kind === 'defend';
    if (isDef !== (DEFENSE_PAD as readonly string[]).includes(id)) return;
    const ms = Math.max(0, Math.round(performance.now() - this.shownAt));
    const step = b.step;
    const { beat, grade } = padTap(b, id, ms);
    const btn = (isDef ? v.dpad : v.pad).querySelector<HTMLElement>(`[data-cmd="${id}"]`);
    if (!grade) {
      // the drill: not that one; Bia says the word again
      btn?.classList.remove('miss');
      void btn?.offsetWidth;
      btn?.classList.add('miss');
      this.bia(padLabel(b.want[step]!).pt, 0.85);
      return;
    }
    this.beat = beat;
    if (b.kind === 'drill') this.send({ action: 'tap', seq: this.beatSeq, step, cmd: id, ms });
    else if (isDef) this.send({ action: 'defend', seq: this.beatSeq, step, cmd: id, ms });
    else this.send({ action: 'tap', seq: this.beatSeq, step, cmd: id, ms });
    const hit = grade === 'perfeito' || grade === 'boa';
    btn?.classList.remove('hit', 'miss');
    void btn?.offsetWidth;
    btn?.classList.add(hit ? 'hit' : 'miss');
    if (b.kind !== 'drill') this.popGrade(grade);
    if (hit) {
      this.sfx(id === 'pega' ? 'grip' : 'tick');
      // the fighter does the move as you command it: the wind-up moves on a frame per command (the defense has no frames to drive)
      if (!isDef) boutFeed.push({ t: 'step', frame: windupFrame(beat.step, beat.want.length) });
    }
    if (beat.over) {
      this.padOpen = false;
      this.enablePad(false);
      v.root.classList.toggle('broke', !hit);
      v.root.classList.toggle('landed', hit);
      this.paintDots();
      return;
    }
    if (b.kind === 'drill') {
      this.paintDots();
      this.enablePad(false);
      this.later(() => {
        if (this.beat === beat && this.phase === 'drill') {
          this.enablePad(true);
          this.showWord();
        }
      }, DRILL_GAP_MS);
      return;
    }
    // the next word comes up at once (a mash keeps Sai! on screen)
    this.showWord(isDef ? (beat.want[beat.step] as MatDefense) : undefined);
  }

  private popGrade(g: TapGrade): void {
    const v = this.m?.cmd;
    if (!v) return;
    const line = gradeLine(g);
    v.grade.className = `cmd-grade g-${g}`;
    v.grade.replaceChildren(h('b', { class: 'pt' }, line.pt), en(line.en));
    void v.grade.offsetWidth;
    v.grade.classList.add('pop');
  }

  // ------------------------------------------------------------------ resolve
  private resolve(m: Msg<'resolve'>): void {
    const v = this.ensureMatch();
    this.locked = true;
    this.beat = null;
    this.answer = null;
    this.pickTimer = null;
    ambience.setBoost(0);
    const from = this.snap;
    const fromPos = m.from ?? from?.position ?? m.st.position;
    const move = isMatMove(m.move) ? m.move : 'hold';
    const actor = m.actor;
    const matchOver = m.st.exchange >= (m.st.turns ?? 16) || m.say?.pt === MAT_CALLS.final.pt;
    const finale = m.landed && (matchOver || m.say?.pt === MAT_CALLS.final.pt);
    // the clip: a driven move plays its landing from the impact (or its stumble from where it broke); anything else plays whole
    const driven = this.driven === m.move && m.how !== 'hold';
    this.driven = null;
    const ms = driven ? LAND_MS : CARTOON_MS;
    boutFeed.holding = true;
    boutFeed.push({ t: 'land', move, hit: m.landed, from: fromPos, to: m.st.position, aheadFrom: m.aheadFrom ?? from?.ahead ?? null, aheadTo: m.st.ahead, ms, actor, finale });
    const land = Math.round(ms * (finale && !reducedMotion() ? 1.6 : 1));
    this.busyUntil = performance.now() + land;
    this.setSnap(m.st);
    this.later(() => {
      boutFeed.holding = false;
      if (from && (from.position !== m.st.position || from.ahead !== m.st.ahead)) this.sfx('slap');
    }, land);
    for (const c of cuesForResolve(m)) boutFeed.push(c);
    // the flash, the word pops and the ground arrow land on the impact frame
    const juice = cuesForGrip(m, this.partnerName);
    const snapGrip = (m.grip ?? []).some((e) => e.kind === 'grip' || e.kind === 'strip');
    this.later(() => {
      for (const c of juice) boutFeed.push(c);
      if (snapGrip) this.sfx('grip');
    }, Math.round(ms * 0.3));
    if (m.sound && m.sound !== 'none') this.sfx(m.sound);
    if (m.how === 'defended' && actor === 'partner') this.sfx('claps');

    // the panel: who moved, Bia's call, what happened, the ground read
    const r = v.resolve;
    const call = resolveLine(m, this.partnerName);
    const who = actor === 'partner' ? this.partnerName : (game.profile?.name ?? 'Você');
    const label = isMatMove(m.move) ? MOVE_LABEL[m.move] : { pt: m.move, en: m.move };
    const good = actor === 'you' ? m.landed : !m.landed;
    r.root.className = `bout-resolve ${good ? 'right' : 'wrong'} actor-${actor} how-${m.how}`;
    r.root.dataset.correct = String(m.landed);
    r.root.dataset.how = m.how;
    r.root.dataset.move = m.move;
    r.root.dataset.actor = actor;
    r.root.dataset.sound = m.sound ?? 'none';
    r.who.replaceChildren(`${who}: ${label.pt}`, en(label.en));
    r.call.replaceChildren(call.pt);
    r.call.classList.remove('pop');
    void r.call.offsetWidth;
    r.call.classList.add('pop');
    const moments = (m.grip ?? []).filter((e) => e.kind !== 'blocked' && e.kind !== 'defended' && e.kind !== 'ritmo').map((e) => gripEventLine(e, this.partnerName));
    // a defense that earned the Vantagem still says what you did
    if (m.how === 'defended' && call.pt !== MAT_CALLS.defendeu.pt) moments.unshift(MAT_CALLS.defendeu);
    // needs_br: true — Mudou de plano! (the partner dropped the move it showed you)
    const replan = actor === 'partner' && (m.replanned || m.feint) ? { pt: 'Mudou de plano!', en: 'Changed plans!' } : null;
    const extra = [...moments, ...(replan ? [replan] : [])].slice(0, 2);
    r.line.replaceChildren(h('span', { class: 'en call-en' }, call.en), ...extra.map((l) => h('span', { class: 'bout-moment' }, h('span', { class: 'pt' }, l.pt), en(l.en))));
    r.line.hidden = !r.line.textContent;
    const ground = groundRead(m.meterFrom ?? from?.meter, m.meterTo ?? m.st.meter);
    r.ground.className = `bout-ground ${ground.dir}`;
    r.ground.dataset.delta = String(ground.delta);
    r.root.dataset.ground = ground.dir;
    // a finish ends the match: "nobody moved" would read wrong under Final!
    r.ground.hidden = m.say?.pt === MAT_CALLS.final.pt;
    r.ground.replaceChildren(h('span', { class: 'gr-arrow', 'aria-hidden': 'true' }, ground.dir === 'gain' ? '▲' : ground.dir === 'loss' ? '▼' : '='), h('span', { class: 'pt' }, ground.pt), en(ground.en));
    this.setPhase('resolve');
    const say = resolveSpeech(m);
    if (say) this.bia(say);
    if ((m.grip ?? []).some((e) => e.kind === 'ritmo') && say !== MAT_CALLS.ritmo.pt) this.later(() => this.bia(MAT_CALLS.ritmo.pt), RITMO_AFTER_MS);
  }

  // ------------------------------------------------------------------ end
  private end(m: Msg<'end'>): void {
    this.clearTimers();
    boutFeed.holding = false;
    this.beat = null;
    this.locked = false;
    this.pickTimer = null;
    this.snap = m.st;
    this.bjj = m.bjj;
    this.lastEndWinner = m.winner;
    if (game.profile) game.profile.bjj = m.bjj;
    this.renderTop();
    this.renderMeters();
    for (const c of cuesForEnd(m)) boutFeed.push(c);
    ambience.setScene(null);
    ambience.setBoost(0);
    if (m.winner === 'you') {
      this.sfx('win');
      this.sfx('cheer');
      if (m.reason === 'finalizacao') {
        this.sfx('tapout');
        this.sfx('whistle');
      }
      ambience.sting('win');
    } else if (m.winner === 'partner') {
      this.sfx('loss');
      this.sfx('claps');
      if (m.reason === 'finalizacao') this.sfx('tapout');
      ambience.sting('lose');
    } else if (m.winner !== 'none') this.sfx('claps');
    const lesson = this.lesson;
    this.lesson = null;
    if (m.winner !== 'none' && !lesson) this.bia(m.line.pt);
    const again = h('button', { class: 'bout-go primary', id: 'bout-again', type: 'button', onclick: () => this.again() }, ...this.bi('De novo', 'Rematch'));
    const leave = h('button', { class: 'ghost', id: 'bout-leave', type: 'button', onclick: () => this.leave() }, ...this.bi('Sair', 'Leave'));
    const lines: HTMLElement[] = [];
    if (m.beltUp) lines.push(h('p', { class: 'bout-promo belt-up' }, ...this.bi(BELT_LABELS[m.belt].pt, BELT_LABELS[m.belt].en)));
    else if (m.stripeUp) lines.push(h('p', { class: 'bout-promo' }, ...this.bi('Nova listra!', 'New stripe!')));
    if (m.bond > 0) lines.push(h('p', { class: 'bout-bond' }, '♥ ', ...this.bi('Professora Bia gostou do treino.', 'Professora Bia enjoyed the match.')));
    const word =
      m.word && m.winner === 'you'
        ? h('div', { class: 'cr-end-words bout-diary', id: 'bout-word' }, h('b', null, 'Palavra nova no Caderno'), en('New word in the Diary'), h('span', { class: 'cr-chip' }, m.word.pt, h('span', { class: 'en' }, m.word.en)))
        : null;
    // needs_br: true — Palavras de hoje (the commands you used), Comandos perfeitos (how many you tapped Perfeito)
    const words =
      m.words?.length && m.winner !== 'none'
        ? h(
            'div',
            { class: 'bout-today', id: 'bout-today' },
            h('b', { class: 'bt-title' }, ...this.bi('Palavras de hoje', "Today's words")),
            h('span', { class: 'bt-chips' }, ...m.words.map((w) => h('span', { class: 'bt-chip' }, h('span', { class: 'pt' }, w.pt), en(w.en)))),
          )
        : null;
    const perfect =
      m.winner !== 'none' && !lesson
        ? h('p', { class: 'bout-perfect', id: 'bout-perfect', 'data-n': String(m.perfect ?? 0) }, h('b', null, String(m.perfect ?? 0)), ' ', ...this.bi('Comandos perfeitos', 'Perfect commands'))
        : null;
    const me = game.profile?.name ?? 'Você';
    const score =
      m.winner === 'none' || lesson
        ? null
        : h(
            'div',
            { class: 'bout-end-score', id: 'bout-end-score' },
            h('span', { class: `who you${m.winner === 'you' ? ' won' : ''}` }, me),
            h('b', null, `${m.st.points.you} × ${m.st.points.partner}`),
            h('span', { class: `who them${m.winner === 'partner' ? ' won' : ''}` }, this.partnerName),
          );
    const tip = lesson
      ? { pt: `${lesson.pt} já está nos seus golpes. Use no próximo treino!`, en: `${lesson.en} is in your moves now. Use it next match!` }
      : coachTip({ winner: m.winner, reason: m.reason, you: m.st.points.you, them: m.st.points.partner, unlocked: m.bjj.unlocked, perfect: m.perfect });
    const tipEl = tip ? h('p', { class: 'bout-tip', id: 'bout-tip' }, h('b', null, 'Professora Bia: '), h('span', { class: 'pt' }, tip.pt), en(tip.en)) : null;
    // the next stripe: wins to go, and the move Bia teaches there
    const ns = nextStripe(m.bjj.wins);
    const after = progressForWins(m.bjj.wins + ns.left);
    const teaches = moveTaughtAt(after.belt, after.stripes);
    const stripe = h(
      'div',
      { class: 'bout-next', id: 'bout-next', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ns.per), 'aria-valuenow': String(ns.into) },
      h('div', { class: 'bout-next-bar' }, h('i', { style: `width:${Math.round((ns.into / ns.per) * 100)}%` })),
      h(
        'span',
        { class: 'bout-next-text' },
        h('span', { class: 'pt' }, `Próxima listra: ${ns.left} ${ns.left === 1 ? 'vitória' : 'vitórias'}${teaches ? ` · aprende ${MOVE_LABEL[teaches].pt}` : ''}`),
        en(`Next stripe: ${ns.left} ${ns.left === 1 ? 'win' : 'wins'}${teaches ? ` · learn ${MOVE_LABEL[teaches].en}` : ''}`),
      ),
    );
    this.view('end').replaceChildren(
      h(
        'div',
        { class: `bout-end result-${m.winner}${lesson ? ' is-lesson' : ''}`, id: 'bout-end', 'data-winner': m.winner, 'data-reason': m.reason, 'data-perfect': String(m.perfect ?? 0) },
        h(
          'div',
          { class: 'bout-end-head' },
          lesson ? h('div', { class: 'bout-end-line' }, h('b', null, 'Aula concluída!'), en('Lesson done!')) : h('div', { class: 'bout-end-line' }, h('b', null, m.line.pt), en(m.line.en)),
          score,
          m.rv > 0 ? h('div', { class: 'bout-rv' }, `+${m.rv} RV`) : null,
        ),
        h('div', { class: 'bout-end-grid' }, h('div', { class: 'bout-end-col' }, perfect, words, word), h('div', { class: 'bout-end-col' }, beltChip(m.bjj.belt, m.bjj.stripes), ...lines, stripe)),
        tipEl,
        h('p', { class: 'bout-thanks' }, ...this.bi(m.thanks.pt, m.thanks.en)),
        h('div', { class: 'bout-end-actions' }, leave, m.winner === 'none' ? null : again, this.enToggle()),
      ),
    );
    this.setPhase('end');
  }

  private again(): void {
    boutFeed.end();
    this.m = null;
    this.board = null;
    this.ctl = null;
    if (this.partnerId && this.lastEndWinner !== 'none') {
      this.locked = false;
      this.view('wait').replaceChildren(h('p', { class: 'bout-wait' }, ...this.bi('De novo…', 'Rematch…')));
      this.setPhase('idle');
      this.send({ action: 'start', partner: this.partnerId, rematch: true });
      return;
    }
    this.send({ action: 'open' });
  }

  private leave(): void {
    this.destroy();
    this.a.closed();
  }

  private quit(): void {
    const now = performance.now();
    const btn = this.panel.querySelector<HTMLElement>('#bout-quit');
    if (now - this.quitArmed < 3000) {
      this.send({ action: 'quit' });
      // the server answers with an end card; leave straight away
      window.setTimeout(() => this.leave(), 60);
      return;
    }
    this.quitArmed = now;
    if (btn) {
      btn.classList.add('armed');
      btn.replaceChildren(...this.bi('Sair mesmo?', 'Really leave?'));
      window.setTimeout(() => {
        if (btn.isConnected && performance.now() - this.quitArmed >= 2900) {
          btn.classList.remove('armed');
          btn.replaceChildren(h('span', { 'aria-hidden': 'true' }, '✕'));
        }
      }, 3000);
    }
  }

  private enToggle(): HTMLElement {
    const locked = matGlossLocked(game.profile?.nameplate);
    const on = locked || this.showEn;
    return h(
      'button',
      {
        class: 'bout-entoggle ghost',
        type: 'button',
        role: 'switch',
        'aria-checked': String(on),
        title: 'Mostrar inglês / Show English',
        onclick: (e: Event) => {
          // Verde locks glosses on (same as Correria). Later plates keep the shared switch.
          if (matGlossLocked(game.profile?.nameplate)) return;
          this.showEn = !this.showEn;
          writeShowEnglish(this.showEn);
          this.root.classList.toggle('bout-noen', !this.showEn);
          (e.currentTarget as HTMLElement).setAttribute('aria-checked', String(this.showEn));
          this.measure();
        },
      },
      'EN',
    );
  }

  // ------------------------------------------------------------------ scoreboard, the HUD row, the clocks
  /** The scoreboard: PONTOS · VANT for each side, the 2:00 clock (TEMPO), the names and your belt. Built once, updated in place. */
  private renderTop(): void {
    const s = this.snap;
    if (!this.board || !this.board.clock.isConnected) {
      // needs_br: true — each number carries its own caption (Pontos, Vant), the clock says Tempo
      const cell = (cls: string, label: string) => h('span', { class: `bout-num ${cls}`, 'data-k': label });
      const youPts = cell('pts', 'Pontos');
      const youAdv = cell('adv', 'Vant');
      const themPts = cell('pts', 'Pontos');
      const themAdv = cell('adv', 'Vant');
      const youName = h('span', { class: 'nm' });
      const themName = h('span', { class: 'nm' });
      const belt = h('i', { class: 'belt-dot' });
      const clock = h('b', { id: 'bout-clock-t' });
      const turn = h('span', { class: 'bout-turn', id: 'bout-turn' });
      this.top.replaceChildren(
        h('div', { class: 'bout-side you' }, h('span', { class: 'bout-name' }, belt, youName), youPts, youAdv),
        h('div', { class: 'bout-mid' }, h('div', { class: 'bout-clock', id: 'bout-clock', 'data-k': 'tempo' }, clock, h('span', null, 'Tempo')), turn),
        h('div', { class: 'bout-side partner' }, h('span', { class: 'bout-name' }, themName), themPts, themAdv),
      );
      this.board = { youName, youPts, youAdv, themName, themPts, themAdv, clock, turn, belt };
    }
    const b = this.board;
    const set = (el: HTMLElement, t: string) => {
      if (el.textContent !== t) el.textContent = t;
    };
    set(b.youName, game.profile?.name ?? 'Você');
    set(b.themName, this.partnerId ? this.partnerName : 'Parceiro');
    set(b.youPts, String(s?.points.you ?? 0));
    set(b.youAdv, String(s?.adv.you ?? 0));
    set(b.themPts, String(s?.points.partner ?? 0));
    set(b.themAdv, String(s?.adv.partner ?? 0));
    set(b.clock, formatBoutClock(s?.clockMs ?? 120_000));
    const turns = s?.turns ?? 16;
    set(b.turn, `${Math.min(turns, s?.exchange ?? 0)}/${turns}`);
    b.belt.className = `belt-dot belt-${this.bjj?.belt ?? game.profile?.bjj?.belt ?? 'branca'}`;
    this.top.dataset.shown = s ? '1' : '0';
  }

  /**
   * The HUD row: each fighter's grips (Gola / Manga with their pips) and brace, the control meter (a tug of war) with who is on top,
   * and your Ritmo (three pips). Built once per match and updated in place, so the meter slides from the old value to the new one.
   */
  private renderMeters(): void {
    const s = this.snap;
    if (!s) {
      this.meters.replaceChildren();
      this.ctl = null;
      return;
    }
    if (!this.ctl || !this.ctl.root.isConnected) {
      const fill = h('i', { class: 'ctl-fill' });
      const mark = h('b', { class: 'ctl-mark' });
      const bar = h('div', { class: 'ctl-bar', id: 'bout-meter', role: 'meter', 'aria-valuemin': '-100', 'aria-valuemax': '100', 'aria-label': 'Controle (Control)' }, h('div', { class: 'ctl-track' }, fill, mark));
      const you = h('div', { class: 'ctl-side you', id: 'bout-grips-you' });
      const them = h('div', { class: 'ctl-side partner', id: 'bout-grips-partner' });
      const pos = h('div', { class: 'bout-pos', id: 'bout-pos' });
      // needs_br: true — Ritmo (three perfect chains in a row are a Vantagem)
      const ritmo = h('span', { class: 'ctl-ritmo', id: 'bout-ritmo', title: 'Ritmo: três correntes perfeitas = Vantagem (Rhythm: three perfect chains = Advantage)' });
      const root = h('div', { class: 'bout-ctl', id: 'bout-ctl' }, you, h('div', { class: 'ctl-mid' }, bar, pos), them, ritmo);
      this.meters.replaceChildren(root);
      this.ctl = { root, bar, fill, mark, you, them, pos, ritmo };
    }
    const c = this.ctl;
    const meter = Math.round(s.meter ?? 0);
    const frac = meterFrac(meter);
    c.root.dataset.meter = String(meter);
    c.root.dataset.lead = meter > 8 ? 'you' : meter < -8 ? 'partner' : 'even';
    c.bar.setAttribute('aria-valuenow', String(meter));
    c.fill.style.width = `${(frac * 100).toFixed(1)}%`;
    c.mark.style.left = `${(frac * 100).toFixed(1)}%`;
    c.you.replaceChildren(...this.gripChips(s, 'you'));
    c.them.replaceChildren(...this.gripChips(s, 'partner'));
    const pos = posLine(s);
    c.pos.dataset.pos = s.position;
    c.pos.replaceChildren(h('b', null, pos.pt), en(pos.en));
    const r = Math.max(0, Math.min(3, s.ritmo ?? 0));
    c.ritmo.dataset.n = String(r);
    c.ritmo.replaceChildren(h('span', { class: 'lbl' }, 'Ritmo'), ...Array.from({ length: 3 }, (_, i) => h('i', { class: i < r ? 'on' : '' })));
  }

  /** needs_br: true — one fighter's chips: Gola and Manga (lit while held, with pips for the turns left before the grip slips) and the brace. */
  private gripChips(s: BoutSnapshot, side: 'you' | 'partner'): HTMLElement[] {
    const g = s.grips?.[side];
    const out: HTMLElement[] = [];
    const both = !!g?.collar && !!g?.sleeve;
    for (const grip of ['collar', 'sleeve'] as const) {
      const on = !!g?.[grip];
      const life = gripLife(g?.age[grip] ?? 0, MAT_GRIP_SLIP);
      const label = grip === 'collar' ? { pt: 'Gola', en: 'Collar' } : { pt: 'Manga', en: 'Sleeve' };
      out.push(
        h(
          'span',
          {
            class: `grip-chip g-${grip}${on ? ' on' : ''}${both ? ' both' : ''}${on && life.left <= 1 ? ' slipping' : ''}`,
            'data-grip': grip,
            'data-on': on ? '1' : '0',
            title: on ? `${label.pt} · ${life.pt} (${life.en})` : `${label.pt} (${label.en})`,
          },
          h('span', { class: 'pt' }, label.pt),
          on ? h('span', { class: 'gc-pips', 'aria-label': life.pt }, ...Array.from({ length: MAT_GRIP_SLIP }, (_, i) => h('i', { class: i < life.left ? 'on' : '' }))) : null,
        ),
      );
    }
    const brace = s.brace?.[side];
    if (brace) {
      const b = brace === 'postura' ? 'Postura' : brace === 'base' ? 'Base' : 'Recuperar';
      out.push(h('span', { class: 'grip-chip brace on', 'data-brace': brace }, h('span', { class: 'gc-shield', 'aria-hidden': 'true' }), h('span', { class: 'pt' }, b)));
    }
    return out;
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    if (this.pickTimer && this.phase === 'pick' && this.m) {
      const f = Math.max(0, this.pickTimer.end - now) / this.pickTimer.ms;
      const bar = this.m.pick.bar;
      const i = bar.firstElementChild as HTMLElement | null;
      if (i) i.style.width = `${(f * 100).toFixed(1)}%`;
      bar.classList.toggle('low', f < 0.3);
    }
    const b = this.beat;
    const v = this.m?.cmd;
    if (!b || !v || !this.padOpen || b.kind === 'drill') return;
    if (!b.over) {
      const w = b.windows[b.step] ?? 0;
      const f = ringFrac(now - this.shownAt, w);
      v.ringFg.style.strokeDashoffset = String((1 - f) * RING_LEN);
      v.ring.classList.toggle('low', f < 0.3);
      const barI = v.bar.firstElementChild as HTMLElement | null;
      if (barI) barI.style.width = `${(f * 100).toFixed(1)}%`;
      if (padExpired(b, now - this.shownAt)) {
        // Tarde!: the window is gone on this side; the server's deadline resolves it a moment later
        this.beat = padTimeout(b);
        this.padOpen = false;
        this.enablePad(false);
        v.root.classList.add('broke');
        this.popGrade('tarde');
        this.paintDots();
      }
    }
    if (this.beatSub && this.beatTotal > 0) {
      const i = v.escape.querySelector<HTMLElement>('.track i');
      if (i && !this.beat?.over) i.style.width = `${(Math.min(1, (now - this.beatT0) / this.beatTotal) * 100).toFixed(1)}%`;
    }
  };
}

/** The ring's outline is normalised to this length (`pathLength`), so the dash offset is simply the share of the window gone. */
const RING_LEN = 100;
function ringPath(cls: string): SVGRectElement {
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  r.setAttribute('class', cls);
  r.setAttribute('x', '4');
  r.setAttribute('y', '4');
  r.setAttribute('width', '192');
  r.setAttribute('height', '72');
  r.setAttribute('rx', '36');
  r.setAttribute('fill', 'none');
  r.setAttribute('pathLength', String(RING_LEN));
  return r;
}
