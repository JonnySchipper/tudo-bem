import { describe, expect, it, vi } from 'vitest';
import { animateBjjPoseCanvas, paintBjjPoseCanvas } from './bjjPoses.js';

function mockCanvas(w = 280, h = 120): HTMLCanvasElement {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx = {
    clearRect: noop,
    setTransform: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    fillRect: noop,
    fill: noop,
    stroke: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arc: noop,
    ellipse: noop,
    roundRect: noop,
    clip: noop,
    fillText: noop,
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => grad,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    setLineDash: noop,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
  const el = {
    clientWidth: w,
    clientHeight: h,
    width: 0,
    height: 0,
    dataset: {} as DOMStringMap,
    getContext: () => ctx,
  };
  return el as unknown as HTMLCanvasElement;
}

describe('bjjPoses scramble tween', () => {
  it('paints mat positions and records pose id', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    const canvas = mockCanvas();
    paintBjjPoseCanvas(canvas, 'de_pe');
    expect(canvas.dataset.pose).toBe('de_pe');
    paintBjjPoseCanvas(canvas, 'guarda_fechada');
    expect(canvas.dataset.pose).toBe('guarda_fechada');
    vi.unstubAllGlobals();
  });

  it('animate resolves when from equals to', async () => {
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      matchMedia: () => ({ matches: true }),
    });
    const canvas = mockCanvas();
    await animateBjjPoseCanvas(canvas, 'joelho', 'joelho', 300);
    expect(canvas.dataset.pose).toBe('joelho');
    vi.unstubAllGlobals();
  });
});
