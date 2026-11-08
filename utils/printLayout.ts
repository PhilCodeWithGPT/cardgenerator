import { jsPDF } from 'jspdf';

/**
 * Druckposition auf A4: genau EINE Karte, mittig auf der Seite (plus optionaler Druckerversatz).
 * Testseite und Kartendruck benutzen dieselbe Berechnung. Alle Maße in Millimetern.
 *
 * Druckarten:
 *  - cutout: nur die Innenfläche (Karte minus brauner Rand) mit Pergament, Text und Bild auf Papier,
 *            mit Schnittlinie an der Innenkante des Randes + etwas Überstand → ausschneiden und
 *            auf eine leere Karte kleben. Den braunen Rand liefert die echte Karte.
 *  - direct: nur Text und Bild, direkt auf eine aufgeklebte Blanko-Karte gedruckt.
 *  - full:   ganze Karte mit Rand und Pergament.
 */
export type PrintMode = 'cutout' | 'direct' | 'full';
export const DEFAULT_PRINT_MODE: PrintMode = 'cutout';

export interface PrintSettings {
  cardWidthMm: number;
  cardHeightMm: number;
  cornerRadiusMm: number;
  frameMm: number; // Breite des braunen Randes der echten Karte
  innerRadiusMm: number; // Eckenradius der Innenfläche (Schnittlinie)
  bleedMm: number; // Überstand des Pergaments über die Schnittlinie hinaus
  offsetXMm: number; // Druckerversatz: + = nach rechts
  offsetYMm: number; // Druckerversatz: + = nach unten
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  cardWidthMm: 56,
  cardHeightMm: 87,
  cornerRadiusMm: 3,
  frameMm: 3,
  innerRadiusMm: 1.5,
  bleedMm: 1,
  offsetXMm: 0,
  offsetYMm: 0,
};

export const PAGE_W = 210;
export const PAGE_H = 297;

export interface PrintSlot {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
    frameMm: clampNumber(s?.frameMm, d.frameMm, 0, 10),
    innerRadiusMm: clampNumber(s?.innerRadiusMm, d.innerRadiusMm, 0, 10),
    bleedMm: clampNumber(s?.bleedMm, d.bleedMm, 0, 2.5),
    offsetXMm: clampNumber(s?.offsetXMm, d.offsetXMm, -20, 20),
    offsetYMm: clampNumber(s?.offsetYMm, d.offsetYMm, -20, 20),
  };
}

export const normalizePrintMode = (mode: unknown): PrintMode =>
  mode === 'direct' || mode === 'full' || mode === 'cutout' ? mode : DEFAULT_PRINT_MODE;

/** Eine Karte, mittig auf A4. */
export function computePrintLayout(input?: Partial<PrintSettings>): PrintLayout {
  const s = normalizePrintSettings(input);
  const slot = {
    x: (PAGE_W - s.cardWidthMm) / 2 + s.offsetXMm,
    y: (PAGE_H - s.cardHeightMm) / 2 + s.offsetYMm,
  };
  return { settings: s, perPage: 1, slots: [slot] };
}

/** Innenfläche der Karte (= Schnittlinie): Karte minus brauner Rand auf allen Seiten. */
export function innerRect(slot: PrintSlot, s: PrintSettings): Rect {
  return {
    x: slot.x + s.frameMm,
    y: slot.y + s.frameMm,
    w: s.cardWidthMm - 2 * s.frameMm,
    h: s.cardHeightMm - 2 * s.frameMm,
  };
}

/**
 * Ausschnitt aus dem gerenderten Kartenbild für die Druckart "cutout": die Innenfläche des
 * Renderings (ohne Rand von framePx) plus Überstand. Liefert Pixel-Rechteck im Bild und das
 * Ziel-Rechteck in mm auf der Seite – beides mit demselben Überstand, damit nichts verzerrt.
 */
export function cutoutGeometry(
  slot: PrintSlot,
  s: PrintSettings,
  imgW: number, // Pixelbreite des gerenderten Bildes
  imgH: number,
  framePx: number, // Randbreite im gerenderten Bild (Pixel)
) {
  const inner = innerRect(slot, s);
  const innerPxW = imgW - 2 * framePx;
  const innerPxH = imgH - 2 * framePx;
  const pxPerMmX = innerPxW / inner.w;
  const pxPerMmY = innerPxH / inner.h;
  // Überstand höchstens so groß wie der Rand im Bild (sonst gäbe es nichts zu zeigen)
  const bleedMm = Math.min(s.bleedMm, framePx / pxPerMmX, framePx / pxPerMmY);
  const bx = bleedMm * pxPerMmX;
  const by = bleedMm * pxPerMmY;
  return {
    crop: { x: framePx - bx, y: framePx - by, w: innerPxW + 2 * bx, h: innerPxH + 2 * by },
    target: {
      x: inner.x - bleedMm,
      y: inner.y - bleedMm,
      w: inner.w + 2 * bleedMm,
      h: inner.h + 2 * bleedMm,
    },
    inner,
    bleedMm,
  };
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

const strokeRect = (doc: jsPDF, r: Rect, radius: number) => {
  if (radius > 0) doc.roundedRect(r.x, r.y, r.w, r.h, radius, radius, 'S');
  else doc.rect(r.x, r.y, r.w, r.h, 'S');
};

/** Dünner Rahmen in Kartengröße. */
export function drawCardFrame(doc: jsPDF, layout: PrintLayout, lineWidth = 0.2) {
  const s = layout.settings;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineWidth);
  layout.slots.forEach((slot) =>
    strokeRect(
      doc,
      { x: slot.x, y: slot.y, w: s.cardWidthMm, h: s.cardHeightMm },
      s.cornerRadiusMm,
    ),
  );
}

/** Kurze Marken an den Ecken eines Rechtecks (außerhalb, mit Abstand gap). */
export function drawRectCornerMarks(doc: jsPDF, r: Rect, gap = 1, len = 4) {
  const corners: [number, number, number, number][] = [
    [r.x, r.y, -1, -1],
    [r.x + r.w, r.y, 1, -1],
    [r.x, r.y + r.h, -1, 1],
    [r.x + r.w, r.y + r.h, 1, 1],
  ];
  corners.forEach(([cx, cy, dx, dy]) => {
    doc.line(cx + dx * gap, cy, cx + dx * (gap + len), cy);
    doc.line(cx, cy + dy * gap, cx, cy + dy * (gap + len));
  });
}

/** Kurze Marken an den Kartenecken (außerhalb der Karte, 1 mm Abstand). */
export function drawCornerMarks(doc: jsPDF, layout: PrintLayout, len = 4) {
  const { cardWidthMm: w, cardHeightMm: h } = layout.settings;
  layout.slots.forEach(({ x, y }) => drawRectCornerMarks(doc, { x, y, w, h }, 1, len));
}

/** Schnittlinie (Innenkante des braunen Randes) + Schnittmarken außerhalb des Überstands. */
export function drawCutGuides(doc: jsPDF, layout: PrintLayout, bleedMm: number) {
  const s = layout.settings;
  layout.slots.forEach((slot) => {
    const inner = innerRect(slot, s);
    doc.setDrawColor(70, 50, 40);
    doc.setLineWidth(0.12);
    strokeRect(doc, inner, s.innerRadiusMm);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    drawRectCornerMarks(doc, inner, bleedMm + 1.5, 4);
  });
}

/**
 * Kartenbild auf die Seite setzen – je nach Druckart. Bei "cutout" muss das Bild bereits auf
 * cutoutGeometry().crop zugeschnitten sein; target ist dann das Ziel-Rechteck.
 */
export function placeCardImage(
  doc: jsPDF,
  layout: PrintLayout,
  img: string,
  format: 'PNG' | 'JPEG',
  mode: PrintMode,
  opts: { imgRatio: number; cutoutTarget?: Rect; bleedMm?: number; withFrame?: boolean },
) {
  const slot = layout.slots[0];
  if (mode === 'cutout' && opts.cutoutTarget) {
    const r = opts.cutoutTarget;
    doc.addImage(img, format, r.x, r.y, r.w, r.h, undefined, 'SLOW');
    drawCutGuides(doc, layout, opts.bleedMm ?? 0);
    if (opts.withFrame) {
      doc.setLineDashPattern([1, 1], 0);
      drawCardFrame(doc, layout, 0.1);
      doc.setLineDashPattern([], 0);
    }
    return;
  }
  const r = fitIntoSlot(slot, layout.settings, opts.imgRatio);
  doc.addImage(img, format, r.x, r.y, r.w, r.h, undefined, 'SLOW');
  if (opts.withFrame) drawCardFrame(doc, layout, 0.15);
}

/**
 * Testseite: dünner Rahmen in Kartengröße mittig auf A4, ohne Bild, plus Innenfläche
 * (Schnittlinie). Zum Nachmessen; Messlinien (100 mm / 50 mm) zeigen falsche Druckskalierung.
 */
export function createFrameTestPdf(
  input: Partial<PrintSettings> | undefined,
  texts: { hint: string; ruler100: string; ruler50: string; size: string; glueHere: string },
  mode: PrintMode = 'direct',
): jsPDF {
  const layout = computePrintLayout(input);
  const s = layout.settings;
  const slot = layout.slots[0];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawCardFrame(doc, layout);
  if (mode === 'cutout' && s.frameMm > 0) {
    doc.setLineDashPattern([1.2, 0.8], 0);
    doc.setLineWidth(0.15);
    strokeRect(doc, innerRect(slot, s), s.innerRadiusMm);
    doc.setLineDashPattern([], 0);
  }

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(texts.glueHere, slot.x + s.cardWidthMm / 2, slot.y + s.cardHeightMm / 2, {
    align: 'center',
    baseline: 'middle',
    maxWidth: s.cardWidthMm - 2 * s.frameMm - 6,
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
 * withFrame = zusätzlich dünner Kontrollrahmen in Kartengröße.
 */
export function createCardPdf(
  input: Partial<PrintSettings> | undefined,
  img: string,
  imgRatio: number,
  withFrame: boolean,
  mode: PrintMode = 'full',
  cutout?: { target: Rect; bleedMm: number },
): jsPDF {
  const layout = computePrintLayout(input);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  placeCardImage(doc, layout, img, 'PNG', mode, {
    imgRatio,
    cutoutTarget: cutout?.target,
    bleedMm: cutout?.bleedMm,
    withFrame,
  });
  return doc;
}
