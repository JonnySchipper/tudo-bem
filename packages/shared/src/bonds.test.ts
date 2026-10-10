import { describe, expect, it } from 'vitest';
import { addBond, BOND_GAIN, BOND_MAX, BOND_MILESTONES, clampBond, hearts, isNpcId, milestonesCrossed, normalizeBond, NPC_IDS } from './bonds.js';
import { hotspotDistance, tileDistance } from './hotspots.js';

describe('hearts', () => {
  it('10 points = 1 heart, capped at 10 hearts', () => {
    expect(hearts(0)).toBe(0);
    expect(hearts(9)).toBe(0);
    expect(hearts(10)).toBe(1);
    expect(hearts(19)).toBe(1);
    expect(hearts(60)).toBe(6);
    expect(hearts(100)).toBe(10);
    expect(hearts(250)).toBe(10);
    expect(hearts(-5)).toBe(0);
    expect(hearts(Number.NaN)).toBe(0);
  });
});

describe('bond gains', () => {
  it('uses the Phase 8 numbers', () => {
    expect(BOND_GAIN.talk).toBe(2);
    expect(BOND_GAIN.papo).toBe(3);
  });

  it('adds per NPC without touching the others or the input, and clamps to 0-100', () => {
    const start = { carlos: 8 };
    const r = addBond(start, 'nanda', 4);
    expect(r.bond).toEqual({ carlos: 8, nanda: 4 });
    expect(start).toEqual({ carlos: 8 });
    expect(addBond({ carlos: 99 }, 'carlos', 5).bond.carlos).toBe(BOND_MAX);
    expect(addBond({ carlos: 3 }, 'carlos', -50).bond.carlos).toBe(0);
    expect(clampBond(12.9)).toBe(12);
  });

  it('reports the milestones a gain crosses, once each', () => {
    expect(BOND_MILESTONES.map((m) => [m.hearts, m.kind])).toEqual([
      [2, 'uses_name'],
      [4, 'story'],
      [6, 'furniture_gift'],
    ]);
    expect(addBond({ carlos: 18 }, 'carlos', 2).milestones.map((m) => m.hearts)).toEqual([2]);
    expect(addBond({ carlos: 19 }, 'carlos', 1).milestones.map((m) => m.hearts)).toEqual([2]);
    expect(addBond({ carlos: 20 }, 'carlos', 5).milestones).toEqual([]);
    expect(milestonesCrossed(0, 100).map((m) => m.hearts)).toEqual([2, 4, 6]);
    expect(milestonesCrossed(30, 70).map((m) => m.hearts)).toEqual([4, 6]);
    expect(milestonesCrossed(60, 60)).toEqual([]);
    expect(milestonesCrossed(70, 10)).toEqual([]);
    for (const m of BOND_MILESTONES) expect(m.label.pt && m.label.en).toBeTruthy();
  });
});

describe('normalizeBond', () => {
  it('keeps known NPCs with finite numbers only', () => {
    expect(NPC_IDS).toEqual(expect.arrayContaining(['carlos', 'nanda', 'julia', 'graca', 'tia_lu']));
    expect(isNpcId('graca') && isNpcId('tia_lu')).toBe(true); // givers with no room yet still keep friendships
    expect(normalizeBond({ graca: 12.5, tia_lu: 7 })).toEqual({ graca: 12, tia_lu: 7 });
    expect(isNpcId('carlos')).toBe(true);
    expect(isNpcId('toString')).toBe(false);
    expect(normalizeBond(undefined)).toEqual({});
    expect(normalizeBond([1])).toEqual({});
    expect(normalizeBond({ carlos: 45.7, nanda: 'x', julia: 500, ghost: 3 })).toEqual({ carlos: 45, julia: 100 });
  });
});

describe('hotspot distance', () => {
  it('measures to the nearest tile of the footprint', () => {
    expect(tileDistance({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
    expect(hotspotDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    expect(hotspotDistance({ x: 5, y: 5 }, { x: 8, y: 5 })).toBe(3);
    expect(hotspotDistance({ x: 5, y: 5, w: 3, h: 2 }, { x: 7, y: 6 })).toBe(0);
    expect(hotspotDistance({ x: 5, y: 5, w: 3, h: 2 }, { x: 10, y: 6 })).toBe(3);
    expect(hotspotDistance({ x: 5, y: 5, w: 3, h: 2 }, { x: 4, y: 9 })).toBe(3);
  });
});
