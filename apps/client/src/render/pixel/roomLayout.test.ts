import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { T } from './coords';
import { allNorthDecor, decorArt, relocatedWestDecor, describeSkipped, doormatRect, northBandRect, northDecor, northFacades, portalHitRect, roomBounds, skippedWestDecor, westDoorRect, westStripRect } from './roomLayout';
import { footprintRect, idTiebreak, propAnchor, propArtKey, propSlices, standingDepth } from './props';

describe('interior walls (top-down)', () => {
  it('the north band is 3 tiles tall above row 0, the west strip 1 tile wide left of column 0', () => {
    const pad = ROOMS.padaria;
    expect(northBandRect(pad)).toEqual({ x0: -T, y0: -3 * T, x1: 10 * T, y1: 0 });
    expect(westStripRect(pad)).toEqual({ x0: -T, y0: 0, x1: 0, y1: 9 * T });
  });

  it('west doors sit in the west strip at the portal row; the mat is the portal tile', () => {
    const p = ROOMS.padaria.portals[0];
    expect(westDoorRect(p)).toEqual({ x0: -T, y0: 6 * T, x1: 0, y1: 7 * T });
    expect(doormatRect(p)).toEqual({ x0: 0, y0: 6 * T, x1: T, y1: 7 * T });
    const hit = portalHitRect(p);
    expect(hit.x0).toBe(-T);
    expect(hit.x1).toBe(T);
  });

  it('every wall decor is either drawn on the north wall or listed as skipped', () => {
    for (const r of Object.values(ROOMS)) expect(northDecor(r).length + skippedWestDecor(r).length).toBe(r.walls.length);
  });

  it('lists the skipped west decor for the report', () => {
    const lines = describeSkipped(ROOMS);
    expect(lines).toContain('padaria: tv 0-2');
    expect(lines.some((l) => l.startsWith('praca: metro 9-12'))).toBe(true);
    expect(lines.length).toBe(Object.values(ROOMS).reduce((n, r) => n + skippedWestDecor(r).length, 0));
  });

  it('the padaria facade lands on the north door of the praça; academia has no facade art yet', () => {
    const f = northFacades(ROOMS.praca, (k) => k === 'facades/padaria');
    expect(f.length).toBe(1);
    expect(f[0]).toMatchObject({ key: 'facades/padaria', wx: 5.5 * T, wy: 0 });
    expect(northFacades(ROOMS.praca, () => false)).toEqual([]);
  });

  it('bounds include the walls', () => {
    expect(roomBounds(ROOMS.kitnet)).toEqual({ x0: -T, y0: -3 * T, x1: 8 * T, y1: 8 * T });
    expect(roomBounds(ROOMS.kitnet, 96).y0).toBe(-96);
  });
});

describe('props', () => {
  it('anchors at the bottom-centre of the footprint', () => {
    const banca = ROOMS.praca.props.find((p) => p.id === 'banca');
    if (!banca) throw new Error('no banca');
    expect(propAnchor(banca)).toEqual({ wx: 12.5 * T, wy: 4 * T });
    expect(footprintRect(banca)).toEqual({ x0: 12 * T, y0: 2 * T, x1: 13 * T, y1: 4 * T });
  });

  it('uses the real sprites the art track delivered', () => {
    const byId = (id: string) => ROOMS.praca.props.find((p) => p.id === id);
    const key = (id: string) => {
      const p = byId(id);
      if (!p) throw new Error(id);
      return propArtKey(p);
    };
    expect(key('orelhao')).toBe('props/orelhao');
    expect(key('placa')).toBe('props/placa_rua');
    expect(key('lixeira')).toBe('props/lixeira');
    expect(key('barraca')).toBe('props/barraca_chapeus');
    expect(key('quiosque')).toBe('props/quiosque');
    expect(key('poleiro')).toBe('props/poleiro');
    expect(key('poste_1')).toBe('props/poste_fios');
    expect(key('ipe_centro')).toBe('props/ipe_large');
    expect(key('ipe_canto')).toBe('props/ipe_medium');
    expect(key('bici')).toBe('props/bicicletario');
  });

  it('depth is the bottom edge plus a stable sub-pixel tiebreak', () => {
    expect(idTiebreak('a')).toBe(idTiebreak('a'));
    expect(idTiebreak('banco_1')).toBeLessThan(0.1);
    expect(standingDepth(100, 'x')).toBeGreaterThanOrEqual(100);
    expect(standingDepth(100, 'x')).toBeLessThan(100.1);
  });
});

describe('art track 3 wall art and props', () => {
  it('every north decor kind has art (the facade kind is the facade sprite)', () => {
    for (const r of Object.values(ROOMS)) for (const d of allNorthDecor(r)) expect(decorArt(d) !== null || d.kind === 'fachada_padaria', r.id + ' ' + d.kind).toBe(true);
  });

  it('west-wall decor moves to free north-wall columns without overlapping anything', () => {
    for (const r of Object.values(ROOMS)) {
      const moved = relocatedWestDecor(r);
      const own = northDecor(r).filter((d) => d.kind !== 'toldo' && d.kind !== 'azulejos' && d.kind !== 'fachada_padaria');
      for (const m of moved) {
        expect(m.from).toBeGreaterThanOrEqual(-1);
        expect(m.to).toBeLessThanOrEqual(r.cols);
        for (const o of own) expect(m.to <= o.from || m.from >= o.to, r.id + ' ' + m.kind + ' vs ' + o.kind).toBe(true);
        for (const o of moved) if (o !== m) expect(m.to <= o.from || m.from >= o.to).toBe(true);
      }
    }
    // the padaria TV lands in the corner above the west strip, the kitnet SP poster right of the cobogo
    expect(relocatedWestDecor(ROOMS.padaria).find((d) => d.kind === 'tv')).toMatchObject({ from: -1, to: 1 });
    expect(relocatedWestDecor(ROOMS.kitnet).find((d) => d.kind === 'poster')).toMatchObject({ from: 1, to: 3 });
  });

  it('the counter and the bleachers are drawn as one slice per footprint tile', () => {
    const bal = ROOMS.padaria.props.find((p) => p.id === 'balcao');
    if (!bal) throw new Error('balcao');
    expect(propSlices(bal)?.map((s) => s.key)).toEqual([0, 1, 2, 3, 4].map((i) => 'props/balcao_' + i + '_of_5'));
    expect(propSlices(bal)?.map((s) => s.x)).toEqual([1, 2, 3, 4, 5]);
    const chair = ROOMS.padaria.props.find((p) => p.id === 'cadeira_1');
    if (!chair) throw new Error('chair');
    expect(propArtKey(chair)).toBe('props/cadeira_padaria_e');
    expect(propArtKey({ ...chair, seat: 'NE' })).toBe('props/cadeira_padaria_n');
  });
});
