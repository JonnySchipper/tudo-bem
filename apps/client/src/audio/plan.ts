/**
 * What `pnpm tts` bakes, and what the coverage test checks: every line the game speaks (found in the game data by
 * `collectSpokenLines`, plus content/tts/extra-lines.json), with the voice of its speaker (content/voices.json).
 * Node only (reads the repo's content files); the game itself never imports this.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSpokenLines } from '@tudobem/shared';
import { clipKey } from './library';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const AUDIO_DIR = path.join(ROOT, 'apps/client/public/audio/tts');
export const MANIFEST_PATH = path.join(ROOT, 'apps/client/src/audio/manifest.json');
export const PENDING_PATH = path.join(ROOT, 'apps/client/src/audio/pending.json');

export interface CastEntry {
  voice: string;
  rate?: string;
  pitch?: string;
  about?: string;
}

export interface PlanLine {
  id: string;
  speaker: string;
  text: string;
  file: string;
  /** Where the line was found (for the missing report). */
  source: string;
}

const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;

export const loadCast = (): Record<string, CastEntry> => readJson<{ cast: Record<string, CastEntry> }>('content/voices.json').cast;

/**
 * A clip's id: the speaker and a hash of the text. A speaker with a rate/pitch also hashes it, so changing how they sound re-bakes them
 * (speakers without a tweak, like Carlos and ui, keep the ids of the clips already on disk).
 */
export function idFor(speaker: string, text: string, cast: Record<string, CastEntry>): string {
  const c = cast[speaker];
  const style = c?.rate || c?.pitch ? `${c.rate ?? ''}|${c.pitch ?? ''}|` : '';
  return `${speaker}-${crypto.createHash('sha1').update(style + text).digest('hex').slice(0, 10)}`;
}

export function buildPlan(): PlanLine[] {
  const cast = loadCast();
  const extra = readJson<{ lines: { speaker: string; text: string }[] }>('content/tts/extra-lines.json').lines.map((l) => ({ ...l, source: 'extra-lines.json' }));
  const lines: PlanLine[] = [];
  const seen = new Set<string>();
  for (const l of [...collectSpokenLines(), ...extra]) {
    if (!cast[l.speaker]) throw new Error(`"${l.speaker}" speaks (${l.source}) but is not in content/voices.json: give them a voice`);
    const text = clipKey(l.text) === l.text ? l.text : l.text.replace(/\s+/g, ' ').trim();
    const key = `${l.speaker}\n${clipKey(text)}`;
    if (!text || seen.has(key)) continue;
    seen.add(key);
    const id = idFor(l.speaker, text, cast);
    lines.push({ id, speaker: l.speaker, text, file: `${id}.mp3`, source: l.source });
  }
  return lines;
}

export const hasClip = (line: PlanLine): boolean => {
  const f = path.join(AUDIO_DIR, line.file);
  return fs.existsSync(f) && fs.statSync(f).size > 400;
};

export const pendingKey = (l: Pick<PlanLine, 'speaker' | 'text'>): string => `${l.speaker}: ${clipKey(l.text)}`;
