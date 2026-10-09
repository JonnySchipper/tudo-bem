import { game } from './state';
import { ambience } from './ambience';
import { speechChunks } from '@tudobem/shared';
import { findClip, pickPtVoice } from './audio/library';

const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let voice: SpeechSynthesisVoice | null = null;
let player: HTMLAudioElement | null = null;
let voiceGen = 0;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  voice = pickPtVoice(speechSynthesis.getVoices());
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function audioEl() {
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
  }
  return player;
}

/** Prime HTML audio inside a user gesture so later clips can play on iOS. */
export function unlockSpeech() {
  const el = audioEl();
  if (el.src && !el.paused && el.src !== SILENT) return;
  const prev = el.src;
  el.src = SILENT;
  const pending = el.play();
  if (pending) {
    void pending
      .then(() => {
        el.pause();
        if (prev && prev !== location.href) el.src = prev;
      })
      .catch(() => {});
  }
}

function clipUrl(file: string) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}audio/tts/${file}`;
}

function cancelAudio() {
  try {
    speechSynthesis?.cancel();
  } catch {
    /* optional */
  }
  if (!player) return;
  player.onended = null;
  player.onerror = null;
  player.pause();
}

export function stopSpeaking() {
  voiceGen++;
  cancelAudio();
  ambience.duck(false);
}

function fallback(text: string, rate: number | undefined, gen: number, release: () => void) {
  if (!('speechSynthesis' in window)) return release();
  pickVoice();
  if (!voice) return release();
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
    u.lang = 'pt-BR';
    u.voice = voice;
    u.rate = rate ?? 0.92;
    u.onend = () => gen === voiceGen && release();
    u.onerror = () => gen === voiceGen && release();
    speechSynthesis.speak(u);
  } catch {
    release();
  }
}

/**
 * Lines that had no prebaked clip and fell to the system voice this session (the robot). Dev builds warn once per line; `pnpm tts`
 * bakes everything found in the game data, so what lands here is dynamic text (typed names, generated Conversa turns) or new dialogue
 * that is not wired into `collectSpokenLines` yet.
 */
export const unbakedLines = new Set<string>();

function noteUnbaked(speaker: string | undefined, text: string) {
  const key = `${speaker ?? '?'}: ${text}`;
  if (unbakedLines.has(key)) return;
  unbakedLines.add(key);
  if (import.meta.env.DEV) console.warn(`[tts] no clip, using the system voice → ${key}  (run: pnpm tts)`);
}

/** Speak Portuguese. A prebaked neural clip (the speaker's own, see content/voices.json) wins; otherwise the best pt-BR system voice, never English. */
export function speak(text: string, opts: { force?: boolean; rate?: number; speaker?: string } = {}) {
  if (!game.sound && !opts.force) return;
  const raw = text.trim();
  if (!raw) return;
  cancelAudio();
  const gen = ++voiceGen;
  let released = false;
  const release = () => {
    if (released || gen !== voiceGen) return;
    released = true;
    ambience.duck(false);
  };
  ambience.duck(true);
  window.setTimeout(release, 20000);

  const clip = findClip(raw, opts.speaker);
  let fellBack = false;
  const goFallback = () => {
    if (fellBack || gen !== voiceGen) return;
    fellBack = true;
    noteUnbaked(opts.speaker, raw);
    fallback(raw, opts.rate, gen, release);
  };
  // an assembled line ("Me vê dois pães e um café") has no clip of its own: its phrases do, and they play back to back
  const parts = clip ? [clip] : chunkClips(raw, opts.speaker);
  if (!parts) return goFallback();

  const el = audioEl();
  const rate = opts.rate ?? 0.92;
  el.playbackRate = Math.min(1.35, Math.max(0.55, rate / 0.92));
  let i = 0;
  const playNext = () => {
    if (gen !== voiceGen) return;
    if (i >= parts.length) return release();
    el.src = clipUrl(parts[i++]!.file);
    el.playbackRate = Math.min(1.35, Math.max(0.55, rate / 0.92));
    const pending = el.play();
    if (!pending) return goFallback();
    void pending.catch(() => goFallback());
  };
  el.onended = playNext;
  el.onerror = () => goFallback();
  playNext();
}

/** The clips of a line's phrases, in order, only when every phrase has one (a half-recorded sentence would be worse than the robot). */
function chunkClips(text: string, speaker?: string) {
  const chunks = speechChunks(text);
  if (chunks.length < 2) return null;
  const clips = chunks.map((c) => findClip(c, speaker));
  return clips.every((c) => c !== null) ? (clips as NonNullable<(typeof clips)[number]>[]) : null;
}

if (import.meta.env.DEV) {
  // paste the result into content/tts/extra-lines.json, then `pnpm tts`
  (window as unknown as { ttsMissing: () => string }).ttsMissing = () =>
    JSON.stringify([...unbakedLines].map((k) => ({ speaker: k.slice(0, k.indexOf(': ')).replace('?', 'ui'), text: k.slice(k.indexOf(': ') + 2) })), null, 2);
}

export function hasPtVoice() {
  return !!voice;
}
