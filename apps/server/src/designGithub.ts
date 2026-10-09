/**
 * Open a pull request that writes one room's layout JSON back into the repo.
 * The token is `TB_GITHUB_TOKEN`. It is sent only as an Authorization header and never logged or returned.
 */
import { layoutRepoPath, serializeLayout, type PropDef, type RoomId } from '@tudobem/shared';

const REPO = 'JonnySchipper/tudo-bem';
const API = 'https://api.github.com';

export type PublishResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'no-token' | 'github' };

function scrub(s: string): string {
  return s.replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted]').replace(/ghp_[A-Za-z0-9]+/g, '[redacted]');
}

export async function publishLayoutPullRequest(opts: {
  token: string | undefined;
  room: RoomId;
  objects: PropDef[];
  fetch?: typeof fetch;
  repo?: string;
}): Promise<PublishResult> {
  const token = opts.token?.trim();
  if (!token) return { ok: false, reason: 'no-token' };
  const repo = opts.repo ?? REPO;
  const fetchImpl = opts.fetch ?? fetch;
  const branch = `design-mode/${opts.room}-${Date.now().toString(36)}`;
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'tudo-bem-design-mode',
  };
  const call = async (method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> => {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  };
  try {
    const main = await call('GET', `/repos/${repo}/git/ref/heads/main`);
    const sha = (main.json as { object?: { sha?: string } } | null)?.object?.sha;
    if (!main.status || main.status >= 300 || !sha) {
      console.error(`[layout] github ref failed: ${main.status}`);
      return { ok: false, reason: 'github' };
    }
    const created = await call('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha });
    if (created.status >= 300) {
      console.error(`[layout] github branch failed: ${created.status}`);
      return { ok: false, reason: 'github' };
    }
    const path = layoutRepoPath(opts.room);
    const existing = await call('GET', `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
    const fileSha = (existing.json as { sha?: string } | null)?.sha;
    const content = Buffer.from(serializeLayout(opts.room, opts.objects), 'utf8').toString('base64');
    const put = await call('PUT', `/repos/${repo}/contents/${path}`, {
      message: `Design mode: ${opts.room} layout`,
      content,
      branch,
      ...(fileSha ? { sha: fileSha } : {}),
    });
    if (put.status >= 300) {
      console.error(`[layout] github commit failed: ${put.status}`);
      return { ok: false, reason: 'github' };
    }
    const pr = await call('POST', `/repos/${repo}/pulls`, {
      title: `Design mode: ${opts.room} layout`,
      head: branch,
      base: 'main',
      body: `Layout of \`${opts.room}\` edited in the in-game design mode.\n`,
    });
    const url = (pr.json as { html_url?: string } | null)?.html_url;
    if (pr.status >= 300 || !url) {
      console.error(`[layout] github pull failed: ${pr.status}`);
      return { ok: false, reason: 'github' };
    }
    return { ok: true, url };
  } catch (err) {
    const message = err instanceof Error ? scrub(err.message) : 'request failed';
    console.error(`[layout] github error: ${message}`);
    return { ok: false, reason: 'github' };
  }
}
