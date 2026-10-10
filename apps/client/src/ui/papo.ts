/**
 * A bate-papo (#229): one of an NPC's pre-made conversations (`PAPOS`) in the dialogue box. Never graded: no score, no right or wrong
 * reply, no math. Every chip leads on; the last one closes the box and tells the server (`papo`), which counts it as a talk, pays a
 * little friendship once a game day, and stamps the cartela when it happened in the praça.
 */
import { fillTalk, gameDay, npcDefById, papoFor, spokenNameless, type NpcId } from '@tudobem/shared';
import { clock } from '../gameClock';
import { heartsWith } from './recadoView';
import { game } from '../state';
import { speak } from '../audio';
import { closeDialogue } from './panels';
import { showDialogueBox, type BoxChip } from './dialogue';
import { expressionForScore } from './pixelArt';

export interface PapoHooks {
  /** The bate-papo was talked through: `{ t: 'papo', npc, id }`. */
  done: (npc: NpcId, id: string) => void;
  /** A node said a diary line word for word (its anchor): the diary may keep that line's word. */
  onLine?: (anchor: string) => void;
}

/** True when the NPC has a bate-papo to start right now. */
export const hasPapo = (npc: NpcId): boolean => !!papoFor(npc, heartsWith(game.profile?.bond, npc), game.profile?.papos ?? [], gameDay(Date.now()));

/** Open the NPC's bate-papo for now (their 4-heart story first, then one not heard yet). False when they have none. */
export function openPapo(npc: NpcId, hooks: PapoHooks): boolean {
  const p = game.profile;
  const heartCount = heartsWith(p?.bond, npc);
  const papo = papoFor(npc, heartCount, p?.papos ?? [], gameDay(Date.now()));
  if (!papo) return false;
  const def = npcDefById(npc);
  const ctx = { name: p?.name ?? '', pronoun: p?.pronoun, minute: clock.minutes(), hearts: heartCount };
  let answered = 0;
  const render = (nodeId: string) => {
    const node = papo.nodes[nodeId];
    if (!node) return closeDialogue();
    if (node.anchor) hooks.onLine?.(node.anchor);
    const line = { pt: fillTalk(node.line.pt, ctx), en: fillTalk(node.line.en, ctx) };
    // the clip is the nameless line: the player's name stays on screen, never in the voice
    speak(spokenNameless(node.line.pt, { pronoun: p?.pronoun, minute: ctx.minute }), { speaker: npc });
    const chips: BoxChip[] = node.chips.map((c) => ({ pt: fillTalk(c.pt, ctx), en: fillTalk(c.en, ctx) }));
    showDialogueBox({
      key: `papo-${npc}`,
      npcId: npc,
      speaker: def?.name ?? npc,
      role: `Bate-papo (Chat) · ${papo.title.pt} (${papo.title.en})`,
      expression: expressionForScore(answered ? 3 : undefined),
      line,
      chips,
      onChip: (i) => {
        const c = node.chips[i];
        if (!c) return;
        answered++;
        if (c.next !== 'end') return render(c.next);
        closeDialogue();
        hooks.done(npc, papo.id);
      },
      onClose: closeDialogue,
    });
  };
  render(papo.start);
  return true;
}
