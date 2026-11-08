import { describe, it, expect } from 'vitest';
import { withGuillemets, clampFontSize, DEFAULT_FONT_SIZE } from '../../utils/typography';

describe('withGuillemets', () => {
  it('wandelt >> und << in Guillemets', () => {
    expect(withGuillemets('Er ruft >>Hilfe!<<')).toBe('Er ruft »Hilfe!«');
  });
  it('lässt einzelne Zeichen und direkt getippte Guillemets stehen', () => {
    expect(withGuillemets('a > b < c »x«')).toBe('a > b < c »x«');
  });
});

describe('clampFontSize', () => {
  it('nimmt den Standard bei fehlendem Wert', () => {
    expect(clampFontSize(undefined)).toBe(DEFAULT_FONT_SIZE);
  });
  it('begrenzt auf den erlaubten Bereich', () => {
    expect(clampFontSize(2)).toBe(16);
    expect(clampFontSize(99)).toBe(44);
    expect(clampFontSize(24.4)).toBe(24);
  });
});
