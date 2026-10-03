import { CAFE_ITEMS, CHAPA, CHAPA_ITEMS, POUR, frontOf, type CAct, type ClientMsg } from '@tudobem/shared';
import type { Session, World } from './world.js';

/** Test helpers: play the counter game through real `mg` messages (what a client sends), using the server's order as the test hook. */
export interface KitClient {
  s: Session;
  send: (m: ClientMsg) => Promise<void>;
}

export const act = (a: KitClient, x: CAct) => a.send({ t: 'mg', action: 'act', act: x });

/** Wait (in 250 ms steps) until a customer is at the counter. */
export async function waitFront(world: World, a: KitClient, adv: (ms: number) => void): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const sh = world.debugShift(a.s);
    const f = sh && frontOf(sh);
    if (!sh || f?.state === 'front') return;
    adv(250);
  }
  throw new Error('no customer came to the counter');
}

/** Build the front customer's order through the real steps (grab, chapa, pour, pack, mods). Leaves the serve to the caller. */
export async function buildFront(world: World, a: KitClient, adv: (ms: number) => void): Promise<void> {
  await waitFront(world, a, adv);
  const order = world.debugOrder(a.s)!;
  await act(a, { a: 'clear' });
  for (const l of order.lines) {
    for (let i = 0; i < l.qty; i++) {
      if (CHAPA_ITEMS.includes(l.itemId)) {
        await act(a, { a: 'chapa_put', slot: 0, item: l.itemId });
        adv(CHAPA.cookMs + 150);
        await act(a, { a: 'chapa_take', slot: 0 });
      } else if (CAFE_ITEMS.includes(l.itemId)) {
        await act(a, { a: 'pour_start', item: l.itemId });
        adv(POUR.fullMs * 0.85);
        await act(a, { a: 'pour_end' });
      } else await act(a, { a: 'grab', item: l.itemId });
    }
  }
  for (const m of order.mods) {
    if (m === 'pra_viagem') await act(a, { a: 'pack', kind: 'bag' });
    else if (m === 'pra_comer_aqui') await act(a, { a: 'pack', kind: 'plate' });
    else await act(a, { a: 'mod', id: m });
  }
}

/** Build and serve the front customer, then answer "Quanto é?" right if they ask. */
export async function serveFront(world: World, a: KitClient, adv: (ms: number) => void): Promise<void> {
  await buildFront(world, a, adv);
  await act(a, { a: 'serve' });
  const sh = world.debugShift(a.s);
  const f = sh && frontOf(sh);
  if (f?.state === 'asking') await act(a, { a: 'answer', value: f.ask!.total });
}
