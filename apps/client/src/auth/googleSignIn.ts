/** Google Identity Services (Sign in with Google) button for the intro form. */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void;
          renderButton: (parent: HTMLElement, opts: Record<string, string | number | boolean>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('google gsi script failed'));
    document.head.append(s);
  });
  return scriptPromise;
}

/** Mount the official Google button; returns a cleanup that removes it. */
export function mountGoogleSignIn(host: HTMLElement, clientId: string, onCredential: (credential: string) => void): () => void {
  let alive = true;
  const inner = document.createElement('div');
  inner.className = 'intro-google-btn';
  host.replaceChildren(inner);
  void loadGisScript()
    .then(() => {
      if (!alive || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) });
      window.google.accounts.id.renderButton(inner, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(360, host.clientWidth || 320),
        locale: 'pt-BR',
      });
    })
    .catch(() => {
      if (alive) host.replaceChildren();
    });
  return () => {
    alive = false;
    window.google?.accounts?.id?.cancel();
    host.replaceChildren();
  };
}
