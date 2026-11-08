/**
 * Wortgenauer Vergleich für die Rechtschreibprüfung: zeigt, was sich zwischen dem
 * Original und der korrigierten Fassung geändert hat (Leerraum zählt als eigenes Stück).
 */
export type DiffPart = { type: 'same' | 'del' | 'add'; text: string };

const tokenize = (s: string) => s.split(/(\s+)/).filter((t) => t !== '');

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  // LCS-Tabelle (Kartentexte sind kurz, quadratisch ist hier unproblematisch)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', a[i++]);
    } else {
      push('add', b[j++]);
    }
  }
  while (i < a.length) push('del', a[i++]);
  while (j < b.length) push('add', b[j++]);
  return parts;
}

/**
 * Sicherheitsnetz: Hat die KI die Zeilenzahl beibehalten, bekommt jede Zeile wieder genau den
 * Leerraum am Anfang wie im Original (der Text wird damit um Bilder geformt).
 */
export function keepLineIndent(original: string, corrected: string): string {
  const o = original.split('\n');
  const c = corrected.split('\n');
  if (o.length !== c.length) return corrected;
  return c
    .map((line, i) => (o[i].match(/^[ \t]*/)?.[0] ?? '') + line.replace(/^[ \t]*/, ''))
    .join('\n');
}
