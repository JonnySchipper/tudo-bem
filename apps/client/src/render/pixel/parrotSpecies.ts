/**
 * Shoulder birds, one authored look per poleiro colour (8 x 10, 4 frames at 3 fps, same frame size and anchor as `chars/parrot_strip`).
 * A colour is a different bird, not a hue swap: each has its own silhouette, face, beak and tail.
 * Same language as the poleiro parrot in `assets-src/custom/emotefx.mjs`: navy outline, light from the upper left, pack greens / yellows / blues.
 * Facing left (the beak side); the renderers mirror it toward the owner.
 */

export const PARROT_W = 8;
export const PARROT_H = 10;
export const PARROT_FRAME_COUNT = 4;

export type ParrotSpecies = 'verde' | 'azul' | 'canarinho' | 'vermelha' | 'periquito';

/** Poleiro colour id -> bird. The older ids (amarelo / vermelho / laranja) and the new names both resolve. */
const SPECIES_BY_ID: Record<string, ParrotSpecies> = {
  verde: 'verde',
  azul: 'azul',
  canarinho: 'canarinho',
  amarelo: 'canarinho',
  vermelha: 'vermelha',
  vermelho: 'vermelha',
  periquito: 'periquito',
  laranja: 'periquito',
};

export function parrotSpecies(colorId: string | null | undefined): ParrotSpecies {
  return (colorId && SPECIES_BY_ID[colorId]) || 'verde';
}

const OUTLINE = 0x3a3a50;
const EYE = 0x2a2a3a;

interface Look {
  pal: Record<string, number>;
  frames: string[][];
}

const swap = (rows: string[], edits: Record<number, string>) => rows.map((r, y) => edits[y] ?? r);
/** Base pose, wing out, tail sway, both: the poleiro parrot's 4-frame idle. */
const idle = (base: string[], wing: Record<number, string>, tail: Record<number, string>) => [
  base,
  swap(base, wing),
  swap(base, tail),
  swap(swap(base, wing), tail),
];

const LOOKS: Record<ParrotSpecies, Look> = {
  // papagaio-verdadeiro: the original poleiro parrot (kept pixel for pixel), orange beak, red shoulder, blue tail
  verde: {
    pal: { o: OUTLINE, K: EYE, w: 0xfbf7ee, G: 0x8fdc6b, g: 0x5dbb54, n: 0x3f8f4a, k: 0xf2a02b, r: 0xd0463a, R: 0xd93232, b: 0x3f6aa8, B: 0x6f9ad8 },
    frames: idle(
      ['..oooo..', '.oGGgno.', 'okKwGgno', 'okkGgggo', '.ogGggro', '.oGgggRo', '..ognno.', '..okko..', '...obbo.', '...oBbo.'],
      { 4: '.ogGgnro', 5: '.oGgnnRo' },
      { 8: '..obbo..', 9: '..oBbo..' },
    ),
  },
  // arara-azul: cobalt all over, big dark hooked beak, yellow eye ring and chin, long dark tail
  azul: {
    pal: { o: OUTLINE, K: EYE, q: 0x55556a, y: 0xf6c93a, L: 0x8fb8f0, B: 0x5a8ad8, b: 0x3a64b8, D: 0x24408a },
    frames: idle(
      ['..oooo..', '.oLBBbo.', 'oqyKLbDo', 'oKqyBbbo', '.ooBbbDo', '..oBbbDo', '..obDDo.', '..oqqDo.', '...obDo.', '...oDDo.'],
      { 4: '.ooBbDDo', 5: '..oBDDbo' },
      { 8: '..obDo..', 9: '..oDDo..' },
    ),
  },
  // canarinho: small round songbird sitting low, tiny pale beak, no hook, mustard wing and short notched tail
  canarinho: {
    pal: { o: OUTLINE, K: EYE, s: 0xf0b48c, W: 0xfff4c0, Y: 0xfde58a, y: 0xf6c93a, d: 0xc98a1c, D: 0x8f6418 },
    frames: idle(
      ['........', '........', '..oooo..', '.oWYYyo.', 'osKYyydo', '.oYyyydo', '.oYyydDo', '..oyydDo', '..ossoDo', '......oo'],
      { 6: '.oYydDDo', 7: '..oyDDdo' },
      { 8: '..ossDo.', 9: '.....oo.' },
    ),
  },
  // arara-vermelha: scarlet with a bare white face, pale upper beak, yellow shoulder band, blue wing, red-and-blue tail
  vermelha: {
    pal: { o: OUTLINE, K: EYE, w: 0xfbf7ee, h: 0xe6dfd0, q: 0x55556a, L: 0xef6a4f, R: 0xd93232, H: 0xa8282a, y: 0xf6c93a, b: 0x3f6aa8, B: 0x6f9ad8 },
    frames: idle(
      ['..oooo..', '.oLLRHo.', 'ohwKLRHo', 'oKwwLRRo', '.ooRRyyo', '..oRRyBo', '..oRbbo.', '..oqqbo.', '...oRbo.', '...oHbo.'],
      { 4: '.ooRyyBo', 5: '..oRyBbo' },
      { 8: '..oRbo..', 9: '..oHbo..' },
    ),
  },
  // periquito: slim budgie, yellow face with black barring, blue cere, lime body, long thin tail
  periquito: {
    pal: { o: OUTLINE, K: EYE, q: 0x55556a, c: 0x6f9ad8, h: 0xe6dfd0, Y: 0xfde58a, y: 0xf6c93a, L: 0xc8ec7a, l: 0x8fd04a, n: 0x4f9a34, b: 0x3f6aa8, D: 0x24408a },
    frames: idle(
      ['..oooo..', '.oYYYKo.', 'ocKYyKyo', 'ohYyKyLo', '.oyKLlno', '..oLlnlo', '..olnlo.', '..oqqbo.', '....obo.', '....oDo.'],
      { 5: '..oLnKno', 6: '..olKno.' },
      { 8: '...obo..', 9: '...oDo..' },
    ),
  },
};
/** Authored rows for one frame (exported for tests and art checks). */
export function parrotRows(species: ParrotSpecies, frame: number): string[] {
  const f = LOOKS[species].frames;
  return f[((frame % f.length) + f.length) % f.length]!;
}

/** RGBA pixels (PARROT_W x PARROT_H) of one frame of the bird for `colorId`. */
export function parrotPixels(colorId: string | null | undefined, frame: number): Uint8ClampedArray<ArrayBuffer> {
  const species = parrotSpecies(colorId);
  const { pal } = LOOKS[species];
  const rows = parrotRows(species, frame);
  const out = new Uint8ClampedArray(new ArrayBuffer(PARROT_W * PARROT_H * 4));
  rows.forEach((row, y) => {
    for (let x = 0; x < PARROT_W; x++) {
      const ch = row[x];
      if (!ch || ch === '.') continue;
      const hex = pal[ch];
      if (hex === undefined) throw new Error(`parrot ${species}: no colour for '${ch}'`);
      const i = (y * PARROT_W + x) * 4;
      out[i] = (hex >> 16) & 255;
      out[i + 1] = (hex >> 8) & 255;
      out[i + 2] = hex & 255;
      out[i + 3] = 255;
    }
  });
  return out;
}
