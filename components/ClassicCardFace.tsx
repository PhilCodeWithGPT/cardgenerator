import React, { forwardRef, useLayoutEffect, useRef } from 'react';
import { CardData, CardType, GlobalSettings } from '../types';
import { formatBonus } from '../utils/layoutUtils';
import { formatGoldDisplay } from '../utils/goldFormatter';
import { CARD_LABELS, translateItemSlotFor } from '../utils/cardLabels';

/**
 * "Klassisch" card front, modelled on the printed card style:
 * brown rounded frame, plain parchment face, a small-caps line ("+5 Bonus" / "Stufe 10"),
 * small-caps title, running text, illustration, footer with "Groß" left and slot + gold right.
 * Rendered at native export size (661x1028). Previews scale it down with CSS transforms.
 */

export const CLASSIC_WIDTH = 661;
export const CLASSIC_HEIGHT = 1028;

const FRAME = 34; // brown border thickness
const INK = '#2a1a10';
const TITLE_INK = '#3b2a1e';

const FONT_TITLE = '"IM Fell English SC", "Windlass", serif';
const FONT_BODY = '"Libre Caslon Text", "Caslon Antique", "IM Fell DW Pica", serif';

interface ClassicCardFaceProps {
  data: CardData;
  globalSettings?: GlobalSettings;
  /** Nur Text und Bild (für Blanko-Karten, auf denen Rahmen und Pergament schon gedruckt sind). */
  textOnly?: boolean;
}

const resolveImageSrc = (data: CardData): string | undefined => {
  if (data.imageData) return `data:image/png;base64,${data.imageData}`;
  if (!data.storedImageUrl) return undefined;
  const url = data.storedImageUrl.trim();
  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1] || idMatch[2]}`;
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) return url;
  return undefined;
};

/** Ziffern in Caslon setzen: IM Fell kennt nur Mediävalziffern ("10" sähe aus wie "1o"). */
const withLiningDigits = (text: string): React.ReactNode[] =>
  text.split(/([+\-–]?\d[\d.,/]*)/).map((part, i) =>
    /\d/.test(part) ? (
      <span key={i} style={{ fontFamily: FONT_BODY, fontSize: '0.92em' }}>
        {part}
      </span>
    ) : (
      part
    ),
  );

const ClassicCardFace = forwardRef<HTMLDivElement, ClassicCardFaceProps>(
  ({ data, globalSettings, textOnly = false }, ref) => {
    const language = globalSettings?.language || 'de';
    const labels = CARD_LABELS[language];
    const imageSrc = resolveImageSrc(data);

    const bodyRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);

    // --- Kopfzeile: "Stufe 10" / "+5 Bonus" / "Fluch!" ---
    let headline = '';
    if (data.type === CardType.MONSTER && data.level !== '') {
      headline = `${labels.level} ${data.level}`;
    } else if (data.type === CardType.CURSE) {
      headline = labels.curse;
    } else if (
      data.type !== CardType.CLASS &&
      data.type !== CardType.RACE &&
      data.type !== CardType.LEVEL_UP &&
      data.bonus !== '' &&
      data.bonus !== undefined &&
      data.bonus !== null
    ) {
      const b = formatBonus(data.bonus);
      if (b) headline = `${b} ${labels.bonus}`;
    }

    // --- Fußzeile ---
    const isItem = data.type === CardType.ITEM;
    let slotLabel = '';
    if (isItem && data.itemSlot && data.itemSlot !== 'NoSlot') {
      slotLabel = translateItemSlotFor(data.itemSlot, language);
    }
    const gold =
      isItem && data.itemSlot === 'Amélioration'
        ? null
        : formatGoldDisplay(data.type, data.gold, language);
    const levelsGained =
      data.type === CardType.MONSTER && data.levelsGained && data.levelsGained !== 1
        ? `${data.levelsGained} ${labels.levels}`
        : '';
    const leftFooter = isItem && data.isBig ? labels.big : levelsGained;

    const hasDescription = !!data.description?.trim() || !!data.restrictions?.trim();
    const hasBadStuff = data.type === CardType.MONSTER && !!data.badStuff?.trim();

    // --- Text einpassen: Fließtext verkleinern, bis Bild + Text in die Karte passen ---
    useLayoutEffect(() => {
      const body = bodyRef.current;
      const title = titleRef.current;
      let cancelled = false;

      const fit = () => {
        if (cancelled) return;
        if (title) {
          const lines = (size: number) => Math.round(title.scrollHeight / (size * 1.04));
          const setSize = (size: number) => (title.style.fontSize = `${size}px`);
          // 1. Versuch: eine Zeile, notfalls bis 46 px verkleinern (wie auf den gedruckten Karten)
          let ts = 66;
          setSize(ts);
          while (ts > 46 && (lines(ts) > 1 || title.scrollWidth > title.clientWidth))
            setSize((ts -= 2));
          // 2. Sonst: max. 2 Zeilen, keine Überbreite
          if (lines(ts) > 1 || title.scrollWidth > title.clientWidth) {
            ts = 62;
            setSize(ts);
            while (ts > 34 && (lines(ts) > 2 || title.scrollWidth > title.clientWidth))
              setSize((ts -= 2));
          }
        }
        if (body) {
          const minImage = imageSrc ? 260 : 0;
          let fs = 31;
          body.style.setProperty('--classic-fs', `${fs}px`);
          const overflow = () => {
            const textEls = body.querySelectorAll<HTMLElement>('[data-classic-text]');
            let textHeight = 0;
            textEls.forEach((el) => (textHeight += el.offsetHeight));
            return textHeight + minImage > body.clientHeight;
          };
          while (fs > 17 && overflow()) {
            fs -= 1;
            body.style.setProperty('--classic-fs', `${fs}px`);
          }
        }
      };

      fit();
      // Schriften laden asynchron nach → erneut einpassen
      if (document.fonts?.ready) document.fonts.ready.then(fit);
      return () => {
        cancelled = true;
      };
    }, [
      data.title,
      data.description,
      data.restrictions,
      data.badStuff,
      data.type,
      imageSrc,
      headline,
    ]);

    const metaStyle: React.CSSProperties = {
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: '34px',
      color: INK,
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
    };

    return (
      <div
        ref={ref}
        style={{
          width: `${CLASSIC_WIDTH}px`,
          height: `${CLASSIC_HEIGHT}px`,
          borderRadius: '38px',
          background: textOnly
            ? 'transparent'
            : 'linear-gradient(160deg, #5a3626 0%, #4a2a1d 45%, #3a2016 100%)',
          padding: `${FRAME}px`,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pergament */}
        {!textOnly && (
          <div
            style={{
              position: 'absolute',
              inset: `${FRAME}px`,
              borderRadius: '26px',
              background:
                'radial-gradient(ellipse 90% 75% at 50% 42%, #fbebd2 0%, #f6dcb8 55%, #ecc799 85%, #e2b585 100%)',
              boxShadow: 'inset 0 0 18px rgba(120, 70, 30, 0.35)',
            }}
          />
        )}
        {/* leichte Papierstruktur */}
        {!textOnly && (
          <div
            style={{
              position: 'absolute',
              inset: `${FRAME}px`,
              borderRadius: '26px',
              opacity: 0.18,
              mixBlendMode: 'multiply',
              background:
                'repeating-radial-gradient(circle at 30% 20%, rgba(150,100,50,0.25) 0 2px, transparent 2px 9px), repeating-radial-gradient(circle at 75% 70%, rgba(150,100,50,0.2) 0 1px, transparent 1px 7px)',
            }}
          />
        )}

        {/* Inhalt */}
        <div
          style={{
            position: 'absolute',
            inset: `${FRAME}px`,
            padding: '34px 40px 30px',
            display: 'flex',
            flexDirection: 'column',
            color: INK,
          }}
        >
          {/* Kopfzeile */}
          {headline && (
            <div
              style={{
                textAlign: 'center',
                fontFamily: FONT_TITLE,
                fontSize: '42px',
                lineHeight: 1,
                color: TITLE_INK,
                letterSpacing: '0.5px',
              }}
            >
              {withLiningDigits(headline)}
            </div>
          )}

          {/* Titel */}
          <h2
            ref={titleRef}
            style={{
              margin: headline ? '6px 0 0' : '14px 0 0',
              textAlign: 'center',
              fontFamily: FONT_TITLE,
              fontWeight: 400,
              fontSize: '66px',
              lineHeight: 1.04,
              color: TITLE_INK,
              textShadow: '0 1px 0 rgba(255,255,255,0.45)',
              overflowWrap: 'break-word',
              hyphens: 'auto',
            }}
            lang={language}
          >
            {withLiningDigits(data.title || '')}
          </h2>

          {/* Text + Bild */}
          <div
            ref={bodyRef}
            style={
              {
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                marginTop: '16px',
                '--classic-fs': '31px',
              } as React.CSSProperties
            }
          >
            {hasDescription && (
              <div
                data-classic-text
                lang={language}
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 'var(--classic-fs)',
                  lineHeight: 1.32,
                  hyphens: 'auto',
                  paddingBottom: '6px',
                }}
              >
                {data.restrictions?.trim() && (
                  <p style={{ margin: '0 0 6px', textIndent: '0.6em', fontStyle: 'italic' }}>
                    {data.restrictions}
                  </p>
                )}
                {data.description
                  ?.split(/\n+/)
                  .filter((p) => p.trim())
                  .map((p, i) => (
                    <p key={i} style={{ margin: i ? '14px 0 0' : 0, textIndent: '0.6em' }}>
                      {p}
                    </p>
                  ))}
              </div>
            )}

            {/* Bild */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt="Art"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                    transform: `scale(${(data.imageScale || 100) / 100}) translate(${data.imageOffsetX || 0}%, ${data.imageOffsetY || 0}%)`,
                  }}
                />
              )}
            </div>

            {hasBadStuff && (
              <div
                data-classic-text
                lang={language}
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 'var(--classic-fs)',
                  lineHeight: 1.28,
                  hyphens: 'auto',
                  paddingTop: '6px',
                }}
              >
                <span style={{ fontWeight: 700 }}>{labels.badStuff}</span>
                {data.badStuff}
              </div>
            )}
          </div>

          {/* Fußzeile */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: '8px',
              minHeight: '40px',
            }}
          >
            <span style={metaStyle}>{leftFooter}</span>
            <div style={{ textAlign: 'right' }}>
              {slotLabel && <div style={metaStyle}>{slotLabel}</div>}
              {gold && <div style={metaStyle}>{gold}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ClassicCardFace.displayName = 'ClassicCardFace';

export default ClassicCardFace;
