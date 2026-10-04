/**
 * The padaria counter: one way to order. You click the baker (Seu Carlos by day, Dona Graça at night), pick what you want, pay in
 * virtual RV, and carry it out in your hand like the praça snacks. It also lands in the bag for the recados ("Leva um café com leite
 * pra Nanda"). Coxinha and café are always on the menu; anything an errand asks the baker for is added. Pastel will come from the feira.
 */
import { PRICES } from './carlos.js';
import { OPENERS, linePt, lineEn } from './meveum.js';
import { recadoById, type ActiveRecado } from './recados.js';
import type { Bilingual } from './types.js';

export const COUNTER_MENU = ['coxinha', 'cafe', 'cafe_com_leite', 'pao_na_chapa', 'suco_de_laranja', 'agua'] as const;
export type CounterItemId = (typeof COUNTER_MENU)[number];

/** Always offered. */
export const COUNTER_ALWAYS: readonly CounterItemId[] = ['coxinha', 'cafe'];

export const isCounterItem = (id: unknown): id is CounterItemId => typeof id === 'string' && (COUNTER_MENU as readonly string[]).includes(id);

export const counterPrice = (id: CounterItemId): number => PRICES[id] ?? 0;

/** What you say to order it: "Me vê uma coxinha." (the same opener the Correria customers use). */
export function counterOrderLine(id: CounterItemId): Bilingual {
  const line = { itemId: id, qty: 1 };
  const opener = OPENERS[3];
  return { pt: opener.pt(linePt(line)), en: opener.en(lineEn(line)) };
}

/** The menu to show: coxinha and café, plus what an active errand wants ordered at the padaria, in menu order. */
export function counterMenu(active: readonly ActiveRecado[] | undefined): CounterItemId[] {
  const want = new Set<CounterItemId>(COUNTER_ALWAYS);
  for (const a of active ?? []) {
    const step = recadoById(a.id)?.steps[a.step];
    if (step?.kind === 'pedir' && (step.npc === 'carlos' || step.npc === 'graca') && isCounterItem(step.itemId)) want.add(step.itemId);
  }
  return COUNTER_MENU.filter((id) => want.has(id));
}
