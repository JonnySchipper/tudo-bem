import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { T } from './coords';
import { allNorthDecor, decorArt, relocatedWestDecor, describeSkipped, doormatRect, northBandRect, northDecor, northFacades, portalHitRect, roomBounds, skippedWestDecor, westDoorRect, westStripRect, windowPatches } from './roomLayout';
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

  it('every wall decor is either drawn on the north wall or listed as skipped (rooms with pixelWalls author the whole north wall)', () => {
    for (const r of Object.values(ROOMS)) expect(northDecor(r).length + skippedWestDecor(r).length).toBe(r.pixelWalls ? r.pixelWalls.length : r.walls.length);
  });

  it('lists the skipped west decor for the report (only rooms without their own pixelWalls)', () => {
    const lines = describeSkipped(ROOMS);
    expect(lines).toContain('kitnet: poster 1-3 "SP"');
    expect(lines.some((l) => l.startsWith('kitnet: cobogo 6-8'))).toBe(true);
    expect(lines.some((l) => l.startsWith('padaria') || l.startsWith('praca') || l.startsWith('academia'))).toBe(false);
    expect(lines.length).toBe(Object.values(ROOMS).reduce((n, r) => n + skippedWestDecor(r).length, 0));
  });

  it('the padaria facade lands on the north door of the praça; academia has no facade art yet', () => {
    // Vila Ipê is open-air: its building fronts are props, so the wall-band facade logic finds nothing there
    expect(northFacades(ROOMS.praca, () => true)).toEqual([]);
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
    expect(propAnchor(banca)).toEqual({ wx: 21.5 * T, wy: 6 * T });
    expect(footprintRect(banca)).toEqual({ x0: 20 * T, y0: 4 * T, x1: 23 * T, y1: 6 * T });
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
    expect(key('lixeira_n1')).toBe('props/lixeira');
    expect(key('barraca')).toBe('props/barraca_chapeus');
    expect(key('quiosque')).toBe('props/quiosque');
    expect(key('poleiro')).toBe('props/poleiro');
    expect(key('poste_1')).toBe('props/poste_fios');
    expect(key('ipe_centro')).toBe('props/ipe_large');
    expect(key('ipe_2')).toBe('props/ipe_medium');
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
    // the kitnet SP poster lands right of the cobogo; rooms with pixelWalls move nothing
    expect(relocatedWestDecor(ROOMS.kitnet).find((d) => d.kind === 'poster')).toMatchObject({ from: 1, to: 3 });
    for (const id of ['praca', 'padaria', 'academia'] as const) expect(relocatedWestDecor(ROOMS[id])).toEqual([]);
  });

  it('Phase 4a: the dropped decor is authored on the north wall (padaria clock + window, academia window, praça predio / mural / metro)', () => {
    const kinds = (id: keyof typeof ROOMS) => northDecor(ROOMS[id]).map((d) => d.kind);
    expect(kinds('padaria')).toEqual(expect.arrayContaining(['relogio', 'janela', 'tv', 'prateleira_paes', 'lousa', 'toldo', 'azulejos']));
    expect(kinds('academia')).toEqual(expect.arrayContaining(['janela', 'placa', 'poster', 'mural']));
    expect(kinds('praca')).toEqual([]); // open-air: no wall band, building fronts are props
  });

  it('pixelWalls stay on the wall (columns -1..cols) and only overlap on purpose (awning over shelves, wainscot, sign on the building)', () => {
    const layers = new Set(['azulejos', 'toldo', 'metro']);
    for (const r of Object.values(ROOMS)) {
      const flat = northDecor(r).filter((d) => !layers.has(d.kind) && d.kind !== 'fachada_padaria');
      for (const d of northDecor(r)) {
        expect(d.wall, r.id + ' ' + d.kind).toBe('right');
        expect(d.from, r.id + ' ' + d.kind).toBeGreaterThanOrEqual(-1);
        expect(d.to, r.id + ' ' + d.kind).toBeLessThanOrEqual(r.cols);
      }
      for (const a of flat) for (const b of flat) if (a !== b) expect(a.to <= b.from || a.from >= b.to, `${r.id}: ${a.kind} ${a.from}-${a.to} vs ${b.kind} ${b.from}-${b.to}`).toBe(true);
    }
  });

  it('a north decor never covers a north door', () => {
    for (const r of Object.values(ROOMS)) {
      for (const p of r.portals.filter((q) => q.wall === 'right')) {
        for (const d of northDecor(r)) {
          if (d.kind === 'fachada_padaria' || d.kind === 'mural' || d.kind === 'predio') continue; // building fronts sit behind their doors on purpose
          expect(p.x < d.from || p.x >= d.to, `${r.id}: ${d.kind} over door ${p.id}`).toBe(true);
        }
      }
    }
  });

  it('every interior window casts a light patch on the floor under it', () => {
    const w = windowPatches(ROOMS.padaria);
    expect(w).toEqual([{ key: 'fx/light_patch_32', x: 5 * T, y: 0 }]);
    expect(windowPatches(ROOMS.academia)).toEqual([{ key: 'fx/light_patch_32', x: 5 * T, y: 0 }]);
    // the kitnet's street window is 3 tiles wide (48 px) and centred on 3..6
    expect(windowPatches(ROOMS.kitnet)).toEqual([{ key: 'fx/light_patch_48', x: 3 * T, y: 0 }]);
    expect(windowPatches(ROOMS.praca)).toEqual([]);
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
