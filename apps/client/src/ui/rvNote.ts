/**
 * The one explanation of RV (SIMPLIFICATION-REVIEW A7): a single sentence, shown the first time any price list opens for a profile
 * in this browser, and never again. Every shop reads it through `rvPriceNote()` in dom.ts.
 */

export const RV_PRICE_NOTE = 'RV (reais virtuais) is play money. You earn it doing favors and playing at the counter.';

export const rvNoteKey = (profileId: string): string => `tb_rv_note:${profileId}`;

let profileOf: () => string | undefined = () => undefined;
/** state.ts points this at the signed-in profile, so dom.ts (which tests import) needs no game state. */
export const bindRvNoteProfile = (fn: () => string | undefined) => void (profileOf = fn);
/** The signed-in profile's id, if any. */
export const rvNoteProfile = () => profileOf();

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStore = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * The note for this price list, or null when the profile has seen it. The first call per profile returns the sentence and records it;
 * with no storage at all (private mode) the note still shows once per page load.
 */
const shownThisLoad = new Set<string>();
export function takeRvNote(profileId: string | undefined, store: Store | null = defaultStore()): string | null {
  const id = profileId || 'anon';
  if (shownThisLoad.has(id)) return null;
  try {
    if (store?.getItem(rvNoteKey(id))) return null;
  } catch {
    // unreadable storage: fall through to the per-load guard
  }
  shownThisLoad.add(id);
  try {
    store?.setItem(rvNoteKey(id), '1');
  } catch {
    // private mode: the per-load guard keeps it to once
  }
  return RV_PRICE_NOTE;
}

/** Test hook: forget what this page load has shown. */
export const resetRvNoteForTests = () => shownThisLoad.clear();
