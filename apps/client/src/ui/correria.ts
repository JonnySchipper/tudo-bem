/**
 * "Correria no Balcão": the overlay of the padaria counter game. The shift itself is in the world (render/pixel/correriaStage.ts: the work
 * board, the queue, the juice, the taps on the shelves); this is the compact strip you read: the order mirror, the tray, the coffee mods,
 * Entregar, the "Quanto é?" card, a pinned HUD (wave, customers, points, combo, tips) and the end card. No modal, no cover over the padaria.
 *
 * The server owns the shift (apps/server/src/correria.ts) and judges every step; this file sends the player's taps and draws what comes back.
 */
import { MG_ITEMS, MG_MODS, nextPadariaUpgrade, type Bilingual, type CAct, type CEvent, type ClientMsg, type CorreriaSnap, type MenuLadderView, type MgServerMsg } from '@tudobem/shared';
import { game } from '../state';
import { h } from './dom';
import { speak, stopSpeaking } from '../audio';
import { ambience } from '../ambience';
import { readShowEnglish, writeShowEnglish } from './dialogueLogic';
import { correriaFeed, type CounterHandlers } from '../render/pixel/correriaFeed';
import { askCard, cueFor, endModel, frontOf, glossOn, hud, ladderEnd, ladderNext, ladderStrip, modChips, orderMirror, patienceFrac, trayChips } from './correriaLogic';
import { HELP_STEPS, HELP_TITLE } from './correriaPracticeLogic';

export interface CorreriaActions {
  send: (m: ClientMsg) => void;
  /** the overlay went away (back to the padaria) */
  closed: () => void;
  /** Jogar de novo */
  again: () => void;
  /** Set for the first-time practice order (ui/correriaPractice.ts): its "?" starts the practice again. */
  practice?: { restart: () => void };
  /** A real shift's "Treino" button (the "?" card and the end card): leave this shift for the practice order. */
  practiceRound?: () => void;
}

const SAY_MS = 4200;
const NEW_ON_MENU: Bilingual = { pt: 'Novo no cardápio!', en: 'New on the menu!' };
const ORANGE_WORDS ={ p: { pt: 'pequena', en: 'small' }, m: { pt: 'média', en: 'medium' }, g: { pt: 'grande', en: 'big' } } as const;

export class CorreriaUI {
  private root: HTMLElement;
  private top: HTMLElement;
  private panel: HTMLElement;
  private mirror = h('div', { class: 'cr-mirror', id: 'cr-order' });
  private say = h('div', { class: 'cr-say', id: 'cr-say', 'aria-live': 'polite' });
  private trayEl = h('div', { class: 'cr-tray', id: 'cr-tray' });
  private modsEl = h('div', { class: 'cr-mods', id: 'cr-mods' });
  private askEl = h('div', { class: 'cr-ask', id: 'cr-ask' });
  private actionsEl = h('div', { class: 'cr-actions' });
  private waveEl = h('div', { class: 'cr-wave', id: 'cr-wave', 'aria-hidden': 'true' });
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private snap: CorreriaSnap | null = null;
  private snapAt = 0;
  private showEn = readShowEnglish();
  private closedFlag = false;
  private ended = false;
  private sayUntil = 0;
  private askSig = '';
  private mirrorSig = '';
  private orderLand = 0;
  private barFill: HTMLElement | null = null;
  private askSecs: HTMLElement | null = null;
  private serveBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private enBtn: HTMLButtonElement;
  private quitBtn: HTMLButtonElement;
  private helpBtn: HTMLButtonElement;
  private coachEl: HTMLElement | null = null;
  private quitArmed = 0;
  private lastPourSfx = 0;
  private teachId = '';
  private bumpShown = false;
  private handlers: CounterHandlers;

  constructor(private readonly a: CorreriaActions) {
    this.serveBtn = h('button', { type: 'button', class: 'cr-serve', id: 'cr-serve', onclick: () => this.act({ a: 'serve' }) }, h('span', { class: 'pt' }, 'Entregar 🔔'), h('span', { class: 'en' }, 'Serve')) as HTMLButtonElement;
    this.clearBtn = h('button', { type: 'button', class: 'cr-clear', id: 'cr-clear', onclick: () => this.act({ a: 'clear' }) }, h('span', { class: 'pt' }, 'Limpar'), h('span', { class: 'en' }, 'Empty')) as HTMLButtonElement;
    this.enBtn = h('button', { type: 'button', class: 'cr-en', id: 'cr-en', 'aria-pressed': String(this.showEn), onclick: () => this.toggleEn() }, 'EN') as HTMLButtonElement;
    this.quitBtn = h('button', { type: 'button', class: 'cr-quit', id: 'cr-quit', 'aria-label': 'Sair', onclick: () => this.quit() }, '✕') as HTMLButtonElement;
    this.helpBtn = h('button', { type: 'button', class: 'cr-help', id: 'cr-help', 'aria-label': 'Como jogar (How to play)', title: 'Como jogar · How to play', onclick: () => this.help() }, '?') as HTMLButtonElement;
    for (const m of MG_MODS.filter((x) => x.group === 'coffee'))
      this.modsEl.append(h('button', { type: 'button', class: 'cr-mod', 'data-mod': m.id, 'aria-pressed': 'false', onclick: () => this.act({ a: 'mod', id: m.id }) }, h('span', { class: 'pt' }, m.pt), h('span', { class: 'en' }, m.en)));
    this.actionsEl.append(this.clearBtn, this.serveBtn);
    this.top = h('div', { class: 'cr-top', id: 'cr-top', 'aria-live': 'off' });
    this.panel = h(
      'div',
      { class: 'cr-panel', id: 'cr-panel', role: 'region', 'aria-label': 'Correria no Balcão' },
      this.mirror,
      this.say,
      this.askEl,
      h('div', { class: 'cr-build' }, this.trayEl, this.modsEl, this.actionsEl),
    );
    this.root = h('div', { class: `cr-root${this.showEn ? '' : ' cr-noen'}`, id: 'correria' }, this.top, this.waveEl, this.panel);
    document.body.classList.add('cr-on');
    (document.getElementById('ui') ?? document.body).append(this.root);
    game.modalOpen = true;
    correriaFeed.showEn = this.showEn;
    this.handlers = {
      grab: (id) => this.act({ a: 'grab', item: id }),
      chapaPut: (id) => {
        const slot = this.snap?.chapa.findIndex((s) => !s) ?? -1;
        if (slot < 0) return this.flash({ pt: 'A chapa está cheia.', en: 'The grill is full.' });
        this.act({ a: 'chapa_put', slot, item: id });
      },
      chapaTake: (slot) => this.act({ a: 'chapa_take', slot }),
      pourStart: (item) => this.act({ a: 'pour_start', item }),
      pourEnd: () => this.act({ a: 'pour_end' }),
      juiceDrop: () => this.act({ a: 'juice_drop' }),
      juiceTake: () => this.act({ a: 'juice_take' }),
      pack: (kind) => this.act({ a: 'pack', kind: this.snap?.pack === kind ? null : kind }),
      serve: () => this.act({ a: 'serve' }),
      clear: () => this.act({ a: 'clear' }),
      replay: () => this.act({ a: 'replay' }),
    };
    correriaFeed.on = this.handlers;
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this.panel);
      this.ro.observe(this.top);
    }
    window.addEventListener('resize', this.onResize);
    document.addEventListener('keydown', this.onKey);
    correriaFeed.setCamera(true);
    this.tick();
  }

  // ------------------------------------------------------------------ plumbing
  private onResize = () => this.measure();

  private measure(): void {
    const ph = this.panel.getBoundingClientRect().height;
    const th = this.top.getBoundingClientRect().height;
    correriaFeed.setBoxes(ph, th + (parseFloat(getComputedStyle(this.top).top) || 0));
  }

  get open(): boolean {
    return !this.closedFlag;
  }

  /** The practice order runs in the client: server shift messages are not for it. */
  get practice(): boolean {
    return !!this.a.practice;
  }

  /** The last state drawn (the practice coach reads the juice glass from it). */
  get snapshot(): CorreriaSnap | null {
    return this.snap;
  }

  /** The practice coach card, on top of the order strip (the camera keeps the counter above the taller strip). */
  setCoach(el: HTMLElement | null): void {
    this.coachEl?.remove();
    this.coachEl = el;
    if (el) this.panel.prepend(el);
    this.measure();
  }

  /** Back to a clean counter: the next state starts a new shift (Jogar de novo, a practice restart). */
  fresh(): void {
    document.body.classList.remove('cr-ended');
    this.root.querySelector('#mg-end')?.remove();
    this.panel.classList.remove('ended');
    this.snap = null;
    this.ended = false;
    this.teachId = '';
    this.bumpShown = false;
    this.closeTeach();
    this.mirrorSig = '';
    this.askSig = '';
    correriaFeed.end();
  }

  /** "?": the practice starts over; in a real shift, the how-to card with a way into the practice. */
  private help(): void {
    if (this.a.practice) return this.a.practice.restart();
    const round = this.a.practiceRound;
    this.mountTeach(HELP_TITLE, [...HELP_STEPS], null, undefined, round ? { pt: '🎓 Fazer o treino', en: 'Practice round', onclick: () => round() } : undefined);
  }

  /** The shift is on (a state came and no end card yet). */
  get live(): boolean {
    return !!this.snap && !this.ended;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (this.closedFlag || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (this.ended) {
      if (e.key === 'Enter') this.root.querySelector<HTMLButtonElement>('#mg-end .cr-again')?.click();
      return;
    }
    if (e.key === 'Enter' && t?.tagName !== 'BUTTON') {
      e.preventDefault();
      this.act({ a: 'serve' });
    } else if (e.key === 'c' || e.key === 'C') this.act({ a: 'clear' });
    else if (e.key === 'r' || e.key === 'R') this.act({ a: 'replay' });
  };

  private act(x: CAct): void {
    if (this.closedFlag || this.ended || !this.snap) return;
    this.a.send({ t: 'mg', action: 'act', act: x });
  }

  private toggleEn(): void {
    if (this.snap && glossOn(this.snap.level, false)) return;
    this.showEn = !this.showEn;
    writeShowEnglish(this.showEn);
    this.syncEn();
    this.mirrorSig = '';
    this.askSig = '';
    this.render();
  }

  private syncEn(): void {
    const on = glossOn(this.snap?.level ?? 0, this.showEn);
    correriaFeed.showEn = on;
    this.root.classList.toggle('cr-noen', !on);
    this.enBtn.setAttribute('aria-pressed', String(on));
    this.enBtn.disabled = glossOn(this.snap?.level ?? 0, false);
  }

  private quit(): void {
    const s = this.snap;
    if (!s || this.ended || this.a.practice) return this.destroy();
    const worked = s.stats.served + s.stats.left > 0;
    if (worked && !this.quitArmed) {
      // one more tap within 3 s ends the shift and pays what was served
      this.quitArmed = performance.now() + 3000;
      this.quitBtn.classList.add('armed');
      this.quitBtn.textContent = 'Sair?';
      window.setTimeout(() => {
        this.quitArmed = 0;
        this.quitBtn.classList.remove('armed');
        this.quitBtn.textContent = '✕';
      }, 3000);
      return;
    }
    this.a.send({ t: 'mg', action: 'quit' });
    if (!worked) this.destroy();
  }

  /** The player left (or the room changed): take the overlay and the camera away. */
  destroy(): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this.onKey);
    stopSpeaking();
    this.root.remove();
    document.body.classList.remove('cr-on', 'cr-ended', 'cr-lesson-open');
    correriaFeed.setCamera(false);
    game.modalOpen = false;
    game.emit('modal');
    this.a.closed();
  }

  requestSync(): void {
    if (this.closedFlag || this.ended) return;
    this.a.send({ t: 'mg', action: 'sync' });
  }

  private sfx(kind: NonNullable<ReturnType<typeof cueFor>['sfx']>): void {
    if (game.sound) ambience.sfx(kind);
  }

  private sayIt(text: string, rate?: number): void {
    if (game.sound) speak(text, { rate });
  }

  // ------------------------------------------------------------------ messages
  handle(m: MgServerMsg): void {
    if (this.closedFlag) return;
    if (m.phase === 'state') return this.onState(m.snap, m.ev, !!m.resync);
    // an act still in flight when the shift ended gets "no open shift" back: keep the real end card
    if (m.lost && this.ended) return;
    this.onEnd(m);
  }

  private onState(snap: CorreriaSnap, ev: CEvent[], resync: boolean): void {
    const first = !this.snap;
    this.snap = snap;
    this.snapAt = performance.now();
    if (first || this.ended) {
      this.ended = false;
      document.body.classList.remove('cr-ended');
      this.root.querySelector('#mg-end')?.remove();
      this.panel.classList.remove('ended');
      correriaFeed.begin(snap);
      correriaFeed.on = this.handlers;
    } else correriaFeed.update(snap);
    this.syncEn();
    if (!resync) for (const e of ev) this.onEvent(e, snap);
    this.showTeach(snap);
    this.render();
    this.measure();
  }

  /** One-time how-to (and the pay bump) at the start of the shift. On screen, not spoken. English stays visible when the player hides EN. */
  private showTeach(snap: CorreriaSnap): void {
    const lesson = snap.lesson;
    if (lesson && this.teachId !== lesson.id) {
      this.teachId = lesson.id;
      this.mountTeach(lesson.title, lesson.steps, snap.bump, snap.ladder);
      if (snap.bump) this.bumpShown = true;
      return;
    }
    if (snap.bump && !this.bumpShown) {
      this.bumpShown = true;
      this.mountTeach(NEW_ON_MENU, [], snap.bump, snap.ladder);
    }
  }

  /** The menu as a row of chips: open, NOVO, and the next one locked with its countdown. */
  private ladderEl(l: MenuLadderView | undefined): HTMLElement | null {
    const chips = ladderStrip(l);
    if (!chips.length) return null;
    const next = ladderNext(l);
    return h(
      'div',
      { class: 'cr-ladder' },
      h(
        'ol',
        { 'aria-label': 'Cardápio' },
        ...chips.map((c) =>
          h(
            'li',
            { class: `cr-ladder-item ${c.state}`, 'data-item': c.id },
            c.state === 'next' ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null,
            h('span', { class: 'pt' }, c.pt),
            h('span', { class: 'en' }, c.en),
            c.state === 'new' ? h('b', { class: 'tag' }, 'NOVO') : null,
          ),
        ),
      ),
      next ? h('p', { class: 'cr-ladder-next' }, next.pt, h('span', { class: 'gloss' }, next.en)) : null,
    );
  }

  /** Step lessons sit over the counter taps; pay-bump-only cards use the same shell but must not hide #cr-hot. */
  private closeTeach(): void {
    this.root.querySelector('#cr-lesson')?.remove();
    document.body.classList.remove('cr-lesson-open');
  }

  private mountTeach(title: Bilingual, steps: Bilingual[], bump: Bilingual | null, ladder?: MenuLadderView, extra?: Bilingual & { onclick: () => void }): void {
    this.closeTeach();
    const grew = !!ladder?.fresh.length;
    const card = h(
      'div',
      { class: `cr-lesson${grew ? ' grew' : ''}`, id: 'cr-lesson', role: 'dialog', 'aria-label': title.pt },
      grew && title !== NEW_ON_MENU ? h('p', { class: 'cr-kicker' }, `✨ ${NEW_ON_MENU.pt}`, h('span', { class: 'gloss' }, NEW_ON_MENU.en)) : null,
      h('h3', null, h('span', { class: 'pt' }, title.pt), h('span', { class: 'gloss' }, title.en)),
      steps.length ? h('ol', { class: 'cr-steps' }, ...steps.map((s) => h('li', null, h('span', { class: 'pt' }, s.pt), h('span', { class: 'gloss' }, s.en)))) : null,
      this.ladderEl(ladder),
      bump ? h('p', { class: 'cr-bump' }, bump.pt, h('span', { class: 'gloss' }, bump.en)) : null,
      h('button', { type: 'button', class: 'cr-lesson-ok', onclick: () => this.closeTeach() }, h('span', { class: 'pt' }, 'Entendi'), h('span', { class: 'gloss' }, 'Got it')),
      extra ? h('button', { type: 'button', class: 'cr-lesson-ok cr-lesson-alt', id: 'cr-help-practice', onclick: extra.onclick }, h('span', { class: 'pt' }, extra.pt), h('span', { class: 'gloss' }, extra.en)) : null,
    );
    this.root.append(card);
    if (steps.length) document.body.classList.add('cr-lesson-open');
  }

  private onEvent(e: CEvent, snap: CorreriaSnap): void {
    const cue = cueFor(e);
    if (cue.sfx && !(e.k === 'pour_start' && performance.now() - this.lastPourSfx < 200)) {
      this.sfx(cue.sfx);
      if (e.k === 'pour_start') this.lastPourSfx = performance.now();
    }
    correriaFeed.push({ t: 'ev', e });
    switch (e.k) {
      case 'front': {
        const c = snap.customers.find((x) => x.id === e.id);
        this.orderLand = performance.now();
        this.mirror.classList.remove('land');
        void this.mirror.offsetWidth;
        this.mirror.classList.add('land');
        // the practice order is read on the ticket, not spoken (no baked voice for it)
        if (c && !this.a.practice) this.sayIt(c.pt);
        break;
      }
      case 'grab':
      case 'chapa_ok':
      case 'pour_ok':
      case 'juice_ok': {
        // the name of what was just taken, with its gloss (the shelf labels are hidden on small screens)
        const it = MG_ITEMS.find((i) => i.id === e.item);
        if (it) this.flash({ pt: it.card.form, en: it.card.gloss_en }, false, 1400);
        break;
      }
      case 'juice_drop': {
        // the orange that just went in, by size (the shelf words are hidden on small screens)
        const w = ORANGE_WORDS[e.size];
        this.flash({ pt: `Uma laranja ${w.pt}`, en: `A ${w.en} orange` }, false, 1100);
        break;
      }
      case 'follow': {
        this.sayIt(e.pt);
        this.flash({ pt: e.pt, en: e.en });
        break;
      }
      case 'replay': {
        const c = snap.customers.find((x) => x.id === e.id);
        if (c) {
          this.mirrorSig = '';
          this.sayIt(c.pt, 0.92);
        }
        break;
      }
      case 'replay_deny':
        correriaFeed.push({ t: 'cheer', pt: e.line.pt, en: e.line.en, baker: snap.baker });
        break;
      case 'serve':
        this.sayIt(e.line.pt);
        this.flash(e.line);
        if (e.tip > 0) window.setTimeout(() => this.sfx('clink'), 220);
        break;
      case 'correct':
        this.sayIt(e.line.pt);
        this.flash(e.line, true);
        this.panel.classList.remove('squash');
        void this.panel.offsetWidth;
        this.panel.classList.add('squash');
        window.setTimeout(() => this.panel.classList.remove('squash'), 420);
        break;
      case 'leave':
        this.sayIt(e.line.pt);
        this.flash(e.line, true);
        break;
      case 'ask':
        this.sayIt(e.line.pt);
        break;
      case 'ask_result':
        this.sayIt(e.line.pt);
        this.flash(e.line, !e.ok);
        break;
      case 'cheer': {
        correriaFeed.push({ t: 'cheer', pt: e.line.pt, en: e.line.en, baker: snap.baker });
        this.sayIt(e.line.pt);
        break;
      }
      case 'wave':
        this.banner(e.wave, e.size, e.line);
        this.sayIt(e.line.pt);
        break;
      case 'no':
      case 'chapa_raw':
      case 'chapa_burnt':
      case 'pour_bad':
      case 'juice_bad': {
        const t = cue.toast;
        if (t) this.flash(t, t.tone === 'bad');
        break;
      }
      default:
        break;
    }
  }

  /** The line under the order: what a customer or the game just said, with its gloss. */
  private flash(line: Bilingual, bad = false, ms = SAY_MS): void {
    this.say.replaceChildren(h('span', { class: 'pt' }, line.pt), h('span', { class: 'en' }, line.en));
    this.say.classList.toggle('bad', bad);
    this.say.classList.add('on');
    this.sayUntil = performance.now() + ms;
  }

  private banner(wave: number, size: number, line: Bilingual): void {
    this.waveEl.replaceChildren(h('div', { class: 'pt' }, `Onda ${wave + 1}`), h('div', { class: 'en' }, `Wave ${wave + 1} of 3 · ${size} customers`), h('div', { class: 'line' }, line.pt));
    this.waveEl.classList.remove('on');
    void this.waveEl.offsetWidth;
    this.waveEl.classList.add('on');
  }

  // ------------------------------------------------------------------ drawing
  private render(): void {
    const snap = this.snap;
    if (!snap) return;
    this.renderTop(snap);
    const front = frontOf(snap);
    const ask = front?.state === 'asking' ? askCard(front, 0) : null;
    this.panel.classList.toggle('asking', !!ask);
    const mir = orderMirror(front, snap.level);
    const sig = `${mir?.who}|${mir?.pt}|${mir?.follow?.pt ?? ''}|${this.showEn}|${front?.state}`;
    if (sig !== this.mirrorSig) {
      this.mirrorSig = sig;
      this.renderMirror(mir);
      if (mir && this.orderLand) this.mirror.classList.add('subtitle-in');
    }
    this.renderAsk(front);
    // tray, mods
    const chips = trayChips(snap.tray);
    const mods = modChips(snap);
    this.trayEl.replaceChildren(
      ...(chips.length || mods.length
        ? [...chips.map((c) => h('span', { class: 'cr-chip', 'data-item': c.id }, c.qty > 1 ? `${c.qty}× ` : '', h('b', null, c.pt))), ...mods.map((m) => h('span', { class: 'cr-chip mod' }, m.pt))]
        : [h('span', { class: 'cr-empty' }, 'Bandeja vazia', h('span', { class: 'en' }, 'Empty tray'))]),
    );
    this.modsEl.querySelectorAll<HTMLElement>('.cr-mod').forEach((b) => b.setAttribute('aria-pressed', String(snap.mods.includes(b.dataset.mod!))));
    const busy = !front || front.state !== 'front';
    this.serveBtn.disabled = busy || !snap.tray.length;
    this.clearBtn.disabled = !snap.tray.length && !snap.pack && !snap.mods.length;
    this.panel.dataset.state = front?.state ?? 'idle';
  }

  private renderTop(snap: CorreriaSnap): void {
    const m = hud(snap);
    this.top.replaceChildren(
      this.a.practice
        ? h('div', { class: 'cr-wavechip' }, h('span', { class: 'pt' }, 'Treino'), h('span', { class: 'sub' }, 'Practice · 1 cliente'))
        : h('div', { class: 'cr-wavechip' }, h('span', { class: 'pt' }, m.wave), h('span', { class: 'sub' }, `${m.left} clientes`)),
      h('div', { class: 'cr-stat pts', title: 'Pontos' }, h('span', { class: 'k' }, 'Pontos'), h('b', { id: 'cr-points' }, String(m.points))),
      h('div', { class: `cr-stat combo${m.combo >= 2 ? ' hot' : ''}`, title: 'Combo' }, h('span', { class: 'k' }, 'Combo'), h('b', { id: 'cr-combo' }, `x${m.combo}`)),
      h('div', { class: 'cr-stat tips', title: 'Gorjeta' }, h('span', { class: 'k' }, 'Gorjeta'), h('b', { id: 'cr-tips' }, m.tips)),
      h('div', { class: 'cr-lvl', title: 'Nível' }, m.level),
      this.helpBtn,
      this.enBtn,
      this.quitBtn,
    );
  }

  private renderMirror(mir: ReturnType<typeof orderMirror>): void {
    this.barFill = null;
    if (!mir) {
      this.mirror.replaceChildren(h('div', { class: 'cr-wait' }, h('span', { class: 'pt' }, 'Esperando o próximo cliente…'), h('span', { class: 'en' }, 'Waiting for the next customer…')));
      this.mirror.dataset.mode = 'idle';
      return;
    }
    this.mirror.dataset.mode = mir.hidden ? 'listening' : 'written';
    const bar = h('div', { class: 'cr-patience', id: 'cr-patience' }, h('i'));
    this.barFill = bar.firstElementChild as HTMLElement;
    this.mirror.replaceChildren(
      h(
        'div',
        { class: 'cr-line' },
        h('span', { class: 'cr-who' }, mir.who),
        h('span', { class: 'cr-say-pt', id: 'cr-order-pt' }, mir.hidden ? '🔊 ' : '', mir.pt),
        mir.hidden ? h('span', { class: 'en' }, mir.en) : h('span', { class: 'en' }, mir.en),
        mir.canReplay
          ? h(
              'button',
              { type: 'button', class: 'cr-replay', id: 'cr-replay', onclick: () => this.act({ a: 'replay' }) },
              '🔊 Ouvir de novo',
              h('span', { class: 'en' }, mir.replayPips ? `Replay · −${mir.replayPips} patience pip${mir.replayPips > 1 ? 's' : ''}` : 'Replay · Carlos shrugs it off'),
            )
          : null,
        mir.follow ? h('span', { class: 'cr-follow', id: 'cr-follow' }, mir.follow.pt, h('span', { class: 'en' }, mir.follow.en)) : null,
      ),
      bar,
    );
  }

  private renderAsk(front: ReturnType<typeof frontOf>): void {
    const card = front?.state === 'asking' ? askCard(front, performance.now() - this.snapAt) : null;
    if (!card || !front) {
      if (this.askSig) {
        this.askSig = '';
        this.askEl.replaceChildren();
      }
      return;
    }
    const sig = `${front.id}|${front.ask?.type}|${this.showEn}`;
    if (sig === this.askSig) return;
    this.askSig = sig;
    const items = h('div', { class: 'cr-ask-items' }, ...card.items.map((i) => h('span', { class: 'cr-ask-item' }, `${i.qty > 1 ? `${i.qty}× ` : ''}${i.pt} `, h('b', null, i.price))));
    this.askSecs = h('span', { class: 'cr-ask-secs' }, `${card.secs}s`);
    const body =
      card.type === 'choice'
        ? h('div', { class: 'cr-ask-opts' }, ...card.options.map((o) => h('button', { type: 'button', class: 'cr-opt', 'data-value': String(o.value), onclick: () => this.act({ a: 'answer', value: o.value }) }, h('span', { class: 'pt' }, o.pt), h('span', { class: 'en' }, o.label))))
        : (() => {
            const input = h('input', { type: 'text', id: 'cr-ask-input', class: 'cr-ask-input', placeholder: 'Escreva o total…', autocomplete: 'off', inputmode: 'text', 'aria-label': 'Total em reais' }) as HTMLInputElement;
            const go = () => {
              if (input.value.trim()) this.act({ a: 'answer', value: input.value });
            };
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                go();
              }
            });
            window.setTimeout(() => input.focus(), 0);
            return h('div', { class: 'cr-ask-type' }, input, h('button', { type: 'button', class: 'cr-opt go', onclick: go }, 'Responder'), h('span', { class: 'en' }, 'Numbers or words, accents optional'));
          })();
    this.askEl.replaceChildren(h('div', { class: 'cr-ask-head' }, h('span', { class: 'pt' }, `${card.title.pt} 🧾`), h('span', { class: 'en' }, card.title.en), this.askSecs), items, body);
  }

  private tick = (): void => {
    if (this.closedFlag) return;
    this.raf = requestAnimationFrame(this.tick);
    const snap = this.snap;
    const now = performance.now();
    if (this.sayUntil && now > this.sayUntil) {
      this.sayUntil = 0;
      this.say.classList.remove('on', 'bad');
    }
    if (!snap || this.ended) return;
    const front = frontOf(snap);
    const age = now - this.snapAt;
    if (front && this.barFill) {
      const f = patienceFrac(front, age);
      this.barFill.style.transform = `scaleX(${f.toFixed(3)})`;
      this.barFill.dataset.low = f < 0.3 ? '1' : '0';
    }
    if (front?.state === 'asking' && this.askSecs && front.ask) this.askSecs.textContent = `${Math.max(0, Math.ceil((front.ask.ms - age) / 1000))}s`;
  };

  // ------------------------------------------------------------------ end
  /** In your own padaria: how close the next upgrade is, so a shift always points somewhere. */
  private ownerNext(): HTMLElement | null {
    const own = game.room?.padaria;
    if (!own?.owner) return null;
    const next = nextPadariaUpgrade(own);
    if (!next) return h('p', { class: 'cr-end-daily' }, 'Sua padaria está completa!', h('span', { class: 'en' }, 'Your bakery has every upgrade!'));
    const short = Math.max(0, next.cost - (game.profile?.coins ?? 0));
    return h(
      'p',
      { class: 'cr-end-daily cr-end-next' },
      short ? `Próxima melhoria: ${next.label.pt} · faltam ${short} RV` : `Já dá pra comprar: ${next.label.pt}! (vaso perto da porta)`,
      h('span', { class: 'en' }, short ? `Next upgrade: ${next.label.en} · ${short} RV to go` : `You can buy ${next.label.en} now! (pot by the door)`),
    );
  }

  /** What the next shift brings: the item it opens (gold), or the countdown to the next one, over the menu strip. A full menu is one line. */
  private endLadder(l: MenuLadderView | undefined): HTMLElement | null {
    const { fresh, next } = ladderEnd(l);
    if (l && !l.next && !fresh && next) return h('p', { class: 'cr-end-daily cr-end-full' }, `🏆 ${next.pt}`, h('span', { class: 'gloss' }, next.en));
    const strip = this.ladderEl(l);
    if (!strip) return null;
    return h('div', { class: `cr-end-ladder${fresh ? ' grew' : ''}`, id: 'cr-end-ladder' }, fresh ? h('p', { class: 'cr-end-fresh' }, `✨ ${fresh.pt}`, h('span', { class: 'gloss' }, fresh.en)) : null, strip);
  }

  private onEnd(m: Extract<MgServerMsg, { phase: 'end' }>): void {
    this.ended = true;
    this.closeTeach();
    document.body.classList.add('cr-ended');
    const lost = !!m.lost;
    const model = endModel(m.end, m.carlos);
    this.panel.classList.add('ended');
    this.root.querySelector('#mg-end')?.remove();
    const card = h(
      'div',
      { class: 'cr-end', id: 'mg-end', 'data-lost': lost ? '1' : '0', role: 'dialog', 'aria-label': 'Fim do turno' },
      h('h3', null, h('span', { class: 'pt' }, 'Fim do turno'), h('span', { class: 'en' }, 'End of shift')),
      lost
        ? null
        : h('div', { class: 'cr-end-head' }, h('div', { class: 'big' }, model.big), h('div', { class: 'stars', 'data-stars': String(m.end.stars) }, model.stars)),
      h('p', { class: 'cr-end-note' }, h('span', { class: 'pt' }, `“${m.carlos.pt}”`), h('span', { class: 'en' }, m.carlos.en)),
      lost
        ? null
        : h('div', { class: 'cr-end-rows' }, ...model.rows.map((r) => h('div', { class: 'row' }, h('span', { class: 'k' }, r.label.pt, h('span', { class: 'en' }, r.label.en)), h('b', null, r.value)))),
      !lost && m.end.dailyBlocked ? h('p', { class: 'cr-end-daily' }, 'RV de hoje: já pagamos os turnos do dia. As estrelas contam!', h('span', { class: 'en' }, 'Today’s paid shifts are used up. The stars still count!')) : null,
      !lost && m.end.menuNote ? h('p', { class: 'cr-end-daily cr-end-bump' }, m.end.menuNote.pt, h('span', { class: 'gloss' }, m.end.menuNote.en)) : null,
      !lost ? this.endLadder(m.end.ladder) : null,
      !lost && model.words.length ? h('div', { class: 'cr-end-words' }, h('b', null, 'Palavras novas no Caderno'), ...model.words.map((w) => h('span', { class: 'cr-chip' }, w.pt, h('span', { class: 'en' }, w.en)))) : null,
      !lost ? this.ownerNext() : null,
      !lost && model.unlocks.length ? h('div', { class: 'cr-end-unlock' }, h('b', null, 'Novidade no balcão! ✨'), ...model.unlocks.map((u) => h('span', null, u.pt, h('span', { class: 'en' }, u.en)))) : null,
      h(
        'div',
        { class: 'cr-end-actions' },
        h('button', { type: 'button', class: 'cr-again primary', onclick: () => this.again() }, h('span', { class: 'pt' }, 'Jogar de novo'), h('span', { class: 'en' }, 'Play again')),
        h('button', { type: 'button', class: 'cr-leave', onclick: () => this.destroy() }, h('span', { class: 'pt' }, 'Sair'), h('span', { class: 'en' }, 'Leave')),
        this.a.practiceRound ? h('button', { type: 'button', class: 'cr-leave cr-end-practice', id: 'cr-end-practice', onclick: () => this.a.practiceRound?.() }, h('span', { class: 'pt' }, '? Treino'), h('span', { class: 'en' }, 'Practice')) : null,
      ),
    );
    this.root.append(card);
    if (!lost) this.sfx('combo');
    this.measure();
  }

  private again(): void {
    this.fresh();
    this.a.again();
  }
}
