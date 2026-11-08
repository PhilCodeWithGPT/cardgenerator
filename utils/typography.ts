/**
 * Kleine Satzhilfen für den Kartentext.
 */

/** Schriftgröße des Kartentexts (px bei 661 px Kartenbreite). */
export const DEFAULT_FONT_SIZE = 31;
export const MIN_FONT_SIZE = 16;
export const MAX_FONT_SIZE = 44;

export const clampFontSize = (size: number | undefined | null): number => {
  const n = typeof size === 'number' && Number.isFinite(size) ? size : DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(n)));
};

/**
 * Guillemets wie auf deutschen Munchkin-Karten: ">>" wird zu "»", "<<" zu "«".
 * Direkt getippte Zeichen (Windows: Alt+0187 / Alt+0171) bleiben unverändert.
 */
export const withGuillemets = (text: string): string =>
  text.replace(/>>/g, '\u00BB').replace(/<</g, '\u00AB');
