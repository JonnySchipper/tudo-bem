import fs from 'node:fs';
import path from 'node:path';
import type { ModerationEvent } from './interfaces.js';
import { MemoryModerationQueue } from './stubs.js';
import { atomicWriteFileSync } from '../atomicWrite.js';

/** Moderation queue that also appends JSON lines to disk (Phase 0 human-review stub). */
export class FileModerationQueue extends MemoryModerationQueue {
  constructor(private file: string) {
    super();
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  override push(ev: ModerationEvent) {
    super.push(ev);
    try {
      fs.appendFileSync(this.file, JSON.stringify(ev) + '\n');
    } catch (e) {
      console.error('[moderação] could not append to the log', e);
    }
  }

  /**
   * Account deletion: drop every entry filed by or about these ids (account id, profile id), in memory and
   * in the file. Synchronous, and appends are too, so no pending write lands after the rewrite.
   */
  scrub(ids: readonly string[]): number {
    const gone = new Set(ids.filter(Boolean));
    if (!gone.size) return 0;
    const hit = (ev: { playerId?: unknown; targetId?: unknown }) => gone.has(String(ev.playerId)) || gone.has(String(ev.targetId));
    this.items = this.items.filter((ev) => !hit(ev));
    if (!fs.existsSync(this.file)) return 0;
    const lines = fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
    const kept = lines.filter((line) => {
      try {
        return !hit(JSON.parse(line));
      } catch {
        return true;
      }
    });
    if (kept.length === lines.length) return 0;
    atomicWriteFileSync(this.file, kept.map((l) => l + '\n').join(''), 0o600);
    return lines.length - kept.length;
  }
}
