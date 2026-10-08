// Subscriber pets. LimeZu has a lying furniture cat and the praça has its own vira-lata; neither is a
// small companion that can follow an avatar. These 16×16 strips match the parrot companion: four idle
// frames, navy outline, palette colours from kit.mjs.
import { blank, stampGrid } from './kit.mjs';
import { paste } from '../../../../scripts/lib/pixel/img.mjs';

const PAL = {
  o: '#3a3a50',
  c: '#c78c59',
  C: '#daa463',
  h: '#f2bd7a',
  m: '#fff2d0',
  n: '#2a2233',
  e: '#f8f8f8',
  k: '#e0913f',
  K: '#f0b060',
  g: '#8f4f1a',
  p: '#f4b4c4',
  w: '#f8f2e4',
};

const DOG = [
  [
    '................',
    '....oo..........',
    '...oCCo.........',
    '..oChhCo........',
    '..oCmeCo..oo....',
    '...oCCo..oCCo...',
    '....oo..oCCCCo..',
    '........oChhho..',
    '........oCCCCo..',
    '........occcco..',
    '.......oocccco..',
    '.......o.o..o...',
    '.......o.o..o...',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '....oo..........',
    '...oCCo.........',
    '..oChhCo........',
    '..oCmeCo..oo....',
    '...oCCo..oCCo...',
    '....oo..oCCCCo..',
    '........oChhho..',
    '........oCCCCo..',
    '........occcco..',
    '.......oo.cccco.',
    '.......o...o.o..',
    '.......o...o.o..',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '....oo..........',
    '...oCCo.........',
    '..oChhCo........',
    '..oCeeCo..oo....',
    '...oCCo..oCCo...',
    '....oo..oCCCCo..',
    '........oChhho..',
    '........oCCCCo..',
    '........occcco..',
    '.......oocccco..',
    '.......o.o..o...',
    '.......o.o..o...',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '....oo..........',
    '...oCCo.........',
    '..oChhCo........',
    '..oCmeCo.oo.....',
    '...oCCo.oCCo....',
    '....oo.oCCCCo...',
    '.......oChhho...',
    '.......oCCCCo...',
    '.......occcco...',
    '......oocccco...',
    '......o.o..o....',
    '......o.o..o....',
    '................',
    '................',
    '................',
  ],
];

const CAT = [
  [
    '................',
    '...o..o.........',
    '..okKKo.........',
    '.okKwKo..oo.....',
    '.okKKko.oKKo....',
    '..okko.oKKKKo...',
    '.......oKggKo...',
    '.......oKKKKo...',
    '.......okkkko...',
    '......ookkkko...',
    '......o.o..o....',
    '......o.o..o....',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '...o..o.........',
    '..okKKo.........',
    '.okKwKo..oo.....',
    '.okKKko..oKKo...',
    '..okko..oKKKKo..',
    '........oKggKo..',
    '........oKKKKo..',
    '........okkkko..',
    '.......oo.kkkko.',
    '.......o...o.o..',
    '.......o...o.o..',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '...o..o.........',
    '..okKKo.........',
    '.okKeKo..oo.....',
    '.okKKko.oKKo....',
    '..okko.oKKKKo...',
    '.......oKppKo...',
    '.......oKKKKo...',
    '.......okkkko...',
    '......ookkkko...',
    '......o.o..o....',
    '......o.o..o....',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '...o..o.........',
    '..okKKo.........',
    '.okKwKo.oo......',
    '.okKKko.oKKo....',
    '..okko.oKKKKo...',
    '.......oKggKo...',
    '.......oKKKKo...',
    '.......okkkko...',
    '......ookkkko...',
    '......o.o..o....',
    '......o.o..o....',
    '................',
    '................',
    '................',
    '................',
  ],
];

function strip(frames) {
  const img = blank(16 * frames.length, 16);
  frames.forEach((rows, i) => {
    const frame = blank(16, 16);
    stampGrid(frame, rows, PAL, 0, 0);
    paste(img, frame, i * 16, 0);
  });
  return img;
}

/** Standalone strips for the world spritesheets (`chars/pet_dog`, `chars/pet_cat`). */
export async function petStrips() {
  return [
    { key: 'chars/pet_dog', img: strip(DOG), meta: { frames: 4, frameW: 16, fps: 6 } },
    { key: 'chars/pet_cat', img: strip(CAT), meta: { frames: 4, frameW: 16, fps: 6 } },
  ];
}
