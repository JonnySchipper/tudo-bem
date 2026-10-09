import { describe, expect, it } from 'vitest';
import { ROOMS, ROOM_IDS } from '@tudobem/shared';
import { doorTagsFor, exitLine } from './wayfinding';
import { HOW_TO_PLAY } from './howToPlayData';
import { shouldReveal } from './diaryWordQueue';

describe('wayfinding: every room says where its doors go', () => {
  it('tags every way out of every room, in PT and EN, with the destination room', () => {
    for (const id of ROOM_IDS) {
      const room = ROOMS[id];
      const tags = doorTagsFor(room);
      expect(tags.length, id).toBeGreaterThan(0);
      // every destination this room leads to has a tag
      expect(new Set(tags.map((t) => t.to)), id).toEqual(new Set(room.portals.map((p) => p.to)));
      for (const t of tags) {
        expect(t.pt.trim().length, `${id} ${t.key}`).toBeGreaterThan(2);
        expect(t.en.trim().length, `${id} ${t.key}`).toBeGreaterThan(2);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(room.cols);
        expect(t.y).toBeLessThanOrEqual(room.rows);
      }
    }
  });

  it('puts one tag on a whole street end, not one per edge tile', () => {
    const rua = ROOMS.rua;
    const toLeste = rua.portals.filter((p) => p.to === 'rua_leste');
    expect(toLeste.length).toBeGreaterThan(1);
    const tags = doorTagsFor(rua).filter((t) => t.to === 'rua_leste');
    expect(tags).toHaveLength(1);
    expect(tags[0]!.pt.startsWith('→')).toBe(true);
  });

  it('names the arrivals hall’s door: on to the airport', () => {
    const [tag] = doorTagsFor(ROOMS.desembarque);
    expect(tag).toMatchObject({ to: 'aeroporto', en: 'On to the airport' });
    expect(exitLine([tag!])).toContain('Siga para o aeroporto');
  });
});

describe('how to play', () => {
  it('covers every minigame, with a goal, steps and controls for a computer and a phone', () => {
    expect(HOW_TO_PLAY.map((g) => g.id)).toEqual(['correria', 'tapioca', 'pastel', 'caldo', 'bout', 'escola', 'damas', 'feira', 'pedido']);
    for (const g of HOW_TO_PLAY) {
      expect(g.selector.length, g.id).toBeGreaterThan(3);
      expect(g.goal.length, g.id).toBeGreaterThan(10);
      expect(g.steps.length, g.id).toBeGreaterThan(0);
      expect(g.desktop.length, g.id).toBeGreaterThan(5);
      expect(g.phone.length, g.id).toBeGreaterThan(5);
    }
  });

  it('never makes the jiu-jitsu roll a quiz', () => {
    const bout = HOW_TO_PLAY.find((g) => g.id === 'bout')!;
    expect([bout.goal, ...bout.steps].join(' ').toLowerCase()).not.toMatch(/quiz question|trivia/);
  });
});

describe('the journal reveal', () => {
  it('opens the journal only for the first word of a fresh diary, once', () => {
    expect(shouldReveal([], false)).toBe(true);
    expect(shouldReveal(['diary.chegada.bemvindo'], false)).toBe(true);
    expect(shouldReveal(['diary.chegada.bemvindo', 'diary.chegada.desembarque'], false)).toBe(false);
    expect(shouldReveal([], true)).toBe(false);
  });
});
