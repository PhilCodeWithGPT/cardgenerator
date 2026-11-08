import { CLASSIC_FRAME, CLASSIC_WIDTH } from '../components/ClassicCardFace';
import { PrintLayout, Rect, cutoutGeometry } from './printLayout';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = src;
  });

/**
 * Für die Druckart "Zum Ausschneiden": gerendertes Kartenbild (ganze Karte, Pergament ohne
 * Rand) auf Innenfläche + Überstand zuschneiden. Liefert das Bild und das Ziel-Rechteck in mm.
 */
export async function prepareCutout(
  dataUrl: string,
  layout: PrintLayout,
  format: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<{ img: string; target: Rect; bleedMm: number }> {
  const img = await loadImage(dataUrl);
  const factor = img.naturalWidth / CLASSIC_WIDTH; // pixelRatio des Renderings
  const geo = cutoutGeometry(
    layout.slots[0],
    layout.settings,
    img.naturalWidth,
    img.naturalHeight,
    CLASSIC_FRAME * factor,
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geo.crop.w);
  canvas.height = Math.round(geo.crop.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(
    img,
    geo.crop.x,
    geo.crop.y,
    geo.crop.w,
    geo.crop.h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return {
    img: canvas.toDataURL(format, 0.92),
    target: geo.target,
    bleedMm: geo.bleedMm,
  };
}
