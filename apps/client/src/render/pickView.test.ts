import { describe, expect, it } from 'vitest';
import { pickView } from './pickView';

describe('pickView', () => {
  it('defaults to the pixel view', () => {
    expect(pickView(null)).toBe('pixel');
    expect(pickView(undefined)).toBe('pixel');
    expect(pickView('')).toBe('pixel');
  });
  it('keeps ?view=iso working, and ignores unknown names', () => {
    expect(pickView('iso')).toBe('iso');
    expect(pickView(' ISO ')).toBe('iso');
    expect(pickView('pixel')).toBe('pixel');
    expect(pickView('3d')).toBe('pixel');
  });
});
