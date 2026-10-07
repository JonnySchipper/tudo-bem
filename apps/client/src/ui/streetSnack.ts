import { snackAddon, snacksAt, type StreetSnackDef } from '@tudobem/shared';
import { showDialogue, closeDialogue } from './panels';

export function openStreetSnack(propId: string, buy: (itemId: string) => void): void {
  const menu = snacksAt(propId);
  if (!menu.length) return;
  if (menu.length === 1) {
    openSingle(menu[0]!, buy);
    return;
  }
  showDialogue({
    npc: null,
    speaker: 'Pipoqueiro',
    line: { pt: 'Pipoca quentinha! Salgada ou doce?', en: 'Hot popcorn! Salty or sweet?' },
    chips: [
      ...menu.map((s) => ({ pt: `${s.pt} · ${s.price} RV`, en: `${s.en} · ${s.price} RV` })),
      { pt: 'Agora não', en: 'Not now' },
    ],
    onChoose: (i) => {
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
    },
    key: 'street-snack',
    onClose: closeDialogue,
  });
}

function openSingle(snack: StreetSnackDef, buy: (itemId: string) => void): void {
  const line =
    snack.id === 'agua_de_coco'
      ? { pt: 'Água de coco geladinha com canudo!', en: 'Ice-cold coconut water with a straw!' }
      : { pt: 'Pipoca quentinha no saquinho!', en: 'Hot popcorn in a bag!' };
  showDialogue({
    npc: null,
    speaker: snack.pt,
    line: { pt: `${line.pt} (${snack.price} RV)`, en: `${line.en} (${snack.price} RV)` },
    chips: [{ pt: `Comprar ${snack.pt}`, en: `Buy ${snack.pt}` }, { pt: 'Agora não', en: 'Not now' }],
    onChoose: (i) => {
      if (i === 0) buy(snack.id);
      closeDialogue();
    },
    key: 'street-snack',
    onClose: closeDialogue,
  });
}

/** Condensed milk is offered only after sweet popcorn, never on the salty bag. */
function openAddon(base: StreetSnackDef, extra: StreetSnackDef, buy: (itemId: string) => void): void {
  const more = extra.price - base.price;
  showDialogue({
    npc: null,
    speaker: 'Pipoqueiro',
    line: {
      pt: `Pipoca doce. Leite condensado por mais ${more} RV?`,
      en: `Sweet popcorn. Condensed milk for ${more} RV more?`,
    },
    chips: [
      { pt: `Sem · ${base.price} RV`, en: `Without · ${base.price} RV` },
      { pt: `Com leite condensado · ${extra.price} RV`, en: `With condensed milk · ${extra.price} RV` },
      { pt: 'Agora não', en: 'Not now' },
    ],
    onChoose: (i) => {
      if (i === 0) buy(base.id);
      else if (i === 1) buy(extra.id);
      closeDialogue();
    },
    key: 'street-snack-leite',
    onClose: closeDialogue,
  });
}
