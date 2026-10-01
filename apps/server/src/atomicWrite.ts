import fs from 'node:fs';

let counter = 0;

/**
 * Write `data` to `file` through a uniquely named tmp file, then rename over it. The tmp name is unique per write (pid + counter), so two
 * overlapping writes never share a tmp; the rename is retried because Windows answers EPERM / EBUSY / EACCES when antivirus or an indexer
 * briefly holds the target. The last error is thrown after the retries.
 */
export function atomicWriteFileSync(file: string, data: string, mode?: number): void {
  const tmp = `${file}.${process.pid}.${++counter}.tmp`;
  fs.writeFileSync(tmp, data, mode === undefined ? undefined : { mode });
  let last: unknown;
  for (let i = 0; i < 12; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      last = e;
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5 + i * 5);
    }
  }
  try {
    fs.rmSync(tmp, { force: true });
  } catch {
    /* best effort */
  }
  throw last;
}
