import { describe, it, expect } from 'vitest';
import {
  PAGE_H,
  PAGE_W,
  computePrintLayout,
  fitIntoSlot,
  normalizePrintSettings,
  DEFAULT_PRINT_SETTINGS,
} from '../../utils/printLayout';

describe('computePrintLayout', () => {
  it('places 3 x 3 cards of 56 x 87 mm with 4 mm gap, centred on A4', () => {
    const l = computePrintLayout(DEFAULT_PRINT_SETTINGS);
    expect(l.cols).toBe(3);
    expect(l.rows).toBe(3);
    expect(l.perPage).toBe(9);
    const first = l.slots[0];
    const last = l.slots[8];
    // linker Rand = rechter Rand, oberer = unterer
    expect(first.x).toBeCloseTo(PAGE_W - (last.x + 56), 6);
    expect(first.y).toBeCloseTo(PAGE_H - (last.y + 87), 6);
    // Abstand zwischen Nachbarn = Karte + Lücke
    expect(l.slots[1].x - l.slots[0].x).toBeCloseTo(60, 6);
    expect(l.slots[3].y - l.slots[0].y).toBeCloseTo(91, 6);
  });

  it('keeps every card on the page for poker-size cards', () => {
    const l = computePrintLayout({ ...DEFAULT_PRINT_SETTINGS, cardWidthMm: 63, cardHeightMm: 88 });
    expect(l.perPage).toBe(9);
    l.slots.forEach((s) => {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + 63).toBeLessThanOrEqual(PAGE_W);
      expect(s.y + 88).toBeLessThanOrEqual(PAGE_H);
    });
  });

  it('applies the printer offset to all slots', () => {
    const a = computePrintLayout(DEFAULT_PRINT_SETTINGS);
    const b = computePrintLayout({ ...DEFAULT_PRINT_SETTINGS, offsetXMm: 1.5, offsetYMm: -2 });
    expect(b.slots[4].x - a.slots[4].x).toBeCloseTo(1.5, 6);
    expect(b.slots[4].y - a.slots[4].y).toBeCloseTo(-2, 6);
  });

  it('falls back to defaults for missing or invalid values', () => {
    const s = normalizePrintSettings({ cardWidthMm: NaN, gapMm: -5 });
    expect(s.cardWidthMm).toBe(56);
    expect(s.gapMm).toBe(0);
    expect(s.cardHeightMm).toBe(87);
  });
});

describe('fitIntoSlot', () => {
  it('fits a narrower image without distortion, centred horizontally', () => {
    const s = { ...DEFAULT_PRINT_SETTINGS, cardWidthMm: 63, cardHeightMm: 88 };
    const r = fitIntoSlot({ x: 10, y: 20 }, s, 661 / 1028);
    expect(r.h).toBeCloseTo(88, 6);
    expect(r.w / r.h).toBeCloseTo(661 / 1028, 6);
    expect(r.x - 10).toBeCloseTo((63 - r.w) / 2, 6);
    expect(r.y).toBeCloseTo(20, 6);
  });
});
