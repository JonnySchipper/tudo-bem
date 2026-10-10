/**
 * Teach by doing (no DOM): the coach marks of the Tapioca cart, Correria's pattern (`correriaPracticeLogic.ts`). One short
 * English line with the Portuguese word from the stage beside it, pinned next to the thing to use, for each action the player
 * has never done: hold a pan to sift the goma, flip at the green ring, drag the filling, tap to fold, drag the tapioca to the
 * customer, and the lixeira for a botched one. A mark goes away for good once its action is done (`TAPIOCA_COACH_KEY`); the
 * practice and every real run share the one list, so a new player meets each mark once. The "?" shows them again.
 *
 * Every Portuguese word here is already on the stage (labels and the filling bowls). needs_br: true
 */
import { TAPIOCA_FILLING_LABEL, type Bilingual, type TapiocaFilling } from '@tudobem/shared';

export type TapiocaCoachKey = 'sift' | 'flip' | 'fill' | 'fold' | 'serve' | 'bin';
export const TAPIOCA_COACH_KEYS: readonly TapiocaCoachKey[] = ['sift', 'flip', 'fill', 'fold', 'serve', 'bin'];

export interface TapiocaCoachMark extends Bilingual {
  key: TapiocaCoachKey;
  /** The stage hit id it points at (`tapioca-pan-0`, `tapioca-bowl-queijo`, `tapioca-bin`). */
  target: string;
}

export type TapiocaPanPhase = 'empty' | 'spreading' | 'cooking' | 'flipped' | 'filled' | 'folded';

/** What the marks read from the cart this frame. */
export interface TapiocaCoachState {
  pans: readonly {
    phase: TapiocaPanPhase;
    /** unlocked (pans 2 and 3 open mid-run) */
    open: boolean;
    /** torn, stuck, holes or over the rim: it can still be served, but only as "Quase!" */
    botched: boolean;
    filling: TapiocaFilling | null;
  }[];
  /** What the customers at the counter asked for, front first. */
  wants: readonly TapiocaFilling[];
}

const mark = (key: TapiocaCoachKey, target: string, pt: string, en: string): TapiocaCoachMark => ({ key, target, pt, en });
const pan = (i: number) => `tapioca-pan-${i}`;

/** The mark to show now, or null. A wrong filling (nobody at the counter asked for it) points at the lixeira before anything else but a flip. */
export function tapiocaCoachMark(st: TapiocaCoachState, seen: ReadonlySet<string>): TapiocaCoachMark | null {
  const open = st.pans.map((p, i) => ({ ...p, i })).filter((p) => p.open);
  const first = (phase: TapiocaPanPhase) => open.find((p) => p.phase === phase);
  const wrong = (p: (typeof open)[number]) => !!p.filling && st.wants.length > 0 && !st.wants.includes(p.filling);
  const cooking = first('cooking');
  if (cooking && !seen.has('flip')) return mark('flip', pan(cooking.i), 'Vira!', 'Tap the pan when its ring is green.');
  const bin = () => mark('bin', 'tapioca-bin', 'Lixeira', 'Not right? Drag it into the bin.');
  if (!seen.has('bin') && open.some((p) => (p.phase === 'filled' || p.phase === 'folded') && wrong(p))) return bin();
  const folded = open.find((p) => p.phase === 'folded' && !wrong(p));
  if (folded && st.wants.length && !seen.has('serve')) return mark('serve', pan(folded.i), 'Pronta!', 'Drag it to the customer.');
  const filled = first('filled');
  if (filled && !seen.has('fold')) return mark('fold', pan(filled.i), 'Dobra', 'Tap it to fold it.');
  const flipped = first('flipped');
  if (flipped && !seen.has('fill')) {
    const want = st.wants[0];
    if (!want) return mark('fill', pan(flipped.i), 'Recheio', 'Drag a filling onto the tapioca.');
    const label = TAPIOCA_FILLING_LABEL[want];
    return mark('fill', `tapioca-bowl-${want}`, label.pt, `Drag the ${label.en} onto the tapioca.`);
  }
  if (!seen.has('bin') && open.some((p) => p.botched && p.phase !== 'empty' && p.phase !== 'spreading' && p.phase !== 'cooking')) return bin();
  if (!seen.has('sift') && open.length && open.every((p) => p.phase === 'empty' || p.phase === 'spreading')) {
    const at = open.find((p) => p.phase === 'spreading') ?? open[0]!;
    return mark('sift', pan(at.i), 'Segura', 'Hold the pan to sift the goma. Let go at the rim.');
  }
  return null;
}

/** Where the learnt marks are kept (per browser, like Correria's). */
export const TAPIOCA_COACH_KEY = 'tb_tp_coach_v1';
export function readTapiocaCoach(raw: string | null): Set<string> {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && (TAPIOCA_COACH_KEYS as readonly string[]).includes(x)) : []);
  } catch {
    return new Set();
  }
}

/** Done once: a player who finished (or skipped) the practice, or already has a Tapioca run on their profile, goes straight to a real run. */
export const TAPIOCA_PRACTICE_KEY = 'tb_tp_practice';
export function tapiocaPracticeNeeded(stored: string | null, runs: number): boolean {
  return stored !== '1' && !(runs > 0);
}

/** The practice is over: one line (Correria's), then the real run. */
export const TAPIOCA_PRACTICE_DONE: Bilingual = { pt: 'Boa! 🎉 Agora é pra valer.', en: 'Nice! Now for real.' };
