import { describe, expect, it } from 'vitest';
import { Lru } from './lru';

describe('Lru', () => {
  it('evicts the least recently used unused entry past the cap and reports it', () => {
    const evicted: string[] = [];
    const c = new Lru<number>(2, (k) => evicted.push(k));
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // b is now the oldest
    c.set('c', 3);
    expect(evicted).toEqual(['b']);
    expect(c.keys()).toEqual(['a', 'c']);
  });

  it('never evicts an entry a sprite still uses', () => {
    const evicted: string[] = [];
    const c = new Lru<number>(1, (k) => evicted.push(k));
    c.set('a', 1);
    c.retain('a');
    c.set('b', 2);
    expect(evicted).toEqual([]);
    expect(c.size).toBe(2);
    c.release('a');
    expect(evicted).toEqual(['a']);
    expect(c.size).toBe(1);
  });
});
