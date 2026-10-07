import { game } from '../state';

/** Who is behind the padaria counter: Dona Graça on her night shift, Seu Carlos otherwise (the same authored scene, two voices). */
export function counterSpeaker(): 'carlos' | 'graca' {
  const onDuty = [...game.avatars.values()].find((a) => (a.pub.npc === 'carlos' || a.pub.npc === 'graca') && a.pub.activity === 'trabalhando');
  return onDuty?.pub.npc === 'graca' ? 'graca' : 'carlos';
}
