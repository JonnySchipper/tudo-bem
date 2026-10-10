/**
 * Diary photo images, fetched when shown. The `photos` message lists the player's photos (ids, times, words) without their jpegs; whatever
 * shows a photo binds an <img> to its id here, and the ids asked for in the same tick go to the server together (`diary` `photoImages`, a few
 * dozen at a time). Answers are kept (the most recent few hundred) so turning back a page does not ask again.
 */
import { PHOTO_IMAGES_PER_REQUEST, type ClientMsg } from '@tudobem/shared';

/** Images kept in memory (a page of the photo wall is about a dozen). */
const KEEP = 300;
/** An unanswered request (a dropped socket) may be asked again after this. */
const RETRY_MS = 8_000;

type Send = (m: ClientMsg) => void;

export interface PhotoImageCache {
  /** The image if it is here; otherwise it is asked for and `then` gets it when it comes. */
  get(id: string, then?: (image: string) => void): string | undefined;
  /** Show photo `id` in `img` (now, or when it arrives). Returns the img. */
  bind(img: HTMLImageElement, id: string): HTMLImageElement;
  /** The server's answer. */
  receive(images: readonly { id: string; image: string }[]): void;
  setSender(send: Send): void;
}

export function photoImageCache(schedule: (fn: () => void) => void = queueMicrotask, now: () => number = Date.now): PhotoImageCache {
  const images = new Map<string, string>();
  const asked = new Map<string, number>();
  const waiters = new Map<string, Set<(image: string) => void>>();
  const queue = new Set<string>();
  let send: Send | null = null;
  let armed = false;

  const flush = () => {
    armed = false;
    const ids = [...queue];
    queue.clear();
    if (!send) return;
    for (let i = 0; i < ids.length; i += PHOTO_IMAGES_PER_REQUEST) send({ t: 'diary', action: 'photoImages', ids: ids.slice(i, i + PHOTO_IMAGES_PER_REQUEST) });
  };

  const cache: PhotoImageCache = {
    get(id, then) {
      const hit = images.get(id);
      if (hit) {
        // most recently used last
        images.delete(id);
        images.set(id, hit);
        return hit;
      }
      if (then) {
        let set = waiters.get(id);
        if (!set) waiters.set(id, (set = new Set()));
        set.add(then);
      }
      const at = asked.get(id);
      if (at === undefined || now() - at > RETRY_MS) {
        asked.set(id, now());
        queue.add(id);
        if (!armed) {
          armed = true;
          schedule(flush);
        }
      }
      return undefined;
    },
    bind(img, id) {
      img.dataset.photoId = id;
      const hit = cache.get(id, (image) => {
        // the img may have been reused for another photo meanwhile
        if (img.dataset.photoId !== id) return;
        img.src = image;
        img.classList.remove('photo-loading');
      });
      if (hit) img.src = hit;
      else img.classList.add('photo-loading');
      return img;
    },
    receive(list) {
      for (const { id, image } of list) {
        if (typeof id !== 'string' || typeof image !== 'string') continue;
        images.delete(id);
        images.set(id, image);
        asked.delete(id);
        const set = waiters.get(id);
        waiters.delete(id);
        for (const fn of set ?? []) fn(image);
      }
      while (images.size > KEEP) images.delete(images.keys().next().value!);
    },
    setSender(fn) {
      send = fn;
    },
  };
  return cache;
}

/** The game's one cache (main.ts wires the sender and the answers). */
export const photoImages = photoImageCache();
