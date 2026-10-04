/**
 * Walking between the open-air areas in the browser scripts (Vila Ipê was split into rua_leste / rua / praca / feira; the street is two areas, the academia and escola doors are on rua_leste, the padaria and kitnet doors on rua): `goArea(page, 'rua')` walks to the
 * nearest edge portal toward the target area and waits for the server to bring you through, hop after hop. Interiors are reached with
 * `window.__tb.interact({ portal })` from the half of the street their door is on (`goArea(page, 'rua_leste')` first for the academia and the escola).
 */
import { sleep, waitFor } from './meveum-play.mjs';

const AREA_EDGES = { rua_leste: ['rua'], rua: ['rua_leste', 'praca'], praca: ['rua', 'feira'], feira: ['praca'] };

/** The chain of areas from `from` to `to` (inclusive), e.g. feira -> praca -> rua. */
export function areaRoute(from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const r = queue.shift();
    for (const n of AREA_EDGES[r] ?? []) if (!prev.has(n)) (prev.set(n, r), queue.push(n));
  }
  if (!prev.has(to)) return null;
  const out = [to];
  while (out[0] !== from) out.unshift(prev.get(out[0]));
  return out;
}

/** Walk off the edge of the current area toward `target` until you are in it. Resolves when `game.room.room === target`. */
export async function goArea(page, target, { timeout = 30_000 } = {}) {
  for (let hop = 0; hop < 5; hop++) {
    const cur = await page.evaluate(() => window.__tb.game.room?.room);
    if (cur === target) return;
    const route = areaRoute(cur, target);
    if (!route) throw new Error(`no walk from ${cur} to ${target}`);
    const next = route[1];
    // the middle tile of the opening to `next`, as the client knows the map
    const tile = await page.evaluate(([cur, next]) => {
      const ps = window.__tb.rooms[cur].portals.filter((p) => p.edge && p.to === next);
      const mid = ps[Math.floor((ps.length - 1) / 2)];
      return { x: mid.x, y: mid.y };
    }, [cur, next]);
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [tile.x, tile.y]);
    await waitFor(page, (id) => window.__tb.game.room?.room === id, next, timeout, `walk off the edge into ${next}`);
    await sleep(500);
  }
  const now = await page.evaluate(() => window.__tb.game.room?.room);
  if (now !== target) throw new Error(`could not reach ${target}, stuck in ${now}`);
}
