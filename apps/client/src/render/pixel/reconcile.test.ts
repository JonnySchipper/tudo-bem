import { describe, expect, it } from 'vitest';
import { diffIds, roomKey, syncViews } from './reconcile';

describe('diffIds', () => {
  it('splits ids into add / keep / remove', () => {
    const d = diffIds(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(d.add).toEqual(['d']);
    expect(d.keep).toEqual(['b', 'c']);
    expect(d.remove).toEqual(['a']);
  });
  it('handles empty sides', () => {
    expect(diffIds([], ['x'])).toEqual({ add: ['x'], keep: [], remove: [] });
    expect(diffIds(['x'], [])).toEqual({ add: [], keep: [], remove: ['x'] });
  });
});

describe('syncViews (avatars -> sprites)', () => {
  interface V {
    id: string;
    x: number;
    alive: boolean;
  }
  const make = () => {
    const views = new Map<string, V>();
    const log: string[] = [];
    const fns = {
      create: (id: string, item: { x: number }): V => (log.push(`create ${id}`), { id, x: item.x, alive: true }),
      update: (v: V, item: { x: number }) => {
        v.x = item.x;
      },
      destroy: (v: V, id: string) => {
        log.push(`destroy ${id}`);
        v.alive = false;
      },
    };
    return { views, log, fns };
  };

  it('creates a sprite for a new avatar and updates it in the same pass', () => {
    const { views, log, fns } = make();
    syncViews(views, new Map([['bia', { x: 3 }]]), fns);
    expect(log).toEqual(['create bia']);
    expect(views.get('bia')?.x).toBe(3);
  });

  it('updates existing sprites without recreating them', () => {
    const { views, log, fns } = make();
    syncViews(views, new Map([['bia', { x: 3 }]]), fns);
    const first = views.get('bia');
    syncViews(views, new Map([['bia', { x: 7 }]]), fns);
    expect(views.get('bia')).toBe(first);
    expect(first?.x).toBe(7);
    expect(log).toEqual(['create bia']);
  });

  it('destroys sprites whose avatar is gone', () => {
    const { views, log, fns } = make();
    syncViews(views, new Map([['bia', { x: 1 }], ['cai', { x: 2 }]]), fns);
    const bia = views.get('bia');
    syncViews(views, new Map([['cai', { x: 2 }]]), fns);
    expect([...views.keys()]).toEqual(['cai']);
    expect(bia?.alive).toBe(false);
    expect(log).toContain('destroy bia');
  });

  it('a whole room swap removes everyone and adds the new crowd', () => {
    const { views, fns } = make();
    syncViews(views, new Map([['a', { x: 0 }], ['b', { x: 0 }]]), fns);
    const d = syncViews(views, new Map([['c', { x: 0 }]]), fns);
    expect(d.remove.sort()).toEqual(['a', 'b']);
    expect(d.add).toEqual(['c']);
    expect([...views.keys()]).toEqual(['c']);
  });
});

describe('roomKey', () => {
  it('changes with room, instance and owner (HOWTO: room + instanceId + ownerId)', () => {
    const a = roomKey({ room: 'kitnet', instanceId: 'i1', ownerId: 'u1' });
    expect(roomKey({ room: 'kitnet', instanceId: 'i1', ownerId: 'u2' })).not.toBe(a);
    expect(roomKey({ room: 'kitnet', instanceId: 'i2', ownerId: 'u1' })).not.toBe(a);
    expect(roomKey({ room: 'praca', instanceId: 'i1', ownerId: 'u1' })).not.toBe(a);
    expect(roomKey({ room: 'praca', instanceId: 'i1', ownerId: null })).toBe('praca|i1|');
    expect(roomKey(null)).toBe('');
  });
});
