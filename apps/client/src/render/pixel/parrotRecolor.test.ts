import { describe, expect, it } from 'vitest';
import { parrotColorById } from '@tudobem/shared';
import { recolorParrotPixels } from './parrotRecolor';

function px(hex: number, a = 255): Uint8ClampedArray {
  return new Uint8ClampedArray([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, a]);
}

function hexOf(data: Uint8ClampedArray): number {
  return ((data[0]! << 16) | (data[1]! << 8) | data[2]!) >>> 0;
}

describe('parrot body recolor', () => {
  it('leaves the green bird and the outline, beak and transparent pixels alone', () => {
    const body = px(0x5dbb54);
    const outline = px(0x3a3a50);
    const beak = px(0xf2a02b);
    const clear = px(0x5dbb54, 0);
    recolorParrotPixels(body, 0xffffff);
    recolorParrotPixels(outline, parrotColorById('azul')!.tint);
    recolorParrotPixels(beak, parrotColorById('azul')!.tint);
    recolorParrotPixels(clear, parrotColorById('azul')!.tint);
    expect(hexOf(body)).toBe(0x5dbb54);
    expect(hexOf(outline)).toBe(0x3a3a50);
    expect(hexOf(beak)).toBe(0xf2a02b);
    expect(clear[3]).toBe(0);
    expect(hexOf(clear)).toBe(0x5dbb54);
  });

  it('turns the green body into the bought colour', () => {
    for (const id of ['azul', 'amarelo', 'vermelho', 'laranja'] as const) {
      const tint = parrotColorById(id)!.tint;
      const body = px(0x5dbb54);
      recolorParrotPixels(body, tint);
      const got = hexOf(body);
      expect(got, id).not.toBe(0x5dbb54);
      const tr = (tint >> 16) & 255;
      const tg = (tint >> 8) & 255;
      const tb = tint & 255;
      const dominant = tr >= tg && tr >= tb ? 0 : tg >= tb ? 1 : 2;
      const channels = [body[0]!, body[1]!, body[2]!];
      expect(channels.indexOf(Math.max(...channels)), id).toBe(dominant);
    }
  });
});
