import { describe, expect, it } from 'vitest';
import { nextMgClock, type MgClock } from './meveum-clock.js';

const fresh = (): MgClock => ({ orderAt: 0, timeoutNotBefore: 0, repeatArmed: false });

describe('Me vê um retry clock', () => {
  it('starts a full clock on a new ticket', () => {
    const next = nextMgClock(fresh(), { repeat: false, round: 0, pt: 'Me vê um bolo.' }, null, 5_000);
    expect(next.hold).toBe(false);
    expect(next.clock).toEqual({ orderAt: 5_000, timeoutNotBefore: 0, repeatArmed: false });
  });

  it('does not restart the clock on an early-timeout resync', () => {
    const prev: MgClock = { orderAt: 1_000, timeoutNotBefore: 0, repeatArmed: false };
    const next = nextMgClock(prev, { resync: true, repeat: false, round: 0, pt: 'Me vê um bolo.' }, { round: 0, pt: 'Me vê um bolo.' }, 2_000);
    expect(next.hold).toBe(true);
    expect(next.clock.orderAt).toBe(1_000);
    expect(next.clock.timeoutNotBefore).toBe(3_000);
    expect(next.clock.repeatArmed).toBe(false);
  });

  it('re-arms when the retry arrives as a resync on an already-empty bar', () => {
    const prev: MgClock = { orderAt: 1_000, timeoutNotBefore: 0, repeatArmed: false };
    const msg = { resync: true, repeat: true, round: 2, pt: 'Me vê um bolo pra comer aqui.' };
    const next = nextMgClock(prev, msg, { round: 2, pt: msg.pt }, 30_000);
    expect(next.hold).toBe(false);
    expect(next.clock).toEqual({ orderAt: 30_000, timeoutNotBefore: 0, repeatArmed: true });
  });

  it('does not re-arm again on a later retry resync', () => {
    const prev: MgClock = { orderAt: 30_000, timeoutNotBefore: 0, repeatArmed: true };
    const msg = { resync: true, repeat: true, round: 2, pt: 'Me vê um bolo pra comer aqui.' };
    const next = nextMgClock(prev, msg, { round: 2, pt: msg.pt }, 31_000);
    expect(next.hold).toBe(true);
    expect(next.clock.orderAt).toBe(30_000);
    expect(next.clock.repeatArmed).toBe(true);
  });

  it('arms the next pedido from scratch', () => {
    const prev: MgClock = { orderAt: 30_000, timeoutNotBefore: 500, repeatArmed: true };
    const next = nextMgClock(prev, { repeat: false, round: 3, pt: 'Me vê um café.' }, { round: 2, pt: 'Me vê um bolo pra comer aqui.' }, 40_000);
    expect(next.hold).toBe(false);
    expect(next.clock).toEqual({ orderAt: 40_000, timeoutNotBefore: 0, repeatArmed: false });
  });
});
