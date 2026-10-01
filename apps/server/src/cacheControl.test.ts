import { describe, expect, it } from 'vitest';
import { staticCacheControl } from './cacheControl';

const cc = (p: string, ext: string) => staticCacheControl(new URL(p, 'http://x'), ext);

describe('static cache policy', () => {
  it('revalidates html and every pixel-art file (fixed names, written together)', () => {
    expect(cc('/', '.html')).toBe('no-cache');
    expect(cc('/pixel/manifest.json', '.json')).toBe('no-cache');
    expect(cc('/pixel/atlas/props.png', '.png')).toBe('no-cache');
    expect(cc('/tudo-bem/pixel/portraits/carlos_neutro.png', '.png')).toBe('no-cache');
  });

  it('keeps hashed bundles immutable', () => {
    expect(cc('/assets/main-bssKhoSw.js', '.js')).toContain('immutable');
  });
});
