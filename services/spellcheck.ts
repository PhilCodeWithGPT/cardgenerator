import { CardData } from '../types';
import { CARD_STORE_URL } from './cardStore';

/** Felder, die die Rechtschreibprüfung ansieht und korrigiert. */
export const SPELL_FIELDS = ['title', 'restrictions', 'description', 'badStuff'] as const;
export type SpellField = (typeof SPELL_FIELDS)[number];

export interface SpellChange {
  field: SpellField;
  before: string;
  after: string;
  why: string;
}

export type SpellResult = Record<SpellField, string> & { changes: SpellChange[] };

/** Prüft alle Kartentexte über den eigenen Server (der ruft die KI auf). */
export async function checkSpelling(card: CardData): Promise<SpellResult> {
  const body: Record<string, string> = { type: String(card.type) };
  for (const f of SPELL_FIELDS) body[f] = (card[f] as string | undefined) ?? '';
  const r = await fetch(`${CARD_STORE_URL}/spellcheck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  if (!r.ok) {
    const msg =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as SpellResult;
}
