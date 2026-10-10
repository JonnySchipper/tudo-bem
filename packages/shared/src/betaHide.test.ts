import { describe, expect, it } from 'vitest';
import { BETA_HIDE, PADARIA_DOOR_METER_MIN_RV, padariaDoorShowsMeter, padariaOwnerMenu } from './padariaEconomy.js';
import { upgradeSizeCostRv } from './playerPadaria.js';
import { showsAcademyLookEditor, showsFundarAcademy } from './playerAcademy.js';

describe('beta hide flag (D3)', () => {
  it('hides size 3, gear and décor from the owner menu while keeping the rules', () => {
    expect(BETA_HIDE.padariaSize3 && BETA_HIDE.padariaGear && BETA_HIDE.padariaDecor).toBe(true);
    expect(padariaOwnerMenu()).toEqual({ sizes: [1, 2], gear: false, decor: false });
    expect(upgradeSizeCostRv(3)).toBeGreaterThan(0);
  });
  it('brings them back when the flag is off', () => {
    expect(padariaOwnerMenu({ ...BETA_HIDE, padariaSize3: false, padariaGear: false, padariaDecor: false })).toEqual({ sizes: [1, 2, 3], gear: true, decor: true });
  });
  it('hides the academy crest and gi editor', () => {
    expect(showsAcademyLookEditor()).toBe(false);
    expect(showsAcademyLookEditor({ ...BETA_HIDE, academyLook: false })).toBe(true);
  });
});

describe('endgame doors wait (D3)', () => {
  it('the padaria meter opens at 300 RV, or for an owner', () => {
    expect(padariaDoorShowsMeter(PADARIA_DOOR_METER_MIN_RV - 1, false)).toBe(false);
    expect(padariaDoorShowsMeter(PADARIA_DOOR_METER_MIN_RV, false)).toBe(true);
    expect(padariaDoorShowsMeter(0, true)).toBe(true);
  });
  it('the Fundar academia block opens at purple belt', () => {
    expect(showsFundarAcademy(undefined)).toBe(false);
    expect(showsFundarAcademy({ wins: 20 })).toBe(false); // blue
    expect(showsFundarAcademy({ wins: 80 })).toBe(true); // purple
    expect(showsFundarAcademy({ wins: 140 })).toBe(true); // brown
  });
});
