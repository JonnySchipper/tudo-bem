import { describe, expect, it } from 'vitest';
import { WEATHER_IDLE_LINES, type Bilingual } from '@tudobem/shared';
import { IdleTalk, weatherTalkFits } from './idleTalk';

const own: Bilingual[] = [
  { pt: 'a', en: 'a' },
  { pt: 'b', en: 'b' },
];
const isWeather = (l: Bilingual, w: keyof typeof WEATHER_IDLE_LINES) => WEATHER_IDLE_LINES[w].includes(l);

describe('IdleTalk (NPC weather small talk)', () => {
  it('is at most one line in four, even when every roll says yes', () => {
    const t = new IdleTalk();
    let weather = 0;
    const N = 400;
    for (let i = 0; i < N; i++) if (isWeather(t.next(own, 'garoa', 600, () => 0), 'garoa')) weather++;
    expect(weather).toBeGreaterThan(0);
    expect(weather).toBeLessThanOrEqual(N / 4);
  });

  it('never opens with weather and never does two in a row', () => {
    const t = new IdleTalk();
    const seq = Array.from({ length: 20 }, () => isWeather(t.next(own, 'chuva', 600, () => 0), 'chuva'));
    expect(seq[0]).toBe(false);
    for (let i = 1; i < seq.length; i++) expect(seq[i] && seq[i - 1]).toBe(false);
    // weather lines are at least 3 ordinary lines apart
    const at = seq.flatMap((w, i) => (w ? [i] : []));
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(4);
  });

  it('uses the lines of the current weather, and sometimes says nothing about it', () => {
    const t = new IdleTalk();
    const seen = new Set<Bilingual>();
    for (let i = 0; i < 200; i++) seen.add(t.next(own, 'nublado', 600, Math.random));
    expect([...seen].some((l) => isWeather(l, 'nublado'))).toBe(true);
    expect([...seen].some((l) => own.includes(l))).toBe(true);
    expect([...seen].every((l) => own.includes(l) || isWeather(l, 'nublado'))).toBe(true);
  });

  it('keeps sunny and cloudy chat out of the night, but rain is fair game', () => {
    expect(weatherTalkFits('sol', 6 * 60)).toBe(true);
    expect(weatherTalkFits('sol', 20 * 60 + 59)).toBe(true);
    expect(weatherTalkFits('sol', 21 * 60)).toBe(false);
    expect(weatherTalkFits('nublado', 3 * 60)).toBe(false);
    expect(weatherTalkFits('chuva', 3 * 60)).toBe(true);
    expect(weatherTalkFits('garoa', 23 * 60)).toBe(true);
    const t = new IdleTalk();
    for (let i = 0; i < 50; i++) expect(isWeather(t.next(own, 'sol', 23 * 60, () => 0), 'sol')).toBe(false);
  });
});
