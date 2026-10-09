/**
 * Exact key colours baked into the bjj/* pair sprites besides the standard skin / hair ramps (palette.ts KEY_RAMPS), shared by the puppet
 * renderer (assets-src/custom/bjj-rig.mjs) and the runtime swap (bjjArt.ts). No imports here: the asset script loads this file directly.
 *
 * Each fighter slot (A, the top / attacking fighter of a frame, and B) carries optional hair pieces that are always drawn and switched at
 * load time: a curly / long volume around the head (`vol`, with its own outline `volOl` and the head outline under it `volSeam`), a bun
 * (`bun`, `bunOl`) and a beard over the lower face (`beard`, one key per skin rank 1..3). A piece the fighter does not wear turns
 * transparent (the seam turns back into the outline, the beard back into skin).
 */

export interface HairKeys {
  /** volume, dark -> light */
  vol: readonly [string, string, string];
  volOl: string;
  volSeam: string;
  /** bun, dark -> light */
  bun: readonly [string, string, string];
  bunOl: string;
  /** beard over skin ranks 1, 2, 3 */
  beard: readonly [string, string, string];
}

export const HAIR_KEYS: Record<'A' | 'B', HairKeys> = {
  A: {
    vol: ['#304810', '#40601a', '#507822'],
    volOl: '#28143c',
    volSeam: '#3c1428',
    bun: ['#14485a', '#1a6078', '#227896'],
    bunOl: '#143c28',
    beard: ['#5a1448', '#781a60', '#962278'],
  },
  B: {
    vol: ['#486010', '#58781a', '#689022'],
    volOl: '#2a1640',
    volSeam: '#40162a',
    bun: ['#145a48', '#1a7860', '#229678'],
    bunOl: '#163e2a',
    beard: ['#481a5a', '#602078', '#782896'],
  },
};

/** Every optional hair key, for the art contract tests. */
export const allHairKeys = (): string[] =>
  (['A', 'B'] as const).flatMap((s) => {
    const k = HAIR_KEYS[s];
    return [...k.vol, k.volOl, k.volSeam, ...k.bun, k.bunOl, ...k.beard];
  });
