const UNITS_M = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Brazilian Portuguese number words, 0–100, with gender agreement for 1 and 2. */
export function numberPt(n: number, gender: 'm' | 'f' = 'm'): string {
  if (!Number.isInteger(n) || n < 0 || n > 100) return String(n);
  if (n === 100) return 'cem';
  const unit = (u: number) => (gender === 'f' && u === 1 ? 'uma' : gender === 'f' && u === 2 ? 'duas' : UNITS_M[u]);
  if (n < 20) return unit(n);
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TENS[t] : `${TENS[t]} e ${unit(u)}`;
}

export function numberEn(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 100) return String(n);
  if (n === 100) return 'one hundred';
  if (n < 20) return EN_UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? EN_TENS[t] : `${EN_TENS[t]}-${EN_UNITS[u]}`;
}

/** "a, b e c" */
export function joinPt(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

export function joinEn(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
