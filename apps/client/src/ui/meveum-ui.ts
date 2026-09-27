import {
  MG_ITEMS,
  MG_MAX_TRAY,
  MG_MODS,
  mgModById,
  mgPrepStation,
  ticketNeedsPack,
  type MgBuiltUnit,
  type MgServerMsg,
  type Tray,
} from '@tudobem/shared';
import { h, en, bi } from './dom';
import { foodIcon } from '../render/icons';
import { speak } from '../audio';
import { stationBatchSize } from './meveum-batch.js';
import { nextMgClock } from './meveum-clock.js';
import { openModal } from './modal.js';

type Wip = MgBuiltUnit;

function wipNeeds(wip: Wip, order: Extract<MgServerMsg, { phase: 'order' }> | null): 'chapa' | 'bebidas' | 'pack' | 'tray' | null {
  const prep = mgPrepStation(wip.itemId);
  if (prep === 'chapa' && !wip.chapa) return 'chapa';
  if (prep === 'bebidas' && !wip.bebidas) return 'bebidas';
  if (order && ticketNeedsPack(order.mods) && !wip.pack) return 'pack';
  return 'tray';
}

function wipReady(wip: Wip, order: Extract<MgServerMsg, { phase: 'order' }> | null): boolean {
  return wipNeeds(wip, order) === 'tray';
}

// ---------------------------------------------------------------- Me vê um… — station builder

export class MinigameUI {
  private tray: Tray = {};
  private built: MgBuiltUnit[] = [];
  private mods = new Set<string>();
  private wip: Wip | null = null;
  private order: Extract<MgServerMsg, { phase: 'order' }> | null = null;
  private orderAt = 0;
  private raf = 0;
  private locked = false;
  private close: () => void;
  private ticket = h('div', { class: 'ticket', id: 'mg-ticket' });
  private timer = h('div', { class: 'timer' }, h('div'));
  private trayEl = h('div', { class: 'tray', id: 'mg-tray' });
  private carlos = h('div', { class: 'carlos-says' });
  private score = h('div', { class: 'score' });
  private wipEl = h('div', { class: 'wip-slot', id: 'mg-wip' });
  private body: HTMLElement;
  private panel: HTMLElement;
  private timedOut = false;
  private timeoutNotBefore = 0;
  /** When the UI locked waiting for the server. A dropped reply must not freeze the shift. */
  private lockedAt = 0;
  /** Retry clock has been started for this ticket (so a later resync does not add another full bar). */
  private repeatArmed = false;
  private dragItem: string | null = null;
  private stationEls: Record<string, HTMLElement> = {};
  /** Units past chapa/bebidas waiting for pack / tray (batch prep). */
  private prepQueue: Wip[] = [];
  private stationGoBtns: Partial<Record<'chapa' | 'bebidas', HTMLButtonElement>> = {};
  /** Place / clear / serve, pinned under the scrolling kitchen so a tall staging card cannot push them off. */
  private trayActions!: HTMLElement;

  constructor(
    private actions: {
      submit: (t: Tray, mods: string[], built: MgBuiltUnit[]) => void;
      timeout: () => void;
      quit: () => void;
      again: () => void;
      sync: () => void;
    },
  ) {
    const shelfGrid = h('div', { class: 'station-items', id: 'mg-shelves' });
    MG_ITEMS.forEach((item, i) => {
      const keyLabel = i < 9 ? String(i + 1) : ['0', '-', '='][i - 9] ?? '';
      const btn = h(
        'button',
        {
          onclick: () => this.grab(item.id),
          'data-item': item.id,
          title: item.card.gloss_en,
          onpointerdown: (e: PointerEvent) => {
            this.dragItem = item.id;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          },
          onpointerup: (e: PointerEvent) => this.onPointerDrop(e),
        },
        h('kbd', null, keyLabel),
        h('img', { src: foodIcon(item.id), alt: '' }),
        h('span', { class: 'pt' }, item.card.form),
        en(item.card.gloss_en),
      );
      shelfGrid.append(btn);
    });

    const mkStation = (id: string, pt: string, enText: string, extra: HTMLElement, goPt: string, goEn: string, onGo: () => void, batchStation?: 'chapa' | 'bebidas') => {
      const goBtn = h('button', { class: 'station-go', type: 'button', onclick: onGo }, bi(goPt, goEn)) as HTMLButtonElement;
      if (batchStation) this.stationGoBtns[batchStation] = goBtn;
      const el = h(
        'div',
        {
          class: `station ${id}`,
          id: `mg-station-${id}`,
          'data-station': id,
          onpointerup: (e: PointerEvent) => this.onStationTap(id, e),
        },
        h('div', { class: 'station-label' }, h('span', { class: 'pt' }, pt), en(enText, true)),
        extra,
        goBtn,
      );
      this.stationEls[id] = el;
      return el;
    };

    const modsEl = h('div', { class: 'mods pack-mods', id: 'mg-mods' });
    MG_MODS.forEach((m) =>
      modsEl.append(
        h(
          'button',
          {
            type: 'button',
            class: this.mods.has(m.id) ? 'on' : '',
            onclick: () => this.toggleMod(m.id),
            'data-mod': m.id,
            'aria-pressed': String(this.mods.has(m.id)),
          },
          h('span', { class: 'pt' }, m.pt),
          en(m.en, true),
        ),
      ),
    );

    const kitchen = h(
      'div',
      { class: 'mg-kitchen', id: 'mg-kitchen' },
      h('div', { class: 'station shelf', id: 'mg-station-shelf' }, h('div', { class: 'station-label' }, h('span', { class: 'pt' }, 'Prateleira'), en('Grab from the case', true)), shelfGrid),
      mkStation(
        'chapa',
        'Chapa',
        'Grill / heat',
        h('div', { class: 'station-slot', id: 'mg-chapa-slot' }),
        'Grelhar ✓',
        'Grill it',
        () => this.runStation('chapa'),
        'chapa',
      ),
      mkStation(
        'bebidas',
        'Bebidas',
        'Pour drinks',
        h('div', { class: 'station-slot', id: 'mg-bebidas-slot' }),
        'Servir ✓',
        'Pour it',
        () => this.runStation('bebidas'),
        'bebidas',
      ),
      mkStation('pack', 'Embalagem', 'Bag or plate', modsEl, 'Embalar ✓', 'Pack it', () => this.runStation('pack')),
      h(
        'div',
        { class: 'station tray-station', id: 'mg-station-tray', 'data-station': 'tray', onpointerup: (e: PointerEvent) => this.onStationTap('tray', e) },
        h('div', { class: 'station-label' }, h('span', { class: 'pt' }, 'Bandeja'), en('Place on tray', true)),
        this.wipEl,
        this.trayEl,
      ),
    );

    const trayActions = h(
      'div',
      { class: 'row tray-actions' },
      h('button', { type: 'button', id: 'mg-tray-place', onclick: () => this.placeOnTray() }, bi('Colocar na bandeja', 'Place on tray')),
      h('button', { type: 'button', id: 'mg-clear', onclick: () => this.clearTray() }, bi('Limpar', 'Clear')),
      h('span', { class: 'spacer' }),
      h('button', { class: 'green serve-bell', type: 'button', onclick: () => this.submit(), id: 'mg-submit' }, bi('Entregar 🔔', 'Serve (Enter)')),
    );
    this.trayActions = trayActions;

    this.body = h('div', { class: 'mg-body mg-body-stations' }, kitchen, h('div', { class: 'side' }, this.carlos, this.score));
    this.panel = h(
      'div',
      { class: 'panel mg', id: 'minigame' },
      h(
        'div',
        { class: 'mg-head' },
        h('h2', null, 'Me vê um…'),
        en('Build each order at the stations — chapa, drinks, bag, then serve!', true),
        h('span', { class: 'spacer' }),
        h('button', { class: 'ghost', type: 'button', onclick: () => this.quit() }, '✕'),
      ),
      h('div', { class: 'rail' }, this.ticket, this.timer),
      this.body,
      trayActions,
    );
    this.close = openModal('minigame', this.panel, { dismissable: false, onClose: () => this.cleanup() });
    document.addEventListener('keydown', this.onKey);
    this.renderAll();
    this.carlos.replaceChildren(h('b', null, 'Seu Carlos: '), '“Monta o pedido nas estações — capricha!”', en('Build at each station — take your time, but the clock is ticking!'));
  }

  private onPointerDrop(e: PointerEvent) {
    if (!this.dragItem) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const station = el?.closest('[data-station]') as HTMLElement | null;
    const id = this.dragItem;
    this.dragItem = null;
    if (!station) return;
    this.grab(id);
    const st = station.dataset.station;
    if (st) this.onStationDrop(st, e);
  }

  /** Tap on a station's open area. Taps on its own buttons are left to their click handlers. */
  private onStationTap(stationId: string, e: PointerEvent) {
    // Acting here too would run the button twice (one "Colocar na bandeja" tap placing two batch units).
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    this.onStationDrop(stationId, e);
  }

  private onStationDrop(stationId: string, _e: PointerEvent) {
    if (this.locked || !this.order) return;
    if (!this.wip) return;
    const need = wipNeeds(this.wip, this.order);
    if (need === stationId || (stationId === 'tray' && need === 'tray')) {
      if (stationId === 'tray') this.placeOnTray();
      else this.runStation(stationId as 'chapa' | 'bebidas' | 'pack');
    }
  }

  private grab(id: string) {
    if (this.locked || !this.order) return;
    if (this.wip) return;
    const total = Object.values(this.tray).reduce((a, b) => a + b, 0);
    if (total >= MG_MAX_TRAY) return;
    this.wip = { itemId: id, shelf: true };
    this.renderWip();
    this.renderStationButtons();
    this.pulseNext();
  }

  private runStation(id: 'chapa' | 'bebidas' | 'pack') {
    if (this.locked || !this.order || !this.wip) return;
    const need = wipNeeds(this.wip, this.order);
    if (need !== id) return;
    if (id === 'chapa' || id === 'bebidas') {
      const batch = this.batchSizeFor(id);
      if (batch > 1) return this.runStationBatch(id, batch);
    }
    if (id === 'chapa') this.wip = { ...this.wip, chapa: true };
    else if (id === 'bebidas') this.wip = { ...this.wip, bebidas: true };
    else if (id === 'pack') {
      this.wip = { ...this.wip, pack: true };
      const where = this.order.mods.find((m: string) => mgModById(m)?.group === 'where');
      if (where) {
        for (const m of MG_MODS) if (m.group === 'where') this.mods.delete(m.id);
        this.mods.add(where);
        this.renderMods();
      }
    }
    this.flashStation(id);
    this.renderWip();
    this.renderStationButtons();
    this.pulseNext();
    if (wipReady(this.wip, this.order)) this.wipEl.classList.add('ready');
  }

  private batchSizeFor(station: 'chapa' | 'bebidas'): number {
    if (!this.order || !this.wip) return 1;
    if (wipNeeds(this.wip, this.order) !== station) return 1;
    const itemId = this.wip.itemId;
    if (mgPrepStation(itemId) !== station) return 1;
    const line = this.order.lines?.find((l) => l.itemId === itemId);
    if (!line) return 1;
    const trayTotal = Object.values(this.tray).reduce((a, b) => a + b, 0);
    const queuedSame = this.prepQueue.filter((u) => u.itemId === itemId).length;
    return stationBatchSize({
      lineQty: line.qty,
      onTray: this.tray[itemId] ?? 0,
      queuedSame,
      trayTotal,
      queuedOther: this.prepQueue.length - queuedSame,
      maxTray: MG_MAX_TRAY,
    });
  }

  private runStationBatch(station: 'chapa' | 'bebidas', n: number) {
    if (!this.order || !this.wip) return;
    const itemId = this.wip.itemId;
    const units: Wip[] = [];
    for (let i = 0; i < n; i++) {
      const u: Wip = { itemId, shelf: true };
      if (station === 'chapa') u.chapa = true;
      else u.bebidas = true;
      units.push(u);
    }
    this.prepQueue = [...units.slice(1), ...this.prepQueue];
    this.wip = units[0]!;
    this.flashStation(station);
    this.renderAll();
  }

  private flashStation(id: string) {
    const stEl = this.stationEls[id];
    stEl?.classList.add('pop');
    window.setTimeout(() => stEl?.classList.remove('pop'), 320);
  }

  private renderStationButtons() {
    if (!this.order) return;
    for (const station of ['chapa', 'bebidas'] as const) {
      const btn = this.stationGoBtns[station];
      if (!btn) continue;
      const batch = this.batchSizeFor(station);
      const pt = station === 'chapa' ? (batch > 1 ? `Grelhar ×${batch}` : 'Grelhar ✓') : batch > 1 ? `Servir ×${batch}` : 'Servir ✓';
      const en = station === 'chapa' ? (batch > 1 ? `Grill ×${batch}` : 'Grill it') : batch > 1 ? `Pour ×${batch}` : 'Pour it';
      btn.replaceChildren(bi(pt, en));
      btn.classList.toggle('batch', batch > 1);
    }
  }

  private placeOnTray() {
    if (this.locked || !this.order || !this.wip) return;
    if (!wipReady(this.wip, this.order)) return;
    this.takeOne();
    this.renderAll();
    this.pulseNext();
  }

  private takeOne() {
    if (!this.wip) return;
    this.built.push({ ...this.wip });
    const id = this.wip.itemId;
    this.tray[id] = (this.tray[id] ?? 0) + 1;
    this.wip = this.prepQueue.shift() ?? null;
  }

  /** Entregar / Enter: commit every unit that's already ready, then stop at the first that still needs a station. */
  private commitReady(): boolean {
    if (!this.order) return false;
    let placed = false;
    while (this.wip && wipReady(this.wip, this.order)) {
      this.takeOne();
      placed = true;
    }
    return placed;
  }

  private toggleMod(id: string) {
    if (this.locked || !this.order) return;
    const mod = mgModById(id)!;
    if (this.mods.has(id)) this.mods.delete(id);
    else {
      if (mod.group === 'where') for (const m of MG_MODS) if (m.group === 'where') this.mods.delete(m.id);
      this.mods.add(id);
    }
    this.renderMods();
  }

  private renderMods() {
    this.panel.querySelectorAll('#mg-mods button').forEach((btn) => {
      const id = (btn as HTMLElement).dataset.mod!;
      btn.classList.toggle('on', this.mods.has(id));
      btn.setAttribute('aria-pressed', String(this.mods.has(id)));
    });
  }

  private clearTray() {
    if (this.locked) return;
    this.tray = {};
    this.built = [];
    this.wip = null;
    this.prepQueue = [];
    this.mods.clear();
    this.renderAll();
  }

  private renderWip() {
    if (!this.wip) {
      this.wipEl.replaceChildren(h('div', { class: 'empty' }, 'Pega na prateleira →', en('Grab from shelf →', true)));
      this.wipEl.classList.remove('ready');
      return;
    }
    const need = this.order ? wipNeeds(this.wip, this.order) : null;
    this.wipEl.replaceChildren(
      h('img', { src: foodIcon(this.wip.itemId, 56), alt: '' }),
      h('div', { class: 'wip-hint' }, need === 'tray' ? bi('Pronto pra colocar', 'Ready to place') : bi(`Próximo: ${stationLabel(need)}`, `Next: ${stationLabelEn(need)}`)),
    );
    this.wipEl.classList.toggle('ready', !!this.order && wipReady(this.wip, this.order));
  }

  private renderTray() {
    const entries = Object.entries(this.tray).filter(([, n]) => n > 0);
    if (!entries.length) {
      this.trayEl.replaceChildren(h('div', { class: 'empty' }, 'Bandeja vazia', en('Empty tray', true)));
      return;
    }
    this.trayEl.replaceChildren(
      ...entries.map(([id, n]) =>
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              if (this.locked || !this.order) return;
              this.tray[id]--;
              if (this.tray[id] <= 0) delete this.tray[id];
              let idx = -1;
              for (let i = this.built.length - 1; i >= 0; i--) {
                if (this.built[i]!.itemId === id) {
                  idx = i;
                  break;
                }
              }
              if (idx >= 0) this.built.splice(idx, 1);
              this.renderTray();
            },
            title: 'Tirar / remove',
          },
          h('img', { src: foodIcon(id, 48), alt: id }),
          h('span', null, `×${n}`),
        ),
      ),
    );
  }

  private pulseNext() {
    for (const el of Object.values(this.stationEls)) el.classList.remove('pulse');
    this.panel.querySelectorAll('.station').forEach((el) => el.classList.remove('pulse'));
    if (!this.wip || !this.order) return;
    const need = wipNeeds(this.wip, this.order);
    if (need === 'tray') this.panel.querySelector('#mg-station-tray')?.classList.add('pulse');
    else if (need) this.panel.querySelector(`#mg-station-${need}`)?.classList.add('pulse');
  }

  private renderAll() {
    this.renderWip();
    this.renderTray();
    this.renderMods();
    this.renderStationButtons();
    this.pulseNext();
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const idx = e.key === '0' ? 9 : e.key === '-' ? 10 : e.key === '=' ? 11 : Number(e.key) - 1;
    if (idx >= 0 && idx < MG_ITEMS.length && /^[0-9=-]$/.test(e.key)) this.grab(MG_ITEMS[idx].id);
    if (e.key === 'Enter' && !e.repeat) this.submit();
    if (e.key === 'Backspace') this.clearTray();
  };

  private cleanup() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.onKey);
  }

  private submit() {
    if (this.locked || !this.order) return;
    if (this.commitReady()) this.renderAll();
    if (this.wip || this.prepQueue.length) {
      this.pulseNext();
      return;
    }
    this.lockUi();
    this.actions.submit({ ...this.tray }, [...this.mods], [...this.built]);
  }

  private lockUi() {
    this.locked = true;
    this.lockedAt = performance.now();
  }

  private unlockUi() {
    this.locked = false;
    this.timedOut = false;
    this.lockedAt = 0;
  }

  private quit() {
    if (!this.order) {
      this.close();
      return;
    }
    this.lockUi();
    this.actions.quit();
  }

  private ensureTick() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    try {
      if (!this.order) return;
      const now = performance.now();
      if (this.locked && this.lockedAt && now - this.lockedAt > 2_000) {
        this.lockedAt = now;
        this.actions.sync();
      }
      const left = Math.max(0, this.order.timeMs - (now - this.orderAt));
      const f = this.order.timeMs > 0 ? left / this.order.timeMs : 0;
      const bar = this.timer.firstElementChild as HTMLElement | null;
      if (bar) bar.style.transform = `scaleX(${f})`;
      this.timer.classList.toggle('low', f < 0.25);
      if (left <= 0 && !this.locked && !this.timedOut && now >= this.timeoutNotBefore) {
        this.timedOut = true;
        this.lockUi();
        this.actions.timeout();
      }
    } catch (err) {
      console.error('Me vê um… timer', err);
    }
    if (this.order) this.raf = requestAnimationFrame(this.tick);
  };

  handle(m: MgServerMsg) {
    try {
      this.handleMsg(m);
    } catch (err) {
      console.error('Me vê um… UI error', err);
      this.unlockUi();
      this.carlos.replaceChildren(
        h('b', null, 'Seu Carlos: '),
        '“Ops, travou um instante — continua o pedido!”',
        en('Oops, a tiny glitch — keep building the order!'),
      );
    }
  }

  private handleMsg(m: MgServerMsg) {
    if (m.phase === 'order') {
      const clock = nextMgClock(
        { orderAt: this.orderAt, timeoutNotBefore: this.timeoutNotBefore, repeatArmed: this.repeatArmed },
        m,
        this.order ? { round: this.order.round, pt: this.order.pt } : null,
        performance.now(),
      );
      if (clock.hold) {
        this.order = m;
        this.timeoutNotBefore = clock.clock.timeoutNotBefore;
        this.unlockUi();
        this.ensureTick();
        return;
      }
      const keepTray = !!m.repeat && this.order?.round === m.round && this.order.pt === m.pt;
      this.order = m;
      this.orderAt = clock.clock.orderAt;
      this.timeoutNotBefore = clock.clock.timeoutNotBefore;
      this.repeatArmed = clock.clock.repeatArmed;
      this.unlockUi();
      if (!keepTray) {
        this.tray = {};
        this.built = [];
        this.mods.clear();
        this.wip = null;
        this.prepQueue = [];
      }
      this.renderAll();
      this.ticket.className = `ticket ${m.repeat ? 'repeat' : ''}`;
      this.ticket.dataset.round = String(m.round);
      this.ticket.dataset.repeat = m.repeat ? '1' : '0';
      this.ticket.replaceChildren(
        h(
          'div',
          { class: 'row' },
          h('span', { class: 'customer' }, `Pedido ${m.round + 1}/${m.rounds} · ${m.customer}${m.repeat ? ' · de novo, devagar' : ''}`),
          m.streak >= 2 ? h('span', { class: 'combo combo-rail', id: 'mg-combo' }, `🔥 Combo ×${m.streak}`) : h('span', { class: 'spacer' }),
          h('button', { class: 'speak-btn', type: 'button', onclick: () => speak(m.pt, { force: true, rate: 0.8 }) }, '🔊 Ouvir'),
        ),
        h('div', { class: 'order', id: 'mg-order' }, m.pt),
        en(m.en),
      );
      speak(m.pt, { rate: m.repeat ? 0.75 : 0.92 });
      this.score.replaceChildren(h('span', null, `Pontos: ${m.points}`), m.streak >= 2 ? h('span', { class: 'combo' }, `Combo ×${m.streak}!`) : h('span'));
      this.ensureTick();
    } else if (m.phase === 'result') {
      if (m.outcome === 'perfeito') this.panel.classList.add('perfect-serve');
      window.setTimeout(() => this.panel.classList.remove('perfect-serve'), 600);
      this.carlos.replaceChildren(h('b', null, 'Seu Carlos: '), `“${m.carlos.pt}”`, en(m.carlos.en));
      if (m.outcome === 'repita') {
        this.locked = false;
        this.timedOut = false;
        this.lockedAt = 0;
        // The repeat ticket re-arms the bar. Don't expire the old one in the gap.
        this.timeoutNotBefore = performance.now() + 1200;
      } else this.lockUi();
      this.score.replaceChildren(h('span', null, `Pontos: ${m.points}`), m.streak >= 2 ? h('span', { class: 'combo combo-burst' }, `Combo ×${m.streak}!`) : h('span'));
      if (m.expected) {
        this.carlos.append(
          h(
            'div',
            { style: 'margin-top:6px;font-size:.85em' },
            'Era: ',
            ...m.expected.map((l) => h('span', { style: 'margin-right:6px' }, `${l.qty}× `, h('img', { src: foodIcon(l.itemId, 22), style: 'width:22px;height:22px;vertical-align:middle' }))),
            ...(m.expectedMods ?? []).map((id) => h('span', { class: 'feedback', style: 'margin-left:4px' }, mgModById(id)?.pt ?? id)),
          ),
        );
      }
    } else {
      cancelAnimationFrame(this.raf);
      this.order = null;
      this.trayActions.hidden = true;
      this.ticket.replaceChildren(h('div', { class: 'order' }, 'Fim do turno!'), en('Shift over!'));
      this.body.replaceChildren(
        h(
          'div',
          { class: 'mg-end', style: 'grid-column:1/-1', id: 'mg-end' },
          h('div', { class: 'big' }, `+${m.coins} RV`),
          h('p', null, h('b', null, `${m.perfect}/${m.rounds} pedidos perfeitos · ${m.points} pontos`), en(`${m.perfect} of ${m.rounds} perfect orders`)),
          h('p', null, h('b', null, 'Seu Carlos: '), `“${m.carlos.pt}”`, en(m.carlos.en)),
          h('div', { class: 'row', style: 'justify-content:center' }, h('button', { type: 'button', onclick: () => this.close() }, bi('Sair', 'Leave')), h('button', { class: 'primary', type: 'button', onclick: () => (this.close(), this.actions.again()) }, bi('Jogar de novo', 'Play again'))),
        ),
      );
      speak(m.carlos.pt);
    }
  }

  /** Panel was removed but shift may still be active on the server — ask for a ticket resync. */
  requestSync() {
    if (!this.order) return;
    this.actions.sync();
  }
}

function stationLabel(need: string | null): string {
  if (need === 'chapa') return 'Chapa';
  if (need === 'bebidas') return 'Bebidas';
  if (need === 'pack') return 'Embalagem';
  return 'Bandeja';
}

function stationLabelEn(need: string | null): string {
  if (need === 'chapa') return 'Grill';
  if (need === 'bebidas') return 'Drinks';
  if (need === 'pack') return 'Pack';
  return 'Tray';
}
