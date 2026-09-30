import { describe, expect, it } from 'vitest';
import { uiParts, guideArrow, PANEL, BUBBLE, BUTTON } from '../../../apps/client/assets-src/custom/ui.mjs';

describe('art2 UI kit', async () => {
  const parts = await uiParts({});
  const by = Object.fromEntries(parts.map((p) => [p.key, p]));

  it('exports panel, bubble, three button states and the arrow strip', () => {
    expect(Object.keys(by).sort()).toEqual(['ui/bubble', 'ui/button', 'ui/button_hover', 'ui/button_pressed', 'ui/guide_arrow_strip', 'ui/panel']);
  });

  it('every 9-slice has insets that leave a stretchable centre', () => {
    for (const k of ['ui/panel', 'ui/bubble', 'ui/button', 'ui/button_hover', 'ui/button_pressed']) {
      const { img, meta } = by[k];
      const s = meta.slice;
      expect(img.w - s.left - s.right, k + ' width').toBeGreaterThan(0);
      expect(img.h - s.top - s.bottom, k + ' height').toBeGreaterThan(0);
      expect(meta.css).toBe(`${s.top} ${s.right} ${s.bottom} ${s.left}`);
    }
    expect([by['ui/panel'].img.w, by['ui/panel'].img.h]).toEqual([PANEL.size, PANEL.size]);
    expect([by['ui/bubble'].img.w, by['ui/bubble'].img.h]).toEqual([BUBBLE.w, BUBBLE.h]);
    expect(by['ui/button'].img.w).toBe(BUTTON.size);
  });

  it('the stretchable centre of each 9-slice is a single flat run of colour (so stretching cannot smear a pattern)', () => {
    for (const k of ['ui/panel', 'ui/bubble', 'ui/button']) {
      const { img, meta } = by[k];
      const s = meta.slice;
      const seen = new Set();
      // the middle column and middle row of the centre cell
      for (let y = s.top; y < img.h - s.bottom; y++) for (let x = s.left; x < img.w - s.right; x++) {
        const i = (y * img.w + x) * 4;
        seen.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]},${img.data[i + 3]}`);
      }
      expect(seen.size, k).toBeLessThanOrEqual(2);
    }
  });

  it('the guide arrow has 4 frames of the same size, in the strip and as an atlas sprite', async () => {
    expect(by['ui/guide_arrow_strip'].meta).toMatchObject({ frames: 4, frameW: 16 });
    expect(by['ui/guide_arrow_strip'].img.w).toBe(64);
    const [a] = await guideArrow({});
    expect(a.frames).toHaveLength(4);
    expect(new Set(a.frames.map((f) => `${f.w}x${f.h}`)).size).toBe(1);
  });
});
