import { describe, expect, it } from 'vitest';
import { cpuArchetype, cpuLook, cpuTarget, key, openMatTiles, ROOMS, type ServerMsg, type Tile } from '@tudobem/shared';
import { CpuCrowd, CPU_TICK_MS, type HumanSpot } from './ambiance.js';

function harness(humans: HumanSpot[], rng = () => 0, room: keyof typeof ROOMS = 'praca') {
  let clock = 0;
  let queue: { fn: () => void; at: number }[] = [];
  const sent: ServerMsg[] = [];
  const crowd = new CpuCrowd(ROOMS[room], {
    now: () => clock,
    schedule: (fn, ms) => queue.push({ fn, at: clock + ms }),
    rng,
    send: (m) => sent.push(m),
    humans: () => humans,
  });
  const advance = (ms: number) => {
    const end = clock + ms;
    while (true) {
      const next = queue.filter((q) => q.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      queue = queue.filter((q) => q !== next);
      clock = next.at;
      next.fn();
    }
    clock = end;
  };
  return { crowd, sent, advance, waves: () => sent.filter((m) => m.t === 'emote') };
}

const at = (x: number, y: number): HumanSpot => ({ tile: { x, y }, target: { x, y } });

describe('CpuCrowd (Praça ambiance)', () => {
  it('spawns the Live Ops target instantly for the first player, mostly seated', () => {
    const { crowd } = harness([at(25, 27)]);
    crowd.sync();
    const cpus = crowd.avatars();
    expect(cpus).toHaveLength(cpuTarget(1, 'praca'));
    expect(cpus.length).toBe(8);
    const seated = cpus.filter((c) => c.sitting).length;
    expect(seated).toBeGreaterThanOrEqual(4);
    expect(seated).toBeLessThanOrEqual(6);
    expect(cpus.every((c) => c.cpu && c.nameplate === 'verde' && c.pronoun === 'nome' && !c.parrot)).toBe(true);
  });

  it('dresses each CPU in its authored look, never two of the same look at once', () => {
    let seed = 3;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let run = 0; run < 20; run++) {
      const { crowd } = harness([at(25, 27)], rng);
      crowd.sync();
      const cpus = crowd.avatars();
      expect(cpus.every((c) => JSON.stringify(c.appearance) === JSON.stringify(cpuLook(c.name).appearance) && c.hat === cpuLook(c.name).hat)).toBe(true);
      expect(new Set(cpus.map((c) => cpuArchetype(c.name))).size).toBe(cpus.length);
    }
  });

  it('presence targets follow the Live Ops table (Vila Ipê: up to 8, thinning as humans arrive)', () => {
    expect([0, 1].map((n) => cpuTarget(n, 'praca')).every((n) => n >= 4 && n <= 8)).toBe(true);
    expect(cpuTarget(1, 'praca')).toBe(8);
    const seq = [1, 2, 3, 5, 7, 9, 13].map((n) => cpuTarget(n, 'praca'));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeLessThanOrEqual(seq[i - 1]);
    expect([9, 12].every((n) => cpuTarget(n, 'praca') <= 1)).toBe(true);
    expect(cpuTarget(16, 'praca')).toBe(0);
    // the smaller rooms keep the original table
    expect([0, 1].map((n) => cpuTarget(n)).every((n) => n >= 4 && n <= 6)).toBe(true);
    expect([2, 3, 4].map((n) => cpuTarget(n)).every((n) => n >= 3 && n <= 4)).toBe(true);
    expect([5, 6, 7, 8].map((n) => cpuTarget(n)).every((n) => n >= 1 && n <= 2)).toBe(true);
    expect([9, 12, 16].map((n) => cpuTarget(n)).every((n) => n <= 1)).toBe(true);
  });

  it('the nearest CPU within 3 tiles waves back once; farther CPUs and cooldowns stay quiet', () => {
    const { crowd, advance, waves } = harness([at(25, 27)]);
    crowd.sync();
    const sitter = crowd.avatars().find((c) => c.sitting)!;
    const near: Tile = { x: sitter.x, y: sitter.y + 2 };
    const dist = (c: Tile) => Math.max(Math.abs(c.x - near.x), Math.abs(c.y - near.y));
    const nearest = [...crowd.avatars()].sort((a, b) => dist(a) - dist(b))[0];
    crowd.onWave(near);
    advance(800);
    expect(waves()).toEqual([{ t: 'emote', id: nearest.id, kind: 'oi' }]);
    crowd.onWave(near);
    advance(800);
    expect(waves().filter((w) => 'id' in w && w.id === nearest.id)).toHaveLength(1);
    const count = waves().length;
    crowd.onWave({ x: -20, y: -20 });
    advance(800);
    expect(waves()).toHaveLength(count);
  });

  it('waves when a player walks up to it, and yields its bench to a player', () => {
    const humans = [at(25, 27)];
    const { crowd, advance, waves, sent } = harness(humans);
    crowd.sync();
    const sitter = crowd.avatars().find((c) => c.sitting)!;
    humans[0] = at(sitter.x + 1, sitter.y);
    advance(CPU_TICK_MS);
    expect(waves().map((w) => 'id' in w && w.id)).toContain(sitter.id);

    humans[0] = { tile: { x: sitter.x + 1, y: sitter.y }, target: { x: sitter.x, y: sitter.y } };
    crowd.yieldSeat({ x: sitter.x, y: sitter.y });
    const moved = sent.filter((m) => m.t === 'avatarMoved' && m.id === sitter.id).at(-1);
    expect(moved && moved.t === 'avatarMoved' && moved.path.at(-1)).not.toEqual({ x: sitter.x, y: sitter.y });
    advance(20_000);
    expect(crowd.avatars().some((c) => c.x === sitter.x && c.y === sitter.y)).toBe(false);
  });

  it('walks out (not pops out) when the room fills up, and freezes with nobody watching', () => {
    const humans = [at(25, 27)];
    const { crowd, advance, sent } = harness(humans);
    crowd.sync();
    for (let i = 0; i < 8; i++) humans.push(at(26, 27));
    crowd.sync();
    const leavers = sent.filter((m) => m.t === 'avatarMoved').length;
    expect(leavers).toBeGreaterThan(0);
    expect(sent.some((m) => m.t === 'avatarLeft')).toBe(false);
    advance(30_000);
    expect(crowd.avatars()).toHaveLength(cpuTarget(9, 'praca'));
    humans.length = 0;
    const count = sent.length;
    advance(60_000);
    expect(sent.length).toBe(count);
  });
});

describe('CpuCrowd (Academia ambiance)', () => {
  it('idles and wanders off the tatame while still filling the room', () => {
    const mat = new Set(openMatTiles(ROOMS.academia).map((t) => key(t.x, t.y)));
    expect(mat.size).toBeGreaterThan(0);
    let seed = 11;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const { crowd, advance, sent } = harness([at(1, 7)], rng, 'academia');
    crowd.sync();
    const spawned = crowd.avatars();
    expect(spawned.length).toBeGreaterThanOrEqual(3);
    expect(spawned.length).toBeLessThanOrEqual(6);
    for (const c of spawned) expect(mat.has(key(c.x, c.y)), `${c.name} at ${c.x},${c.y}`).toBe(false);

    advance(90_000);
    const later = crowd.avatars();
    expect(later.length).toBeGreaterThanOrEqual(3);
    expect(later.length).toBeLessThanOrEqual(6);
    for (const c of later) expect(mat.has(key(c.x, c.y)), `${c.name} idling at ${c.x},${c.y}`).toBe(false);

    const moves = sent.filter((m) => m.t === 'avatarMoved');
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      if (m.t !== 'avatarMoved') continue;
      for (const step of m.path) expect(mat.has(key(step.x, step.y)), `${m.id} via ${step.x},${step.y}`).toBe(false);
    }
  });
});
