import { describe, expect, it } from 'vitest';
import { DAILY_OBJECTS, DAILY_SIGNS, dailyDiaryIds, diaryDayFor, diaryVisible } from './diaryDaily.js';
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import { ROOM_IDS } from './rooms.js';

const rotating = (room: string, signs: boolean) => DIARY_PLACEMENTS.filter((p) => p.room === room && !!p.sign === signs && p.id !== 'bandeira_br');

describe('the small diary objects and signs, a couple a day', () => {
  it('shows each room only a couple of objects and one sign on any day, and the same ones every time it is asked', () => {
    for (const room of ROOM_IDS) {
      for (const day of [0, 1, 2, 17, 400]) {
        const out = dailyDiaryIds(room, day);
        const objects = [...out].filter((id) => rotating(room, false).some((p) => p.id === id));
        const signs = [...out].filter((id) => rotating(room, true).some((p) => p.id === id));
        expect(objects.length, `${room} day ${day}`).toBeLessThanOrEqual(DAILY_OBJECTS);
        expect(signs.length, `${room} day ${day}`).toBeLessThanOrEqual(DAILY_SIGNS);
        expect([...dailyDiaryIds(room, day)].sort()).toEqual([...out].sort());
      }
    }
  });

  it('changes from day to day, and brings every object and sign out on some day', () => {
    expect([...dailyDiaryIds('praca', 5)].sort()).not.toEqual([...dailyDiaryIds('praca', 6)].sort());
    for (const p of DIARY_PLACEMENTS) {
      if (p.id === 'bandeira_br') continue;
      const day = diaryDayFor(p.id);
      expect(diaryVisible(p.room, p.id, day), p.id).toBe(true);
      const perDay = p.sign ? DAILY_SIGNS : DAILY_OBJECTS;
      const size = rotating(p.room, !!p.sign).length;
      // one lap is ceil(size / perDay) days, and the lap after it starts a fresh shuffle
      expect(day, p.id).toBeLessThan(Math.ceil(size / perDay) + 1);
    }
  });

  it('never hides what was already in the rooms, or the airport hall, or a flag that is a fixture', () => {
    expect(diaryVisible('praca', 'fonte', 0)).toBe(true);
    expect(diaryVisible('praca', 'coreto_placa', 9)).toBe(true);
    expect(diaryVisible('academia', 'bandeira_br', 3)).toBe(true);
    // a rotating id asked about in the wrong room is not that room's object
    expect(diaryVisible('rua', 'd_pombo', 0)).toBe(true);
  });
});
