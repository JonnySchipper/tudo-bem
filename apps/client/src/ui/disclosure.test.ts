import { describe, expect, it } from 'vitest';
import { atLeast, hudShows, recadosDone, stage, type DisclosureProfile } from './disclosure';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);
const vila: DisclosureProfile = { desembarqueDone: true, arrivalIntroDone: true, tutorial: { carlos: false }, recados: { done: [] }, diary: [], escola: { lessons: 0 }, giOwned: false, hats: [] };
const resident: DisclosureProfile = { ...vila, tutorial: { carlos: true }, recadosDoneTotal: 1 };
const regular: DisclosureProfile = { ...resident, recadosDoneTotal: 3 };

describe('stage', () => {
  it('S0 while the arrivals hall or the flight is not done', () => {
    expect(stage({ desembarqueDone: false, arrivalIntroDone: false })).toBe('S0');
    expect(stage({ desembarqueDone: true, arrivalIntroDone: false })).toBe('S0');
    expect(stage({ ...regular, desembarqueDone: false })).toBe('S0');
  });

  it('treats a save from before the hall and the flight (no flags) as living here', () => {
    expect(stage({})).toBe('S1');
  });

  it('S1 in the Vila until the first order from Seu Carlos and the first recado', () => {
    expect(stage(vila)).toBe('S1');
    expect(stage({ ...vila, tutorial: { carlos: true } })).toBe('S1');
    expect(stage({ ...vila, recadosDoneTotal: 1 })).toBe('S1');
  });

  it('S2 after Seu Carlos and one recado', () => {
    expect(stage(resident)).toBe('S2');
    expect(stage({ ...vila, tutorial: { carlos: true }, recados: { done: ['a'] } })).toBe('S2');
  });

  it('S3 on 25 diary words, 3 recados, a finished lesson or a gi', () => {
    expect(stage({ ...resident, diary: words(24) })).toBe('S2');
    expect(stage({ ...resident, diary: words(25) })).toBe('S3');
    expect(stage(regular)).toBe('S3');
    expect(stage({ ...vila, recados: { done: ['a', 'b', 'c'] } })).toBe('S3');
    expect(stage({ ...vila, escola: { lessons: 1 } })).toBe('S3');
    expect(stage({ ...vila, giOwned: true })).toBe('S3');
  });

  it('counts recados over every day, falling back on today’s list for an old save', () => {
    expect(recadosDone({ recados: { done: ['a', 'b'] } })).toBe(2);
    expect(recadosDone({ recadosDoneTotal: 7, recados: { done: [] } })).toBe(7);
    expect(atLeast('S2', 'S1') && atLeast('S2', 'S2') && !atLeast('S2', 'S3')).toBe(true);
  });
});

describe('hudShows: the §3 table', () => {
  it('S0 shows only what the hall and the airport teach', () => {
    const s = hudShows({ desembarqueDone: true, arrivalIntroDone: false, hasCamera: true });
    expect(s).toMatchObject({ stage: 'S0', rv: true, map: true, diary: true, camera: true, fala: true });
    expect(s).toMatchObject({ favores: false, look: false, hats: false, friends: false, emotesOpen: false, gearExtras: false, roomCounts: false, plate: false, goal: false, cartela: false, belt: false });
    expect(hudShows({ desembarqueDone: false, arrivalIntroDone: false }).camera).toBe(false);
  });

  it('S1: logo, room name, clock, RV, Mapa, Favores, Diário, Câmera if owned, the gear; nothing else', () => {
    const s = hudShows({ ...vila, hasCamera: true }, { solo: false, ownKitnet: false });
    const on = Object.entries(s)
      .filter(([k, v]) => k !== 'stage' && v === true)
      .map(([k]) => k)
      .sort();
    expect(on).toEqual(['camera', 'diary', 'fala', 'favores', 'map', 'rv']);
    expect(hudShows(vila).camera).toBe(false);
  });

  it('S2 adds Visual, the room counts, the open emote row, the gear extras and Amigos (multiplayer only)', () => {
    const s = hudShows(resident, { solo: false });
    expect(s).toMatchObject({ stage: 'S2', look: true, roomCounts: true, emotesOpen: true, gearExtras: true, friends: true });
    expect(hudShows(resident, { solo: true }).friends).toBe(false);
    expect(s).toMatchObject({ plate: false, goal: false, cartela: false });
  });

  it('Chapéus waits for S2 and a hat (or the hat step at Nanda’s stall)', () => {
    expect(hudShows(resident).hats).toBe(false);
    expect(hudShows({ ...resident, hats: ['bone'] }).hats).toBe(true);
    expect(hudShows({ ...resident, tutorial: { carlos: true, chapeu: true } }).hats).toBe(true);
    expect(hudShows({ ...vila, hats: ['bone'] }).hats).toBe(false);
  });

  it('the plate and the Meta chip wait for S3 and a finished lesson', () => {
    expect(hudShows(regular)).toMatchObject({ plate: false, goal: false });
    expect(hudShows({ ...regular, escola: { lessons: 1 } })).toMatchObject({ plate: true, goal: true });
  });

  it('the Cartela chip waits for S3 and the first stamp', () => {
    expect(hudShows({ ...resident, cartela: { stamps: 2, activityDay: {} } }).cartela).toBe(false);
    expect(hudShows({ ...regular, cartela: { stamps: 0, activityDay: {} } }).cartela).toBe(false);
    expect(hudShows({ ...regular, cartela: { stamps: 1, activityDay: {} } }).cartela).toBe(true);
    // a full card paid out and reset still counts as stamped
    expect(hudShows({ ...regular, cartela: { stamps: 0, activityDay: { correria: '2026-01-02' } } }).cartela).toBe(true);
  });

  it('Decorar only in your own kitnet; the belt only with a gi', () => {
    expect(hudShows(regular, { ownKitnet: true }).decor).toBe(true);
    expect(hudShows(regular, { ownKitnet: false }).decor).toBe(false);
    expect(hudShows({ ...vila, giOwned: true }).belt).toBe(true);
    expect(hudShows(regular).belt).toBe(false);
  });

  it('test profiles see everything once out of the arrival (the belt always)', () => {
    const s = hudShows({ ...vila, testUser: true }, { solo: false });
    expect(s).toMatchObject({ favores: true, look: true, hats: true, friends: true, emotesOpen: true, gearExtras: true, roomCounts: true, plate: true, goal: true, cartela: true, belt: true });
    expect(hudShows({ desembarqueDone: false, testUser: true })).toMatchObject({ favores: false, belt: true });
  });
});
