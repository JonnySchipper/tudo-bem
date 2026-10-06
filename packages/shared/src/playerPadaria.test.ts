import { describe, expect, it } from 'vitest';
import {
  PADARIA_FOUNDER_HAT,
  displayFounderHat,
  fundarCostRv,
  ownedCorreriaMenuIds,
  padariaDoorState,
  isPadariaDoorRoom,
  padariaIdFromInstance,
  padariaInstanceId,
  upgradeSizeCostRv,
  validatePadariaName,
} from './playerPadaria.js';
import { normalizePadaria } from './playerPadaria.js';

describe('player padaria Fundar', () => {
  it('fundar costs 900 RV and the door meter tracks coins', () => {
    expect(fundarCostRv()).toBe(900);
    const door = padariaDoorState(450, null);
    expect(door.goalRv).toBe(900);
    expect(door.canFundar).toBe(false);
    expect(padariaDoorState(900, null).canFundar).toBe(true);
  });

  it('accepts Fundar with zero shifts (RV only gate)', () => {
    expect(validatePadariaName('Padaria da Bia').ok).toBe(true);
    expect(padariaDoorState(900, null).canFundar).toBe(true);
  });

  it('door cofre works on rua, praça and shared padaria only', () => {
    expect(isPadariaDoorRoom('rua', 'rua#1')).toBe(true);
    expect(isPadariaDoorRoom('praca', 'praca#1')).toBe(true);
    expect(isPadariaDoorRoom('padaria', 'padaria#1')).toBe(true);
    expect(isPadariaDoorRoom('padaria', 'padaria@abc12345')).toBe(false);
    expect(isPadariaDoorRoom('kitnet', 'kitnet#1')).toBe(false);
  });

  it('instance ids use padaria@ prefix', () => {
    const id = 'abc12345';
    expect(padariaInstanceId(id)).toBe('padaria@abc12345');
    expect(padariaIdFromInstance('padaria@abc12345')).toBe(id);
    expect(padariaIdFromInstance('padaria#1')).toBeNull();
  });

  it('size 1 menu is café and pão only; size 3 adds restaurant ids', () => {
    const base = normalizePadaria({
      id: 'abc12345',
      name: 'Test',
      ownerId: 'deadbeef',
      size: 1,
      sweets: {},
      createdAt: 1,
    })!;
    expect(ownedCorreriaMenuIds(base)).toEqual(['cafe', 'pao']);
    const big = { ...base, size: 3 as const };
    expect(ownedCorreriaMenuIds(big)).toContain('feijoada');
    expect(ownedCorreriaMenuIds(big)).toContain('prato_feito');
  });

  it('upgrade RV matches MASTER plan', () => {
    expect(upgradeSizeCostRv(2)).toBe(1500);
    expect(upgradeSizeCostRv(3)).toBe(3000);
  });

  it('founder hat shows in social spaces but respects kitnet mirror choice', () => {
    expect(displayFounderHat(null, true, 'praca', false)).toBe(PADARIA_FOUNDER_HAT);
    expect(displayFounderHat(null, true, 'kitnet', true)).toBeNull();
    expect(displayFounderHat('bone_verde', true, 'kitnet', true)).toBe('bone_verde');
  });
});
