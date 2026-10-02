/**
 * Synthesized sound effects of "Correria no Balcão", in the same Web Audio style as boutSfx.ts / ambience.ts (no samples): a pop for a grab,
 * the sizzle of the chapa, a soft "ready" ding, a burnt buzz, the coffee pour, the service bell, the tip jar clink, the register,
 * paper for the bag, the door chime of a new wave, a low "nope" and a rising combo arpeggio. Pure recipes over an AudioContext.
 */

export type CorreriaSfx = 'grab' | 'sizzle' | 'ready' | 'burnt' | 'pour' | 'ding' | 'clink' | 'cash' | 'paper' | 'chime' | 'nope' | 'combo' | 'tick';

function noise(ctx: AudioContext, white: AudioBuffer, dest: AudioNode, when: number, dur: number, type: BiquadFilterType, f0: number, f1: number, peak: number, q = 0.8, attack = 0.01) {
  const src = ctx.createBufferSource();
  src.buffer = white;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, when);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(when, Math.random() * 0.4);
  src.stop(when + dur + 0.05);
}

function tone(ctx: AudioContext, dest: AudioNode, when: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(dest);
  o.start(when);
  o.stop(when + dur + 0.04);
}

export function playCorreriaSfx(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, kind: CorreriaSfx): void {
  const now = ctx.currentTime;
  switch (kind) {
    case 'grab':
      tone(ctx, dest, now, 520, 760, 0.07, 0.07, 'triangle');
      noise(ctx, white, dest, now, 0.04, 'bandpass', 1800, 1400, 0.05, 1, 0.002);
      break;
    case 'sizzle':
      noise(ctx, white, dest, now, 0.9, 'highpass', 3200, 5200, 0.07, 0.6, 0.08);
      break;
    case 'ready':
      tone(ctx, dest, now, 988, 988, 0.22, 0.06, 'sine');
      tone(ctx, dest, now + 0.09, 1319, 1319, 0.3, 0.05, 'sine');
      break;
    case 'burnt':
      tone(ctx, dest, now, 150, 90, 0.35, 0.09, 'sawtooth');
      noise(ctx, white, dest, now, 0.3, 'lowpass', 900, 400, 0.08, 0.8, 0.02);
      break;
    case 'pour':
      // a short glug of low band-passed noise with a wobbling tone
      noise(ctx, white, dest, now, 0.22, 'bandpass', 520, 780, 0.08, 1.6, 0.03);
      tone(ctx, dest, now, 240, 330, 0.18, 0.025, 'sine');
      break;
    case 'ding':
      // the service bell
      tone(ctx, dest, now, 1568, 1560, 0.9, 0.09, 'sine');
      tone(ctx, dest, now, 2349, 2340, 0.6, 0.04, 'sine');
      tone(ctx, dest, now, 3136, 3120, 0.35, 0.02, 'sine');
      break;
    case 'clink':
      tone(ctx, dest, now, 2600, 2400, 0.12, 0.06, 'triangle');
      tone(ctx, dest, now + 0.06, 3300, 3000, 0.16, 0.05, 'triangle');
      break;
    case 'cash':
      noise(ctx, white, dest, now, 0.07, 'bandpass', 2400, 1800, 0.07, 1.2, 0.002);
      tone(ctx, dest, now + 0.08, 1760, 1760, 0.35, 0.05, 'sine');
      break;
    case 'paper':
      noise(ctx, white, dest, now, 0.16, 'bandpass', 3000, 5000, 0.06, 0.7, 0.02);
      break;
    case 'chime':
      for (const [dt, f] of [[0, 784], [0.14, 988], [0.28, 1175]] as const) tone(ctx, dest, now + dt, f, f, 0.5, 0.05, 'sine');
      break;
    case 'nope':
      tone(ctx, dest, now, 190, 120, 0.22, 0.09, 'triangle');
      break;
    case 'combo':
      for (const [dt, f] of [[0, 659], [0.07, 784], [0.14, 988], [0.21, 1319]] as const) tone(ctx, dest, now + dt, f, f, 0.18, 0.05, 'triangle');
      break;
    case 'tick':
      tone(ctx, dest, now, 880, 700, 0.05, 0.03, 'triangle');
      break;
  }
}
