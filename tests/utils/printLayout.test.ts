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
  it('places exactly one 56 x 87 mm card in the centre of A4', () => {
    const l = computePrintLayout(DEFAULT_PRINT_SETTINGS);
    expect(l.perPage).toBe(1);
    const [s] = l.slots;
    expect(s.x).toBeCloseTo((PAGE_W - 56) / 2, 6);
    expect(s.y).toBeCloseTo((PAGE_H - 87) / 2, 6);
    // links = rechts, oben = unten
    expect(s.x).toBeCloseTo(PAGE_W - (s.x + 56), 6);
    expect(s.y).toBeCloseTo(PAGE_H - (s.y + 87), 6);
  });

  it('applies the printer offset', () => {
    const a = computePrintLayout(DEFAULT_PRINT_SETTINGS).slots[0];
    const b = computePrintLayout({ ...DEFAULT_PRINT_SETTINGS, offsetXMm: 1.5, offsetYMm: -2 })
      .slots[0];
    expect(b.x - a.x).toBeCloseTo(1.5, 6);
    expect(b.y - a.y).toBeCloseTo(-2, 6);
  });

  it('falls back to defaults for missing or invalid values', () => {
    const s = normalizePrintSettings({ cardWidthMm: NaN, offsetXMm: 99 });
    expect(s.cardWidthMm).toBe(56);
    expect(s.cardHeightMm).toBe(87);
    expect(s.offsetXMm).toBe(20);
  });
});

describe('fitIntoSlot', () => {
  it('fits the rendered card image without distortion', () => {
    const r = fitIntoSlot({ x: 10, y: 20 }, DEFAULT_PRINT_SETTINGS, 661 / 1028);
    expect(r.w / r.h).toBeCloseTo(661 / 1028, 6);
    expect(r.w).toBeLessThanOrEqual(56 + 1e-9);
    expect(r.h).toBeLessThanOrEqual(87 + 1e-9);
    // 56 x 87 hat fast dasselbe Verhältnis → weniger als 0,1 mm Rand
    expect(56 - r.w).toBeLessThan(0.1);
  });
});
