import { describe, expect, it } from 'vitest';
import { CLOTH_COLORS, CPU_LOOKS_A, CPU_LOOKS_B, GARB_IDS, HAIR_COLORS, HATS, ROOMS, SHOE_COLORS, SKIN_TONES, garbParts, type Appearance, type NpcId } from '@tudobem/shared';
import { GARBS } from './characters';
import { NPC_STYLES, lookForAppearance, lookForNpc, lookKey } from './looks';

const base: Appearance = { body: 'medio', skin: 2, hair: 'curto', hairColor: 1, top: 'camiseta', topColor: 3, bottom: 'calca', bottomColor: 4, shoes: 0 };
const ramps = (a: Appearance, key: string) => lookForAppearance(a).layers.find((l) => l.key === key)?.ramps;

describe('looks (layers + ramp colors)', () => {
  it('skin, hair, cloth and shoe colors come from the appearance indices', () => {
    const l = lookForAppearance(base);
    expect(l.layers[0]).toEqual({ key: 'body_medio', ramps: { skin: SKIN_TONES[2] }, hl: true });
    // the outfit takes the skin too: the blouse's neckline shows it
    expect(l.layers.find((x) => x.key === 'outfit_camiseta_calca')?.ramps).toEqual({ top: CLOTH_COLORS[3], bottom: CLOTH_COLORS[4], shoes: SHOE_COLORS[0], skin: SKIN_TONES[2] });
    expect(ramps(base, 'hair_curto')).toEqual({ hair: HAIR_COLORS[1] });
  });

  it('every creator option changes the layers', () => {
    const keys = (a: Appearance) => lookForAppearance(a).layers.map((l) => l.key).join();
    const b = keys(base);
    for (const patch of [{ body: 'forte' }, { hair: 'coque' }, { top: 'moletom' }, { bottom: 'saia' }, { face: 'doce' }, { extra: 'oculos' }, { idle: 'cafe' }] as Partial<Appearance>[]) {
      expect(keys({ ...base, ...patch }), JSON.stringify(patch)).not.toBe(b);
    }
  });

  it('colors change the cache key, and equal looks share one', () => {
    expect(lookKey(lookForAppearance(base))).toBe(lookKey(lookForAppearance({ ...base })));
    for (const patch of [{ skin: 5 }, { hairColor: 6 }, { topColor: 0 }, { bottomColor: 0 }, { shoes: 3 }] as Partial<Appearance>[]) {
      expect(lookKey(lookForAppearance({ ...base, ...patch })), JSON.stringify(patch)).not.toBe(lookKey(lookForAppearance(base)));
    }
  });

  it('out-of-range or missing indices fall back instead of throwing', () => {
    const l = lookForAppearance({ ...base, skin: 99, topColor: -1, hairColor: Number.NaN });
    expect(l.layers[0].ramps?.skin).toBe(SKIN_TONES[0]);
    expect(l.layers.find((x) => x.key.startsWith('outfit_'))?.ramps?.top).toBe(CLOTH_COLORS[0]);
  });

  it('a hat adds its layer after the hair, recolored with the catalog colors (the gesture layer stays on top of it)', () => {
    for (const h of HATS) {
      const l = lookForAppearance(base, { hat: h.id });
      expect(l.layers[l.layers.length - 1].key).toBe('emote_gestures');
      const last = l.layers[l.layers.length - 2];
      expect(last.key).toBe(`hat_${h.id}`);
      expect(last.ramps).toEqual({ hat: h.color, accent: h.accent });
    }
    expect(lookKey(lookForAppearance(base, { hat: 'cartola' }))).not.toBe(lookKey(lookForAppearance(base)));
  });

  it('the idle pose picks its prop layers (phone only for celular)', () => {
    expect(lookForAppearance({ ...base, idle: 'celular' }).layers.some((l) => l.key === 'acc_phone')).toBe(true);
    expect(lookForAppearance({ ...base, idle: 'solto' }).layers.some((l) => l.key === 'acc_phone')).toBe(false);
    expect(lookForAppearance({ ...base, idle: 'bracos', body: 'forte' }).layers.some((l) => l.key === 'pose_bracos__forte')).toBe(true);
  });
});

describe('wave 2 garbs (CPU neighbourhood pieces)', () => {
  const keys = (a: Appearance) => lookForAppearance(a).layers.map((l) => l.key);
  it('back pieces go under the body, the rest over the outfit or the hair, a bucket hat with the hats', () => {
    const k = keys({ ...base, garb: 'caixa+jersey_alvinegro+balde' });
    expect(k[0]).toBe('garb_caixa_u');
    expect(k.indexOf('garb_jersey')).toBeGreaterThan(k.indexOf('outfit_camiseta_calca'));
    expect(k.indexOf('garb_caixa_o')).toBeLessThan(k.indexOf('hair_curto'));
    expect(k.indexOf('hat_balde')).toBeGreaterThan(k.indexOf('hair_curto'));
    expect(k[k.length - 1]).toBe('emote_gestures');
  });
  it('body types use the warped variants of body-attached pieces, never of hats', () => {
    const k = keys({ ...base, body: 'forte', garb: 'mochila+balde' });
    expect(k).toContain('garb_mochila_u__forte');
    expect(k).toContain('garb_mochila_o__forte');
    expect(k).toContain('hat_balde');
  });
  it('unknown ids are ignored; an explicit hat wins over the bucket hat; garbs change the cache key', () => {
    expect(keys({ ...base, garb: 'nada' })).toEqual(keys(base));
    expect(lookForAppearance({ ...base, garb: 'balde' }, { hat: 'panama' }).layers.some((l) => l.key === 'hat_balde')).toBe(false);
    expect(lookKey(lookForAppearance({ ...base, garb: 'sacola' }))).not.toBe(lookKey(lookForAppearance(base)));
  });
  it('every GARB_IDS entry has art pieces, and every CPU garb is made of known ids', () => {
    for (const id of GARB_IDS) expect(GARBS[id]?.length, id).toBeGreaterThan(0);
    for (const a of [...Object.values(CPU_LOOKS_A), ...Object.values(CPU_LOOKS_B)]) for (const g of a.garb ?? []) expect(garbParts(g).join('+'), g).toBe(g);
  });
});

describe('NPC looks match their portraits', () => {
  it('every NpcId has a style, including the ones without a room yet', () => {
    const ids: NpcId[] = ['carlos', 'nanda', 'julia', 'graca', 'tia_lu'];
    for (const id of ids) expect(NPC_STYLES[id], id).toBeTruthy();
    for (const room of Object.values(ROOMS)) for (const n of room.npcs) expect(NPC_STYLES[n.id], n.id).toBeTruthy();
  });

  const keysOf = (id: string) => lookForNpc(id).layers.map((l) => l.key);

  it('Carlos: white apron, baker toque, his own face (the mustache is on that sheet)', () => {
    const k = keysOf('carlos');
    expect(k).toContain('prop_npc_avental__forte');
    expect(k).toContain('hat_npc_toque');
    expect(k).toContain('face_npc_carlos');
    expect(k.some((x) => x.startsWith('eyes_') || x.startsWith('extra_'))).toBe(false);
    expect(lookForNpc('carlos').layers.find((l) => l.key.startsWith('prop_npc_avental'))?.ramps?.accent).toBe('#f1eee8');
    expect(lookForNpc('carlos').layers.find((l) => l.key === 'face_npc_carlos')?.ramps?.hair).toBe(HAIR_COLORS[5]);
  });

  it('Nanda: mustard top and straw hat', () => {
    const l = lookForNpc('nanda');
    expect(l.layers.some((x) => x.key === 'hat_chapeu_palha')).toBe(true);
    expect(l.layers.find((x) => x.key.startsWith('outfit_'))?.ramps?.top).toBe(CLOTH_COLORS[1]);
  });

  it('Professora Bia: white gi (camisa + calça) with the gi layer, no apron, short dark hair', () => {
    const k = keysOf('prof');
    expect(k).toContain('npc_gi');
    expect(k.some((x) => x.startsWith('npc_apron'))).toBe(false);
    expect(k).toContain('hair_curto');
    expect(k.some((x) => x.startsWith('outfit_camisa_calca'))).toBe(true);
  });

  it('Júlia: blouse, high ponytail and a market tote, not an apron', () => {
    const k = keysOf('julia');
    expect(k.some((x) => x.startsWith('outfit_blusa'))).toBe(true);
    expect(k).toContain('hair_npc_julia');
    expect(k).toContain('prop_npc_sacola');
    expect(k).toContain('face_npc_julia');
    expect(k.some((x) => x.startsWith('npc_apron') || x.startsWith('hat_'))).toBe(false);
  });

  it('Graça: grey bun, glasses, apron', () => {
    const l = lookForNpc('graca');
    expect(l.layers.some((x) => x.key === 'hair_coque' && x.ramps?.hair === HAIR_COLORS[5])).toBe(true);
    expect(l.layers.some((x) => x.key === 'extra_oculos')).toBe(true);
    expect(l.layers.some((x) => x.key.startsWith('npc_apron'))).toBe(true);
  });

  it('Tia Lu: red headscarf and apron', () => {
    const l = lookForNpc('tia_lu');
    expect(l.layers.find((x) => x.key === 'hat_pano')?.ramps?.hat).toMatch(/^#c/);
    expect(l.layers.some((x) => x.key.startsWith('npc_apron'))).toBe(true);
  });

  it('the five NPCs all look different', () => {
    const set = new Set(['carlos', 'nanda', 'julia', 'graca', 'tia_lu'].map((id) => lookKey(lookForNpc(id))));
    expect(set.size).toBe(5);
  });

  it('a stranger can name the five regulars by hat or prop, not by shirt color', () => {
    const keys = (id: string) => lookForNpc(id).layers.map((l) => l.key);
    const hat = (id: string) => keys(id).find((k) => k.startsWith('hat_npc_') || k.startsWith('hair_npc_'));
    const prop = (id: string) => keys(id).find((k) => k.startsWith('prop_npc_'));
    expect(hat('carlos')).toBe('hat_npc_toque');
    expect(prop('carlos')).toBe('prop_npc_avental__forte');
    expect(hat('julia')).toBe('hair_npc_julia');
    expect(prop('julia')).toBe('prop_npc_sacola');
    expect(hat('ze')).toBe('hat_npc_panama');
    expect(prop('ze')).toBe('prop_npc_verdura__forte');
    expect(hat('chico')).toBe('hat_npc_bucket');
    expect(prop('chico')).toBe('prop_npc_pastel');
    expect(hat('rosa')).toBe('hat_npc_coroa');
    expect(prop('rosa')).toBe('prop_npc_buque__esguio');
    const hats = ['carlos', 'julia', 'ze', 'chico', 'rosa'].map(hat);
    const props = ['carlos', 'julia', 'ze', 'chico', 'rosa'].map(prop);
    expect(new Set(hats).size).toBe(5);
    expect(new Set(props).size).toBe(5);
    // Zé is not Carlos, Chico is not a second baker, Rosa is not Graça, Júlia is not a baker.
    for (const id of ['julia', 'ze', 'chico', 'rosa']) {
      expect(keys(id).some((k) => k.startsWith('npc_apron') || k.includes('toque') || k.includes('avental'))).toBe(false);
    }
    expect(lookForNpc('ze').layers.find((l) => l.key === 'face_npc_ze')?.ramps?.hair).toBe(HAIR_COLORS[0]);
    expect(keys('chico')).toContain('face_npc_chico');
    expect(keys('rosa')).toContain('face_npc_rosa');
    expect(keys('rosa').some((k) => k === 'extra_oculos' || k === 'hair_coque' || k.startsWith('npc_apron'))).toBe(false);
    expect(keys('graca')).toEqual(expect.arrayContaining(['hair_coque', 'extra_oculos']));
    expect(keys('graca').some((k) => k.startsWith('npc_apron'))).toBe(true);
  });
});
