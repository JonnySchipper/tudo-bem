/**
 * The short authored greeting with Nanda and Júlia (Phase 7 step 4): three lines, two reply chips each, in the dialogue box. Client-side only
 * (no rewards); opening it tells the server (`talk`) so the recado engine's `talked` event fires. Nanda's box also has "Ver chapéus".
 */
import { NPC_TALK, fillTalk, type NpcId } from '@tudobem/shared';
import { clock } from '../gameClock';
import { heartsWith } from './recadoView';
import { game } from '../state';
import { h, bi } from './dom';
import { speak } from '../audio';
import { showDialogueBox, type BoxChip } from './dialogue';
import { showJulia, closeDialogue } from './panels';
import { expressionForScore } from './pixelArt';

export interface TalkHooks {
  /** Tell the server (`{ t: 'talk', npc }`); optional now that the caller sends it when the NPC is first spoken to. */
  talked?: (npc: NpcId) => void;
  /** Open the hat shop (Nanda). */
  openShop: () => void;
}

const SPEAKER: Record<string, { name: string; role: string }> = {
  nanda: { name: 'Nanda', role: 'Loja de chapéus' },
  julia: { name: 'Júlia', role: 'Guia da praça' },
  graca: { name: 'Dona Graça', role: 'Padeira da noite' },
  prof: { name: 'Professora Bia', role: 'Professora de jiu-jitsu' },
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
  let answered = 0;
  const render = (nodeId: string) => {
    const node = talk.nodes[nodeId];
    if (!node) return closeDialogue();
    const line = { pt: fillTalk(node.line.pt, ctx), en: fillTalk(node.line.en, ctx) };
    speak(line.pt);
    const chips: BoxChip[] = node.chips.map((c) => ({ pt: fillTalk(c.pt, ctx), en: fillTalk(c.en, ctx) }));
    const choose = (i: number) => {
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
          : undefined,
      onChip: choose,
      onClose: closeDialogue,
    });
  };
  render(talk.start);
}
