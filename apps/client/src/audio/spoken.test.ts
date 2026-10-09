import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlan, hasClip, loadCast, pendingKey, PENDING_PATH } from './plan';
import { findClip, loadTtsManifest } from './library';

const TTS_MANIFEST = await loadTtsManifest();
const pending = new Set<string>((JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8')) as { lines: string[] }).lines);

describe('every line the game speaks has a neural clip', () => {
  const plan = buildPlan();
  const missing = plan.filter((l) => !hasClip(l));

  it('finds no new dialogue without a clip (run `pnpm tts`, then commit the mp3s and manifest.json)', () => {
    const fresh = missing.filter((l) => !pending.has(pendingKey(l)));
    expect(fresh.map((l) => `${l.speaker}: ${l.text}   [${l.source}]`)).toEqual([]);
  });

  it('keeps pending.json honest: it lists only lines that still have no clip', () => {
    const stillMissing = new Set(missing.map(pendingKey));
    expect([...pending].filter((k) => !stillMissing.has(k))).toEqual([]);
  });

  it('gives every speaker a voice, and every baked clip is in the manifest under that speaker', () => {
    const cast = loadCast();
    for (const l of plan.filter(hasClip)) {
      expect(cast[l.speaker], l.speaker).toBeTruthy();
      expect(findClip(l.text, l.speaker)?.voice, `${l.speaker}: ${l.text}`).toBe(l.speaker);
    }
    for (const [speaker, voice] of Object.entries(TTS_MANIFEST.voices)) expect(cast[speaker]?.voice).toBe(voice);
  });
});
