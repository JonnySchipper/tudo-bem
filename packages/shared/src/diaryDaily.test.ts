import { describe, expect, it } from 'vitest';
import { DAILY_OBJECTS, dailyDiaryIds, diaryDayFor, diaryVisible } from './diaryDaily.js';
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import { ROOM_IDS } from './rooms.js';

const rotating = (room: string) => DIARY_PLACEMENTS.filter((p) => p.room === room && !p.sign && p.id !== 'bandeira_br');

describe('the small diary objects, a couple a day', () => {
  it('shows each room only a couple of objects on any day, and the same ones every time it is asked', () => {
    for (const room of ROOM_IDS) {
      for (const day of [0, 1, 2, 17, 400]) {
        const out = dailyDiaryIds(room, day);
        expect([...out].every((id) => rotating(room).some((p) => p.id === id)), `${room} day ${day}`).toBe(true);
        expect(out.size, `${room} day ${day}`).toBeLessThanOrEqual(DAILY_OBJECTS);
        expect([...dailyDiaryIds(room, day)].sort()).toEqual([...out].sort());
      }
    }
  });

  it('changes from day to day, and brings every object out on some day', () => {
    expect([...dailyDiaryIds('praca', 5)].sort()).not.toEqual([...dailyDiaryIds('praca', 6)].sort());
    for (const p of DIARY_PLACEMENTS) {
      if (p.id === 'bandeira_br' || p.sign) continue;
      const day = diaryDayFor(p.id);
      expect(diaryVisible(p.room, p.id, day), p.id).toBe(true);
      const size = rotating(p.room).length;
      // one lap is ceil(size / DAILY_OBJECTS) days, and the lap after it starts a fresh shuffle
      expect(day, p.id).toBeLessThan(Math.ceil(size / DAILY_OBJECTS) + 1);
    }
  });

  it('never hides what was already in the rooms, or the airport’s things, or a flag that is a fixture', () => {
    expect(diaryVisible('praca', 'fonte', 0)).toBe(true);
    expect(diaryVisible('praca', 'coreto_placa', 9)).toBe(true);
    expect(diaryVisible('academia', 'bandeira_br', 3)).toBe(true);
    for (const day of [0, 1, 7]) expect(diaryVisible('aeroporto', 'hall_mala', day)).toBe(true);
    // a rotating id asked about in the wrong room is not that room's object
    expect(diaryVisible('rua', 'd_pombo', 0)).toBe(true);
  });

  it('every reading word is readable every day (signs are written on things, not plates that rotate)', () => {
    for (const p of DIARY_PLACEMENTS.filter((q) => q.sign)) for (const day of [0, 1, 7, 99]) expect(diaryVisible(p.room, p.id, day), p.id).toBe(true);
  });
});
