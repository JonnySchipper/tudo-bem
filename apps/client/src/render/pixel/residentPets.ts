/**
 * Pets that are not following anyone (#234): the day's animals in the pet shop's pens, and the owner's pets resting in a kitnet. Pure
 * planning (where each one is and which pose it shows); WorldScene owns the sprites. Every player derives the same picture from the shared
 * clock: the litter of the game day, a drift between pen tiles, a slow change of pose.
 */
import { PET_PENS, penAnimalTile, penLitter, petLook, type HomePet, type PetLook, type PlacedFurniture } from '@tudobem/shared';

export interface Resident {
  /** Stable per animal (sprite reuse). */
  key: string;
  look: PetLook;
  /** World px of the feet (tile centre, bottom quarter). */
  x: number;
  y: number;
  /** Strip pose (`idleS`, `sitE`, `lieS`...). */
  pose: string;
  flip: boolean;
  /** Pen animals: the pen and slot (their click opens the pen). */
  pen?: { penId: string; slot: number };
  homeId?: string;
  name?: string | null;
  /** A resting pet's toy (lying, it keeps it between the paws). */
  toy?: string | null;
}

const T = 16;
const feet = (tx: number, ty: number) => ({ x: tx * T + T / 2, y: ty * T + T - 3 });
/** A small stable hash. */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const PEN_POSES = ['idleS', 'sitS', 'lieS', 'sitE', 'idleS', 'lieE'];

/** The animals in the pens at `nowMs` (the shared game clock) on `day`. */
export function penResidents(day: number, nowMs: number): Resident[] {
  const out: Resident[] = [];
  const step = Math.floor(nowMs / 1000);
  for (const pen of PET_PENS) {
    for (const a of penLitter(pen.id, day)) {
      const [tx, ty] = penAnimalTile(pen, a.slot, step);
      const k = `${pen.id}:${a.slot}`;
      const phase = Math.floor((step + (hash(k) % 17)) / (8 + (hash(k) % 7)));
      const pose = PEN_POSES[(phase + a.slot) % PEN_POSES.length]!;
      out.push({ key: `pen:${k}:${a.breed}:${a.coat}`, look: petLook(a.breed, a.coat, null), ...feet(tx, ty), pose, flip: (phase + a.slot) % 2 === 1, pen: { penId: pen.id, slot: a.slot } });
    }
  }
  return out;
}

/** How long the resting pets gather at the food bowl when someone comes into the kitnet (ms). */
export const BOWL_GATHER_MS = 6000;

/**
 * The pets resting in a kitnet: on their beds and spots, changing pose every 20-40 s; for the first seconds after you come in they gather
 * around the food bowl (a placed `saco_racao`), facing it. No hunger, no timers the player sees.
 */
export function homeResidents(pets: readonly HomePet[], apartment: readonly PlacedFurniture[], nowMs: number, sinceEnterMs: number): Resident[] {
  const bowl = apartment.find((f) => f.itemId === 'saco_racao');
  const around = bowl ? [[bowl.x - 1, bowl.y], [bowl.x + 1, bowl.y], [bowl.x, bowl.y + 1], [bowl.x - 1, bowl.y + 1], [bowl.x + 1, bowl.y + 1], [bowl.x, bowl.y - 1]] : [];
  return pets.map((p, i) => {
    if (bowl && sinceEnterMs < BOWL_GATHER_MS && around[i]) {
      const [tx, ty] = around[i]!;
      return { key: `home:${p.id}`, look: p.look, ...feet(tx!, ty!), pose: 'idleS', flip: tx! > bowl.x, homeId: p.id, name: p.name };
    }
    const period = 20_000 + (hash(p.id) % 20_000);
    const alt = Math.floor(nowMs / period) % 2 === 1;
    const base = p.pose === 'lie' ? 'lieS' : p.pose === 'sit' ? 'sitS' : 'idleS';
    const pose = alt ? (p.pose === 'lie' ? 'lieE' : p.pose === 'sit' ? 'idleS' : 'sitS') : base;
    return { key: `home:${p.id}`, look: p.look, ...feet(p.tile.x, p.tile.y), pose, flip: hash(p.id) % 2 === 1, homeId: p.id, name: p.name, toy: p.toy };
  });
}
