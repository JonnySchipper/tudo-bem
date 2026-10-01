// Academia do Bairro interior pieces and the praça leftovers (art track 3), authored in the LimeZu look (navy outline, upper-left light).
import { put, fillRect, mix, h2, NAVY, line, shape, ell, ring } from './paint.mjs';
import { blank } from '../../../../scripts/lib/pixel/img.mjs';

const WOOD = { d: '#573c2c', lo: '#6b4b30', mid: '#8b5e3c', base: '#a9764f', hi: '#c78c59', hi2: '#daa463' };
const METAL = { lo: '#565972', mid: '#8b8bab', hi: '#b2aecb', hi2: '#d8d0e0' };
const BELTS = ['#f8f8f8', '#4a86c8', '#8a5cc0', '#8b5e3c', '#2b2b34'];

// ------------------------------------------------------------------ tatame: the open mat, a 6x4 floor decal (96 x 64)
export function tatame() {
  const w = 96, h = 64;
  const img = blank(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  // safety zone (mustard) all round, blue fighting area in the middle, white boundary line between them
  fillRect(img, 1, 1, w - 2, h - 2, '#e0b030');
  fillRect(img, 1, 1, w - 2, 1, '#ffe57b'); fillRect(img, 1, 1, 1, h - 2, '#ffe57b');
  fillRect(img, 8, 8, w - 16, h - 16, '#f8f8f8');
  fillRect(img, 9, 9, w - 18, h - 18, '#3f78bc');
  for (let y = 9; y < h - 9; y++) for (let x = 9; x < w - 9; x++) {
    const gx = x - 9, gy = y - 9;
    if (gx % 16 === 0 || gy % 16 === 0) put(img, x, y, '#2f5f9c'); // mat seams
    else if ((gx % 4 === 1 && gy % 4 === 1) || (gx % 4 === 3 && gy % 4 === 3)) put(img, x, y, '#4a86c8');
    else if (gx % 16 === 1 || gy % 16 === 1) put(img, x, y, '#5a96d4');
  }
  // seams of the yellow border too
  for (let x = 1; x < w - 1; x++) for (const y of [15, 47]) if (x < 8 || x >= w - 8) put(img, x, y, '#c99a2a');
  for (let y = 1; y < h - 1; y++) for (const x of [15, 47, 79]) if (y < 8 || y >= h - 8) put(img, x, y, '#c99a2a');
  // centre marks
  fillRect(img, w / 2 - 1, h / 2 - 5, 2, 10, '#f8f8f8'); fillRect(img, w / 2 - 5, h / 2 - 1, 10, 2, '#f8f8f8');
  return { img, anchor: [w / 2, h] };
}

// ------------------------------------------------------------------ quadro da fila: free-standing chalk board with belt-coloured name tags
export function quadroFila() {
  const w = 16, h = 32;
  const img = blank(w, h);
  fillRect(img, 2, 22, 2, 9, NAVY); fillRect(img, 12, 22, 2, 9, NAVY); fillRect(img, 2, 22, 1, 8, WOOD.hi); fillRect(img, 12, 22, 1, 8, WOOD.mid); // legs
  fillRect(img, 0, 2, w, 22, NAVY);
  fillRect(img, 1, 3, w - 2, 20, WOOD.mid); fillRect(img, 1, 3, w - 2, 1, WOOD.hi); fillRect(img, 1, 3, 1, 20, WOOD.hi);
  fillRect(img, 2, 4, w - 4, 18, '#2d4468'); fillRect(img, 2, 4, w - 4, 1, '#1f3050');
  // header stripe + four queue rows (name slot + belt tag)
  fillRect(img, 3, 5, w - 6, 2, '#f2c230');
  for (let i = 0; i < 4; i++) {
    const y = 8 + i * 3;
    fillRect(img, 3, y, 7, 2, '#dfe6f0'); fillRect(img, 3, y, 7, 1, '#ffffff');
    fillRect(img, 11, y, 3, 2, BELTS[i]);
  }
  fillRect(img, 3, 21, 4, 1, '#f8f8f8'); // chalk
  fillRect(img, 1, 24, w - 2, 1, WOOD.d); fillRect(img, 0, 24, w, 1, NAVY);
  fillRect(img, 6, 0, 4, 2, '#c45c26'); fillRect(img, 6, 0, 4, 1, '#eda878'); // little flag on top
  return { img, anchor: [8, 30] };
}

// ------------------------------------------------------------------ parede de faixas: belt rack (1 x 2 tiles)
export function paredeFaixas() {
  const w = 16, h = 40;
  const img = blank(w, h);
  fillRect(img, 0, 0, w, h - 2, NAVY);
  fillRect(img, 1, 1, w - 2, h - 4, WOOD.mid); fillRect(img, 1, 1, w - 2, 1, WOOD.hi); fillRect(img, 1, 1, 1, h - 4, WOOD.hi);
  fillRect(img, 2, 2, w - 4, h - 6, '#33496f'); fillRect(img, 2, 2, w - 4, 1, '#24365a');
  // pegs and belts: each belt hangs over a peg, two tails down; white, blue, purple, brown, black
  BELTS.forEach((c, i) => {
    const y = 4 + i * 7;
    fillRect(img, 3, y, w - 6, 2, c); fillRect(img, 3, y, w - 6, 1, mix(c, '#ffffff', 0.35));
    fillRect(img, 3, y + 2, 2, 3, c); fillRect(img, 4, y + 2, 1, 3, mix(c, NAVY, 0.3));
    fillRect(img, 10, y + 2, 2, 4, c); fillRect(img, 11, y + 2, 1, 4, mix(c, NAVY, 0.3));
    put(img, 7, y, '#d8d0e0'); put(img, 8, y, '#d8d0e0'); // peg
    if (i === 4) { fillRect(img, 10, y + 1, 2, 1, '#c93232'); fillRect(img, 10, y + 3, 2, 1, '#c93232'); } // black belt: red bar
  });
  fillRect(img, 0, h - 3, w, 1, WOOD.d); fillRect(img, 0, h - 2, w, 2, NAVY);
  return { img, anchor: [8, h - 2] };
}

// ------------------------------------------------------------------ arquibancada: wooden bleachers, one slice per tile (left end, middle, right end)
export function bancoEspectador(i, n) {
  const w = 16, h = 26;
  const img = blank(w, h);
  const left = i === 0, right = i === n - 1;
  // rear step (higher) and front bench, both with lit plank tops and slatted fronts
  const step = (y0, hgt) => {
    fillRect(img, 0, y0, w, hgt, NAVY);
    fillRect(img, left ? 1 : 0, y0 + 1, w - (left ? 1 : 0) - (right ? 1 : 0), 3, WOOD.hi2);
    fillRect(img, left ? 1 : 0, y0 + 1, w - (left ? 1 : 0) - (right ? 1 : 0), 1, '#f2c988');
    fillRect(img, left ? 1 : 0, y0 + 4, w - (left ? 1 : 0) - (right ? 1 : 0), hgt - 5, WOOD.mid);
    for (let x = 0; x < w; x += 4) fillRect(img, x + 3, y0 + 4, 1, hgt - 5, WOOD.lo);
    fillRect(img, left ? 1 : 0, y0 + hgt - 2, w - (left ? 1 : 0) - (right ? 1 : 0), 1, WOOD.d);
  };
  step(1, 11);
  step(13, 10);
  // steel supports
  for (const x of [left ? 2 : 1, right ? w - 3 : w - 2]) { fillRect(img, x, 23, 2, 3, NAVY); put(img, x, 23, METAL.hi2); }
  if (left) { fillRect(img, 0, 1, 1, 22, NAVY); }
  if (right) { fillRect(img, w - 1, 1, 1, 22, NAVY); }
  return { img, anchor: [8, 24] };
}

// ------------------------------------------------------------------ vestiário: a pair of lockers with a towel and a pair of sneakers
export function vestiario() {
  const w = 16, h = 36;
  const img = blank(w, h);
  fillRect(img, 0, 5, w, 30, NAVY);
  for (let k = 0; k < 2; k++) {
    const x0 = 1 + k * 7;
    fillRect(img, x0, 6, 7, 27, '#4a86c8'); fillRect(img, x0, 6, 7, 1, '#7ab0e8'); fillRect(img, x0, 6, 1, 27, '#7ab0e8'); fillRect(img, x0 + 6, 6, 1, 27, '#3c68ac');
    for (let y = 9; y < 15; y += 2) fillRect(img, x0 + 2, y, 3, 1, '#2f4f8e'); // vents
    fillRect(img, x0 + 4, 20, 2, 4, METAL.hi2); put(img, x0 + 4, 20, '#ffffff'); // handle
    fillRect(img, x0 + 1, 27, 5, 1, '#3c68ac');
  }
  fillRect(img, 8, 6, 1, 27, NAVY);
  // top: folded towel and sneakers
  fillRect(img, 1, 1, 7, 4, NAVY); fillRect(img, 2, 2, 5, 3, '#f8efe0'); fillRect(img, 2, 2, 5, 1, '#ffffff'); fillRect(img, 2, 4, 5, 1, '#c45c26');
  fillRect(img, 9, 2, 6, 3, NAVY); fillRect(img, 10, 3, 4, 1, '#d93232'); fillRect(img, 10, 2, 2, 1, '#f8f8f8'); fillRect(img, 12, 4, 3, 1, '#f8f8f8');
  fillRect(img, 0, 34, w, 2, NAVY);
  return { img, anchor: [8, 34] };
}

// ------------------------------------------------------------------ quadro de foto: the academy group photo on a small stand
export function quadroFoto() {
  const w = 20, h = 30;
  const img = blank(w, h);
  fillRect(img, 3, 22, 2, 8, NAVY); fillRect(img, 15, 22, 2, 8, NAVY); fillRect(img, 3, 22, 1, 7, WOOD.hi); fillRect(img, 15, 22, 1, 7, WOOD.mid);
  fillRect(img, 0, 0, w, 24, NAVY);
  fillRect(img, 1, 1, w - 2, 22, WOOD.hi); fillRect(img, 1, 1, w - 2, 1, WOOD.hi2); fillRect(img, 1, 1, 1, 22, WOOD.hi2); fillRect(img, w - 2, 1, 1, 22, WOOD.mid); fillRect(img, 1, 22, w - 2, 1, WOOD.mid);
  fillRect(img, 3, 3, w - 6, 18, '#efe4d0'); fillRect(img, 3, 3, w - 6, 2, '#e0d2b8');
  // three rows of tiny people in white gis with belt dots, a banner behind them
  fillRect(img, 4, 5, w - 8, 3, '#3f5b8a'); fillRect(img, 6, 6, w - 12, 1, '#f2c230');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const x = 4 + k * 3 + (r ? 1 : 0), y = 9 + r * 5;
    put(img, x + 1, y, mix('#c78c59', '#573c2c', ((k + r) % 3) / 3)); put(img, x + 1, y + 1, '#f8f8f8'); put(img, x, y + 1, '#f8f8f8'); put(img, x + 2, y + 1, '#f8f8f8'); put(img, x + 1, y + 2, BELTS[(k + r) % 5]); put(img, x, y + 3, '#c6bdd5'); put(img, x + 2, y + 3, '#c6bdd5');
  }
  return { img, anchor: [10, 28] };
}

// ------------------------------------------------------------------ praça: bicicletário, mesa de café, pilha de jornais
function bike(img, x, y, body, dark) {
  // side-view bicycle ~20 x 12 facing right: two wheels (ring + hub), a diamond frame, saddle, handlebar
  const wheel = (cx, cy) => { ring(img, cx, cy, 4, () => '#2b2b34'); ring(img, cx, cy, 2.6, () => dark); put(img, cx, cy, '#d8d0e0'); put(img, cx - 1, cy - 4, '#565972'); };
  wheel(x + 4, y + 8); wheel(x + 16, y + 8);
  line(img, x + 4, y + 8, x + 9, y + 3, body); line(img, x + 9, y + 3, x + 15, y + 3, body); line(img, x + 15, y + 3, x + 16, y + 8, body);
  line(img, x + 4, y + 8, x + 10, y + 8, body); line(img, x + 9, y + 3, x + 10, y + 8, body); line(img, x + 10, y + 8, x + 15, y + 3, body);
  fillRect(img, x + 6, y + 1, 4, 2, NAVY); fillRect(img, x + 14, y, 4, 2, NAVY); put(img, x + 15, y + 2, NAVY);
  put(img, x + 10, y + 8, '#f2c230');
}
export function bicicletario() {
  const w = 30, h = 22;
  const img = blank(w, h);
  bike(img, 8, 2, '#4a86c8', '#4a5a7c'); // the one behind
  bike(img, 2, 8, '#d93232', '#7c4a4a');
  // grey rack in front: a rail on two posts
  fillRect(img, 1, 19, 28, 2, NAVY); fillRect(img, 2, 19, 26, 1, METAL.hi2); fillRect(img, 2, 20, 26, 1, METAL.lo);
  fillRect(img, 4, 16, 2, 5, NAVY); fillRect(img, 24, 16, 2, 5, NAVY); put(img, 4, 16, METAL.hi2); put(img, 24, 16, METAL.hi2);
  return { img, anchor: [15, 20] };
}

export function mesaCafe() {
  const w = 30, h = 26;
  const img = blank(w, h);
  const chair = (x, dir) => {
    fillRect(img, x, 9, 6, 9, NAVY); fillRect(img, x + 1, 10, 4, 7, '#c45c26'); fillRect(img, x + 1, 10, 4, 1, '#eda878');
    fillRect(img, dir === 0 ? x : x + 5, 6, 1, 8, NAVY); // backrest post on the outer side
    fillRect(img, x + 1, 18, 1, 3, NAVY); fillRect(img, x + 4, 18, 1, 3, NAVY);
  };
  chair(0, 0); chair(24, 1);
  // round metal table: top ellipse with a lit rim, a centre pole, a cross foot
  shape(img, ell(15, 11, 8, 4.5), [15, 11, 8, 4.5], ['#a2a6be', '#c6bdd5', '#e2dcec', '#ffffff']);
  fillRect(img, 14, 15, 2, 6, NAVY); fillRect(img, 14, 15, 1, 6, METAL.hi); fillRect(img, 10, 21, 10, 2, NAVY); fillRect(img, 11, 21, 8, 1, METAL.hi2);
  // cup of coffee and a pão de queijo plate
  fillRect(img, 11, 7, 4, 4, NAVY); fillRect(img, 12, 8, 2, 2, '#f8f8f8'); put(img, 12, 8, '#6b3a26'); put(img, 15, 8, '#f8f8f8');
  fillRect(img, 17, 9, 5, 3, NAVY); fillRect(img, 18, 9, 3, 2, '#f8d078'); put(img, 18, 9, '#fff2b0'); put(img, 20, 10, '#e8a040');
  return { img, anchor: [15, 22] };
}

export function jornais() {
  const w = 18, h = 16;
  const img = blank(w, h);
  // three stacked bundles, alternately offset, tied with a red strap; headlines as grey bars
  for (let k = 0; k < 3; k++) {
    const y = 9 - k * 3, x = 1 + (k % 2) * 2;
    fillRect(img, x - 1, y - 1, 15, 5, NAVY);
    fillRect(img, x, y, 13, 3, '#efe6d2'); fillRect(img, x, y, 13, 1, '#fbf6ea'); fillRect(img, x, y + 2, 13, 1, '#cbbfa6');
  }
  // the top paper: masthead + photo + text
  fillRect(img, 3, 1, 11, 1, '#3a3a50'); fillRect(img, 3, 3, 4, 2, '#8b8bab'); fillRect(img, 8, 3, 5, 1, '#a2a6be'); fillRect(img, 8, 5, 5, 1, '#a2a6be');
  fillRect(img, 8, 0, 3, 1, NAVY);
  fillRect(img, 6, 6, 1, 8, '#d93232'); fillRect(img, 5, 6, 3, 1, '#a82b2d'); // strap
  fillRect(img, 0, 13, w, 1, NAVY);
  return { img, anchor: [9, 14] };
}

const one = (fn) => () => {
  const r = fn();
  return [{ img: r.img, anchor: r.anchor }];
};
import * as gym3 from './gym3.mjs';
export const DERIVE_GYM = {
  ...gym3.DERIVE_GYM3,
  gymTatame: gym3.DERIVE_GYM3.gymTatame3,
  gymFila: one(quadroFila),
  gymFaixas: one(paredeFaixas),
  gymBancoEsp: (_ctx, { slices = 4 }) => Array.from({ length: slices }, (_, i) => ({ key: `props/banco_espectador_${i}_of_${slices}`, ...bancoEspectador(i, slices), meta: { footprint: [1, 1] } })),
  gymVestiario: one(vestiario),
  gymQuadroFoto: one(quadroFoto),
  pracaBici: one(bicicletario),
  pracaMesaCafe: one(mesaCafe),
  pracaJornais: one(jornais),
};
export { h2 };
