/**
 * "Tudo Bem", the main theme, as pure data. One 32-bar bossa in D major (A · A' · B · A'') whose first two bars are the
 * hook (the *motif*: E F♯ · C♯ D E). Every place in the game plays some version of it:
 *
 *   intro      the full band, building as the sign-in card arrives
 *   radio      the same tune through a telephone-band speaker in the houses
 *   padaria    a choro-ish take in G (cavaquinho, accordion, clarinet), a slow vibes version after 22:00
 *   kitnet     a music box playing the first eight bars, then silence
 *   academia   a soft samba pulse, the hook on vibes; and `bout`, the same hook as brass stabs over a batucada
 *   praça      sparse phrases of the tune over the street, by time of day and weather (see `phraseNotes`)
 *   feira      "Baião da Feira", the theme's cousin: a new tune in A mixolydian (sanfona, pife, zabumba, triângulo) that opens
 *              with the hook squeezed into one baião bar and whose bridge is the theme's own first eight chords
 *   stingers   recado done, a heart, RV, the daily mission, a Caderno group, a win, a loss, the padaria door
 *
 * No Web Audio in here: `audio/synth.ts` makes the sounds, `audio/sequencer.ts` schedules them, and the tests read this file.
 */

export const THEME_BPM = 112;
export const FORM_BARS = 32;

export type Voice =
  | 'bass'
  | 'comp'
  | 'pad'
  | 'mel'
  | 'lead'
  | 'harm'
  | 'arp'
  | 'bell'
  | 'box'
  | 'cavaco'
  | 'accordion'
  | 'clar'
  | 'stab'
  | 'shaker'
  | 'clave'
  | 'surdo'
  | 'brush'
  | 'pandeiro'
  | 'sanfona'
  | 'pife'
  | 'zabumba'
  | 'triangle';

export const PERCUSSION: ReadonlySet<Voice> = new Set<Voice>(['shaker', 'clave', 'surdo', 'brush', 'pandeiro', 'zabumba', 'triangle']);

export interface ScoreNote {
  voice: Voice;
  /** 16th-note step within the bar (0-15). */
  step: number;
  /** MIDI note (ignored for percussion). */
  midi: number;
  /** Length in 16th steps. */
  dur: number;
  /** 0-1 */
  vel: number;
}

/** A note placed anywhere in a phrase or a stinger: `at` counts 16th steps from its start. */
export interface TimedNote extends Omit<ScoreNote, 'step'> {
  at: number;
}

export interface Chord {
  name: string;
  root: number;
  fifth: number;
  voicing: number[];
}

// ---------------------------------------------------------------- harmony

/** Dmaj9 · Bm9 · Em9 · A13 · F♯m7 · Bm9 · Gmaj9 · A13: warm, unhurried, resolves home. (The original intro loop.) */
export const SECTION_A: Chord[] = [
  { name: 'Dmaj9', root: 38, fifth: 45, voicing: [54, 57, 61, 64] },
  { name: 'Bm9', root: 35, fifth: 42, voicing: [57, 61, 62, 66] },
  { name: 'Em9', root: 40, fifth: 47, voicing: [55, 59, 62, 66] },
  { name: 'A13', root: 33, fifth: 40, voicing: [55, 59, 61, 66] },
  { name: 'F#m7', root: 42, fifth: 49, voicing: [52, 57, 61, 64] },
  { name: 'Bm9', root: 35, fifth: 42, voicing: [57, 61, 62, 66] },
  { name: 'Gmaj9', root: 43, fifth: 50, voicing: [54, 57, 59, 62] },
  { name: 'A13', root: 33, fifth: 40, voicing: [55, 59, 61, 66] },
];

/** The bridge goes to the IV, takes the bittersweet minor iv (Gm6) and comes back through A13. */
export const SECTION_B: Chord[] = [
  { name: 'Gmaj9', root: 43, fifth: 50, voicing: [54, 57, 59, 62] },
  { name: 'F#m7', root: 42, fifth: 49, voicing: [52, 57, 61, 64] },
  { name: 'Bm9', root: 35, fifth: 42, voicing: [57, 61, 62, 66] },
  { name: 'Em9', root: 40, fifth: 47, voicing: [55, 59, 62, 66] },
  { name: 'Gmaj7', root: 43, fifth: 50, voicing: [54, 59, 62, 67] },
  { name: 'Gm6', root: 43, fifth: 50, voicing: [58, 62, 64, 67] },
  { name: 'F#m7', root: 42, fifth: 49, voicing: [52, 57, 61, 64] },
  { name: 'A13', root: 33, fifth: 40, voicing: [55, 59, 61, 66] },
];

/** A · A' · B · A'' (A'' is A again, dressed differently by the arrangement). */
export const FORM_CHORDS: Chord[] = [...SECTION_A, ...SECTION_A, ...SECTION_B, ...SECTION_A];

/** Pitch classes of D major, and the one borrowed note of Gm6. */
export const D_MAJOR: readonly number[] = [2, 4, 6, 7, 9, 11, 1];
export const BORROWED_PC = 10;

// ---------------------------------------------------------------- melody

type Phrase = [step: number, midi: number, dur: number][];

/** The original whistled line, one phrase per bar. Bars 0-1 are the hook. */
const MELODY_A: Phrase[] = [
  [
    [6, 76, 4],
    [10, 78, 6],
  ],
  [
    [0, 73, 8],
    [10, 74, 4],
    [14, 76, 2],
  ],
  [
    [0, 78, 6],
    [6, 74, 4],
    [10, 71, 6],
  ],
  [
    [2, 73, 4],
    [6, 76, 10],
  ],
  [
    [6, 73, 4],
    [10, 76, 6],
  ],
  [
    [0, 74, 6],
    [8, 73, 4],
    [12, 69, 4],
  ],
  [
    [0, 71, 8],
    [10, 74, 6],
  ],
  [[2, 73, 12]],
];

/** The answer: the same tune an octave of motion higher, with the little fills the first time did not have. */
const MELODY_A2: Phrase[] = [
  [
    [2, 76, 2],
    [4, 78, 2],
    [6, 81, 4],
    [10, 78, 2],
    [12, 76, 4],
  ],
  [
    [0, 73, 4],
    [4, 74, 2],
    [6, 76, 2],
    [8, 78, 8],
  ],
  [
    [0, 81, 4],
    [4, 78, 4],
    [8, 76, 2],
    [10, 74, 2],
    [12, 71, 4],
  ],
  [
    [0, 73, 2],
    [2, 76, 2],
    [4, 79, 4],
    [8, 76, 8],
  ],
  [
    [2, 78, 4],
    [6, 81, 2],
    [8, 76, 4],
    [12, 73, 4],
  ],
  [
    [0, 74, 4],
    [4, 78, 4],
    [8, 76, 4],
    [12, 74, 2],
    [14, 73, 2],
  ],
  [
    [0, 71, 4],
    [4, 74, 4],
    [8, 78, 4],
    [12, 81, 4],
  ],
  [
    [0, 79, 4],
    [4, 76, 4],
    [8, 73, 8],
  ],
];

/** The bridge: slower, wider, the melody leans on the new chords. */
const MELODY_B: Phrase[] = [
  [
    [0, 74, 8],
    [8, 79, 8],
  ],
  [
    [0, 78, 6],
    [6, 76, 2],
    [8, 73, 8],
  ],
  [
    [0, 74, 4],
    [4, 71, 4],
    [8, 74, 8],
  ],
  [
    [2, 76, 4],
    [6, 79, 4],
    [10, 83, 6],
  ],
  [
    [0, 81, 6],
    [6, 79, 2],
    [8, 78, 4],
    [12, 74, 4],
  ],
  [
    [0, 70, 8],
    [8, 74, 8],
  ],
  [
    [0, 73, 6],
    [6, 76, 2],
    [8, 78, 8],
  ],
  [
    [0, 76, 4],
    [4, 73, 4],
    [8, 69, 8],
  ],
];

/** The melody of every bar of the form. */
export const FORM_MELODY: Phrase[] = [...MELODY_A, ...MELODY_A2, ...MELODY_B, ...MELODY_A];

/** The hook, relative to bar 0: E F♯ (bar 0) · C♯ D E (bar 1). */
export const MOTIF: readonly { at: number; midi: number; dur: number }[] = [
  ...MELODY_A[0]!.map(([step, midi, dur]) => ({ at: step, midi, dur })),
  ...MELODY_A[1]!.map(([step, midi, dur]) => ({ at: 16 + step, midi, dur })),
];

/** Pitches of the hook as D-major scale degrees (1-7): 2 3 7 1 2. Tests look for this contour everywhere. */
export const MOTIF_DEGREES = [2, 3, 7, 1, 2] as const;

export function degreeOf(midi: number, tonic = 2): number | null {
  const i = SCALE_STEPS.indexOf((((midi - tonic) % 12) + 12) % 12);
  return i < 0 ? null : i + 1;
}

const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

/** Move `n` scale steps along D major (negative = down). */
export function shiftDiatonic(midi: number, n: number): number {
  const rel = midi - 2;
  const oct = Math.floor(rel / 12);
  const pc = rel - oct * 12;
  let idx = SCALE_STEPS.indexOf(pc);
  if (idx < 0) idx = SCALE_STEPS.findIndex((s) => s > pc) - 1;
  const total = oct * 7 + idx + n;
  const o = Math.floor(total / 7);
  return 2 + o * 12 + SCALE_STEPS[((total % 7) + 7) % 7]!;
}

// ---------------------------------------------------------------- arrangements

export type ArrangementKind = 'intro' | 'radio' | 'padaria' | 'padariaNight' | 'kitnet' | 'academia' | 'bout' | 'feira';

export interface Arrangement {
  bpm: number;
  /** semitones added to the chords, the bass and everything but the melody */
  transpose: number;
  /** semitones added to the melody (kept apart so the clarinet is not asked for a high C♯7) */
  melShift: number;
  /** bars before the arrangement repeats */
  loopBars: number;
}

export const ARRANGEMENTS: Record<ArrangementKind, Arrangement> = {
  intro: { bpm: THEME_BPM, transpose: 0, melShift: 0, loopBars: FORM_BARS },
  radio: { bpm: THEME_BPM, transpose: 0, melShift: 0, loopBars: FORM_BARS },
  padaria: { bpm: 104, transpose: 5, melShift: -7, loopBars: FORM_BARS },
  padariaNight: { bpm: 72, transpose: 0, melShift: 0, loopBars: 16 },
  kitnet: { bpm: 70, transpose: 0, melShift: 0, loopBars: 16 },
  academia: { bpm: 100, transpose: 0, melShift: 0, loopBars: 8 },
  bout: { bpm: 118, transpose: 0, melShift: 0, loopBars: 8 },
  // A mixolydian has exactly D major's notes, so the feira needs no transpose: it is the same seven notes with a new home
  feira: { bpm: 116, transpose: 0, melShift: 0, loopBars: FORM_BARS },
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

const COMP: number[][] = [
  [0, 3, 6, 10, 12],
  [2, 6, 8, 11, 14],
];
/** Bossa clave, 3-2. */
const CLAVE: number[][] = [
  [0, 6, 12],
  [4, 8],
];
/** Picking pattern, chord-tone indexes (Chord.voicing). */
const ARP_STEPS = [0, 2, 4, 6, 8, 10, 12, 14];
const ARP_TONES = [0, 2, 3, 2, 1, 2, 3, 2];

function bossaBass(chord: Chord, out: ScoreNote[], vel = 1) {
  out.push({ voice: 'bass', step: 0, midi: chord.root, dur: 6, vel });
  out.push({ voice: 'bass', step: 8, midi: chord.fifth, dur: 6, vel: vel * 0.85 });
  out.push({ voice: 'bass', step: 14, midi: chord.root + 12, dur: 2, vel: vel * 0.55 });
}

function strum(chord: Chord, bar: number, out: ScoreNote[], voice: Voice, vel = 1, steps = COMP[bar % 2]!) {
  steps.forEach((step, i) => {
    const v = (i === 0 ? 0.95 : 0.7 + ((i * 37) % 5) * 0.05) * vel;
    for (const m of chord.voicing) out.push({ voice, step, midi: m, dur: 3, vel: v });
  });
}

function pad(chord: Chord, out: ScoreNote[], vel = 0.9, voice: Voice = 'pad') {
  for (const m of chord.voicing) out.push({ voice, step: 0, midi: m, dur: 16, vel });
}

function melody(bar: number, out: ScoreNote[], voice: Voice, vel = 1) {
  for (const [step, midi, dur] of FORM_MELODY[bar]!) out.push({ voice, step, midi, dur, vel });
}

/** A diatonic third under the melody, soft: the second voice of the vibraphone. */
function harmony(bar: number, out: ScoreNote[], vel = 0.55) {
  for (const [step, midi, dur] of FORM_MELODY[bar]!) {
    const low = D_MAJOR.includes(((midi % 12) + 12) % 12) ? shiftDiatonic(midi, -2) : midi - 4;
    out.push({ voice: 'harm', step, midi: low, dur, vel });
  }
}

function pulse(out: ScoreNote[], voice: Voice, steps: number[], vel: number, accent = 1) {
  steps.forEach((step, i) => out.push({ voice, step, midi: 0, dur: 1, vel: i % 2 === 0 ? vel * accent : vel }));
}

/**
 * The 16 steps of one bar of an arrangement. `index` is the absolute bar (it wraps at `loopBars`); `boost` raises the band
 * (the intro sets it when the sign-in card arrives, the bout when a finishing chance opens).
 */
export function scoreBar(kind: ArrangementKind, index: number, boost = 0): ScoreNote[] {
  const arr = ARRANGEMENTS[kind];
  const bar = mod(index, arr.loopBars);
  const out: ScoreNote[] = [];
  const section = Math.floor(bar / 8);
  const chord = FORM_CHORDS[bar % FORM_BARS]!;
  const b8 = bar % 8;

  if (kind === 'intro' || kind === 'radio') {
    const lvl = (kind === 'radio' ? 2 : [1, 2, 2, 3][section]!) + boost;
    pad(chord, out, section === 2 ? 1.15 : 0.9, section === 2 ? 'accordion' : 'pad');
    bossaBass(chord, out);
    strum(chord, bar, out, 'comp', lvl >= 2 ? 1 : 0.8);
    if (kind === 'radio') {
      melody(bar, out, 'mel');
      pulse(out, 'shaker', [0, 2, 4, 6, 8, 10, 12, 14], 0.55, 1.8);
      return out;
    }
    if (section === 2) melody(bar, out, 'lead', 1);
    else melody(bar, out, 'mel');
    if (section === 1 || section === 3) harmony(bar, out, 0.6);
    pulse(out, 'shaker', [0, 2, 4, 6, 8, 10, 12, 14], 0.55, 1.8);
    if (lvl >= 2) {
      CLAVE[bar % 2]!.forEach((step) => out.push({ voice: 'clave', step, midi: 0, dur: 1, vel: 0.7 }));
      ARP_STEPS.forEach((step, i) => out.push({ voice: 'arp', step, midi: chord.voicing[ARP_TONES[i]!]! + 12, dur: 2, vel: 0.5 + (i % 2) * 0.1 }));
    }
    if (lvl >= 3) {
      out.push({ voice: 'surdo', step: 0, midi: 0, dur: 1, vel: 0.5 }, { voice: 'surdo', step: 8, midi: 0, dur: 1, vel: 0.85 });
      out.push({ voice: 'bell', step: 12, midi: chord.voicing[3]! + 24, dur: 4, vel: 0.5 });
    }
    if (lvl >= 4) pulse(out, 'brush', [2, 6, 10, 14], 0.5);
    if (b8 === 7 && section !== 3) out.push({ voice: 'bell', step: 10, midi: 85, dur: 6, vel: 0.5 });
    // the last bar of each section leans into the next: the guitar lets go on the "and" of four
    if (b8 === 7 && lvl >= 2) out.push({ voice: 'surdo', step: 14, midi: 0, dur: 1, vel: 0.45 });
    return out;
  }

  if (kind === 'padaria') {
    // choro in G: cavaquinho keeps the time, the accordion holds the chord, the clarinet carries the tune
    const t = arr.transpose;
    pad(chord, out, 0.8, 'accordion');
    const bassNotes: [number, number, number][] = [
      [0, chord.root + 12, 3],
      [4, chord.fifth, 3],
      [8, chord.root + 12, 3],
      [12, chord.fifth, 3],
    ];
    for (const [step, midi, dur] of bassNotes) out.push({ voice: 'bass', step, midi, dur, vel: step === 0 ? 1 : 0.75 });
    // choro cavaquinho: the "tcha-ca-tchá" figure, not a wall of eighths
    strum(chord, bar, out, 'cavaco', 0.8, bar % 2 ? [0, 3, 6, 10, 12] : [0, 3, 4, 8, 11, 14]);
    pulse(out, 'pandeiro', [0, 2, 4, 6, 8, 10, 12, 14], 0.45, 1.5);
    // the clarinet sings A and A'; in the bridge it rests and the vibes take the tune, then it comes home for A''
    if (section === 2) melody(bar, out, 'harm', 0.85);
    else melody(bar, out, 'clar', 0.95);
    if (section === 1) harmony(bar, out, 0.4);
    return out.map((n) => (PERCUSSION.has(n.voice) ? n : { ...n, midi: n.voice === 'clar' || n.voice === 'harm' ? n.midi + arr.melShift : n.midi + t }));
  }

  if (kind === 'padariaNight') {
    // after 22:00: Dona Graça's counter, the tune on vibes, a felt pad, almost nothing else
    pad(chord, out, 0.8, 'pad');
    out.push({ voice: 'bass', step: 0, midi: chord.root, dur: 12, vel: 0.7 });
    if (b8 < 4) melody(bar, out, 'harm', 0.8);
    if (b8 === 3 || b8 === 7) out.push({ voice: 'bell', step: 8, midi: chord.voicing[3]! + 24, dur: 6, vel: 0.4 });
    return out;
  }

  if (kind === 'kitnet') {
    // a music box plays the first eight bars once; the other eight are the room breathing
    if (bar < 8) {
      melody(bar, out, 'box', 0.85);
      pad(chord, out, 0.55, 'pad');
      out.push({ voice: 'bass', step: 0, midi: chord.root, dur: 14, vel: 0.45 });
    } else if (bar === 8) {
      pad(SECTION_A[0]!, out, 0.4, 'pad');
    }
    return out;
  }

  if (kind === 'feira') return feiraBar(bar, boost);

  // academia and bout: the first four chords of the tune as a loop, a batucada under them
  const loopChord = SECTION_A[bar % 4 === 3 ? 3 : bar % 4]!;
  const swing = kind === 'bout';
  out.push({ voice: 'bass', step: 0, midi: loopChord.root, dur: 3, vel: 1 });
  out.push({ voice: 'bass', step: 6, midi: loopChord.fifth, dur: 3, vel: 0.8 });
  out.push({ voice: 'bass', step: 8, midi: loopChord.root, dur: 3, vel: 0.9 });
  if (swing) out.push({ voice: 'bass', step: 14, midi: loopChord.root + 7, dur: 2, vel: 0.6 });
  out.push({ voice: 'surdo', step: 0, midi: 0, dur: 1, vel: 0.5 }, { voice: 'surdo', step: 8, midi: 0, dur: 1, vel: 1 });
  pulse(out, 'pandeiro', [0, 2, 4, 6, 8, 10, 12, 14], swing ? 0.5 : 0.32, 1.6);
  pulse(out, 'shaker', [1, 3, 5, 7, 9, 11, 13, 15], swing ? 0.5 : 0.35);
  if (swing || b8 % 2 === 1) CLAVE[bar % 2]!.forEach((step) => out.push({ voice: 'clave', step, midi: 0, dur: 1, vel: swing ? 0.75 : 0.45 }));
  strum(loopChord, bar, out, 'cavaco', swing ? 0.8 : 0.5, [2, 6, 10, 14]);
  // the hook, every other time round: brass stabs in the bout, a soft vibes line in the room
  const hookBar = bar % 4;
  if (hookBar === 0) for (const [step, midi, dur] of MELODY_A[0]!) out.push({ voice: swing ? 'stab' : 'harm', step, midi: midi - (swing ? 12 : 0), dur: swing ? 3 : dur, vel: swing ? 0.9 : 0.7 });
  if (hookBar === 1) for (const [step, midi, dur] of MELODY_A[1]!) out.push({ voice: swing ? 'stab' : 'harm', step, midi: midi - (swing ? 12 : 0), dur: swing ? 3 : dur, vel: swing ? 0.9 : 0.7 });
  if (swing && hookBar >= 2) {
    const m = hookBar === 2 ? [[2, 78], [6, 74], [10, 71]] : [[2, 76], [6, 73], [8, 69]];
    for (const [step, midi] of m as [number, number][]) out.push({ voice: 'stab', step, midi: midi - 12, dur: 3, vel: 0.8 });
  }
  if (boost > 0 && bar % 2 === 0) for (const m of loopChord.voicing) out.push({ voice: 'stab', step: 0, midi: m, dur: 4, vel: 0.32 });
  return out;
}

// ---------------------------------------------------------------- the feira: "Baião da Feira"

/*
 * A cousin of the theme, not a cover of it. What it keeps: the hook's five pitches (E F♯ C♯ D E) open the tune, the same seven
 * notes (A mixolydian is D major starting on A, the G♮ is what makes it sound nordestino), and the bridge is the theme's own first
 * eight chords. What it changes: the groove (baião, 3+3+2), the home note (A), the band (a forró trio and a pife) and every bar
 * of melody after the first.
 */

const A7: Chord = { name: 'A7', root: 33, fifth: 40, voicing: [55, 61, 64, 69] };
const G6: Chord = { name: 'G6', root: 43, fifth: 50, voicing: [55, 59, 62, 64] };
const D6: Chord = { name: 'D6', root: 38, fifth: 45, voicing: [54, 57, 59, 62] };
const EM7: Chord = { name: 'Em7', root: 40, fifth: 47, voicing: [52, 55, 59, 62] };

/** A · A' · B · A''. The bridge borrows the theme's A section changes whole: walking in from the Praça, that is what sounds like home. */
const FEIRA_A: Chord[] = [A7, A7, G6, A7, D6, G6, EM7, A7];
export const FEIRA_CHORDS: Chord[] = [...FEIRA_A, ...FEIRA_A, ...SECTION_A, ...FEIRA_A];

/** Baião phrasing: most bars fall 3 + 3 + 2 + 3 + 5 sixteenths. */
const FEIRA_MEL_A: Phrase[] = [
  // the hook, E F♯ C♯ D E, squeezed into one bar of baião
  [
    [0, 76, 3],
    [3, 78, 3],
    [6, 73, 2],
    [8, 74, 3],
    [11, 76, 5],
  ],
  // and the answer the theme never gives: up to the flat seventh, down the A7 to the root
  [
    [0, 79, 3],
    [3, 78, 3],
    [6, 76, 2],
    [8, 73, 4],
    [12, 69, 4],
  ],
  // the hook again, one step down the scale (D E B C♯ D) over G
  [
    [0, 74, 3],
    [3, 76, 3],
    [6, 71, 2],
    [8, 73, 3],
    [11, 74, 5],
  ],
  [
    [0, 76, 3],
    [3, 74, 3],
    [6, 73, 2],
    [8, 69, 8],
  ],
  [
    [0, 78, 3],
    [3, 81, 3],
    [6, 78, 2],
    [8, 74, 3],
    [11, 78, 5],
  ],
  [
    [0, 79, 3],
    [3, 83, 3],
    [6, 79, 2],
    [8, 76, 3],
    [11, 74, 5],
  ],
  [
    [0, 74, 3],
    [3, 76, 3],
    [6, 79, 2],
    [8, 78, 3],
    [11, 76, 5],
  ],
  [
    [2, 73, 2],
    [4, 76, 2],
    [6, 69, 10],
  ],
];

/** A' turns at bar 3 into a question (up to the high A) and its last bar leans on G, the seventh of A, which falls to the F♯ of the bridge's D. */
const FEIRA_MEL_A2: Phrase[] = [
  FEIRA_MEL_A[0]!,
  FEIRA_MEL_A[1]!,
  FEIRA_MEL_A[2]!,
  [
    [0, 76, 3],
    [3, 78, 3],
    [6, 79, 2],
    [8, 81, 8],
  ],
  FEIRA_MEL_A[4]!,
  FEIRA_MEL_A[5]!,
  [
    [0, 79, 3],
    [3, 78, 3],
    [6, 76, 2],
    [8, 74, 3],
    [11, 73, 5],
  ],
  [
    [0, 76, 6],
    [8, 73, 2],
    [10, 76, 2],
    [12, 79, 4],
  ],
];

/** The bridge, over Dmaj9 · Bm9 · Em9 · A13 · F♯m7 · Bm9 · Gmaj9 · A13: still baião, but now singing the theme's harmony. */
const FEIRA_MEL_B: Phrase[] = [
  [
    [0, 74, 3],
    [3, 76, 3],
    [6, 78, 10],
  ],
  [
    [0, 73, 3],
    [3, 74, 3],
    [6, 76, 2],
    [8, 78, 4],
    [12, 74, 4],
  ],
  [
    [0, 79, 3],
    [3, 78, 3],
    [6, 76, 2],
    [8, 74, 3],
    [11, 71, 5],
  ],
  [
    [0, 73, 3],
    [3, 76, 3],
    [6, 78, 2],
    [8, 76, 8],
  ],
  [
    [0, 76, 3],
    [3, 78, 3],
    [6, 81, 2],
    [8, 78, 3],
    [11, 76, 5],
  ],
  [
    [0, 74, 3],
    [3, 73, 3],
    [6, 74, 2],
    [8, 78, 3],
    [11, 74, 5],
  ],
  [
    [0, 71, 3],
    [3, 74, 3],
    [6, 78, 2],
    [8, 81, 4],
    [12, 79, 4],
  ],
  [
    [0, 78, 3],
    [3, 76, 3],
    [6, 73, 2],
    [8, 76, 8],
  ],
];

/** A'' ends on the baião tag: down the A7 with the G♮ in it, A G E C♯ A. */
const FEIRA_TAG: Phrase = [
  [0, 81, 2],
  [2, 79, 2],
  [4, 76, 2],
  [6, 73, 2],
  [8, 69, 8],
];

export const FEIRA_MELODY: Phrase[] = [...FEIRA_MEL_A, ...FEIRA_MEL_A2, ...FEIRA_MEL_B, ...FEIRA_MEL_A.slice(0, 7), FEIRA_TAG];

/** Zabumba: the boom on 1, the "a" of 1, 3 and the "a" of 3 (accents ≥ 0.6), the bacalhau stick on the rim in between (soft hits). */
const ZABUMBA: [number, number][] = [
  [0, 1],
  [3, 0.75],
  [4, 0.35],
  [6, 0.45],
  [8, 0.95],
  [11, 0.75],
  [12, 0.35],
  [14, 0.45],
];

function feiraBar(bar: number, boost: number): ScoreNote[] {
  const out: ScoreNote[] = [];
  const section = Math.floor(bar / 8);
  const chord = FEIRA_CHORDS[bar]!;
  const tune = FEIRA_MELODY[bar]!;
  const full = section === 3 || boost > 0;

  // the sanfona's left hand: bass buttons with the zabumba, chord buttons on the off-beats
  for (const [step, midi, dur, vel] of [
    [0, chord.root, 3, 1],
    [3, chord.root, 2, 0.7],
    [6, chord.fifth, 2, 0.75],
    [8, chord.root, 3, 0.95],
    [11, chord.root, 2, 0.7],
    [14, chord.fifth, 2, 0.7],
  ] as [number, number, number, number][])
    out.push({ voice: 'bass', step, midi, dur, vel });
  for (const step of [2, 6, 10, 14]) for (const m of chord.voicing) out.push({ voice: 'accordion', step, midi: m, dur: 2, vel: step % 8 === 6 ? 0.8 : 0.65 });

  // the trio's drums: zabumba and triângulo (open on the off-beat eighths, choked in between)
  for (const [step, vel] of ZABUMBA) out.push({ voice: 'zabumba', step, midi: 0, dur: 1, vel });
  for (let step = 0; step < 16; step++) out.push({ voice: 'triangle', step, midi: 0, dur: 1, vel: step % 4 === 2 ? 0.9 : step % 2 === 0 ? 0.5 : 0.35 });

  // who sings: the sanfona in A and the bridge, the pife (an octave up) in A' and A'', the sanfona a third under it in A''
  const lead: Voice = section === 1 || section === 3 ? 'pife' : 'sanfona';
  for (const [step, midi, dur] of tune) out.push({ voice: lead, step, midi: lead === 'pife' ? midi + 12 : midi, dur, vel: 0.95 });
  if (section === 3)
    for (const [step, midi, dur] of tune) out.push({ voice: 'sanfona', step, midi: shiftDiatonic(midi, -2), dur, vel: 0.55 });

  // the bridge opens up: the cavaquinho joins, and a bell marks the theme's chords
  if (section === 2) {
    strum(chord, bar, out, 'cavaco', 0.55, [2, 6, 10, 14]);
    if (bar % 2 === 0) out.push({ voice: 'bell', step: 0, midi: chord.voicing[3]! + 12, dur: 6, vel: 0.35 });
  }
  if (full) out.push({ voice: 'surdo', step: 8, midi: 0, dur: 1, vel: 0.55 });
  // the last bar before the loop: a zabumba pickup into the top
  if (bar === FORM_BARS - 1) out.push({ voice: 'zabumba', step: 15, midi: 0, dur: 1, vel: 0.8 });
  return out;
}

// ---------------------------------------------------------------- phrases for the street

export type PhraseId = 'hook' | 'a' | 'close' | 'answer' | 'high' | 'bridge' | 'bridge2' | 'tag';

/** Pieces of the form the Praça plays: [first bar, bars]. */
export const PHRASES: Record<PhraseId, [number, number]> = {
  hook: [0, 2],
  a: [0, 4],
  close: [4, 4],
  answer: [8, 4],
  high: [12, 4],
  bridge: [16, 4],
  bridge2: [20, 4],
  tag: [28, 4],
};

export type Mood = 'morning' | 'day' | 'golden' | 'night' | 'rain';

export interface MoodDef {
  bpm: number;
  lead: Voice;
  /** a second voice that doubles the lead very softly */
  double?: Voice;
  acc: 'arp' | 'pad' | 'both';
  pad: Voice;
  /** seconds between phrases, [min, max] */
  gap: [number, number];
}

export const MOODS: Record<Mood, MoodDef> = {
  morning: { bpm: 112, lead: 'mel', acc: 'arp', pad: 'pad', gap: [16, 30] },
  day: { bpm: 104, lead: 'harm', double: 'mel', acc: 'both', pad: 'pad', gap: [18, 34] },
  golden: { bpm: 100, lead: 'lead', double: 'mel', acc: 'both', pad: 'accordion', gap: [14, 26] },
  night: { bpm: 76, lead: 'box', acc: 'pad', pad: 'pad', gap: [24, 44] },
  rain: { bpm: 84, lead: 'lead', acc: 'pad', pad: 'pad', gap: [20, 36] },
};

/** 05:30-10:30 morning, until 17:00 day, until 20:00 golden hour, the rest night; rain wins over the day. */
export function moodAt(minute: number, rain: number): Mood {
  const m = mod(minute, 1440);
  if (rain > 0.35 && m >= 330 && m < 1230) return 'rain';
  if (m >= 330 && m < 630) return 'morning';
  if (m >= 630 && m < 1020) return 'day';
  if (m >= 1020 && m < 1200) return 'golden';
  return 'night';
}

/** The padaria changes shift at 22:00 and 06:00 (Seu Carlos / Dona Graça). */
export function padariaIsNight(minute: number): boolean {
  const m = mod(minute, 1440);
  return m >= 1320 || m < 360;
}

/** A piece of the tune with its accompaniment, ending on the tonic so a fragment never hangs in the air. */
export function phraseNotes(id: PhraseId, mood: Mood): { notes: TimedNote[]; bars: number } {
  const [from, bars] = PHRASES[id];
  const def = MOODS[mood];
  const notes: TimedNote[] = [];
  const low = mood === 'night' ? -12 : 0;
  for (let i = 0; i < bars; i++) {
    const chord = FORM_CHORDS[from + i]!;
    for (const [step, midi, dur] of FORM_MELODY[from + i]!) {
      notes.push({ voice: def.lead, at: i * 16 + step, midi: midi + low, dur, vel: 0.95 });
      if (def.double) notes.push({ voice: def.double, at: i * 16 + step, midi, dur, vel: 0.32 });
    }
    if (def.acc !== 'arp') for (const m of chord.voicing) notes.push({ voice: def.pad, at: i * 16, midi: m, dur: 16, vel: 0.75 });
    if (def.acc !== 'pad') ARP_STEPS.forEach((step, k) => notes.push({ voice: 'arp', at: i * 16 + step, midi: chord.voicing[ARP_TONES[k]!]! + 12, dur: 2, vel: 0.42 + (k % 2) * 0.08 }));
    if (i % 2 === 0) notes.push({ voice: 'bass', at: i * 16, midi: chord.root, dur: 10, vel: mood === 'night' ? 0.45 : 0.6 });
  }
  const home = SECTION_A[0]!;
  const end = bars * 16;
  for (const m of home.voicing) notes.push({ voice: def.pad, at: end, midi: m, dur: 16, vel: 0.75 });
  notes.push({ voice: def.lead, at: end + 2, midi: 74 + low, dur: 12, vel: 0.9 });
  notes.push({ voice: 'bass', at: end, midi: home.root, dur: 14, vel: 0.55 });
  return { notes, bars: bars + 1 };
}

// ---------------------------------------------------------------- stingers

export type StingKind = 'recado' | 'heart' | 'coin' | 'mission' | 'caderno' | 'win' | 'lose' | 'door';

export interface Sting {
  bpm: number;
  notes: TimedNote[];
}

const n = (voice: Voice, at: number, midi: number, dur: number, vel = 1): TimedNote => ({ voice, at, midi, dur, vel });

function chordHit(chord: Chord, at: number, voice: Voice, dur = 8, vel = 0.9): TimedNote[] {
  return chord.voicing.map((m, i) => n(voice, at + (i === 0 ? 0 : 0.18 * i), m, dur, vel));
}

const DMAJ9 = SECTION_A[0]!;

export function stingNotes(kind: StingKind): Sting {
  switch (kind) {
    case 'coin':
      // two bright bell notes, the high E and the A above: the interval the hook ends on, opened up
      return { bpm: 130, notes: [n('bell', 0, 88, 3, 0.9), n('bell', 2, 93, 5, 0.7)] };
    case 'heart':
      // E up to B with a soft Dmaj9 under it
      return { bpm: 104, notes: [n('harm', 0, 76, 5, 0.9), n('harm', 3, 83, 8, 0.9), n('bell', 3, 95, 6, 0.5), ...chordHit(DMAJ9, 0, 'pad', 12, 0.5)] };
    case 'door':
      return { bpm: 112, notes: [n('bell', 0, 88, 4, 0.8), n('bell', 3, 83, 8, 0.7)] };
    case 'recado':
      // the hook's first two notes, then a Dmaj9 arpeggio up to the top
      return {
        bpm: 118,
        notes: [
          n('mel', 0, 76, 3, 1),
          n('mel', 3, 78, 5, 1),
          n('bell', 6, 81, 2, 0.8),
          n('bell', 7, 85, 2, 0.8),
          n('bell', 8, 88, 8, 0.8),
          ...chordHit(DMAJ9, 0, 'comp', 4, 0.9),
          ...chordHit(DMAJ9, 8, 'comp', 8, 0.8),
          n('bass', 0, 38, 8, 0.9),
        ],
      };
    case 'mission':
      // the whole hook, strummed, with the bass under it: the day's mission is done
      return {
        bpm: 120,
        notes: [
          ...MOTIF.map((m, i) => n(i < 2 ? 'mel' : 'lead', m.at, m.midi, m.dur + 1, 1)),
          ...MOTIF.map((m) => n('harm', m.at, shiftDiatonic(m.midi, -2), m.dur, 0.5)),
          ...chordHit(DMAJ9, 0, 'comp', 8, 0.9),
          ...chordHit(SECTION_A[1]!, 16, 'comp', 8, 0.8),
          ...chordHit(DMAJ9, 28, 'comp', 12, 1),
          ...chordHit(DMAJ9, 28, 'pad', 16, 0.7),
          n('bass', 0, 38, 8),
          n('bass', 16, 35, 8, 0.9),
          n('bass', 28, 38, 12),
          n('bell', 30, 86, 10, 0.8),
          n('bell', 32, 93, 12, 0.7),
          n('surdo', 28, 0, 1, 0.9),
        ],
      };
    case 'caderno':
      // up the D major scale, one bell at a time
      return { bpm: 140, notes: [74, 76, 78, 79, 81, 83, 85, 86].map((m, i) => n('bell', i * 1.5, m + 12 > 96 ? m : m + 12, 5, 0.55 + i * 0.05)).concat(chordHit(DMAJ9, 12, 'pad', 12, 0.5)) };
    case 'win':
      // the hook as a fanfare: brass stabs, a surdo roll and a last tonic hit
      return {
        bpm: 122,
        notes: [
          ...MOTIF.map((m) => n('stab', m.at, m.midi, Math.max(2, m.dur - 1), 1)),
          ...MOTIF.map((m) => n('mel', m.at, m.midi + 12, m.dur, 0.35)),
          ...chordHit(DMAJ9, 28, 'stab', 8, 1),
          ...chordHit(DMAJ9, 28, 'comp', 10, 0.9),
          n('bass', 0, 38, 8),
          n('bass', 16, 40, 8, 0.9),
          n('bass', 28, 38, 10),
          n('surdo', 0, 0, 1, 0.9),
          n('surdo', 8, 0, 1, 0.8),
          n('surdo', 16, 0, 1, 0.9),
          n('surdo', 24, 0, 1, 0.9),
          n('surdo', 28, 0, 1, 1),
          n('pandeiro', 26, 0, 1, 0.8),
          n('pandeiro', 27, 0, 1, 0.8),
          n('pandeiro', 28, 0, 1, 1),
        ],
      };
    case 'lose':
      // "tudo bem": the hook's first four notes, then it settles on D instead of reaching for the E
      return {
        bpm: 84,
        notes: [
          n('lead', 0, 76, 4, 0.9),
          n('lead', 4, 78, 4, 0.9),
          n('lead', 8, 73, 4, 0.8),
          n('lead', 12, 74, 14, 0.9),
          ...chordHit(DMAJ9, 8, 'pad', 20, 0.7),
          n('bass', 0, 38, 14, 0.6),
        ],
      };
  }
}
