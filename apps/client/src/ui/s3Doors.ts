/**
 * Props that are plain scenery until the player is a Regular (S3): the Placar da Vila (SIMPLIFICATION-REVIEW D6) and the checkers board,
 * which carries no Portuguese (C6). Pure, so the click handlers in main.ts and the tests share one rule.
 */
import { atLeast, stage, type DisclosureProfile } from './disclosure';

export const opensAtS3 = (profile: DisclosureProfile | null | undefined): boolean => !!profile && atLeast(stage(profile), 'S3');
export const placarOpens = opensAtS3;
export const checkersOpens = opensAtS3;
