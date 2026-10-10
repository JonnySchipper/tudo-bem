import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { PHOTO_SPOTS, ROOMS, wordsForPhoto } from '@tudobem/shared';
import { propAnchor } from '../render/pixel/props';
import { T } from '../render/pixel/coords';

const PIX = path.resolve(__dirname, '../../public/pixel');
const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
const SRC = path.resolve(__dirname, '../../assets-src/custom/png/aero_aviao.png');

const plane = ROOMS.aeroporto.props.find((p) => p.id === 'aviao')!;
const spots = PHOTO_SPOTS.filter((s) => s.room === 'aeroporto' && wordsForPhoto(s.id).length > 0);

/** The words a camera frame on this tile point would teach (the frame touches every spot under it). */
const wordsAt = (tx: number, ty: number) => spots.filter((s) => tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h).flatMap((s) => wordsForPhoto(s.id).map((w) => w.pt));

describe('the plane at the gate (step 2: take a photo of the plane)', () => {
  it('teaches a word wherever the player aims at it, not only at the wing', async () => {
    const d = manifest.sprites['aero/aviao'];
    const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([d.w, d.h]);
    const a = propAnchor(plane);
    let opaque = 0;
    let covered = 0;
    const missed: string[] = [];
    for (let sy = 0; sy < info.height; sy++)
      for (let sx = 0; sx < info.width; sx++) {
        if (data[(sy * info.width + sx) * 4 + 3]! < 128) continue;
        opaque++;
        const tx = (a.wx - d.ax + sx + 0.5) / T;
        const ty = (a.wy - d.ay + sy + 0.5) / T;
        if (wordsAt(tx, ty).length) covered++;
        else missed.push(`${sx},${sy}`);
      }
    // the outline's last pixel at a corner may fall outside a box; everything else is covered
    expect(covered / opaque, `uncovered sprite pixels, e.g. ${missed.filter((_, i) => i % 7 === 0).slice(0, 40).join(' ')}`).toBeGreaterThan(0.99);
  });

  it('names its parts: wing, engine, tail, nose, window, door, wheel, body', () => {
    const at = (sx: number, sy: number) => {
      const d = manifest.sprites['aero/aviao'];
      const a = propAnchor(plane);
      return wordsAt((a.wx - d.ax + sx) / T, (a.wy - d.ay + sy) / T);
    };
    expect(at(26, 20)).toContain('cauda');
    expect(at(90, 25)).toContain('asa');
    expect(at(80, 85)).toContain('asa');
    expect(at(118, 72)).toEqual(expect.arrayContaining(['turbina', 'motor']));
    expect(at(195, 50)).toContain('nariz');
    expect(at(110, 43)).toContain('janela');
    expect(at(164, 50)).toContain('porta');
    expect(at(86, 70)).toContain('roda');
    expect(at(176, 70)).toContain('roda');
    expect(at(140, 58)).toContain('fuselagem');
  });
});
