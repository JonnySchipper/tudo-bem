/**
 * The padaria counter (one way to order). The baker on duty asks what it will be; the menu chips are what you say ("Me vê uma coxinha.")
 * with the price; picking one pays and you walk out carrying it. "Bater papo" opens a bate-papo (a pre-made, ungraded chat) with the baker; "Agora não" closes.
 */
import { counterMenu, counterOrderLine, counterPrice, npcDefById, type CounterItemId } from '@tudobem/shared';
import { game } from '../state';
import { showDialogue, closeDialogue } from './panels';
import { rvPriceNote } from './dom';

export function openCounter(npc: 'carlos' | 'graca', o: { buy: (id: CounterItemId) => void; papo: () => void }): void {
  const menu = counterMenu(game.profile?.recados?.active);
  const chips = [
    ...menu.map((id) => {
      const line = counterOrderLine(id);
      return { pt: `${line.pt} · ${counterPrice(id)} RV`, en: line.en };
    }),
    { pt: 'Bater papo', en: 'Have a chat' },
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
      if (i < menu.length) o.buy(menu[i]);
      else if (i === menu.length) o.papo();
    },
    onClose: closeDialogue,
  });
}
