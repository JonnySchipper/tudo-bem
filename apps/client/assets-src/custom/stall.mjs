// Barraca de chapéus da Nanda (2x1): the LimeZu street-food cart (striped canopy, counter, wheel) with hats on display.
// The stripey canopy is split off as an OVERHEAD sprite (like tree canopies); the counter, poles and hats stand on the ground.
import { blank, paste, crop, setPx, hexPx, C, K, rect, hline, vline, dot, drawShaded, newMask, fillMask, ellipse, union, rectP, stripSoftAlpha } from './kit.mjs';

const CART = 'TS:10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Street_Food_Cart_1.png';

/** Small hat sprites, all in LimeZu colors. kind: straw | cap | bucket | panama | beanie. Returns an image ~10x7. */
export function hat(kind) {
  const img = blank(12, 9);
  const put = (mask, ox, oy, ramp, o) => drawShaded(img, mask, ox, oy, ramp, o);
  if (kind === 'straw') {
    const brim = newMask(11, 4); fillMask(brim, ellipse(5.5, 2, 5.5, 1.9));
    put(brim, 0, 4, [K.wg4, C.w1, C.w0, C.cr0], { rimShade: 1 });
    const crown = newMask(6, 4); fillMask(crown, union(ellipse(3, 2.5, 3, 2.2), rectP(0.4, 2, 5.6, 4)));
    put(crown, 3, 1, [C.w2, C.w0, C.cr1, C.cr0], { rimShade: 1 });
    rect(img, 4, 4, 4, 1, C.r3); // band
  } else if (kind === 'cap') {
    const dome = newMask(8, 5); fillMask(dome, union(ellipse(4, 4, 4, 3.6), rectP(0, 3, 8, 5)));
    put(dome, 1, 1, [C.b4, C.b3, C.b2, C.b1], { rimShade: 1 });
    const visor = newMask(5, 2); fillMask(visor, rectP(0, 0, 5, 2));
    put(visor, 7, 5, [C.b4, C.b3, C.b2, C.b2], { rimShade: 1, rimLit: 1 });
    dot(img, 5, 1, C.lav4);
  } else if (kind === 'bucket') {
    const brim = newMask(11, 3); fillMask(brim, ellipse(5.5, 1.5, 5.5, 1.4));
    put(brim, 0, 5, [C.g3, C.g2, C.g1, C.g0], { rimShade: 1 });
    const crown = newMask(7, 5); fillMask(crown, union(rectP(0.6, 1.2, 6.4, 5), ellipse(3.5, 1.8, 3, 1.5)));
    put(crown, 2, 1, [C.g3, C.g2, C.g1, C.g0], { rimShade: 1 });
    rect(img, 3, 4, 5, 1, C.y3);
  } else if (kind === 'panama') {
    const brim = newMask(12, 4); fillMask(brim, ellipse(6, 2, 6, 1.7));
    put(brim, 0, 4, [K.wg4, K.wg1, K.wg0, C.cr0], { rimShade: 1 });
    const crown = newMask(6, 4); fillMask(crown, union(ellipse(3, 2.4, 2.8, 2.2), rectP(0.6, 2, 5.4, 4)));
    put(crown, 3, 1, [K.wg3, K.wg1, K.wg0, C.cr0], { rimShade: 1 });
    rect(img, 3, 4, 6, 1, C.navy2);
  } else {
    const beanie = newMask(8, 6); fillMask(beanie, union(ellipse(4, 3.4, 4, 3.2), rectP(0, 4, 8, 6)));
    put(beanie, 1, 1, [C.r5, C.r3, C.r2, C.r1], { rimShade: 1 });
    rect(img, 1, 6, 8, 1, C.r6);
    dot(img, 5, 0, C.lav4);
  }
  return img;
}

export async function barracaChapeus(ctx) {
  const cart = stripSoftAlpha(await ctx.load('ext:ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Street_Food_Cart_1.png'));
  // ---- overhead: the canopy (rows 0..19 of the cart)
  const canopy = crop(cart, 0, 0, 48, 20);
  // ---- standing part: rows 19..47, plus the hats
  const base = blank(48, 29);
  paste(base, crop(cart, 0, 19, 48, 29), 0, 0);
  // hats hanging from a rail between the poles (y ~ 3 in base coordinates = 22 in the cart)
  hline(base, 11, 3, 26, K.br2);
  const hung = [['straw', 12], ['cap', 19], ['bucket', 26], ['panama', 32]];
  for (const [k, x] of hung) {
    const h = hat(k);
    dot(base, x + 5, 4, C.navy2); // string
    paste(base, h, x, 5);
  }
  // hats standing on the counter top (the rust plane at y = 11..19 in base coordinates)
  paste(base, hat('beanie'), 12, 13);
  paste(base, hat('straw'), 22, 12);
  paste(base, hat('cap'), 31, 13);
  return [
    { img: base, anchor: [24, 27], meta: { overhead: 'props/barraca_chapeus_canopy' } },
    { key: 'props/barraca_chapeus_canopy', img: canopy, anchor: [24, 47], meta: { footprint: [2, 1], overhead: true, shadow: null, cast: undefined } },
  ];
}
