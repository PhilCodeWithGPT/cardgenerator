import React from 'react';
import { GlobalSettings } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import {
  PAGE_H,
  PAGE_W,
  PrintSettings,
  computePrintLayout,
  createFrameTestPdf,
  normalizePrintSettings,
} from '../utils/printLayout';

interface PrintViewProps {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
}

const FIELDS: { key: keyof PrintSettings; step: number }[] = [
  { key: 'cardWidthMm', step: 0.5 },
  { key: 'cardHeightMm', step: 0.5 },
  { key: 'gapMm', step: 0.5 },
  { key: 'cornerRadiusMm', step: 0.5 },
  { key: 'offsetXMm', step: 0.5 },
  { key: 'offsetYMm', step: 0.5 },
];

const PrintView: React.FC<PrintViewProps> = ({ settings, onChange }) => {
  const { t } = useTranslation();
  const print = normalizePrintSettings(settings.print);
  const layout = computePrintLayout(print);

  const update = (key: keyof PrintSettings, raw: string) => {
    const value = parseFloat(raw.replace(',', '.'));
    if (isNaN(value)) return;
    onChange({ ...settings, print: { ...print, [key]: value } });
  };

  const handleTestPage = () => {
    const doc = createFrameTestPdf(print, {
      hint: t('print.pdfHint'),
      ruler100: t('print.ruler100'),
      ruler50: t('print.ruler50'),
      size: t('print.pdfSize', {
        w: print.cardWidthMm,
        h: print.cardHeightMm,
        gap: print.gapMm,
      }),
    });
    doc.save('testseite_kartenrahmen.pdf');
  };

  // Vorschau-Maßstab: A4 auf 300 px Breite
  const scale = 300 / PAGE_W;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-800">{t('print.title')}</h2>
        <p className="text-sm text-stone-500">{t('print.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 space-y-6 w-full">
          {/* Maße */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
              <h3 className="font-bold text-stone-800">{t('print.sizeTitle')}</h3>
              <p className="text-xs text-stone-500">{t('print.sizeDesc')}</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {FIELDS.map(({ key, step }) => (
                <label key={key} className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    {t(`print.field.${key}`)}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={step}
                      value={print[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <span className="text-sm text-stone-500">mm</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="px-6 pb-6 text-sm text-stone-600">
              {t('print.perPage', { count: layout.perPage, cols: layout.cols, rows: layout.rows })}
            </div>
          </section>

          {/* Testseite */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
              <h3 className="font-bold text-stone-800">{t('print.testTitle')}</h3>
              <p className="text-xs text-stone-500">{t('print.testDesc')}</p>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={handleTestPage}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-colors"
              >
                🖨️ {t('print.testButton')}
              </button>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-stone-700">
                <li>{t('print.step1')}</li>
                <li>{t('print.step2')}</li>
                <li>{t('print.step3')}</li>
                <li>{t('print.step4')}</li>
              </ol>
            </div>
          </section>
        </div>

        {/* A4-Skizze */}
        <div className="w-full lg:w-[340px]">
          <div className="lg:sticky lg:top-32 bg-stone-200 rounded-xl p-5 flex flex-col items-center">
            <svg
              width={PAGE_W * scale}
              height={PAGE_H * scale}
              viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
              className="bg-white shadow-md"
            >
              {layout.slots.map((slot, i) => (
                <g key={i}>
                  <rect
                    x={slot.x}
                    y={slot.y}
                    width={print.cardWidthMm}
                    height={print.cardHeightMm}
                    rx={print.cornerRadiusMm}
                    fill="#f6e3c4"
                    stroke="#3a2016"
                    strokeWidth={0.6}
                  />
                  <text
                    x={slot.x + print.cardWidthMm / 2}
                    y={slot.y + print.cardHeightMm / 2}
                    fontSize={8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#9a8a7a"
                  >
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
            <p className="text-xs text-stone-600 mt-3 text-center">{t('print.previewHint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintView;
