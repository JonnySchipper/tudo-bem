import { describe, expect, it } from 'vitest';
import type { Hit } from '../view';
import { pickHit, type ScreenBox } from './hitbox';

const tile = { x: 1, y: 1 };
const box = (hit: Hit, depth: number): ScreenBox => ({ x0: 0, y0: 0, x1: 10, y1: 10, hit, depth });

const npc = { kind: 'npc', npc: { id: 'carlos' } } as Hit;
const propOf = (id: string): Hit => ({ kind: 'prop', prop: { id } }) as Hit;
const portal = { kind: 'portal', portal: { id: 'praca_padaria' } } as Hit;
const seat: Hit = { kind: 'seat', tile };
const furniture: Hit = { kind: 'furniture', f: { uid: 'c1', itemId: 'cadeira_madeira', x: 1, y: 1, rot: 0 } };
const player: Hit = { kind: 'avatar', id: 'p1' };
const self: Hit = { kind: 'avatar', id: 'me' };
const cpu: Hit = { kind: 'avatar', id: 'cpu:ana' };

const opts = {
  editMode: false,
  placing: false,
  selfId: 'me',
  isCpu: (id: string) => id.startsWith('cpu:'),
};

describe('pickHit', () => {
  it('prefers an npc or player over a prop or portal, and those over a seat', () => {
    expect(pickHit([box(seat, 5), box(propOf('quiosque'), 1), box(npc, 0)], 5, 5, opts)?.kind).toBe('npc');
    expect(pickHit([box(seat, 9), box(portal, 1), box(player, 0)], 5, 5, opts)?.kind).toBe('avatar');
    expect(pickHit([box(seat, 9), box(propOf('quiosque'), 1)], 5, 5, opts)?.kind).toBe('prop');
    expect(pickHit([box(seat, 9), box(portal, 1)], 5, 5, opts)?.kind).toBe('portal');
  });

  it('uses depth as a tiebreak within a rank', () => {
    const hit = pickHit([box(propOf('back'), 1), box(propOf('front'), 4)], 5, 5, opts);
    expect(hit?.kind === 'prop' && hit.prop.id).toBe('front');
  });

  it('skips the local avatar and returns the next hit', () => {
    const hit = pickHit([box(self, 10), box(seat, 1)], 5, 5, opts);
    expect(hit?.kind).toBe('seat');
    expect(pickHit([box(self, 10)], 5, 5, opts)).toBeNull();
  });

  it('ranks a CPU avatar under a seat', () => {
    expect(pickHit([box(cpu, 8), box(seat, 1)], 5, 5, opts)?.kind).toBe('seat');
  });

  it('prefers furniture while editing, and falls through while placing', () => {
    const editing = pickHit([box(npc, 5), box(furniture, 1)], 5, 5, { ...opts, editMode: true });
    expect(editing?.kind).toBe('furniture');
    expect(pickHit([box(furniture, 1), box(npc, 5)], 5, 5, { ...opts, placing: true })).toBeNull();
    expect(pickHit([box(npc, 5)], 5, 5, { ...opts, editMode: true })).toBeNull();
  });

  it('ignores boxes that miss the pointer', () => {
    expect(pickHit([box(npc, 1)], 20, 20, opts)).toBeNull();
  });
});
