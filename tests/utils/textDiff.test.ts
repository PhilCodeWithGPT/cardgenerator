import { describe, it, expect } from 'vitest';
import { diffWords, keepLineIndent } from '../../utils/textDiff';

describe('diffWords', () => {
  it('markiert geänderte Wörter', () => {
    const parts = diffWords('Der hund bellt', 'Der Hund bellt');
    expect(parts).toEqual([
      { type: 'same', text: 'Der ' },
      { type: 'del', text: 'hund' },
      { type: 'add', text: 'Hund' },
      { type: 'same', text: ' bellt' },
    ]);
  });
  it('ergibt bei gleichem Text nur "same"', () => {
    expect(diffWords('a b', 'a b')).toEqual([{ type: 'same', text: 'a b' }]);
  });
});

describe('keepLineIndent', () => {
  it('stellt Leerzeichen am Zeilenanfang wieder her', () => {
    expect(keepLineIndent('   ein hund\n\nzwei', 'Ein Hund\n\nZwei')).toBe('   Ein Hund\n\nZwei');
  });
  it('lässt den Text bei anderer Zeilenzahl unverändert', () => {
    expect(keepLineIndent('a\nb', 'A b')).toBe('A b');
  });
});
