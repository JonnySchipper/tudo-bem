/**
 * Phase 2 character looks: ONE base character (body_medio + one outfit layer + one hair layer) recoloured with the Phase 1 palette
 * swap from the avatar's skin / hair / top / bottom colors. Phase 3 replaces this with the full layer table (`CHAR_LAYERS`).
 * Pure: no Phaser.
 */
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES, type Appearance, type NpcId } from '@tudobem/shared';

export interface Look {
  /** loaded layer texture ids without the `layer:` prefix */
  body: string;
  outfit: string;
  hair: string;
  /** base colors fed to the ramp generator */
  skin: string;
  hairColor: string;
  top: string;
  bottom: string;
}

const pick = (list: readonly string[], i: number | undefined): string => list[Number.isInteger(i) && (i as number) >= 0 && (i as number) < list.length ? (i as number) : 0];

/** Every player and CPU: the same base sheet, recolored. */
export function lookForAppearance(a: Appearance): Look {
  return {
    body: 'body_medio',
    outfit: 'outfit_o01',
    hair: 'hair_h02',
    skin: pick(SKIN_TONES, a.skin),
    hairColor: pick(HAIR_COLORS, a.hairColor),
    top: pick(CLOTH_COLORS, a.topColor),
    bottom: pick(CLOTH_COLORS, a.bottomColor),
  };
}

/** The three NPCs use the appearance stored in rooms.ts, with a different outfit / hair layer each so they read apart. */
export const NPC_LAYERS: Record<NpcId, { outfit: string; hair: string }> = {
  carlos: { outfit: 'outfit_o13', hair: 'hair_h05' },
  nanda: { outfit: 'outfit_o16', hair: 'hair_h12' },
  julia: { outfit: 'outfit_o01', hair: 'hair_h02' },
};

export function lookForNpc(id: NpcId, a: Appearance): Look {
  return { ...lookForAppearance(a), ...NPC_LAYERS[id] };
}

/** Cache key of a composed sheet: two looks with the same key share one texture. */
export const lookKey = (l: Look): string => `char:${l.outfit}:${l.hair}:${l.skin}:${l.hairColor}:${l.top}:${l.bottom}`;
