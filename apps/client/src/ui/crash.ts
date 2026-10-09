/**
 * What a player sees when something breaks: a full-screen "Recarregar" card when the world cannot be drawn at all (no WebGL, a chunk
 * that failed to download, a lost GPU context), and a small toast for any other uncaught error. Kept free of the HUD and of Phaser so
 * it works before either has loaded.
 */

export interface Bilingual {
  pt: string;
  en: string;
}

export const CRASH_COPY = {
  lost: { pt: 'A imagem do mundo parou. Recarregue a página para voltar à praça.', en: 'The world view stopped. Reload the page to get back to the praça.' },
  webgl: {
    pt: 'Este navegador não conseguiu desenhar o mundo (WebGL desligado ou sem suporte). Atualize o navegador ou ative a aceleração de hardware e recarregue.',
    en: "This browser couldn't draw the world (WebGL is off or unsupported). Update the browser or turn on hardware acceleration, then reload.",
  },
  load: { pt: 'Não deu pra carregar o jogo. Confira a conexão e recarregue.', en: "The game didn't finish loading. Check your connection and reload." },
  toast: { pt: 'Algo deu errado aqui. Se travar, recarregue a página.', en: 'Something went wrong. If the game gets stuck, reload the page.' },
} as const satisfies Record<string, Bilingual>;

/** The "recarregar" overlay: never a silent blank world. Shown once; a later call keeps the first message. */
export function showReloadScreen(copy: Bilingual = CRASH_COPY.lost): void {
  if (document.getElementById('gl-lost')) return;
  document.getElementById('boot-loading')?.remove();
  const box = document.createElement('div');
  box.id = 'gl-lost';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#1d1b26;color:#f5e6d3;font:600 18px/1.4 system-ui,sans-serif;text-align:center;padding:24px';
  const t = document.createElement('div');
  t.textContent = copy.pt;
  const en = document.createElement('div');
  en.style.cssText = 'font-size:14px;opacity:.75;font-weight:500';
  en.textContent = copy.en;
  const b = document.createElement('button');
  b.id = 'gl-lost-reload';
  b.textContent = 'Recarregar / Reload';
  b.style.cssText = 'padding:10px 22px;border:0;border-radius:6px;background:#d4a017;color:#2a2233;font:700 16px system-ui,sans-serif;cursor:pointer';
  b.onclick = () => location.reload();
  box.append(t, en, b);
  document.body.append(box);
}

/** True when the error is the browser refusing WebGL (Phaser's own message, or a context that could not be created). */
export function isWebglError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /webgl|context|gpu/i.test(msg);
}

/** A short one-line description of an uncaught error, for dedupe and the report. */
export function describeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 200);
  if (typeof e === 'string') return e.slice(0, 200);
  try {
    return JSON.stringify(e).slice(0, 200);
  } catch {
    return String(e).slice(0, 200);
  }
}

/** Decides what to do with each uncaught error: toast it once per message, report at most `maxReports` per session. */
export class ErrorGate {
  private seen = new Set<string>();
  private reports = 0;
  private lastToastAt = -Infinity;

  constructor(private readonly maxReports = 3, private readonly toastGapMs = 8000) {}

  /** `toast`: show the player a toast; `report`: send a report. A message seen before does neither. */
  take(key: string, now: number): { toast: boolean; report: boolean } {
    if (this.seen.has(key)) return { toast: false, report: false };
    this.seen.add(key);
    const toast = now - this.lastToastAt >= this.toastGapMs;
    if (toast) this.lastToastAt = now;
    const report = this.reports < this.maxReports;
    if (report) this.reports++;
    return { toast, report };
  }
}

/** Browser-extension noise, cross-origin "Script error." and media play() refusals (autoplay, an interrupted clip) carry nothing we can act on. */
export function ignorable(msg: string): boolean {
  return /^Script error\.?$/i.test(msg) || /ResizeObserver loop/i.test(msg) || /extension:\/\//i.test(msg) || /^(AbortError|NotAllowedError)\b/.test(msg);
}

/** The /api/feedback body for an automatic report (8–500 chars, category bug). */
export function reportBody(msg: string, where: string): { text: string; category: 'bug' } {
  const text = `[auto] ${msg} @ ${where}`.replace(/\s+/g, ' ').slice(0, 480);
  return { text: text.length >= 8 ? text : `[auto] ${text}`.padEnd(8, '.'), category: 'bug' };
}

function showErrorToast(copy: Bilingual = CRASH_COPY.toast): void {
  const el = document.createElement('div');
  el.className = 'crash-toast';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);z-index:9999;max-width:min(92vw,420px);padding:10px 14px;border-radius:10px;background:#2a2233;color:#f5e6d3;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:none;text-align:center';
  const en = document.createElement('div');
  en.style.cssText = 'font-weight:500;font-size:12.5px;opacity:.8';
  en.textContent = copy.en;
  el.append(copy.pt, en);
  document.body.append(el);
  window.setTimeout(() => el.remove(), 6000);
}

/** Global `error` / `unhandledrejection` handlers: a deduped toast, and a short bug note to /api/feedback (not in solo or dev). */
export function installCrashHandlers(opts: { report: boolean }): void {
  const gate = new ErrorGate();
  const handle = (e: unknown, where: string) => {
    const msg = describeError(e);
    if (ignorable(msg)) return;
    const d = gate.take(msg, performance.now());
    if (d.toast) showErrorToast();
    if (d.report && opts.report) {
      void fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive: true,
        body: JSON.stringify(reportBody(msg, where)),
      }).catch(() => {});
    }
  };
  window.addEventListener('error', (ev) => {
    // a failed <img>/<script> load also fires `error` (on the element, not window): only real script errors here
    if (!(ev instanceof ErrorEvent)) return;
    handle(ev.error ?? ev.message, `${ev.filename?.split('/').pop() ?? '?'}:${ev.lineno ?? 0}`);
  });
  window.addEventListener('unhandledrejection', (ev) => handle(ev.reason, 'promise'));
}
