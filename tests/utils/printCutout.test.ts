import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRINT_SETTINGS,
  computePrintLayout,
  cutoutGeometry,
  innerRect,
  normalizePrintMode,
  normalizePrintSettings,
} from '../../utils/printLayout';

describe('innerRect', () => {
  it('zieht den braunen Rand (3 mm) auf allen Seiten ab', () => {
    const slot = computePrintLayout(DEFAULT_PRINT_SETTINGS).slots[0];
    const r = innerRect(slot, DEFAULT_PRINT_SETTINGS);
    expect(r.x).toBeCloseTo(slot.x + 3);
    expect(r.y).toBeCloseTo(slot.y + 3);
    expect(r.w).toBeCloseTo(50);
    expect(r.h).toBeCloseTo(81);
  });
});

describe('cutoutGeometry', () => {
  // Rendering 661×1028 mit pixelRatio 2, Rand 34 px → 68 px
  const slot = computePrintLayout(DEFAULT_PRINT_SETTINGS).slots[0];
  const g = cutoutGeometry(slot, DEFAULT_PRINT_SETTINGS, 1322, 2056, 68);

  it('setzt die Schnittlinie genau auf die Innenfläche', () => {
    expect(g.inner.w).toBeCloseTo(50);
    expect(g.inner.h).toBeCloseTo(81);
  });

  it('legt 1 mm Überstand rundherum an', () => {
    expect(g.bleedMm).toBeCloseTo(1);
    expect(g.target.w).toBeCloseTo(52);
    expect(g.target.h).toBeCloseTo(83);
    expect(g.target.x).toBeCloseTo(g.inner.x - 1);
  });

  it('verzerrt nicht: Pixel pro mm in Ausschnitt und Innenfläche gleich', () => {
    const innerPxW = 1322 - 136;
    const innerPxH = 2056 - 136;
    expect(g.crop.w / g.target.w).toBeCloseTo(innerPxW / 50, 6);
    expect(g.crop.h / g.target.h).toBeCloseTo(innerPxH / 81, 6);
  });

  it('bleibt innerhalb des Bildes', () => {
    expect(g.crop.x).toBeGreaterThanOrEqual(0);
    expect(g.crop.y).toBeGreaterThanOrEqual(0);
    expect(g.crop.x + g.crop.w).toBeLessThanOrEqual(1322 + 1e-9);
    expect(g.crop.y + g.crop.h).toBeLessThanOrEqual(2056 + 1e-9);
  });

  it('begrenzt den Überstand auf den Rand im Bild', () => {
    const s = normalizePrintSettings({ ...DEFAULT_PRINT_SETTINGS, bleedMm: 2.5 });
    const g2 = cutoutGeometry(slot, s, 661, 1028, 10);
    expect(g2.crop.x).toBeCloseTo(0);
    expect(g2.bleedMm).toBeLessThan(2.5);
  });
});

describe('normalizePrintMode', () => {
  it('nimmt standardmäßig "Ausschneiden"', () => {
    expect(normalizePrintMode(undefined)).toBe('cutout');
    expect(normalizePrintMode('quatsch')).toBe('cutout');
    expect(normalizePrintMode('direct')).toBe('direct');
  });
});
