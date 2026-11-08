import React, { useRef, useState } from 'react';
import { toPng, getFontEmbedCSS } from 'html-to-image';
import { CardData, GlobalSettings } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { useNotification } from './NotificationContext';
import ExportCardRenderer from './ExportCardRenderer';
import ClassicCardFace, { CLASSIC_HEIGHT, CLASSIC_WIDTH } from './ClassicCardFace';
import { getLayoutSource } from '../utils/layoutUtils';
import {
  PAGE_H,
  PAGE_W,
  PrintSettings,
  computePrintLayout,
  createCardPdf,
  createFrameTestPdf,
  normalizePrintSettings,
} from '../utils/printLayout';

interface PrintViewProps {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
  cardData: CardData;
}

const FIELDS: (keyof PrintSettings)[] = [
  'cardWidthMm',
  'cardHeightMm',
  'cornerRadiusMm',
  'offsetXMm',
  'offsetYMm',
];

const waitForImages = async (root: HTMLElement) => {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
};

const PrintView: React.FC<PrintViewProps> = ({ settings, onChange, cardData }) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const print = normalizePrintSettings(settings.print);
  const layout = computePrintLayout(print);
  const slot = layout.slots[0];
  const [withFrame, setWithFrame] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
      glueHere: t('print.glueHere'),
      size: t('print.pdfSize', { w: print.cardWidthMm, h: print.cardHeightMm }),
    });
    doc.save('testseite_kartenrahmen.pdf');
  };

  const handlePrintCard = async () => {
    setIsPrinting(true);
    try {
      // Export-Renderer erst nach dem State-Update im DOM
      await new Promise((r) => setTimeout(r, 300));
      const node = exportRef.current;
      if (!node) throw new Error('export node missing');
      await waitForImages(node);
      if (document.fonts?.ready) await document.fonts.ready;
      let fontEmbedCSS: string | undefined;
      try {
        fontEmbedCSS = await getFontEmbedCSS(node);
      } catch {
        fontEmbedCSS = undefined;
      }
      // pixelRatio 2 → ca. 600 dpi bei 56 mm Kartenbreite
      const png = await toPng(node, { pixelRatio: 2, fontEmbedCSS });
      const doc = createCardPdf(print, png, CLASSIC_WIDTH / CLASSIC_HEIGHT, withFrame);
      const name = (cardData.title || 'karte').replace(/[^\p{L}\p{N}_-]+/gu, '_');
      doc.save(`druck_${name}.pdf`);
    } catch (e) {
      console.error('[Print] failed', e);
      showNotification(t('print.printError'), 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  const isClassic = (settings.cardDesign ?? 'classic') === 'classic';
  // Vorschau-Maßstab: A4 auf 300 px Breite
  const scale = 300 / PAGE_W;
  const thumbScale = 140 / CLASSIC_WIDTH;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-800">{t('print.title')}</h2>
        <p className="text-sm text-stone-500">{t('print.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 space-y-6 w-full">
          {/* Karte drucken */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
              <h3 className="font-bold text-stone-800">{t('print.cardTitle')}</h3>
              <p className="text-xs text-stone-500">{t('print.cardDesc')}</p>
            </div>
            <div className="p-6 flex gap-6 items-start">
              {isClassic && (
                <div
                  className="shrink-0 overflow-hidden rounded-md shadow"
                  style={{ width: CLASSIC_WIDTH * thumbScale, height: CLASSIC_HEIGHT * thumbScale }}
                >
                  <div style={{ transform: `scale(${thumbScale})`, transformOrigin: 'top left' }}>
                    <ClassicCardFace data={cardData} globalSettings={settings} />
                  </div>
                </div>
              )}
              <div className="flex-1 space-y-4">
                <p className="text-sm text-stone-700">
                  {t('print.currentCard')}{' '}
                  <span className="font-bold">{cardData.title || t('cardThumbnail.untitled')}</span>
                </p>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-amber-700"
                    checked={withFrame}
                    onChange={(e) => setWithFrame(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-stone-800">{t('print.withFrame')}</span>
                    <span className="block text-xs text-stone-500">{t('print.withFrameDesc')}</span>
                  </span>
                </label>
                <button
                  onClick={handlePrintCard}
                  disabled={isPrinting}
                  className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isPrinting ? t('cardPreview.processing') : `🖨️ ${t('print.cardButton')}`}
                </button>
                <p className="text-xs text-stone-500">{t('print.cardHint')}</p>
              </div>
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
                className="w-full bg-stone-700 hover:bg-stone-600 text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-colors"
              >
                📐 {t('print.testButton')}
              </button>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-stone-700">
                <li>{t('print.step1')}</li>
                <li>{t('print.step2')}</li>
                <li>{t('print.step3')}</li>
                <li>{t('print.step4')}</li>
              </ol>
            </div>
          </section>

          {/* Maße */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
              <h3 className="font-bold text-stone-800">{t('print.sizeTitle')}</h3>
              <p className="text-xs text-stone-500">{t('print.sizeDesc')}</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {FIELDS.map((key) => (
                <label key={key} className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    {t(`print.field.${key}`)}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.5}
                      value={print[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <span className="text-sm text-stone-500">mm</span>
                  </div>
                </label>
              ))}
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
            </svg>
            <p className="text-xs text-stone-600 mt-3 text-center">{t('print.previewHint')}</p>
          </div>
        </div>
      </div>

      {/* Unsichtbarer Renderer in Originalgröße für den Druck */}
      {isPrinting && (
        <div style={{ position: 'fixed', left: '-10000px', top: '-10000px' }}>
          <ExportCardRenderer
            ref={exportRef}
            data={cardData}
            layoutSrc={getLayoutSource(cardData, settings)}
            globalSettings={settings}
          />
        </div>
      )}
    </div>
  );
};

export default PrintView;
