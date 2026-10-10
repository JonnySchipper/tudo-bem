import { GI_PRICE } from '@tudobem/shared';
import { showDialogue, closeDialogue } from './panels';
import { rvPriceNote } from './dom';
import { game } from '../state';

export function openGiShop(owned: boolean, buy: () => void): void {
  if (owned) {
    showDialogue({
      npc: null,
      speaker: 'Vestiário · Locker room',
      line: {
        pt: 'Seu kimono já está no armário. O tatame fica à direita.',
        en: 'Your gi is already in the locker. The mat is on the right.',
      },
      chips: [{ pt: 'Entendi', en: 'Got it' }],
      onChoose: () => closeDialogue(),
      key: 'gi-owned',
      onClose: closeDialogue,
    });
    return;
  }
  const short = GI_PRICE - (game.profile?.coins ?? GI_PRICE);
  if (short > 0) {
    // needs_br: true. Not enough yet: say how much and where it comes from, instead of a buy button that only errors
    showDialogue({
      npc: null,
      speaker: 'Vestiário · Locker room',
      line: {
        pt: `O kimono custa ${GI_PRICE} RV. Faltam ${short} RV: o balcão do Seu Carlos e a feira pagam rapidinho.`,
        en: `The gi costs ${GI_PRICE} RV. You need ${short} more: Seu Carlos's counter and the market pay quickly.`,
      },
      extras: rvPriceNote(),
      chips: [{ pt: 'Volto já', en: 'Be right back' }],
      onChoose: () => closeDialogue(),
      key: 'gi-short',
      onClose: closeDialogue,
    });
    return;
  }
  showDialogue({
    npc: null,
    speaker: 'Vestiário · Locker room',
    line: {
      pt: `Kimono branco para treinar (${GI_PRICE} RV). A faixa branca vem de presente.`,
      en: `White gi to train (${GI_PRICE} RV). The white belt is a gift.`,
    },
    extras: rvPriceNote(),
    chips: [{ pt: 'Comprar kimono', en: 'Buy gi' }, { pt: 'Agora não', en: 'Not now' }],
    onChoose: (i) => {
      if (i === 0) buy();
      closeDialogue();
    },
    key: 'gi-buy',
    onClose: closeDialogue,
  });
}
