/**
 * The Mapa: one illustrated pixel map of Vila Ipê where every place is its own button. Pure data and rules (no DOM), so the panel
 * (`townMap.ts`) and the tests share them: where each place sits, the pixels it is drawn with, and what a tap on it does.
 *
 * Every room in the shared room list has an entry in `ROOM_ON_MAP` (a new RoomId fails to compile until it is placed or routed through
 * another place). Praia and Fazenda are drawn on the map edges as "Em breve": tapping them shows a teaser, never travel.
 */
import { ROOMS, ROOM_IDS, type RoomId } from '@tudobem/shared';

/** The map is MAP_W × MAP_H art pixels; the panel scales it up with crisp edges. */
export const MAP_W = 320;
export const MAP_H = 200;

/** One art pixel run: x, y, width, height, fill. */
export type Px = readonly [x: number, y: number, w: number, h: number, fill: string];
/** A tap area in art pixels. */
export type Box = readonly [x: number, y: number, w: number, h: number];

export type SoonId = 'praia' | 'fazenda';

export interface MapSpot {
  /** A RoomId for a real place, or a coming-soon id. */
  id: RoomId | SoonId;
  /** Where a tap travels; null for the coming-soon places. */
  room: RoomId | null;
  pt: string;
  en: string;
  /** The tap areas (the place itself is the button); the first one anchors the label and the "você está aqui" pin. */
  hit: Box[];
  art: Px[];
  soon?: { pt: string; en: string };
}

// ---------------------------------------------------------------- palette (the game's warm São Paulo afternoon)

const C = {
  ink: '#3a2a22',
  grass: '#7fb85a',
  grassDark: '#5f9a44',
  grassLight: '#9ccc6a',
  calcada: '#ece4d3',
  calcadaDark: '#cfc4b0',
  asfalto: '#4a474d',
  asfaltoLight: '#5c5a5f',
  faixa: '#f2c230',
  white: '#fbfbf7',
  cream: '#f5e6d3',
  terracota: '#c45c26',
  terracotaDark: '#a8452c',
  tijolo: '#b8573a',
  mustard: '#d4a017',
  ipe: '#f5cf3f',
  ipeDark: '#d9a92a',
  trunk: '#8b5e3c',
  wood: '#b98555',
  glass: '#a8c5d4',
  glassDark: '#6f98ad',
  concrete: '#9a9a92',
  concreteDark: '#76736e',
  blue: '#2b5ba8',
  academia: '#2f5f7a',
  academiaLight: '#8ab4c8',
  escola: '#2f6f4e',
  escolaLight: '#c9e2c2',
  red: '#d9532b',
  green: '#2e9e5b',
  purple: '#7a4fb0',
  pink: '#e889a8',
  orange: '#f08a24',
  water: '#3a8fc4',
  waterLight: '#6cb6e0',
  sea: '#2d79b0',
  foam: '#e8f4f8',
  sand: '#ecd49a',
  sandDark: '#d8bb7a',
  straw: '#e2c078',
  barn: '#b8401f',
  soil: '#8a5a36',
  soilDark: '#734a2c',
  crop: '#6aa84f',
} as const;

// ---------------------------------------------------------------- pixel helpers

const r = (x: number, y: number, w: number, h: number, fill: string): Px => [x, y, w, h, fill];

/** A box with a 1 px ink outline. */
function framed(x: number, y: number, w: number, h: number, fill: string, edge: string = C.ink): Px[] {
  return [r(x, y, w, h, edge), r(x + 1, y + 1, w - 2, h - 2, fill)];
}

/** A grid of small windows. */
function windows(x: number, y: number, cols: number, rows: number, dx: number, dy: number, fill: string, size: [number, number] = [3, 3]): Px[] {
  const out: Px[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push(r(x + i * dx, y + j * dy, size[0], size[1], fill), r(x + i * dx, y + j * dy, size[0], 1, C.white));
  return out;
}

/** A round-ish tree crown on a trunk; `x`, `y` is the crown's top-left. */
function tree(x: number, y: number, leaf: string = C.grassDark, dark: string = '#3f7a32'): Px[] {
  return [r(x + 3, y + 7, 2, 4, C.trunk), r(x + 1, y, 6, 8, dark), r(x, y + 1, 8, 6, dark), r(x + 1, y + 1, 6, 5, leaf), r(x + 2, y + 1, 2, 2, C.grassLight)];
}

/** The yellow ipê of the Vila's name. */
const ipe = (x: number, y: number) => [...tree(x, y, C.ipe, C.ipeDark), r(x + 2, y + 1, 2, 2, '#fff1a8')];

/** A striped awning (two colours, 2 px stripes) with a scalloped lip. */
function awning(x: number, y: number, w: number, a: string, b: string): Px[] {
  const out: Px[] = [r(x, y, w, 4, C.ink)];
  for (let i = 0; i < w - 2; i += 2) out.push(r(x + 1 + i, y + 1, Math.min(2, w - 2 - i), 3, (i / 2) % 2 === 0 ? a : b));
  for (let i = 0; i < w; i += 4) out.push(r(x + i, y + 4, 2, 1, a));
  return out;
}

/** A street segment: sidewalk, asphalt with a dashed yellow line, sidewalk. */
function street(x: number, y: number, w: number): Px[] {
  const out: Px[] = [r(x, y, w, 4, C.calcada), r(x, y + 3, w, 1, C.calcadaDark), r(x, y + 4, w, 12, C.asfalto), r(x, y + 4, w, 1, C.asfaltoLight), r(x, y + 16, w, 4, C.calcada), r(x, y + 16, w, 1, C.calcadaDark)];
  for (let i = 2; i < w - 4; i += 10) out.push(r(x + i, y + 9, 5, 2, C.faixa));
  return out;
}

/** A fruit-and-veg stall: awning, table, produce. */
function stall(x: number, y: number, a: string, produce: string[]): Px[] {
  const out: Px[] = [r(x + 1, y + 4, 1, 10, C.trunk), r(x + 18, y + 4, 1, 10, C.trunk), ...awning(x, y, 20, a, C.white), ...framed(x + 1, y + 10, 18, 5, C.wood)];
  produce.forEach((p, i) => out.push(r(x + 3 + i * 4, y + 8, 3, 3, p), r(x + 3 + i * 4, y + 8, 1, 1, C.white)));
  return out;
}

/** A parrot on the puleiro (two pixels of body, one of beak). */
const parrot = (x: number, y: number, body: string): Px[] => [r(x, y, 2, 3, body), r(x + 2, y + 1, 1, 1, C.faixa)];

/** A tiny animal: body, head and legs. */
function animal(x: number, y: number, body: string, spot: string | null, w = 7): Px[] {
  const out: Px[] = [r(x, y, w, 4, body), r(x + w, y - 1, 3, 3, body), r(x + 1, y + 4, 1, 2, C.ink), r(x + w - 2, y + 4, 1, 2, C.ink), r(x + w + 2, y, 1, 1, C.ink)];
  if (spot) out.push(r(x + 2, y + 1, 2, 2, spot));
  return out;
}

// ---------------------------------------------------------------- the places

function aeroportoArt(): Px[] {
  const out: Px[] = [...framed(66, 6, 84, 42, C.concrete, C.concreteDark), r(67, 7, 82, 1, '#b4b2aa')];
  // the runway
  out.push(r(70, 38, 76, 8, C.asfalto));
  for (let i = 0; i < 9; i++) out.push(r(72 + i * 8, 41, 4, 1, C.white));
  // the terminal and its glass front
  out.push(...framed(72, 12, 38, 20, C.cream), r(72, 12, 38, 3, C.terracota), ...windows(75, 17, 6, 2, 6, 6, C.glass, [4, 4]), r(89, 26, 4, 5, C.glassDark));
  // the control tower
  out.push(r(118, 14, 4, 18, C.cream), r(118, 14, 1, 18, C.calcadaDark), ...framed(115, 8, 10, 7, C.glass), r(114, 7, 12, 1, C.ink));
  // a plane on the apron
  out.push(r(128, 30, 18, 4, C.white), r(128, 33, 18, 1, C.calcadaDark), r(146, 31, 2, 2, C.white), r(134, 25, 4, 14, C.white), r(134, 25, 4, 1, C.blue), r(134, 38, 4, 1, C.blue), r(128, 27, 3, 3, C.blue), r(128, 30, 1, 3, C.blue));
  for (let i = 0; i < 4; i++) out.push(r(136 + i * 2, 31, 1, 1, C.glassDark));
  // the whole airport sits 2 px higher, clear of the Edifício Ipê's roof
  return out.map(([x, y, w, h, fill]) => r(x, y - 2, w, h, fill));
}

function kitnetArt(): Px[] {
  // Edifício Ipê: a tall cream building, a yellow ipê at its door
  const out: Px[] = [...framed(72, 46, 24, 38, C.cream), r(71, 46, 26, 2, C.terracotaDark), r(72, 48, 24, 1, C.terracota), ...windows(75, 51, 4, 6, 5, 5, C.glass)];
  out.push(...framed(81, 78, 6, 6, C.wood), r(83, 81, 1, 1, C.faixa));
  out.push(...ipe(92, 70));
  return out;
}

function padariaArt(): Px[] {
  const out: Px[] = [...framed(104, 60, 36, 24, '#f2dcc0'), r(103, 58, 38, 3, C.terracotaDark), r(106, 62, 32, 5, C.terracota)];
  // the sign: a loaf in white on the terracota band
  out.push(r(118, 63, 8, 3, C.white), r(119, 64, 6, 1, C.mustard));
  out.push(...awning(105, 68, 34, C.terracota, C.cream));
  // the shop window full of bread, and the door
  out.push(...framed(107, 74, 16, 9, C.glass), r(109, 79, 3, 2, C.mustard), r(113, 78, 4, 3, C.trunk), r(118, 79, 3, 2, C.mustard), ...framed(127, 74, 8, 10, C.wood), r(133, 79, 1, 1, C.faixa));
  return out;
}

function academiaArt(): Px[] {
  const out: Px[] = [...framed(164, 56, 36, 28, C.academia), r(163, 54, 38, 3, C.ink), r(166, 58, 32, 5, C.academiaLight)];
  // the sign: a little belt across the band
  out.push(r(172, 60, 16, 1, C.white), r(178, 59, 4, 3, C.ink), r(186, 60, 6, 1, C.faixa));
  out.push(...windows(167, 66, 5, 1, 6, 0, C.glass, [4, 6]), ...framed(176, 74, 12, 10, C.wood), r(181, 74, 1, 10, C.ink));
  return out;
}

function escolaArt(): Px[] {
  // Escola da Praça: a green schoolhouse with a stepped roof, a bell and the flag
  const out: Px[] = [];
  for (let i = 0; i < 5; i++) out.push(r(204 + i * 2, 60 - i * 2, 34 - i * 4, 2, i % 2 ? C.terracotaDark : C.terracota));
  out.push(...framed(206, 62, 30, 22, C.escola), r(207, 63, 28, 1, C.escolaLight), ...framed(218, 52, 6, 6, C.cream), r(220, 54, 2, 2, C.mustard));
  out.push(...windows(209, 66, 2, 2, 5, 7, C.escolaLight, [3, 4]), ...windows(226, 66, 2, 2, 5, 7, C.escolaLight, [3, 4]), ...framed(217, 74, 8, 10, C.wood));
  // the flag on the roof
  out.push(r(232, 43, 1, 10, C.concreteDark), r(233, 43, 6, 4, C.green), r(235, 44, 2, 2, C.faixa));
  return out;
}

function ruaArt(): Px[] {
  const out = street(66, 84, 94);
  // the newsstand
  out.push(...framed(144, 72, 12, 12, C.green), r(143, 70, 14, 3, C.ink), r(146, 75, 8, 4, C.cream), r(147, 76, 2, 2, C.red), r(150, 76, 2, 2, C.blue));
  return out;
}

function ruaLesteArt(): Px[] {
  const out = street(160, 84, 98);
  // the bus stop (ônibus 875 to the airport) with its sign
  out.push(r(246, 68, 12, 2, C.ink), r(247, 70, 1, 14, C.concreteDark), r(256, 70, 1, 14, C.concreteDark), r(248, 70, 8, 6, C.glass), r(248, 80, 8, 2, C.wood));
  out.push(r(242, 70, 1, 14, C.concreteDark), r(240, 66, 5, 5, C.blue), r(241, 67, 3, 3, C.white));
  return out;
}

function pracaArt(): Px[] {
  const out: Px[] = [...framed(66, 108, 92, 84, C.grass, C.grassDark)];
  // lawn texture
  for (let y = 112; y < 190; y += 6) for (let x = 70 + (Math.floor(y / 6) % 2) * 3; x < 156; x += 7) out.push(r(x, y, 1, 1, C.grassLight));
  // calçada paths crossing at the fountain
  out.push(r(108, 109, 8, 82, C.calcada), r(67, 146, 90, 8, C.calcada));
  for (let i = 0; i < 82; i += 4) out.push(r(110 + ((i / 4) % 2) * 3, 109 + i, 2, 1, C.ink));
  for (let i = 0; i < 90; i += 4) out.push(r(67 + i, 148 + ((i / 4) % 2) * 3, 1, 2, C.ink));
  // the fountain
  out.push(r(100, 141, 24, 18, C.concrete), r(98, 143, 28, 14, C.concrete), r(102, 143, 20, 14, C.water), r(100, 145, 24, 10, C.water), r(104, 145, 6, 2, C.waterLight), r(111, 140, 2, 8, C.cream), r(109, 139, 6, 2, C.waterLight));
  // ipês in the corners
  out.push(...ipe(72, 114), ...ipe(84, 124), ...ipe(72, 166), ...ipe(140, 168), ...tree(128, 172));
  // benches
  out.push(r(86, 140, 10, 2, C.wood), r(86, 142, 1, 2, C.ink), r(95, 142, 1, 2, C.ink), r(128, 158, 10, 2, C.wood), r(128, 160, 1, 2, C.ink), r(137, 160, 1, 2, C.ink));
  // the puleiro: a perch with the parrots
  out.push(r(138, 116, 2, 24, C.trunk), r(126, 118, 26, 2, C.trunk), r(128, 120, 1, 6, C.trunk), r(150, 120, 1, 6, C.trunk), r(132, 136, 14, 4, C.wood));
  out.push(...parrot(128, 115, C.green), ...parrot(133, 115, C.red), ...parrot(143, 115, C.blue), ...parrot(148, 115, C.faixa));
  return out;
}

function feiraArt(): Px[] {
  const out: Px[] = [...framed(166, 108, 90, 84, '#b8aea6', '#8f857e')];
  // paralelepípedos
  for (let y = 110; y < 190; y += 3) for (let x = 168 + (Math.floor(y / 3) % 2) * 2; x < 254; x += 4) out.push(r(x, y, 2, 1, '#a59c96'));
  // two rows of stalls
  out.push(...stall(172, 114, C.red, [C.red, C.orange, C.faixa]), ...stall(198, 114, C.green, [C.crop, C.grassDark, C.purple]), ...stall(224, 114, C.blue, [C.pink, C.faixa, C.red]));
  out.push(...stall(172, 146, C.orange, [C.mustard, C.trunk, C.cream]), ...stall(198, 146, C.purple, [C.pink, C.red, C.white]), ...stall(224, 146, C.terracota, [C.orange, C.crop, C.faixa]));
  // crates and the gate
  out.push(...framed(176, 176, 6, 5, C.wood), ...framed(183, 176, 6, 5, C.wood), r(178, 175, 2, 1, C.orange), r(185, 175, 2, 1, C.crop));
  out.push(...framed(230, 176, 6, 5, C.wood), r(232, 175, 2, 1, C.red), ...framed(210, 178, 8, 6, C.straw));
  return out;
}

function praiaArt(): Px[] {
  const out: Px[] = [r(0, 0, 20, MAP_H, C.sea), r(20, 0, 3, MAP_H, C.foam), r(23, 0, 35, MAP_H, C.sand)];
  for (let y = 4; y < MAP_H; y += 8) out.push(r(3 + (Math.floor(y / 8) % 3) * 4, y, 6, 1, C.waterLight));
  for (let y = 6; y < MAP_H; y += 9) out.push(r(30 + (Math.floor(y / 9) % 4) * 6, y, 1, 1, C.sandDark));
  // the kiosk: straw roof, counter and coconuts
  out.push(r(28, 84, 26, 3, C.straw), r(30, 82, 22, 2, C.straw), r(28, 86, 26, 1, C.mustard), r(30, 87, 1, 14, C.trunk), r(51, 87, 1, 14, C.trunk));
  out.push(...framed(30, 95, 22, 7, C.wood), r(33, 92, 3, 3, C.crop), r(38, 92, 3, 3, C.crop), r(44, 92, 3, 3, C.crop));
  // parasols and towels
  out.push(r(31, 40, 12, 3, C.red), r(33, 38, 8, 2, C.white), r(36, 43, 1, 7, C.trunk), r(30, 50, 8, 3, C.blue));
  out.push(r(37, 140, 12, 3, C.faixa), r(39, 138, 8, 2, C.white), r(42, 143, 1, 7, C.trunk), r(34, 152, 8, 3, C.pink));
  // a coconut palm and a little boat
  out.push(r(46, 58, 2, 14, C.trunk), r(40, 56, 14, 2, C.grassDark), r(42, 54, 10, 2, C.crop), r(46, 58, 2, 1, C.trunk), r(45, 58, 1, 2, C.trunk));
  out.push(r(6, 120, 10, 3, C.wood), r(8, 123, 6, 1, C.trunk), r(10, 112, 1, 8, C.ink), r(11, 112, 4, 6, C.white));
  return out;
}

function fazendaArt(): Px[] {
  const out: Px[] = [r(262, 0, 58, MAP_H, C.grass)];
  for (let y = 4; y < 100; y += 6) for (let x = 266 + ((y / 6) % 2) * 3; x < 318; x += 7) out.push(r(x, y, 1, 1, C.grassLight));
  // the barn
  for (let i = 0; i < 4; i++) out.push(r(274 + i * 2, 30 - i * 2, 30 - i * 4, 2, C.ink));
  out.push(...framed(274, 32, 30, 24, C.barn), r(275, 33, 28, 1, '#d4664a'), ...framed(283, 42, 12, 14, C.white), r(284, 43, 10, 12, C.barn));
  for (let i = 0; i < 10; i++) out.push(r(284 + i, 43 + i, 1, 1, C.white), r(293 - i, 43 + i, 1, 1, C.white));
  out.push(...framed(286, 34, 6, 5, C.straw));
  // the fence and the animals
  out.push(r(264, 72, 54, 1, C.wood), r(264, 76, 54, 1, C.wood));
  for (let x = 265; x < 318; x += 6) out.push(r(x, 70, 1, 8, C.trunk));
  out.push(...animal(268, 84, C.white, C.ink, 9), ...animal(292, 90, C.trunk, null, 8), ...animal(306, 82, C.white, C.ink, 7));
  out.push(r(272, 62, 3, 3, C.white), r(275, 62, 1, 1, C.red), r(280, 64, 3, 3, C.white), r(283, 64, 1, 1, C.red), r(306, 60, 4, 4, C.pink), r(310, 60, 1, 2, C.pink));
  out.push(...framed(306, 40, 8, 6, C.straw), r(307, 42, 6, 1, C.mustard));
  // the fields
  for (let y = 106; y < 194; y += 6) out.push(r(264, y, 54, 4, Math.floor(y / 6) % 2 ? C.soil : C.soilDark), r(264, y + 4, 54, 2, C.crop));
  for (let y = 106; y < 194; y += 12) for (let x = 266; x < 318; x += 5) out.push(r(x, y + 3, 2, 2, C.grassDark));
  return out;
}

/** Bilingual name of a room on the map (the room's own name and gloss). */
const roomLabel = (id: RoomId) => ({ pt: ROOMS[id].name, en: ROOMS[id].gloss });

const place = (id: RoomId, hit: Box[], art: Px[]): MapSpot => ({ id, room: id, ...roomLabel(id), hit, art });

/** Every room of the shared room list: drawn as its own place, or reached through another place (shown there as "você está aqui"). */
export const ROOM_ON_MAP: Record<RoomId, MapSpot | { via: RoomId }> = {
  aeroporto: place('aeroporto', [[66, 4, 84, 42]], aeroportoArt()),
  desembarque: { via: 'aeroporto' },
  kitnet: place('kitnet', [[70, 46, 30, 38]], kitnetArt()),
  padaria: place('padaria', [[103, 56, 38, 28]], padariaArt()),
  academia: place('academia', [[162, 52, 40, 32]], academiaArt()),
  escola: place('escola', [[203, 42, 36, 42]], escolaArt()),
  rua: place('rua', [[66, 84, 94, 20], [141, 68, 18, 16]], ruaArt()),
  rua_leste: place('rua_leste', [[160, 84, 98, 20], [239, 64, 19, 20]], ruaLesteArt()),
  praca: place('praca', [[66, 108, 92, 84]], pracaArt()),
  feira: place('feira', [[166, 108, 90, 84]], feiraArt()),
  // a player academy's floor is upstairs in the Academia do Bairro
  andar: { via: 'academia' },
};

/** The coming-soon places on the map edges: drawn, fogged, a teaser on tap. */
export const SOON_SPOTS: MapSpot[] = [
  {
    id: 'praia',
    room: null,
    pt: 'Praia',
    en: 'Beach',
    hit: [[0, 0, 58, MAP_H]],
    art: praiaArt(),
    soon: { pt: 'Areia, mar e um quiosque com água de coco. Logo dá pra pegar o ônibus até a praia!', en: 'Sand, sea and a kiosk with coconut water. Soon you can take the bus to the beach!' }, // needs_br: true
  },
  {
    id: 'fazenda',
    room: null,
    pt: 'Fazenda',
    en: 'Farm',
    hit: [[262, 0, 58, MAP_H]],
    art: fazendaArt(),
    soon: { pt: 'Plantações, um celeiro e os bichos da fazenda. Em breve você vai poder visitar!', en: 'Fields, a barn and the farm animals. Soon you will be able to visit!' }, // needs_br: true
  },
];

/** All the places on the map: the rooms in the shared room-list order, then the coming-soon edges. */
export function mapSpots(): MapSpot[] {
  const rooms = ROOM_IDS.map((id) => ROOM_ON_MAP[id]).filter((s): s is MapSpot => 'art' in s);
  return [...rooms, ...SOON_SPOTS];
}

/** The place that shows "você está aqui" for the room you are in (a room inside another place marks that place). */
export function hereSpotId(room: RoomId | null | undefined): RoomId | null {
  if (!room) return null;
  const on = ROOM_ON_MAP[room];
  return 'via' in on ? on.via : room;
}

/** The scenery between the places (grass, the bus road to the airport, the paths, the trees): not a button. */
export function backdropArt(): Px[] {
  const out: Px[] = [r(58, 0, 204, MAP_H, C.grass)];
  for (let y = 2; y < MAP_H; y += 5) for (let x = 60 + (Math.floor(y / 5) % 2) * 3; x < 260; x += 6) out.push(r(x, y, 1, 1, C.grassLight));
  // the road the 875 bus takes from the rua leste stop to the airport
  out.push(r(150, 18, 110, 8, C.asfalto), r(252, 18, 8, 50, C.asfalto), r(150, 18, 110, 1, C.asfaltoLight));
  for (let x = 154; x < 250; x += 8) out.push(r(x, 21, 4, 1, C.faixa));
  for (let y = 28; y < 66; y += 8) out.push(r(255, y, 1, 4, C.faixa));
  // the bus itself, on its way
  out.push(...framed(196, 17, 22, 9, C.faixa), r(197, 18, 20, 1, '#ffe27a'), ...windows(199, 19, 4, 1, 4, 0, C.glass, [3, 3]), r(197, 23, 20, 1, C.terracota), r(200, 26, 3, 2, C.ink), r(211, 26, 3, 2, C.ink));
  // paths: rua → praça, praça → feira
  out.push(r(108, 104, 8, 4, C.calcada), r(158, 146, 8, 8, C.calcada));
  // trees between the places
  for (const [x, y] of [[60, 52], [60, 112], [60, 150], [60, 178], [152, 6], [152, 34], [170, 32], [186, 32], [232, 30], [242, 40], [158, 116], [158, 176], [60, 132]] as const) out.push(...tree(x, y));
  out.push(...ipe(214, 30), ...ipe(143, 52));
  // an orelhão (public phone) between the kitnet and the padaria
  out.push(r(101, 76, 1, 8, C.concreteDark), r(100, 73, 3, 4, C.orange));
  return out;
}

// ---------------------------------------------------------------- what a tap does

export type TapResult = 'travel' | 'select' | 'teaser' | 'stay';

/**
 * Mouse and keyboard: a click on a place travels there. Touch: the first tap lifts the place and shows its name (a phone has no hover),
 * a second tap on the same place travels. A coming-soon place only ever shows its teaser; where you already are just closes the map.
 */
export function tapResult(spot: Pick<MapSpot, 'id' | 'room'>, o: { touch: boolean; selected: string | null; here: string | null }): TapResult {
  if (!spot.room) return 'teaser';
  if (o.touch && o.selected !== spot.id) return 'select';
  return spot.id === o.here ? 'stay' : 'travel';
}

/** The centre of a place's first tap area, in art pixels (for the label and the pin). */
export function spotAnchor(spot: Pick<MapSpot, 'hit'>): { x: number; y: number; top: number } {
  const [x, y, w, h] = spot.hit[0]!;
  return { x: x + w / 2, y: y + h / 2, top: y };
}
