// The Pet Shop do Seu Dito art contract (#234, docs/PET-STORE-PLAN.md §1.5): every key the rooms, the wall decor, the lojinha and the
// carinho read is in the manifest, the facade fills its 6 x 6 footprint with lit windows, and nothing is magenta, soft or empty.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPng } from './img.mjs';
import { petshopSet, PET_ICONS } from '../../../apps/client/assets-src/custom/petshop.mjs';
import { ITEMS as DIARY_ITEMS } from '../../../apps/client/assets-src/custom/diaryItems.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = path.join(ROOT, 'apps/client/assets-src');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/client/public/pixel/manifest.json'), 'utf8'));
const layout = (room) => JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/shared/layouts', `${room}.json`), 'utf8')).objects;
const ctx = { load: (spec) => loadPng(path.join(SRC, spec.replace(/^ext:/, 'limezu-modern-exteriors/Modern_Exteriors_16x16/'))) };

const KIND_ART = { vaso: 'props/pot_teal', aquario: 'props/aquario', cercadinho: 'props/cercadinho', gatil: 'props/gatil', prateleira_racao: 'props/prateleira_racao', banheira: 'props/banheira_tosa' };
const WALLS = ['walls/quadro_racas', 'walls/poster_adocao', 'walls/placa_banho_tosa', 'walls/placa_vet'];
const FURNITURE = ['props/caminha_xadrez', 'props/caminha_azul', 'props/caminha_cesta', 'props/saco_racao'];

describe('pet shop art', async () => {
  const parts = await petshopSet(ctx);
  const byKey = new Map(parts.map((p) => [p.key, p]));

  it('every object of the shop and of its sidewalk resolves to a sprite', () => {
    const keys = [];
    for (const o of layout('petshop')) {
      if (o.kind === 'balcao') for (let i = 0; i < (o.w ?? 1); i++) keys.push(`${o.art}_${i}_of_${o.w}`);
      else keys.push(o.art ?? KIND_ART[o.kind]);
    }
    for (const o of layout('rua_leste').filter((q) => /petshop/.test(q.id))) if (o.art) keys.push(o.art);
    expect(keys.length).toBeGreaterThan(25);
    for (const k of keys) expect(manifest.sprites[k], k).toBeTruthy();
  });

  it('has the wall decor, the furniture of the lojinha, the toys and the carinho hearts (three frames)', () => {
    for (const k of [...WALLS, ...FURNITURE, 'fx/ossinho', 'fx/pelucia']) expect(manifest.sprites[k], k).toBeTruthy();
    expect(manifest.sprites['fx/carinho'].anim.frames).toHaveLength(3);
    expect(manifest.sprites['props/aquario'].anim.frames).toHaveLength(2);
    expect(manifest.sprites['props/banheira_tosa'].anim.frames).toHaveLength(2);
  });

  it('the facade is 96 x 96 (6 x 6 tiles) with lit windows and a night overlay of the same size', () => {
    const f = manifest.sprites['facades/petshop'];
    expect([f.w, f.h, f.ax, f.ay]).toEqual([96, 96, 48, 95]);
    expect(f.footprint).toEqual([6, 6]);
    expect(f.lit).toBe('facades/petshop_lit');
    expect(f.windows.length).toBeGreaterThanOrEqual(3);
    const lit = manifest.sprites['facades/petshop_lit'];
    expect([lit.w, lit.h]).toEqual([96, 96]);
  });

  it('a 16 x 16 icon for every lojinha item', async () => {
    for (const [id, fn] of Object.entries(PET_ICONS)) {
      const img = fn();
      expect([img.w, img.h], id).toEqual([16, 16]);
    }
    expect(Object.keys(PET_ICONS)).toHaveLength(13);
  });

  // a diary object is a small diary piece, or one of the shop's own props (the paw rug is the pata, the play-pen for sale the cercadinho)
  it('the diary objects of the shop have their grids or are pet shop pieces', () => {
    for (const o of layout('petshop').filter((q) => q.id.startsWith('d_'))) expect(o.art.startsWith('diary/') ? DIARY_ITEMS[o.art.replace('diary/', '')] : byKey.get(o.art), o.id).toBeTruthy();
  });

  it('nothing is magenta, soft (but the lit overlay) or empty', () => {
    for (const p of parts) {
      for (const img of p.frames ?? [p.img]) {
        let opaque = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          const [r, g, b, a] = img.data.subarray(i, i + 4);
          if (!a) continue;
          opaque++;
          expect(r === 255 && g === 0 && b === 255, `${p.key} magenta`).toBe(false);
          if (!p.key.endsWith('_lit')) expect(a, `${p.key} soft alpha`).toBe(255);
        }
        expect(opaque, p.key).toBeGreaterThan(20);
      }
    }
    expect(byKey.get('facades/petshop')).toBeTruthy();
  });

  it('the props keep a sealed outline: no opaque pixel on the image border (the navy ring has room)', () => {
    for (const p of parts.filter((q) => q.key.startsWith('props/') || q.key.startsWith('fx/'))) {
      for (const img of p.frames ?? [p.img]) {
        for (let x = 0; x < img.w; x++) for (const y of [0, img.h - 1]) {
          const a = img.data[(y * img.w + x) * 4 + 3];
          if (!a) continue;
          const [r, g, b] = img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 3);
          expect([r, g, b], `${p.key} border ${x},${y}`).toEqual([0x3a, 0x3a, 0x50]);
        }
      }
    }
  });
});
