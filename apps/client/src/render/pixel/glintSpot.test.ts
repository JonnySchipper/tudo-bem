import { describe, expect, it } from 'vitest';
import { glintSpot } from './props';

const box = { x0: 64, y0: 128, x1: 128, y1: 144 };

describe('glintSpot', () => {
  it('sits on the top of the sign board standing on the footprint (the arrivals hall sign)', () => {
    const at = glintSpot(box, [
      { key: 'aero/vidraca', rect: { x0: 64, y0: 83, x1: 80, y1: 129 } },
      { key: 'aero/placa_desembarque', rect: { x0: 64, y0: 103, x1: 128, y1: 145 } },
    ]);
    expect(at).toEqual({ x: 96, y: 106 });
  });
  it('falls back to the top of the footprint box', () => {
    expect(glintSpot(box, [])).toEqual({ x: 96, y: 131 });
  });
  it('ignores a building front and art that is not under the sign', () => {
    const arts = [
      { key: 'facades/padaria', rect: { x0: 64, y0: 1, x1: 128, y1: 145 } },
      { key: 'aero/placa_x', rect: { x0: 300, y0: 103, x1: 364, y1: 145 } },
      { key: 'aero/placa_y', rect: { x0: 64, y0: 40, x1: 128, y1: 90 } },
    ];
    expect(glintSpot(box, arts)).toEqual({ x: 96, y: 131 });
  });
});
