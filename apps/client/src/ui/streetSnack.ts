import { snackForProp, type StreetSnackDef } from '@tudobem/shared';
import { showDialogue, closeDialogue } from './panels';

export function openStreetSnack(propId: string, buy: (itemId: string) => void): void {
  const snack = snackForProp(propId);
  if (!snack) return;
  const line = snackLine(snack);
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

function snackLine(s: StreetSnackDef): { pt: string; en: string } {
  if (s.id === 'pipoca') return { pt: 'Pipoca quentinha no saquinho!', en: 'Hot popcorn in a bag!' };
  return { pt: 'Água de coco geladinha com canudo!', en: 'Ice-cold coconut water with a straw!' };
}
