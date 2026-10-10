/**
 * Synthesized sounds of the flight in (the new-account cutscene, ui/flightIntro.ts), in the same Web Audio style as correriaSfx.ts
 * (no samples): the typewriter blip of an unvoiced line, the cabin's two-tone seatbelt chime, the PA's click, the buckle, the landing
 * gear coming down, the tyres touching the runway, and the engines' roar as the plane brakes. The seatbelt close-up adds the straps'
 * swish as they swing in and a glittering run of bells when the latch clicks.
 */
import { noise, tone } from './correriaSfx';

export type FlightSfx = 'blip' | 'seatbelt' | 'pa' | 'buckle' | 'gear' | 'touchdown' | 'roar' | 'cloud' | 'pick' | 'swish' | 'sparkle';
export const FLIGHT_SFX = ['blip', 'seatbelt', 'pa', 'buckle', 'gear', 'touchdown', 'roar', 'cloud', 'pick', 'swish', 'sparkle'] as const;

export function playFlightSfx(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, kind: FlightSfx): void {
  const now = ctx.currentTime;
  switch (kind) {
    case 'blip': {
      // a soft rounded "pip", a little different every time, like a voice under the letters
      const f = 520 + Math.random() * 180;
      tone(ctx, dest, now, f, f * 0.92, 0.045, 0.035, 'triangle');
      break;
    }
    case 'pick':
      // a reply chosen: two quick notes up
      tone(ctx, dest, now, 660, 660, 0.06, 0.06, 'triangle');
      tone(ctx, dest, now + 0.06, 990, 990, 0.09, 0.06, 'triangle');
      break;
    case 'seatbelt':
      // the seatbelt sign: high, then a fourth lower, both left to ring
      tone(ctx, dest, now, 1318.5, 1318.5, 1.4, 0.07, 'sine');
      tone(ctx, dest, now, 2637, 2637, 0.6, 0.012, 'sine');
      tone(ctx, dest, now + 0.42, 987.8, 987.8, 1.8, 0.07, 'sine');
      tone(ctx, dest, now + 0.42, 1975.5, 1975.5, 0.8, 0.012, 'sine');
      break;
    case 'pa':
      // the microphone keyed on: a click and a breath of hiss
      tone(ctx, dest, now, 1400, 600, 0.02, 0.05, 'square');
      noise(ctx, white, dest, now + 0.01, 0.35, 'bandpass', 2400, 2000, 0.02, 1.2, 0.02);
      break;
    case 'buckle':
      // the latch going in: two metal clicks
      tone(ctx, dest, now, 3200, 2400, 0.03, 0.08, 'square');
      noise(ctx, white, dest, now, 0.03, 'highpass', 5000, 5000, 0.08, 1, 0.001);
      tone(ctx, dest, now + 0.07, 2600, 1800, 0.04, 0.1, 'square');
      noise(ctx, white, dest, now + 0.07, 0.04, 'highpass', 4200, 4200, 0.1, 1, 0.001);
      break;
    case 'swish':
      // the two straps swinging in toward the latch: a quick rising breath of air
      noise(ctx, white, dest, now, 0.32, 'bandpass', 700, 3200, 0.06, 1.4, 0.12);
      break;
    case 'sparkle':
      // the latch shut: a bright little run up a major chord, each bell left to ring and shimmer
      [1568, 1976, 2349, 3136, 3951].forEach((f, i) => {
        tone(ctx, dest, now + i * 0.055, f, f, 0.5 - i * 0.05, 0.035, 'sine');
        tone(ctx, dest, now + i * 0.055, f * 2.01, f * 2.01, 0.2, 0.008, 'sine');
      });
      break;
    case 'gear':
      // the wheels coming down under the floor: a hydraulic whine and a heavy clunk
      tone(ctx, dest, now, 140, 260, 0.9, 0.03, 'sawtooth');
      noise(ctx, white, dest, now, 0.9, 'lowpass', 400, 900, 0.05, 0.7, 0.2);
      tone(ctx, dest, now + 0.95, 90, 40, 0.25, 0.22, 'sine');
      noise(ctx, white, dest, now + 0.95, 0.12, 'lowpass', 900, 300, 0.15, 0.8, 0.002);
      break;
    case 'touchdown':
      // rubber on the runway: a chirp, a thump, then the rumble of the wheels
      noise(ctx, white, dest, now, 0.18, 'bandpass', 2600, 1600, 0.09, 3, 0.004);
      tone(ctx, dest, now, 70, 38, 0.35, 0.35, 'sine');
      noise(ctx, white, dest, now + 0.02, 1.8, 'lowpass', 260, 140, 0.12, 0.7, 0.05);
      noise(ctx, white, dest, now + 0.35, 0.14, 'bandpass', 2200, 1500, 0.05, 3, 0.004);
      tone(ctx, dest, now + 0.35, 60, 36, 0.25, 0.18, 'sine');
      break;
    case 'roar':
      // the engines on reverse thrust: a long swell of wind that dies away
      noise(ctx, white, dest, now, 3.2, 'bandpass', 500, 220, 0.16, 0.6, 0.6);
      noise(ctx, white, dest, now + 0.1, 3, 'lowpass', 900, 200, 0.08, 0.5, 0.5);
      break;
    case 'cloud':
      // through a cloud
      noise(ctx, white, dest, now, 1.4, 'bandpass', 400, 1800, 0.07, 0.8, 0.5);
      break;
  }
}
