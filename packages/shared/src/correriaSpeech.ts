import {
  ASK_LINE,
  CHEERS,
  FAST_LINES,
  GAVE_UP_LINES,
  LATE_LINES,
  PERFECT_LINES,
  REGULAR_LINES,
  REGULAR_VOICE,
  SECOND_LINES,
  WAVE_CHEERS,
  askResultLine,
  makeCorrOrder,
  makeFollow,
  payNote,
} from './correria.js';
import { MG_ITEMS, MG_MODS, linePt, mulberry32 } from './meveum.js';
import { numberPt } from './numbers.js';
import { speechChunks } from './speechChunks.js';

/**
 * Everything the customers at the Balcão say aloud. Fixed lines (thanks, goodbyes, cheers) are baked whole. The lines that are assembled
 * from items, counts and money ("Me vê dois pães e um café", "Faltou uma coxinha!", "Isso! Doze reais. Toma, vinte reais.") are cut into
 * short phrases (`speechChunks`): a few hundred clips cover every order the game can make, and the player plays them back to back.
 */
export function correriaSpokenLines(): { text: string; source: string }[] {
  const out: { text: string; source: string }[] = [];
  const whole = (text: string | undefined, source: string) => text && out.push({ text, source });
  const chunked = (text: string | undefined, source: string) => {
    for (const c of text ? speechChunks(text) : []) out.push({ text: c, source });
  };

  for (const fem of [false, true]) for (const set of [PERFECT_LINES, FAST_LINES, SECOND_LINES, REGULAR_LINES, LATE_LINES]) for (const f of set) whole(f(fem).pt, 'correria line');
  for (const l of [...GAVE_UP_LINES, ...CHEERS, ...WAVE_CHEERS, ASK_LINE]) whole(l.pt, 'correria line');
  for (const v of Object.values(REGULAR_VOICE)) for (const l of v ? [v.greet, ...v.thanks] : []) whole(l.pt, 'correria regular');

  // orders and follow-ups: sampled until the set of phrases stops growing (a test checks a bigger sample is covered)
  for (let seed = 1; seed <= 300; seed++)
    for (const level of [0, 1, 2, 3])
      for (const wave of [0, 1, 2])
        for (const [i, minute] of [420, 800, 1200].entries())
          for (const shifts of [1, 40]) {
            const saturday = (seed + i) % 2 === 0;
            const rng = mulberry32(seed * 7 + level * 3 + wave + i);
            const order = makeCorrOrder(rng, { level, wave, unlocked: ['sabado'], shifts, saturday, avoid: [], minute });
            chunked(order.pt, 'correria order');
            const follow = makeFollow(rng, order, MG_ITEMS, { where: true });
            chunked(follow?.pt, 'correria follow-up');
          }

  // corrections for a wrong tray
  for (const it of MG_ITEMS) {
    const g = it.card.gender ?? 'm';
    chunked(`Eu não pedi ${it.card.form}.`, 'correria correction');
    for (let q = 1; q <= 3; q++) {
      chunked(`Faltou ${linePt({ itemId: it.id, qty: q })}!`, 'correria correction');
      chunked(`Não, eu pedi ${numberPt(q, g).toUpperCase()} ${q === 1 ? it.card.form : (it.card.plural ?? it.card.form)}…`, 'correria correction');
    }
  }
  for (const m of MG_MODS) for (const t of [`Era ${m.pt}!`, `Não era ${m.pt}.`, `Eu não pedi ${m.pt}.`]) chunked(t, 'correria correction');
  whole('Hmm, não é bem isso.', 'correria correction');

  // "Quanto é?": the total (1..100) and the note they hand over
  for (let total = 1; total <= 100; total++)
    for (const ok of [true, false]) chunked(askResultLine(ok, total, payNote(total)).pt, 'correria ask');
  return out;
}
