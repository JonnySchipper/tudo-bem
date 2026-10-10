import { describe, expect, it } from 'vitest';
import { ROOMS, ROOM_IDS } from '@tudobem/shared';
import { doorTagsFor } from './wayfinding';
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
    expect(tag!.pt).toContain('Siga para o aeroporto');
  });
});

describe('how to play', () => {
  it('covers every minigame, with a goal, steps and controls for a computer and a phone', () => {
    const games = HOW_TO_PLAY.filter((g) => (g.kind ?? 'game') === 'game');
    expect(games.map((g) => g.id)).toEqual(['tapioca', 'pastel', 'caldo', 'bout', 'escola', 'damas', 'feira']);
    for (const g of games) {
      expect(g.selector.length, g.id).toBeGreaterThan(3);
      expect(g.goal.length, g.id).toBeGreaterThan(10);
      expect(g.steps.length, g.id).toBeGreaterThan(0);
      expect(g.desktop?.length ?? 0, g.id).toBeGreaterThan(5);
      expect(g.phone?.length ?? 0, g.id).toBeGreaterThan(5);
    }
  });

  it('explains every panel and activity a new player meets without a guided tutorial', () => {
    const places = HOW_TO_PLAY.filter((g) => g.kind === 'place');
    expect(places.map((g) => g.id)).toEqual(['petshop', 'balcao', 'papo', 'recados', 'diario', 'cartela', 'missao', 'camera', 'kimono', 'academias', 'placar-feira', 'pesca']);
    for (const g of places) {
      expect(g.selector.length, g.id).toBeGreaterThan(3);
      expect(g.goal.length, g.id).toBeGreaterThan(10);
      expect(g.steps.length, g.id).toBeGreaterThan(1);
      // English for a player with no Portuguese yet, and short enough to read in one go
      expect([g.goal, ...g.steps].join(' ').length, g.id).toBeLessThan(800);
    }
    expect(new Set(HOW_TO_PLAY.map((g) => g.id)).size).toBe(HOW_TO_PLAY.length);
  });

  it('has no card for the bakery game: it teaches by doing (one coach mark per new action), and no card mentions "Quanto é?" there', () => {
    expect(HOW_TO_PLAY.find((g) => g.id === 'correria')).toBeUndefined();
    expect(HOW_TO_PLAY.find((g) => g.id === 'balcao')!.steps.join(' ')).toMatch(/vitrine/);
  });

  it('fishing has only the "?" card: it never opens by itself, and it carries the three beats in Portuguese with no digits', () => {
    const pesca = HOW_TO_PLAY.find((g) => g.id === 'pesca')!;
    expect(pesca.kind).toBe('place');
    expect(pesca.autoOpen).toBe(false);
    expect(pesca.selector).toBe('#pesca-root');
    expect(pesca.goal).toMatch(/Segura pra lançar, solta\. Fisgou\? Toca\. Segura pra puxar, solta quando ele corre\./);
    expect([pesca.goal, ...pesca.steps].join(' ')).not.toMatch(/\d/);
    // the cart games teach by doing too (C2): their cards wait for the "?"; the pet shop card is a command sheet behind the "?"
    const quiet = ['pesca', 'tapioca', 'pastel', 'caldo', 'petshop'];
    for (const id of quiet) expect(HOW_TO_PLAY.find((g) => g.id === id)!.autoOpen, id).toBe(false);
    for (const g of HOW_TO_PLAY) if (!quiet.includes(g.id)) expect(g.autoOpen, g.id).toBeUndefined();
  });

  it('the pet shop card is only the "?" command sheet: five short lines, never opens by itself', () => {
    const shop = HOW_TO_PLAY.find((g) => g.id === 'petshop')!;
    expect(shop.autoOpen).toBe(false);
    expect(shop.steps).toEqual(['senta (sit)', 'deita (lie down)', 'vem (come)', 'busca (fetch)', 'brinca (play)']);
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
