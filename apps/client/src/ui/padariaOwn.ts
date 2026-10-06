/**
 * Padaria Fundar door (savings meter) and owned-floor upgrades.
 * needs_br: true
 */
import { PADARIA_OWNERSHIP_RV, PADARIA_SIZE_RV, fundarCostRv, upgradeSizeCostRv, sweetCostRv, type PadariaCard, type PadariaDoorState } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { closeModal, openModal } from './modal';

export interface PadariaOwnActions {
  door: () => void;
  found: (name: string) => void;
  visit: (id: string) => void;
  visitMine: () => void;
  upgrade: (kind: 'size2' | 'size3' | 'brigadeiro' | 'boloCenoura' | 'sonho') => void;
}

let actions: PadariaOwnActions | null = null;
let wantDoor = false;

export function bindPadariaOwn(a: PadariaOwnActions) {
  actions = a;
}

export function askPadariaDoor() {
  wantDoor = true;
  actions?.door();
}

export function onPadariaDoor(enabled: boolean, door: PadariaDoorState, rows: PadariaCard[]) {
  if (!wantDoor) return;
  wantDoor = false;
  if (!enabled) return;
  renderDoor(door, rows);
}

export function syncPadariaFloor() {
  const card = game.room?.padaria;
  let bar = document.getElementById('padaria-floor');
  if (!card) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = h('div', { id: 'padaria-floor', class: 'padaria-floor academy-floor' });
    document.getElementById('ui')?.append(bar);
  }
  const controls: Node[] = [
    h('div', { class: 'academy-floor-name' }, h('b', null, card.name), en(`Tamanho ${card.size}`)),
  ];
  if (card.owner) {
    if (card.size < 2)
      controls.push(
        h('button', { type: 'button', class: 'green', onclick: () => actions?.upgrade('size2') }, bi(`Padaria (${PADARIA_SIZE_RV.padaria} RV)`, `Bakery size (${PADARIA_SIZE_RV.padaria} RV)`)),
      );
    if (card.size === 2)
      controls.push(
        h('button', { type: 'button', class: 'green', onclick: () => actions?.upgrade('size3') }, bi(`Restaurante (${PADARIA_SIZE_RV.restaurante} RV)`, `Restaurant (${PADARIA_SIZE_RV.restaurante} RV)`)),
      );
    if (card.size >= 2) {
      controls.push(
        h('button', { type: 'button', onclick: () => actions?.upgrade('brigadeiro') }, bi(`Brigadeiro (${PADARIA_OWNERSHIP_RV.tier1Brigadeiro})`, `Brigadeiro (${PADARIA_OWNERSHIP_RV.tier1Brigadeiro})`)),
        h('button', { type: 'button', onclick: () => actions?.upgrade('boloCenoura') }, bi(`Bolo (${PADARIA_OWNERSHIP_RV.tier2BoloCenoura})`, `Carrot cake (${PADARIA_OWNERSHIP_RV.tier2BoloCenoura})`)),
        h('button', { type: 'button', onclick: () => actions?.upgrade('sonho') }, bi(`Sonho (${PADARIA_OWNERSHIP_RV.tier3Sonho})`, `Sonho (${PADARIA_OWNERSHIP_RV.tier3Sonho})`)),
      );
    }
  }
  bar.replaceChildren(...controls);
}

function renderDoor(door: PadariaDoorState, rows: PadariaCard[]) {
  const pct = Math.min(100, Math.round((door.coins / door.goalRv) * 100));
  const meter = h('div', { class: 'padaria-meter', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { class: 'padaria-meter-fill', style: `width:${pct}%` }));
  const panel = h(
    'div',
    { class: 'panel padaria-door', role: 'dialog', 'aria-label': 'Porta da padaria' },
    h('h3', null, 'Sua padaria'),
    en('Your bakery'),
    h('p', { class: 'hint' }, bi(`${door.coins} / ${door.goalRv} RV na porta`, `${door.coins} / ${door.goalRv} RV toward the door`)),
    meter,
  );
  if (door.ownedId) {
    panel.append(
      h('p', null, bi(`Aberta: ${door.ownedName}`, `Open: ${door.ownedName}`)),
      h('button', { type: 'button', class: 'green', onclick: () => { closeModal(); actions?.visitMine(); } }, bi('Entrar na minha padaria', 'Enter my bakery')),
      h('button', { type: 'button', onclick: () => closeModal() }, bi('Ir ao Seu Carlos', 'Go to Seu Carlos')),
    );
  } else if (door.canFundar) {
    const name = h('input', { maxlength: '24', placeholder: 'Nome na porta', autocomplete: 'off' }) as HTMLInputElement;
    panel.append(
      h('label', null, bi('Nome na porta', 'Name on the door'), name),
      h(
        'button',
        {
          type: 'button',
          class: 'green',
          onclick: () => {
            const n = name.value.trim();
            if (!n) return;
            closeModal();
            actions?.found(n);
          },
        },
        bi(`Fundar (${fundarCostRv()} RV)`, `Found (${fundarCostRv()} RV)`),
      ),
    );
  } else {
    panel.append(h('p', { class: 'hint' }, bi('Corre turnos pagos no balcão para juntar os reais.', 'Run paid counter shifts to save RV.')));
  }
  if (rows.length) {
    const list = h('div', { class: 'padaria-visit-list' });
    for (const row of rows.slice(0, 8)) {
      if (row.owner) continue;
      list.append(
        h(
          'button',
          { type: 'button', onclick: () => { closeModal(); actions?.visit(row.id); } },
          bi(`Visitar ${row.name}`, `Visit ${row.name}`),
        ),
      );
    }
    if (list.childNodes.length) panel.append(h('h4', null, bi('Padarias do bairro', 'Neighborhood bakeries')), list);
  }
  openModal('padaria-door', panel);
}
