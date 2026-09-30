import { describe, expect, it } from 'vitest';
import { GAME_DAY_MS, gameDay, gameMinutes, weatherAt } from '@tudobem/shared';
import { GameClock, exactMinutes, msAt, parseClockParams, parseTimeOfDay, skewOf } from './gameClock';

const REAL = 1_800_000_000_000;

describe('skew math', () => {
  it('skew is serverNow - localNow and puts the client on the server clock', () => {
    const local = REAL;
    const server = REAL + 4321;
    expect(skewOf(server, local)).toBe(4321);
    const c = new GameClock(() => local);
    c.syncServer(server, local);
    expect(c.skewMs).toBe(4321);
    expect(c.now(local)).toBe(server);
    expect(c.minutes(local)).toBe(gameMinutes(server));
    // a client whose clock is 10 minutes slow still reads the server's game time
    const slow = new GameClock(() => local - 600_000);
    slow.syncServer(server, local - 600_000);
    expect(slow.minutes(local - 600_000)).toBe(gameMinutes(server));
  });

  it('keeps the first stamp unless the clocks drift by more than a second', () => {
    const c = new GameClock(() => REAL);
    c.syncServer(REAL + 100, REAL);
    c.syncServer(REAL + 5_000 + 350, REAL + 5_000); // latency jitter of 250 ms: ignored
    expect(c.skewMs).toBe(100);
    c.syncServer(REAL + 9_000 + 3_000, REAL + 9_000); // real drift
    expect(c.skewMs).toBe(3_000);
  });

  it('ignores a missing or bad serverNow', () => {
    const c = new GameClock(() => REAL);
    c.syncServer(undefined);
    c.syncServer(Number.NaN);
    expect(c.skewMs).toBe(0);
  });
});

describe('game minutes progress with the clock', () => {
  it('one game minute is two real seconds at speed 1', () => {
    let t = REAL;
    const c = new GameClock(() => t);
    const m0 = c.minutesExact();
    t += 2000;
    expect(c.minutesExact() - m0).toBeCloseTo(1, 6);
    t += 58_000; // a real minute in all
    expect(c.minutesExact() - m0).toBeCloseTo(30, 5);
  });

  it('?clock=20 runs 20 times faster: a whole game day in 2.4 real minutes', () => {
    let t = REAL;
    const c = new GameClock(() => t);
    c.syncServer(REAL + 777, REAL);
    const m0 = c.minutesExact();
    c.configure(parseClockParams('?clock=20', true));
    t += 60_000;
    // 60 s real = 30 game minutes at 1x, 600 at 20x
    const d = (c.minutesExact() - m0 + 1440) % 1440;
    expect(d).toBeCloseTo(600, 4);
    // a whole game day passes in 48/20 = 2.4 real minutes
    const day0 = c.day();
    t += 2.4 * 60_000;
    expect(c.day()).toBe(day0 + 1);
  });

  it('speeding up carries on from the current reading and going back to 1x keeps it', () => {
    let t = REAL;
    const c = new GameClock(() => t);
    c.setSpeed(10);
    t += 12_000; // 120 s of clock
    const m = c.minutesExact();
    c.setSpeed(1);
    const at = c.now();
    t += 2000;
    expect(c.now() - at).toBe(2000);
    expect(c.minutesExact()).toBeCloseTo((m + 1) % 1440, 5);
  });

  it('exactMinutes is the smooth version of gameMinutes', () => {
    for (const k of [0, 1234, 999_999, GAME_DAY_MS - 1, GAME_DAY_MS * 3 + 17]) {
      expect(Math.floor(exactMinutes(REAL + k))).toBe(gameMinutes(REAL + k));
    }
    expect(exactMinutes(msAt(5, 1050))).toBeCloseTo(1050, 3);
  });
});

describe('time and weather pins', () => {
  it('parseTimeOfDay accepts HH:MM only', () => {
    expect(parseTimeOfDay('19:30')).toBe(1170);
    expect(parseTimeOfDay('7:05')).toBe(425);
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('12:60')).toBeNull();
    expect(parseTimeOfDay('noon')).toBeNull();
    expect(parseTimeOfDay(null)).toBeNull();
  });

  it('?time freezes the clock at that minute, ?time + ?clock runs from there', () => {
    let t = REAL;
    const c = new GameClock(() => t);
    c.setTime(1170);
    expect(c.minutes()).toBe(1170);
    t += 600_000;
    expect(c.minutes()).toBe(1170);
    c.setSpeed(20);
    t += 6_000; // 6 s real at 20x = 120 s = 60 game minutes
    expect(c.minutes()).toBe(1230);
    c.setTime(null);
    expect(c.minutes()).not.toBeNaN();
  });

  it('a weather pin wins over the daily roll and can be cleared', () => {
    const c = new GameClock(() => REAL);
    c.setWeather('chuva');
    expect(c.weather()).toBe('chuva');
    c.setWeather(null);
    expect(c.weather()).toBe(weatherAt(c.now()));
  });

  it('URL params are ignored unless dev', () => {
    const q = '?clock=20&time=19:30&weather=garoa';
    expect(parseClockParams(q, false)).toEqual({ speed: 1, time: null, weather: null });
    expect(parseClockParams(q, true)).toEqual({ speed: 20, time: 1170, weather: 'garoa' });
    expect(parseClockParams('?clock=0&weather=hail&time=99:99', true)).toEqual({ speed: 1, time: null, weather: null });
    expect(parseClockParams('?clock=100000', true).speed).toBe(1);
  });

  it('frozen time stays on the same game day as the clock', () => {
    const c = new GameClock(() => REAL);
    const day = gameDay(c.now());
    c.setTime(60);
    expect(c.day()).toBe(day);
  });
});
