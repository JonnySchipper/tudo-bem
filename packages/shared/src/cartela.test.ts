import { describe, expect, it } from 'vitest';
import {
  CARTELA_GOAL,
  CARTELA_REWARD,
  activityStampedToday,
  freshCartela,
  normalizeCartela,
  stampsOnDay,
  todayEastern,
  tryCartelaStamp,
  type CartelaState,
} from './cartela.js';
import { playerDay, viewerDay } from './playerDay.js';

const DAY = '2026-10-03';
const NEXT = '2026-10-04';

describe('cartela stamps', () => {
  it('allows one stamp per activity per player day', () => {
    let st = freshCartela();
    const first = tryCartelaStamp(st, 'tatame', DAY);
    expect(first).toMatchObject({ ok: true, paid: false });
    st = first.next;
    expect(tryCartelaStamp(st, 'tatame', DAY).ok).toBe(false);
    expect(tryCartelaStamp(st, 'balcao', DAY).ok).toBe(true);
  });

  it('does nothing on a second stamp for the same activity the same day', () => {
    const st0 = freshCartela();
    const a = tryCartelaStamp(st0, 'feira', DAY);
    expect(a.ok).toBe(true);
    const b = tryCartelaStamp(a.next, 'feira', DAY);
    expect(b.ok).toBe(false);
    expect(a.next).toEqual(b.ok ? (b as { next: CartelaState }).next : a.next);
  });

  it('allows the same activity again on a new player day', () => {
    let st = freshCartela();
    st = tryCartelaStamp(st, 'conversa', DAY).next;
    expect(activityStampedToday(st, 'conversa', DAY)).toBe(true);
    expect(tryCartelaStamp(st, 'conversa', DAY).ok).toBe(false);
    const again = tryCartelaStamp(st, 'conversa', NEXT);
    expect(again.ok).toBe(true);
    expect(again.next.stamps).toBe(2);
  });

  it('pays once on the 7th stamp and starts a fresh card at zero', () => {
    const st: CartelaState = { stamps: 6, activityDay: {} };
    const seventh = tryCartelaStamp(st, 'feira', DAY);
    expect(seventh).toMatchObject({ ok: true, paid: true, reward: CARTELA_REWARD });
    expect(seventh.next.stamps).toBe(0);
    expect(stampsOnDay(seventh.next, DAY)).toBe(1);
  });

  it('does not reset card progress at midnight (only daily activity caps)', () => {
    let st = freshCartela();
    st = tryCartelaStamp(st, 'tatame', DAY).next;
    expect(st.stamps).toBe(1);
    st = tryCartelaStamp(st, 'balcao', NEXT).next;
    expect(st.stamps).toBe(2);
    expect(st.activityDay.tatame).toBe(DAY);
    expect(st.activityDay.balcao).toBe(NEXT);
  });

  it('normalizes bad saves', () => {
    expect(normalizeCartela(undefined)).toEqual(freshCartela());
    expect(normalizeCartela({ stamps: 99, activityDay: { tatame: 'bad', balcao: '2026-01-02' } })).toEqual({
      stamps: 6,
      activityDay: { balcao: '2026-01-02' },
    });
  });

  it('todayEastern is now the viewer\'s own day (the old name the client still imports)', () => {
    const t = Date.parse('2026-10-03T03:59:00.000Z');
    expect(todayEastern(t)).toBe(viewerDay(t));
    expect(todayEastern(t)).toBe(playerDay(t, -new Date(t).getTimezoneOffset()));
  });

  it('a New York key from an older save is yesterday on the player day: the card keeps its stamps and the activity stamps again', () => {
    // stamped "tatame" late on 2026-10-02 in New York; the player is in São Paulo (UTC-3), where it is already 10-03 at 03:30 UTC
    const old = { stamps: 3, activityDay: { tatame: '2026-10-02', feira: '2026-10-02' } };
    const today = playerDay(Date.parse('2026-10-03T03:30:00.000Z'), -180);
    expect(today).toBe('2026-10-03');
    expect(stampsOnDay(old, today)).toBe(0);
    const res = tryCartelaStamp(old, 'tatame', today);
    expect(res.ok && res.next.stamps).toBe(4);
    expect(res.ok && res.next.activityDay.tatame).toBe(today);
    // a key from a zone ahead of the player's (not today's) also rolls over, never resets the card
    const ahead = tryCartelaStamp({ stamps: 5, activityDay: { balcao: '2026-10-04' } }, 'balcao', today);
    expect(ahead.ok && ahead.next.stamps).toBe(6);
  });

  it('caps at four stamps per player day across activities', () => {
    let st = freshCartela();
    for (const a of ['tatame', 'balcao', 'feira', 'conversa'] as const) {
      const r = tryCartelaStamp(st, a, DAY);
      expect(r.ok).toBe(true);
      st = r.next;
    }
    expect(stampsOnDay(st, DAY)).toBe(4);
    expect(tryCartelaStamp(st, 'tatame', NEXT).ok).toBe(true);
  });
});

describe('cartela goal constant', () => {
  it('pays on the 7th stamp', () => {
    expect(CARTELA_GOAL).toBe(7);
  });
});
