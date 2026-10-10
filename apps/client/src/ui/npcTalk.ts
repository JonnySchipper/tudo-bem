/**
 * The short authored greeting with Nanda and Júlia (Phase 7 step 4): three lines, two reply chips each, in the dialogue box. Client-side only
 * (no rewards); opening it tells the server (`talk`) so the recado engine's `talked` event fires. Nanda's box also has "Ver chapéus".
 */
import { FILM, NPC_TALK, fillTalk, juliaTalkStart, spokenNameless, type NpcId } from '@tudobem/shared';
import { clock } from '../gameClock';
import { heartsWith } from './recadoView';
import { game } from '../state';
import { h, bi } from './dom';
import { speak } from '../audio';
import { showDialogueBox, type BoxChip } from './dialogue';
import { showJulia, closeDialogue } from './panels';
import { rememberJuliaMet } from './juliaMet';
import { expressionForScore } from './pixelArt';
import { hasPapo } from './papo';

export interface TalkHooks {
  /** Tell the server (`{ t: 'talk', npc }`); optional now that the caller sends it when the NPC is first spoken to. */
  talked?: (npc: NpcId) => void;
  /** Open the hat shop (Nanda). */
  openShop: () => void;
  /** A node is on screen (`npc.node`). The diary may keep a conversation word from it. */
  onLine?: (anchor: string) => void;
  /** Buy a pack of film from Júlia. */
  buyFilm?: () => void;
  /**
   * Captured before the `talk` message, which pays bond immediately.
   * True once this profile has already heard “Eu sou a Júlia”.
   */
  juliaAlreadyMet?: boolean;
  /** Professora Bia's "Quero, sim!": open the mat queue. */
  openMat?: () => void;
  /** "Vamos bater um papo?": start this NPC's bate-papo (ui/papo.ts). */
  papo?: () => void;
  /** The Praia: Bento's boats, Neide's fishing log, Jô's snack menu, fish tray and beach rack. */
  praia?: (what: 'rental' | 'caderneta' | 'snacks' | 'sell' | 'rack') => void;
}

/** Chips that leave the talk for a panel at the Praia. */
const PRAIA_NEXT = new Set(['rental', 'caderneta', 'snacks', 'sell', 'rack']);

const SPEAKER: Record<string, { name: string; role: string }> = {
  nanda: { name: 'Nanda', role: 'Loja de chapéus (Hat shop)' },
  julia: { name: 'Júlia', role: 'Guia da praça (Square guide)' },
  graca: { name: 'Dona Graça', role: 'Padeira da noite (Night baker)' },
  prof: { name: 'Professora Bia', role: 'Professora de jiu-jitsu (Jiu-jitsu teacher)' },
  bento: { name: 'Seu Bento', role: 'Aluguel de barcos (Boat rental)' },
  neide: { name: 'Dona Neide', role: 'Pescadora (Fisherwoman)' },
  jo: { name: 'Jô', role: 'Barraca da praia (Beach kiosk)' },
};

/** Which node the greeting is on, and how many replies were picked (the expression turns happy once the player answered). */
export function openNpcTalk(npcId: NpcId, hooks: TalkHooks): void {
  const talk = NPC_TALK[npcId];
  const who = SPEAKER[npcId];
  if (!talk || !who) return;
  const p = game.profile;
  // the NPC uses your name from 2 hearts, and greets by the hour (`{saudacao}`)
  const ctx = { name: p?.name ?? '', pronoun: p?.pronoun, minute: clock.minutes(), hearts: heartsWith(p?.bond, npcId) };
  if (hooks.talked) hooks.talked(npcId);
  const metJulia = npcId === 'julia' && hooks.juliaAlreadyMet === true;
  if (npcId === 'julia' && !metJulia) rememberJuliaMet();
  let answered = 0;
  const render = (nodeId: string) => {
    const node = talk.nodes[nodeId];
    if (!node) return closeDialogue();
    hooks.onLine?.(`${npcId}.${nodeId}`);
    const line = { pt: fillTalk(node.line.pt, ctx), en: fillTalk(node.line.en, ctx) };
    // the clip is the nameless line: the player's name stays on screen, never in the voice (one clip serves every player)
    speak(spokenNameless(node.line.pt, { pronoun: p?.pronoun, minute: ctx.minute }), { speaker: npcId });
    const chips: BoxChip[] = node.chips.map((c) => ({ pt: fillTalk(c.pt, ctx), en: fillTalk(c.en, ctx) }));
    // the first beat also offers a bate-papo (a pre-made, ungraded conversation), when this NPC has one
    const papo = answered === 0 && hooks.papo && hasPapo(npcId) ? hooks.papo : null;
    if (papo) chips.push({ pt: 'Vamos bater um papo?', en: 'Shall we have a chat?' });
    const choose = (i: number) => {
      if (papo && i === node.chips.length) return papo();
      const c = node.chips[i];
      if (!c) return;
      answered++;
      if (c.next === 'end') return closeDialogue();
      if (c.next === 'shop') {
        closeDialogue();
        return hooks.openShop();
      }
      if (c.next === 'help') {
        closeDialogue();
        return showJulia(true);
      }
      if (c.next === 'treino') {
        closeDialogue();
        return hooks.openMat?.();
      }
      if (PRAIA_NEXT.has(c.next)) {
        closeDialogue();
        return hooks.praia?.(c.next as 'rental');
      }
      render(c.next);
    };
    showDialogueBox({
      key: `talk-${npcId}`,
      npcId,
      speaker: who.name,
      role: who.role,
      expression: expressionForScore(answered ? 3 : undefined),
      line,
      chips,
      footer:
        npcId === 'nanda'
          ? h('button', { class: 'primary', id: 'btn-ver-chapeus', onclick: () => (closeDialogue(), hooks.openShop()) }, bi('Ver chapéus', 'See the hats'))
          : npcId === 'julia' && hooks.buyFilm
            ? h('button', { class: 'primary', id: 'btn-comprar-filme', onclick: () => hooks.buyFilm?.() }, bi(`Filme · ${FILM.price} RV`, `Film · ${FILM.price} reais virtuais (RV)`))
            : undefined,
      onChip: choose,
      onClose: closeDialogue,
    });
  };
  render(npcId === 'julia' ? juliaTalkStart(metJulia) : talk.start);
}
