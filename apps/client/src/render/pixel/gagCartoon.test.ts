import { describe, expect, it } from 'vitest';
import type { MatMoveId } from '@tudobem/shared';
import { CARTOON_MS, GAG_TRACKS, THINK_MS, cartoonFor, sampleCartoon, trackOf } from './gagCartoon';

const MOVES: MatMoveId[] = [
  'collar_tie',
  'sleeve_grip',
  'double_leg',
  'body_lock',
  'single_leg',
  'collar_drag',
  'sleeve_pull',
  'hip_throw',
  'hook_sweep',
  'scissor_sweep',
  'hip_bump',
  'posture',
  'passar',
  'knee_on_belly',
  'back_take',
  'sprawl',
  'frame',
  'escape_back',
  'armbar',
  'americana',
  'rnc',
  'hold',
];

describe('gag bar', () => {
  it('has the six tracks and leaves Hold off the bar', () => {
    expect(GAG_TRACKS.map((t) => t.en)).toEqual(['Grips', 'Takedowns', 'Sweeps', 'Defense', 'Passes', 'Submissions']);
    const listed = GAG_TRACKS.flatMap((t) => [...t.moves]);
    expect(listed).not.toContain('hold');
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.sort()).toEqual(MOVES.filter((id) => id !== 'hold').sort());
    expect(trackOf('hold')).toBeNull();
    expect(trackOf('double_leg')?.id).toBe('takedowns');
    expect(trackOf('hook_sweep')?.id).toBe('sweeps');
    expect(trackOf('posture')?.id).toBe('defense');
    expect(trackOf('passar')?.id).toBe('passes');
  });
});

describe('move cartoons', () => {
  it('keeps the old pose until the cartoon ends, then a hit gains ground and a miss has stumbled home', () => {
    const hit = cartoonFor('double_leg', true, 'de_pe', 'cem_quilos');
    const miss = cartoonFor('double_leg', false, 'de_pe', 'de_pe');
    expect(hit.read).toBe('gain');
    expect(hit.then).toBe('cem_quilos');
    expect(miss.read).toBe('stumble');
    expect(miss.then).toBe('de_pe');
    for (const sample of [...hit.path, ...miss.path]) expect(sample.pose).toBe('de_pe');
    expect(hit.path.at(-1)).toMatchObject({ x: 0, y: 0, rot: 0 });
    expect(miss.path.at(-1)).toMatchObject({ x: 0, y: 0, rot: 0 });
    const hitMid = sampleCartoon(hit.path, 0.42);
    const missMid = sampleCartoon(miss.path, 0.68);
    expect(Math.hypot(hitMid.x, hitMid.y)).toBeGreaterThan(4);
    expect(missMid.y).toBeGreaterThan(hitMid.y);
    expect(missMid.x).not.toBeCloseTo(hitMid.x, 0);
  });

  it('gives every move its own shape, including a grip that stays put', () => {
    const mids = MOVES.map((id) => {
      const c = cartoonFor(id, true, 'de_pe', id === 'double_leg' ? 'cem_quilos' : 'de_pe');
      const mid = sampleCartoon(c.path, 0.42);
      return `${id}:${mid.x.toFixed(1)},${mid.y.toFixed(1)},${mid.rot.toFixed(1)}`;
    });
    expect(new Set(mids).size).toBe(MOVES.length);
    const grip = cartoonFor('collar_tie', true, 'de_pe', 'de_pe');
    expect(grip.read).toBe('stick');
    expect(grip.then).toBe('de_pe');
    const dumped = cartoonFor('armbar', false, 'montada', 'guarda_fechada');
    expect(dumped.read).toBe('stumble');
    expect(dumped.then).toBe('guarda_fechada');
    expect(dumped.path.every((s) => s.pose === 'montada')).toBe(true);
  });

  it('is a short beat, slow enough to read, with a pause before the opponent shows their hand', () => {
    expect(CARTOON_MS).toBeGreaterThan(1200);
    expect(CARTOON_MS).toBeLessThan(2500);
    expect(THINK_MS).toBeGreaterThan(2000);
    expect(THINK_MS).toBeLessThan(5000);
  });
});
