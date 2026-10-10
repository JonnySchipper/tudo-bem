/**
 * The three Portuguese quick replies above the chat bar (SIMPLIFICATION-REVIEW E4): "Oi!", the greeting that fits the hour, "Valeu!".
 * Each one sends a real chat line, so safety and the greeting / conversar checks run as for typed text. Pure; the strings are the
 * ones the emote row and the clock already use (no new Portuguese).
 */
import { GREETING_EN, greetingCap, greetingFor } from '@tudobem/shared';
import { atLeast, stage, type DisclosureProfile } from './disclosure';

export interface ChatChip {
  /** The chat line it sends. */
  pt: string;
  en: string;
}

/** The chips at a game minute: Oi!, Bom dia / Boa tarde / Boa noite by the hour, Valeu!. */
export function chatChips(minute: number): ChatChip[] {
  const g = greetingFor(minute);
  return [
    { pt: 'Oi!', en: 'Hi!' },
    { pt: greetingCap(g), en: GREETING_EN[g] },
    { pt: 'Valeu!', en: 'Thanks' },
  ];
}

/** Quick replies wait for the Vila (S1): the arrivals hall and the flight have their own steps. */
export const chatChipsShown = (p: DisclosureProfile | null | undefined): boolean => !!p && atLeast(stage(p), 'S1');
