import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromeVars, expressionForGrade, expressionForScore, portraitKey } from './pixelArt';
import type { Manifest } from '../render/pixel/manifest';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/pixel/manifest.json'), 'utf8')) as Manifest;

describe('portrait expressions', () => {
  it('feliz on a perfect answer or a passed conta, surpreso on a miss, neutro otherwise', () => {
    expect(expressionForScore(undefined)).toBe('neutro');
    expect(expressionForScore(3)).toBe('feliz');
    expect(expressionForScore(2)).toBe('neutro');
    expect(expressionForScore(1)).toBe('neutro');
    expect(expressionForScore(0)).toBe('surpreso');
    expect(expressionForGrade('pass')).toBe('feliz');
    expect(expressionForGrade('almost')).toBe('neutro');
    expect(expressionForGrade('tryAgain')).toBe('surpreso');
    expect(expressionForGrade(null)).toBe('neutro');
  });

  it('every expression the UI can ask for exists for every NPC', () => {
    expect(portraitKey('prof', 'feliz')).toBe('portraits/prof_feliz');
    // the feira vendors borrow Carlos' and Graça's portraits until their own are drawn
    expect(portraitKey('ze')).toBe('portraits/carlos_neutro');
    for (const npc of ['carlos', 'nanda', 'julia', 'graca', 'tia_lu', 'prof']) {
      for (const e of ['neutro', 'feliz', 'surpreso'] as const) expect(manifest.images?.[portraitKey(npc, e)], `${npc} ${e}`).toBeTruthy();
    }
  });
});

describe('chromeVars', () => {
  const vars = chromeVars(manifest.images ?? null, '/pixel/');

  it('turns the ui kit into border-image shorthands at 1x and 2x', () => {
    expect(vars['--px-panel']).toBe('url(/pixel/ui/panel.png) 7 7 7 7 fill / 7px 7px 7px 7px / 0 stretch');
    expect(vars['--px-panel-2']).toContain('14px 14px 14px 14px');
    expect(vars['--px-bubble']).toContain('7 7 13 16');
    for (const k of ['--px-button', '--px-button-hover', '--px-button-pressed']) expect(vars[k], k).toContain(' 6 6 7 6 fill');
    expect(vars['--px-panel-w']).toBe('7px');
    expect([vars['--px-btn-x'], vars['--px-btn-t'], vars['--px-btn-b']]).toEqual(['6px', '6px', '7px']);
  });

  it('is empty without a ui kit, so the old chrome stays', () => {
    expect(chromeVars(null, '/pixel/')).toEqual({});
    expect(chromeVars({}, '/pixel/')).toEqual({});
  });
});
