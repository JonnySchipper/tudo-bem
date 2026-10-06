/**
 * Player-owned padaria (Fundar), client side:
 * - the door fund on Rua dos Ipês (savings meter → Fundar, or "Entrar na minha padaria" once it is yours);
 * - the facade door asks an owner which padaria (theirs or Seu Carlos's);
 * - inside an owned padaria: the vaso is the book of Melhorias (owner) or the shop's card (visitor), the balcão sells the house menu.
 * needs_br: true
 */
import {
  COUNTER_PRICES,
  OWNED_SHELF,
  PADARIA_FOUNDER_HAT,
  PADARIA_NAME_MAX,
  PADARIA_SIZE_NAMES,
  cardById,
  counterMenuForOwned,
  fundarCostRv,
  upgradeSizeCostRv,
  sweetCostRv,
  type PadariaCard,
  type PadariaDoorState,
  type PadariaSize,
  type PadariaSweets,
  type PadariaUpgradeKind,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { closeModal, modalId, openModal } from './modal';
import { closeDialogue, showDialogue } from './panels';
import { foodIcon } from './pixelArt';
import { setHatIcon } from '../render/pixel/charPreview';

/** The founder toque, drawn from the hat sprite (the owner's mark on every padaria card). */
function hatMark(): HTMLElement {
  const img = h('img', { alt: '', class: 'pad-hat-img' }) as HTMLImageElement;
  setHatIcon(img, PADARIA_FOUNDER_HAT, 3);
  return h('span', { class: 'pad-hat', 'aria-hidden': 'true' }, img);
}

export interface PadariaOwnActions {
  door: () => void;
  found: (name: string) => void;
  visit: (id: string) => void;
  visitMine: () => void;
  upgrade: (kind: PadariaUpgradeKind) => void;
  buy: (itemId: string) => void;
}

let actions: PadariaOwnActions | null = null;
let wantDoor = false;

export function bindPadariaOwn(a: PadariaOwnActions) {
  actions = a;
  // coins change after shifts and buys: an open book of Melhorias stays honest
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

/** What each size puts on the counter (the Correria board and the balcão da casa). */
const SIZE_PERKS: Record<PadariaSize, { pt: string; en: string }> = {
  1: { pt: 'Correria com café e pão francês.', en: 'Counter Rush with coffee and bread rolls.' },
  2: { pt: 'Correria com o cardápio completo. Libera os doces.', en: 'Counter Rush with the full menu. Unlocks sweets.' },
  3: { pt: 'Pratos no balcão: PF, feijoada, bife acebolado, salada, pudim.', en: 'Plates at the counter: set meal, feijoada, steak with onions, salad, pudding.' },
};

const SWEETS: { kind: keyof PadariaSweets; pt: string; en: string }[] = [
  { kind: 'brigadeiro', pt: 'Brigadeiro', en: 'Brigadeiro' },
  { kind: 'boloCenoura', pt: 'Bolo de cenoura', en: 'Carrot cake' },
  { kind: 'sonho', pt: 'Sonho', en: 'Sonho (cream doughnut)' },
];

const coins = () => game.profile?.coins ?? 0;

function buyButton(kind: PadariaUpgradeKind, cost: number) {
  const short = Math.max(0, cost - coins());
  return h(
    'button',
    { type: 'button', class: 'green', disabled: short > 0, 'data-upgrade': kind, onclick: () => actions?.upgrade(kind) },
    short > 0 ? bi(`Faltam ${short} RV`, `${short} RV to go`) : bi(`Comprar · ${cost} RV`, `Buy · ${cost} RV`),
  );
}

function tierCard(title: { pt: string; en: string }, perk: { pt: string; en: string }, state: 'done' | 'next' | 'locked', action: Node | null) {
  return h(
    'div',
    { class: `pad-tier ${state}` },
    h('div', { class: 'pad-tier-head' }, h('b', null, title.pt), state === 'done' ? h('span', { class: 'pad-tick', 'aria-label': 'feito' }, '✓') : null),
    en(title.en),
    h('p', { class: 'pad-tier-perk' }, perk.pt, en(perk.en)),
    action,
  );
}

/** The book of Melhorias (owner) or the shop's card (visitor). Opened from the vaso inside an owned padaria. */
export function openPadariaBook(card: PadariaCard) {
  openModal('padaria-book', bookPanel(card));
}

function bookPanel(card: PadariaCard) {
  const size = PADARIA_SIZE_NAMES[card.size];
  const head = h(
    'div',
    { class: 'pad-book-head' },
    hatMark(),
    h('div', null, h('h3', null, card.name), h('p', { class: 'hint' }, `${card.owner ? 'Sua padaria' : `De ${card.ownerName}`} · ${size.pt}`, en(`${card.owner ? 'Your bakery' : `${card.ownerName}’s`} · ${size.en}`))),
  );
  const panel = h('div', { class: 'panel padaria-book', role: 'dialog', 'aria-label': `Melhorias: ${card.name}` }, head);
  if (!card.owner) {
    const sweets = SWEETS.filter((s) => card.sweets?.[s.kind]).map((s) => s.pt);
    panel.append(h('p', null, SIZE_PERKS[card.size].pt, en(SIZE_PERKS[card.size].en)));
    if (sweets.length) panel.append(h('p', null, `Na vitrine: ${sweets.join(', ')}.`, en('Sweets in the case.')));
    panel.append(
      h('p', { class: 'hint' }, 'Compre no balcão da casa.', en('Buy at the house counter.')),
      h('button', { type: 'button', onclick: () => closeModal() }, bi('Fechar', 'Close')),
    );
    return panel;
  }
  const tiers = h(
    'div',
    { class: 'pad-tiers' },
    ...([1, 2, 3] as const).map((n) => {
      const state = card.size >= n ? 'done' : card.size === n - 1 ? 'next' : 'locked';
      const action = state === 'next' ? buyButton(n === 2 ? 'size2' : 'size3', upgradeSizeCostRv(n as 2 | 3)) : state === 'locked' ? h('p', { class: 'hint' }, bi(`Depois: ${upgradeSizeCostRv(n as 2 | 3)} RV`, `Later: ${upgradeSizeCostRv(n as 2 | 3)} RV`)) : null;
      return tierCard(PADARIA_SIZE_NAMES[n], SIZE_PERKS[n], state, action);
    }),
  );
  const sweets = h(
    'div',
    { class: 'pad-tiers' },
    ...SWEETS.map((s) => {
      const bought = !!card.sweets?.[s.kind];
      const state = bought ? 'done' : card.size >= 2 ? 'next' : 'locked';
      const action = state === 'next' ? buyButton(s.kind, sweetCostRv(s.kind)) : state === 'locked' ? h('p', { class: 'hint' }, bi('Precisa do tamanho Padaria', 'Needs the Padaria size')) : null;
      return tierCard({ pt: s.pt, en: s.en }, { pt: `No balcão da casa · ${sweetCostRv(s.kind)} RV`, en: 'Sold at the house counter' }, state, action);
    }),
  );
  panel.append(
    h('h4', null, bi('Tamanho', 'Size')),
    tiers,
    h('h4', null, bi('Doces da vitrine', 'Sweets in the case')),
    sweets,
    h('p', { class: 'hint pad-book-foot' }, `Você tem ${coins()} RV. Turnos pagos no balcão juntam mais.`, en(`You have ${coins()} RV. Paid counter shifts earn more.`)),
    h('button', { type: 'button', onclick: () => closeModal() }, bi('Fechar', 'Close')),
  );
  return panel;
}

/** Re-render an open book after an upgrade or a coin change (called on `floor` and `profile`). */
export function syncPadariaFloor() {
  document.getElementById('padaria-floor')?.remove();
  const card = game.room?.padaria;
  if (modalId() !== 'padaria-book') return;
  const open = document.querySelector('.padaria-book');
  if (!card || !open) return closeModal();
  open.replaceWith(bookPanel(card));
}

/** The counter of an owned padaria: the house menu by size and sweets. Visitors' reais go to the owner. */
export function openHouseCounter(card: PadariaCard) {
  // the house specials (what the upgrades bought) first, then the everyday menu
  const all = counterMenuForOwned(card);
  const menu = [...all.filter((id) => (OWNED_SHELF as readonly string[]).includes(id)), ...all.filter((id) => !(OWNED_SHELF as readonly string[]).includes(id))];
  const label = (id: string) => cardById(`lex.padaria.${id}`);
  const chips = [
    ...menu.map((id) => {
      const c = label(id);
      return { pt: `${c?.form ?? id} · ${COUNTER_PRICES[id] ?? 0} RV`, en: c?.gloss_en ?? id };
    }),
    { pt: 'Agora não', en: 'Not now' },
  ];
  showDialogue({
    npc: null,
    speaker: card.owner ? 'Seu balcão' : `Balcão da ${card.name}`,
    line: card.owner
      ? { pt: `Balcão da ${card.name}. O que vai pra sacola?`, en: `${card.name}’s counter. What goes in the bag?` }
      : { pt: `Bem-vindo à ${card.name}! O que vai ser?`, en: `Welcome to ${card.name}! What’ll it be?` },
    chips,
    key: `house-counter-${card.id}`,
    onChoose: (i) => {
      closeDialogue();
      if (i < menu.length) actions?.buy(menu[i]!);
    },
    onClose: closeDialogue,
  });
}

/** An owner at Seu Carlos's facade door: their padaria first, his second. */
export function chooseBakery(own: { id: string; name: string; size: PadariaSize }, goCarlos: () => void) {
  const size = PADARIA_SIZE_NAMES[own.size];
  const panel = h(
    'div',
    { class: 'panel padaria-choose', role: 'dialog', 'aria-label': 'Qual padaria?' },
    h('h3', null, 'Qual padaria?'),
    en('Which bakery?'),
    h(
      'button',
      { type: 'button', class: 'pad-choice mine', id: 'pad-choose-mine', onclick: () => { closeModal(); actions?.visit(own.id); } },
      hatMark(),
      h('span', null, h('b', null, own.name), h('small', null, `Sua padaria · ${size.pt}`), en(`Your bakery · ${size.en}`)),
    ),
    h(
      'button',
      { type: 'button', class: 'pad-choice', id: 'pad-choose-carlos', onclick: () => { closeModal(); goCarlos(); } },
      h('span', { class: 'pad-hat', 'aria-hidden': 'true' }, foodIcon('pao', 3)),
      h('span', null, h('b', null, 'Padaria do Seu Carlos'), en('Seu Carlos’s bakery')),
    ),
  );
  openModal('padaria-choose', panel);
}

function renderDoor(door: PadariaDoorState, rows: PadariaCard[]) {
  const pct = Math.min(100, Math.round((door.coins / door.goalRv) * 100));
  const meter = h('div', { class: 'padaria-meter', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { class: 'padaria-meter-fill', style: `width:${pct}%` }));
  const panel = h('div', { class: 'panel padaria-door', role: 'dialog', 'aria-label': 'Porta da padaria' });
  if (door.ownedId) {
    panel.append(
      h('div', { class: 'pad-book-head' }, hatMark(), h('div', null, h('h3', null, door.ownedName ?? ''), en('Your bakery — open for business'))),
      h('button', { type: 'button', class: 'green', id: 'pad-enter-mine', onclick: () => { closeModal(); actions?.visitMine(); } }, bi('Entrar na minha padaria', 'Enter my bakery')),
      h('p', { class: 'hint' }, 'Dica: a porta do Seu Carlos também leva até a sua.', en('Tip: Seu Carlos’s door also takes you to yours.')),
    );
  } else {
    panel.append(
      h('h3', null, 'Sua própria padaria'),
      en('Your own bakery'),
      h('p', null, 'Junte reais no balcão do Seu Carlos e abra a sua porta: nome na fachada, chapéu de dono e o seu balcão.', en('Save up at Seu Carlos’s counter and open your own door: your name, an owner’s hat and your own counter.')),
      h('p', { class: 'hint' }, bi(`${door.coins} / ${door.goalRv} RV na porta`, `${door.coins} / ${door.goalRv} RV toward the door`)),
      meter,
    );
    if (door.canFundar) {
      const name = h('input', { maxlength: String(PADARIA_NAME_MAX), placeholder: 'Padaria da …', autocomplete: 'off' }) as HTMLInputElement;
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
          bi(`${row.name} · ${row.ownerName} · ${size.pt}`, `Visit ${row.name} · ${size.en}`),
        ),
      );
    }
    panel.append(h('h4', null, bi('Padarias do bairro', 'Neighborhood bakeries')), list);
  }
  openModal('padaria-door', panel);
}

const WELCOME_KEY = 'tb_padaria_welcome_v1';

/** The first time an owner stands in their own padaria: what is where (once per padaria, per browser). */
export function welcomeOwner() {
  const card = game.room?.padaria;
  if (!card?.owner || modalId()) return;
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(WELCOME_KEY) ?? '[]') as string[];
  } catch {
    seen = [];
  }
  if (!Array.isArray(seen) || seen.includes(card.id)) return;
  try {
    localStorage.setItem(WELCOME_KEY, JSON.stringify([...seen, card.id].slice(-8)));
  } catch {
    // private mode: the card just shows again next time
  }
  const row = (pt: string, enText: string) => h('li', null, pt, en(enText));
  const panel = h(
    'div',
    { class: 'panel padaria-welcome', role: 'dialog', 'aria-label': `Bem-vindo à ${card.name}` },
    h('div', { class: 'pad-book-head' }, hatMark(), h('div', null, h('h3', null, card.name), en('Your bakery is open'))),
    h(
      'ul',
      { class: 'pad-welcome-list' },
      row('Trilho de pedidos: a sua Correria. O cardápio cresce com o tamanho.', 'Order rail: your Counter Rush. The menu grows with the size.'),
      row('Vaso perto da porta: Melhorias (tamanho e doces).', 'Pot by the door: Upgrades (size and sweets).'),
      row('Balcão: quem visita compra aqui, e os reais vão pro seu caixa.', 'Counter: visitors buy here, and the reais go to your till.'),
      row('Pra voltar: a porta do Seu Carlos na Rua dos Ipês pergunta qual padaria.', 'To come back: Seu Carlos’s door on Rua dos Ipês asks which bakery.'),
    ),
    h('button', { type: 'button', class: 'green', id: 'pad-welcome-ok', onclick: () => closeModal() }, bi('Bora trabalhar!', 'Let’s get to work!')),
  );
  openModal('padaria-welcome', panel);
}
