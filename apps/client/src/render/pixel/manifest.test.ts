import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FURNITURE, MG_ITEMS } from '@tudobem/shared';
import { imageDef, imageUrl, nineSlice, type Manifest } from './manifest';
import { furnitureArtKey } from './props';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const images = manifest.images;
const BASE = '/pixel/';

describe('typed manifest images', () => {
  it('the generated manifest has an images section', () => {
    expect(images).toBeTruthy();
    for (const [key, d] of Object.entries(images ?? {})) {
      expect(d.w, key).toBeGreaterThan(0);
      expect(d.h, key).toBeGreaterThan(0);
      expect(fs.existsSync(path.resolve(__dirname, '../../../public/pixel', d.file)), `${key} -> ${d.file}`).toBe(true);
    }
  });

  it('imageUrl resolves a listed key through its file, and any other key by the key.png convention', () => {
    expect(imageUrl('icons/pao', images, BASE)).toBe('/pixel/icons/pao.png');
    expect(imageUrl('portraits/carlos_neutro', images, BASE)).toBe('/pixel/portraits/carlos_neutro.png');
    expect(imageUrl('icons/nao_existe', images, BASE)).toBe('/pixel/icons/nao_existe.png');
    expect(imageUrl('icons/pao', null, BASE)).toBe('/pixel/icons/pao.png');
    expect(imageDef('icons/nao_existe', images)).toBeNull();
  });

  it('every bag item has an icon and every NPC portrait has its four expressions', () => {
    for (const it of MG_ITEMS) expect(imageDef(`icons/${it.id}`, images), it.id).toBeTruthy();
    for (const npc of ['carlos', 'nanda', 'julia', 'graca', 'tia_lu', 'prof', 'ze', 'chico', 'rosa']) {
      for (const e of ['neutro', 'feliz', 'surpreso', 'pensativo']) expect(imageDef(`portraits/${npc}_${e}`, images), `${npc}_${e}`).toBeTruthy();
    }
  });

  it('every furniture item has a rot-0 sprite for its catalog icon', () => {
    for (const f of FURNITURE) expect(manifest.sprites[furnitureArtKey(f.id, 0)], f.id).toBeTruthy();
  });

  it('nineSlice returns the slice, the border widths and a border-image shorthand for the ui kit', () => {
    const panel = nineSlice('ui/panel', images, BASE);
    expect(panel).toBeTruthy();
    expect(panel?.slice).toBe('7 7 7 7');
    expect(panel?.width).toBe('7px 7px 7px 7px');
    expect(panel?.borderImage(2)).toBe('url(/pixel/ui/panel.png) 7 7 7 7 fill / 14px 14px 14px 14px / 0 stretch');
    const bubble = nineSlice('ui/bubble', images, BASE);
    expect(bubble?.slice).toBe('7 7 13 16');
    for (const k of ['ui/button', 'ui/button_hover', 'ui/button_pressed']) expect(nineSlice(k, images, BASE)?.slice, k).toBe('6 6 7 6');
    expect(nineSlice('icons/pao', images, BASE)).toBeNull();
    expect(nineSlice('ui/panel', null, BASE)).toBeNull();
  });
});
