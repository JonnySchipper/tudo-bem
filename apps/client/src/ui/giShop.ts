import { GI_PRICE } from '@tudobem/shared';
import { showDialogue, closeDialogue } from './panels';

export function openGiShop(owned: boolean, buy: () => void): void {
  if (owned) {
    showDialogue({
      npc: null,
      speaker: 'Vestiário',
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
  showDialogue({
    npc: null,
    speaker: 'Vestiário',
    line: {
      pt: `Kimono branco para treinar (${GI_PRICE} RV). A faixa branca vem de presente.`,
      en: `White gi to train (${GI_PRICE} RV). The white belt is a gift.`,
    },
    chips: [{ pt: 'Comprar kimono', en: 'Buy gi' }, { pt: 'Agora não', en: 'Not now' }],
    onChoose: (i) => {
      if (i === 0) buy();
      closeDialogue();
    },
    key: 'gi-buy',
    onClose: closeDialogue,
  });
}
