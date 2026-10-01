import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from './world.js';
import { ProfileStore } from './store.js';
import { readEnv } from './env.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The solo build (VITE_LOCAL_WORLD=1) runs `World` in the browser through LocalNet, where `process` does not exist.
 * Every server module reachable from LocalNet must therefore never touch a bare `process`: read env through `readEnv`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

/** Modules LocalNet pulls into the bundle: `@tudobem/server/world`, `/store`, `/services` (stubs) and their relative imports. */
function browserBundledModules(): string[] {
  const seen = new Set<string>();
  const queue = ['world.ts', 'store.ts', path.join('services', 'stubs.ts')];
  while (queue.length) {
    const rel = queue.pop()!;
    if (seen.has(rel)) continue;
    seen.add(rel);
    const src = fs.readFileSync(path.join(here, rel), 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)) {
      const target = path.normalize(path.join(path.dirname(rel), m[1]!.replace(/\.js$/, '.ts')));
      if (fs.existsSync(path.join(here, target))) queue.push(target);
    }
  }
  return [...seen];
}

describe('browser-bundled server modules', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('use no bare `process` access (comments aside)', () => {
    const offenders: string[] = [];
    for (const rel of browserBundledModules()) {
      const src = fs.readFileSync(path.join(here, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      src.split('\n').forEach((line, i) => {
        if (/(^|[^.\w'"`])process\.(env|cwd|pid|argv|on|exit)\b/.test(line) && !line.includes('typeof process')) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('World constructs with `process` undefined', () => {
    const make = () =>
      new World(
        new ProfileStore(null),
        { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
        { schedule: () => {} },
      );
    vi.stubGlobal('process', undefined);
    expect(typeof process).toBe('undefined');
    expect(readEnv('TB_TEST_ROLL')).toBeUndefined();
    expect(make).not.toThrow();
  });
});
