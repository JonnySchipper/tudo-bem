import { describe, expect, it } from 'vitest';
import {
  createPetFollow,
  parsePetCommand,
  petCommandFromLines,
  PET_RUN_PX_S,
  PET_WALK_PX_S,
  REST_ASIDE_PX,
  SNAP_GAP_PX,
  stepPet,
  type PetFollow,
  type PetFollowStep,
  type PetVoice,
} from './petFollow';

const DT = 1 / 60;

function go(state: PetFollow, step: Partial<PetFollowStep> & Pick<PetFollowStep, 'ownerX' | 'ownerY'>): PetFollow {
  return stepPet(state, {
    ownerMoving: false,
    place: 'praca',
    dt: DT,
    command: null,
    ...step,
  });
}

/** Walk the owner in a straight line at about a player's pace. Returns the pet after the last frame. */
function march(state: PetFollow, x0: number, y0: number, x1: number, y1: number, seconds: number, place = 'praca'): PetFollow {
  const frames = Math.max(1, Math.round(seconds / DT));
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    go(state, {
      ownerX: x0 + (x1 - x0) * t,
      ownerY: y0 + (y1 - y0) * t,
      ownerMoving: true,
      place,
    });
  }
  return state;
}

describe('pet trail', () => {
  it('starts beside the owner, not standing on their feet', () => {
    const pet = go(createPetFollow(), { ownerX: 100, ownerY: 80 });
    const d = Math.hypot(pet.x - 100, pet.y - 80);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(24);
    expect(pet.x).toBe(100 + REST_ASIDE_PX);
    expect(pet.pose).toBe('idle');
  });

  it('walks the breadcrumbs a couple of tiles behind, facing its own direction', () => {
    const pet = march(createPetFollow(), 0, 40, 160, 40, 2.4);
    expect(pet.pose).toBe('walk');
    expect(pet.moving).toBe(true);
    expect(pet.facing).toBe('E');
    expect(pet.x).toBeLessThan(160 - 24);
    expect(pet.x).toBeGreaterThan(160 - 70);
    expect(Math.abs(pet.y - 40)).toBeLessThan(8);
    expect(Math.hypot(pet.x - 160, pet.y - 40)).toBeGreaterThan(20);
  });

  it('keeps its own speed: one frame cannot jump to where the owner just went', () => {
    const pet = go(createPetFollow(), { ownerX: 0, ownerY: 0 });
    const before = { x: pet.x, y: pet.y };
    go(pet, { ownerX: 80, ownerY: 0, ownerMoving: true });
    const moved = Math.hypot(pet.x - before.x, pet.y - before.y);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(PET_WALK_PX_S * DT + 0.02);
    expect(Math.hypot(pet.x - 80, pet.y)).toBeGreaterThan(30);
  });

  it('follows the path through a corner instead of copying the owner’s facing', () => {
    const pet = march(createPetFollow(), 0, 0, 90, 0, 1.3);
    march(pet, 90, 0, 90, 30, 0.35);
    expect(pet.x).toBeLessThan(90 - 8);
    expect(pet.facing).not.toBe('S');
    expect(pet.pose).toBe('walk');
  });

  it('catches up and idles a little behind or beside once the owner stops', () => {
    const pet = march(createPetFollow(), 0, 20, 140, 20, 2.2);
    for (let i = 0; i < 90; i++) go(pet, { ownerX: 140, ownerY: 20, ownerMoving: false });
    expect(pet.moving).toBe(false);
    expect(pet.pose).toBe('idle');
    expect(pet.facing).toBe('S');
    const d = Math.hypot(pet.x - 140, pet.y - 20);
    expect(d).toBeGreaterThan(8);
    expect(d).toBeLessThan(32);
  });

  it('rests clear of the owner’s legs (the 24px pet frame does not cover the owner’s feet)', () => {
    for (const [x1, y1] of [[140, 20], [0, 140], [-140, 20], [0, -100]] as const) {
      const pet = march(createPetFollow(), 0, 20, x1, y1, 2.2);
      for (let i = 0; i < 120; i++) go(pet, { ownerX: x1, ownerY: y1, ownerMoving: false });
      // the owner's body is ~12px wide at the feet; the pet is 24px wide and drawn from its feet up
      expect(Math.abs(pet.x - x1) >= 18 || Math.abs(pet.y - y1) >= 16).toBe(true);
    }
    const snapped = go(createPetFollow(), { ownerX: 100, ownerY: 80 });
    expect(Math.abs(snapped.x - 100)).toBeGreaterThanOrEqual(16);
  });

  it('snaps beside the owner across a teleport-sized gap', () => {
    const pet = march(createPetFollow(), 0, 0, 40, 0, 0.8);
    go(pet, { ownerX: 40 + SNAP_GAP_PX + 40, ownerY: 10, ownerMoving: false });
    expect(pet.x).toBe(40 + SNAP_GAP_PX + 40 + REST_ASIDE_PX);
    expect(pet.y).toBe(12);
    expect(Math.hypot(pet.x - (40 + SNAP_GAP_PX + 40), pet.y - 10)).toBeLessThan(24);
  });

  it('snaps when the room changes even if the coordinates match', () => {
    const pet = march(createPetFollow(), 0, 0, 80, 0, 1.4);
    const far = pet.x;
    go(pet, { ownerX: 80, ownerY: 0, ownerMoving: false, place: 'padaria' });
    expect(pet.place).toBe('padaria');
    expect(pet.x).toBe(80 + REST_ASIDE_PX);
    expect(pet.x).not.toBeCloseTo(far, 0);
  });
});

describe('pet voice commands', () => {
  const names = ['Rex', 'Totó', 'Cachorro', 'Dog'];

  it('reads senta, deita and vem through case, accents and punctuation', () => {
    const cases: [string, PetVoice][] = [
      ['senta', 'sit'],
      ['SENTA', 'sit'],
      ['SeNtA', 'sit'],
      ['sénta', 'sit'],
      ['SÊNTA', 'sit'],
      ['senta!', 'sit'],
      ['Senta!', 'sit'],
      ['senta?', 'sit'],
      ['senta.', 'sit'],
      ['senta...', 'sit'],
      ['  senta  ', 'sit'],
      ['¡senta!', 'sit'],
      ['(senta)', 'sit'],
      ['deita', 'lie'],
      ['DEITA', 'lie'],
      ['déita', 'lie'],
      ['dêita!', 'lie'],
      ['deita.', 'lie'],
      ['vem', 'come'],
      ['VEM', 'come'],
      ['vêm', 'come'],
      ['vem!', 'come'],
    ];
    for (const [text, voice] of cases) expect(parsePetCommand(text), text).toBe(voice);
  });

  it('allows the pet’s name on either side, and a bare "!"', () => {
    expect(parsePetCommand('Rex, senta!', names)).toBe('sit');
    expect(parsePetCommand('senta, Rex', names)).toBe('sit');
    expect(parsePetCommand('SENTA rex!', names)).toBe('sit');
    expect(parsePetCommand('Totó, deita!', names)).toBe('lie');
    expect(parsePetCommand('deita toto', names)).toBe('lie');
    expect(parsePetCommand('Cachorro, vem!', names)).toBe('come');
    expect(parsePetCommand('vem, dog', names)).toBe('come');
    expect(parsePetCommand('senta!')).toBe('sit');
  });

  it('ignores ordinary chat, extra words, and the infinitive', () => {
    for (const text of ['', '   ', '!', 'oi', 'senta aqui', 'senta por favor', 'por favor senta', 'sentar', 'deitar', 'vem aqui', 'eu quero sentar', 'senta deita', 'apresenta', 'Rex senta aqui']) {
      expect(parsePetCommand(text, names), text).toBeNull();
    }
    expect(parsePetCommand('Rex, senta!')).toBeNull();
  });

  it('hears a command once from a chat line and leaves the text alone', () => {
    const lines = [
      { text: 'oi!', at: 1 },
      { text: 'Senta!', at: 2 },
    ];
    const first = petCommandFromLines(lines, 0, names);
    expect(first).toEqual({ command: 'sit', heardAt: 2 });
    expect(lines[1]!.text).toBe('Senta!');
    expect(petCommandFromLines(lines, first.heardAt, names).command).toBeNull();
    const next = petCommandFromLines([...lines, { text: 'déita.', at: 3 }], first.heardAt, names);
    expect(next.command).toBe('lie');
  });

  it('sits until the owner moves again, and lies down the same way', () => {
    const pet = march(createPetFollow(), 0, 0, 100, 0, 1.6);
    for (let i = 0; i < 40; i++) go(pet, { ownerX: 100, ownerY: 0, ownerMoving: false });
    go(pet, { ownerX: 100, ownerY: 0, command: 'sit' });
    expect(pet.pose).toBe('sit');
    expect(pet.moving).toBe(false);
    for (let i = 0; i < 20; i++) go(pet, { ownerX: 100, ownerY: 0, ownerMoving: false });
    expect(pet.pose).toBe('sit');
    const sat = { x: pet.x, y: pet.y };
    go(pet, { ownerX: 100, ownerY: 0, command: 'lie' });
    expect(pet.pose).toBe('lie');
    expect(pet.x).toBe(sat.x);
    expect(pet.y).toBe(sat.y);
    march(pet, 100, 0, 140, 0, 0.5);
    expect(pet.pose).toBe('walk');
    expect(pet.held).toBeNull();
  });

  it('stays sitting through a walk that was already going, then gets up on the next one', () => {
    const pet = march(createPetFollow(), 0, 0, 60, 0, 0.8);
    go(pet, { ownerX: 60, ownerY: 0, ownerMoving: true, command: 'sit' });
    expect(pet.pose).toBe('sit');
    go(pet, { ownerX: 70, ownerY: 0, ownerMoving: true });
    expect(pet.pose).toBe('sit');
    go(pet, { ownerX: 70, ownerY: 0, ownerMoving: false });
    expect(pet.pose).toBe('sit');
    go(pet, { ownerX: 74, ownerY: 0, ownerMoving: true });
    expect(pet.pose).not.toBe('sit');
  });

  it('runs to the owner on vem', () => {
    const walk = go(createPetFollow(), { ownerX: 0, ownerY: 0 });
    const run = go(createPetFollow(), { ownerX: 0, ownerY: 0 });
    // far enough (and short enough) that neither pet has reached its resting slot yet
    const ownerX = 100;
    for (let i = 0; i < 20; i++) {
      go(walk, { ownerX, ownerY: 0, ownerMoving: false });
      go(run, { ownerX, ownerY: 0, ownerMoving: false, command: i === 0 ? 'come' : null });
    }
    const walkD = Math.hypot(walk.x - ownerX, walk.y);
    const runD = Math.hypot(run.x - ownerX, run.y);
    expect(runD).toBeLessThan(walkD - 8);
    expect(run.x - walk.x).toBeGreaterThan(PET_RUN_PX_S * 0.2 - PET_WALK_PX_S * 0.2);
  });
});

describe('toy commands (#234: busca, brinca)', () => {
  it('busca and brinca answer only with the toy, and never rewrite the line', () => {
    expect(parsePetCommand('busca!')).toBeNull();
    expect(parsePetCommand('busca!', [], { fetch: true, play: false })).toBe('fetch');
    expect(parsePetCommand('Pega a bolinha', ['Paçoca'], { fetch: true, play: false })).toBe('fetch');
    expect(parsePetCommand('Paçoca, busca', ['Paçoca'], { fetch: true, play: false })).toBe('fetch');
    expect(parsePetCommand('brinca', [], { fetch: true, play: false })).toBeNull();
    expect(parsePetCommand('brinca', [], { fetch: false, play: true })).toBe('play');
    const lines = [{ text: 'busca!', at: 5 }];
    expect(petCommandFromLines(lines, 0, [], { fetch: true, play: false }).command).toBe('fetch');
    expect(lines[0]!.text).toBe('busca!');
  });

  it('a fetch runs ahead of the owner, then comes back and rests', () => {
    const pet = go(createPetFollow(), { ownerX: 0, ownerY: 0 });
    for (let i = 0; i < 60; i++) go(pet, { ownerX: 0, ownerY: 0 });
    go(pet, { ownerX: 0, ownerY: 0, command: 'fetch' as PetVoice });
    let far = 0;
    for (let i = 0; i < 180; i++) {
      go(pet, { ownerX: 0, ownerY: 0 });
      far = Math.max(far, Math.hypot(pet.x, pet.y));
    }
    expect(far).toBeGreaterThan(40);
    expect(pet.fetch).toBeNull();
    expect(Math.hypot(pet.x, pet.y)).toBeLessThan(24);
    expect(pet.pose).toBe('idle');
  });

  it('a cat plays (sits and stands in turn) and then idles', () => {
    const pet = go(createPetFollow(), { ownerX: 0, ownerY: 0 });
    for (let i = 0; i < 60; i++) go(pet, { ownerX: 0, ownerY: 0 });
    go(pet, { ownerX: 0, ownerY: 0, command: 'play' as PetVoice });
    const poses = new Set<string>();
    for (let i = 0; i < 300; i++) poses.add(go(pet, { ownerX: 0, ownerY: 0 }).pose);
    expect(poses.has('sit') && poses.has('idle')).toBe(true);
    expect(pet.play).toBe(0);
    expect(pet.pose).toBe('idle');
  });
});
