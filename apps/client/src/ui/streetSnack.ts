import { snackAddon, snacksAt, type StreetSnackDef } from '@tudobem/shared';
import { showDialogue, closeDialogue } from './panels';
import { h } from './dom';
import { foodIcon } from './pixelArt';

/** Who calls out at a cart with a menu of more than one thing. needs_br: true */
const CALL: Record<string, { speaker: string; line: { pt: string; en: string } }> = {
  pipoqueiro: { speaker: 'Pipoqueiro', line: { pt: 'Pipoca quentinha! Salgada ou doce?', en: 'Hot popcorn! Salty or sweet?' } },
  lanchonete_aero: { speaker: 'Lanchonete', line: { pt: 'Pão de queijo quentinho! E um cafezinho?', en: 'Warm cheese bread! And a little coffee?' } },
};

/** The street carts get a menu board in their own colours; the airport café keeps plain chips. */
const CART_LOOK: Record<string, string> = { pipoqueiro: 'pipoca', carrinho_coco: 'coco' };

interface Pick {
  icon: string;
  pt: string;
  en: string;
  price: number;
  /** Chip index this tile stands for (keys 1-9 and the chip row pick the same thing). */
  chip: number;
  id: string;
  drizzle?: boolean;
}

/**
 * The cart's menu board: an awning, then one tile per thing it sells (the bag or coconut at 3x, the name, a price tag). The tiles are the
 * same choices as the numbered chips, which stay for the keyboard (CSS hides the duplicates while the board is up).
 */
function cartBoard(look: string, picks: Pick[], choose: (chip: number) => void): HTMLElement {
  return h(
    'div',
    { class: `snack-cart snack-cart-${look}` },
    h('div', { class: 'snack-cart-awning', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'snack-cart-row' },
      ...picks.map((p) =>
        h(
          'button',
          { class: 'snack-pick', 'data-snack': p.id, onclick: () => choose(p.chip), 'aria-label': `${p.pt}, ${p.price} RV` },
          h('span', { class: 'num' }, String(p.chip + 1)),
          h('span', { class: `snack-bag${p.drizzle ? ' drizzle' : ''}` }, foodIcon(p.icon, 3, p.pt), p.drizzle ? h('i', { class: 'snack-drip', 'aria-hidden': 'true' }) : null),
          h('span', { class: 'snack-name' }, h('span', { class: 'pt' }, p.pt), h('span', { class: 'en plain' }, p.en)),
          h('span', { class: 'snack-price' }, `${p.price} RV`),
        ),
      ),
    ),
  );
}

export function openStreetSnack(propId: string, buy: (itemId: string) => void): void {
  const menu = snacksAt(propId);
  if (!menu.length) return;
  if (menu.length === 1) {
    openSingle(menu[0]!, buy);
    return;
  }
  const call = CALL[propId] ?? CALL.pipoqueiro!;
  const choose = (i: number) => {
    const pick = menu[i];
    if (!pick) {
      closeDialogue();
      return;
    }
    const extra = snackAddon(pick.id);
    if (!extra) {
      buy(pick.id);
      closeDialogue();
      return;
    }
    openAddon(pick, extra, buy);
  };
  const look = CART_LOOK[propId];
  showDialogue({
    npc: null,
    speaker: call.speaker,
    line: call.line,
    extras: look ? cartBoard(look, menu.map((s, i) => ({ icon: s.icon, pt: s.pt, en: s.en, price: s.price, chip: i, id: s.id })), choose) : undefined,
    chips: [
      ...menu.map((s) => ({ pt: `${s.pt} · ${s.price} RV`, en: `${s.en} · ${s.price} RV` })),
      { pt: 'Agora não', en: 'Not now' },
    ],
    onChoose: choose,
    key: 'street-snack',
    onClose: closeDialogue,
  });
}

function openSingle(snack: StreetSnackDef, buy: (itemId: string) => void): void {
  // the arrivals hall's water cooler: free, so it is "pegar" (take), not "comprar" (buy). needs_br: true
  if (snack.price === 0) {
    showDialogue({
      npc: null,
      speaker: 'Bebedouro',
      line: { pt: 'Água fresquinha, de graça.', en: 'Cool water, free.' },
      chips: [{ pt: `Pegar um ${snack.pt.toLowerCase()}`, en: `Take ${snack.en.toLowerCase()}` }, { pt: 'Agora não', en: 'Not now' }],
      onChoose: (i) => {
        if (i === 0) buy(snack.id);
        closeDialogue();
      },
      key: 'street-snack',
      onClose: closeDialogue,
    });
    return;
  }
  const line =
    snack.id === 'agua_de_coco'
      ? { pt: 'Água de coco geladinha com canudo!', en: 'Ice-cold coconut water with a straw!' }
      : { pt: 'Pipoca quentinha no saquinho!', en: 'Hot popcorn in a bag!' };
  const choose = (i: number) => {
    if (i === 0) buy(snack.id);
    closeDialogue();
  };
  const look = CART_LOOK[snack.propId];
  showDialogue({
    npc: null,
    speaker: snack.pt,
    line: { pt: `${line.pt} (${snack.price} RV)`, en: `${line.en} (${snack.price} RV)` },
    extras: look ? cartBoard(look, [{ icon: snack.icon, pt: snack.pt, en: snack.en, price: snack.price, chip: 0, id: snack.id }], choose) : undefined,
    chips: [{ pt: `Comprar ${snack.pt}`, en: `Buy ${snack.pt}` }, { pt: 'Agora não', en: 'Not now' }],
    onChoose: choose,
    key: 'street-snack',
    onClose: closeDialogue,
  });
}

/** Condensed milk is offered only after sweet popcorn, never on the salty bag. */
function openAddon(base: StreetSnackDef, extra: StreetSnackDef, buy: (itemId: string) => void): void {
  const more = extra.price - base.price;
  const choose = (i: number) => {
    if (i === 0) buy(base.id);
    else if (i === 1) buy(extra.id);
    closeDialogue();
  };
  showDialogue({
    npc: null,
    speaker: 'Pipoqueiro',
    line: {
      pt: `Pipoca doce. Leite condensado por mais ${more} RV?`,
      en: `Sweet popcorn. Condensed milk for ${more} RV more?`,
    },
    extras: cartBoard(
      'pipoca',
      [
        { icon: base.icon, pt: 'Sem', en: 'Without', price: base.price, chip: 0, id: base.id },
        { icon: extra.icon, pt: 'Com leite condensado', en: 'With condensed milk', price: extra.price, chip: 1, id: extra.id, drizzle: true },
      ],
      choose,
    ),
    chips: [
      { pt: `Sem · ${base.price} RV`, en: `Without · ${base.price} RV` },
      { pt: `Com leite condensado · ${extra.price} RV`, en: `With condensed milk · ${extra.price} RV` },
      { pt: 'Agora não', en: 'Not now' },
    ],
    onChoose: choose,
    key: 'street-snack-leite',
    onClose: closeDialogue,
  });
}
