import { describe, expect, it } from 'vitest';
import { speechChunks } from './speechChunks.js';

describe('speechChunks', () => {
  it('cuts at commas, sentence ends and the "e" of a list', () => {
    expect(speechChunks('Bom dia! Me vê dois pães e um café, por favor.')).toEqual(['Bom dia!', 'Me vê dois pães', 'e um café,', 'por favor.']);
  });
  it('keeps a short line whole', () => {
    expect(speechChunks('Quanto é?')).toEqual(['Quanto é?']);
  });
});
