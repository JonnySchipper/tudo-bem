import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESTEIRA_FRAMES, esteiraFrames } from '../../../apps/client/assets-src/custom/aeroporto.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../../../apps/client/public/pixel/manifest.json', import.meta.url), 'utf8'));

describe('the baggage carousel (aero/esteira)', () => {
  it('loops seamlessly: the frame after the last is the first again, so no bag changes colour at the loop point', () => {
    const { frames } = esteiraFrames(ESTEIRA_FRAMES + 1);
    expect(Buffer.from(frames[ESTEIRA_FRAMES].data).equals(Buffer.from(frames[0].data))).toBe(true);
    // and it does move: no two neighbouring frames are the same picture
    for (let f = 1; f < ESTEIRA_FRAMES; f++) expect(Buffer.from(frames[f].data).equals(Buffer.from(frames[f - 1].data)), `frame ${f}`).toBe(false);
  });

  it('ships every frame of the loop', () => {
    expect(manifest.sprites['aero/esteira'].anim.frames).toHaveLength(ESTEIRA_FRAMES);
  });
});
