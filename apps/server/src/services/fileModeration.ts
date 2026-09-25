import fs from 'node:fs';
import path from 'node:path';
import type { ModerationEvent } from './interfaces.js';
import { MemoryModerationQueue } from './stubs.js';

/** Moderation queue that also appends JSON lines to disk (Phase 0 human-review stub). */
export class FileModerationQueue extends MemoryModerationQueue {
  constructor(private file: string) {
    super();
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  override push(ev: ModerationEvent) {
    super.push(ev);
    fs.appendFile(this.file, JSON.stringify(ev) + '\n', () => {});
  }
}
