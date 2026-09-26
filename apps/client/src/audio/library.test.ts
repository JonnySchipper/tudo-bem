import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { viewNode } from '@tudobem/shared';
import { clipKey, findClip, pickPtVoice, TTS_MANIFEST } from './library';

const audioDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/audio/tts');

describe('prebaked Portuguese speech', () => {
  it('bakes Antonio for Carlos and Francisca for UI, with files on disk', () => {
    expect(TTS_MANIFEST.voices.carlos).toBe('pt-BR-AntonioNeural');
    expect(TTS_MANIFEST.voices.ui).toBe('pt-BR-FranciscaNeural');
    const carlos = TTS_MANIFEST.lines.filter((l) => l.voice === 'carlos');
    const ui = TTS_MANIFEST.lines.filter((l) => l.voice === 'ui');
    expect(carlos.length).toBeGreaterThanOrEqual(15);
    expect(ui.length).toBeGreaterThanOrEqual(15);
    for (const line of TTS_MANIFEST.lines) {
      const file = path.join(audioDir, line.file);
      expect(fs.existsSync(file), line.file).toBe(true);
      expect(fs.statSync(file).size, line.file).toBeGreaterThan(400);
    }
  });

  it('matches the Carlos scene lines Ouvir speaks, including kinship', () => {
    const nodes = ['inicio', 'inicio_devagar', 'pedido', 'pedido_calma', 'pedido_dica', 'bebida_dica', 'local', 'local_dica', 'preco_dica', 'fim'] as const;
    for (const pronoun of ['nome', 'ele', 'ela'] as const) {
      for (const id of nodes) {
        const view = viewNode(id, { name: 'Ana', pronoun });
        expect(findClip(view!.line.pt)?.voice, `${id}/${pronoun}`).toBe('carlos');
      }
    }
    expect(findClip(viewNode('bebida', { name: 'Ana', pronoun: 'nome', food: 'pao_na_chapa' })!.line.pt)?.voice).toBe('carlos');
    expect(findClip(viewNode('comida', { name: 'Ana', pronoun: 'ela', drink: 'agua' })!.line.pt)?.voice).toBe('carlos');
    expect(findClip(viewNode('preco', { name: 'Ana', pronoun: 'nome', food: 'pao_na_chapa', drink: 'cafe_com_leite' })!.line.pt)?.voice).toBe('carlos');
  });

  it('uses Francisca for parrot words and tray orders', () => {
    expect(findClip('pão na chapa')?.voice).toBe('ui');
    expect(findClip('Me vê um pão na chapa.')?.voice).toBe('ui');
    expect(findClip('Tudo bem?')?.voice).toBe('ui');
  });

  it('normalizes quotes and never picks an English voice', () => {
    const curled = 'Pão na chapa? Coxinha? Pastel? Fala assim: “Me vê um pão na chapa, por favor.”';
    expect(clipKey(curled)).toBe('Pão na chapa? Coxinha? Pastel? Fala assim: "Me vê um pão na chapa, por favor."');
    expect(findClip(curled.replace(/[“”]/g, '"'))?.voice).toBe('carlos');
    const voices = [
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'en-GB', name: 'Daniel' },
      { lang: 'pt-PT', name: 'Joana' },
      { lang: 'pt-BR', name: 'Luciana' },
    ];
    expect(pickPtVoice(voices)?.lang).toBe('pt-BR');
    expect(pickPtVoice(voices.filter((v) => v.lang !== 'pt-BR'))?.lang).toBe('pt-PT');
    expect(pickPtVoice(voices.filter((v) => v.lang.startsWith('en')))).toBeNull();
    expect(pickPtVoice([])).toBeNull();
  });
});
