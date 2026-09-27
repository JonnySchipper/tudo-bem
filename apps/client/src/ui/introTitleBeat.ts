/** Title-screen beat before auth card (TB Art brief: 2–4s or skippable). */
export const INTRO_TITLE_BEAT_MS = 3400;

export function runIntroTitleBeat(root: HTMLElement, onReveal: () => void, reducedMotion: boolean): () => void {
  if (reducedMotion) {
    root.classList.remove('intro-phase-title');
    root.classList.add('intro-phase-auth');
    onReveal();
    return () => {};
  }

  root.classList.add('intro-phase-title');
  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    cleanup();
    root.classList.remove('intro-phase-title');
    root.classList.add('intro-phase-auth');
    onReveal();
  };

  const skip = root.querySelector('#intro-skip') as HTMLButtonElement | null;
  const onTap = (e: PointerEvent) => {
    if (e.button === 0) reveal();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      reveal();
    }
  };
  skip?.addEventListener('click', reveal);
  root.addEventListener('pointerup', onTap);
  window.addEventListener('keydown', onKey);

  const timer = window.setTimeout(reveal, INTRO_TITLE_BEAT_MS);
  function cleanup() {
    clearTimeout(timer);
    skip?.removeEventListener('click', reveal);
    root.removeEventListener('pointerup', onTap);
    window.removeEventListener('keydown', onKey);
  }
  return cleanup;
}
