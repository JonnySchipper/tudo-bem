import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { propPalette, ROOM_IDS, bundledObjects } from '@tudobem/shared';
import { propArtKey } from '../../render/pixel/props';
import { buildAssets, bumpRecent, categorize, matches, type ManifestSprite } from './assets';

// the generated manifest is committed (`pnpm pixel`), so the palette can be checked against the real atlases
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as { sprites: Record<string, ManifestSprite> };
const assets = buildAssets(manifest.sprites, propPalette(), propArtKey);

describe('design mode asset palette', () => {
  it('offers every sprite the shipped layouts use, and every interactive prop with its action', () => {
    const offered = new Set(assets.map((a) => a.sprite));
    for (const room of ROOM_IDS) {
      for (const p of bundledObjects(room)) {
        const key = propArtKey(p);
        if (key && manifest.sprites[key]) expect(offered.has(key), `${room}/${p.id}: ${key}`).toBe(true);
      }
    }
    const counter = assets.find((a) => a.template.action === 'padaria_counter');
    expect(counter?.category).toBe('interactables');
    expect(assets.filter((a) => a.category === 'interactables').length).toBeGreaterThan(5);
  });

  it('leaves out characters, effects, the HUD kit and parts of other sprites', () => {
    const keys = assets.map((a) => a.sprite ?? '');
    expect(keys.some((k) => /^(chars|fx|ui|bjj)\//.test(k))).toBe(false);
    const placed = new Set(ROOM_IDS.flatMap((r) => bundledObjects(r).map((p) => propArtKey(p))));
    expect(keys.filter((k) => (k.endsWith('_lit') || k.endsWith('_fechada')) && !placed.has(k))).toEqual([]);
    expect(keys).toContain('aero/cabine_fechada');
    expect(new Set(assets.map((a) => a.key)).size).toBe(assets.length);
  });

  it('fills every placeable category and finds things by Portuguese name', () => {
    for (const c of ['furniture', 'props', 'plants', 'signs', 'interactables', 'lights', 'decals', 'buildings'] as const) {
      expect(assets.filter((a) => a.category === c).length, c).toBeGreaterThan(0);
    }
    expect(assets.filter((a) => matches(a, 'banco')).length).toBeGreaterThan(0);
    expect(assets.filter((a) => matches(a, 'zzz nada')).length).toBe(0);
    expect(categorize('decals/sp_mosaic', { id: 'x', kind: 'cenario', x: 0, y: 0, blocks: false }, null)).toBe('decals');
    expect(categorize('props/poste_fios', { id: 'x', kind: 'poste', x: 0, y: 0, blocks: true }, null)).toBe('lights');
  });

  it('keeps recents most-recent-first and short', () => {
    let r: string[] = [];
    for (let i = 0; i < 20; i++) r = bumpRecent(r, `k${i}`);
    r = bumpRecent(r, 'k10');
    expect(r[0]).toBe('k10');
    expect(r).toHaveLength(16);
    expect(r.filter((k) => k === 'k10')).toHaveLength(1);
  });
});
