/**
 * Jonny rename lock (2026-09-27): Academia do Bairro — zero Gracie in player-facing art/copy sources.
 * CI guards the same strings in code (the isometric art files that carried the labels were removed in Phase 5).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';

const ROOT = path.resolve(import.meta.dirname, '../../..');

const NO_GRACIE_FILES = [
  'packages/shared/src/rooms.ts',
  'packages/shared/src/academia.ts',
  'apps/client/src/ui/panels.ts',
  'apps/client/src/ui/bout.ts',
  'apps/server/src/bout.ts',
  'packages/shared/src/bout.ts',
  'packages/shared/src/challenges.ts',
  'apps/client/src/main.ts',
  'scripts/e2e.mjs',
];

describe('Academia do Bairro branding (no Gracie)', () => {
  it('room def and Praça portal use Academia do Bairro', () => {
    expect(ROOMS.academia.name).toBe('Academia do Bairro');
    expect(ROOMS.academia.gloss).toBe('Neighborhood Academy');
    const portal = ROOMS.rua.portals.find((p) => p.to === 'academia');
    expect(portal?.label.pt).toBe('Academia do Bairro');
    expect(portal?.label.en).toBe('Neighborhood Academy');
    const placa = ROOMS.academia.walls.find((w) => w.kind === 'placa');
    expect(placa?.text).toBe('ACADEMIA DO BAIRRO');
  });

  for (const rel of NO_GRACIE_FILES) {
    it(`${rel} contains no Gracie / GRACIE`, () => {
      const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(text).not.toMatch(/gracie/i);
    });
  }
});
