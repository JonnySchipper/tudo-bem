import type { ClientMsg, ServerMsg } from '@tudobem/shared';

type Handler = (m: ServerMsg) => void;

export interface NetLike {
  readonly solo: boolean;
  onStatus: (s: 'open' | 'closed' | 'connecting') => void;
  onOpen: () => void;
  connect(): void;
  send(m: ClientMsg): void;
  on(h: Handler): () => boolean;
}

export class Net implements NetLike {
  readonly solo = false;
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: ClientMsg[] = [];
  private retry = 0;
  private pingTimer: number | undefined;
  onStatus: (s: 'open' | 'closed' | 'connecting') => void = () => {};
  onOpen: () => void = () => {};

  constructor(private url: string) {}

  connect() {
    this.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('open');
      this.onOpen();
      for (const m of this.queue.splice(0)) this.send(m);
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.handlers.forEach((h) => h(msg));
    };
    ws.onclose = (e) => {
      clearInterval(this.pingTimer);
      this.onStatus('closed');
      if (e.code === 4000) return; // replaced by another tab
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'ping' && m.t !== 'hello') this.queue.push(m);
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
