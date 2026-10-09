/**
 * The gi layer as generated (`public/pixel/chars/npc_gi.png`, assets-src/custom/gi.mjs): the belt is one row, with a knot and two tails,
 * the lapels cross in a V, and the pieces follow the sitting frames. Reads the sheet the game ships, so a re-import that bulks the belt
 * up again fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { KEY_RAMPS, hexToRgb, pack } from './palette';

const PIX = path.resolve(import.meta.dirname, '../../../public/pixel');
const FW = 16, FH = 32, COLS = 8;
const packed = (hex: string) => pack(...hexToRgb(hex));
const BELT = KEY_RAMPS.belt.map(packed);
const SEAM = packed('#46465e');

async function sheet(key: string): Promise<{ data: Buffer; width: number }> {
  const { data, info } = await sharp(path.join(PIX, 'chars', `${key}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

/** The pixels of one frame as a map 'x,y' -> packed rgb (opaque pixels only). */
function frame(s: { data: Buffer; width: number }, row: number, col: number): Map<string, number> {
  const out = new Map<string, number>();
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const i = ((row * FH + y) * s.width + col * FW + x) * 4;
    if (s.data[i + 3]) out.set(`${x},${y}`, (s.data[i] << 16) | (s.data[i + 1] << 8) | s.data[i + 2]);
  }
  return out;
}
const rowsWith = (f: Map<string, number>, colors: number[]) => {
  const rows = new Map<number, number>();
  for (const [k, v] of f) if (colors.includes(v)) rows.set(Number(k.split(',')[1]), (rows.get(Number(k.split(',')[1])) ?? 0) + 1);
  return rows;
};

describe('the generated gi sheet', () => {
  it('front idle: the belt band is one row across the torso, the knot on it, two tails of two rows under it', async () => {
    const f = frame(await sheet('npc_gi'), 0, 0);
    const belt = rowsWith(f, BELT);
    const band = [...belt.entries()].filter(([, n]) => n >= 4).map(([y]) => y);
    expect(band).toHaveLength(1);
    const y = band[0];
    expect(y).toBe(26); // feet at 31: the last torso row
    expect(belt.get(y + 1)).toBe(2); // the tails over the jacket skirt
    expect(belt.get(y + 2)).toBe(2); // their tips over the pants
    expect(belt.get(y - 1)).toBeUndefined(); // nothing above the band: the knot sits on it
    expect([f.get(`7,${y}`), f.get(`8,${y}`)]).toEqual([BELT[2], BELT[2]]);
  });

  it('front idle: the lapel seams run down in a V from the neck line to the knot', async () => {
    const f = frame(await sheet('npc_gi'), 0, 0);
    expect(f.get('6,24')).toBe(SEAM);
    expect(f.get('9,24')).toBe(SEAM);
    expect(f.get('7,25')).toBe(SEAM);
    expect(f.get('8,25')).not.toBe(SEAM);
  });

  it('the belt follows the sitting frames: lowered on the front and back sits, at the waist (never on the lap) on the side sits', async () => {
    const s = await sheet('npc_gi');
    for (const [row, y] of [[8, 30], [11, 30], [9, 26], [10, 26]] as const) {
      const band = [...rowsWith(frame(s, row, 0), BELT).entries()].filter(([, n]) => n >= 2).map(([yy]) => yy);
      expect(band, `sit row ${row}`).toContain(y);
    }
    const sideSit = frame(s, 10, 0);
    for (let x = 11; x < 16; x++) for (let y = 24; y < 32; y++) expect(BELT.includes(sideSit.get(`${x},${y}`) ?? -1), `lap ${x},${y}`).toBe(false);
  });

  it('every walking, emote and phone frame wears the belt, and the body variants too', async () => {
    for (const key of ['npc_gi', 'npc_gi__esguio', 'npc_gi__forte']) {
      const s = await sheet(key);
      for (const [row, n] of [[4, 6], [5, 6], [6, 6], [7, 6], [12, 6], [13, 6], [14, 4], [15, 4], [16, 8], [17, 6]] as const) {
        for (let col = 0; col < n; col++) expect(rowsWith(frame(s, row, col), BELT).size, `${key} ${row},${col}`).toBeGreaterThan(0);
      }
    }
  });

  it('the academy stamp sits on the back and the chest, on the accent ramp, and not on the side views', async () => {
    const s = await sheet('gi_patch');
    const ACC = KEY_RAMPS.accent.map(packed);
    const count = (row: number) => [...frame(s, row, 0).values()].filter((v) => ACC.includes(v)).length;
    expect(count(3)).toBe(8);
    expect(count(0)).toBe(2);
    expect(count(1)).toBe(0);
    expect(count(2)).toBe(0);
  });

  it('a shirt and a blouse differ on the chest, a hoodie on the neck: the top styles are told apart without a colour', async () => {
    const [tee, hood, shirt, blouse] = await Promise.all(['camiseta', 'moletom', 'camisa', 'blusa'].map((t) => sheet(`outfit_${t}_calca`)));
    const neck = (s: { data: Buffer; width: number }) => [...frame(s, 0, 0).entries()].filter(([k]) => k.endsWith(',23')).length;
    expect(neck(hood)).toBeGreaterThan(neck(tee));
    expect(neck(blouse)).toBeGreaterThan(neck(tee));
    const skin = KEY_RAMPS.skin.map(packed);
    expect([...frame(blouse, 0, 0).values()].some((v) => skin.includes(v))).toBe(true);
    expect([...frame(shirt, 0, 0).values()].some((v) => skin.includes(v))).toBe(false);
  });

  it('sitting facing the camera, the shirt is still the shirt (the bands are cut from the lowered feet row)', async () => {
    const s = await sheet('outfit_camisa_calca');
    const top = KEY_RAMPS.top.map(packed), bottom = KEY_RAMPS.bottom.map(packed);
    const f = frame(s, 8, 0);
    const at = (y: number) => [...f.entries()].filter(([k]) => k.endsWith(`,${y}`)).map(([, v]) => v);
    expect(at(28).some((v) => top.includes(v))).toBe(true);
    expect(at(28).some((v) => bottom.includes(v))).toBe(false);
    expect(at(31).some((v) => bottom.includes(v))).toBe(true);
  });
});
