export interface TtsLine {
  id: string;
  /** The speaker (a key of content/voices.json): who says it, and so which voice the clip was baked with. */
  voice: string;
  text: string;
  file: string;
}

export interface TtsManifest {
  version: number;
  /** speaker -> neural voice name */
  voices: Record<string, string>;
  lines: TtsLine[];
}

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
const bySpeaker = new Map<string, TtsLine>();
let indexed: TtsManifest | null = null;
let loading: Promise<TtsManifest> | null = null;

function indexManifest(m: TtsManifest): TtsManifest {
  byKey.clear();
  bySpeaker.clear();
  for (const line of m.lines) {
    const key = clipKey(line.text);
    if (!byKey.has(key)) byKey.set(key, line);
    bySpeaker.set(`${line.voice}\n${key}`, line);
  }
  indexed = m;
  return m;
}

/**
 * The clip list (~280 KB of JSON) is its own chunk, fetched once on first need so it stays out of the boot bundle. A failed load is
 * forgotten so the next line retries; until then `findClip` answers null and speech falls back to the system voice.
 */
export function loadTtsManifest(): Promise<TtsManifest> {
  if (indexed) return Promise.resolve(indexed);
  loading ??= import('./manifest.json').then(
    (mod) => indexManifest((mod.default ?? mod) as TtsManifest),
    (e: unknown) => {
      loading = null;
      throw e;
    },
  );
  return loading;
}

/** True once `loadTtsManifest` has finished: `findClip` then answers from the full list. */
export const ttsManifestReady = (): boolean => indexed !== null;

/** The clip for a line: the speaker's own take first, then the same words in any other cast voice (better than a robot). Null until the manifest has loaded. */
export function findClip(text: string, speaker?: string): TtsLine | null {
  const key = clipKey(text);
  return (speaker ? bySpeaker.get(`${speaker}\n${key}`) : undefined) ?? byKey.get(key) ?? null;
}

/** The system voices that sound human (cloud / "natural" / "premium") beat the compact offline ones that sound like a robot. */
const NATURAL = /natural|neural|online|premium|enhanced|google|luciana|francisca|antonio|thalita/i;

/** Brazilian Portuguese first, then any Portuguese; within each, the most natural-sounding voice. Never an English voice. */
export function pickPtVoice<T extends { lang: string; name?: string }>(voices: readonly T[]): T | null {
  const lang = (v: T) => v.lang.toLowerCase().replace(/_/g, '-');
  const best = (list: T[]) => list.find((v) => NATURAL.test(v.name ?? '')) ?? list[0] ?? null;
  return best(voices.filter((v) => lang(v).startsWith('pt-br'))) ?? best(voices.filter((v) => lang(v).startsWith('pt-') || lang(v) === 'pt'));
}
