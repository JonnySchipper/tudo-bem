/**
 * Names for the subscriber dog and cat.
 * A name is public (it floats above the pet), so the shape check here is only half of it:
 * the server also runs the chat safety stack and refuses anything that stack does not allow.
 * The saved string is the trimmed name the player typed. Moderation never rewrites it.
 * needs_br: true
 */
import type { Bilingual } from './types.js';
import type { SafetyAction } from './safety.js';
import { visiblePet, type PetId } from './subscription.js';

export const PET_NAME_MAX = 16;

/** Fun Brazilian pet names the Sortear button offers. Each one has to pass the shape check. */
export const PET_NAME_SUGGESTIONS = ['Caramelo', 'Paçoca', 'Feijão', 'Pipoca', 'Bolinha', 'Mel', 'Tapioca', 'Farofa'] as const;

export type PetNames = Partial<Record<PetId, string>>;

/** needs_br: true */
export const PET_NAME_PROMPT: Record<PetId, Bilingual> = {
  dog: { pt: 'Qual é o nome do seu cachorro?', en: "What's your dog's name?" },
  cat: { pt: 'Qual é o nome da sua gata/do seu gato?', en: "What's your cat's name?" },
};

/** needs_br: true — used when the classifier has no note of its own. */
export const PET_NAME_REJECTED: Bilingual = {
  pt: 'Esse nome não pode. Escolha outro, por favor.',
  en: "That name can't be used. Please pick another one.",
};

const CURLY = /[’‘`´]/g;

export type PetNameShape = { ok: true; name: string } | { ok: false; reason: Bilingual };

/**
 * Trim and check the shape: 1–16 characters, letters (including accents), spaces, hyphen, apostrophe.
 * Does not moderate. Callers that show the name to other players still have to run chat safety.
 */
export function validatePetName(raw: string): PetNameShape {
  if (typeof raw !== 'string') {
    return { ok: false, reason: { pt: 'O nome precisa ter de 1 a 16 letras.', en: 'The name needs 1 to 16 characters.' } };
  }
  const name = raw.replace(CURLY, "'").replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > PET_NAME_MAX) {
    return { ok: false, reason: { pt: 'O nome precisa ter de 1 a 16 letras.', en: 'The name needs 1 to 16 characters.' } };
  }
  if (!/^[\p{L} '\-]+$/u.test(name) || !/\p{L}/u.test(name)) {
    return { ok: false, reason: { pt: 'Use letras, espaços, hífen ou apóstrofo.', en: 'Use letters, spaces, a hyphen or an apostrophe.' } };
  }
  return { ok: true, name };
}

/**
 * Keep a pet name only when chat moderation allows it.
 * `name` on a rejection is the trimmed text the player typed (empty when the shape was wrong).
 * Nothing here substitutes, censors, or shortens that text.
 */
export function petNameDecision(
  raw: string,
  verdict: { action: SafetyAction; note?: Bilingual },
): { ok: true; name: string } | { ok: false; name: string; reason: Bilingual } {
  const shape = validatePetName(raw);
  if (!shape.ok) return { ok: false, name: '', reason: shape.reason };
  if (verdict.action !== 'allow') return { ok: false, name: shape.name, reason: verdict.note ?? PET_NAME_REJECTED };
  return { ok: true, name: shape.name };
}

/** One suggestion, skipping `avoid` when the list has another name. */
export function suggestPetName(rng: () => number = Math.random, avoid?: string): string {
  const list = PET_NAME_SUGGESTIONS;
  const i = Math.min(list.length - 1, Math.max(0, Math.floor(rng() * list.length)));
  const pick = list[i] ?? list[0];
  const skip = avoid?.replace(CURLY, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  if (skip && pick.toLowerCase() === skip) return list[(i + 1) % list.length] ?? pick;
  return pick;
}

/** Drop anything that is not a well-shaped name. Does not re-run moderation (a later filter must not rewrite a saved name). */
export function normalizePetNames(raw: unknown): PetNames | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: PetNames = {};
  for (const kind of ['dog', 'cat'] as const) {
    if (typeof src[kind] !== 'string') continue;
    const checked = validatePetName(src[kind]);
    if (checked.ok) out[kind] = checked.name;
  }
  return out.dog || out.cat ? out : undefined;
}

/**
 * The name on the collar tag. Only the pet that is actually out, and only while the subscription shows it.
 * A stored name stays on the profile when the pet is put away.
 */
export function visiblePetName(pet: PetId | null | undefined, names: PetNames | null | undefined, active: boolean): string | null {
  const shown = visiblePet(pet, active);
  if (!shown) return null;
  const name = names?.[shown];
  return name ? name : null;
}
