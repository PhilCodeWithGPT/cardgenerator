import { jsPDF } from 'jspdf';

/**
 * Druckposition auf A4: genau EINE Karte, mittig auf der Seite (plus optionaler Druckerversatz).
 * Testseite (Rahmen zum Aufkleben der Blanko-Karte) und Kartendruck benutzen dieselbe Berechnung,
 * damit der Druck exakt auf der aufgeklebten Karte landet. Alle Maße in Millimetern.
 */
export interface PrintSettings {
  cardWidthMm: number;
  cardHeightMm: number;
  cornerRadiusMm: number;
  offsetXMm: number; // Druckerversatz: + = nach rechts
  offsetYMm: number; // Druckerversatz: + = nach unten
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  cardWidthMm: 56,
  cardHeightMm: 87,
  cornerRadiusMm: 3,
  offsetXMm: 0,
  offsetYMm: 0,
};

export const PAGE_W = 210;
export const PAGE_H = 297;

export interface PrintSlot {
  x: number;
  y: number;
}

export interface PrintLayout {
  settings: PrintSettings;
  perPage: number;
  slots: PrintSlot[];
}

const clampNumber = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' && isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
};

export function normalizePrintSettings(s?: Partial<PrintSettings>): PrintSettings {
  const d = DEFAULT_PRINT_SETTINGS;
  return {
    cardWidthMm: clampNumber(s?.cardWidthMm, d.cardWidthMm, 30, 150),
    cardHeightMm: clampNumber(s?.cardHeightMm, d.cardHeightMm, 30, 200),
    cornerRadiusMm: clampNumber(s?.cornerRadiusMm, d.cornerRadiusMm, 0, 15),
    offsetXMm: clampNumber(s?.offsetXMm, d.offsetXMm, -20, 20),
    offsetYMm: clampNumber(s?.offsetYMm, d.offsetYMm, -20, 20),
  };
}

/** Eine Karte, mittig auf A4. */
export function computePrintLayout(input?: Partial<PrintSettings>): PrintLayout {
  const s = normalizePrintSettings(input);
  const slot = {
    x: (PAGE_W - s.cardWidthMm) / 2 + s.offsetXMm,
    y: (PAGE_H - s.cardHeightMm) / 2 + s.offsetYMm,
  };
  return { settings: s, perPage: 1, slots: [slot] };
}

/** Bild mit Seitenverhältnis in den Kartenplatz einpassen (zentriert, nicht verzerrt). */
export function fitIntoSlot(
  slot: { x: number; y: number },
  s: PrintSettings,
  imgRatio: number, // Breite / Höhe
) {
  const slotRatio = s.cardWidthMm / s.cardHeightMm;
  let w = s.cardWidthMm;
  let h = s.cardHeightMm;
  if (imgRatio > slotRatio) h = w / imgRatio;
  else w = h * imgRatio;
  return { x: slot.x + (s.cardWidthMm - w) / 2, y: slot.y + (s.cardHeightMm - h) / 2, w, h };
}

/** Dünner Rahmen in Kartengröße. */
export function drawCardFrame(doc: jsPDF, layout: PrintLayout, lineWidth = 0.2) {
  const s = layout.settings;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineWidth);
  layout.slots.forEach((slot) => {
    if (s.cornerRadiusMm > 0) {
      doc.roundedRect(
        slot.x,
        slot.y,
        s.cardWidthMm,
        s.cardHeightMm,
        s.cornerRadiusMm,
        s.cornerRadiusMm,
        'S',
      );
    } else {
      doc.rect(slot.x, slot.y, s.cardWidthMm, s.cardHeightMm, 'S');
    }
  });
}

/** Kurze Marken an den Kartenecken (außerhalb der Karte, 1 mm Abstand). */
export function drawCornerMarks(doc: jsPDF, layout: PrintLayout, len = 4) {
  const { cardWidthMm: w, cardHeightMm: h } = layout.settings;
  const gap = 1;
  layout.slots.forEach(({ x, y }) => {
    const corners: [number, number, number, number][] = [
      [x, y, -1, -1],
      [x + w, y, 1, -1],
      [x, y + h, -1, 1],
      [x + w, y + h, 1, 1],
    ];
    corners.forEach(([cx, cy, dx, dy]) => {
      doc.line(cx + dx * gap, cy, cx + dx * (gap + len), cy);
      doc.line(cx, cy + dy * gap, cx, cy + dy * (gap + len));
    });
  });
}

/**
 * Testseite: ein dünner Rahmen in Kartengröße mittig auf A4, ohne Bild. Zum Nachmessen und zum
 * Aufkleben der Blanko-Karte. Messlinien (100 mm / 50 mm) zeigen falsche Druckskalierung.
 */
export function createFrameTestPdf(
  input: Partial<PrintSettings> | undefined,
  texts: { hint: string; ruler100: string; ruler50: string; size: string; glueHere: string },
): jsPDF {
  const layout = computePrintLayout(input);
  const s = layout.settings;
  const slot = layout.slots[0];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawCardFrame(doc, layout);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(texts.glueHere, slot.x + s.cardWidthMm / 2, slot.y + s.cardHeightMm / 2, {
    align: 'center',
    baseline: 'middle',
    maxWidth: s.cardWidthMm - 8,
  });

  doc.setTextColor(90, 90, 90);
  doc.setFontSize(7);
  doc.setLineWidth(0.3);

  // Messlinie 100 mm senkrecht links neben der Karte
  const rx = 20;
  const ry = (PAGE_H - 100) / 2;
  doc.line(rx, ry, rx, ry + 100);
  for (let mm = 0; mm <= 100; mm += 10) {
    const tick = mm % 50 === 0 ? 2.2 : 1.2;
    doc.line(rx - tick / 2, ry + mm, rx + tick / 2, ry + mm);
  }
  doc.text(texts.ruler100, rx - 1.6, ry + 50, { angle: 90, align: 'center' });

  // Messlinie 50 mm waagerecht oben + Hinweis
  const top = 20;
  const hx = (PAGE_W - 50) / 2;
  doc.line(hx, top + 1.5, hx + 50, top + 1.5);
  doc.line(hx, top + 0.4, hx, top + 2.6);
  doc.line(hx + 50, top + 0.4, hx + 50, top + 2.6);
  doc.text(texts.ruler50, PAGE_W / 2, top, { align: 'center' });
  doc.text(texts.hint, PAGE_W / 2, top + 7, { align: 'center' });
  doc.text(texts.size, PAGE_W / 2, top + 11, { align: 'center' });

  return doc;
}

/**
 * Karten-PDF: das gerenderte Kartenbild an exakt der Position der Testseite.
 * withFrame = zusätzlich dünner Kontrollrahmen (für einen Probedruck auf normalem Papier).
 */
export function createCardPdf(
  input: Partial<PrintSettings> | undefined,
  pngDataUrl: string,
  imgRatio: number,
  withFrame: boolean,
): jsPDF {
  const layout = computePrintLayout(input);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const r = fitIntoSlot(layout.slots[0], layout.settings, imgRatio);
  doc.addImage(pngDataUrl, 'PNG', r.x, r.y, r.w, r.h, undefined, 'SLOW');
  if (withFrame) drawCardFrame(doc, layout, 0.15);
  return doc;
}
