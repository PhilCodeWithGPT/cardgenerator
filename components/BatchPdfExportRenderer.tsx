import React, { useState, useEffect, useRef } from 'react';
import { CardData, GlobalSettings } from '../types';
import ExportCardRenderer from './ExportCardRenderer';
import { getLayoutSource, getCardCategory } from '../utils/layoutUtils';
import { toJpeg, getFontEmbedCSS } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useNotification } from './NotificationContext';
import { useTranslation } from '../i18n/LanguageContext';
import {
  PAGE_H,
  PAGE_W,
  PrintMode,
  Rect,
  computePrintLayout,
  drawCornerMarks,
  fitIntoSlot,
  normalizePrintMode,
  placeCardImage,
} from '../utils/printLayout';
import { prepareCutout } from '../utils/printCrop';

interface BatchPdfExportRendererProps {
  cards: CardData[];
  globalSettings: GlobalSettings;
  onComplete: () => void;
  onProgress: (
    current: number,
    total: number,
    chunkInfo?: { chunk: number; totalChunks: number },
  ) => void;
}

const GC_PAUSE_MS = 200;
const CUT_LINE_WIDTH = 0.1;
// Seitenverhältnis der gerenderten Kartenbilder (661 × 1028 px)
const CARD_IMG_RATIO = 661 / 1028;

// Colors
const COLOR_BG_FACE = '#0d0804';
const COLOR_BG_BACK_TRESOR = '#051471';
const COLOR_BG_BACK_DONJON = '#0d0804';

const BatchPdfExportRenderer: React.FC<BatchPdfExportRendererProps> = ({
  cards,
  globalSettings,
  onComplete,
  onProgress,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Druckraster aus dem Tab "Drucken" (gleiches Raster wie die Testseite)
  const printLayout = computePrintLayout(globalSettings?.print);
  const CARDS_PER_PAGE = printLayout.perPage;
  const CHUNK_SIZE = CARDS_PER_PAGE * 9; // max. 9 Seiten pro PDF
  const { cardWidthMm: CARD_W, cardHeightMm: CARD_H } = printLayout.settings;
  // Druckart aus dem Tab "Drucken" (nur klassisches Design kennt Ausschneiden / Blanko-Karte)
  const printMode: PrintMode =
    (globalSettings?.cardDesign ?? 'classic') === 'classic'
      ? normalizePrintMode(globalSettings?.printMode)
      : 'full';
  const textOnlyPrint = printMode === 'direct'; // nur Text + Bild auf weißem Papier
  const isCutout = printMode === 'cutout'; // Innenfläche zum Ausschneiden
  const surface = isCutout ? 'parchment' : textOnlyPrint ? 'textOnly' : 'full';
  const exportRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<jsPDF | null>(null);
  const capturedCardsRef = useRef<
    { imgData: string; category: string; target?: Rect; bleedMm?: number }[]
  >([]);

  const isProcessingRef = useRef(false);
  const cancelledRef = useRef(false);
  const fontCSSRef = useRef<string | undefined>(undefined);
  const fontCSSComputedRef = useRef(false);

  // Preload back images
  const backImagesRef = useRef<{ [key: string]: string }>({});

  const { showNotification } = useNotification();

  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const showNotifRef = useRef(showNotification);
  const { t } = useTranslation();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
    onCompleteRef.current = onComplete;
    onProgressRef.current = onProgress;
    showNotifRef.current = showNotification;
  });

  const totalChunks = Math.ceil(cards.length / CHUNK_SIZE);

  const getBackImageForCategory = (category: string) => {
    if (category === 'Donjon') return backImagesRef.current['Donjon'];
    return backImagesRef.current['Tresor'];
  };

  const loadImage = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } else {
          reject(new Error('Canvas context failed'));
        }
      };
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  useEffect(() => {
    cancelledRef.current = false;
    isProcessingRef.current = false;
    capturedCardsRef.current = [];
    pdfRef.current = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const loadResources = async () => {
      try {
        const donjonBack = globalSettings.customBackDonjon
          ? globalSettings.customBackDonjon
          : await loadImage('/layouts/layout_back_donjon.png');

        const tresorBack = globalSettings.customBackTresor
          ? globalSettings.customBackTresor
          : await loadImage('/layouts/layout_back_tresors.png');

        backImagesRef.current = {
          Donjon: donjonBack,
          Tresor: tresorBack,
        };

        const uniqueLayouts = new Set<string>(cards.map((c) => getLayoutSource(c, globalSettings)));
        uniqueLayouts.add('/texture/texture_description.png');

        const preloadPromises: Promise<void>[] = [];
        uniqueLayouts.forEach((src) => {
          const p = new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src as string;
          });
          preloadPromises.push(p);
        });

        await Promise.all(preloadPromises);
        console.log('[PDF Export] Resources loaded');
      } catch (e) {
        console.error('[PDF Export] Failed to load resources', e);
        showNotifRef.current(tRef.current('notifications.resourcesError'), 'error');
      }
    };

    loadResources();

    return () => {
      cancelledRef.current = true;
    };
  }, [cards, globalSettings]);

  const waitForImages = (container: HTMLElement, timeoutMs = 5000): Promise<void> => {
    return new Promise<void>((resolve) => {
      const images = container.querySelectorAll('img');
      if (images.length === 0) {
        resolve();
        return;
      }

      let pending = 0;
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          console.warn(`[PDF Export] Image wait timeout`);
          done();
        }
      }, timeoutMs);

      images.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) return;
        pending++;
        const onFinish = () => {
          pending--;
          if (pending <= 0) {
            clearTimeout(timeout);
            done();
          }
        };
        img.addEventListener('load', onFinish, { once: true });
        img.addEventListener('error', onFinish, { once: true });
      });

      if (pending === 0) {
        clearTimeout(timeout);
        done();
      }
    });
  };

  useEffect(() => {
    const processNext = async () => {
      if (cancelledRef.current) return;

      if (currentIndex >= cards.length) {
        if (capturedCardsRef.current.length > 0) {
          await generatePdfPages();
        }
        onCompleteRef.current();
        return;
      }

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        await new Promise((r) => setTimeout(r, 50));

        if (!exportRef.current) {
          isProcessingRef.current = false;
          return;
        }

        if (!fontCSSComputedRef.current) {
          fontCSSComputedRef.current = true;
          try {
            const fontPromise = getFontEmbedCSS(exportRef.current);
            const racePromise = new Promise<string>((_, r) => setTimeout(() => r('timeout'), 5000));
            fontCSSRef.current = await Promise.race([fontPromise, racePromise]);
          } catch (e) {
            console.warn('[PDF Export] Font CSS failed or timed out', e);
          }
        }

        await waitForImages(exportRef.current);

        const options = {
          backgroundColor: textOnlyPrint ? '#ffffff' : undefined,
          quality: 0.85,
          pixelRatio: 1,
          cacheBust: false,
          fontEmbedCSS: fontCSSRef.current,
        };

        const rendered = await toJpeg(exportRef.current, options);
        const cut = isCutout ? await prepareCutout(rendered, printLayout, 'image/jpeg') : undefined;

        capturedCardsRef.current.push({
          imgData: cut ? cut.img : rendered,
          category: getCardCategory(cards[currentIndex]),
          target: cut?.target,
          bleedMm: cut?.bleedMm,
        });

        if (capturedCardsRef.current.length % CARDS_PER_PAGE === 0) {
          await new Promise((r) => setTimeout(r, GC_PAUSE_MS));
        }

        if (capturedCardsRef.current.length >= CHUNK_SIZE) {
          await generatePdfPages();
          pdfRef.current = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          capturedCardsRef.current = [];

          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error(`[PDF Export] Error processing card ${currentIndex}`, err);
      } finally {
        if (!cancelledRef.current) {
          const chunkIdx = Math.floor(currentIndex / CHUNK_SIZE);
          onProgressRef.current(currentIndex + 1, cards.length, {
            chunk: chunkIdx + 1,
            totalChunks,
          });
          setCurrentIndex((prev) => prev + 1);
          isProcessingRef.current = false;
        }
      }
    };

    const timer = setTimeout(processNext, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, cards, totalChunks]);

  const generatePdfPages = async () => {
    if (!pdfRef.current || capturedCardsRef.current.length === 0) return;

    const pdf = pdfRef.current;
    const totalCards = capturedCardsRef.current.length;
    const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);

    console.log(`[PDF Export] Generating PDF with ${totalCards} cards (${totalPages} pages)...`);

    for (let p = 0; p < totalPages; p++) {
      const startIdx = p * CARDS_PER_PAGE;
      const pageCards = capturedCardsRef.current.slice(startIdx, startIdx + CARDS_PER_PAGE);

      // --- PAGE RECTO (FACES) ---
      if (p > 0 || pdf.internal.getNumberOfPages() > 1) pdf.addPage();

      if (printMode === 'full') {
        pdf.setFillColor(COLOR_BG_FACE);
        pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
      }

      if (isCutout) {
        // Schnittlinie und Marken zeichnet placeCardImage
        pageCards.forEach((card) =>
          placeCardImage(pdf, printLayout, card.imgData, 'JPEG', 'cutout', {
            imgRatio: CARD_IMG_RATIO,
            cutoutTarget: card.target,
            bleedMm: card.bleedMm,
          }),
        );
      } else {
        drawCutLines(pdf);
        pageCards.forEach((card, i) => {
          const r = fitIntoSlot(printLayout.slots[i], printLayout.settings, CARD_IMG_RATIO);
          pdf.addImage(card.imgData, 'JPEG', r.x, r.y, r.w, r.h);
        });
      }

      // --- PAGE VERSO (BACKS) --- (nur bei ganzer Karte; leere/Blanko-Karten haben schon Rückseiten)
      if (printMode !== 'full') continue;
      pdf.addPage();

      const firstCardCat = pageCards[0].category;
      const bgCol = firstCardCat === 'Donjon' ? COLOR_BG_BACK_DONJON : COLOR_BG_BACK_TRESOR;

      pdf.setFillColor(bgCol);
      pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
      drawCutLines(pdf);

      pageCards.forEach((card, i) => {
        // Rückseite gespiegelt (waagerecht), damit Vorder- und Rückseite übereinander liegen
        const slot = printLayout.slots[i];
        const x = PAGE_W - slot.x - CARD_W;
        const backImg = getBackImageForCategory(card.category);
        if (backImg) {
          pdf.addImage(backImg, 'PNG', x, slot.y, CARD_W, CARD_H);
        }
      });
    }

    const chunkIdx = Math.floor((currentIndex - 1) / CHUNK_SIZE);
    const fileName =
      totalChunks > 1 ? `munchkin_bat_partie${chunkIdx + 1}.pdf` : `munchkin_bat.pdf`;

    pdf.save(fileName);
    showNotifRef.current(tRef.current('notifications.pdfGenerated', { fileName }), 'success');
  };

  const drawCutLines = (doc: jsPDF) => {
    if (textOnlyPrint) doc.setDrawColor(160, 160, 160);
    else doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(CUT_LINE_WIDTH);
    drawCornerMarks(doc, printLayout);
  };

  if (currentIndex >= cards.length) return null;
  const currentCard = cards[currentIndex];

  return (
    <div style={{ position: 'fixed', left: '-10000px', top: '-10000px' }}>
      <ExportCardRenderer
        ref={exportRef}
        data={currentCard}
        layoutSrc={getLayoutSource(currentCard, globalSettings)}
        globalSettings={globalSettings}
        surface={surface}
      />
    </div>
  );
};

export default BatchPdfExportRenderer;
