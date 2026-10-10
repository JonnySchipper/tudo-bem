import { describe, expect, it } from 'vitest';
import { PHOTO_IMAGES_PER_REQUEST, type ClientMsg } from '@tudobem/shared';
import { photoImageCache } from './photoImageCache';

function setup() {
  const pending: (() => void)[] = [];
  let t = 0;
  const cache = photoImageCache((fn) => pending.push(fn), () => t);
  const sent: ClientMsg[] = [];
  cache.setSender((m) => sent.push(m));
  const tick = () => pending.splice(0).forEach((fn) => fn());
  return { cache, sent, tick, later: (ms: number) => (t += ms) };
}

describe('photo image cache', () => {
  it('asks once for the ids wanted in one tick, in batches, and hands each image to whoever waits', () => {
    const { cache, sent, tick } = setup();
    const got: string[] = [];
    expect(cache.get('a', (img) => got.push(`a:${img}`))).toBeUndefined();
    cache.get('a', (img) => got.push(`a2:${img}`));
    cache.get('b');
    tick();
    expect(sent).toEqual([{ t: 'diary', action: 'photoImages', ids: ['a', 'b'] }]);
    cache.receive([{ id: 'a', image: 'A' }]);
    expect(got).toEqual(['a:A', 'a2:A']);
    expect(cache.get('a')).toBe('A');
    // asked and not answered yet: not asked again
    cache.get('b');
    tick();
    expect(sent).toHaveLength(1);
    const many = Array.from({ length: PHOTO_IMAGES_PER_REQUEST + 1 }, (_, i) => `m${i}`);
    for (const id of many) cache.get(id);
    tick();
    expect(sent.slice(1).map((m) => (m as { ids: string[] }).ids.length)).toEqual([PHOTO_IMAGES_PER_REQUEST, 1]);
  });

  it('asks again after a request went unanswered for a while (a dropped socket)', () => {
    const { cache, sent, tick, later } = setup();
    cache.get('a');
    tick();
    later(9_000);
    cache.get('a');
    tick();
    expect(sent).toHaveLength(2);
  });
});
