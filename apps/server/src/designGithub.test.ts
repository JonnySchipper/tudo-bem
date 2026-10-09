import { describe, expect, it, vi } from 'vitest';
import { bundledObjects } from '@tudobem/shared';
import { publishLayoutPullRequest } from './designGithub.js';

describe('design mode github publish', () => {
  it('does not call GitHub when the token is missing', async () => {
    const fetchImpl = vi.fn();
    const result = await publishLayoutPullRequest({ token: undefined, room: 'praca', objects: bundledObjects('praca'), fetch: fetchImpl as never });
    expect(result).toEqual({ ok: false, reason: 'no-token' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('opens a pull request and never logs the token', async () => {
    const token = 'ghp_testtokenvalue1234567890';
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization ?? '';
      expect(auth).toBe(`Bearer ${token}`);
      expect(url.includes(token)).toBe(false);
      if (String(url).endsWith('/git/ref/heads/main')) return json({ object: { sha: 'abc123' } });
      if (String(url).includes('/git/refs') && init?.method === 'POST') return json({ ref: body.ref });
      if (String(url).includes('/contents/') && init?.method === 'GET') return json({ sha: 'filesha' });
      if (String(url).includes('/contents/') && init?.method === 'PUT') {
        expect(body.message).toBe('Design mode: praca layout');
        expect(body.branch.startsWith('design-mode/praca-')).toBe(true);
        const decoded = Buffer.from(body.content, 'base64').toString('utf8');
        expect(decoded).toContain('"room": "praca"');
        return json({ content: { path: body } });
      }
      if (String(url).endsWith('/pulls')) {
        expect(body.title).toBe('Design mode: praca layout');
        expect(body.base).toBe('main');
        return json({ html_url: 'https://github.com/JonnySchipper/tudo-bem/pull/999' });
      }
      return json({}, 404);
    });
    const result = await publishLayoutPullRequest({
      token,
      room: 'praca',
      objects: bundledObjects('praca').slice(0, 1),
      fetch: fetchImpl as never,
    });
    expect(result).toEqual({ ok: true, url: 'https://github.com/JonnySchipper/tudo-bem/pull/999' });
    expect(errors.join('\n')).not.toContain(token);
    spy.mockRestore();
  });
});

function json(body: unknown, status = 200): Response {
  return { status, json: async () => body } as Response;
}
