// Escola da Praça objects for the language diary (see ../diaryItems.mjs for the palette).
const grid = (w, h) => Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
const rect = (g, x, y, w, h, ch) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy]?.[xx] !== undefined) g[yy][xx] = ch; };
const done = (g) => g.map((r) => r.join(''));

function corredor() {
  const g = grid(10, 16);
  rect(g, 0, 0, 10, 16, 'n');
  rect(g, 1, 1, 8, 13, 'l');
  rect(g, 3, 3, 4, 8, 'b');
  rect(g, 3, 3, 4, 1, 'B');
  rect(g, 1, 11, 8, 3, 'g');
  rect(g, 6, 7, 1, 1, 'y');
  rect(g, 0, 14, 10, 2, 'N');
  return done(g);
}

function patio() {
  const g = grid(14, 12);
  rect(g, 0, 0, 14, 12, 'n');
  rect(g, 1, 1, 12, 10, 'c');
  rect(g, 1, 8, 12, 3, 'f');
  rect(g, 6, 5, 2, 4, 'N');
  rect(g, 4, 2, 6, 4, 'e');
  rect(g, 5, 1, 4, 1, 'e');
  rect(g, 9, 8, 3, 1, 't');
  return done(g);
}

export const ESCOLA = {
  lapis: [
    'pgyyyyyyyTk',
    'pgYYYYYYYTk',
  ],
  caneta: [
    'bgbbbbbbbk',
    'BgBBBBBBBk',
  ],
  borracha: [
    'bbbbbbbb',
    'bwwwwwwb',
    'brrrrrrb',
    'bbbbbbbb',
  ],
  caderno: [
    'bbbbbbbb',
    'bwwwwwwb',
    'bwggggwb',
    'bwwwwwwb',
    'bwggggwb',
    'bbbbbbbb',
  ],
  livro: [
    'rrrrrrrrr',
    'rRRRRRRRr',
    'rRyyyyyRr',
    'rRRRRRRRr',
    'rrrrrrrrr',
    'wwwwwwwww',
  ],
  estojo: [
    'bbbbbbbbbb',
    'bBBBBBBBBb',
    'bBBBgBBBBb',
    'bbbbbbbbbb',
  ],
  apontador: [
    '.dddd.',
    'dggggd',
    'dgkkgd',
    'dggggd',
    '.dddd.',
  ],
  regua: [
    'yyyyyyyyyy',
    'yk.k.k.k.k',
    'yyyyyyyyyy',
  ],
  tesoura: [
    'rr.....g',
    'r.r..ggg',
    '.rrggg..',
    'r.r..ggg',
    'rr.....g',
  ],
  cola: [
    '..oo..',
    '..ww..',
    '.wwww.',
    'wbwwbw',
    'wbbbbw',
    'wwwwww',
  ],
  apagador: [
    'nnnnnnnn',
    'nnnnnnnn',
    'wwwwwwww',
    'gwgwgwgw',
  ],
  globo: [
    '..bbbb..',
    '.bbeebb.',
    'bbeebbbb',
    'bbbbebbb',
    'bbebbbbb',
    '.bbbbbb.',
    '..dddd..',
    '.dddddd.',
  ],
  dicionario: [
    'bbbbbbbbbb',
    'bBBBBBBBBb',
    'bByyyyyyBb',
    'bBBBBBBBBb',
    'bbbbbbbbbb',
    'wwwwwwwwww',
    'wwwwwwwwww',
  ],
  grampeador: [
    'ddddddd.',
    'dgggggdd',
    'dddddddd',
    '.ggggggg',
  ],
  clipe: [
    '.ggggg.',
    'g.....g',
    'g.ggg.g',
    'g.g.g.g',
    'g.g.g.g',
    '..g.g..',
  ],
  pasta: [
    '.yyyy...',
    'yyyyyyyy',
    'yYYYYYYy',
    'yYYYYYYy',
    'yYYYYYYy',
    'yyyyyyyy',
  ],
  cracha: [
    '..gg..',
    '..gg..',
    'wwwwww',
    'wbbbbw',
    'wbssbw',
    'wbwwbw',
    'wwwwww',
  ],
  sino: [
    '..yy..',
    '.yyyy.',
    '.yYYy.',
    'yyYYyy',
    'yyyyyy',
    'yyyyyy',
    'yyyyyy',
    '.kkkk.',
  ],
  corredor: corredor(),
  patio: patio(),
};
