/**
 * "Correria no Balcão": the overlay of the padaria counter game. The shift itself is in the world (render/pixel/correriaStage.ts: the work
 * board, the queue, the juice, the taps on the shelves); this is a slim strip you read (the order ticket on one line, the tray, Entregar),
 * a pinned HUD (wave, points, combo) and the end card. No modal, no cover over the padaria, no lesson cards: the game teaches by doing, with
 * one short coach mark pinned next to the thing to tap, the first time each action comes up (`correriaPracticeLogic.ts`).
 *
 * The server owns the shift (apps/server/src/correria.ts) and judges every step; this file sends the player's taps and draws what comes back.
 */
import { JUICE, MG_ITEMS, nextPadariaUpgrade, juiceVerdict, type Bilingual, type CAct, type CEvent, type ClientMsg, type CorreriaSnap, type MgServerMsg } from '@tudobem/shared';
import { game } from '../state';
import { h } from './dom';
import { speak, stopSpeaking } from '../audio';
import { ambience } from '../ambience';
import { readShowEnglish, writeShowEnglish } from './dialogueLogic';
import { correriaFeed, type CounterHandlers } from '../render/pixel/correriaFeed';
import { cueFor, endModel, frontOf, glossOn, hud, modChips, orderMirror, patienceFrac, trayChips, type EndNext } from './correriaLogic';
import { COACH_KEY, coachDone, coachMark, readCoach, type CoachMark } from './correriaPracticeLogic';

export interface CorreriaActions {
  send: (m: ClientMsg) => void;
  /** the overlay went away (back to the padaria) */
  closed: () => void;
  /** Jogar de novo */
  again: () => void;
  /** Set for the first-time practice order (ui/correriaPractice.ts): its "?" starts it again, "Pular" goes on to the real shift. */
  practice?: { restart: () => void; skip: () => void };
  /** A real shift's "Treino" button (the end card): leave this shift for the practice order. */
  practiceRound?: () => void;
}

const SAY_MS = 4200;
const ORANGE_WORDS = { p: { pt: 'pequena', en: 'small' }, m: { pt: 'média', en: 'medium' }, g: { pt: 'grande', en: 'big' } } as const;
const LIT = 'cr-coach-lit';

export class CorreriaUI {
  private root: HTMLElement;
  private top: HTMLElement;
  private panel: HTMLElement;
  private mirror = h('div', { class: 'cr-mirror', id: 'cr-order' });
  private say = h('div', { class: 'cr-say', id: 'cr-say', 'aria-live': 'polite' });
  private trayEl = h('div', { class: 'cr-tray', id: 'cr-tray' });
  private actionsEl = h('div', { class: 'cr-actions' });
  private waveEl = h('div', { class: 'cr-wave', id: 'cr-wave', 'aria-hidden': 'true' });
  /** The coach mark: a small bubble pinned next to what to tap now. */
  private markEl = h('div', { class: 'cr-mark', id: 'cr-mark', role: 'status', 'aria-live': 'polite' });
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private snap: CorreriaSnap | null = null;
  private snapAt = 0;
  private showEn = readShowEnglish();
  private closedFlag = false;
  private ended = false;
  private sayUntil = 0;
  private mirrorSig = '';
  private orderLand = 0;
  private barFill: HTMLElement | null = null;
  private serveBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private enBtn: HTMLButtonElement;
  private quitBtn: HTMLButtonElement;
  private helpBtn: HTMLButtonElement;
  private doneEl: HTMLElement | null = null;
  private quitArmed = 0;
  private lastPourSfx = 0;
  private freshShown = false;
  private seen = readCoach(localStorage.getItem(COACH_KEY));
  private mark: CoachMark | null = null;
  private lit: HTMLElement | null = null;
  private handlers: CounterHandlers;

  constructor(private readonly a: CorreriaActions) {
    this.serveBtn = h('button', { type: 'button', class: 'cr-serve', id: 'cr-serve', onclick: () => this.act({ a: 'serve' }) }, h('span', { class: 'pt' }, 'Entregar 🔔'), h('span', { class: 'en' }, 'Serve')) as HTMLButtonElement;
    this.clearBtn = h('button', { type: 'button', class: 'cr-clear', id: 'cr-clear', 'aria-label': 'Limpar (Empty the tray)', onclick: () => this.act({ a: 'clear' }) }, h('span', { class: 'pt' }, 'Limpar'), h('span', { class: 'en' }, 'Empty')) as HTMLButtonElement;
    this.enBtn = h('button', { type: 'button', class: 'cr-en', id: 'cr-en', 'aria-pressed': String(this.showEn), onclick: () => this.toggleEn() }, 'EN') as HTMLButtonElement;
    this.quitBtn = h('button', { type: 'button', class: 'cr-quit', id: 'cr-quit', 'aria-label': 'Sair (Leave)', onclick: () => this.quit() }, '✕') as HTMLButtonElement;
    this.helpBtn = h('button', { type: 'button', class: 'cr-help', id: 'cr-help', 'aria-label': 'Dicas (Hints)', title: 'Dicas de novo · Show the hints again', onclick: () => this.help() }, '?') as HTMLButtonElement;
    this.actionsEl.append(this.clearBtn, this.serveBtn);
    this.top = h('div', { class: 'cr-top', id: 'cr-top', 'aria-live': 'off' });
    this.panel = h('div', { class: 'cr-panel', id: 'cr-panel', role: 'region', 'aria-label': 'Correria no Balcão (Counter Rush)' }, this.mirror, h('div', { class: 'cr-build' }, this.trayEl, this.actionsEl));
    this.root = h('div', { class: `cr-root${this.showEn ? '' : ' cr-noen'}${this.a.practice ? ' cr-practice' : ''}`, id: 'correria' }, this.top, this.waveEl, this.say, this.panel, this.markEl);
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
    this.root.style.setProperty('--cr-panel-h', `${Math.round(ph)}px`);
    correriaFeed.setBoxes(ph, th + (parseFloat(getComputedStyle(this.top).top) || 0));
  }

  get open(): boolean {
    return !this.closedFlag;
  }

  /** The practice order runs in the client: server shift messages are not for it. */
  get practice(): boolean {
    return !!this.a.practice;
  }

  /** The last state drawn. */
  get snapshot(): CorreriaSnap | null {
    return this.snap;
  }

  /** The practice is served: a line and the way on to the real shift, in place of the order ticket. Null takes it away. */
  setDone(line: Bilingual | null, start?: () => void, again?: () => void): void {
    this.doneEl?.remove();
    this.doneEl = null;
    this.panel.classList.toggle('done', !!line);
    if (line) {
      this.doneEl = h(
        'div',
        { class: 'cr-done', id: 'cr-done' },
        h('p', null, h('span', { class: 'pt' }, line.pt), h('span', { class: 'gloss' }, line.en)),
        start ? h('button', { type: 'button', class: 'cr-serve cr-done-go', id: 'cr-start', onclick: start }, h('span', { class: 'pt' }, 'Começar o turno ▶'), h('span', { class: 'en' }, 'Start the shift')) : null,
        again ? h('button', { type: 'button', class: 'cr-clear', id: 'cr-again-practice', onclick: again }, h('span', { class: 'pt' }, 'De novo'), h('span', { class: 'en' }, 'Again')) : null,
      );
      this.panel.prepend(this.doneEl);
    }
    this.measure();
  }

  /** Back to a clean counter: the next state starts a new shift (Jogar de novo, a practice restart). */
  fresh(): void {
    document.body.classList.remove('cr-ended');
    this.root.querySelector('#mg-end')?.remove();
    this.panel.classList.remove('ended');
    this.setDone(null);
    this.snap = null;
    this.ended = false;
    this.freshShown = false;
    this.mirrorSig = '';
    this.showMark(null);
    correriaFeed.end();
  }

  /** "?": the practice starts over; in a real shift, every hint comes back for the actions still to come. */
  private help(): void {
    if (this.a.practice) return this.a.practice.restart();
    this.seen.clear();
    this.saveSeen();
    this.flash({ pt: 'Dicas de novo, uma por vez.', en: 'Hints are back, one at a time.' }, false, 2400);
  }

  private saveSeen(): void {
    try {
      localStorage.setItem(COACH_KEY, JSON.stringify([...this.seen]));
    } catch {
      // private mode: the hints just show again next time
    }
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
    // R only turns furniture (SIMPLIFICATION-REVIEW B8): the replay is the on-screen button
  };

  private act(x: CAct): void {
    if (this.closedFlag || this.ended || !this.snap) return;
    this.a.send({ t: 'mg', action: 'act', act: x });
  }

  private toggleEn(): void {
    if (this.snap && glossOn(this.snap.level, false)) return;
    this.showEn = !this.showEn;
    // one English setting: the gear's Inglês and the dialogue's Mostrar inglês are the same flag
    game.englishHelp = this.showEn;
    writeShowEnglish(this.showEn);
    this.syncEn();
    this.mirrorSig = '';
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
      this.quitBtn.textContent = 'Sair? · Leave?';
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
    this.lit?.classList.remove(LIT);
    this.root.remove();
    document.body.classList.remove('cr-on', 'cr-ended');
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
    this.showFresh(snap);
    this.render();
    this.measure();
  }

  /** What this shift added to the menu: one line, once (the board wears a NOVO badge on it until it is made). */
  private showFresh(snap: CorreriaSnap): void {
    if (this.freshShown || this.a.practice) return;
    this.freshShown = true;
    const names = (snap.ladder?.fresh ?? []).map((id) => MG_ITEMS.find((i) => i.id === id)?.card).filter((c) => !!c);
    if (names.length) this.flash({ pt: `✨ Novo no cardápio: ${names.map((c) => c.form).join(', ')}`, en: `New on the menu: ${names.map((c) => c.gloss_en).join(', ')}` }, false, 3600);
  }

  private onEvent(e: CEvent, snap: CorreriaSnap): void {
    const cue = cueFor(e);
    if (cue.sfx && !(e.k === 'pour_start' && performance.now() - this.lastPourSfx < 200)) {
      this.sfx(cue.sfx);
      if (e.k === 'pour_start') this.lastPourSfx = performance.now();
    }
    correriaFeed.push({ t: 'ev', e });
    const learnt = coachDone(e).filter((k) => !this.seen.has(k));
    if (learnt.length) {
      for (const k of learnt) this.seen.add(k);
      this.saveSeen();
    }
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
      case 'juice_ok': {
        // the name of what was just taken, with its gloss (the shelf labels are hidden on small screens)
        const it = MG_ITEMS.find((i) => i.id === e.item);
        if (it) this.flash({ pt: it.card.form, en: it.card.gloss_en }, false, 1400);
        break;
      }
      case 'pour_ok': {
        const t = cue.toast;
        if (t) this.flash(t, false, 1800);
        else {
          const it = MG_ITEMS.find((i) => i.id === e.item);
          if (it) this.flash({ pt: it.card.form, en: it.card.gloss_en }, false, 1400);
        }
        break;
      }
      case 'juice_drop': {
        // the orange that just went in, by size (the shelf words are hidden on small screens)
        const w = ORANGE_WORDS[e.size];
        this.flash({ pt: `Uma laranja ${w.pt}`, en: `A ${w.en} orange` }, false, 1100);
        // this orange brings the glass up to the line: when its pour ends, a chime and the next step (the green lamp lights then too)
        const before = e.fill - JUICE.sizes[e.size];
        if (juiceVerdict(e.fill) === 'ok' && before < JUICE.goodMin - 1e-9) {
          window.setTimeout(() => {
            if (this.closedFlag || this.ended) return;
            this.sfx('line');
            this.flash({ pt: 'Na linha! Toque no copo.', en: 'At the line! Tap the glass.' }, false, 2200);
          }, JUICE.cycleMs * 0.84);
        }
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
      case 'cheer': {
        correriaFeed.push({ t: 'cheer', pt: e.line.pt, en: e.line.en, baker: snap.baker });
        this.sayIt(e.line.pt);
        break;
      }
      case 'wave':
        // the practice is one customer: no waves to announce
        if (!this.a.practice) {
          this.banner(e.wave, e.size, e.line);
          this.sayIt(e.line.pt);
        }
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

  /** The line over the strip: what a customer or the game just said, with its gloss. */
  flash(line: Bilingual, bad = false, ms = SAY_MS): void {
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
    const mir = orderMirror(front, snap.level);
    const sig = `${mir?.who}|${mir?.pt}|${mir?.follow?.pt ?? ''}|${mir?.hot ? 1 : 0}|${this.showEn}|${front?.state}`;
    if (sig !== this.mirrorSig) {
      this.mirrorSig = sig;
      this.renderMirror(mir);
      if (mir && this.orderLand) this.mirror.classList.add('subtitle-in');
    }
    // tray, mods
    const chips = trayChips(snap.tray);
    const mods = modChips(snap);
    this.trayEl.replaceChildren(
      ...(chips.length || mods.length
        ? [...chips.map((c) => h('span', { class: 'cr-chip', 'data-item': c.id }, c.qty > 1 ? `${c.qty}× ` : '', h('b', null, c.pt))), ...mods.map((m) => h('span', { class: 'cr-chip mod' }, m.pt))]
        : [h('span', { class: 'cr-empty' }, 'Bandeja vazia', h('span', { class: 'en' }, 'Empty tray'))]),
    );
    const busy = !front || front.state !== 'front';
    this.serveBtn.disabled = busy || !snap.tray.length;
    this.clearBtn.disabled = !snap.tray.length && !snap.pack && !snap.mods.length;
    this.panel.dataset.state = front?.state ?? 'idle';
  }

  private renderTop(snap: CorreriaSnap): void {
    const m = hud(snap);
    const p = this.a.practice;
    const parts: (HTMLElement | null)[] = [
      p
        ? h('div', { class: 'cr-wavechip' }, h('span', { class: 'pt' }, 'Treino'), h('span', { class: 'sub' }, 'Practice'))
        : h('div', { class: 'cr-wavechip' }, h('span', { class: 'pt' }, m.wave), h('span', { class: 'sub' }, `${m.left} clientes`, h('span', { class: 'en' }, `${m.left} customers`))),
      h('div', { class: 'cr-stat pts', title: 'Pontos · Points' }, h('span', { class: 'k' }, 'Pontos', h('span', { class: 'en' }, 'Points')), h('b', { id: 'cr-points' }, String(m.points))),
      p ? null : h('div', { class: `cr-stat combo${m.combo >= 2 ? ' hot' : ''}`, title: 'Combo · Combo' }, h('span', { class: 'k' }, 'Combo', h('span', { class: 'en' }, 'Streak')), h('b', { id: 'cr-combo' }, `x${m.combo}`)),
      p ? null : h('div', { class: 'cr-lvl', title: 'Nível · Level' }, m.level),
      p ? h('button', { type: 'button', class: 'cr-skip', id: 'cr-skip', onclick: () => p.skip() }, 'Pular ▶') : this.helpBtn,
      this.enBtn,
      this.quitBtn,
    ];
    this.top.replaceChildren(...parts.filter((el): el is HTMLElement => !!el));
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
        mir.hot ? h('span', { class: 'cr-hot-tag', id: 'cr-hot-tag', title: `${mir.hot.pt} · ${mir.hot.en}` }, mir.hot.pt, h('span', { class: 'en' }, mir.hot.en)) : null,
        mir.canReplay
          ? h(
              'button',
              { type: 'button', class: 'cr-replay', id: 'cr-replay', onclick: () => this.act({ a: 'replay' }) },
              '🔊 Ouvir de novo',
              h('span', { class: 'en' }, mir.replayPips ? `Replay · −${mir.replayPips} patience pip${mir.replayPips > 1 ? 's' : ''}` : 'Replay · Carlos shrugs it off'),
            )
          : null,
        h('span', { class: 'en cr-order-en' }, mir.en),
        mir.follow ? h('span', { class: 'cr-follow', id: 'cr-follow' }, mir.follow.pt, h('span', { class: 'en' }, mir.follow.en)) : null,
      ),
      bar,
    );
  }

  /** The coach mark for now (or none), pinned next to its target and lighting it up. */
  private showMark(m: CoachMark | null): void {
    const target = m ? document.getElementById(m.target) : null;
    const visible = !!target && target.offsetParent !== null && !(target as HTMLButtonElement).disabled;
    const want = visible ? m : null;
    if (this.lit !== target || !want) {
      this.lit?.classList.remove(LIT);
      this.lit = want && target ? target : null;
      this.lit?.classList.add(LIT);
    }
    if (!want || !target) {
      if (this.mark) {
        this.mark = null;
        this.markEl.classList.remove('on');
      }
      return;
    }
    if (this.mark?.key !== want.key) {
      this.mark = want;
      this.markEl.replaceChildren(h('span', { class: 'pt' }, want.pt), h('span', { class: 'gloss' }, want.en));
      this.markEl.dataset.key = want.key;
      this.markEl.classList.add('on');
    }
    // over the target when there is room, else under it; kept on screen
    const r = target.getBoundingClientRect();
    const mw = this.markEl.offsetWidth;
    const mh = this.markEl.offsetHeight;
    const above = r.top - mh - 12 > 8;
    const x = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2));
    const y = above ? r.top - mh - 12 : r.bottom + 12;
    this.markEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.markEl.dataset.side = above ? 'above' : 'below';
    this.markEl.style.setProperty('--cr-mark-arrow', `${Math.round(r.left + r.width / 2 - x)}px`);
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
    if (!snap || this.ended) {
      this.showMark(null);
      return;
    }
    const front = frontOf(snap);
    const age = now - this.snapAt;
    if (front && this.barFill) {
      const f = patienceFrac(front, age);
      this.barFill.style.transform = `scaleX(${f.toFixed(3)})`;
      this.barFill.dataset.low = f < 0.3 ? '1' : '0';
    }
    this.showMark(this.doneEl ? null : coachMark(snap, this.seen, !!correriaFeed.snap?.pour));
  };

  // ------------------------------------------------------------------ end
  /** In your own padaria: how close the next upgrade is, so a shift always points somewhere. */
  private ownerNext(): HTMLElement | null {
    const own = game.room?.padaria;
    if (!own?.owner) return null;
    const next = nextPadariaUpgrade(own);
    if (!next) return h('p', { class: 'cr-end-daily' }, 'Sua padaria está completa!', h('span', { class: 'en' }, 'Your bakery has every upgrade!'));
    const ready = (game.profile?.coins ?? 0) >= next.cost;
    return h(
      'p',
      { class: 'cr-end-daily cr-end-next' },
      ready ? `Já dá pra comprar: ${next.label.pt}! (Menu do dono)` : `Próxima melhoria: ${next.label.pt} · ${next.cost} RV`,
      h('span', { class: 'en' }, ready ? `You can buy ${next.label.en} now! (Owner menu)` : `Next upgrade: ${next.label.en} · ${next.cost} RV`),
    );
  }

  /** The one "next" line: what the next shift brings (an unlock or item in gold), else the countdown to the next item. */
  private nextEl(next: EndNext | null): HTMLElement | null {
    if (!next) return null;
    const gold = next.tone === 'new';
    return h('p', { class: gold ? 'cr-end-fresh' : 'cr-end-daily cr-end-full', id: 'cr-end-next' }, `${gold ? '✨' : '🏆'} ${next.pt}`, h('span', { class: 'gloss' }, next.en));
  }

  private onEnd(m: Extract<MgServerMsg, { phase: 'end' }>): void {
    this.ended = true;
    this.showMark(null);
    document.body.classList.add('cr-ended');
    const lost = !!m.lost;
    const model = endModel(m.end, m.carlos);
    this.panel.classList.add('ended');
    this.root.querySelector('#mg-end')?.remove();
    const card = h(
      'div',
      { class: 'cr-end', id: 'mg-end', 'data-lost': lost ? '1' : '0', role: 'dialog', 'aria-label': 'Fim do turno (End of shift)' },
      h('h3', null, h('span', { class: 'pt' }, 'Fim do turno'), h('span', { class: 'en' }, 'End of shift')),
      lost
        ? null
        : h('div', { class: 'cr-end-head' }, h('div', { class: 'big' }, model.big), h('div', { class: 'stars', 'data-stars': String(m.end.stars) }, model.stars)),
      h('p', { class: 'cr-end-note' }, h('span', { class: 'pt' }, `“${m.carlos.pt}”`), h('span', { class: 'en' }, m.carlos.en)),
      !lost && m.end.dailyBlocked ? h('p', { class: 'cr-end-daily' }, 'RV de hoje: já pagamos os turnos do dia. As estrelas contam!', h('span', { class: 'en' }, 'Today’s paid shifts are used up. The stars still count!')) : null,
      !lost && model.words.length ? h('div', { class: 'cr-end-words' }, h('b', null, 'Palavras novas no Caderno'), ...model.words.map((w) => h('span', { class: 'cr-chip' }, w.pt, h('span', { class: 'en' }, w.en)))) : null,
      !lost ? this.ownerNext() ?? this.nextEl(model.next) : null,
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
