/**
 * Catalog of every generated Phase 0 art asset. The studio page (/art.html) renders this list;
 * `pnpm art` bakes it to PNG/SVG under apps/client/public/art + contact sheets in docs/art.
 */
import {
  BODY_TYPES,
  BOTTOM_STYLES,
  DEFAULT_APPEARANCE,
  FURNITURE,
  HAIR_COLORS,
  HAIR_STYLES,
  HATS,
  LABELS,
  MG_ITEMS,
  ROOMS,
  SKIN_TONES,
  TOP_STYLES,
  furnitureById,
  propTiles,
  type Appearance,
  type Bilingual,
  type FloorKind,
  type PropDef,
  type RoomDef,
} from '@tudobem/shared';
import type { Ctx } from '../render/draw';
import { drawFurniture, drawProp, SLICED_PROPS } from '../render/props';
import { drawAvatar } from '../render/avatar';
import { drawFoodIcon, drawHatIcon } from '../render/icons';
import { drawFloorTile, drawRoomStatic } from '../render/room';
import { tileCenter } from '../render/iso';
import { ANIMATED_FURNITURE, ANIMATED_PROPS, propKey } from './sprites';

export type ArtCategory = 'props' | 'furniture' | 'hats' | 'food' | 'avatars' | 'tiles' | 'rooms';

export interface ArtAsset {
  key: string;
  category: ArtCategory;
  label: Bilingual;
  /** Used as a runtime sprite (vs. review-only / live-animated). */
  runtime: boolean;
  animated?: boolean;
  /** Drawing area in world units relative to the anchor (0,0). */
  bounds: { x: number; y: number; w: number; h: number };
  /** Crop to opaque pixels when baking (sprites) vs keep the full box (icons, sheets). */
  crop: boolean;
  /** Bake resolution multiplier. */
  scale: number;
  draw: (ctx: Ctx) => void;
}

const SPRITE_BOUNDS = { x: -170, y: -260, w: 340, h: 360 };

const PROP_LABELS: Partial<Record<PropDef['kind'], Bilingual>> = {
  ipe: { pt: 'Ipê amarelo', en: 'Yellow ipê tree' },
  banco: { pt: 'Banco de praça', en: 'Park bench' },
  poste: { pt: 'Poste', en: 'Street lamp' },
  banca: { pt: 'Banca de jornal', en: 'Newsstand' },
  barraca_chapeus: { pt: 'Barraca de chapéus', en: 'Hat stall' },
  quiosque: { pt: 'Quiosque de missões', en: 'Quest kiosk' },
  poleiro: { pt: 'Poleiro do papagaio', en: 'Parrot perch' },
  canteiro: { pt: 'Canteiro', en: 'Flower planter' },
  lixeira: { pt: 'Lixeira laranjinha', en: 'Orange SP trash bin' },
  bicicletario: { pt: 'Bicicletário', en: 'Bike rack' },
  balcao: { pt: 'Balcão', en: 'Counter' },
  vitrine: { pt: 'Vitrine de doces', en: 'Sweets display' },
  estufa: { pt: 'Estufa de salgados', en: 'Warm snack display' },
  caixa: { pt: 'Caixa', en: 'Cash register' },
  banqueta: { pt: 'Banqueta', en: 'Counter stool' },
  mesa: { pt: 'Mesa de mármore', en: 'Marble table' },
  cadeira_padaria: { pt: 'Cadeira de padaria', en: 'Bakery chair' },
  trilho_pedidos: { pt: 'Trilho de pedidos', en: 'Order ticket rail' },
  vaso: { pt: 'Vaso', en: 'Plant pot' },
  cama: { pt: 'Cama', en: 'Bed' },
  cozinha: { pt: 'Cozinha americana', en: 'Kitchenette' },
  orelhao: { pt: 'Orelhão', en: 'Public phone booth' },
  placa_rua: { pt: 'Placa de rua', en: 'Street sign' },
  mesa_cafe: { pt: 'Mesinha da padaria', en: 'Bakery sidewalk table' },
  jornais: { pt: 'Pilha de jornais', en: 'Newspaper stack' },
  saco_lixo: { pt: 'Saco de lixo', en: 'Trash bag' },
  floreira: { pt: 'Floreira', en: 'Concrete planter' },
};

function propAssets(): ArtAsset[] {
  const seen = new Set<string>();
  const out: ArtAsset[] = [];
  for (const room of Object.values(ROOMS)) {
    for (const p of room.props) {
      const slices = SLICED_PROPS.has(p.kind) ? propTiles(p).length : 1;
      for (let i = 0; i < slices; i++) {
        const key = propKey(p, i) ?? `props/${p.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const animated = ANIMATED_PROPS.has(p.kind);
        const base = PROP_LABELS[p.kind] ?? { pt: p.kind, en: p.kind };
        const suffix = p.seat ? ` · ${p.seat}` : slices > 1 ? ` · ${i + 1}/${slices}` : '';
        out.push({
          key,
          category: 'props',
          label: { pt: base.pt + suffix, en: base.en + (animated ? ' (animated — live)' : '') },
          runtime: !animated,
          animated,
          bounds: SPRITE_BOUNDS,
          crop: true,
          scale: 3,
          draw: (ctx) => drawProp(ctx, p, 0, 0, 0, i, { parrotAdopted: false }),
        });
      }
    }
  }
  return out;
}

function furnitureAssets(): ArtAsset[] {
  return FURNITURE.flatMap((f) =>
    ([0, 1] as const).map((rot) => ({
      key: `furniture/${f.id}_${rot}`,
      category: 'furniture' as const,
      label: { pt: `${f.pt}${rot ? ' (girada)' : ''}`, en: `${f.en}${ANIMATED_FURNITURE.has(f.kind) ? ' (animated — live)' : ''}` },
      runtime: !ANIMATED_FURNITURE.has(f.kind),
      animated: ANIMATED_FURNITURE.has(f.kind),
      bounds: SPRITE_BOUNDS,
      crop: true,
      scale: 3,
      draw: (ctx: Ctx) => drawFurniture(ctx, furnitureById(f.id)!, rot, 0, 0, 0.4),
    })),
  );
}

const iconBox = { x: 0, y: 0, w: 64, h: 64 };

function hatAssets(): ArtAsset[] {
  return HATS.map((h) => ({ key: `hats/${h.id}`, category: 'hats', label: { pt: h.pt, en: h.en }, runtime: true, bounds: iconBox, crop: false, scale: 3, draw: (ctx) => drawHatIcon(ctx, h.id) }));
}

function foodAssets(): ArtAsset[] {
  return MG_ITEMS.map((i) => ({ key: `food/${i.id}`, category: 'food', label: { pt: i.card.form, en: i.card.gloss_en }, runtime: true, bounds: iconBox, crop: false, scale: 3, draw: (ctx) => drawFoodIcon(ctx, i.id) }));
}

function avatarAssets(): ArtAsset[] {
  const out: ArtAsset[] = [];
  const box = { x: -40, y: -112, w: 80, h: 120 };
  const add = (key: string, label: Bilingual, a: Appearance, hat: string | null = null, parrot = false) =>
    out.push({
      key: `avatars/${key}`,
      category: 'avatars',
      label,
      runtime: false,
      bounds: box,
      crop: false,
      scale: 3,
      draw: (ctx) => drawAvatar(ctx, 0, 0, a, hat, parrot, { dir: 'SE', t: 0.3, moving: false, sitting: false }),
    });
  BODY_TYPES.forEach((b, i) => add(`corpo_${b}`, { pt: `Corpo: ${LABELS.body[b]}`, en: 'Body type' }, { ...DEFAULT_APPEARANCE, body: b, skin: i * 3 }));
  SKIN_TONES.forEach((_, i) => add(`pele_${i + 1}`, { pt: `Pele ${i + 1}`, en: 'Skin tone' }, { ...DEFAULT_APPEARANCE, skin: i }));
  HAIR_STYLES.forEach((hs, i) => add(`cabelo_${hs}`, { pt: `Cabelo: ${LABELS.hair[hs]}`, en: 'Hair style' }, { ...DEFAULT_APPEARANCE, hair: hs, hairColor: i % HAIR_COLORS.length, skin: (i * 2) % 8 }));
  TOP_STYLES.forEach((ts, i) => add(`blusa_${ts}`, { pt: `Blusa: ${LABELS.top[ts]}`, en: 'Top' }, { ...DEFAULT_APPEARANCE, top: ts, topColor: i + 2 }));
  BOTTOM_STYLES.forEach((bs, i) => add(`baixo_${bs}`, { pt: `Baixo: ${LABELS.bottom[bs]}`, en: 'Bottoms' }, { ...DEFAULT_APPEARANCE, bottom: bs, bottomColor: i + 5, skin: 5 }));
  for (const n of [...ROOMS.praca.npcs, ...ROOMS.padaria.npcs]) add(`npc_${n.id}`, { pt: n.name, en: n.role.en }, n.appearance, n.hat);
  add('com_papagaio', { pt: 'Com papagaio', en: 'With parrot companion' }, { ...DEFAULT_APPEARANCE, skin: 6, hair: 'black' }, 'bucket_amarelo', true);
  // Back view + poses
  out.push({
    key: 'avatars/poses',
    category: 'avatars',
    label: { pt: 'Poses: costas, sentado, oi, dançar', en: 'Poses: back view, sitting, wave, dance' },
    runtime: false,
    bounds: { x: -170, y: -120, w: 340, h: 128 },
    crop: false,
    scale: 3,
    draw: (ctx) => {
      const a = { ...DEFAULT_APPEARANCE, skin: 4, hair: 'coque' as const, top: 'moletom' as const, topColor: 7 };
      drawAvatar(ctx, -120, 0, a, 'chapeu_palha', false, { dir: 'NE', t: 0.2, moving: false, sitting: false });
      drawAvatar(ctx, -40, 0, a, null, true, { dir: 'SW', t: 0.2, moving: false, sitting: true });
      drawAvatar(ctx, 40, 0, a, 'viseira_azul', false, { dir: 'SE', t: 0.6, moving: false, sitting: false, emote: { kind: 'oi', t0: 0 } });
      drawAvatar(ctx, 120, 0, a, 'cartola', false, { dir: 'SE', t: 0.25, moving: false, sitting: false, emote: { kind: 'dancar', t0: 0 } });
    },
  });
  return out;
}

const FLOORS: { kind: FloorKind; ch: string; label: Bilingual }[] = [
  { kind: 'calcada', ch: 'c', label: { pt: 'Calçada paulista', en: 'São Paulo state-map sidewalk mosaic' } },
  { kind: 'grama', ch: 'g', label: { pt: 'Grama', en: 'Grass' } },
  { kind: 'tijolo', ch: 't', label: { pt: 'Piso de tijolo', en: 'Brick pavers' } },
  { kind: 'ladrilho', ch: 'l', label: { pt: 'Ladrilho hidráulico', en: 'Hydraulic cement tile (padaria)' } },
  { kind: 'madeira', ch: 'm', label: { pt: 'Taco de madeira', en: 'Hardwood block parquet (kitnet)' } },
];

function tileAssets(): ArtAsset[] {
  return FLOORS.map((f) => {
    const fake = { ...ROOMS.praca, cols: 3, rows: 3, floor: [f.ch.repeat(3), f.ch.repeat(3), f.ch.repeat(3)] } as RoomDef;
    return {
      key: `tiles/${f.kind}`,
      category: 'tiles' as const,
      label: f.label,
      runtime: false,
      bounds: { x: -100, y: -4, w: 200, h: 104 },
      crop: false,
      scale: 3,
      draw: (ctx: Ctx) => {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) drawFloorTile(ctx, fake, x, y);
      },
    };
  });
}

function roomAssets(): ArtAsset[] {
  return Object.values(ROOMS).map((room) => {
    const pad = room.id === 'praca' ? 150 : 40;
    const x0 = -room.rows * 32 - pad;
    const x1 = room.cols * 32 + pad;
    const y0 = -room.wallHeight - (room.id === 'praca' ? 230 : 30);
    const y1 = (room.cols + room.rows) * 16 + 24;
    return {
      key: `rooms/${room.id}`,
      category: 'rooms' as const,
      label: { pt: room.name, en: `${room.gloss} — background + props` },
      runtime: false,
      bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      crop: false,
      scale: 1.5,
      draw: (ctx: Ctx) => {
        drawRoomStatic(ctx, room);
        const items: { d: number; f: () => void }[] = [];
        for (const p of room.props) {
          propTiles(p).forEach((t, i) => {
            if (!SLICED_PROPS.has(p.kind) && i > 0) return;
            const c = tileCenter(SLICED_PROPS.has(p.kind) ? t.x : p.x, SLICED_PROPS.has(p.kind) ? t.y : p.y);
            const d = SLICED_PROPS.has(p.kind) ? t.x + t.y : p.x + (p.w ?? 1) - 1 + p.y + (p.h ?? 1) - 1;
            items.push({ d, f: () => drawProp(ctx, p, c.sx, c.sy, 0.3, i) });
          });
        }
        for (const n of room.npcs) {
          const c = tileCenter(n.x, n.y);
          items.push({ d: n.x + n.y + 0.02, f: () => drawAvatar(ctx, c.sx, c.sy, n.appearance, n.hat, false, { dir: n.dir, t: 0.4, moving: false, sitting: false }) });
        }
        if (room.id === 'kitnet') {
          const demo: [string, number, number, 0 | 1][] = [['tapete', 3, 4, 0], ['cadeira_madeira', 2, 3, 0], ['rede', 4, 6, 0], ['filtro', 3, 1, 0], ['planta', 5, 3, 0], ['gato', 4, 3, 0]];
          for (const [id, x, y, rot] of demo) {
            const c = tileCenter(x, y);
            items.push({ d: id === 'tapete' ? -1 : x + y, f: () => drawFurniture(ctx, furnitureById(id)!, rot, c.sx, c.sy, 0.3) });
          }
        }
        items.sort((a, b) => a.d - b.d).forEach((i) => i.f());
      },
    };
  });
}

export function allAssets(): ArtAsset[] {
  return [...roomAssets(), ...tileAssets(), ...propAssets(), ...furnitureAssets(), ...hatAssets(), ...foodAssets(), ...avatarAssets()];
}

export const CATEGORY_LABELS: Record<ArtCategory, Bilingual> = {
  rooms: { pt: 'Salas', en: 'Rooms — isometric backgrounds with props (review render)' },
  tiles: { pt: 'Pisos', en: 'Floor tiles' },
  props: { pt: 'Objetos', en: 'Room props (runtime sprites; animated ones stay live)' },
  furniture: { pt: 'Móveis', en: 'Kitnet furniture, both rotations' },
  hats: { pt: 'Chapéus', en: 'Hat shop icons' },
  food: { pt: 'Comidas', en: '“Me vê um…” items' },
  avatars: { pt: 'Avatares', en: 'Paper-doll parts, NPCs and poses' },
};
