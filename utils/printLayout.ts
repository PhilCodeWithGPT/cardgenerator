import { jsPDF } from 'jspdf';

/**
 * Gemeinsames Druckraster für A4: wird von der Testseite (Rahmen zum Aufkleben der Blanko-Karten)
 * UND vom Karten-PDF benutzt, damit beide exakt dieselben Positionen haben.
 * Alle Maße in Millimetern.
 */
export interface PrintSettings {
  cardWidthMm: number;
  cardHeightMm: number;
  gapMm: number; // Abstand zwischen den Karten
  cornerRadiusMm: number;
  offsetXMm: number; // Druckerversatz: + = nach rechts
  offsetYMm: number; // Druckerversatz: + = nach unten
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  cardWidthMm: 56,
  cardHeightMm: 87,
  gapMm: 4,
  cornerRadiusMm: 3,
  offsetXMm: 0,
  offsetYMm: 0,
};

export const PAGE_W = 210;
export const PAGE_H = 297;
const MIN_MARGIN = 6; // nicht bedruckbarer Rand der meisten Drucker

export interface PrintSlot {
  x: number;
  y: number;
  col: number;
  row: number;
}

export interface PrintLayout {
  settings: PrintSettings;
  cols: number;
  rows: number;
  perPage: number;
  slots: PrintSlot[];
  marginX: number;
  marginY: number;
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
    gapMm: clampNumber(s?.gapMm, d.gapMm, 0, 30),
    cornerRadiusMm: clampNumber(s?.cornerRadiusMm, d.cornerRadiusMm, 0, 15),
    offsetXMm: clampNumber(s?.offsetXMm, d.offsetXMm, -20, 20),
    offsetYMm: clampNumber(s?.offsetYMm, d.offsetYMm, -20, 20),
  };
}

export function computePrintLayout(input?: Partial<PrintSettings>): PrintLayout {
  const s = normalizePrintSettings(input);
  const fit = (page: number, size: number) =>
    Math.max(1, Math.floor((page - 2 * MIN_MARGIN + s.gapMm) / (size + s.gapMm)));
  const cols = fit(PAGE_W, s.cardWidthMm);
  const rows = fit(PAGE_H, s.cardHeightMm);
  const gridW = cols * s.cardWidthMm + (cols - 1) * s.gapMm;
  const gridH = rows * s.cardHeightMm + (rows - 1) * s.gapMm;
  const marginX = (PAGE_W - gridW) / 2 + s.offsetXMm;
  const marginY = (PAGE_H - gridH) / 2 + s.offsetYMm;

  const slots: PrintSlot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        col,
        row,
        x: marginX + col * (s.cardWidthMm + s.gapMm),
        y: marginY + row * (s.cardHeightMm + s.gapMm),
      });
    }
  }
  return { settings: s, cols, rows, perPage: slots.length, slots, marginX, marginY };
}

/** Bild mit Seitenverhältnis in einen Kartenplatz einpassen (zentriert, nicht verzerrt). */
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

/** Kurze Schnitt-/Klebemarken an allen Kartenecken (außerhalb der Karte). */
export function drawCornerMarks(doc: jsPDF, layout: PrintLayout, len = 3) {
  const { cardWidthMm: w, cardHeightMm: h } = layout.settings;
  const gap = Math.min(1, layout.settings.gapMm / 2);
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
 * Testseite: dünne Rahmen in Kartengröße, ohne Bild. Zum Ausdrucken, Nachmessen und Aufkleben
 * der Blanko-Karten. Enthält Messlinien (100 mm / 50 mm), um falsche Druckskalierung zu erkennen.
 */
export function createFrameTestPdf(
  input: Partial<PrintSettings> | undefined,
  texts: { hint: string; ruler100: string; ruler50: string; size: string },
): jsPDF {
  const layout = computePrintLayout(input);
  const s = layout.settings;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Kartenrahmen
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  layout.slots.forEach((slot, i) => {
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
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(String(i + 1), slot.x + s.cardWidthMm / 2, slot.y + s.cardHeightMm / 2, {
      align: 'center',
      baseline: 'middle',
    });
  });

  doc.setTextColor(90, 90, 90);
  doc.setFontSize(7);
  doc.setLineWidth(0.3);

  // Messlinie 100 mm senkrecht im linken Rand (mit mm-Strichen), damit falsche Skalierung auffällt
  const leftSpace = layout.marginX;
  const rx = Math.max(4.5, leftSpace / 2);
  const ry = (PAGE_H - 100) / 2;
  doc.line(rx, ry, rx, ry + 100);
  for (let mm = 0; mm <= 100; mm += 10) {
    const tick = mm % 50 === 0 ? 2.2 : 1.2;
    doc.line(rx - tick / 2, ry + mm, rx + tick / 2, ry + mm);
  }
  doc.text(texts.ruler100, rx - 1.6, ry + 50, { angle: 90, align: 'center' });

  // Messlinie 50 mm waagerecht im oberen Rand + Hinweistext
  const top = Math.max(5, layout.marginY / 2);
  const hx = (PAGE_W - 50) / 2;
  doc.line(hx, top + 1.5, hx + 50, top + 1.5);
  doc.line(hx, top + 0.4, hx, top + 2.6);
  doc.line(hx + 50, top + 0.4, hx + 50, top + 2.6);
  doc.text(texts.ruler50, PAGE_W / 2, top, { align: 'center' });
  doc.text(`${texts.hint}  ·  ${texts.size}`, PAGE_W / 2, top + 5, { align: 'center' });

  return doc;
}
