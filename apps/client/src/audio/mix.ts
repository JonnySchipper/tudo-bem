/**
 * The mix of the whole game in one place: how loud each bed, Praça phrase and stinger should sound (integrated loudness,
 * LUFS), and the master chain they all go through. `calibration.json` holds what each one measures at unity gain
 * (`node scripts/audio-lab.mjs calibrate` writes it), so a gain is just target minus measurement and changing an
 * arrangement never silently changes the balance between places.
 */
import calibration from './calibration.json';
import type { ArrangementKind, Mood, StingKind } from './theme';

export type BedKind = ArrangementKind | 'praca';

/**
 * Targets. The intro is the showpiece; the rooms sit under speech and the world; the Praça's phrases drift in under the street;
 * stingers land a little above the bed they interrupt and never on top of it.
 */
export const TARGET_LUFS = {
  bed: { intro: -22.5, radio: -27, padaria: -28.5, padariaNight: -30, kitnet: -30.5, academia: -29.5, bout: -25.5 } satisfies Record<ArrangementKind, number>,
  phrase: { morning: -31, day: -31, golden: -30.5, night: -32, rain: -32 } satisfies Record<Mood, number>,
  sting: { recado: -25, heart: -28, coin: -31, mission: -23.5, caderno: -28, win: -23.5, lose: -27, door: -31 } satisfies Record<StingKind, number>,
};

interface Calibration {
  bed: Record<ArrangementKind, number>;
  phrase: Record<Mood, number>;
  sting: Record<StingKind, number>;
}

const CAL = calibration as Calibration;
const gainFor = (target: number, measured: number | undefined) => (measured === undefined ? 0.5 : Math.min(4, Math.pow(10, (target - measured) / 20)));

export const levels = {
  bed: (k: ArrangementKind) => gainFor(TARGET_LUFS.bed[k], CAL.bed[k]),
  phrase: (m: Mood) => gainFor(TARGET_LUFS.phrase[m], CAL.phrase[m]),
  sting: (k: StingKind) => gainFor(TARGET_LUFS.sting[k], CAL.sting[k]),
};

/** Under speech the music steps back about 10 dB, quickly but not abruptly, and comes back slower. */
export const DUCK = { level: 0.32, attack: 0.08, release: 0.35 } as const;
/** While a stinger plays, the bed under it dips a few dB so the two do not stack. */
export const STING_DIP = 0.6;
/** Room-to-room crossfade time constant (s): about 1.5 s to settle, both sides overlapping. */
export const XFADE_TAU = 0.42;

/**
 * The master: a soft limiter well above the music's peaks, there only so a stinger over a bout cheer over a bed can never clip.
 * (Chrome's compressor adds make-up gain of its own; at this threshold and ratio it is about +1 dB, folded into `gain`.)
 */
export function createMaster(ctx: BaseAudioContext, dest: AudioNode): { input: GainNode; nodes: AudioNode[] } {
  const input = ctx.createGain();
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3;
  lim.knee.value = 4;
  lim.ratio.value = 12;
  lim.attack.value = 0.003;
  lim.release.value = 0.25;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  input.connect(lim);
  lim.connect(out);
  out.connect(dest);
  return { input, nodes: [input, lim, out] };
}
