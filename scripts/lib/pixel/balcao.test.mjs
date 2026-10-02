import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { balcaoParts } from '../../../apps/client/assets-src/custom/balcao.mjs';
import { MG_ITEMS } from '../../../packages/shared/src/meveum.ts';

const manifest = JSON.parse(fs.readFileSync(new URL('../../../apps/client/public/pixel/manifest.json', import.meta.url), 'utf8'));

/** The contract the gameplay side consumes: key -> number of single-frame sprites sharing the `<base>_<n>` pattern. */
const SINGLES = ['tray', 'tray_full', 'bag', 'plate', 'chapa_idle', 'chapa_burnt', 'coffee_idle', 'register'];
const STRIPS = { chapa_sizzle: 3, coffee_pour: 4, bell: 2, tipjar: 4, patience: 5 };
const contract = [
  ...MG_ITEMS.map((i) => `balcao/item_${i.id}`),
  ...SINGLES.map((k) => `balcao/${k}`),
  ...Object.entries(STRIPS).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => `balcao/${k}_${i}`)),
  ...Array.from({ length: 4 }, (_, i) => `fx/steam_${i}`),
];

describe('Correria no Balcao art contract', () => {
  it('lists the 12 shelf items of meveum.ts', () => {
    expect(MG_ITEMS.map((i) => i.id)).toEqual(['pao', 'pao_na_chapa', 'pastel', 'coxinha', 'bolo', 'cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua', 'pao_de_queijo', 'misto_quente', 'guarana']);
  });

  it('has every contract key in the manifest, one frame each, with the generator size and an anchor inside the sprite', () => {
    const gen = new Map(balcaoParts().map((p) => [p.key, p]));
    for (const key of contract) {
      const s = manifest.sprites[key];
      expect(s, key).toBeTruthy();
      expect(s.anim, key).toBeNull();
      const p = gen.get(key);
      expect(p, key).toBeTruthy();
      expect([s.w, s.h], key).toEqual([p.img.w, p.img.h]);
      expect(s.ax).toBeGreaterThanOrEqual(0); expect(s.ax).toBeLessThanOrEqual(s.w);
      expect(s.ay).toBeGreaterThan(0); expect(s.ay).toBeLessThanOrEqual(s.h);
    }
    // nothing extra under balcao/: the generator and the contract agree
    expect([...gen.keys()].sort()).toEqual([...contract].sort());
  });

  it('draws shelf items 24-32 px, equal-sized and non-empty', () => {
    for (const i of MG_ITEMS) {
      const s = manifest.sprites[`balcao/item_${i.id}`];
      expect(s.w).toBeGreaterThanOrEqual(24); expect(s.w).toBeLessThanOrEqual(32);
      expect(s.h).toBeGreaterThanOrEqual(24); expect(s.h).toBeLessThanOrEqual(32);
    }
  });

  it('uses hard pixels (only the steam may be soft), has no empty frame and keeps a 1 px navy outline', () => {
    for (const p of balcaoParts()) {
      let opaque = 0;
      for (let i = 0; i < p.img.data.length; i += 4) {
        const a = p.img.data[i + 3];
        if (!p.key.startsWith('fx/')) expect(a === 0 || a === 255, p.key).toBe(true);
        if (a) opaque++;
      }
      expect(opaque, p.key).toBeGreaterThan(30);
    }
  });

  it('animation strips differ frame to frame (they actually animate)', () => {
    const gen = new Map(balcaoParts().map((p) => [p.key, p]));
    for (const [k, n] of Object.entries(STRIPS)) for (let i = 1; i < n; i++) {
      const a = gen.get(`${k.startsWith('chapa') ? 'balcao/' : 'balcao/'}${k}_${i - 1}`).img.data, b = gen.get(`balcao/${k}_${i}`).img.data;
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b)), `${k} ${i - 1}->${i}`).not.toBe(0);
    }
    for (let i = 1; i < 4; i++) expect(Buffer.compare(Buffer.from(gen.get(`fx/steam_${i - 1}`).img.data), Buffer.from(gen.get(`fx/steam_${i}`).img.data))).not.toBe(0);
  });
});
