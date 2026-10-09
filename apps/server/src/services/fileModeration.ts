import fs from 'node:fs';
import path from 'node:path';
import type { ModerationEvent } from './interfaces.js';
import { MemoryModerationQueue } from './stubs.js';
import { atomicWriteFileSync } from '../atomicWrite.js';

/** Past this size the log rolls over to `<file>.1` (the previous `.1` is dropped), so the disk never fills. */
export const MODERATION_LOG_MAX_BYTES = 5 * 1024 * 1024;
/** Lines reloaded into memory on startup, so the review list survives a restart. */
const RELOAD_LINES = 500;

/** Moderation queue that also appends JSON lines to disk (Phase 0 human-review stub). */
export class FileModerationQueue extends MemoryModerationQueue {
  private size = 0;
  constructor(
    private file: string,
    private maxBytes = MODERATION_LOG_MAX_BYTES,
  ) {
    super();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      const raw = fs.readFileSync(file, 'utf8');
      this.size = Buffer.byteLength(raw);
      for (const line of raw.split('\n').slice(-RELOAD_LINES - 1)) {
        if (!line.trim()) continue;
        try {
          this.items.push(JSON.parse(line) as ModerationEvent);
        } catch {
          // a torn last line from a crash: skip it
        }
      }
    } catch {
      // no log yet
    }
  }
  override push(ev: ModerationEvent) {
    super.push(ev);
    const line = JSON.stringify(ev) + '\n';
    const bytes = Buffer.byteLength(line);
    try {
      if (this.size + bytes > this.maxBytes && this.size > 0) {
        fs.renameSync(this.file, this.file + '.1');
        this.size = 0;
      }
      fs.appendFileSync(this.file, line);
      this.size += bytes;
    } catch (e) {
      console.error('[moderação] could not write the log', e);
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
    const out = kept.map((l) => l + '\n').join('');
    atomicWriteFileSync(this.file, out, 0o600);
    this.size = Buffer.byteLength(out);
    return lines.length - kept.length;
  }
}
