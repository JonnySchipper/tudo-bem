import type { RoomId, Tile } from './types.js';

/**
 * Readable world (HOWTO Phase 7 step 2): signs, menus, posters, headlines. The server validates `read` messages against this list
 * (same room, within `HOTSPOT_READ_RANGE` tiles of the footprint), pays the recado `ler` step and records the cards as seen.
 */
export interface HotspotDef {
  id: string;
  room: RoomId;
  /** Top-left tile of the footprint (the spot you read it from is measured to this rectangle). */
  x: number;
  y: number;
  /** Footprint in tiles (default 1x1). */
  w?: number;
  h?: number;
  /**
   * Interiors only: art tiles above the footprint that also take the click (a sign painted high on the north wall). The read distance
   * is still measured to the footprint, so the footprint stays on the floor row the wall sits behind.
   */
  up?: number;
  /** The text as it is painted, large on the card. Lines are separated by `\n`. */
  pt: string;
  en: string;
  /** Curriculum card ids this text teaches. */
  cards?: string[];
}

// ---------------------------------------------------------------- the readable world (needs_br: every pt/en below is a new string)
//
// Coordinates come from Vila Ipê (`praca`, Phase 5) and the interiors. A sign painted high on a building is given a footprint that comes down
// to within 3 tiles of the sidewalk (rows 6-7), so it can be read from the street. Hotspots never overlap a door (portal) or a prop with an action.
// Prices agree with `PRICES` in carlos.ts (the Carlos scene) and are tested against it.

export const HOTSPOTS: HotspotDef[] = [
  // ---- Vila Ipê, north row: the building fronts
  { id: 'padaria_letreiro', room: 'rua', x: 3, y: 1, w: 4, h: 3, pt: 'PADARIA\nDO SEU CARLOS', en: 'Bakery\nof Seu Carlos' },
  { id: 'empena_tudo_bem', room: 'rua', x: 8, y: 1, w: 3, h: 3, pt: 'TUDO BEM?', en: 'How’s it going?', cards: ['lex.social.tudo_bem'] },
  { id: 'edificio_letreiro', room: 'rua', x: 11, y: 1, w: 3, h: 3, pt: 'EDIFÍCIO IPÊ', en: 'Ipê Building' },
  { id: 'edificio_numero', room: 'rua', x: 12, y: 4, pt: 'Nº 42', en: 'No. 42' },
  { id: 'academia_letreiro', room: 'rua', x: 23, y: 1, w: 6, h: 3, pt: 'ACADEMIA\nDO BAIRRO', en: 'Neighborhood\nacademy' },
  { id: 'banca_manchetes', room: 'rua', x: 8, y: 4, w: 3, h: 2, pt: 'BANCA\nHOJE: Chuva à noite\nFeira livre: todo dia, 6h às 13h\nPadaria faz festa',
    en: 'NEWSSTAND\nToday: Rain tonight\nStreet market: every day, 6 am to 1 pm\nBakery throws a party',
  },
  // ---- Vila Ipê, north sidewalk
  { id: 'placa_rua_ipes', room: 'rua', x: 22, y: 6, w: 1, h: 2, pt: 'R. DOS IPÊS', en: 'Ipê Street' },
  { id: 'orelhao', room: 'rua', x: 14, y: 6, pt: 'ORELHÃO\nTelefone público', en: 'PAYPHONE (“big ear”)\nPublic phone' },
  { id: 'lixeira_padaria', room: 'rua', x: 10, y: 6, pt: 'LIXO', en: 'Trash' },
  { id: 'mesa_cafe_precos', room: 'rua', x: 1, y: 6, pt: 'Café R$ 4\nPão na chapa R$ 6',
    en: 'Coffee R$ 4\nGrilled buttered bread R$ 6',
    cards: ['lex.padaria.cafe', 'lex.padaria.pao_na_chapa'],
  },
  { id: 'bicicletario', room: 'rua', x: 12, y: 7, pt: 'BICICLETÁRIO', en: 'Bike rack' },
  // ---- Vila Ipê, south sidewalk and the praça
  { id: 'ponto_onibus', room: 'rua', x: 27, y: 12, w: 3, h: 1, pt: 'ÔNIBUS\nLinha 875 · Centro', en: 'BUS\nLine 875 · Downtown' },
  { id: 'parquimetro', room: 'rua', x: 16, y: 12, pt: 'ESTACIONAMENTO\nR$ 5 por hora', en: 'PARKING\nR$ 5 per hour' },
  { id: 'lixeira_praca', room: 'rua', x: 23, y: 13, pt: 'LIXO', en: 'Trash' },
  { id: 'fonte_praca', room: 'praca', x: 14, y: 10, w: 4, h: 3, pt: 'Praça Central\nFonte de 1985', en: 'Central Square\nFountain from 1985' },
  // ---- V2 composition pass (needs_br: every line; invented facts: the founder's name and the year)
  { id: 'busto_placa', room: 'praca', x: 7, y: 5, w: 2, h: 2, pt: 'DONA IPÊ\nFundadora da Vila\n1897', en: 'DONA IPÊ\nFounder of the village\n1897' },
  { id: 'coreto_placa', room: 'praca', x: 23, y: 4, w: 5, h: 3, pt: 'CORETO DA PRAÇA\nBanda toda domingo, às 10h', en: 'THE BANDSTAND\nBand every Sunday, 10 am' },
  { id: 'mesa_domino_placa', room: 'praca', x: 22, y: 17, pt: 'DOMINÓ\nQuem perde paga o café', en: 'DOMINOES\nLoser buys the coffee' },
  { id: 'pipoqueiro_placa', room: 'praca', x: 18, y: 21, w: 3, h: 1, pt: 'PIPOCA\nR$ 5 o saquinho', en: 'POPCORN\nR$ 5 a bag' },
  { id: 'coco_placa', room: 'praca', x: 24, y: 9, w: 3, h: 1, pt: 'ÁGUA DE COCO\nGeladinha · R$ 7', en: 'COCONUT WATER\nIce cold · R$ 7' },
  // ---- the feira livre (Phase 9). needs_br: every line. Prices equal `GOODS` in feira.ts (tested).
  { id: 'feira_livre', room: 'feira', x: 6, y: 1, w: 5, h: 1, pt: 'FEIRA LIVRE\nTodo dia · 6h às 13h', en: 'STREET MARKET\nEvery day · 6 am to 1 pm' },
  { id: 'feira_preco_frutas', room: 'feira', x: 5, y: 5, pt: 'FRUTAS DA TIA LU\nBanana R$ 2\n3 bananas R$ 5\nLaranja R$ 1\nMaçã R$ 1,50\nFlores R$ 12',
    en: 'TIA LU’S FRUIT\nBanana R$ 2\n3 bananas R$ 5\nOrange R$ 1\nApple R$ 1.50\nFlowers R$ 12',
  },
  { id: 'feira_preco_verduras', room: 'feira', x: 11, y: 5, pt: 'VERDURAS DO SEU ZÉ\nAlface R$ 3,50\nTomate R$ 2,50',
    en: 'SEU ZÉ’S VEGETABLES\nLettuce R$ 3.50\nTomato R$ 2.50',
  },
  { id: 'feira_preco_pastel', room: 'feira', x: 5, y: 13, pt: 'PASTEL E CALDO DE CANA\nPastel R$ 6\nCaldo de cana R$ 5',
    en: 'PASTEL AND SUGARCANE JUICE\nPastel R$ 6\nSugarcane juice R$ 5',
    cards: ['lex.padaria.pastel'],
  },
  { id: 'feira_preco_flores', room: 'feira', x: 11, y: 13, pt: 'FLORES DA DONA ROSA\nBuquê R$ 12', en: 'DONA ROSA’S FLOWERS\nBunch R$ 12' },
  { id: 'hortifruti_placa', room: 'rua', x: 5, y: 6, pt: 'HORTIFRÚTI\nBanana R$ 2\nLaranja R$ 1\nMaçã R$ 1,50\nAlface R$ 3,50\nTomate R$ 2,50\nFlores R$ 12\nAberto o dia todo',
    en: 'GREENGROCER\nBanana R$ 2\nOrange R$ 1\nApple R$ 1.50\nLettuce R$ 3.50\nTomato R$ 2.50\nFlowers R$ 12\nOpen all day',
  },
  // ---- Padaria do Seu Carlos
  {
    id: 'padaria_cardapio',
    room: 'padaria',
    x: 8,
    y: 0,
    w: 2,
    h: 1,
    up: 2,
    pt: 'CARDÁPIO\nPão na chapa R$ 6\nCoxinha R$ 7\nPastel R$ 8\nCafé R$ 4\nCafé com leite R$ 5\nSuco de laranja R$ 8\nÁgua R$ 3',
    en: 'MENU\nGrilled buttered bread R$ 6\nChicken croquette R$ 7\nFried pastry R$ 8\nCoffee R$ 4\nCoffee with milk R$ 5\nOrange juice R$ 8\nWater R$ 3',
    cards: ['lex.padaria.pao_na_chapa', 'lex.padaria.coxinha', 'lex.padaria.pastel', 'lex.padaria.cafe', 'lex.padaria.cafe_com_leite', 'lex.padaria.suco_de_laranja', 'lex.padaria.agua'],
  },
  { id: 'padaria_prateleira', room: 'padaria', x: 1, y: 0, w: 4, h: 1, up: 2, pt: 'PADARIA DO SEU CARLOS\nDesde 1978', en: 'SEU CARLOS’S BAKERY\nSince 1978' },
  { id: 'padaria_caixa', room: 'padaria', x: 0, y: 2, pt: 'CAIXA\nAceitamos Pix', en: 'CASHIER\nWe take Pix (instant transfer)' },
  {
    id: 'padaria_estufa',
    room: 'padaria',
    x: 7,
    y: 2,
    pt: 'Salgado bem quente!\nCoxinha R$ 7 · Pastel R$ 8',
    en: 'Nice and hot snacks!\nChicken croquette R$ 7 · Fried pastry R$ 8',
    cards: ['lex.padaria.bem_quente', 'lex.padaria.coxinha', 'lex.padaria.pastel'],
  },
  // ---- Kitnet
  { id: 'kitnet_poster_sp', room: 'kitnet', x: 1, y: 0, w: 2, h: 1, up: 2, pt: 'SÃO PAULO\nA cidade que não para', en: 'SÃO PAULO\nThe city that never stops' },
  { id: 'kitnet_fotos', room: 'kitnet', x: 6, y: 0, w: 2, h: 1, up: 2, pt: 'Minha família\ne meus amigos', en: 'My family\nand my friends' },
  // ---- Academia do Bairro
  { id: 'academia_regras', room: 'academia', x: 0, y: 0, w: 1, h: 1, up: 3, pt: 'REGRAS\n1. Tire os sapatos.\n2. Respeite o parceiro.\n3. Cumprimente com um sorriso.', en: 'RULES\n1. Take off your shoes.\n2. Respect your partner.\n3. Greet with a smile.' },
  { id: 'academia_mural', room: 'academia', x: 7, y: 0, w: 4, h: 1, up: 2, pt: 'TREINO\nCOMUNIDADE', en: 'TRAINING\nCOMMUNITY' },
  { id: 'academia_horarios', room: 'academia', x: 10, y: 4, pt: 'AULAS\nSegunda a sexta: 18h\nSábado: 10h', en: 'CLASSES\nMonday to Friday: 6 pm\nSaturday: 10 am' },
  { id: 'academia_faixas', room: 'academia', x: 0, y: 1, w: 1, h: 2, pt: 'FAIXAS\nbranca · azul · roxa\nmarrom · preta', en: 'BELTS\nwhite · blue · purple\nbrown · black' },
  { id: 'academia_vestiario', room: 'academia', x: 0, y: 7, pt: 'VESTIÁRIO\nGuarde suas coisas aqui', en: 'CHANGING ROOM\nKeep your things here' },
];

export const hotspotById = (id: string): HotspotDef | undefined => HOTSPOTS.find((h) => h.id === id);

export const hotspotsInRoom = (room: RoomId): HotspotDef[] => HOTSPOTS.filter((h) => h.room === room);

/** You can read a hotspot from this many tiles away (Chebyshev, measured to its nearest tile). */
export const HOTSPOT_READ_RANGE = 3;

/** Chebyshev distance between two tiles (diagonal steps count as 1, like the door check). */
export const tileDistance = (a: Tile, b: Tile): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Distance from a tile to the nearest tile of the hotspot's footprint. */
export function hotspotDistance(h: Pick<HotspotDef, 'x' | 'y' | 'w' | 'h'>, tile: Tile): number {
  const w = Math.max(1, h.w ?? 1);
  const hh = Math.max(1, h.h ?? 1);
  const dx = Math.max(h.x - tile.x, 0, tile.x - (h.x + w - 1));
  const dy = Math.max(h.y - tile.y, 0, tile.y - (h.y + hh - 1));
  return Math.max(dx, dy);
}

/** The hotspots of a room that can be read from a tile (within `range`, default the read range), nearest first. Drives the 👁 cue. */
export function hotspotsNear(room: RoomId, tile: Tile, range = HOTSPOT_READ_RANGE, list: readonly HotspotDef[] = HOTSPOTS): HotspotDef[] {
  return list
    .filter((h) => h.room === room)
    .map((h) => ({ h, d: hotspotDistance(h, tile) }))
    .filter((e) => e.d <= range)
    .sort((a, b) => a.d - b.d)
    .map((e) => e.h);
}

/** World-space box (in tiles, fractional not needed) that takes the click: the footprint plus `up` rows above it. */
export function hotspotBox(h: Pick<HotspotDef, 'x' | 'y' | 'w' | 'h' | 'up'>): { x0: number; y0: number; x1: number; y1: number } {
  const w = Math.max(1, h.w ?? 1);
  const hh = Math.max(1, h.h ?? 1);
  return { x0: h.x, y0: h.y - Math.max(0, h.up ?? 0), x1: h.x + w, y1: h.y + hh };
}

/** Where the 👁 cue floats: the middle of the top edge of the click box, in tile units (a fractional x for an even width). */
export function hotspotCueSpot(h: Pick<HotspotDef, 'x' | 'y' | 'w' | 'h' | 'up'>): { x: number; y: number } {
  const b = hotspotBox(h);
  return { x: (b.x0 + b.x1 - 1) / 2, y: b.y0 };
}

/**
 * The tile to walk to before reading: among the tiles `walkable` accepts (and within `range` of the footprint), the one nearest to `from`
 * (Chebyshev, then straight-line, then the smaller distance to the sign). Null when none is close enough.
 */
export function readSpot(
  h: Pick<HotspotDef, 'x' | 'y' | 'w' | 'h'>,
  from: Tile,
  walkable: (x: number, y: number) => boolean,
  range = HOTSPOT_READ_RANGE,
): Tile | null {
  const w = Math.max(1, h.w ?? 1);
  const hh = Math.max(1, h.h ?? 1);
  let best: { t: Tile; d: number; e: number; sign: number } | null = null;
  for (let y = h.y - range; y <= h.y + hh - 1 + range; y++) {
    for (let x = h.x - range; x <= h.x + w - 1 + range; x++) {
      if (x < 0 || y < 0 || !walkable(x, y)) continue;
      const t = { x, y };
      const sign = hotspotDistance(h, t);
      if (sign > range) continue;
      const d = tileDistance(from, t);
      const e = (from.x - x) ** 2 + (from.y - y) ** 2;
      if (!best || d < best.d || (d === best.d && (e < best.e || (e === best.e && sign < best.sign)))) best = { t, d, e, sign };
    }
  }
  return best?.t ?? null;
}

/** First line of the text: the hover label / card title. */
export const hotspotTitle = (h: Pick<HotspotDef, 'pt' | 'en'>): { pt: string; en: string } => ({ pt: h.pt.split('\n')[0] ?? h.pt, en: h.en.split('\n')[0] ?? h.en });
