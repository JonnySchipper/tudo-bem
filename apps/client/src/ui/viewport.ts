/** Keep HUD above the iOS keyboard and stop the page rubber-banding over the canvas. */
export function installViewport() {
  const root = document.documentElement;
  const apply = () => {
    const vv = window.visualViewport;
    if (!vv) {
      root.style.setProperty('--kb', '0px');
      return;
    }
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty('--kb', `${Math.round(kb)}px`);
  };
  apply();
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 60));

  const scrollable = '.onboarding, .panel, .dialogue, .conversa-panel, .decor, .checklist, .conversa-transcript';
  document.addEventListener(
    'touchmove',
    (e) => {
      if ((e.target as Element | null)?.closest(scrollable)) return;
      e.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT') return;
    setTimeout(() => t.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 280);
  });
}
