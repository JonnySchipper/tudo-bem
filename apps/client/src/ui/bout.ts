/**
 * "Treino no tatame": the overlay of the bout. The match itself is in the world (render/pixel/boutStage.ts); this is only what you
 * touch: a compact bottom panel (partner picker, intent chips, the challenge card with its timer ring, the momentum bar, the pegada
 * meter, the result) and a pinned top scoreboard (Pontos / Vantagens / Tempo). No modal, no cover over the gym.
 *
 * The server owns the bout (apps/server/src/bout.ts); this file sends intents and answers and draws what comes back.
 */
import {
  CLOCK_RATE,
  INTENTS,
  PEGADA_MAX,
  BELT_LABELS,
  STRIPES_PER_BELT,
  cpuLook,
  type BjjProgress,
  type BoutIntentOut,
  type BoutPartnerCard,
  type BoutServerMsg,
  type BoutSnapshot,
  type ChallengeView,
  type ClientMsg,
  type PartnerId,
  POSITION_LABELS,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { speak, stopSpeaking } from '../audio';
import { ambience } from '../ambience';
import { readShowEnglish, writeShowEnglish } from './dialogueLogic';
import { boutFeed } from '../render/pixel/boutFeed';
import { mountCharPreview } from '../render/pixel/charPreview';
import { RISK_LABEL, callOf, clockAt, cuesForEnd, cuesForFinishEnd, cuesForResolve, ladderDots, momentumFrac, resultBanner } from './boutLogic';

type Msg<P extends BoutServerMsg['phase']> = Extract<BoutServerMsg, { phase: P }>;
/** a client bout message without its `t` and `v` (distributed over the actions) */
type BoutBody = Extract<ClientMsg, { t: 'bout' }> extends infer M ? (M extends unknown ? Omit<M, 't' | 'v'> : never) : never;

export interface BoutActions {
  send: (m: ClientMsg) => void;
  /** the player closed the overlay (back to the gym) */
  closed: () => void;
}

export class BoutUI {
  private root: HTMLElement;
  private top: HTMLElement;
  private panel: HTMLElement;
  private body: HTMLElement;
  private meters: HTMLElement;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private showEn = readShowEnglish();
  private phase: BoutServerMsg['phase'] | 'idle' = 'idle';
  private seq = 0;
  private locked = false;
  private snap: BoutSnapshot | null = null;
  private snapAt = 0;
  private clockShown = '5:00';
  private timer: { end: number; ms: number } | null = null;
  private partnerName = 'Parceiro';
  private partnerId: PartnerId | null = null;
  private bjj: BjjProgress | null = null;
  private order: number[] = [];
  private sentAt = 0;
  private quitArmed = 0;
  private lastBanner = '';
  private previews: { stop: () => void }[] = [];
  private closedFlag = false;

  constructor(private readonly a: BoutActions) {
    this.top = h('div', { class: 'bout-top', id: 'bout-top', 'aria-live': 'off' });
    this.meters = h('div', { class: 'bout-meters', id: 'bout-meters' });
    this.body = h('div', { class: 'bout-body', id: 'bout-body' });
    this.panel = h('div', { class: 'bout-panel', id: 'bout', role: 'region', 'aria-label': 'Treino no tatame' }, this.meters, this.body);
    this.root = h('div', { class: `bout-root${this.showEn ? '' : ' bout-noen'}`, id: 'bout-root' }, this.top, this.panel);
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
    boutFeed.setCamera(true);
    this.tick();
  }

  // ------------------------------------------------------------------ plumbing
  private onResize = () => this.measure();

  private measure(): void {
    const ph = this.panel.getBoundingClientRect().height;
    const th = this.top.getBoundingClientRect().height;
    boutFeed.setBoxes(ph, th + (parseFloat(getComputedStyle(this.top).top) || 0));
  }

  get open(): boolean {
    return !this.closedFlag;
  }

  /** The player left (or the room changed): take the overlay and the camera away. */
  destroy(): void {
    if (this.closedFlag) return;
    this.closedFlag = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.onResize);
    for (const p of this.previews) p.stop();
    this.previews = [];
    stopSpeaking();
    this.root.remove();
    document.body.classList.remove('bout-on');
    boutFeed.setCamera(false);
    game.modalOpen = false;
    game.emit('modal');
  }

  private send(m: BoutBody): void {
    this.a.send({ t: 'bout', v: 1, ...m } as ClientMsg);
  }

  private bi(pt: string, enText: string, cls = ''): HTMLElement[] {
    return [h('span', { class: `pt ${cls}`.trim() }, pt), en(enText)];
  }

  private setPhase(p: BoutServerMsg['phase'] | 'idle'): void {
    this.phase = p;
    this.root.dataset.phase = p;
    this.panel.dataset.phase = p;
  }

  private sfx(kind: Parameters<typeof ambience.sfx>[0]): void {
    if (game.sound) ambience.sfx(kind);
  }

  private say(text: string, rate?: number): void {
    if (game.sound) speak(text, { rate });
  }

  // ------------------------------------------------------------------ messages
  handle(m: BoutServerMsg): void {
    if (this.closedFlag) return;
    switch (m.phase) {
      case 'lobby':
        return this.lobby(m);
      case 'intro':
        return this.intro(m);
      case 'intent':
        return this.intent(m);
      case 'challenge':
        return this.challenge(m);
      case 'resolve':
        return this.resolve(m);
      case 'finish_end':
        return this.finishEnd(m);
      case 'end':
        return this.end(m);
    }
  }

  private setSnap(st: BoutSnapshot): void {
    this.snap = st;
    this.snapAt = performance.now();
    boutFeed.snap = st;
    this.renderTop();
    this.renderMeters();
  }

  // ------------------------------------------------------------------ lobby
  private lobby(m: Msg<'lobby'>): void {
    this.setPhase('lobby');
    this.snap = null;
    boutFeed.snap = null;
    this.bjj = m.bjj;
    this.stopTimer();
    this.renderTop();
    this.meters.replaceChildren();
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
    this.body.replaceChildren(
      h(
        'div',
        { class: 'bout-lobby' },
        h('div', { class: 'bout-lobby-head' }, h('b', { class: 'bout-title' }, 'Treino no tatame'), en('Mat practice', true), this.beltRow(m.bjj), this.enToggle(), this.quitBtn()),
        h('div', { class: 'bout-cards' }, ...cards),
        h('div', { class: 'bout-lobby-foot' }, h('span', { class: 'bout-hint' }, ...this.bi('Parceiros novos abrem com listras e com a faixa azul.', 'New partners open with stripes and the blue belt.')), start),
      ),
    );
    this.measure();
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
    const lock = p.unlocked ? null : h('span', { class: 'bout-lock' }, ...this.bi(p.unlockLevel >= 4 ? 'Faixa azul' : `${p.unlockLevel} ${p.unlockLevel === 1 ? 'listra' : 'listras'}`, p.unlockLevel >= 4 ? 'Blue belt' : `${p.unlockLevel} ${p.unlockLevel === 1 ? 'stripe' : 'stripes'}`));
    const card = h(
      'button',
      { class: `bout-card-partner${on ? ' on' : ''}${p.unlocked ? '' : ' locked'}`, type: 'button', 'data-partner': p.id, 'aria-disabled': String(!p.unlocked), onclick: pick },
      h('span', { class: 'bout-portrait-wrap' }, canvas),
      h('span', { class: 'bout-card-body' }, h('b', { class: 'bout-pname' }, p.name), h('span', { class: 'bout-pstyle' }, ...this.bi(p.style.pt, p.style.en)), stars, h('span', { class: 'bout-pbio' }, ...this.bi(p.bio.pt, p.bio.en)), lock),
    );
    return card;
  }

  private beltRow(b: BjjProgress): HTMLElement {
    const label = BELT_LABELS[b.belt];
    return h(
      'span',
      { class: `bout-belt belt-${b.belt}`, id: 'bout-belt', title: `${label.pt} · ${label.en}` },
      h('i', { class: 'band' }),
      h('span', { class: 'bout-belt-name' }, ...this.bi(label.pt, label.en)),
      h('span', { class: 'bout-stripes' }, ...Array.from({ length: STRIPES_PER_BELT }, (_, i) => h('i', { class: i < b.stripes ? 'on' : '' }))),
    );
  }

  // ------------------------------------------------------------------ intro
  private intro(m: Msg<'intro'>): void {
    this.setPhase('intro');
    this.partnerName = m.partner.name;
    this.partnerId = m.partner.id;
    this.locked = true;
    for (const p of this.previews) p.stop();
    this.previews = [];
    const look = cpuLook(m.partner.name);
    boutFeed.begin({ id: m.partner.id, name: m.partner.name, appearance: look.appearance }, this.bjj?.belt ?? 'branca', m.st);
    boutFeed.push({ t: 'intro', ms: m.introMs });
    boutFeed.push({ t: 'crowd', cue: 'start' });
    this.sfx('claps');
    this.setSnap(m.st);
    this.stopTimer();
    this.body.replaceChildren(
      h(
        'div',
        { class: 'bout-intro', id: 'bout-intro' },
        h('b', { class: 'bout-vs' }, `${game.profile?.name ?? 'Você'} × ${m.partner.name}`),
        h('span', { class: 'bout-style' }, ...this.bi(m.partner.style.pt, m.partner.style.en)),
      ),
    );
    // Bia calls it when the fist bump is done
    window.setTimeout(() => {
      if (this.closedFlag || this.phase === 'end') return;
      boutFeed.push({ t: 'ref', signal: 'combate' });
      this.sfx('gong');
      this.say(m.line.pt);
      this.body.replaceChildren(h('div', { class: 'bout-call', id: 'bout-call' }, h('b', null, m.line.pt), en(m.line.en)));
    }, Math.max(0, m.introMs * 0.8));
  }

  // ------------------------------------------------------------------ intent
  private intent(m: Msg<'intent'>): void {
    this.setPhase('intent');
    this.seq = m.seq;
    this.locked = false;
    this.setSnap(m.st);
    this.startTimer(m.pickMs);
    const chips = m.intents.map((i) => this.intentChip(i, () => this.pickIntent(m.seq, i.id)));
    const fin = m.finish
      ? h(
          'button',
          { class: 'bout-intent finalizar', type: 'button', 'data-intent': 'finalizar', onclick: () => this.pickIntent(m.seq, 'finalizar') },
          h('b', { class: 'pt' }, 'Finalização!'),
          en('Go for the submission'),
        )
      : null;
    if (m.finish) {
      this.sfx('gasp');
    }
    this.body.replaceChildren(
      h(
        'div',
        { class: 'bout-intents', id: 'bout-intents', 'data-finish': String(m.finish), 'data-seq': String(m.seq) },
        h('div', { class: 'bout-ask' }, ...this.bi('O que você faz?', 'What do you do?'), this.quitBtn()),
        fin,
        h('div', { class: 'bout-chips' }, ...chips),
        this.timerBar(),
      ),
    );
    this.measure();
  }

  private intentChip(i: BoutIntentOut, pick: () => void): HTMLElement {
    const risk = RISK_LABEL[i.risk];
    return h(
      'button',
      { class: `bout-intent risk-${i.risk}`, type: 'button', 'data-intent': i.id, 'aria-label': `${i.pt}, ${risk.pt}`, onclick: pick },
      h('span', { class: 'pips', title: `${risk.pt} · ${risk.en}` }, ...[1, 2, 3].map((n) => h('i', { class: n <= i.risk ? 'on' : '' }))),
      h('b', { class: 'pt' }, i.pt),
      en(i.en),
    );
  }

  private pickIntent(seq: number, intent: BoutIntentOut['id'] | 'finalizar'): void {
    if (this.locked || seq !== this.seq) return;
    this.locked = true;
    this.sfx('tick');
    this.send({ action: 'intent', seq, intent });
    this.body.querySelectorAll('button').forEach((b) => b.setAttribute('disabled', ''));
    this.body.querySelector(`[data-intent="${intent}"]`)?.classList.add('picked');
  }

  // ------------------------------------------------------------------ challenge
  private challenge(m: Msg<'challenge'>): void {
    this.setPhase('challenge');
    this.seq = m.seq;
    this.locked = false;
    this.order = [];
    this.sentAt = performance.now();
    this.setSnap(m.st);
    this.startTimer(m.limitMs);
    const c = m.challenge;
    const role = m.role === 'finish' ? 'Finalização' : m.role === 'escape' ? 'Defesa' : null;
    const roleEn = m.role === 'finish' ? (m.steps > 1 ? `Submission: step ${m.step} of ${m.steps}` : 'Submission') : m.role === 'escape' ? 'Escape!' : '';
    const head = h(
      'div',
      { class: 'bout-chead' },
      role ? h('span', { class: `bout-role role-${m.role}` }, m.role === 'finish' && m.steps > 1 ? `${role} ${m.step}/${m.steps}` : role, en(roleEn)) : this.intentTag(m.intent),
      this.quitBtn(),
    );
    const prompt = h('div', { class: 'bout-prompt' }, h('b', { class: 'pt' }, c.prompt.pt), en(c.prompt.en));
    const card = h('div', { class: `bout-challenge kind-${c.kind}`, id: 'bout-challenge', 'data-kind': c.kind, 'data-seq': String(m.seq) }, head, this.ring(), prompt, this.answerArea(m, c));
    if (c.debugCorrect !== undefined) card.setAttribute('data-debug', JSON.stringify(c.debugCorrect));
    this.body.replaceChildren(card);
    this.measure();
    if (c.kind === 'listening' && c.listenPt) {
      window.setTimeout(() => speak(c.listenPt!, { force: true }), 250);
    }
    if (c.kind === 'typed') {
      const input = card.querySelector('input');
      if (input && !window.matchMedia('(pointer: coarse)').matches) window.setTimeout(() => (input as HTMLInputElement).focus({ preventScroll: true }), 60);
    }
  }

  private intentTag(id: string | null): HTMLElement {
    const def = id ? INTENTS[id as keyof typeof INTENTS] : undefined;
    return h('span', { class: 'bout-role role-exchange' }, def ? def.pt : '', def ? en(def.en) : '');
  }

  private answerArea(m: Msg<'challenge'>, c: ChallengeView): HTMLElement {
    const seq = m.seq;
    if (c.kind === 'reorder' && c.tokens) return this.reorderArea(seq, c);
    if (c.kind === 'typed') return this.typedArea(seq, c);
    const listen =
      c.kind === 'listening' && c.listenPt
        ? h('button', { class: 'bout-listen', type: 'button', 'aria-label': 'Ouvir de novo (Listen again)', onclick: () => speak(c.listenPt!, { force: true }) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '🔊'), ...this.bi('Ouvir', 'Listen'))
        : null;
    const opts = (c.options ?? []).map((o, i) =>
      h('button', { class: 'bout-opt', type: 'button', 'data-i': String(i), onclick: (e: Event) => this.pickOption(seq, i, e.currentTarget as HTMLElement) }, h('b', { class: 'pt' }, o.pt), o.en !== o.pt ? en(o.en) : null),
    );
    return h('div', { class: 'bout-answer' }, listen, h('div', { class: `bout-opts n${opts.length}` }, ...opts));
  }

  private pickOption(seq: number, index: number, el: HTMLElement): void {
    if (this.locked || seq !== this.seq) return;
    this.locked = true;
    el.classList.add('picked');
    this.lockAnswers();
    this.send({ action: 'answer', seq, answer: { kind: 'choice', index } });
  }

  private reorderArea(seq: number, c: ChallengeView): HTMLElement {
    const tokens = c.tokens!;
    const row = h('div', { class: 'bout-order', id: 'bout-order' });
    const bank = h('div', { class: 'bout-bank', id: 'bout-bank' });
    const redraw = () => {
      row.replaceChildren(
        ...this.order.map((i) =>
          h('button', { class: 'bout-token placed', type: 'button', 'data-i': String(i), onclick: () => this.unplace(i, redraw) }, tokens.find((t) => t.i === i)?.pt ?? ''),
        ),
      );
      bank.querySelectorAll<HTMLButtonElement>('.bout-token').forEach((b) => {
        b.hidden = this.order.includes(Number(b.dataset.i));
      });
    };
    for (const t of tokens)
      bank.append(
        h('button', { class: 'bout-token', type: 'button', 'data-i': String(t.i), onclick: () => this.place(seq, t.i, tokens.length, redraw) }, t.pt),
      );
    return h('div', { class: 'bout-answer bout-reorder' }, row, bank);
  }

  private place(seq: number, i: number, total: number, redraw: () => void): void {
    if (this.locked || seq !== this.seq || this.order.includes(i)) return;
    this.order.push(i);
    redraw();
    if (this.order.length >= total) {
      this.locked = true;
      this.lockAnswers();
      this.send({ action: 'answer', seq, answer: { kind: 'order', order: [...this.order] } });
    }
  }

  private unplace(i: number, redraw: () => void): void {
    if (this.locked) return;
    this.order = this.order.filter((x) => x !== i);
    redraw();
  }

  private typedArea(seq: number, c: ChallengeView): HTMLElement {
    const input = h('input', { type: 'text', class: 'bout-typed-input', id: 'bout-typed', maxLength: c.maxLen ?? 24, autocomplete: 'off', autocapitalize: 'none', spellcheck: false, 'aria-label': 'Sua resposta (Your answer)', placeholder: 'Escreva aqui…' }) as HTMLInputElement;
    const send = () => {
      const text = input.value.trim();
      if (this.locked || seq !== this.seq || !text) return;
      this.locked = true;
      this.lockAnswers();
      this.send({ action: 'answer', seq, answer: { kind: 'text', text } });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send();
      }
    });
    return h('div', { class: 'bout-answer bout-typed' }, input, h('button', { class: 'bout-send primary', type: 'button', onclick: send }, ...this.bi('Responder', 'Answer')), h('span', { class: 'bout-note' }, ...this.bi('Acentos são opcionais.', 'Accents are optional.')));
  }

  private lockAnswers(): void {
    this.body.querySelectorAll('button, input').forEach((b) => b.setAttribute('disabled', ''));
  }

  // ------------------------------------------------------------------ resolve
  private resolve(m: Msg<'resolve'>): void {
    this.setPhase('resolve');
    this.locked = true;
    this.stopTimer();
    this.setSnap(m.st);
    const banner = resultBanner({ yours: m.yours });
    const picked = this.body.querySelector('.picked');
    picked?.classList.add(m.yours.correct ? 'right' : 'wrong');
    const call = callOf(m);
    this.lastBanner = banner.pt;
    this.body.replaceChildren(
      h(
        'div',
        { class: `bout-resolve ${m.yours.correct ? 'right' : 'wrong'}`, id: 'bout-resolve', 'data-correct': String(m.yours.correct) },
        h('b', { class: 'bout-banner' }, banner.pt),
        en(banner.en),
        call ? h('div', { class: 'bout-called', id: 'bout-called' }, h('b', null, call.pt), en(call.en)) : null,
        h('span', { class: 'bout-who' }, `${this.partnerName}: ${INTENTS[m.partner.intent]?.pt ?? ''} ${m.partner.correct ? '✓' : '✗'}`),
      ),
    );
    for (const c of cuesForResolve(m)) boutFeed.push(c);
    if (m.events.some((e) => e.type === 'transition')) this.sfx('slap');
    if (call) {
      this.sfx(m.events.some((e) => e.type === 'points' && e.side === 'you') ? 'cheer' : 'claps');
      this.say(call.pt);
    } else if (!m.yours.correct) this.sfx('gasp');
    this.measure();
  }

  private finishEnd(m: Msg<'finish_end'>): void {
    this.setPhase('finish_end');
    this.locked = true;
    this.stopTimer();
    const prev = this.snap;
    this.setSnap(m.st);
    for (const c of cuesForFinishEnd(m, prev)) boutFeed.push(c);
    if (m.kind === 'finalizacao' && m.success) {
      this.sfx('tapout');
      this.sfx('whistle');
    } else if (m.kind === 'escape' && !m.success) {
      this.sfx('tapout');
      this.sfx('whistle');
    } else this.sfx('gasp');
    this.say(m.line.pt);
    this.body.replaceChildren(h('div', { class: `bout-resolve ${m.success ? 'right' : 'wrong'}`, id: 'bout-finish-end', 'data-success': String(m.success) }, h('b', { class: 'bout-banner' }, m.line.pt), en(m.line.en)));
    this.measure();
  }

  // ------------------------------------------------------------------ end
  private end(m: Msg<'end'>): void {
    this.setPhase('end');
    this.locked = false;
    this.stopTimer();
    this.snap = m.st;
    this.snapAt = performance.now();
    this.bjj = m.bjj;
    if (game.profile) game.profile.bjj = m.bjj;
    this.renderTop();
    this.renderMeters();
    for (const c of cuesForEnd(m)) boutFeed.push(c);
    if (m.winner === 'you') {
      this.sfx('cheer');
      this.sfx('whistle');
    } else if (m.winner !== 'none') this.sfx('claps');
    this.say(m.line.pt);
    window.setTimeout(() => this.say(m.thanks.pt), 1900);
    const again = h('button', { class: 'bout-go primary', id: 'bout-again', type: 'button', onclick: () => this.again() }, ...this.bi('De novo', 'Rematch'));
    const leave = h('button', { class: 'ghost', id: 'bout-leave', type: 'button', onclick: () => this.leave() }, ...this.bi('Sair', 'Leave'));
    const lines: HTMLElement[] = [];
    if (m.beltUp) lines.push(h('p', { class: 'bout-promo belt-up' }, ...this.bi('Faixa azul conquistada!', 'Blue belt earned!')));
    else if (m.stripeUp) lines.push(h('p', { class: 'bout-promo' }, ...this.bi('Nova listra!', 'New stripe!')));
    if (m.bond > 0) lines.push(h('p', { class: 'bout-bond' }, '♥ ', ...this.bi('Professora Bia gostou do treino.', 'Professora Bia enjoyed the match.')));
    this.body.replaceChildren(
      h(
        'div',
        { class: `bout-end result-${m.winner}`, id: 'bout-end', 'data-winner': m.winner, 'data-reason': m.reason },
        h('div', { class: 'bout-end-line' }, h('b', null, m.line.pt), en(m.line.en)),
        m.rv > 0 ? h('div', { class: 'bout-rv' }, `+${m.rv} RV`) : null,
        this.beltRow(m.bjj),
        ...lines,
        h('p', { class: 'bout-thanks' }, ...this.bi(m.thanks.pt, m.thanks.en)),
        h('div', { class: 'bout-end-actions' }, leave, m.winner === 'none' ? null : again),
      ),
    );
    this.measure();
  }

  private again(): void {
    boutFeed.end();
    this.send({ action: 'open' });
  }

  private leave(): void {
    this.destroy();
    this.a.closed();
  }

  private quit(): void {
    const now = performance.now();
    if (now - this.quitArmed < 3000) {
      this.send({ action: 'quit' });
      // the server answers with an end card; leave straight away
      window.setTimeout(() => this.leave(), 60);
      return;
    }
    this.quitArmed = now;
    const btn = this.panel.querySelector('.bout-quit');
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

  private quitBtn(): HTMLElement {
    return h('button', { class: 'bout-quit ghost', type: 'button', 'aria-label': 'Sair (Leave)', title: 'Sair / Leave', onclick: () => (this.phase === 'lobby' ? this.leave() : this.quit()) }, h('span', { 'aria-hidden': 'true' }, '✕'));
  }

  private enToggle(): HTMLElement {
    return h(
      'button',
      {
        class: 'bout-entoggle ghost',
        type: 'button',
        role: 'switch',
        'aria-checked': String(this.showEn),
        title: 'Mostrar inglês / Show English',
        onclick: (e: Event) => {
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

  // ------------------------------------------------------------------ scoreboard, meters, timers
  private renderTop(): void {
    const s = this.snap;
    const me = game.profile?.name ?? 'Você';
    const side = (cls: string, name: string, pts: number, adv: number, extra?: HTMLElement | null) =>
      h(
        'div',
        { class: `bout-side ${cls}` },
        h('span', { class: 'bout-name' }, name, extra),
        h('span', { class: 'bout-num pts', 'data-k': 'pontos' }, String(pts)),
        h('span', { class: 'bout-num adv', 'data-k': 'vantagens' }, String(adv)),
      );
    const labels = h('div', { class: 'bout-labels' }, h('span', null, 'Pontos', en('Points', true)), h('span', null, 'Vantagens', en('Advantages', true)));
    const clock = h('div', { class: 'bout-clock', id: 'bout-clock', 'data-k': 'tempo' }, h('b', { id: 'bout-clock-t' }, this.clockShown), h('span', null, 'Tempo', en('Time', true)));
    const belt = this.bjj ? h('i', { class: `belt-dot belt-${this.bjj.belt}`, title: BELT_LABELS[this.bjj.belt].pt }) : null;
    this.top.replaceChildren(
      side('you', me, s?.points.you ?? 0, s?.adv.you ?? 0, belt),
      h('div', { class: 'bout-mid' }, clock, labels),
      side('partner', this.partnerId ? this.partnerName : 'Parceiro', s?.points.partner ?? 0, s?.adv.partner ?? 0),
    );
    this.top.dataset.shown = this.snap ? '1' : '0';
  }

  private renderMeters(): void {
    const s = this.snap;
    if (!s) {
      this.meters.replaceChildren();
      return;
    }
    const pos = POSITION_LABELS[s.position];
    const who = s.ahead === 'you' ? 'você por cima' : s.ahead === 'partner' ? `${this.partnerName} por cima` : 'em pé';
    const whoEn = s.ahead === 'you' ? 'you on top' : s.ahead === 'partner' ? 'partner on top' : 'standing';
    const frac = momentumFrac(s.momentum);
    const bar = h(
      'div',
      { class: 'bout-momentum', id: 'bout-momentum', role: 'meter', 'aria-label': 'Impulso (Momentum)', 'aria-valuenow': String(Math.round(frac * 100)), 'data-m': String(Math.round(s.momentum)) },
      h('span', { class: 'lbl l' }, this.partnerId ? this.partnerName : 'Parceiro'),
      h('div', { class: 'track' }, h('i', { class: 'fill', style: `${frac >= 0 ? 'left:50%' : `left:${50 + frac * 50}%`};width:${Math.abs(frac) * 50}%` }), h('i', { class: 'mid' })),
      h('span', { class: 'lbl r' }, 'Você'),
    );
    const pegada = h(
      'div',
      { class: 'bout-pegada', id: 'bout-pegada', 'data-n': String(s.pegada), title: 'Pegada: respostas rápidas enchem / Grip: quick answers fill it' },
      h('span', { class: 'lbl' }, 'Pegada', en('Grip', true)),
      ...Array.from({ length: PEGADA_MAX }, (_, i) => h('i', { class: i < s.pegada ? 'on' : '' })),
    );
    const ladder = h('div', { class: 'bout-ladder', id: 'bout-ladder', 'data-rung': String(s.rung) }, ...ladderDots(s.rung).map((d) => h('i', { class: `${d.here ? 'here' : ''} ${d.filled ? 'fill' : ''}${d.rung === 0 ? ' mid' : ''}`.trim() })));
    this.meters.replaceChildren(
      h('div', { class: 'bout-pos', id: 'bout-pos', 'data-pos': s.position }, h('b', null, pos.pt), ' ', h('span', { class: 'who' }, `· ${who}`), en(` ${pos.en} · ${whoEn}`)),
      bar,
      h('div', { class: 'bout-row2' }, pegada, ladder),
    );
  }

  private timerBar(): HTMLElement {
    return h('div', { class: 'bout-timerbar', id: 'bout-timerbar' }, h('i'));
  }

  private ring(): HTMLElement {
    return h(
      'div',
      { class: 'bout-ring', id: 'bout-ring', role: 'timer', 'aria-label': 'Tempo (Time)' },
      svgRing(),
      h('b', { class: 'secs' }, ''),
    );
  }

  private startTimer(ms: number): void {
    this.timer = { end: performance.now() + ms, ms };
  }

  private stopTimer(): void {
    this.timer = null;
    const ring = this.root.querySelector('.bout-ring');
    ring?.classList.remove('low');
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    if (this.timer) {
      const left = Math.max(0, this.timer.end - now);
      const f = left / this.timer.ms;
      const ring = this.root.querySelector<HTMLElement>('.bout-ring');
      if (ring) {
        const fg = ring.querySelector<SVGCircleElement>('circle.fg');
        if (fg) fg.style.strokeDashoffset = String((1 - f) * RING_LEN);
        ring.classList.toggle('low', f < 0.3);
        const secs = ring.querySelector('.secs');
        const t = String(Math.ceil(left / 1000));
        if (secs && secs.textContent !== t) secs.textContent = t;
      }
      const bar = this.root.querySelector<HTMLElement>('#bout-timerbar i');
      if (bar) {
        bar.style.width = `${f * 100}%`;
        bar.parentElement?.classList.toggle('low', f < 0.3);
      }
    }
    // the clock runs faster than real time while an exchange is on
    if (this.snap) {
      const running = this.phase === 'intent' || this.phase === 'challenge';
      const t = clockAt(this.snap.clockMs, now - this.snapAt, CLOCK_RATE, running);
      if (t !== this.clockShown) {
        this.clockShown = t;
        const el = this.top.querySelector('#bout-clock-t');
        if (el) el.textContent = t;
      }
    }
  };
}

const RING_LEN = 94.25;
function svgRing(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cls: string) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('class', cls);
    c.setAttribute('cx', '18');
    c.setAttribute('cy', '18');
    c.setAttribute('r', '15');
    c.setAttribute('fill', 'none');
    return c;
  };
  const fg = mk('fg');
  fg.style.strokeDasharray = String(RING_LEN);
  fg.style.strokeDashoffset = '0';
  svg.append(mk('bg'), fg);
  return svg;
}
