import { describe, expect, it } from 'vitest';
import type { NpcDef, PortalDef, PropDef } from '@tudobem/shared';
import type { Hit } from '../view';
import { hitRank, pickHit, type HitBox, type HitOptions } from './hit';

const box = (hit: Hit, x0: number, y0: number, x1: number, y1: number, depth = y1): HitBox => ({ hit, x0, y0, x1, y1, depth });
const opts: HitOptions = { selfId: 'me', isCpu: (id) => id.startsWith('cpu') };

const npc = { id: 'carlos' } as NpcDef;
const prop = { id: 'quiosque', kind: 'quiosque' } as PropDef;
const portal = { id: 'door' } as PortalDef;

describe('pickHit ordering', () => {
  it('returns null when nothing is under the point', () => {
    expect(pickHit([box({ kind: 'seat', tile: { x: 1, y: 1 } }, 0, 0, 10, 10)], 50, 50, opts)).toBeNull();
    expect(pickHit([], 0, 0, opts)).toBeNull();
  });

  it('follows the HOWTO order: avatar > npc > prop > portal > seat > furniture', () => {
    const list: Hit[] = [
      { kind: 'furniture', f: { uid: 'f', itemId: 'mesinha', x: 0, y: 0, rot: 0 } },
      { kind: 'seat', tile: { x: 0, y: 0 } },
      { kind: 'portal', portal },
      { kind: 'prop', prop },
      { kind: 'npc', npc },
      { kind: 'avatar', id: 'bia' },
    ];
    // every box covers the point; remove the top one each time and the next in line wins
    const order = ['avatar', 'npc', 'prop', 'portal', 'seat', 'furniture'];
    let boxes = list.map((h) => box(h, 0, 0, 10, 10));
    for (const kind of order) {
      expect(pickHit(boxes, 5, 5, opts)?.kind).toBe(kind);
      boxes = boxes.filter((b) => b.hit.kind !== kind);
    }
  });

  it('breaks ties by depth: the box drawn in front wins', () => {
    const a: Hit = { kind: 'avatar', id: 'bia' };
    const b: Hit = { kind: 'avatar', id: 'cai' };
    expect(pickHit([box(a, 0, 0, 10, 10, 50), box(b, 0, 0, 10, 10, 90)], 5, 5, opts)).toBe(b);
    expect(pickHit([box(a, 0, 0, 10, 10, 90), box(b, 0, 0, 10, 10, 50)], 5, 5, opts)).toBe(a);
  });

  it('a scripted CPU ranks below a seat', () => {
    const cpu: Hit = { kind: 'avatar', id: 'cpu_1' };
    const seat: Hit = { kind: 'seat', tile: { x: 2, y: 2 } };
    expect(hitRank(cpu, opts.isCpu)).toBeLessThan(hitRank(seat, opts.isCpu));
    expect(pickHit([box(cpu, 0, 0, 10, 10, 99), box(seat, 0, 0, 10, 10, 10)], 5, 5, opts)).toBe(seat);
    expect(pickHit([box(cpu, 0, 0, 10, 10)], 5, 5, opts)).toBe(cpu);
  });

  it('clicking yourself passes through to what is behind you', () => {
    const me: Hit = { kind: 'avatar', id: 'me' };
    const seat: Hit = { kind: 'seat', tile: { x: 2, y: 2 } };
    expect(pickHit([box(me, 0, 0, 10, 10), box(seat, 0, 0, 10, 10)], 5, 5, opts)).toBe(seat);
    expect(pickHit([box(me, 0, 0, 10, 10)], 5, 5, opts)).toBeNull();
  });

  it('only counts boxes that contain the point (edges included)', () => {
    const p: Hit = { kind: 'prop', prop };
    expect(pickHit([box(p, 0, 0, 10, 10)], 10, 10, opts)).toBe(p);
    expect(pickHit([box(p, 0, 0, 10, 10)], 10.01, 5, opts)).toBeNull();
  });

  it('decorate mode picks furniture only; placing picks nothing', () => {
    const f: Hit = { kind: 'furniture', f: { uid: 'f', itemId: 'mesinha', x: 0, y: 0, rot: 0 } };
    const n: Hit = { kind: 'npc', npc };
    expect(pickHit([box(n, 0, 0, 10, 10), box(f, 0, 0, 10, 10)], 5, 5, { ...opts, editMode: true })).toBe(f);
    expect(pickHit([box(n, 0, 0, 10, 10)], 5, 5, { ...opts, editMode: true })).toBeNull();
    expect(pickHit([box(f, 0, 0, 10, 10)], 5, 5, { ...opts, placing: true })).toBeNull();
  });
});
