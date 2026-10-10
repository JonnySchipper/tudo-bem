import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_RESTART, NET_CONNECT_TIMEOUT_MS, NET_MAX_RETRIES, NET_RETRY_MAX_MS, Net, reconnectDelay, withTz, type NetSocket, type NetStatus } from './net';

class FakeSocket implements NetSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {}
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    if (this.readyState === 3) return;
    this.serverClose(1000);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('Net reconnect', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function harness() {
    const sockets: FakeSocket[] = [];
    const statuses: NetStatus[] = [];
    const net = new Net('ws://padaria', () => {
      const s = new FakeSocket('ws://padaria');
      sockets.push(s);
      return s;
    }, () => 0);
    net.onStatus = (s) => statuses.push(s);
    net.onOpen = () => net.send({ t: 'hello', token: 'tok' });
    return { net, sockets, statuses };
  }

  it('the hello carries the browser offset, so the server counts caps on the player day (D1)', () => {
    const { net, sockets } = harness();
    net.connect();
    sockets[0]!.open();
    const hello = JSON.parse(sockets[0]!.sent[0]!);
    expect(hello).toEqual({ t: 'hello', token: 'tok', tz: -new Date().getTimezoneOffset() || 0 });
    expect(withTz({ t: 'hello' }, -180)).toEqual({ t: 'hello', tz: -180 });
    expect(withTz({ t: 'hello', tz: 60 }, -180)).toEqual({ t: 'hello', tz: 60 });
    expect(withTz({ t: 'ping' }, -180)).toEqual({ t: 'ping' });
  });

  it('ignores a stale close so a live socket is not stuck on Reconectando', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    expect(statuses.at(-1)).toBe('open');

    sockets[0]!.serverClose(1006);
    expect(statuses.at(-1)).toBe('closed');
    vi.advanceTimersByTime(500);
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();
    expect(statuses.at(-1)).toBe('open');

    // The dead socket reports "replaced" after the new one is already up.
    sockets[0]!.onclose?.({ code: 4000 });
    expect(statuses.at(-1)).toBe('open');
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
  });

  it('stops on 4000 for the live socket and lets the player join again', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    sockets[0]!.serverClose(4000);
    expect(statuses.at(-1)).toBe('replaced');
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);

    net.retry();
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();
    expect(statuses.at(-1)).toBe('open');
    expect(sockets[1]!.sent.map((raw) => JSON.parse(raw).t)).toEqual(['hello']);
  });

  it('stops after an idle kick (4001) or logout (4002) and only comes back when the player asks', () => {
    for (const [code, status] of [
      [4001, 'idle'],
      [4002, 'loggedOut'],
    ] as const) {
      const { net, sockets, statuses } = harness();
      net.connect();
      sockets[0]!.open();
      sockets[0]!.serverClose(code);
      expect(statuses.at(-1)).toBe(status);
      net.send({ t: 'active' });
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(1);

      net.retry();
      sockets[1]!.open();
      expect(statuses.at(-1)).toBe('open');
      expect(sockets[1]!.sent.map((raw) => JSON.parse(raw).t)).toEqual(['hello']);
    }
  });

  it('gives up when a connecting socket never opens, instead of overlaying forever', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    for (let i = 0; i < NET_MAX_RETRIES; i++) {
      expect(sockets).toHaveLength(i + 1);
      vi.advanceTimersByTime(NET_CONNECT_TIMEOUT_MS);
      if (i < NET_MAX_RETRIES - 1) vi.advanceTimersByTime(reconnectDelay(i + 1, () => 0));
    }
    expect(statuses.at(-1)).toBe('failed');
    expect(sockets).toHaveLength(NET_MAX_RETRIES);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(NET_MAX_RETRIES);

    net.retry();
    expect(sockets).toHaveLength(NET_MAX_RETRIES + 1);
    sockets.at(-1)!.open();
    expect(statuses.at(-1)).toBe('open');
  });

  it('drops a queued tray action on reconnect and still sends the hello', () => {
    const { net, sockets } = harness();
    net.connect();
    sockets[0]!.open();
    sockets[0]!.serverClose(1006);
    net.send({ t: 'mg', action: 'sync' });
    net.send({ t: 'move', x: 1, y: 2 });
    vi.advanceTimersByTime(500);
    sockets[1]!.open();
    expect(sockets[1]!.sent.map((raw) => JSON.parse(raw).t)).toEqual(['hello', 'move']);
  });

  it('does not treat a phone camera pause as a dead socket', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    expect(statuses.at(-1)).toBe('open');

    // The camera app suspends the browser. The live socket stays the session.
    net.setPageHidden(true);
    vi.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.readyState).toBe(1);
    expect(statuses.at(-1)).toBe('open');

    net.setPageHidden(false);
    expect(sockets).toHaveLength(1);
    expect(JSON.parse(sockets[0]!.sent.at(-1)!).t).toBe('ping');
    expect(statuses.at(-1)).toBe('open');
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('rejoins once when the socket died while the camera had the browser, without burning the retry budget', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    net.setPageHidden(true);
    sockets[0]!.serverClose(1006);
    vi.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
    expect(statuses).not.toContain('failed');
    expect(statuses).not.toContain('closed');

    net.setPageHidden(false);
    expect(statuses.at(-1)).toBe('connecting');
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();
    expect(statuses.at(-1)).toBe('open');
    expect(sockets[1]!.sent.map((raw) => JSON.parse(raw).t)).toEqual(['hello']);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
  });

  it('does not close a socket that is still opening while the page is hidden', () => {
    const { net, sockets } = harness();
    net.connect();
    net.setPageHidden(true);
    vi.advanceTimersByTime(NET_CONNECT_TIMEOUT_MS * 4);
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.readyState).toBe(0);

    net.setPageHidden(false);
    vi.advanceTimersByTime(NET_CONNECT_TIMEOUT_MS - 50);
    expect(sockets[0]!.readyState).toBe(0);
    vi.advanceTimersByTime(50);
    expect(sockets[0]!.readyState).toBe(3);
  });

  it('still stops on an idle kick that arrives while the camera is open', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    net.setPageHidden(true);
    sockets[0]!.serverClose(4001);
    expect(statuses.at(-1)).toBe('idle');
    net.setPageHidden(false);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)).toBe('idle');
  });

  it('keeps trying for about a minute or more, longer than a deploy or a cold start', () => {
    const waits = (r: number) => Array.from({ length: NET_MAX_RETRIES - 1 }, (_, i) => reconnectDelay(i + 1, () => r));
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(NET_MAX_RETRIES).toBeGreaterThanOrEqual(10);
    expect(sum(waits(0.5))).toBeGreaterThanOrEqual(60_000);
    expect(sum(waits(1))).toBeLessThanOrEqual(120_000);
    for (const r of [0, 0.3, 1]) for (const w of waits(r)) expect(w).toBeLessThanOrEqual(NET_RETRY_MAX_MS);
    // jitter: two clients do not wait the same time
    expect(reconnectDelay(4, () => 0)).toBeLessThan(reconnectDelay(4, () => 1));
  });

  it('shows "restarting" on a 1012 close and keeps reconnecting until the server is back', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    sockets[0]!.serverClose(CLOSE_RESTART);
    expect(statuses.at(-1)).toBe('restarting');
    vi.advanceTimersByTime(reconnectDelay(1, () => 0));
    expect(sockets).toHaveLength(2);
    // the new socket is refused while the machine boots: still the restart message
    sockets[1]!.serverClose(1006);
    expect(statuses.at(-1)).toBe('restarting');
    vi.advanceTimersByTime(reconnectDelay(2, () => 0));
    sockets[2]!.open();
    expect(statuses.at(-1)).toBe('open');
    sockets[2]!.serverClose(1006);
    expect(statuses.at(-1)).toBe('closed');
  });

  it('retries at once when the network comes back, even after giving up', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    sockets[0]!.open();
    sockets[0]!.serverClose(1006);
    expect(sockets).toHaveLength(1);
    net.networkOnline();
    expect(sockets).toHaveLength(2);
    for (let i = 1; i < NET_MAX_RETRIES; i++) {
      sockets.at(-1)!.serverClose(1006);
      vi.advanceTimersByTime(NET_RETRY_MAX_MS);
    }
    expect(statuses.at(-1)).toBe('failed');
    const n = sockets.length;
    net.networkOnline();
    expect(sockets).toHaveLength(n + 1);
    sockets.at(-1)!.open();
    expect(statuses.at(-1)).toBe('open');
    // an open socket ignores the event
    net.networkOnline();
    expect(sockets).toHaveLength(n + 1);
  });
});
