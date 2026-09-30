import { describe, expect, it } from 'vitest';
import { STONE, PAVE } from '../../../apps/client/assets-src/custom/calcada.mjs';
import { DERIVE } from '../../../apps/client/assets-src/custom/derive.mjs';
import { luma, hexToRgb } from '../../../apps/client/src/render/pixel/palette.ts';

const mean = (hexes) => hexes.reduce((n, h) => n + luma(...hexToRgb(h)), 0) / hexes.length;

describe('calcada petit-pave contrast (art1: about 40% lower than P1)', () => {
  const p1 = mean(STONE.light) - mean(STONE.dark);
  const now = mean(PAVE.light) - mean(PAVE.dark);
  it('is between 50% and 70% of the old light/dark stone contrast', () => {
    expect(now / p1).toBeGreaterThan(0.5);
    expect(now / p1).toBeLessThan(0.7);
  });
  it('keeps the dark stones darker than the light stones (the wave stays readable)', () => {
    expect(mean(PAVE.light)).toBeGreaterThan(mean(PAVE.dark) + 30);
  });
});

const noCtx = {};
const partsOf = async (fn) => DERIVE[fn](noCtx, {});
const frameSize = (p) => (p.frames ?? [p.img])[0];

describe('authored art1 pieces (no LimeZu source needed)', () => {
  it('orelhao, lixeira, quiosque, placa_rua and the utility wires produce crisp, non-empty sprites', async () => {
    for (const fn of ['orelhao', 'lixeira', 'quiosque']) {
      const [p] = await partsOf(fn);
      const img = frameSize(p);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4) {
        expect(img.data[i] === 0 || img.data[i] === 255).toBe(true); // no half-transparent pixels
        if (img.data[i]) opaque++;
      }
      expect(opaque).toBeGreaterThan(80);
    }
    const wires = await partsOf('fios');
    expect(wires.map((w) => w.key)).toEqual(['props/fios_seg', 'props/fios_4', 'props/fios_6', 'props/fios_8']);
    expect(wires[3].img.w).toBe(8 * 16 + 1);
  });

  it('the parrot perch has 4 idle frames of 16x32 and the dog has idle, walk and sleep in E and W', async () => {
    const [poleiro] = await partsOf('poleiro');
    expect(poleiro.frames).toHaveLength(4);
    expect(poleiro.frames.every((f) => f.w === 16 && f.h === 32)).toBe(true);
    const dog = await partsOf('viraLata');
    const byKey = Object.fromEntries(dog.map((d) => [d.key, d.frames.length]));
    expect(byKey).toEqual({
      'critters/vira_lata_idle_e': 4, 'critters/vira_lata_idle_w': 4,
      'critters/vira_lata_walk_e': 4, 'critters/vira_lata_walk_w': 4,
      'critters/vira_lata_sleep_e': 2, 'critters/vira_lata_sleep_w': 2,
    });
  });

  it('fusca and moto have two wheel frames per facing', async () => {
    for (const fn of ['fusca', 'moto']) {
      const parts = await partsOf(fn);
      expect(parts.map((p) => p.key.slice(-2))).toEqual(['_e', '_w']);
      for (const p of parts) expect(p.frames).toHaveLength(2);
    }
  });
});
