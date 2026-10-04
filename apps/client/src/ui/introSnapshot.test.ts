import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import type { Manifest } from '../render/pixel/manifest';
import { T } from '../render/pixel/coords';
import { terrainTiles } from '../render/pixel/terrainPlan';
import { FLOOR_SUBSTITUTE } from '../render/pixel/roomLayout';
import { SNAPSHOT_MINUTE, VILA_SNAPSHOT, planSnapshot, planVilaSnapshot } from './introSnapshot';
import { PAN_ROUTE, introZoom, mapOffset, panCenter } from './introCamera';

const root = path.resolve(__dirname, '../../public/pixel');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as Manifest;
const atlas = JSON.parse(fs.readFileSync(path.join(root, manifest.atlases.outdoor.data), 'utf8')) as { frames: Record<string, unknown> };
const rua = ROOMS.rua;
const praca = ROOMS.praca;
const leste = ROOMS.rua_leste;
const vilaCols = rua.cols + leste.cols;

describe('intro snapshot of Vila Ipê (the rua above the praça, split into areas)', () => {
  const plan = planVilaSnapshot(manifest);

  it('is one 640 x 640 picture at 1 canvas px per art px: the rua across the top, the praça under it on the shared brick path', () => {
    expect(plan.width).toBe(VILA_SNAPSHOT.width);
    expect(plan.height).toBe(VILA_SNAPSHOT.height);
    expect(plan.width).toBe(vilaCols * T);
    expect(vilaCols).toBe(40);
    expect(VILA_SNAPSHOT.praca.y).toBe(rua.rows * T);
    // the rua's brick path (portals x15-18) lines up with the praça's entrance (x14-17)
    const ruaPath = rua.portals.filter((p) => p.edge && p.to === 'praca').map((p) => p.x);
    const pracaIn = praca.portals.filter((p) => p.edge && p.to === 'rua').map((p) => p.x + VILA_SNAPSHOT.praca.x / T);
    expect(ruaPath).toEqual(pracaIn);
    expect(VILA_SNAPSHOT.praca.y / T + praca.rows).toBe(vilaCols);
    expect(VILA_SNAPSHOT.praca.x / T + praca.cols).toBeLessThanOrEqual(vilaCols);
  });

  it('uses the same terrain tiles as the game for each area and only frames that exist in the atlas', () => {
    const tilesOf = (def: typeof rua) => terrainTiles(def.floor, manifest.terrain, { substitute: FLOOR_SUBSTITUTE }).tiles.length;
    // rua + rua_leste + praça + the two lawn corners
    const own = [rua, leste, praca].reduce((n, d) => n + planSnapshot(d, manifest).ops.filter((o) => o.kind === 'tile').length, 0);
    expect(own).toBe(tilesOf(rua) + tilesOf(leste) + tilesOf(praca));
    expect(plan.ops.filter((o) => o.kind === 'tile').length).toBeGreaterThan(own);
    for (const o of plan.ops) {
      if (o.kind === 'tile') expect(o.idx).toBeLessThan(manifest.terrain.count);
      else expect(atlas.frames[o.frame], o.frame).toBeDefined();
    }
  });

  it('draws the real buildings, the fountain, the bus stop, the dog and the ipê canopies, in depth order', () => {
    const frames = new Set(plan.ops.flatMap((o) => (o.kind === 'sprite' ? [o.frame] : [])));
    for (const key of ['props/fountain', 'props/ponto_onibus', 'critters/vira_lata_sleep_e/0'])
      expect(frames.has(manifest.sprites[key]?.frame ?? key), key).toBe(true);
    const padaria = rua.props.find((p) => p.kind === 'fachada' && p.art?.includes('padaria'));
    expect(padaria).toBeDefined();
    expect(frames.has(manifest.sprites[padaria!.art!].frame)).toBe(true);
    for (let i = 1; i < plan.ops.length; i++) expect(plan.ops[i].depth).toBeGreaterThanOrEqual(plan.ops[i - 1].depth);
    // canopies and wires come last (above everything that stands)
    expect(plan.ops.at(-1)!.depth).toBeGreaterThan(50000);
  });

  it('is graded for golden hour 17:30 with long cast shadows', () => {
    expect(SNAPSHOT_MINUTE).toBe(17 * 60 + 30);
    expect(plan.cast).toBeGreaterThan(0.2);
    // warm: red at least as strong as blue in the multiply grade
    expect(plan.grade[0]).toBeGreaterThanOrEqual(plan.grade[2]);
  });
});

describe('intro pan camera', () => {
  it('uses whole zooms: 2 on a phone, 4 at 1280x800', () => {
    expect(introZoom(390, 844)).toBe(2);
    expect(introZoom(1280, 800)).toBe(3);
    for (const [w, h] of [[360, 640], [768, 1024], [1440, 900], [1920, 1080], [2560, 1440]]) {
      const z = introZoom(w, h);
      expect(Number.isInteger(z)).toBe(true);
      expect(z).toBeGreaterThanOrEqual(2);
      expect(z).toBeLessThanOrEqual(5);
    }
  });

  it('pans there and back slowly, stopping softly at each end', () => {
    const a = panCenter(0);
    const b = panCenter(PAN_ROUTE.legSec);
    expect(a).toEqual(PAN_ROUTE.from);
    expect(b.x).toBeCloseTo(PAN_ROUTE.to.x, 6);
    const back = panCenter(PAN_ROUTE.legSec * 2);
    expect(back.x).toBeCloseTo(PAN_ROUTE.from.x, 6);
    // never faster than 6 art px per second
    let maxV = 0;
    for (let t = 0; t < PAN_ROUTE.legSec * 2; t += 0.5) maxV = Math.max(maxV, Math.hypot(panCenter(t + 0.5).x - panCenter(t).x, panCenter(t + 0.5).y - panCenter(t).y) / 0.5);
    expect(maxV).toBeLessThan(6);
    // a stop at each end
    expect(Math.abs(panCenter(0.5).x - panCenter(0).x)).toBeLessThan(0.05);
  });

  it('never shows the void beyond the map and lands on whole device pixels', () => {
    const mapW = VILA_SNAPSHOT.width;
    const mapH = VILA_SNAPSHOT.height;
    for (const [vw, vh, dpr] of [[1280, 800, 1], [390, 844, 3], [1440, 900, 2]]) {
      const zoom = introZoom(vw, vh);
      for (let t = 0; t < PAN_ROUTE.legSec * 2; t += 7) {
        const o = mapOffset(panCenter(t), zoom, vw, vh, mapW, mapH, dpr);
        expect(o.tx).toBeLessThanOrEqual(0);
        expect(o.ty).toBeLessThanOrEqual(0);
        expect(o.tx + mapW * zoom).toBeGreaterThanOrEqual(vw - 1e-6);
        expect(o.ty + mapH * zoom).toBeGreaterThanOrEqual(vh - 1e-6);
        expect(Number.isInteger(Math.round(o.tx * dpr * 1000) / 1000)).toBe(true);
        expect((o.tx * dpr) % 1).toBeCloseTo(0, 6);
      }
    }
  });
});
