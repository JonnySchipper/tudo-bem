/**
 * Pet looks at runtime (#234, docs/PET-STORE-PLAN.md §3.2). A breed strip (`chars/pet_<species>_<shape>_<pattern>`) is baked once in key
 * colours; each look (breed + coat + collar) is that strip with the `coat`, `coat2` and `collar` keys swapped for ramps of the look's colours,
 * registered as its own spritesheet with the pet animations. The caramelo and the orange cat with the default collar use the legacy strips
 * (`chars/pet_dog`, `chars/pet_cat`) unchanged, so the subscriber dog and cat look exactly as they did before the pet shop.
 *
 * The pure parts (keys, the swap table, the cache) are tested; `ensurePetTexture` needs a Phaser scene.
 */
import type Phaser from 'phaser';
import { DEFAULT_COLLAR, LEGACY_BREED, petLook, petStripKey, type PetLook, type PetSpecies } from '@tudobem/shared';
import { PET_KEY_RAMPS, buildRamp, mergeTables, rampMap, swapKeys } from './palette';

/** The legacy look of each species: the default coat of the legacy breed with the default collar. */
const LEGACY_LOOK: Record<PetSpecies, PetLook> = {
  dog: petLook(LEGACY_BREED.dog.breed, LEGACY_BREED.dog.coat, DEFAULT_COLLAR),
  cat: petLook(LEGACY_BREED.cat.breed, LEGACY_BREED.cat.coat, DEFAULT_COLLAR),
};

const sameLook = (a: PetLook, b: PetLook) =>
  a.species === b.species && a.shape === b.shape && a.pattern === b.pattern && a.coat === b.coat && a.coat2 === b.coat2 && a.collar === b.collar;

/** The texture of a look: `pet:dog` / `pet:cat` for the legacy look, else one key per distinct look. */
export function petTextureKey(l: PetLook): string {
  if (sameLook(l, LEGACY_LOOK[l.species])) return `pet:${l.species}`;
  return `pet:${l.species}:${l.shape}:${l.pattern}:${l.coat}:${l.coat2}:${l.collar}`;
}

/** The source image (preloaded) of a look's key-coloured strip. */
export const petSourceKey = (l: Pick<PetLook, 'species' | 'shape' | 'pattern'>): string => `petsrc:${petStripKey(l)}`;

/** Key colour -> look colour, for swapKeys: a 4-step ramp of the coat and of the markings, the collar's base and highlight. */
export function petSwapTable(l: PetLook): Map<number, number> {
  return mergeTables(
    rampMap(PET_KEY_RAMPS.coat, buildRamp(l.coat)),
    rampMap(PET_KEY_RAMPS.coat2, buildRamp(l.coat2)),
    rampMap(PET_KEY_RAMPS.collar, buildRamp(l.collar).slice(2)),
  );
}

/** Animation key of one pose of a pet texture (`anim:pet:dog:walkE` for the legacy dog, as before). */
export const petAnimKey = (tex: string, pose: string): string => `anim:${tex}:${pose}`;

export const PET_ANIM_RANGES: Record<string, [number, number]> = {
  walkE: [0, 3],
  walkS: [4, 7],
  walkN: [8, 11],
  idleS: [12, 13],
  sitE: [14, 14],
  sitS: [15, 15],
  sitN: [16, 16],
  lieE: [17, 17],
  lieS: [18, 18],
  lieN: [19, 19],
};

/** A small least-recently-used set of texture keys: `touch` returns the keys that fell out (their textures are removed). */
export class PetTextureCache {
  private order = new Map<string, true>();
  constructor(readonly max = 32) {}
  has(key: string): boolean {
    return this.order.has(key);
  }
  touch(key: string): string[] {
    this.order.delete(key);
    this.order.set(key, true);
    const out: string[] = [];
    while (this.order.size > this.max) {
      const oldest = this.order.keys().next().value as string;
      this.order.delete(oldest);
      out.push(oldest);
    }
    return out;
  }
  get size(): number {
    return this.order.size;
  }
}

const caches = new WeakMap<Phaser.Scene, PetTextureCache>();

/** Creates the walk / idle / sit / lie animations of a pet texture (once). */
export function createPetAnimsFor(scene: Phaser.Scene, tex: string, fps = 8): void {
  if (!scene.textures.exists(tex)) return;
  for (const [name, [start, end]] of Object.entries(PET_ANIM_RANGES)) {
    const key = petAnimKey(tex, name);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(tex, { start, end }), frameRate: name.startsWith('idle') ? 3 : fps, repeat: -1 });
  }
}

/**
 * The spritesheet of a look, made on first use from its preloaded key-coloured strip. Returns the texture key, or null while the strip is
 * missing (an old manifest): the caller then hides the pet. Textures past the cache size are removed with their animations.
 */
export function ensurePetTexture(scene: Phaser.Scene, look: PetLook, frameW = 24): string | null {
  const key = petTextureKey(look);
  if (key === `pet:${look.species}`) return scene.textures.exists(key) ? key : null;
  let cache = caches.get(scene);
  if (!cache) caches.set(scene, (cache = new PetTextureCache()));
  if (!scene.textures.exists(key)) {
    const srcKey = petSourceKey(look);
    if (!scene.textures.exists(srcKey)) return null;
    const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    swapKeys(data.data, petSwapTable(look));
    ctx.putImageData(data, 0, 0);
    scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, { frameWidth: frameW, frameHeight: canvas.height });
    createPetAnimsFor(scene, key);
  }
  for (const old of cache.touch(key)) {
    for (const name of Object.keys(PET_ANIM_RANGES)) scene.anims.remove(petAnimKey(old, name));
    if (scene.textures.exists(old)) scene.textures.remove(old);
  }
  return key;
}
