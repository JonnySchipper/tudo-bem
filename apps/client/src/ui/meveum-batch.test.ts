import { describe, expect, it } from 'vitest';
import { stationBatchSize } from './meveum-batch.js';

const base = {
  onTray: 0,
  queuedSame: 0,
  trayTotal: 0,
  queuedOther: 0,
  maxTray: 9,
};

describe('Me vê um station batch', () => {
  it('includes the unit in hand, so a double shows ×2', () => {
    expect(stationBatchSize({ ...base, lineQty: 2 })).toBe(2);
  });

  it('stays a single click for one item', () => {
    expect(stationBatchSize({ ...base, lineQty: 1 })).toBe(1);
  });

  it('preps the whole line, not line-minus-one', () => {
    expect(stationBatchSize({ ...base, lineQty: 3 })).toBe(3);
  });

  it('counts only what is still missing after the tray', () => {
    expect(stationBatchSize({ ...base, lineQty: 3, onTray: 1, trayTotal: 1 })).toBe(2);
  });

  it('does not prep past the tray cap', () => {
    expect(stationBatchSize({ ...base, lineQty: 6, trayTotal: 7, maxTray: 9 })).toBe(2);
  });
});
