/**
 * Pinned game clock for the e2e / screenshot scripts (Phase 10).
 *
 * The game clock is real time (1 game day = 48 real minutes), so NPC schedules, the feira hours, greetings and the sky depend on when you run
 * the test. A pinned server is one started with `TB_TEST_CLOCK_OFFSET_MIN=<n>` so the game reads a known hour when the run starts
 * (`node scripts/lib/clock-pin.mjs 510` prints `n` for 08:30), or with `TB_TEST_CLOCK_CONTROL=1`, which lets a script set the hour itself
 * (`POST /__test/clock?min=510`; `pnpm e2e:all` and the CI jobs do this). The hour then still advances 1 game minute per 2 real seconds, so each
 * script pins its own hour right before it starts.
 *
 * `requirePinnedClock(base, { min, max })` reads `/healthz`, tries to set the hour when the server allows it and otherwise fails fast with the
 * exact environment to start the server with. `assertPageClock(page, ...)` repeats the check against `__tb.clock` once the page is in the world.
 * `jumpClock(base, minute)` skips ahead to an hour a script would otherwise wait for in real time.
 */
const GAME_DAY_MS = 48 * 60 * 1000;
const CLOCK_OFFSET_MS = 17 * 2 * 60 * 1000;

/** Default daytime pin: 08:30 (Seu Carlos 06-22, Nanda 08-20, the feira open 06-13). */
export const DAY_MIN = 8 * 60 + 30;
/** 15:40: stalls folded, Nanda out, the baker still Seu Carlos. */
export const AFTERNOON_MIN = 15 * 60 + 40;

export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m) % 60).padStart(2, '0')}`;

/** Real minutes to add to the game clock (`TB_TEST_CLOCK_OFFSET_MIN`) so it reads `minute` (0..1439) right now. */
export function offsetMinFor(minute, now = Date.now()) {
  const target = (minute / 1440) * GAME_DAY_MS;
  const ms = (((target - ((now + CLOCK_OFFSET_MS) % GAME_DAY_MS)) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  return Number((ms / 60000).toFixed(4));
}

const inWindow = (m, min, max) => m >= min && m <= max;

/**
 * Make sure the server at `base` reads between `min` and `max` game minutes (and will for `needMin` more game minutes). Sets the hour to
 * `target` (default: the window's start + a few minutes of margin) when the server has `TB_TEST_CLOCK_CONTROL=1`; otherwise throws with
 * a message that says how to start a pinned server. Returns the game minute.
 */
export async function requirePinnedClock(base, { min = DAY_MIN - 15, max = DAY_MIN + 90, target = DAY_MIN, label = 'daytime' } = {}) {
  const root = new URL(base).origin;
  const read = async () => {
    const r = await fetch(`${root}/healthz`);
    const j = await r.json();
    return typeof j.gameMinute === 'number' ? j.gameMinute : null;
  };
  const cur = await read();
  const t = Math.max(min, Math.min(max, target));
  // a server with TB_TEST_CLOCK_CONTROL=1 is always re-pinned (deterministic start); any other server must already read inside the window
  let set = null;
  try {
    const r = await fetch(`${root}/__test/clock?min=${Math.round(t)}`, { method: 'POST' });
    if (r.ok) set = (await r.json()).gameMinute;
  } catch {
    /* fall through */
  }
  if (typeof set === 'number') {
    console.log(`  · game clock was ${cur === null ? '?' : hhmm(cur)}, pinned to ${hhmm(set)} (${label})`);
    return set;
  }
  if (cur !== null && inWindow(cur, min, max)) return cur;
  const off = offsetMinFor(Math.round(t));
  throw new Error(
    `The game clock reads ${cur === null ? 'an unknown time (old server?)' : hhmm(cur)}, but this script needs ${hhmm(min)}-${hhmm(max)} (${label}).\n` +
      `  Start the server with a pinned clock, for example\n` +
      `    TB_TEST_CLOCK_OFFSET_MIN=${off} TB_TEST_OFFER=carlos_cafe_pra_nanda TB_TEST_ROLL=1 pnpm start      (reads about ${hhmm(Math.round(t))} right now; use it within a few minutes)\n` +
      `  or let the script set the hour itself:  TB_TEST_CLOCK_CONTROL=1 pnpm start\n` +
      `  (pnpm e2e:all starts a server like that for you; \`node scripts/lib/clock-pin.mjs <HH:MM>\` prints the offset for any hour.)`,
  );
}

/**
 * Skip ahead to `minute` instead of waiting for it in real time, when the server has `TB_TEST_CLOCK_CONTROL=1` (the server pushes the new sky
 * to the pages already in the world). Never goes back: a clock already at or past `minute` is left alone. Returns whether it jumped; on any
 * other server it does nothing and the caller's wait for the hour still works, just slower.
 */
export async function jumpClock(base, minute) {
  const root = new URL(base).origin;
  try {
    const cur = (await (await fetch(`${root}/healthz`)).json()).gameMinute;
    if (typeof cur !== 'number' || cur >= minute) return false;
    const r = await fetch(`${root}/__test/clock?min=${Math.round(minute)}`, { method: 'POST' });
    if (!r.ok) return false;
    console.log(`  · game clock ${hhmm(cur)} -> ${hhmm((await r.json()).gameMinute)} (jumped, not waited)`);
    return true;
  } catch {
    return false;
  }
}

/** Same check from inside the page (`__tb.clock`), for after the player is in the world. */
export async function assertPageClock(page, { min, max, label = 'daytime' }) {
  const m = await page.evaluate(() => window.__tb.clock.minutes());
  if (!inWindow(m, min, max)) {
    throw new Error(`Game clock (__tb.clock) reads ${hhmm(m)}, expected ${hhmm(min)}-${hhmm(max)} (${label}). Pin the server clock: see scripts/lib/clock-pin.mjs.`);
  }
  return m;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('clock-pin.mjs')) {
  const arg = process.argv[2] ?? '08:30';
  const [h, m = '0'] = arg.split(':');
  console.log(offsetMinFor(Number(h) * 60 + Number(m)));
}
