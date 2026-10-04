// Rua dos Ipês objects for the language diary (see ../diaryItems.mjs for the palette).
const R = (c, n) => c.repeat(n);
const grid = (w, h) => Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
const rect = (g, x, y, w, h, ch) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy]?.[xx] !== undefined) g[yy][xx] = ch; };
const stamp = (g, x, y, pat) => pat.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== ' ' && g[y + dy]?.[x + dx] !== undefined) g[y + dy][x + dx] = ch; }));
const done = (g) => g.map((r) => r.join(''));
const WHEEL = ['.dddd.', 'dkkkkd', 'dkggkd', 'dkkkkd', '.dddd.'];

function caminhao() {
  const g = grid(38, 15);
  rect(g, 0, 0, 27, 10, 'w');
  rect(g, 0, 0, 27, 1, 'i');
  rect(g, 0, 0, 1, 10, 'i');
  rect(g, 26, 0, 1, 10, 'g');
  rect(g, 4, 3, 19, 1, 'l');
  rect(g, 4, 6, 19, 1, 'l');
  rect(g, 28, 3, 10, 7, 'B');
  rect(g, 30, 3, 8, 1, 'u');
  rect(g, 31, 4, 6, 3, 'c');
  rect(g, 31, 4, 1, 3, 'w');
  rect(g, 36, 8, 2, 1, 'y');
  rect(g, 0, 10, 38, 2, 'd');
  for (const x of [2, 10, 30]) stamp(g, x, 10, WHEEL);
  return done(g);
}

function ambulancia() {
  const g = grid(34, 15);
  rect(g, 0, 2, 34, 8, 'w');
  rect(g, 0, 2, 34, 1, 'i');
  rect(g, 23, 3, 10, 4, 'B');
  rect(g, 24, 4, 8, 3, 'c');
  rect(g, 23, 3, 1, 4, 'w');
  rect(g, 0, 8, 34, 1, 'r');
  rect(g, 7, 3, 7, 5, 'r');
  rect(g, 9, 4, 3, 3, 'w');
  rect(g, 8, 5, 5, 1, 'w');
  rect(g, 15, 0, 5, 2, 'B');
  rect(g, 17, 0, 1, 1, 'r');
  rect(g, 0, 10, 34, 2, 'd');
  rect(g, 31, 8, 3, 1, 'y');
  for (const x of [3, 24]) stamp(g, x, 10, WHEEL);
  return done(g);
}

export const RUA = {
  caminhao: caminhao(),
  ambulancia: ambulancia(),
  semaforo: [
    '.dddd.',
    '.dkkd.',
    '.drrd.',
    '.dkkd.',
    '.dyyd.',
    '.dkkd.',
    '.deed.',
    '.dddd.',
    '..dd..',
    '..dd..',
    '..dd..',
    '..dd..',
  ],
  esquina: [
    'gggggggg',
    'lllllllg',
    'lyyyyyyg',
    'lygggggd',
    'lygddddd',
    'lyg.....',
    'lyg.....',
    'dd......',
  ],
  muro: [
    'llllllllllll',
    'ggggggggggdd',
    'wlwlwlwlwlwl',
    'ggggggggggdd',
    'wlwlwlwlwlwl',
    'ggggggggggdd',
    'wlwlwlwlwlwl',
    'dddddddddddd',
  ],
  interfone: [
    '.dddd.',
    'dggggd',
    'dwkkwd',
    'dwwwwd',
    'dwyywd',
    'dwwwwd',
    '.dddd.',
  ],
  campainha: [
    '.gggg.',
    'gwwwwg',
    'gwyywg',
    'gwwwwg',
    '.gggg.',
  ],
  varanda: [
    'dddddddddddd',
    '.d.d.d.d.d.d',
    '.d.d.d.d.d.d',
    '.d.d.d.d.d.d',
    'dddddddddddd',
    'llllllllllll',
  ],
  grade: [
    'dddddddddd',
    'dgdgdgdgdd',
    'dgdgdgdgdd',
    'dgdgdgdgdd',
    'dgdgdgdgdd',
    'dgdgdgdgdd',
    'dgdgdgdgdd',
    'dddddddddd',
  ],
  ar_condicionado: [
    'iiiiiiiiii',
    'iwwwwwwwwi',
    'iwggggggwi',
    'iwddddddwi',
    'iwggggggwi',
    'iwddddddwi',
    'iiiiiiiiii',
    '.g......g.',
  ],
  antena: [
    '.k.....k.',
    '..k...k..',
    'kkkkkkkkk',
    '....k....',
    '..kkkkk..',
    '....k....',
    '....k....',
    '....k....',
  ],
  retrovisor: [
    '.dddd.',
    'dcwcwd',
    'dwcwcd',
    'dcwcwd',
    '.dddd.',
    '..dd..',
  ],
  porta_malas: [
    '.yyyyyyyyyy.',
    'yYYYYYYYYYYy',
    'yYkkkkkkkkYy',
    'yYYYYYYYYYYy',
    'yyyyyyyyyyyy',
    '.dd......dd.',
  ],
  farol: [
    '.dddd.',
    'dyYYwd',
    'dYwwwd',
    'dyYYwd',
    '.dddd.',
  ],
  volante: [
    '..dddd..',
    '.d....d.',
    'd..dd..d',
    'd.dddd.d',
    'd..dd..d',
    '.d....d.',
    '..dddd..',
  ],
  buzina: [
    '......dd',
    '.....dgg',
    '.dddddgg',
    'dggggggg',
    '.dddddgg',
    '.....dgg',
    '......dd',
  ],
  macaneta: [
    'nnnnnn',
    'nTTTTn',
    'nTTTTn',
    'nTyyTn',
    'nTTTTn',
    'nTTTTn',
    'nnnnnn',
  ],
  lombada: [
    'kykykykykyky',
    'ykykykykykyk',
    'kykykykykyky',
    'dddddddddddd',
  ],
  cone: [
    '..oo..',
    '.owwo.',
    '.oooo.',
    'owwwwo',
    'oooooo',
    'dddddd',
  ],
  tapume: [
    'ttttttttttttt',
    'tTTtTTtTTtTTt',
    'tTTtTTtTTtTTt',
    'ooooooooooooo',
    'tTTtTTtTTtTTt',
    'tTTtTTtTTtTTt',
    'ttttttttttttt',
  ],
  andaime: [
    'dddddddd',
    'd.d..d.d',
    'ddddddd.',
    'd.d..d.d',
    'dddddddd',
    'd.d..d.d',
    'dddddddd',
    'd......d',
  ],
  escada: [
    'n.....n.',
    'nnnnnnn.',
    'n.....n.',
    'nnnnnnn.',
    'n.....n.',
    'nnnnnnn.',
    'n.....n.',
  ],
  encomenda: [
    'tttttttt',
    'tTTyyTTt',
    'tTTyyTTt',
    'tTTyyTTt',
    'tttttttt',
  ],
  envelope: [
    'wwwwwwww',
    'wiwwwwiw',
    'wwiwwiww',
    'wwwiiwww',
    'wwwwwwww',
  ],
  selo: [
    'wwwwww',
    'wbbbbw',
    'wbyybw',
    'wbbbbw',
    'wwwwww',
  ],
  tenis: [
    '.bb.....',
    '.bbb....',
    '.bwbbbb.',
    'bbbbbbbb',
    'wwwwwwww',
    'kkkkkkkk',
  ],
  guarda_chuva: [
    '...k....',
    '..rrr...',
    '..rRr...',
    '..rrr...',
    '..rRr...',
    '...n....',
    '...n....',
    '...n....',
    '...nn...',
  ],
  cruzamento: [
    'bbbbbbbb',
    'bbbwwbbb',
    'bbbwwbbb',
    'bbwwwwbb',
    'bbbwwbbb',
    'bbwbbwbb',
    'bwbbbbwb',
    'bbbbbbbb',
    '...dd...',
    '...dd...',
  ],
  capacete: [
    '..bbbb..',
    '.bBBbbb.',
    'bbbbbbbb',
    'bwwwwwbb',
    'bwkkkwb.',
    '.bbbbbb.',
  ],
  pneu: [
    '.dddddd.',
    'dkkkkkkd',
    'dkddddkd',
    'dkdggdkd',
    'dkddddkd',
    'dkkkkkkd',
    '.dddddd.',
  ],
  guidao: [
    'dd....dd',
    '.dd..dd.',
    '..dddd..',
    '...dd...',
    '...dd...',
  ],
  pedal: [
    '..dd....',
    '..dd....',
    '..dd....',
    '..dd....',
    '.dggggd.',
    '.dddddd.',
  ],
  skate: [
    'yyyyyyyyy',
    'yoooooooy',
    '.yyyyyyy.',
    '.kk...kk.',
  ],
  patinete: [
    '.dd.....',
    '.d......',
    '.d......',
    '.d......',
    '.dgggggg',
    'kk....kk',
    'kk....kk',
  ],
};
