import type { ClientMsg, ServerMsg } from '@tudobem/shared';

type Handler = (m: ServerMsg) => void;

export type NetStatus = 'open' | 'closed' | 'connecting' | 'failed' | 'replaced' | 'idle' | 'loggedOut';

/** Server close codes that mean "don't reconnect on your own" (apps/server/src/app.ts CLOSE_CODES). */
const TERMINAL_CLOSE: Record<number, NetStatus> = { 4000: 'replaced', 4001: 'idle', 4002: 'loggedOut', 4003: 'idle' };

export interface NetLike {
  readonly solo: boolean;
  onStatus: (s: NetStatus) => void;
  onOpen: () => void;
  connect(): void;
  /** Player asked to try again after a drop or after this tab was replaced. */
  retry(): void;
  send(m: ClientMsg): void;
  on(h: Handler): () => boolean;
}

/** How long a socket may sit in CONNECTING before we treat it as dead. */
export const NET_CONNECT_TIMEOUT_MS = 8_000;
/** Failed sockets before the automatic loop stops and the UI asks the player to retry. */
export const NET_MAX_RETRIES = 4;

const WS_CONNECTING = 0;
const WS_OPEN = 1;

export interface NetSocket {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  send(data: string): void;
  close(): void;
}

export class Net implements NetLike {
  readonly solo = false;
  private ws: NetSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: ClientMsg[] = [];
  private attempts = 0;
  private generation = 0;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  onStatus: (s: NetStatus) => void = () => {};
  onOpen: () => void = () => {};

  constructor(
    private url: string,
    private createSocket: (url: string) => NetSocket = (u) => new WebSocket(u) as unknown as NetSocket,
  ) {}

  connect() {
    if (this.ws && (this.ws.readyState === WS_CONNECTING || this.ws.readyState === WS_OPEN)) return;
    this.attempts = 0;
    this.begin();
  }

  retry() {
    this.attempts = 0;
    this.abandon();
    this.begin();
  }

  /** Drop the current socket without letting its close event drive another reconnect. */
  private abandon() {
    this.generation += 1;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* already gone */
    }
  }

  private clearTimers() {
    clearTimeout(this.connectTimer);
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.connectTimer = undefined;
    this.retryTimer = undefined;
    this.pingTimer = undefined;
  }

  private begin() {
    const gen = ++this.generation;
    this.clearTimers();
    this.onStatus('connecting');
    const ws = this.createSocket(this.url);
    this.ws = ws;
    this.connectTimer = setTimeout(() => {
      if (gen !== this.generation) return;
      if (ws.readyState !== WS_OPEN) ws.close();
    }, NET_CONNECT_TIMEOUT_MS);
    ws.onopen = () => {
      if (gen !== this.generation) {
        try {
          ws.close();
        } catch {
          /* stale socket */
        }
        return;
      }
      clearTimeout(this.connectTimer);
      this.attempts = 0;
      this.onStatus('open');
      this.onOpen();
      // A queued tray submit belongs to the socket that died. Replaying it can burn the
      // repeat grace or advance a ticket the player can no longer see. The server resyncs.
      const queued = this.queue.splice(0).filter((m) => m.t !== 'mg');
      for (const m of queued) this.send(m);
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      if (gen !== this.generation) return;
      let msg: ServerMsg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.handlers.forEach((h) => h(msg));
    };
    ws.onclose = (e) => {
      // A socket we already replaced must not paint "Reconectando…" over the live one,
      // and a 4000 on that stale socket must not cancel the new connection.
      if (gen !== this.generation) return;
      this.clearTimers();
      this.ws = null;
      const terminal = TERMINAL_CLOSE[e.code];
      if (terminal) {
        this.onStatus(terminal);
        return;
      }
      this.attempts += 1;
      if (this.attempts >= NET_MAX_RETRIES) {
        this.onStatus('failed');
        return;
      }
      this.onStatus('closed');
      const delay = Math.min(8_000, 500 * 2 ** (this.attempts - 1));
      this.retryTimer = setTimeout(() => {
        if (gen !== this.generation) return;
        this.begin();
      }, delay);
    };
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WS_OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'ping' && m.t !== 'hello' && m.t !== 'active') this.queue.push(m);
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
}

export function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}
