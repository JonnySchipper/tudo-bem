import {
  MG_ITEMS,
  MG_MAX_TRAY,
  MG_MODS,
  mgModById,
  mgPrepStation,
  orderNeedsPack,
  type MgBuiltUnit,
  type MgServerMsg,
  type Tray,
} from '@tudobem/shared';
import { h, en, bi } from './dom';
import { foodIcon } from '../render/icons';
import { speak } from '../audio';
import { openModal } from './modal.js';

type Wip = MgBuiltUnit;

function wipNeeds(wip: Wip, order: MgOrder | null): 'chapa' | 'bebidas' | 'pack' | 'tray' | null {
  const prep = mgPrepStation(wip.itemId);
  if (prep === 'chapa' && !wip.chapa) return 'chapa';
  if (prep === 'bebidas' && !wip.bebidas) return 'bebidas';
  if (order && orderNeedsPack(order) && !wip.pack) return 'pack';
  return 'tray';
}

function wipReady(wip: Wip, order: MgOrder | null): boolean {
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
  private dragItem: string | null = null;
  private stationEls: Record<string, HTMLElement> = {};

  constructor(
    private actions: {
      submit: (t: Tray, mods: string[], built: MgBuiltUnit[]) => void;
      timeout: () => void;
      quit: () => void;
      again: () => void;
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

    const mkStation = (id: string, pt: string, enText: string, extra: HTMLElement, goPt: string, goEn: string, onGo: () => void) => {
      const el = h(
        'div',
        {
          class: `station ${id}`,
          id: `mg-station-${id}`,
          'data-station': id,
          onpointerup: (e: PointerEvent) => this.onStationDrop(id, e),
        },
        h('div', { class: 'station-label' }, h('span', { class: 'pt' }, pt), en(enText, true)),
        extra,
        h('button', { class: 'station-go', type: 'button', onclick: onGo }, bi(goPt, goEn)),
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
      mkStation('chapa', 'Chapa', 'Grill / heat', h('div', { class: 'station-slot', id: 'mg-chapa-slot' }), 'Grelhar ✓', 'Grill it', () => this.runStation('chapa')),
      mkStation('bebidas', 'Bebidas', 'Pour drinks', h('div', { class: 'station-slot', id: 'mg-bebidas-slot' }), 'Servir ✓', 'Pour it', () => this.runStation('bebidas')),
      mkStation('pack', 'Embalagem', 'Bag or plate', modsEl, 'Embalar ✓', 'Pack it', () => this.runStation('pack')),
      h(
        'div',
        { class: 'station tray-station', id: 'mg-station-tray', 'data-station': 'tray', onpointerup: (e: PointerEvent) => this.onStationDrop('tray', e) },
        h('div', { class: 'station-label' }, h('span', { class: 'pt' }, 'Bandeja'), en('Place on tray', true)),
        this.wipEl,
        this.trayEl,
        h(
          'div',
          { class: 'row tray-actions' },
          h('button', { type: 'button', id: 'mg-tray-place', onclick: () => this.placeOnTray() }, bi('Colocar na bandeja', 'Place on tray')),
          h('button', { type: 'button', onclick: () => this.clearTray() }, bi('Limpar', 'Clear')),
          h('span', { class: 'spacer' }),
          h('button', { class: 'green serve-bell', type: 'button', onclick: () => this.submit(), id: 'mg-submit' }, bi('Entregar 🔔', 'Serve (Enter)')),
        ),
      ),
    );

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
    this.wip = { itemId: id };
    this.renderWip();
    this.pulseNext();
  }

  private runStation(id: 'chapa' | 'bebidas' | 'pack') {
    if (this.locked || !this.order || !this.wip) return;
    const need = wipNeeds(this.wip, this.order);
    if (need !== id) return;
    if (id === 'chapa') this.wip = { ...this.wip, chapa: true };
    else if (id === 'bebidas') this.wip = { ...this.wip, bebidas: true };
    else if (id === 'pack') {
      this.wip = { ...this.wip, pack: true };
      const where = this.order.mods.find((m) => mgModById(m)?.group === 'where');
      if (where) {
        for (const m of MG_MODS) if (m.group === 'where') this.mods.delete(m.id);
        this.mods.add(where);
        this.renderMods();
      }
    }
    const stEl = this.stationEls[id];
    stEl?.classList.add('pop');
    window.setTimeout(() => stEl?.classList.remove('pop'), 320);
    this.renderWip();
    this.pulseNext();
    if (wipReady(this.wip, this.order)) this.wipEl.classList.add('ready');
  }

  private placeOnTray() {
    if (this.locked || !this.order || !this.wip) return;
    if (!wipReady(this.wip, this.order)) return;
    this.built.push({ ...this.wip });
    const id = this.wip.itemId;
    this.tray[id] = (this.tray[id] ?? 0) + 1;
    this.wip = null;
    this.renderAll();
    this.pulseNext();
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
      h('div', { class: 'wip-hint' }, need === 'tray' ? bi('Na bandeja!', 'On tray!') : bi(`Próximo: ${stationLabel(need)}`, `Next: ${stationLabelEn(need)}`)),
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
              const idx = this.built.findLastIndex((u) => u.itemId === id);
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
    if (this.wip) return;
    this.locked = true;
    this.actions.submit({ ...this.tray }, [...this.mods], [...this.built]);
  }

  private quit() {
    this.actions.quit();
    this.close();
  }

  private tick = () => {
    if (!this.order) return;
    const left = Math.max(0, this.order.timeMs - (performance.now() - this.orderAt));
    const f = left / this.order.timeMs;
    const bar = this.timer.firstElementChild as HTMLElement;
    bar.style.transform = `scaleX(${f})`;
    this.timer.classList.toggle('low', f < 0.25);
    if (left <= 0 && !this.locked && !this.timedOut && performance.now() >= this.timeoutNotBefore) {
      this.timedOut = true;
      this.locked = true;
      this.actions.timeout();
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  handle(m: MgServerMsg) {
    if (m.phase === 'order') {
      if (m.resync && this.order && this.order.round === m.round && this.order.pt === m.pt) {
        this.order = m;
        this.locked = false;
        this.timedOut = false;
        this.timeoutNotBefore = performance.now() + 1000;
        return;
      }
      const keepTray = !!m.repeat && this.order?.round === m.round && this.order.pt === m.pt;
      this.order = m;
      this.orderAt = performance.now();
      this.locked = false;
      this.timedOut = false;
      this.timeoutNotBefore = 0;
      if (!keepTray) {
        this.tray = {};
        this.built = [];
        this.mods.clear();
        this.wip = null;
      }
      this.renderAll();
      this.ticket.className = `ticket ${m.repeat ? 'repeat' : ''}`;
      this.ticket.dataset.round = String(m.round);
      this.ticket.dataset.repeat = m.repeat ? '1' : '0';
      this.ticket.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'customer' }, `Pedido ${m.round + 1}/${m.rounds} · ${m.customer}${m.repeat ? ' · de novo, devagar' : ''}`), h('span', { class: 'spacer' }), h('button', { class: 'speak-btn', type: 'button', onclick: () => speak(m.pt, { force: true, rate: 0.8 }) }, '🔊 Ouvir')),
        h('div', { class: 'order', id: 'mg-order' }, m.pt),
        en(m.en),
      );
      speak(m.pt, { rate: m.repeat ? 0.75 : 0.92 });
      this.score.replaceChildren(h('span', null, `Pontos: ${m.points}`), m.streak >= 2 ? h('span', { class: 'combo' }, `Combo ×${m.streak}!`) : h('span'));
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.tick);
    } else if (m.phase === 'result') {
      if (m.outcome === 'perfeito') this.panel.classList.add('perfect-serve');
      window.setTimeout(() => this.panel.classList.remove('perfect-serve'), 600);
      this.carlos.replaceChildren(h('b', null, 'Seu Carlos: '), `“${m.carlos.pt}”`, en(m.carlos.en));
      if (m.outcome !== 'repita') this.locked = true;
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
