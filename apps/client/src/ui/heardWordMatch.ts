/**
 * Where a conversation word sits in the line that taught it. Pure: the fly-in reads the text the screen shows and asks here.
 * Case and accents must match as written (the diary prints them that way); only the first letter's case is free ("Bom dia" / "bom dia").
 */
import { DIARY_WORDS } from '@tudobem/shared';

const isLetter = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** Index of `needle` in `text` as a whole word (not inside a longer one), ignoring case. -1 when it is not there. */
export function findWordIndex(text: string, needle: string): number {
  if (!needle) return -1;
  const hay = text.toLocaleLowerCase('pt-BR');
  const n = needle.toLocaleLowerCase('pt-BR');
  // the lower-cased text keeps the same indices for Portuguese (no letter changes length)
  if (hay.length !== text.length) return -1;
  for (let i = hay.indexOf(n); i >= 0; i = hay.indexOf(n, i + 1)) {
    if (!isLetter(hay[i - 1]) && !isLetter(hay[i + n.length])) return i;
  }
  return -1;
}

/** What to look for on screen for a conversation word: what its line prints (`match`, e.g. a plural) first, then the headword. */
export function lineForms(pt: string): string[] {
  const forms: string[] = [];
  for (const w of DIARY_WORDS) if (w.source === 'conversation' && w.pt === pt && w.match) forms.push(w.match);
  forms.push(pt);
  return [...new Set(forms)];
}
