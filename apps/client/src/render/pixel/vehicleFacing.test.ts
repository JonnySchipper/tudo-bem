import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { AMBIENT } from './ambientData';
import { BUS, VEHICLE_TYPES, vehiclesAt } from './ambientSim';

const PIX = path.resolve(__dirname, '../../../public/pixel');
const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));

/** The rolling stock: each [eastKey, westKey] pair a vehicle can use. */
const PAIRS: Array<[string, string]> = [...VEHICLE_TYPES.map((t): [string, string] => [t.e, t.w]), [BUS.e, BUS.w]];
/** The bus art has no headlamp pixels (manual check: bus_e has its mirrors and entry door on the right, bus_w its mirrors on the left). */
const LAMPS = PAIRS.filter(([e]) => e !== BUS.e);

/**
 * Where the front of a vehicle sprite is, from its art: the headlamps are the near-white / yellow-white pixels (the tail lights are red, windows
 * are blue-tinted). Returns the lamp centroid minus the sprite's middle: positive = lamps on the right = the vehicle faces east.
 */
async function lampSide(key: string): Promise<number> {
  const d = manifest.sprites[key];
  const atlas = manifest.atlases[d.atlas];
  const json = JSON.parse(fs.readFileSync(path.join(PIX, atlas.data), 'utf8'));
  const fr = json.frames[d.frame];
  const { x, y, w, h } = fr.frame;
  const { data, info } = await sharp(path.join(PIX, atlas.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0;
  let n = 0;
  for (let j = Math.floor(h * 0.4); j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = ((y + j) * info.width + x + i) * 4;
      const [r, g, b, a] = [data[o], data[o + 1], data[o + 2], data[o + 3]];
      if (a < 250) continue;
      // the lamp pixels are pure white (#ffffff) or the warm glow (#fff59a); body highlights top out at #f8f8f8 / #e6d8b8
      // (the LimeZu hatchbacks' lamps are plain near-white blobs in the low front corners: lower 40% only, no blue glass up there)
      const lamp = (r === 255 && g >= 0xf0) || (key.includes('car_') && r >= 240 && g >= 240 && b >= 240);
      if (lamp) {
        sx += i;
        n++;
      }
    }
  }
  expect(n, `${key}: no headlamp pixels found`).toBeGreaterThan(0);
  return sx / n - w / 2;
}

describe('vehicle sprites face the way their key says', () => {
  for (const [e, w] of LAMPS) {
    it(`${e} has its lamps on the right and ${w} on the left`, async () => {
      expect(await lampSide(e)).toBeGreaterThan(0);
      expect(await lampSide(w)).toBeLessThan(0);
    });
  }
});

describe('traffic uses the sprite that matches its velocity', () => {
  it('every vehicle on every lane moves toward the way its sprite faces', async () => {
    const east = new Set(PAIRS.map((p) => p[0]));
    const west = new Set(PAIRS.map((p) => p[1]));
    const room = AMBIENT.praca;
    const seen = { e: 0, w: 0 };
    const DT = 500;
    for (let t = 1_000_000; t < 1_000_000 + 600_000; t += 7919) {
      // minute 12:00, so the road is busy
      const a = vehiclesAt(room, t, 720, { forcedBusAt: t - 3000 });
      const b = new Map(vehiclesAt(room, t + DT, 720, { forcedBusAt: t - 3000 }).map((v) => [v.id, v]));
      for (const v of a) {
        const lane = room.streets.find((s) => s.id === v.street)!.lanes.find((l) => l.y === v.laneY)!;
        expect(v.dir).toBe(lane.dir);
        expect((lane.dir === 'e' ? east : west).has(v.key), `${v.id} ${v.key} on a ${lane.dir} lane`).toBe(true);
        expect((lane.dir === 'e' ? west : east).has(v.key)).toBe(false);
        const nx = b.get(v.id);
        if (!nx || !v.moving || !nx.moving) continue;
        const dx = nx.x - v.x;
        if (Math.abs(dx) < 1) continue;
        expect(Math.sign(dx), `${v.id} moves ${dx} with ${v.key}`).toBe(v.dir === 'e' ? 1 : -1);
        seen[v.dir]++;
      }
    }
    expect(seen.e).toBeGreaterThan(20);
    expect(seen.w).toBeGreaterThan(20);
  });
});
