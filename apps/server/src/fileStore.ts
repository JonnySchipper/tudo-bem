import fs from 'node:fs';
import path from 'node:path';
import type { PersistenceAdapter, StoredProfile } from './store.js';

/** JSON-file persistence for the Node server. */
export function fileAdapter(dataDir: string): PersistenceAdapter {
  const file = path.join(dataDir, 'profiles.json');
  return {
    describe: () => file,
    load: () => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as StoredProfile[]) : []),
    save: (rows) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(rows));
      fs.renameSync(tmp, file);
    },
  };
}
