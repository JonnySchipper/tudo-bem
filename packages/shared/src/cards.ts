/**
 * Item bank cards (GDD §5.5) loaded from content/curriculum/phase0/cards.json, which is generated
 * from the curriculum pack markdown (`pnpm content`). Engineering owns the schema; curriculum owns
 * the content. Every card is DRAFT until a Brazilian reviewer signs it off (`signoff`).
 */
import pack from '../../../content/curriculum/phase0/cards.json';

export type Signoff = 'needs_br' | 'needs_curriculum_and_br' | 'approved';

export interface Card {
  id: string;
  form: string;
  plural?: string;
  gender?: 'm' | 'f';
  pos: string;
  tags: string[];
  gloss_en: string;
  gloss_en_plural?: string;
  /** Short shelf/ticket gloss when it differs from the dictionary gloss. */
  gloss_en_tray?: string;
  patterns: string[];
  /** Accent-flexible accepted typed answers (accept-list-rules.md applies on top). */
  accepts: string[];
  accept_notes?: Record<string, string>;
  wrongs: string[];
  prereq: string[];
  places: string[];
  note?: string;
  /** lexemes-*.md file the card was parsed from. */
  source: string;
  signoff: Signoff;
}

export const CARDS: Card[] = pack.cards as Card[];
export const cardById = (id: string) => CARDS.find((c) => c.id === id);
