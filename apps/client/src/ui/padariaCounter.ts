/**
 * The padaria counter (one way to order). The baker on duty asks what it will be; the menu chips are what you say ("Me vê uma coxinha.")
 * with the price; picking one pays and you walk out carrying it. "Bater papo" opens a bate-papo (a pre-made, ungraded chat) with the baker
 * once it is earned; "Agora não" closes. At most 3 content chips and the way out (`counterChoices`).
 */
import { COUNTER_ALWAYS, counterMenu, counterOrderLine, counterPrice, npcDefById, type CounterItemId } from '@tudobem/shared';
import { game } from '../state';
import { showDialogue, closeDialogue } from './panels';
import { rvPriceNote } from './dom';
import { counterChoices, offersPapo } from './dialogueLogic';
import { hasPapo } from './papo';

export function openCounter(npc: 'carlos' | 'graca', o: { buy: (id: CounterItemId) => void; papo: () => void }): void {
  const p = game.profile;
  const carlosDone = p?.tutorial?.carlos;
  const { items: menu, papo } = counterChoices(counterMenu(p?.recados?.active), {
    price: counterPrice,
    always: COUNTER_ALWAYS,
    carlosDone,
    papo: offersPapo({ bondPoints: p?.bond?.[npc], carlosDone, hasPapo: hasPapo(npc) }),
  });
  const chips = [
    ...menu.map((id) => {
      const line = counterOrderLine(id);
      return { pt: `${line.pt} · ${counterPrice(id)} RV`, en: line.en };
    }),
    ...(papo ? [{ pt: 'Bater papo', en: 'Have a chat' }] : []),
    { pt: 'Agora não', en: 'Not now' },
  ];
  showDialogue({
    npc: npcDefById(npc) ?? null,
    speaker: npc === 'graca' ? 'Dona Graça' : 'Seu Carlos',
    line: { pt: 'Pois não. O que vai ser hoje?', en: 'Yes? What’ll it be today?' },
    extras: rvPriceNote(),
    chips,
    key: `counter-${npc}`,
    onChoose: (i) => {
      closeDialogue();
      if (i < menu.length) o.buy(menu[i]!);
      else if (papo && i === menu.length) o.papo();
    },
    onClose: closeDialogue,
  });
}
