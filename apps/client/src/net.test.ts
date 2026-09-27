import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NET_CONNECT_TIMEOUT_MS, NET_MAX_RETRIES, Net, type NetSocket, type NetStatus } from './net';

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
    });
    net.onStatus = (s) => statuses.push(s);
    net.onOpen = () => net.send({ t: 'hello', token: 'tok' });
    return { net, sockets, statuses };
  }

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

  it('gives up when a connecting socket never opens, instead of overlaying forever', () => {
    const { net, sockets, statuses } = harness();
    net.connect();
    for (let i = 0; i < NET_MAX_RETRIES; i++) {
      expect(sockets).toHaveLength(i + 1);
      vi.advanceTimersByTime(NET_CONNECT_TIMEOUT_MS);
      if (i < NET_MAX_RETRIES - 1) vi.advanceTimersByTime(500 * 2 ** i);
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
    net.send({ t: 'mg', action: 'timeout' });
    net.send({ t: 'move', x: 1, y: 2 });
    vi.advanceTimersByTime(500);
    sockets[1]!.open();
    expect(sockets[1]!.sent.map((raw) => JSON.parse(raw).t)).toEqual(['hello', 'move']);
  });
});
