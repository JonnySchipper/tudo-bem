import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOY_FX, toyOverlay } from './petToys';
import { PET_ITEMS } from '@tudobem/shared';

describe('the toy next to a pet', () => {
  it('has a baked sprite for every toy of the lojinha', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../public/pixel/manifest.json', import.meta.url), 'utf8')) as { sprites: Record<string, unknown> };
    for (const it of PET_ITEMS.filter((i) => i.kind === 'brinquedo')) {
      expect(TOY_FX[it.id], it.id).toBeDefined();
      expect(manifest.sprites[TOY_FX[it.id]!], it.id).toBeDefined();
    }
  });

  it('shows nothing without a toy, and nothing on a standing or sitting pet at rest', () => {
    expect(toyOverlay(null, 'lieS', false, 10, 10)).toBeNull();
    expect(toyOverlay('coleira_azul', 'lieS', false, 10, 10)).toBeNull();
    expect(toyOverlay('ossinho', 'idleS', false, 10, 10)).toBeNull();
    expect(toyOverlay('ossinho', 'sitE', false, 10, 10)).toBeNull();
  });

  it('keeps the toy between the paws of a lying pet, on the side it faces', () => {
    expect(toyOverlay('pelucia', 'lieE', false, 100, 50)).toEqual({ key: 'fx/pelucia', x: 110, y: 50, behind: false });
    expect(toyOverlay('pelucia', 'lieE', true, 100, 50)).toEqual({ key: 'fx/pelucia', x: 90, y: 50, behind: false });
    expect(toyOverlay('ossinho', 'lieS', false, 100, 50)?.key).toBe('fx/ossinho');
  });

  it('a fetch: the ball waits where it landed, then rides back in the mouth', () => {
    expect(toyOverlay('bolinha', 'walkE', false, 100, 50, { fetch: { x: 148.4, y: 50, back: false } })).toEqual({ key: 'fx/bolinha', x: 148, y: 50, behind: false });
    expect(toyOverlay('bolinha', 'walkE', true, 100, 50, { fetch: { x: 148, y: 50, back: true } })).toMatchObject({ x: 91, y: 44 });
    expect(toyOverlay('bolinha', 'walkN', false, 100, 50, { fetch: { x: 100, y: 0, back: true } })?.behind).toBe(true);
  });

  it('a cat at play bats its mouse in front of it', () => {
    expect(toyOverlay('ratinho', 'sitS', false, 100, 50, { play: 2 })).toEqual({ key: 'fx/ratinho', x: 107, y: 51, behind: false });
  });
});
