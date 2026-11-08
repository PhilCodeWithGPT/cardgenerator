import React, { forwardRef, useLayoutEffect, useRef } from 'react';
import { CardData, CardType, GlobalSettings, TextAlign } from '../types';
import { formatBonus } from '../utils/layoutUtils';
import { formatGoldDisplay } from '../utils/goldFormatter';
import { CARD_LABELS, translateItemSlotFor } from '../utils/cardLabels';
import { clampFontSize, withGuillemets } from '../utils/typography';

/**
 * "Klassisch" card front, modelled on the printed card style:
 * brown rounded frame, plain parchment face, a small-caps line ("+5 Bonus" / "Stufe 10"),
 * small-caps title, running text, illustration, footer with "Groß" left and slot + gold right.
 * Rendered at native export size (661x1028). Previews scale it down with CSS transforms.
 *
 * Aufbau in Ebenen, damit sich beim Tippen nichts verschiebt:
 *  - Bild: fester Platz (Bildfeld), nur über Position X/Y + Größe verschiebbar, liegt UNTER dem Text
 *  - Text: feste Schriftgröße, läuft von oben nach unten und darf Bild und Karte überlappen
 *    (abgeschnitten wird erst am Kartenrand)
 *  - unten verankert: "Schlimme Dinge" und Fußzeile (Groß / Slot / Gold)
 */

export const CLASSIC_WIDTH = 661;
export const CLASSIC_HEIGHT = 1028;

const FRAME = 34; // brown border thickness
const PAD_X = 40; // Innenabstand links/rechts
const PAD_TOP = 34;
const PAD_BOTTOM = 30;
const INK = '#2a1a10';
const TITLE_INK = '#3b2a1e';

// Fester Bildplatz innerhalb der Pergamentfläche (Bild wird darin zentriert)
const IMAGE_BOX = { top: 250, bottom: 110, left: PAD_X, right: PAD_X };

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

/** Text zeilengenau wie eingegeben: Umbrüche, Leerzeilen (auch am Anfang!) und Leerzeichen bleiben. */
const toLines = (text: string | undefined): string[] => {
  const t = withGuillemets(text ?? '').replace(/\s+$/, ''); // nur Ende kürzen
  return t.trim() === '' ? [] : t.split('\n');
};

const ClassicCardFace = forwardRef<HTMLDivElement, ClassicCardFaceProps>(
  ({ data, globalSettings, textOnly = false }, ref) => {
    const language = globalSettings?.language || 'de';
    const labels = CARD_LABELS[language];
    const imageSrc = resolveImageSrc(data);

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

    // --- Textblöcke, jeder mit eigener Ausrichtung ---
    const descAlign: TextAlign = data.textAlign ?? 'left';
    const restrAlign: TextAlign = data.restrictionsAlign ?? 'left';
    const badAlign: TextAlign = data.badStuffAlign ?? 'left';
    // Einzug nur bei links/Blocksatz sinnvoll
    const indentFor = (align: TextAlign) =>
      data.textIndent === false || align === 'center' || align === 'right' ? 0 : '0.6em';
    const descriptionLines = toLines(data.description);
    const restrictions = data.restrictions?.trim() ? withGuillemets(data.restrictions) : '';
    const hasBadStuff = data.type === CardType.MONSTER && !!data.badStuff?.trim();

    // --- Nur der Titel wird eingepasst (eine Zeile bevorzugt, sonst zwei) ---
    useLayoutEffect(() => {
      const title = titleRef.current;
      let cancelled = false;
      const fit = () => {
        if (cancelled || !title) return;
        const lines = (size: number) => Math.round(title.scrollHeight / (size * 1.04));
        const setSize = (size: number) => (title.style.fontSize = `${size}px`);
        let ts = 66;
        setSize(ts);
        while (ts > 46 && (lines(ts) > 1 || title.scrollWidth > title.clientWidth))
          setSize((ts -= 2));
        if (lines(ts) > 1 || title.scrollWidth > title.clientWidth) {
          ts = 62;
          setSize(ts);
          while (ts > 34 && (lines(ts) > 2 || title.scrollWidth > title.clientWidth))
            setSize((ts -= 2));
        }
      };
      fit();
      // Schriften laden asynchron nach → erneut einpassen
      if (document.fonts?.ready) document.fonts.ready.then(fit);
      return () => {
        cancelled = true;
      };
    }, [data.title, headline]);

    const metaStyle: React.CSSProperties = {
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: '34px',
      color: INK,
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
    };

    const bodyText: React.CSSProperties = {
      fontFamily: FONT_BODY,
      // fest (wird bei mehr Inhalt nicht kleiner), pro Karte einstellbar
      fontSize: `${clampFontSize(data.bodyFontSize)}px`,
      lineHeight: 1.32,
      hyphens: 'auto',
      whiteSpace: 'pre-wrap',
      margin: 0,
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
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden', // erst am Kartenrand abschneiden
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

        {/* Ebene 1: Bild an festem Platz – unabhängig vom Text */}
        {imageSrc && (
          <div
            style={{
              position: 'absolute',
              top: FRAME + IMAGE_BOX.top,
              bottom: FRAME + IMAGE_BOX.bottom,
              left: FRAME + IMAGE_BOX.left,
              right: FRAME + IMAGE_BOX.right,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
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
                transform: `scale(${(data.imageScale || 100) / 100}) translate(${data.imageOffsetX || 0}%, ${data.imageOffsetY || 0}%)${data.imageFlipX ? ' scaleX(-1)' : ''}`,
              }}
            />
          </div>
        )}

        {/* Ebene 2: Kopf, Titel und Text – liegt über dem Bild */}
        <div
          lang={language}
          style={{
            position: 'absolute',
            top: FRAME + PAD_TOP,
            left: FRAME + PAD_X,
            right: FRAME + PAD_X,
            color: INK,
            zIndex: 2,
          }}
        >
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
          >
            {withLiningDigits(withGuillemets(data.title || ''))}
          </h2>

          <div style={{ marginTop: '16px' }}>
            {restrictions && (
              <p
                style={{
                  ...bodyText,
                  marginBottom: '6px',
                  fontStyle: 'italic',
                  textAlign: restrAlign,
                  textIndent: indentFor(restrAlign),
                }}
              >
                {restrictions}
              </p>
            )}
            {descriptionLines.map((line, i) => (
              <p
                key={i}
                style={{
                  ...bodyText,
                  textAlign: descAlign,
                  textIndent:
                    i === 0 || descriptionLines[i - 1].trim() === '' ? indentFor(descAlign) : 0,
                }}
              >
                {line === '' ? ' ' : line}
              </p>
            ))}
          </div>
        </div>

        {/* Ebene 3: unten verankert – Schlimme Dinge + Fußzeile */}
        <div
          style={{
            position: 'absolute',
            left: FRAME + PAD_X,
            right: FRAME + PAD_X,
            bottom: FRAME + PAD_BOTTOM,
            color: INK,
            zIndex: 3,
          }}
        >
          {hasBadStuff && (
            <p
              lang={language}
              style={{
                ...bodyText,
                lineHeight: 1.28,
                paddingBottom: '8px',
                textAlign: badAlign,
                textIndent: 0, // kein Einzug: alle Zeilen bündig
              }}
            >
              <span style={{ fontWeight: 700 }}>{labels.badStuff}</span>
              {withGuillemets(data.badStuff || '')}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
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
