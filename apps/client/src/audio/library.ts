import manifest from './manifest.json';

export interface TtsLine {
  id: string;
  voice: 'carlos' | 'ui';
  text: string;
  file: string;
}

export interface TtsManifest {
  version: number;
  voices: { carlos: string; ui: string };
  lines: TtsLine[];
}

export const TTS_MANIFEST = manifest as TtsManifest;

/** Match prebaked clips across curly quotes and odd spacing. */
export function clipKey(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const byKey = new Map<string, TtsLine>();
for (const line of TTS_MANIFEST.lines) byKey.set(clipKey(line.text), line);

export function findClip(text: string): TtsLine | null {
  return byKey.get(clipKey(text)) ?? null;
}

/** Brazilian Portuguese first, then any Portuguese. Never an English voice. */
export function pickPtVoice<T extends { lang: string }>(voices: readonly T[]): T | null {
  const lang = (v: T) => v.lang.toLowerCase().replace(/_/g, '-');
  return (
    voices.find((v) => lang(v) === 'pt-br' || lang(v).startsWith('pt-br')) ??
    voices.find((v) => lang(v).startsWith('pt-') || lang(v) === 'pt') ??
    null
  );
}
