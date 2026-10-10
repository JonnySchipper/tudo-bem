import { describe, expect, it } from 'vitest';
import { ARRIVAL_CARD } from './arrival.js';
import { COUNTER_LINES, diaryLine } from './diaryLines.js';
import { DIARY_WORDS, textTeaches, unheardIdleLine, wordForLine, wordsForPhoto } from './diary.js';
import { HOTSPOTS } from './hotspots.js';
import { PHOTO_SPOTS } from './photoSpots.js';
import { ROOMS } from './rooms.js';
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import { PAPOS } from './papos.js';

describe('where a conversation word is heard', () => {
  it('finds a talk node, an ambient line, a vendor’s greeting and closing note, the counter line and the arrival card', () => {
    expect(diaryLine('julia.ajuda')).toMatchObject({ kind: 'talk', npc: 'julia' });
    expect(diaryLine('julia.idle0')).toMatchObject({ kind: 'idle', pt: 'Oi! Precisa de ajuda? Fala comigo!' });
    expect(diaryLine('tia_lu.greet')?.pt).toMatch(/freguês/);
    expect(diaryLine('tia_lu.closed')?.pt).toMatch(/amanhã/);
    expect(diaryLine('carlos.viagem')).toMatchObject({ kind: 'counter', pt: COUNTER_LINES['carlos.viagem'] });
    expect(diaryLine('julia.chegada_camera')).toMatchObject({ kind: 'arrival', pt: ARRIVAL_CARD.camera.pt });
    expect(diaryLine('julia.idle99')).toBeUndefined();
    expect(diaryLine('nobody.idle0')).toBeUndefined();
    expect(diaryLine('julia')).toBeUndefined();
  });

  it('keeps the counter line one a bate-papo has the baker say, under its anchor', () => {
    const node = PAPOS.flatMap((p) => Object.values(p.nodes)).find((n) => n.anchor === 'carlos.viagem');
    expect(node?.line.pt).toBe(COUNTER_LINES['carlos.viagem']);
  });

  it('keeps Júlia’s arrival note as it was, and puts the Chegada signs on the airport’s walls', () => {
    expect(ARRIVAL_CARD.kicker.pt).toBe('Aeroporto');
    expect(ARRIVAL_CARD.title.pt).toBe('Você chegou ao Brasil');
    expect(ARRIVAL_CARD.landed.pt).toBe('O avião acabou de pousar. Júlia te espera na praça.');
    expect(ARRIVAL_CARD.camera.pt).toBe('Toma a câmera e a cartela do bairro.');
    expect(ARRIVAL_CARD.diary.pt).toBe('Fotografe o que você vê e as palavras ficam no diário.');
    const signs = ['arrival.kicker', 'hall_s_desembarque', 'hall_s_bagagem', 'hall_s_alfandega', 'hall_s_embarque', 'hall_s_terminal'];
    for (const id of signs) expect(HOTSPOTS.find((h) => h.id === id)?.room, id).toBe('aeroporto');
  });

  it('has every word in the line or sign it is earned from', () => {
    expect(textTeaches('Hoje o sol tá forte.', 'sol')).toBe(true);
    expect(textTeaches('R. DOS IPÊS', 'rua')).toBe(false);
    expect(textTeaches('R. DOS IPÊS', 'rua', 'r. dos')).toBe(true);
    expect(textTeaches('FRUTAS DA TIA LU', 'fruta')).toBe(true);
  });

  it('knows which ambient line of an NPC still has a word to teach', () => {
    const julia = ROOMS.praca.npcs.find((n) => n.id === 'julia')!;
    expect(julia.idleLines.length).toBeGreaterThanOrEqual(4);
    expect(unheardIdleLine('julia', julia.idleLines.length, [])).toBe(0);
    expect(unheardIdleLine('julia', julia.idleLines.length, ['diary.praca.ajuda'])).toBe(2);
    expect(unheardIdleLine('julia', julia.idleLines.length, ['diary.praca.ajuda', 'diary.praca.vizinho', 'diary.praca.passeio'])).toBeNull();
    expect(unheardIdleLine('nobody', 3, [])).toBeNull();
    expect(wordForLine('julia.idle3')?.pt).toBe('passeio');
  });
});

describe('what the camera and the readers can reach', () => {
  it('puts every added sign in the hotspots, with the text the catalog prints, in the room of its area', () => {
    const signs = DIARY_PLACEMENTS.filter((p) => p.sign);
    expect(signs).toHaveLength(41);
    for (const p of signs) {
      const h = HOTSPOTS.find((x) => x.id === p.id);
      expect(h, p.id).toBeDefined();
      expect(h).toMatchObject({ room: p.room, pt: p.sign!.pt, en: p.sign!.en });
    }
  });

  it('has the wall spots on the north wall band of an interior, the airport’s on its map, and no two objects with one id', () => {
    for (const s of PHOTO_SPOTS) {
      if (s.room === 'aeroporto') {
        // parts of the plane, the runway, the booth counter: inside the map
        expect(s.x >= 0 && s.y >= 0 && s.x + s.w <= ROOMS.aeroporto.cols && s.y + s.h <= ROOMS.aeroporto.rows, s.id).toBe(true);
        continue;
      }
      expect(ROOMS[s.room].outdoor, s.id).toBeFalsy();
      expect(s.y, s.id).toBeLessThan(0);
      expect(s.y + s.h, s.id).toBeLessThanOrEqual(0);
    }
    const ids = Object.values(ROOMS).flatMap((r) => r.props.map((p) => `${r.id}:${p.id}`));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('teaches nothing from objects that are not in the catalog', () => {
    expect(wordsForPhoto('sebe_n_0')).toEqual([]);
    expect(DIARY_WORDS.filter((w) => w.source === 'camera' && w.origin === 'added').length).toBe(301);
  });
});
