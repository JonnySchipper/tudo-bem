import type http from 'node:http';

/**
 * Phase 0 scaffold: auth endpoints return 501 until account service merges.
 * The client adapter treats this as a signal to use the local stub without breaking play.
 */
export function handleAuthApi(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean {
  if (pathname !== '/api/auth/login' && pathname !== '/api/auth/register') return false;
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ pt: 'Método não permitido.', en: 'Method not allowed.' }));
    return true;
  }
  res.writeHead(501, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(
    JSON.stringify({
      stub: true,
      pt: 'Contas reais chegam em breve — o cliente usa modo demonstração.',
      en: 'Real accounts are coming soon — the client uses demo mode for now.',
    }),
  );
  return true;
}
