import { describe, expect, it } from 'vitest';
import { JULIA_INTRO, JULIA_INTRO_FROM_GREETING, juliaAlreadyMet, juliaHelpOpener, juliaMetKey } from './juliaTalk.js';
import { NPC_TALK, juliaTalkStart } from './npcTalk.js';
import { collectSpokenLines } from './spokenLines.js';

const juliaSpoken = () => collectSpokenLines().filter((l) => l.speaker === 'julia').map((l) => l.text);

describe('Júlia introduces herself once per profile', () => {
  it('treats saved friendship or a remembered meeting as already met', () => {
    expect(juliaAlreadyMet()).toBe(false);
    expect(juliaAlreadyMet(0)).toBe(false);
    expect(juliaAlreadyMet({ bond: 0 })).toBe(false);
    expect(juliaAlreadyMet(2)).toBe(true);
    expect(juliaAlreadyMet({ bond: 2 })).toBe(true);
    expect(juliaAlreadyMet({ bond: 0, remembered: true })).toBe(true);
    expect(juliaMetKey('abc')).toBe('tb_julia_met:abc');
  });

  it('keeps “Eu sou a Júlia” for the first meeting and reuses a line that already has a voice', () => {
    const oi = NPC_TALK.julia!.nodes.oi!.line;
    const ajuda = NPC_TALK.julia!.nodes.ajuda!.line;
    expect(juliaTalkStart(false)).toBe('oi');
    expect(oi.pt).toContain('Eu sou a Júlia');
    expect(juliaTalkStart(true)).toBe('ajuda');
    expect(ajuda.pt).not.toContain('Eu sou a Júlia');
    expect(juliaSpoken()).toContain(ajuda.pt);

    expect(juliaHelpOpener(false)).toBe(JULIA_INTRO);
    expect(JULIA_INTRO.pt).toContain('Eu sou a Júlia');
    expect(juliaHelpOpener(true)).toBe(JULIA_INTRO_FROM_GREETING);
    expect(JULIA_INTRO_FROM_GREETING.pt).not.toContain('Eu sou a Júlia');
    expect(juliaSpoken()).toContain(JULIA_INTRO_FROM_GREETING.pt);
  });
});
