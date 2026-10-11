/**
 * Seu Bento's rental menu (PRAIA-PLAN.md 3.3): his portrait and one chip per boat, the price on the chip like the hat shop, the new fish
 * in words. The prices come from the server (dashboard tunables), never from a client copy. A running trip offers "Devolver o barco".
 */
import { BENTO_LINES, type BoatTier, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { speak } from '../../audio';
import { showDialogueBox, type BoxChip } from '../dialogue';
import { closeDialogue } from '../panels';
import { toast } from '../hud';
import { boatChipRoom, visibleBoatTiers } from './barcoMenuLogic';

type MenuMsg = Extract<ServerMsg, { t: 'barco'; phase: 'menu' }>;

export interface BarcoHooks {
  send(m: ClientMsg): void;
  /** the party boat's chip (Step E): start a trip and invite friends */
  party?: () => void;
}

let hooks: BarcoHooks | null = null;
export const bindBarco = (h: BarcoHooks) => void (hooks = h);

/** Ask Bento for his menu (near the shack). */
export const askBarcos = () => hooks?.send({ t: 'barco', action: 'menu' });
/** Hand the boat back (from the shack, or the stage's "Devolver o barco"). */
export const returnBarco = () => hooks?.send({ t: 'barco', action: 'return' });

const words = (list: { pt: string; en: string }[]) => ({ pt: list.map((f) => f.pt).join(' e '), en: list.map((f) => f.en).join(' and ') });

export function onBarcoMsg(m: Extract<ServerMsg, { t: 'barco' }>) {
  if (m.phase === 'menu') return openMenu(m);
  if (m.phase === 'trip') {
    speak(BENTO_LINES.rented.pt, { speaker: 'bento' });
    return;
  }
  if (m.phase === 'ended') {
    if (m.why === 'time') toast('info', 'O tempo do barco acabou. Ele voltou pro Bento.', 'Your boat time is up. It went back to Bento.');
    else if (m.why === 'returned') speak(BENTO_LINES.back.pt, { speaker: 'bento' });
  }
}

function openMenu(m: MenuMsg) {
  // at most 3 boats, 2 beside "Devolver o barco": "Agora não" always fits
  const tiers = visibleBoatTiers(m.tiers, boatChipRoom(!!m.trip));
  const chips: BoxChip[] = [];
  const actions: (() => void)[] = [];
  if (m.trip) {
    chips.push({ pt: 'Devolver o barco', en: 'Return the boat' });
    actions.push(() => returnBarco());
  }
  for (const t of tiers) {
    const fish = t.newFish.length ? words(t.newFish) : null;
    if (t.tier === 'festa') {
      chips.push({ pt: m.partyBoat ? `${t.pt} · ${t.price} RV` : `${t.pt} · em breve`, en: m.partyBoat ? `${t.en} · ${t.price} RV` : `${t.en} · coming soon` });
      actions.push(() => (m.partyBoat && hooks?.party ? hooks.party() : toast('info', 'O barco de festa ainda não está saindo.', 'The party boat is not sailing yet.')));
      continue;
    }
    chips.push({ pt: `${t.pt} · ${t.price} RV${fish ? ` · ${fish.pt}` : ''}`, en: `${t.en} · ${t.price} RV${fish ? ` · ${fish.en}` : ''}` });
    actions.push(() => {
      if (m.trip) return toast('info', 'Devolva o barco que está com você antes.', 'Return the boat you have first.');
      if (!t.canAfford) {
        speak(BENTO_LINES.broke.pt, { speaker: 'bento' });
        return toast('info', BENTO_LINES.broke.pt, BENTO_LINES.broke.en);
      }
      hooks?.send({ t: 'barco', action: 'rent', tier: t.tier as BoatTier });
    });
  }
  chips.push({ pt: 'Agora não', en: 'Not now' });
  actions.push(() => {});
  showDialogueBox({
    key: 'barco-menu',
    npcId: 'bento',
    speaker: 'Seu Bento',
    role: 'Aluguel de barcos (Boat rental)',
    expression: 'feliz',
    line: m.trip
      ? { pt: 'Seu barco está lá no píer. Quer devolver?', en: 'Your boat is at the pier. Want to return it?' }
      : { pt: 'Qual barco vai ser hoje?', en: 'Which boat will it be today?' },
    chips,
    onChip: (i) => {
      closeDialogue();
      actions[i]?.();
    },
    onClose: closeDialogue,
  });
}
