import { describe, expect, it } from 'vitest';
import { World } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { atomicWriteFileSync } from './atomicWrite.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const world = (now: () => number) =>
  new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { now, schedule: () => {} },
  );

describe('test clock control (e2e pin)', () => {
  it('setClockMinute makes the game clock read the minute now, from any starting point', () => {
    for (const start of [0, 1_234_567, 987_654_321, 2_000_000_000_000]) {
      const w = world(() => start);
      for (const target of [0, 361, 510, 1259, 1439]) {
        expect(w.setClockMinute(target)).toBe(target);
        expect(w.gameMinuteNow()).toBe(target);
      }
    }
  });

  it('the pin keeps moving with real time (1 game minute = 2 real seconds)', () => {
    let t = 10_000_000;
    const w = world(() => t);
    w.setClockMinute(510);
    t += 60_000; // 60 real seconds
    expect(w.gameMinuteNow()).toBe(540);
  });

  it('clamps out-of-range requests', () => {
    const w = world(() => 42);
    expect(w.setClockMinute(5000)).toBe(1439);
    expect(w.setClockMinute(-20)).toBe(0);
  });
});

describe('atomicWriteFileSync', () => {
  it('writes through a unique tmp name and leaves no tmp behind, also for overlapping writes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-atomic-'));
    const file = path.join(dir, 'x.json');
    for (let i = 0; i < 25; i++) atomicWriteFileSync(file, JSON.stringify({ i }));
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ i: 24 });
    expect(fs.readdirSync(dir)).toEqual(['x.json']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
