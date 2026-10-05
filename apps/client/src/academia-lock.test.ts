/**
 * The #49 product lock, applied to "Treino no tatame": learner-facing Academia copy never names a BJJ position or a submission.
 * Pose ids (`de_pe`, `montada`, ...) stay internal (they pick the mat art); the readable names must not even ship in the client bundle.
 * This test builds the real client bundle in memory and greps every emitted JS/CSS/HTML chunk.
 */
import path from 'node:path';
import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { BOUT_STEP_CHROME, boutStepLabel, PARTNERS, endLine, type BoutReason, type BoutWinner } from '@tudobem/shared';

const CLIENT_ROOT = path.resolve(import.meta.dirname, '..');

/** Readable position / submission names, PT and EN. Quoted `Montada` / `Costas` catch a label while the lowercase pose ids stay legal. */
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'Guarda fechada', re: /guarda fechada/i },
  { name: 'Meia-guarda', re: /meia[- ]guarda/i },
  { name: 'Cem quilos', re: /cem quilos/i },
  { name: 'Joelho na barriga', re: /joelho na barriga/i },
  { name: 'Closed guard', re: /closed guard/i },
  { name: 'Half guard', re: /half guard/i },
  { name: 'Side control', re: /side control/i },
  { name: 'Knee on belly', re: /knee on belly/i },
  { name: 'Back control', re: /back control/i },
  { name: 'Mount (label)', re: /["'`]Mount["'`]|\bMount ·/ },
  { name: 'Montada (label)', re: /["'`>]\s*Montada\b|Montada ·/ },
  { name: 'Costas (label)', re: /["'`>]\s*Costas\b|Costas ·/ },
  // The gag track is the plural "Submissions". Singular Submission and Finalização stay forbidden.
  { name: 'Finalização / Submission', re: /Finaliza[cç]|Submission(?!s)/ },
];

describe('Academia #49 lock: no position or submission names in the client bundle', () => {
  it('emits no readable position / submission label in any chunk', async () => {
    const out = (await build({
      root: CLIENT_ROOT,
      configFile: path.join(CLIENT_ROOT, 'vite.config.ts'),
      logLevel: 'silent',
      build: { write: false, emptyOutDir: false },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    const chunks = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
    expect(chunks.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const c of chunks) {
      const text = c.type === 'chunk' ? c.code : typeof c.source === 'string' && /\.(css|html)$/.test(c.fileName) ? c.source : '';
      for (const f of FORBIDDEN) if (f.re.test(text)) hits.push(`${c.fileName}: ${f.name}`);
    }
    expect(hits).toEqual([]);
    // sanity: the grep does see the bout UI (the neutral steps are in there), so an empty hit list means something
    const all = chunks.map((c) => (c.type === 'chunk' ? c.code : '')).join('\n');
    expect(all).toContain('Quase lá');
  }, 240_000);
});

describe('Academia #49 lock: shared copy', () => {
  const NAMES = /guarda|montada|costas|cem quilos|joelho|kimura|triângulo|mata-leão|guilhotina|finaliza|submission|closed guard|half guard|side control|knee on belly|back control|\bmount\b/i;

  it('bout steps are the neutral sequence, and standing is just "Em pé"', () => {
    expect(BOUT_STEP_CHROME.map((s) => s.pt)).toEqual(['Vantagem', 'Pressão', 'Quase lá', 'Virada', 'Final']);
    expect([0, 1, 2, 3, 4, -1, -3, -4].map((r) => boutStepLabel(r).pt)).toEqual(['Em pé', 'Vantagem', 'Pressão', 'Quase lá', 'Final', 'Vantagem', 'Quase lá', 'Final']);
    const copy = [...BOUT_STEP_CHROME, boutStepLabel(0)].flatMap((s) => [s.pt, s.en]).join(' ');
    expect(copy).not.toMatch(NAMES);
  });

  it('end lines, partner bios and partner styles teach no names', () => {
    const reasons: BoutReason[] = ['finalizacao', 'pontos', 'vantagens', 'empate', 'quit'];
    const winners: BoutWinner[] = ['you', 'partner', 'draw'];
    const lines = reasons.flatMap((r) => winners.map((w) => endLine(w, r))).flatMap((l) => [l.pt, l.en]);
    const bios = PARTNERS.flatMap((p) => [p.bio.pt, p.bio.en, p.style.pt, p.style.en]);
    expect([...lines, ...bios].join(' | ')).not.toMatch(NAMES);
  });
});
