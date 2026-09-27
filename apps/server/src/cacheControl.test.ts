import { describe, expect, it } from 'vitest';
import { staticCacheControl } from './cacheControl';

const cc = (p: string, ext: string) => staticCacheControl(new URL(p, 'http://x'), ext);

describe('static cache policy', () => {
  it('revalidates html, the art manifest and unversioned art', () => {
    expect(cc('/', '.html')).toBe('no-cache');
    expect(cc('/art/manifest.json', '.json')).toBe('no-cache');
    expect(cc('/art/props/caixa.png', '.png')).toBe('no-cache');
  });

  it('keeps hashed bundles and versioned art immutable', () => {
    expect(cc('/assets/main-bssKhoSw.js', '.js')).toContain('immutable');
    expect(cc('/art/props/caixa.png?v=76fee292df', '.png')).toContain('immutable');
  });
});
