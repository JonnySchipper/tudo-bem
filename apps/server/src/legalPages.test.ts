import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { legalPageFile, rewriteLegalRequestUrl } from './legalPages.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public');

describe('legal page paths', () => {
  it('maps privacy and terms, with or without a slash or .html', () => {
    for (const p of ['/privacy', '/privacy/', '/privacy.html', '/Privacy']) expect(legalPageFile(p)).toBe('privacy.html');
    for (const p of ['/terms', '/terms/', '/terms.html']) expect(legalPageFile(p)).toBe('terms.html');
    expect(legalPageFile('/')).toBeNull();
    expect(legalPageFile('/privacy/extra')).toBeNull();
    expect(legalPageFile('/index.html')).toBeNull();
  });

  it('rewrites extensionless dev URLs onto the static file and leaves .html alone', () => {
    expect(rewriteLegalRequestUrl('/privacy')).toBe('/privacy.html');
    expect(rewriteLegalRequestUrl('/privacy/')).toBe('/privacy.html');
    expect(rewriteLegalRequestUrl('/terms?from=login')).toBe('/terms.html?from=login');
    expect(rewriteLegalRequestUrl('/privacy.html')).toBe('/privacy.html');
    expect(rewriteLegalRequestUrl('/play')).toBe('/play');
  });
});

describe('legal pages over HTTP', () => {
  let app: ReturnType<typeof createApp> | null = null;
  const dirs: string[] = [];

  afterEach(async () => {
    await app?.close();
    app = null;
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  async function start(clientDist: string) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-legal-'));
    dirs.push(dataDir);
    app = createApp({ dataDir, clientDist, scrypt: { N: 1024, r: 8, p: 1 } });
    await new Promise<void>((r) => app!.server.listen(0, '127.0.0.1', () => r()));
    return `http://127.0.0.1:${(app!.server.address() as AddressInfo).port}`;
  }

  it('serves the real HTML for every privacy and terms URL, and still falls back elsewhere', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-dist-'));
    dirs.push(dist);
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>game</title>');
    fs.copyFileSync(path.join(publicDir, 'privacy.html'), path.join(dist, 'privacy.html'));
    fs.copyFileSync(path.join(publicDir, 'terms.html'), path.join(dist, 'terms.html'));
    const base = await start(dist);

    for (const p of ['/privacy', '/privacy/', '/privacy.html', '/terms', '/terms/', '/terms.html']) {
      const res = await fetch(base + p);
      expect(res.status, p).toBe(200);
      expect(res.headers.get('content-type'), p).toMatch(/text\/html/);
      const body = await res.text();
      expect(body, p).toContain('Effective October 9, 2026');
      expect(body, p).toContain('team@playtudobem.com');
      expect(body, p).not.toContain('<title>game</title>');
    }

    const home = await fetch(base + '/play');
    expect(await home.text()).toContain('<title>game</title>');
  });

  it('does not hide a missing legal page behind the game shell', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-dist-'));
    dirs.push(dist);
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>game</title>');
    const base = await start(dist);
    const res = await fetch(base + '/privacy');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });
});

describe('legal page copy', () => {
  it('states who runs the beta, how to ask for deletion, and does not invent a certification', () => {
    const privacy = fs.readFileSync(path.join(publicDir, 'privacy.html'), 'utf8');
    const terms = fs.readFileSync(path.join(publicDir, 'terms.html'), 'utf8');
    for (const html of [privacy, terms]) {
      expect(html).toContain('Davenport, Florida');
      expect(html).toContain('October 9, 2026');
      expect(html).toContain('team@playtudobem.com');
      expect(html).not.toMatch(/GDPR|CCPA|COPPA|SOC\s*2|HIPAA|ISO\s*27001/i);
    }
    expect(privacy).toContain('xAI');
    expect(privacy).toContain('Fly.io');
    expect(privacy).toContain('Apagar conta');
    expect(privacy).toContain('Baixar meus dados');
    expect(privacy).not.toContain('There is no delete button');
    expect(privacy).toContain('do not sell');
    expect(terms).toContain('no payment');
    expect(terms).toContain('18 or older');
  });
});
