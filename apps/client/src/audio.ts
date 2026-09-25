import { game } from './state';

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === 'pt-BR') ?? voices.find((v) => v.lang.startsWith('pt')) ?? null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

/** Speak Portuguese with the browser's pt-BR voice (prebaked TTS stands in for Phase 1 audio). */
export function speak(text: string, opts: { force?: boolean; rate?: number } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (!game.sound && !opts.force) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
    u.lang = 'pt-BR';
    if (voice) u.voice = voice;
    u.rate = opts.rate ?? 0.92;
    speechSynthesis.speak(u);
  } catch {
    /* audio is optional */
  }
}

export function hasPtVoice() {
  return !!voice;
}
