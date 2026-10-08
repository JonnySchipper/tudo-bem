import { describe, expect, it, afterEach } from 'vitest';
import { buildGrid, key } from './rooms.js';
import { ROOM_IDS, ROOMS } from './rooms.js';
import { bundledObjects } from './roomLayoutFiles.js';
import { installRoomProps, propPalette, revertRoomProps, serializeLayout, shiftProp, validateRoomLayout } from './layout.js';

afterEach(() => {
  for (const id of ROOM_IDS) revertRoomProps(id);
});

describe('room layouts', () => {
  it('loads every room from the bundled JSON with the same props the walk grid uses', () => {
    for (const id of ROOM_IDS) {
      const bundled = bundledObjects(id);
      expect(ROOMS[id].props.length, id).toBe(bundled.length);
      expect(ROOMS[id].props.map((p) => p.id).sort()).toEqual(bundled.map((p) => p.id).sort());
    }
  });

  it('rejects an unknown type, a duplicate id, and a coordinate outside the room', () => {
    const base = bundledObjects('praca');
    expect(validateRoomLayout('nope', base).ok).toBe(false);
    expect(validateRoomLayout('praca', [{ ...base[0], kind: 'dragao' }]).ok).toBe(false);
    const dup = validateRoomLayout('praca', [base[0], { ...base[0] }]);
    expect(dup.ok).toBe(false);
    const far = validateRoomLayout('praca', [{ ...base[0], x: 500, y: 1 }]);
    expect(far.ok).toBe(false);
    if (!far.ok) expect(far.en).toMatch(/bounds/i);
  });

  it('accepts a known prop moved inside the map and rebuilds the walk grid', () => {
    const bench = ROOMS.praca.props.find((p) => p.id === 'banco_4')!;
    const before = buildGrid(ROOMS.praca).blocked.has(key(14, 10));
    const moved = ROOMS.praca.props.map((p) => (p.id === 'banco_4' ? { ...p, x: bench.x + 1 } : p));
    const v = validateRoomLayout('praca', moved);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    installRoomProps('praca', v.objects);
    expect(ROOMS.praca.props.find((p) => p.id === 'banco_4')!.x).toBe(bench.x + 1);
    expect(buildGrid(ROOMS.praca).blocked.has(key(14, 10))).toBe(before);
    const blocking = ROOMS.praca.props.find((p) => p.blocks && p.kind === 'fonte')!;
    const was = buildGrid(ROOMS.praca).blocked.has(key(blocking.x, blocking.y));
    expect(was).toBe(true);
    shiftProp(blocking, 2, 0);
    installRoomProps('praca', ROOMS.praca.props);
    expect(buildGrid(ROOMS.praca).blocked.has(key(blocking.x - 2, blocking.y))).toBe(false);
    expect(buildGrid(ROOMS.praca).blocked.has(key(blocking.x, blocking.y))).toBe(true);
  });

  it('lists existing prop types and serializes a stable file', () => {
    const palette = propPalette();
    expect(palette.length).toBeGreaterThan(10);
    expect(palette.some((p) => p.kind === 'banco')).toBe(true);
    const text = serializeLayout('andar', bundledObjects('andar'));
    expect(text.startsWith('{\n  "room": "andar"')).toBe(true);
    expect(JSON.parse(text).objects[0].id).toBe('andar_tatame');
  });
});
