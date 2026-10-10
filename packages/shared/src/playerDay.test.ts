import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acceptTz, addCalendarDays, clampTz, dayDiff, playerDay, profileDay, profileTz, viewerDay } from './playerDay.js';
import { localDay } from './escola.js';

const at = (iso: string) => Date.parse(iso);

describe('playerDay', () => {
  it('is the calendar day in the player zone, minutes east of UTC', () => {
    const t = at('2026-10-09T02:30:00.000Z');
    expect(playerDay(t, 0)).toBe('2026-10-09');
    expect(playerDay(t, -180)).toBe('2026-10-08'); // São Paulo, 23:30 the day before
    expect(playerDay(t, -240)).toBe('2026-10-08'); // New York (EDT)
    expect(playerDay(t, 540)).toBe('2026-10-09'); // Tokyo
    expect(playerDay(at('2026-10-09T15:30:00.000Z'), 540)).toBe('2026-10-10');
  });

  it('defaults to UTC and clamps offsets to real zones', () => {
    const t = at('2026-10-09T02:30:00.000Z');
    expect(playerDay(t)).toBe('2026-10-09');
    expect(playerDay(t, 99_999)).toBe(playerDay(t, 14 * 60));
    expect(playerDay(t, -99_999)).toBe(playerDay(t, -14 * 60));
    expect(clampTz('x')).toBe(0);
    expect(clampTz(Number.NaN)).toBe(0);
    expect(clampTz(-180.7)).toBe(-181);
  });

  it('is the day the Escola already counted (localDay is the same function)', () => {
    for (const tz of [-600, -180, 0, 60, 330, 840]) {
      const t = at('2026-10-09T21:15:00.000Z');
      expect(localDay(t, tz)).toBe(playerDay(t, tz));
    }
  });

  it('adds calendar days and measures gaps across month, year and US clock changes', () => {
    expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addCalendarDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addCalendarDays('bad', 3)).toBe('bad');
    expect(addCalendarDays('2026-10-09', 0)).toBe('2026-10-09');
    expect(dayDiff('2026-10-08', '2026-10-09')).toBe(1);
    expect(dayDiff('2026-10-09', '2026-10-08')).toBe(-1);
    expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('reads a profile: its stored offset, a Testes day roll on top, UTC when no offset was ever reported', () => {
    const t = at('2026-10-09T02:30:00.000Z');
    expect(profileDay({}, t)).toBe('2026-10-09');
    expect(profileDay(undefined, t)).toBe('2026-10-09');
    expect(profileDay({ escola: { tz: -180 } }, t)).toBe('2026-10-08');
    expect(profileDay({ escola: { tz: -180 }, testDayOffset: 2 }, t)).toBe('2026-10-10');
    expect(profileTz({ escola: { tz: 99_999 } })).toBe(14 * 60);
  });

  it('takes a new offset unless it would move today back', () => {
    const t = at('2026-10-09T02:30:00.000Z'); // UTC 10-09, São Paulo 10-08, Tokyo 10-09
    expect(acceptTz(t, undefined, -180)).toBe(-180);
    expect(acceptTz(t, -180, 540)).toBe(540); // 10-08 → 10-09: forward is fine
    expect(acceptTz(t, 540, -180)).toBe(540); // 10-09 → 10-08 would replay a day: keep the old zone
    expect(acceptTz(t, 0, 60)).toBe(60); // same date, new zone
    expect(acceptTz(t, 60, 0)).toBe(0);
    expect(acceptTz(t, -180, 'x')).toBe(-180);
    expect(acceptTz(t, undefined, undefined)).toBeUndefined();
    // the traveller heading west gets the new zone once its date catches up
    expect(acceptTz(at('2026-10-09T05:00:00.000Z'), 540, -180)).toBe(-180);
  });

  it('flipping the zone back and forth never rolls the day over twice', () => {
    const t = at('2026-10-09T11:00:00.000Z');
    let tz: number | undefined = -12 * 60;
    const days = new Set<string>([playerDay(t, tz)]);
    for (const next of [14 * 60, -12 * 60, 14 * 60, -12 * 60, 0]) {
      tz = acceptTz(t, tz, next);
      days.add(playerDay(t, tz));
    }
    expect(days.size).toBe(2);
  });

  it('viewerDay is the runtime zone’s own day', () => {
    const t = at('2026-10-09T02:30:00.000Z');
    expect(viewerDay(t)).toBe(playerDay(t, -new Date(t).getTimezoneOffset()));
  });
});

// ---------------------------------------------------------------- one day boundary for caps

const SHARED = __dirname;
const SERVER = join(__dirname, '../../../apps/server/src');

/** Ambience runs on the 48-minute game day or a real clock that is not a cap; the helper itself is the one place days are made. */
const SHARED_ALLOWED: Record<string, string> = {
  'playerDay.ts': 'the one day helper every cap uses',
  'clock.ts': 'ambience: the 48-minute game day',
  'weather.ts': 'ambience: the sky',
  'schedules.ts': 'ambience: NPC schedules',
};

const BANNED = [/America\/New_York/, /America\/Sao_Paulo/, /toISOString\(\)\.slice\(0,\s*10\)/, /getUTCDate/];

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

describe('one day boundary for caps', () => {
  it('no shared module outside the ambience allow-list makes its own day (New York, São Paulo, UTC slices)', () => {
    const offenders: string[] = [];
    for (const file of sources(SHARED)) {
      const rel = relative(SHARED, file).replace(/\\/g, '/');
      if (SHARED_ALLOWED[rel]) continue;
      const text = readFileSync(file, 'utf8');
      for (const re of BANNED) if (re.test(text)) offenders.push(`${rel}: ${re}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the server never reads a fixed zone or the server process zone for a day', () => {
    const offenders: string[] = [];
    for (const file of sources(SERVER)) {
      const rel = relative(SERVER, file).replace(/\\/g, '/');
      const text = readFileSync(file, 'utf8');
      if (/America\/(New_York|Sao_Paulo)/.test(text)) offenders.push(`${rel}: fixed zone`);
      // viewerDay (and its deprecated client name) read the runtime zone: right in a browser, wrong on a server
      if (/\b(viewerDay|todayEastern)\b/.test(text)) offenders.push(`${rel}: viewer day`);
    }
    expect(offenders).toEqual([]);
  });
});
