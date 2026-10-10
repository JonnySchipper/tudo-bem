/**
 * Pet Shop do Seu Dito: the panel (#234, docs/PET-STORE-PLAN.md §3.4). Three tabs: Adotar (today's animals in the pens, the breed catalog,
 * the meet view with Fazer carinho / Adotar, and one inline Apoiar card for non-subscribers), Meus pets (take one out, rename, collar and toy,
 * the commands cheat sheet) and Lojinha (collars, toys, beds and food for earned RV). The rules are the server's; the view model is
 * petShopLogic.ts. needs_br: every Portuguese string.
 */
import { PETSHOP_LINES, gameDay, hasPerkAccess, type PetLook, type PetSpecies } from '@tudobem/shared';
import { fetchPublicConfig } from '../auth/config';
import { clock } from '../gameClock';
import { game } from '../state';
import { speak } from '../audio';
import { imageUrl } from '../render/pixel/manifest';
import { bi, en, h } from './dom';
import { closeModal, openModal } from './modal.js';
import { openPetName } from './petName';
import { petCanvas } from './petSprite';
import { equipOptions, petShopView, type LitterCard, type MyPetRow, type PetShopTab, type PetShopView } from './petShopLogic';

export interface PetShopActions {
  carinho: (penId: string, slot: number) => void;
  adopt: (breed: string, coat: string, name: string) => void;
  setActive: (petId: string | null) => void;
  rename: (petId: string, name: string) => void;
  buy: (itemId: string) => void;
  equip: (petId: string, slot: 'collar' | 'toy', itemId: string | null) => void;
  /** The Apoiar panel (the gate card's button). */
  support: () => void;
}

let actions: PetShopActions | null = null;
/** "Só olhar" closes the Apoiar card for the session. */
let gateDismissed = false;
/** Seu Dito's gate line is spoken once per panel opening. */
let gateSpoken = false;

export function bindPetShop(a: PetShopActions): void {
  actions = a;
}

/** Seu Dito says a panel line (the clip is the line as written: no name in it). */
function ditoSays(id: keyof typeof PETSHOP_LINES): void {
  speak(PETSHOP_LINES[id].pt, { speaker: 'dito' });
}

interface Meet {
  look: PetLook;
  breed: string;
  coat: string;
  pt: string;
  en: string;
  coatPt: string;
  coatEn: string;
  species: PetSpecies;
  /** From a pen: carinho is possible. */
  pen?: { penId: string; slot: number };
}

/** Open the panel (the counter opens the Lojinha, a pen or Seu Dito's "Quero ver!" Adotar, the Apoiar link Meus pets). */
export async function openPetShop(tab: PetShopTab = 'adotar'): Promise<void> {
  const cfg = await fetchPublicConfig();
  gateSpoken = false;
  let current: PetShopTab = tab;
  let meet: Meet | null = null;
  const petted = new Set<string>();
  const root = h('div', { class: 'panel petshop-panel', id: 'petshop-panel', role: 'dialog', 'aria-labelledby': 'petshop-title' });

  const view = (): PetShopView => {
    const p = game.profile;
    return petShopView({
      tab: current,
      pets: p?.pets ?? [],
      activePetId: p?.activePetId ?? null,
      petItems: p?.petItems ?? [],
      coins: p?.coins ?? 0,
      access: hasPerkAccess(p?.subscription, Date.now()),
      billingReady: cfg.billingReady,
      day: gameDay(clock.now()),
      gateDismissed,
    });
  };

  const tabButton = (id: PetShopTab, pt: string, enText: string) =>
    h('button', { type: 'button', class: `petshop-tab${current === id ? ' on' : ''}`, 'data-tab': id, role: 'tab', 'aria-selected': String(current === id), onclick: () => ((current = id), (meet = null), paint()) }, bi(pt, enText));

  const gateCard = (v: PetShopView) => {
    if (!v.gate) return null;
    if (!gateSpoken) {
      gateSpoken = true;
      ditoSays('gate');
    }
    return h(
      'div',
      { class: 'petshop-gate', id: 'petshop-gate' },
      h('h3', null, 'Adoção é pra apoiadores', en('Adoption is for supporters', true)),
      h('p', null, PETSHOP_LINES.gate.pt, en(PETSHOP_LINES.gate.en, true)),
      h('p', { class: 'petshop-gate-perks' }, 'Apoiadores adotam até 6 bichinhos, levam um pra passear e o resto fica em casa, na kitnet.', en('Supporters adopt up to 6 pets, take one for walks and the rest stay at home in the kitnet.', true)),
      h(
        'div',
        { class: 'petshop-gate-actions' },
        v.gate.soon
          ? h('span', { class: 'support-soon', id: 'petshop-gate-soon' }, 'Em breve', en('Coming soon', true))
          : h('button', { type: 'button', class: 'primary', id: 'petshop-gate-support', onclick: () => (closeModal(), actions?.support()) }, bi('Apoiar a Vila', 'Support the Vila')),
        h('button', { type: 'button', class: 'ghost', id: 'petshop-gate-close', onclick: () => ((gateDismissed = true), paint()) }, bi('Só olhar', 'Just looking')),
      ),
    );
  };

  const litterCard = (c: LitterCard) =>
    h(
      'button',
      { type: 'button', class: `item-card petshop-animal${c.br ? ' br' : ''}`, 'data-pen': c.penId, 'data-slot': String(c.slot), 'data-breed': c.breed, onclick: () => ((meet = { ...c, pen: { penId: c.penId, slot: c.slot } }), ditoSays('adopt_pick'), paint()) },
      petCanvas(c.look, { scale: 4, frames: [12, 13], fps: 2 }),
      h('div', { class: 'name' }, c.pt),
      en(`${c.en} · ${c.coatPt}`),
    );

  const adotar = (v: PetShopView) => {
    if (meet) return meetView(v, meet);
    return [
      h(
        'section',
        { class: 'stall-shelf petshop-today', 'data-shelf': 'today' },
        h('div', { class: 'stall-shelf-title' }, h('b', null, 'Na loja hoje'), en('In the shop today', true)),
        h('div', { class: 'grid-items' }, ...v.litter.map(litterCard)),
      ),
      gateCard(v),
      h(
        'section',
        { class: 'stall-shelf petshop-catalog', 'data-shelf': 'catalog' },
        h('div', { class: 'stall-shelf-title' }, h('b', null, 'Catálogo de raças'), en('Breed catalog', true)),
        ...v.catalog.map((g) =>
          h(
            'div',
            { class: `petshop-breed${g.br ? ' br' : ''}`, 'data-species': g.species },
            h('div', { class: 'petshop-breed-name' }, g.br ? h('span', { class: 'petshop-br', title: 'Raça ou tipo brasileiro · Brazilian breed or type' }, 'BR') : null, h('b', null, g.pt), en(g.en, true)),
            h(
              'div',
              { class: 'petshop-coats' },
              ...g.coats.map((c) =>
                h('button', {
                  type: 'button',
                  class: 'petshop-swatch',
                  'data-breed': c.breed,
                  'data-coat': c.coat,
                  title: `${c.pt} · ${c.en}`,
                  style: `--coat:${c.color}`,
                  onclick: () => ((meet = { look: c.look, breed: c.breed, coat: c.coat, pt: g.pt, en: g.en, coatPt: c.pt, coatEn: c.en, species: g.species }), paint()),
                }),
              ),
            ),
          ),
        ),
      ),
    ];
  };

  const meetView = (v: PetShopView, m: Meet) => {
    const key = m.pen ? `${m.pen.penId}:${m.pen.slot}` : '';
    const hearts = h('div', { class: 'petshop-hearts', 'aria-hidden': 'true' });
    const adoptBtn = v.access
      ? h(
          'button',
          {
            type: 'button',
            class: 'primary',
            id: 'petshop-adopt',
            disabled: v.full,
            onclick: () =>
              openPetName(m.species, {
                current: '',
                onSave: (name) => actions?.adopt(m.breed, m.coat, name),
                savedName: () => null,
              }),
          },
          bi('Adotar', 'Adopt'),
        )
      : null;
    return [
      h('button', { type: 'button', class: 'ghost petshop-back', id: 'petshop-back', onclick: () => ((meet = null), paint()) }, bi('← Voltar', '← Back')),
      h(
        'div',
        { class: 'petshop-meet', id: 'petshop-meet', 'data-breed': m.breed, 'data-coat': m.coat },
        h('div', { class: 'petshop-stage' }, petCanvas(m.look, { scale: 6, frames: [0, 1, 2, 3], fps: 8 }), petCanvas(m.look, { scale: 6, frames: [4, 5, 6, 7], fps: 8 }), hearts),
        h('h3', null, m.pt, en(`${m.en} · ${m.coatPt} (${m.coatEn})`, true)),
        h('p', { class: 'petshop-says' }, `Seu Dito: “${PETSHOP_LINES.adopt_pick.pt}”`, en(PETSHOP_LINES.adopt_pick.en, true)),
        v.full ? h('p', { class: 'petshop-note', id: 'petshop-full' }, PETSHOP_LINES.adopt_full.pt, en(PETSHOP_LINES.adopt_full.en, true)) : null,
        h(
          'div',
          { class: 'petshop-meet-actions' },
          m.pen
            ? h(
                'button',
                {
                  type: 'button',
                  id: 'petshop-carinho',
                  disabled: petted.has(key),
                  onclick: (e: Event) => {
                    petted.add(key);
                    (e.currentTarget as HTMLButtonElement).disabled = true;
                    hearts.classList.remove('on');
                    void hearts.offsetWidth;
                    hearts.classList.add('on');
                    actions?.carinho(m.pen!.penId, m.pen!.slot);
                  },
                },
                bi('Fazer carinho', 'Pet'),
              )
            : null,
          adoptBtn,
        ),
        v.access ? null : gateCard(v),
      ),
    ];
  };

  const petRow = (v: PetShopView, r: MyPetRow) => {
    const select = (slot: 'collar' | 'toy') => {
      const opts = equipOptions(r, game.profile?.petItems ?? [], slot);
      const value = slot === 'collar' ? r.collar : r.toy;
      const sel = h(
        'select',
        { 'data-slot': slot, 'aria-label': slot === 'collar' ? 'Coleira (Collar)' : 'Brinquedo (Toy)', onchange: (e: Event) => actions?.equip(r.id, slot, (e.target as HTMLSelectElement).value || null) },
        h('option', { value: '' }, slot === 'collar' ? 'Coleira: nenhuma' : 'Brinquedo: nenhum'),
        ...opts.map((o) => h('option', { value: o.id, selected: o.id === value }, `${o.pt} · ${o.en}`)),
      ) as HTMLSelectElement;
      return opts.length ? sel : null;
    };
    return h(
      'div',
      { class: `petshop-pet${r.active ? ' active' : ''}`, 'data-pet': r.id },
      petCanvas(r.look, { scale: 3, frame: r.active ? 12 : 18 }),
      h('div', { class: 'petshop-pet-info' }, h('b', null, r.name ?? 'Sem nome'), en(`${r.breedPt} · ${r.breedEn}`, true), r.active ? h('span', { class: 'stall-tag using' }, 'Passeando · Out') : null),
      h(
        'div',
        { class: 'petshop-pet-actions' },
        r.active
          ? h('button', { type: 'button', 'data-act': 'home', onclick: () => (ditoSays('switch_home'), actions?.setActive(null)) }, bi('Em casa', 'At home'))
          : h('button', { type: 'button', class: 'primary', 'data-act': 'take', disabled: !r.canTake, onclick: () => (ditoSays('switch_out'), actions?.setActive(r.id)) }, bi('Levar', 'Take along')),
        h('button', { type: 'button', 'data-act': 'rename', onclick: () => openPetName(r.species, { current: r.name ?? '', onSave: (name) => actions?.rename(r.id, name), savedName: () => game.profile?.pets?.find((q) => q.id === r.id)?.name }) }, bi('Renomear', 'Rename')),
        select('collar'),
        select('toy'),
      ),
    );
  };

  const meus = (v: PetShopView) => [
    v.pets.length
      ? h('div', { class: 'petshop-pets', id: 'petshop-pets' }, ...v.pets.map((r) => petRow(v, r)))
      : h('p', { class: 'petshop-empty', id: 'petshop-empty' }, 'Nenhum pet ainda. Os bichinhos estão esperando no Pet Shop do Seu Dito.', en('No pets yet. The animals are waiting at Seu Dito’s pet shop.', true)),
    v.lapsed ? h('p', { class: 'petshop-note', id: 'petshop-lapsed' }, 'Seus pets estão em casa, na kitnet. Pra passear com eles, apoie a Vila de novo.', en('Your pets are at home in the kitnet. To walk them again, support the Vila again.', true)) : null,
    h(
      'section',
      { class: 'petshop-commands', id: 'petshop-commands' },
      h('h3', null, 'Comandos', en('Commands: say them in the chat; the line goes out as you typed it', true)),
      h(
        'ul',
        null,
        ...v.commands.map((c) => h('li', null, h('button', { type: 'button', class: 'ghost', 'aria-label': `Ouvir ${c.pt}`, onclick: () => speak(c.pt, { speaker: 'ui', force: true }) }, '🔊'), h('b', null, c.pt), en(c.en, true))),
      ),
    ),
  ];

  const lojinha = (v: PetShopView) =>
    h(
      'section',
      { class: 'stall-shelf petshop-shop', 'data-shelf': 'sale' },
      h('div', { class: 'stall-shelf-title' }, h('b', null, 'Lojinha'), en('Little shop: earned RV only', true), h('span', { class: 'stall-wallet' }, h('span', { class: 'coin' }), h('b', { id: 'petshop-coins' }, `${v.coins} RV`))),
      h(
        'div',
        { class: 'grid-items' },
        ...v.items.map((it) =>
          h(
            'div',
            { class: `item-card stall-card ${it.owned ? 'owned' : 'sale'}${it.short ? ' cant' : ''}`, 'data-item': it.id },
            it.owned ? h('span', { class: 'stall-tag mine' }, '✓ Seu · Yours') : h('span', { class: 'price price-tag' }, h('span', { class: 'coin' }), ` ${it.price}`),
            h('div', { class: 'item-icon-box' }, h('img', { src: imageUrl(`icons/${it.id}`), alt: '', width: 48, height: 48, class: 'pixel' })),
            h('div', { class: 'name' }, it.pt),
            en(it.en),
            it.owned
              ? null
              : h(
                  'button',
                  { type: 'button', class: 'primary', 'data-buy': it.id, disabled: it.short > 0, title: it.short ? `Faltam ${it.short} RV · ${it.short} RV short` : undefined, onclick: () => actions?.buy(it.id) },
                  bi('Comprar', 'Buy'),
                ),
          ),
        ),
      ),
      h('p', { class: 'petshop-note' }, 'Caminhas e o saco de ração vão pra sua kitnet. Coleiras e brinquedos você põe no bichinho em Meus pets.', en('Beds and the food bag go to your kitnet. Collars and toys go on a pet in My pets.', true)),
    );

  const paint = () => {
    const v = view();
    const body = current === 'adotar' ? adotar(v) : current === 'meus' ? meus(v) : [lojinha(v)];
    root.replaceChildren(
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', { id: 'petshop-title' }, 'Pet Shop do Seu Dito'),
      en('Seu Dito’s pet shop'),
      h('div', { class: 'petshop-tabs', role: 'tablist' }, tabButton('adotar', 'Adotar', 'Adopt'), tabButton('meus', 'Meus pets', 'My pets'), tabButton('lojinha', 'Lojinha', 'Little shop')),
      h('div', { class: 'petshop-body', 'data-tab': current }, ...[body].flat().filter((n): n is HTMLElement => n != null)),
    );
  };
  paint();
  const off = game.on('profile', () => {
    // a fresh adoption or a purchase repaints the tab (the meet view stays open on its animal)
    paint();
  });
  openModal('petshop', root, { onClose: () => off() });
}

/** The adoption moment: Seu Dito's line, then the panel on Meus pets with the new pet out. */
export function petAdopted(): void {
  ditoSays('adopt_done');
  closeModal();
  void openPetShop('meus');
}
