/**
 * Generated speech (a bakery order, "Faltou duas coxinhas!") is never baked as one sentence: the combinations are endless. It is cut at
 * the commas, the sentence ends and the "e" of a list instead, and each piece is a short line that is baked and played back to back.
 * One function for both sides, so what `pnpm tts` bakes is exactly what the player cuts.
 */
export function speechChunks(text: string): string[] {
  return text
    .split(/(?<=[,.!?:…])\s+|\s+(?=e\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}
