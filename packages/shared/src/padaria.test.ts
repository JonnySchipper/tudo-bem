import { describe, expect, it } from 'vitest';
import { PRICES } from './carlos.js';
import { mgItemById } from './meveum.js';
import { COUNTER_MENU, COUNTER_ON_REQUEST, counterMenu, counterOrderLine, counterSells } from './padaria.js';
import { RECADOS } from './recados.js';

describe('the padaria counter menu', () => {
  it('the on-request items are exactly the priced padaria items outside the base menu', () => {
    const priced = Object.keys(PRICES).filter((id) => (PRICES[id] ?? 0) > 0);
    expect([...COUNTER_ON_REQUEST].sort()).toEqual(priced.filter((id) => !(COUNTER_MENU as readonly string[]).includes(id)).sort());
    for (const id of COUNTER_ON_REQUEST) expect(mgItemById(id), id).toBeTruthy();
    expect(counterOrderLine('pastel').pt).toMatch(/pastel/);
  });

  it('every favor that asks the baker for something can be ordered while it is active', () => {
    for (const r of RECADOS) {
      r.steps.forEach((step, i) => {
        if (step.kind !== 'pedir' || (step.npc !== 'carlos' && step.npc !== 'graca')) return;
        const active = [{ id: r.id, step: i }];
        expect(counterMenu(active), `${r.id} step ${i}`).toContain(step.itemId);
        expect(counterSells(step.itemId, active), `${r.id} step ${i}`).toBe(true);
      });
    }
  });

  it('the base menu is always sold, the pastel only while a favor asks for it', () => {
    for (const id of COUNTER_MENU) expect(counterSells(id, undefined), id).toBe(true);
    expect(counterSells('pastel', undefined)).toBe(false);
    expect(counterMenu(undefined)).not.toContain('pastel');
    expect(counterMenu([{ id: 'julia_pastel_pra_nanda', step: 0 }])).toEqual(['coxinha', 'cafe', 'pastel']);
    expect(counterSells('bolo', [{ id: 'julia_pastel_pra_nanda', step: 0 }])).toBe(false);
  });
});
