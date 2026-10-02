// Authored hats (the pack has no straw hat, visor, beret, sun hat, bucket, bike helmet, flower crown, top hat or scarf).
// Patterns use the shared legend of charedit.mjs: 0-3 = hat ramp (dark to light), a-c = accent ramp, o = outline, other letters fixed colors.
// Rows are anchored to the frame's head: row 0 sits at (head top + y0). S and N share a pattern unless a view is given; E/W share too.

/**
 * Row builder: outline at columns a and b, `m` in between. Interior chars: `hl` on the left (nl of them), `sh` on the right (nr of them),
 * `mid` for the rest, so shading always falls from the upper left (HOWTO 4.2 rule 3).
 */
export function R(a, b, hl = '3', mid = '2', sh = '1', nl = 2, nr = 1) {
  const n = b - a - 1;
  let inner = '';
  for (let i = 0; i < n; i++) inner += i < nl ? hl : i >= n - nr ? sh : mid;
  return '.'.repeat(a) + 'o' + inner + 'o' + '.'.repeat(Math.max(0, 15 - b));
}
/** A row of raw characters starting at column a. */
export const T = (a, s) => '.'.repeat(a) + s + '.'.repeat(Math.max(0, 16 - a - s.length));

const P = (y0, rows, x0 = 0) => ({ y0, rows, x0 });

export const HAT_ART = {
  // straw hat: domed crown, accent band, wide brim
  chapeu_palha: {
    S: P(-4, [
      T(5, 'oooooo'),
      R(4, 11, '3', '2', '1'),
      R(3, 12, '3', '2', '1'),
      R(3, 12, '2', '2', '1'),
      T(3, 'oaabbbbaao'),
      T(0, 'o3322222222222oo'.slice(0, 16)),
      T(1, 'o11222222221o'),
      T(3, 'oooooooooo'),
    ]),
  },
  // sun hat: floppy wide brim that droops at the edges, ribbon and bow
  chapeu_sol: {
    S: P(-3, [
      T(5, 'oooooo'),
      R(4, 11, '3', '2', '1'),
      R(3, 12, '3', '2', '1'),
      T(3, 'oabbbbbbbbo'.slice(0, 10)),
      T(1, 'o33222222222221o'.slice(0, 14)),
      T(0, 'o3322222222222211o'.slice(0, 16)),
      T(0, 'oo11122222222111oo'.slice(0, 16)),
      T(0, 'o.oo111111111oo.o'.slice(0, 16)),
      T(0, 'o..ooooooooooo..o'.slice(0, 16)),
    ]),
    E: P(-3, [
      T(4, 'oooooo'),
      R(3, 10, '3', '2', '1'),
      R(2, 11, '3', '2', '1'),
      T(2, 'obbbbbbbbo'),
      T(0, 'o332222222222221o'.slice(0, 16)),
      T(0, 'o3322222222222211o'.slice(0, 16)),
      T(1, 'o111222222221111o'.slice(0, 15)),
      T(2, 'oo11111111ooo'),
    ]),
  },
  // bucket hat: flat-topped dome and a short brim slanting down all around
  bucket_amarelo: {
    S: P(-3, [
      T(4, 'oooooooo'),
      R(3, 12, '3', '2', '1'),
      R(3, 12, '3', '2', '1'),
      R(3, 12, '2', '2', '1'),
      T(1, 'o332222222222o'.slice(0, 14)),
      T(1, 'o111222222111o'.slice(0, 14)),
      T(2, 'oooooooooooo'),
    ]),
  },
  // balde (fisherman bucket, wave 2): soft slouchy crown, two-tone band and a brim that droops all around, wider than the yellow bucket
  balde: {
    S: P(-3, [
      T(5, 'oooooo'),
      R(4, 11, '3', '2', '1'),
      R(3, 12, '3', '2', '1'),
      T(3, 'obcbcbcbco'),
      T(1, 'o33222222222211o'.slice(0, 14)),
      T(0, 'o1112222222222111o'.slice(0, 16)),
      T(1, 'oo111111111111oo'.slice(0, 14)),
    ]),
    E: P(-3, [
      T(4, 'oooooo'),
      R(3, 10, '3', '2', '1'),
      R(2, 11, '3', '2', '1'),
      T(2, 'obcbcbcbco'),
      T(1, 'o3322222222211o'.slice(0, 14)),
      T(0, 'o111222222222211o'.slice(0, 16)),
      T(2, 'oo11111111oo'),
    ]),
  },
  // beret: a flat round cap with a stalk, pulled to one side
  boina_vermelha: {
    S: P(-3, [
      T(7, 'oo'),
      T(3, 'oooooooooo'),
      T(2, 'o33222222221o'),
      T(1, 'o3322222222211o'),
      T(1, 'o2222222222211o'),
      T(2, 'o11222222111oo'),
      T(3, 'oaaaaaaaaao'),
      T(3, 'ooooooooooo'),
    ]),
    E: P(-3, [
      T(6, 'oo'),
      T(2, 'oooooooooo'),
      T(1, 'o3322222221o'),
      T(0, 'o332222222222oo'),
      T(0, 'o22222222222211o'),
      T(1, 'o1122222211oo'),
      T(2, 'oaaaaaaaaao'),
      T(2, 'ooooooooooo'),
    ]),
  },
  // visor: an open crown (the hair shows), a band around the forehead and a brim
  viseira_azul: {
    S: P(2, [
      R(2, 13, 'b', 'a', 'a', 1, 1),
      R(2, 13, '3', '2', '1'),
      T(1, 'o33222222222211o'.slice(0, 14)),
      T(2, 'o111222222111o'.slice(0, 12)),
      T(3, 'oooooooooo'),
    ]),
    E: P(2, [
      R(2, 12, 'b', 'a', 'a', 1, 1),
      R(2, 12, '3', '2', '1'),
      T(2, 'o33222222222221oo'.slice(0, 15)),
      T(5, 'o1111111111o'.slice(0, 11)),
      T(7, 'oooooooo'),
    ]),
    N: P(2, [R(2, 13, 'b', 'a', 'a', 1, 1), R(2, 13, '3', '2', '1')]),
  },
  // bike helmet: glossy shell with vents and chin straps
  capacete_bike: {
    S: P(-3, [
      T(5, 'oooooo'),
      R(4, 11, '3', '2', '1'),
      T(3, 'o3o22o22o2o'.replace(/o/g, 'o')),
      R(2, 13, '3', '2', '1', 3, 1),
      T(2, 'o3o2o2o2o2o1o'.replace(/o/g, 'o')),
      R(2, 13, '2', '2', '1'),
      T(2, 'oaaaaaaaaaao'),
      T(2, 'ooooooooooo'),
    ]),
  },
  // flower crown: yellow and red blooms with leaves along the crown of the head
  coroa_flores: {
    S: P(-1, [
      T(3, 'ggcccgggcccgg'.slice(0, 10)),
      T(2, 'gcYcggcYcgcYcg'.slice(0, 12)),
      T(2, 'gcccgggcccggcc'.slice(0, 12)),
      T(3, 'gG..g..gG...'.slice(0, 10)),
    ]),
  },
  // top hat (Carnival): tall straight crown, gold band, narrow brim
  cartola: {
    S: P(-7, [
      T(4, 'oooooooo'),
      R(4, 11, '3', '2', '1'),
      R(4, 11, '3', '2', '1'),
      R(4, 11, '2', '2', '1'),
      R(4, 11, '2', '2', '1'),
      T(4, 'obbbbbbo'),
      T(4, 'oaccaaao'.slice(0, 8)),
      T(2, 'o3222222222221o'.slice(0, 14)),
      T(2, 'oo111111111111oo'.slice(0, 14)),
    ]),
  },
  // Tia Lu's headscarf (NPC only): a tied kerchief with a knot on top
  pano: {
    S: P(-2, [
      T(6, 'oo..oo'),
      T(5, 'o22oo22o'),
      R(3, 12, '3', '2', '1'),
      R(2, 13, '3', '2', '1', 3, 2),
      R(2, 13, '2', '2', '1'),
      T(3, 'o1a1a1a1a1o'.slice(0, 10)),
    ]),
  },
};
