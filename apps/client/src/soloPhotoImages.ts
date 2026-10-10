/**
 * Solo mode's diary photo images (the server keeps them in SQLite): one IndexedDB store keyed by profile and photo id, so the profiles in
 * localStorage stay small and every photo is kept. Without IndexedDB (a private window that blocks it) the images live for the session.
 */
import type { PhotoImageStore } from '@tudobem/server/store';

const DB = 'tb_solo_photos_v1';
const STORE = 'images';

type Row = { key: string; profileId: string; image: string };

const keyOf = (profileId: string, photoId: string) => `${profileId}/${photoId}`;

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function soloPhotoImages(): PhotoImageStore {
  const memory = new Map<string, Row>();
  const db: Promise<IDBDatabase | null> = new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('profile', 'profileId');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  const write = (fn: (s: IDBObjectStore) => void) =>
    void db
      .then((d) => {
        if (d) fn(d.transaction(STORE, 'readwrite').objectStore(STORE));
      })
      .catch((e) => console.warn('[solo] photo images', e));

  return {
    put: (profileId, photoId, image) => {
      const row = { key: keyOf(profileId, photoId), profileId, image };
      memory.set(row.key, row);
      write((s) => s.put(row));
    },
    get: async (profileId, photoIds) => {
      const out = new Map<string, string>();
      const d = await db.catch(() => null);
      for (const id of photoIds) {
        const key = keyOf(profileId, id);
        let row = memory.get(key);
        if (!row && d) row = (await request(d.transaction(STORE).objectStore(STORE).get(key)).catch(() => undefined)) as Row | undefined;
        if (row) out.set(id, row.image);
      }
      return out;
    },
    remove: (profileId, photoIds) => {
      for (const id of photoIds) memory.delete(keyOf(profileId, id));
      write((s) => {
        for (const id of photoIds) s.delete(keyOf(profileId, id));
      });
    },
    removeProfile: (profileId) => {
      for (const [k, r] of memory) if (r.profileId === profileId) memory.delete(k);
      write((s) => {
        const keys = s.index('profile').getAllKeys(profileId);
        keys.onsuccess = () => {
          for (const k of keys.result) s.delete(k);
        };
      });
    },
  };
}
