import { game } from './state';
import { ambience } from './ambience';
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

/** Speak Portuguese. Prebaked Antonio/Francisca clips win; otherwise a pt-BR voice, never English. */
export function speak(text: string, opts: { force?: boolean; rate?: number } = {}) {
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

  const clip = findClip(raw);
  let fellBack = false;
  const goFallback = () => {
    if (fellBack || gen !== voiceGen) return;
    fellBack = true;
    fallback(raw, opts.rate, gen, release);
  };
  if (!clip) return goFallback();

  const el = audioEl();
  const rate = opts.rate ?? 0.92;
  el.src = clipUrl(clip.file);
  el.playbackRate = Math.min(1.35, Math.max(0.55, rate / 0.92));
  el.onended = () => gen === voiceGen && release();
  el.onerror = () => goFallback();
  const pending = el.play();
  if (!pending) return goFallback();
  void pending.catch(() => goFallback());
}

export function hasPtVoice() {
  return !!voice;
}
