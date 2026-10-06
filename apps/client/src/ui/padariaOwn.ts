/**
 * Padaria Fundar door (savings meter) and owned-floor upgrades.
 * needs_br: true
 */
import {
  PADARIA_NAME_MAX,
  PADARIA_SIZE_NAMES,
  fundarCostRv,
  upgradeSizeCostRv,
  sweetCostRv,
  type PadariaCard,
  type PadariaDoorState,
  type PadariaSweets,
  type PadariaUpgradeKind,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { closeModal, openModal } from './modal';

export interface PadariaOwnActions {
  door: () => void;
  found: (name: string) => void;
  visit: (id: string) => void;
  visitMine: () => void;
  upgrade: (kind: PadariaUpgradeKind) => void;
}

let actions: PadariaOwnActions | null = null;
let wantDoor = false;

export function bindPadariaOwn(a: PadariaOwnActions) {
  actions = a;
  // coins change after shifts and buys: keep the floor's affordable buttons honest
  game.on('profile', syncPadariaFloor);
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

const SWEETS: { kind: keyof PadariaSweets; pt: string; en: string }[] = [
  { kind: 'brigadeiro', pt: 'Brigadeiro', en: 'Brigadeiro' },
  { kind: 'boloCenoura', pt: 'Bolo de cenoura', en: 'Carrot cake' },
  { kind: 'sonho', pt: 'Sonho', en: 'Sonho' },
];

function buyButton(kind: PadariaUpgradeKind, cost: number, pt: string, enText: string, cls?: string) {
  const coins = game.profile?.coins ?? 0;
  const short = Math.max(0, cost - coins);
  return h(
    'button',
    { type: 'button', class: cls, disabled: short > 0, title: short > 0 ? `Faltam ${short} RV` : undefined, onclick: () => actions?.upgrade(kind) },
    bi(`${pt} (${cost} RV)`, `${enText} (${cost} RV)`),
  );
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
  const size = PADARIA_SIZE_NAMES[card.size];
  const who = card.owner ? 'Sua padaria' : `de ${card.ownerName}`;
  const whoEn = card.owner ? 'Your bakery' : `${card.ownerName}’s`;
  const controls: Node[] = [h('div', { class: 'academy-floor-name' }, h('b', null, card.name), bi(`${who} · ${size.pt}`, `${whoEn} · ${size.en}`))];
  if (card.owner) {
    if (card.size === 1) controls.push(buyButton('size2', upgradeSizeCostRv(2), PADARIA_SIZE_NAMES[2].pt, PADARIA_SIZE_NAMES[2].en, 'green'));
    if (card.size === 2) controls.push(buyButton('size3', upgradeSizeCostRv(3), PADARIA_SIZE_NAMES[3].pt, PADARIA_SIZE_NAMES[3].en, 'green'));
    if (card.size >= 2) {
      for (const s of SWEETS) {
        if (card.sweets?.[s.kind]) controls.push(h('span', { class: 'academy-chip' }, `✓ ${s.pt}`));
        else controls.push(buyButton(s.kind, sweetCostRv(s.kind), s.pt, s.en));
      }
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
  );
  if (door.ownedId) {
    panel.append(
      h('p', null, bi(`Aberta: ${door.ownedName}`, `Open: ${door.ownedName}`)),
      h('button', { type: 'button', class: 'green', onclick: () => { closeModal(); actions?.visitMine(); } }, bi('Entrar na minha padaria', 'Enter my bakery')),
      h('button', { type: 'button', onclick: () => closeModal() }, bi('Ir ao Seu Carlos', 'Go to Seu Carlos')),
    );
  } else {
    panel.append(h('p', { class: 'hint' }, bi(`${door.coins} / ${door.goalRv} RV na porta`, `${door.coins} / ${door.goalRv} RV toward the door`)), meter);
    if (door.canFundar) {
      const name = h('input', { maxlength: String(PADARIA_NAME_MAX), placeholder: 'Nome na porta', autocomplete: 'off' }) as HTMLInputElement;
      const submit = () => {
        const n = name.value.trim();
        if (!n) return name.focus();
        closeModal();
        actions?.found(n);
      };
      name.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      panel.append(
        h('label', null, bi('Nome na porta', 'Name on the door'), name),
        h('button', { type: 'button', class: 'green', onclick: submit }, bi(`Fundar (${fundarCostRv()} RV)`, `Found (${fundarCostRv()} RV)`)),
      );
    } else {
      const short = door.goalRv - door.coins;
      panel.append(h('p', { class: 'hint' }, bi(`Faltam ${short} RV. Corre turnos pagos no balcão para juntar.`, `${short} RV to go. Run paid counter shifts to save up.`)));
    }
  }
  // filter first, then cap, so the owner's own row never eats a slot
  const others = rows.filter((row) => !row.owner).slice(0, 8);
  if (others.length) {
    const list = h('div', { class: 'padaria-visit-list' });
    for (const row of others) {
      const size = PADARIA_SIZE_NAMES[row.size];
      list.append(
        h(
          'button',
          { type: 'button', onclick: () => { closeModal(); actions?.visit(row.id); } },
          bi(`Visitar ${row.name} · ${row.ownerName} · ${size.pt}`, `Visit ${row.name} · ${row.ownerName} · ${size.en}`),
        ),
      );
    }
    panel.append(h('h4', null, bi('Padarias do bairro', 'Neighborhood bakeries')), list);
  }
  openModal('padaria-door', panel);
}
