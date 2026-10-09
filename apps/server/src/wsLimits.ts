/**
 * WebSocket abuse limits: a per-socket message token bucket, a per-IP concurrent connection cap, and the window a
 * new socket has to say `hello`. Normal play stays far below these: walking sends one `move` per tap or held-key
 * step, the counter game a few acts a second, and the idle ping one message every 25 s.
 */

export interface WsLimitConfig {
  /** Sustained messages per second per socket. */
  rate: number;
  /** Bucket size: how many messages a socket may send at once. */
  burst: number;
  /** Messages dropped inside `abuseWindowMs` before the socket is closed with 1008. */
  abuseDrops: number;
  abuseWindowMs: number;
  /** Concurrent sockets per client IP. */
  maxPerIp: number;
  /** A socket that has not said `hello` (or has no signed-in session) by then is closed. */
  helloTimeoutMs: number;
}

export const DEFAULT_WS_LIMITS: WsLimitConfig = {
  rate: 20,
  burst: 40,
  abuseDrops: 200,
  abuseWindowMs: 10_000,
  maxPerIp: 8,
  helloTimeoutMs: 30_000,
};

/** Close code for a socket over its limits (RFC 6455 policy violation). The client treats it as a plain drop. */
export const WS_POLICY_CLOSE = 1008;

function envNum(env: Record<string, string | undefined>, key: string): number | undefined {
  const v = Number(env[key]);
  return env[key] != null && env[key] !== '' && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Limits from the env: `TB_WS_RATE`, `TB_WS_BURST`, `TB_WS_MAX_PER_IP`, `TB_WS_HELLO_TIMEOUT_MS`.
 * Test servers (`TB_TEST_CLOCK_CONTROL=1`, never on prod) lift the per-IP cap: e2e runs open many clients from 127.0.0.1.
 */
export function readWsLimits(env: Record<string, string | undefined> = process.env): WsLimitConfig {
  const testServer = env.TB_TEST_CLOCK_CONTROL === '1';
  return {
    ...DEFAULT_WS_LIMITS,
    rate: envNum(env, 'TB_WS_RATE') ?? DEFAULT_WS_LIMITS.rate,
    burst: envNum(env, 'TB_WS_BURST') ?? DEFAULT_WS_LIMITS.burst,
    maxPerIp: envNum(env, 'TB_WS_MAX_PER_IP') ?? (testServer ? 200 : DEFAULT_WS_LIMITS.maxPerIp),
    helloTimeoutMs: envNum(env, 'TB_WS_HELLO_TIMEOUT_MS') ?? DEFAULT_WS_LIMITS.helloTimeoutMs,
  };
}

/** Token bucket for one socket. `take()` says whether to handle the message; `abusive` once drops pile up. */
export class MessageBucket {
  private tokens: number;
  private last: number;
  private drops: number[] = [];

  constructor(
    private cfg: Pick<WsLimitConfig, 'rate' | 'burst' | 'abuseDrops' | 'abuseWindowMs'>,
    private now: () => number = Date.now,
  ) {
    this.tokens = cfg.burst;
    this.last = now();
  }

  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.cfg.burst, this.tokens + ((t - this.last) / 1000) * this.cfg.rate);
    this.last = t;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    this.drops.push(t);
    while (this.drops.length && t - this.drops[0]! > this.cfg.abuseWindowMs) this.drops.shift();
    return false;
  }

  get abusive(): boolean {
    return this.drops.length >= this.cfg.abuseDrops;
  }
}

/** Live sockets per IP. `acquire` refuses past the cap; every successful acquire needs one `release`. */
export class IpConnectionCap {
  private counts = new Map<string, number>();
  constructor(private max: number) {}

  acquire(ip: string): boolean {
    const n = this.counts.get(ip) ?? 0;
    if (n >= this.max) return false;
    this.counts.set(ip, n + 1);
    return true;
  }

  release(ip: string) {
    const n = (this.counts.get(ip) ?? 0) - 1;
    if (n <= 0) this.counts.delete(ip);
    else this.counts.set(ip, n);
  }

  count(ip: string): number {
    return this.counts.get(ip) ?? 0;
  }
}
