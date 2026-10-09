/**
 * Small pixel pictures of the Diário: how a word is found (a photo, a sign, a line someone says, a game won) and the emblem of each
 * chapter (the plane of the Chegada, the fountain of the Praça, ...). One character per art pixel, drawn by `pixelSvg`.
 */
import type { DiarySource } from '@tudobem/shared';
import { pixelSvg } from './pixelSvg';

const K = '#2e160c';

const SOURCE_ART: Record<DiarySource, { rows: string[]; ink: Record<string, string> }> = {
  camera: {
    rows: [
      '...kkk.....',
      '..kyyyk....',
      'kkkkkkkkkkk',
      'kbbbkkkbbrk',
      'kbbkwllkbbk',
      'kbbklllkbbk',
      'kbbklllkbbk',
      'kbbbkkkbbbk',
      'kkkkkkkkkkk',
    ],
    ink: { k: K, b: '#4a5868', y: '#f2c230', w: '#d8f0ff', l: '#3d8fd6', r: '#e04a3a' },
  },
  reading: {
    rows: [
      'kkkkkkkkkkk',
      'kwwwwwwwwwk',
      'kwkkkkkkwwk',
      'kwwwwwwwwwk',
      'kwkkkkkkkwk',
      'kwwwwwwwwwk',
      'kkkkkkkkkkk',
      '....kbk....',
      '....kbk....',
      '...kkkkk...',
    ],
    ink: { k: K, w: '#fff3d6', b: '#8b5e3c' },
  },
  conversation: {
    rows: [
      '.kkkkkkkkk.',
      'kwwwwwwwwwk',
      'kwwwwwwwwwk',
      'kwwkwkwkwwk',
      'kwwwwwwwwwk',
      '.kkkwkkkkk.',
      '...kwk.....',
      '...kk......',
    ],
    ink: { k: K, w: '#ffffff' },
  },
  game: {
    rows: [
      '.....k.....',
      '....kyk....',
      '....kyk....',
      'kkkkkyykkkk',
      '.kyyyyyyyk.',
      '..kyyyyyk..',
      '..kyykyyk..',
      '.kyyk.kyyk.',
      '.kkk...kkk.',
    ],
    ink: { k: K, y: '#f2c230' },
  },
};

/** The picture of how a word is found. */
export const sourceIcon = (source: DiarySource, cls = 'jb-src-ico'): SVGSVGElement => {
  const a = SOURCE_ART[source];
  return pixelSvg(a.rows, a.ink, cls);
};

const EMBLEMS: Record<string, { rows: string[]; ink: Record<string, string> }> = {
  aviao: {
    rows: [
      '.....kk.....',
      '.....kwk....',
      '.....kwk....',
      'k...kwwwk...',
      'kk.kwwwwwkkk',
      'kwkwwwbwbwwk',
      'kwwwwwwwwwwk',
      'kk.kwwwwwkkk',
      'k...kwwwk...',
      '.....kwk....',
      '.....kwk....',
      '.....kk.....',
    ],
    ink: { k: K, w: '#ffffff', b: '#3d8fd6' },
  },
  fonte: {
    rows: [
      '.....bb.....',
      '....b..b....',
      '...b.kk.b...',
      '..b..kk..b..',
      '.....kk.....',
      '...kkkkkk...',
      '...kssssk...',
      '.kkkkkkkkkk.',
      'kbbbbbbbbbbk',
      'ksssssssssk.',
      '.kssssssssk.',
      '..kkkkkkkk..',
    ],
    ink: { k: K, b: '#7cc7f2', s: '#d8d0c0' },
  },
  onibus: {
    rows: [
      '.kkkkkkkkkk.',
      'kyyyyyyyyyyk',
      'kywwkwwkwwyk',
      'kywwkwwkwwyk',
      'kyyyyyyyyyyk',
      'kyyyyyyyyyrk',
      'kkkkkkkkkkkk',
      '.kgk....kgk.',
      '..k......k..',
    ],
    ink: { k: K, y: '#f2c230', w: '#d8f0ff', r: '#e04a3a', g: '#555555' },
  },
  pao: {
    rows: [
      '....kkkkk...',
      '..kkbbbbbkk.',
      '.kbblbblbbbk',
      'kbbbbbbbbbbk',
      'kbblbblbblbk',
      'kbbbbbbbbbbk',
      '.kddddddddk.',
      '..kkkkkkkk..',
    ],
    ink: { k: K, b: '#e0a050', l: '#f8d898', d: '#a8642a' },
  },
  abacaxi: {
    rows: [
      '...g.gg.g...',
      '....gggg....',
      '.....gg.....',
      '...kkkkkk...',
      '..kyoyyoyk..',
      '..kyyoyyyk..',
      '..koyyoyok..',
      '..kyyoyyyk..',
      '..kyoyyoyk..',
      '...kkkkkk...',
    ],
    ink: { k: K, g: '#2e8a55', y: '#f2c230', o: '#c47a16' },
  },
  sofa: {
    rows: [
      '..kkkkkkkk..',
      '.kppppppppk.',
      '.kppppppppk.',
      'kkkkkkkkkkkk',
      'kpkllllllkpk',
      'kpkkkkkkkkpk',
      'kppppppppppk',
      'kkkkkkkkkkkk',
      '.k........k.',
    ],
    ink: { k: K, p: '#d36b93', l: '#f2a6c2' },
  },
  faixa: {
    rows: [
      '............',
      'kkkkkkkkkkkk',
      'kwwwwkkwwwwk',
      'kkkkkbbkkkkk',
      '....kbbk....',
      '...kwkkwk...',
      '..kwk..kwk..',
      '.kwk....kwk.',
      '.kk......kk.',
    ],
    ink: { k: K, w: '#7a4fb5', b: '#c7a6f0' },
  },
  lapis: {
    rows: [
      '.........kk.',
      '........kpk.',
      '.......kyyk.',
      '......kyyk..',
      '.....kyyk...',
      '....kyyk....',
      '...kyyk.....',
      '..kwwk......',
      '..kwk.......',
      '.kkk........',
      '.k..........',
    ],
    ink: { k: K, y: '#f2c230', p: '#e889a8', w: '#f0d8b0' },
  },
};

/** A chapter's emblem; an unknown one falls back to the pencil. */
export const emblemIcon = (emblem: string, cls = 'jb-emblem'): SVGSVGElement => {
  const a = EMBLEMS[emblem] ?? EMBLEMS.lapis!;
  return pixelSvg(a.rows, a.ink, cls);
};

/** A tiny photo icon for the Fotos tab and a notebook for the Caderno tab, in the same hand. */
export const tabIcon = (kind: 'fotos' | 'caderno' | 'inicio', cls = 'jb-emblem'): SVGSVGElement => {
  if (kind === 'fotos') return sourceIcon('camera', cls);
  if (kind === 'caderno')
    return pixelSvg(
      ['.kkkkkkkk..', 'kwkwwwwwwk.', 'kwkwkkkkwk.', 'kwkwwwwwwk.', 'kwkwkkkwwk.', 'kwkwwwwwwk.', 'kwkwkkkkwk.', 'kwkwwwwwwk.', '.kkkkkkkk..'],
      { k: K, w: '#fff3d6' },
      cls,
    );
  return pixelSvg(
    ['..kkkkkkk..', '.krrrrrrrk.', 'krrkkkkkrrk', 'krkyyyyykrk', 'krkykkkykrk', 'krkyyyyykrk', 'krrkkkkkrrk', 'krrrrrrrrrk', '.kkkkkkkkk.'],
    { k: K, r: '#8f3e15', y: '#ffe2b0' },
    cls,
  );
};
