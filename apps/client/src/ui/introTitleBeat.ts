/** Title-screen beat before auth card (TB Art brief: 2–4s or skippable). */
export const INTRO_TITLE_BEAT_MS = 2800;

export function runIntroTitleBeat(root: HTMLElement, onReveal: () => void, reducedMotion: boolean): () => void {
  if (reducedMotion) {
    root.classList.add('intro-phase-auth');
    onReveal();
    return () => {};
  }

  root.classList.add('intro-phase-title');
  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    root.classList.remove('intro-phase-title');
    root.classList.add('intro-phase-auth');
    onReveal();
  };

  const skip = root.querySelector('#intro-skip') as HTMLButtonElement | null;
  skip?.addEventListener('click', reveal);

  const timer = window.setTimeout(reveal, INTRO_TITLE_BEAT_MS);
  return () => {
    clearTimeout(timer);
    skip?.removeEventListener('click', reveal);
  };
}
