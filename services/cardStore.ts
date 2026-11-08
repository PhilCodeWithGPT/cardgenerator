import { CardData } from '../types';

/**
 * Speicher auf dem eigenen Server (server/server.js hinter /api).
 * Ersetzt das Google-Sheets-Backend. Die Signaturen entsprechen den alten sheetService-Funktionen,
 * damit App.tsx gleich bleibt: der erste Parameter ist die API-Basis.
 */
export const CARD_STORE_URL = '/api';

const handle = async <T>(response: Response): Promise<T> => {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const msg =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data as T;
};

/** Werte aus älteren Speicherständen (z. B. Google Sheets: "true"/"false") vereinheitlichen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeCardData = (card: any): CardData => ({
  ...card,
  isBig: card.isBig === true || card.isBig === 'true',
  imageFlipX: card.imageFlipX === true || card.imageFlipX === 'true',
  imageScale: card.imageScale ?? 100,
  imageOffsetX: card.imageOffsetX ?? 0,
  imageOffsetY: card.imageOffsetY ?? 0,
  descriptionBoxScale: card.descriptionBoxScale ?? 100,
  internalComment: card.internalComment || '',
  imageData: null,
});

export const fetchCardsFromServer = async (baseUrl: string): Promise<CardData[]> => {
  const response = await fetch(`${baseUrl}/cards`, { cache: 'no-store' });
  const data = await handle<unknown>(response);
  return Array.isArray(data) ? data.map(normalizeCardData) : [];
};

export const saveCardToServer = async (
  baseUrl: string,
  card: CardData,
): Promise<{ status: string; imageUrl?: string }> => {
  // Alle Felder speichern (auch neue wie Spiegeln/Textformat); nur JSON-taugliche Werte
  const body = JSON.stringify(card);
  const response = await fetch(`${baseUrl}/cards/${encodeURIComponent(card.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return handle(response);
};

export const deleteCardFromServer = async (
  baseUrl: string,
  cardId: string,
): Promise<{ status: string }> => {
  const response = await fetch(`${baseUrl}/cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
  });
  return handle(response);
};
