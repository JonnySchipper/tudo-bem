/**
 * Props that are plain scenery until the player is a Regular (S3): the Placar da Vila (SIMPLIFICATION-REVIEW D6) and the checkers board,
 * which carries no Portuguese (C6). Pure, so the click handlers in main.ts and the tests share one rule.
 */
import { atLeast, kioskShown, stage, type DisclosureProfile } from './disclosure';

export const opensAtS3 = (profile: DisclosureProfile | null | undefined): boolean => !!profile && atLeast(stage(profile), 'S3');
export const placarOpens = opensAtS3;
export const checkersOpens = opensAtS3;

/** A prop whose click does nothing yet (the kiosk, the Placar, the checkers board before S3): no walk-to, the tap is refused. */
export function propIsScenery(action: string | undefined, profile: DisclosureProfile | null | undefined): boolean {
  if (action === 'kiosk') return !(profile && kioskShown(profile));
  if (action === 'leaderboard') return !placarOpens(profile);
  if (action === 'checkers') return !checkersOpens(profile);
  return false;
}
