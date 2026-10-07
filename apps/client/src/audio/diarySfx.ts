/**
 * Synthesized sounds of the camera, the diary and the cartela, in the same Web Audio style as correriaSfx.ts (no samples):
 * the shutter (a mechanical clack and the blade swish), the film advance (a short ratchet), a rubber stamp, and a page turn.
 */
import { noise, tone } from './correriaSfx';

export type DiarySfx = 'shutter' | 'empty' | 'wind' | 'stamp' | 'page';
export const DIARY_SFX = ['shutter', 'empty', 'wind', 'stamp', 'page'] as const;

export function playDiarySfx(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, kind: DiarySfx): void {
  const now = ctx.currentTime;
  switch (kind) {
    case 'shutter':
      // blade open, mirror slap, blade close
      noise(ctx, white, dest, now, 0.035, 'bandpass', 4200, 3000, 0.12, 2.2, 0.002);
      tone(ctx, dest, now + 0.004, 1800, 900, 0.03, 0.05, 'square');
      noise(ctx, white, dest, now + 0.06, 0.05, 'bandpass', 2600, 1800, 0.1, 1.8, 0.002);
      tone(ctx, dest, now + 0.062, 240, 120, 0.06, 0.06, 'triangle');
      break;
    case 'empty':
      // dry hollow click with nothing behind it: no blade swish, no mirror slap
      tone(ctx, dest, now, 520, 300, 0.025, 0.05, 'square');
      noise(ctx, white, dest, now, 0.02, 'bandpass', 1500, 1200, 0.08, 2.5, 0.001);
      tone(ctx, dest, now + 0.09, 360, 220, 0.03, 0.04, 'square');
      break;
    case 'wind':
      for (let i = 0; i < 5; i++) noise(ctx, white, dest, now + 0.12 + i * 0.045, 0.02, 'bandpass', 3400, 3000, 0.05, 3, 0.002);
      break;
    case 'stamp':
      tone(ctx, dest, now, 180, 70, 0.14, 0.14, 'sine');
      noise(ctx, white, dest, now, 0.08, 'lowpass', 1400, 500, 0.12, 0.7, 0.003);
      break;
    case 'page':
      noise(ctx, white, dest, now, 0.22, 'bandpass', 2200, 5200, 0.05, 0.6, 0.04);
      break;
  }
}
