import { describe, expect, it } from 'vitest';
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import { DIARY_WORDS } from './diary.js';
import { hotspotById } from './hotspots.js';
import { ROOMS } from './rooms.js';

describe('wifi and feira bunting feedback', () => {
  it('puts the wifi reading sign on the padaria wall, not on a praça lamppost', () => {
    const wifi = DIARY_PLACEMENTS.find((p) => p.id === 's_wifi');
    expect(wifi).toMatchObject({ room: 'padaria', sign: { pt: 'WIFI', en: 'Wifi' } });
    expect(hotspotById('s_wifi')?.room).toBe('padaria');
    expect(ROOMS.praca.props.some((p) => p.id === 'lampada_p1' && p.x === 11 && p.y === 8)).toBe(true);
  });

  it('keeps bandeirinha on a single stall flag, not strung bunting across the aisle', () => {
    const word = DIARY_WORDS.find((w) => w.id === 'diary.feira.bandeirinha');
    expect(word).toMatchObject({ anchor: { kind: 'object', id: 'bandeirinhas_1' } });
    expect(word?.also).toBeUndefined();
    const flag = ROOMS.feira.props.find((p) => p.id === 'bandeirinhas_1');
    expect(flag).toMatchObject({ art: 'props/bandeirinha', x: 8, y: 2, w: 1, h: 1 });
    expect(ROOMS.feira.props.some((p) => p.id === 'bandeirinhas_2')).toBe(false);
  });
});
