/**
 * Diary photo images, apart from the profiles. A profile keeps only its photos' ids, times and words (`DiaryPhoto`), so a player can keep
 * every photo without the server holding hundreds of jpegs in memory or sending them all on connect: the client asks for the images it
 * shows (`diary` `photoImages`). SQLite keeps one row per image (`fileStore.ts`); tests and a server without a data dir keep them in memory;
 * the solo preview keeps them in IndexedDB (client `localNet.ts`).
 */
export interface PhotoImageStore {
  put(profileId: string, photoId: string, image: string): void;
  /** The images there are, by photo id (an id with none is left out). */
  get(profileId: string, photoIds: readonly string[]): Promise<Map<string, string>>;
  remove(profileId: string, photoIds: readonly string[]): void;
  /** Every image of a deleted profile. */
  removeProfile(profileId: string): void;
}

export function memoryPhotoImages(): PhotoImageStore {
  const byProfile = new Map<string, Map<string, string>>();
  return {
    put: (profileId, photoId, image) => {
      let m = byProfile.get(profileId);
      if (!m) byProfile.set(profileId, (m = new Map()));
      m.set(photoId, image);
    },
    get: async (profileId, photoIds) => {
      const m = byProfile.get(profileId);
      const out = new Map<string, string>();
      for (const id of photoIds) {
        const image = m?.get(id);
        if (image) out.set(id, image);
      }
      return out;
    },
    remove: (profileId, photoIds) => {
      const m = byProfile.get(profileId);
      for (const id of photoIds) m?.delete(id);
    },
    removeProfile: (profileId) => void byProfile.delete(profileId),
  };
}
