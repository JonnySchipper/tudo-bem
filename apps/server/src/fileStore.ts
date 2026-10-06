import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFileSync } from './atomicWrite.js';
import type { PlayerAcademy } from '@tudobem/shared';
import type { AcademyPersistence } from './academyStore.js';
import type { PersistenceAdapter, StoredProfile } from './store.js';

type Photos = NonNullable<StoredProfile['photos']>;

/**
 * JSON-file persistence for the Node server.
 *
 * `profiles.json` is rewritten (synchronously, debounced) whenever anyone's profile changes, so it holds no photo images: a dozen jpegs
 * per player made every write serialize megabytes and stalled the server for everyone. The images live in `photos.json`, rewritten only
 * when somebody's photos actually change. Saves from before the split still carry their photos inline and are moved over on the next write.
 */
export function fileAdapter(dataDir: string): PersistenceAdapter {
  const file = path.join(dataDir, 'profiles.json');
  const photoFile = path.join(dataDir, 'photos.json');
  /** what photos.json holds now, by profile id: the photo ids in order */
  const written = new Map<string, string>();
  const signature = (photos: Photos | undefined) => (photos ?? []).map((p) => p.id).join(',');
  return {
    describe: () => file,
    load: () => {
      const rows = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as StoredProfile[]) : [];
      const photos = fs.existsSync(photoFile) ? (JSON.parse(fs.readFileSync(photoFile, 'utf8')) as Record<string, Photos>) : {};
      for (const row of rows) {
        const kept = photos[row.id];
        if (kept) {
          row.photos = kept;
          written.set(row.id, signature(kept));
        }
      }
      return rows;
    },
    save: (rows) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      let photosChanged = false;
      for (const r of rows) if ((r.photos?.length || written.has(r.id)) && signature(r.photos) !== (written.get(r.id) ?? '')) photosChanged = true;
      if (photosChanged) {
        const all: Record<string, Photos> = {};
        written.clear();
        for (const r of rows) {
          if (!r.photos?.length) continue;
          all[r.id] = r.photos;
          written.set(r.id, signature(r.photos));
        }
        atomicWriteFileSync(photoFile, JSON.stringify(all));
      }
      atomicWriteFileSync(file, JSON.stringify(rows, (k, v) => (k === 'photos' ? undefined : v)));
    },
  };
}

/** Player academies. One JSON array beside the profiles. */
export function academyFileAdapter(dataDir: string): AcademyPersistence {
  const file = path.join(dataDir, 'academies.json');
  return {
    describe: () => file,
    load: () => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as unknown[]) : []),
    save: (rows: PlayerAcademy[]) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      atomicWriteFileSync(file, JSON.stringify(rows));
    },
  };
}

/** Player-owned padarias beside profiles. */
export function padariaFileAdapter(dataDir: string): import('./padariaStore.js').PadariaPersistence {
  const file = path.join(dataDir, 'padarias.json');
  return {
    describe: () => file,
    load: () => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as unknown[]) : []),
    save: (rows) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      atomicWriteFileSync(file, JSON.stringify(rows));
    },
  };
}
