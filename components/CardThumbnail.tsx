import React, { useState, useEffect } from 'react';
import { CardData, CardType } from '../types';
import { formatBonus } from '../utils/layoutUtils';
import { useTranslation } from '../i18n/LanguageContext';
import { withGuillemets } from '../utils/typography';

interface CardThumbnailProps {
  card: CardData;
  /** Deutscher (übersetzter) Name des Kartentyps */
  typeLabel: string;
  onClick: () => void;
  /** Löschen (mit Rückfrage direkt auf der Karte) */
  onDelete?: () => void;
  isSelected?: boolean;
}

const TYPE_COLORS: Partial<Record<CardType, { bg: string; border: string; badge: string }>> = {
  [CardType.MONSTER]: { bg: 'bg-red-100', border: 'border-red-300', badge: 'bg-red-700' },
  [CardType.CURSE]: { bg: 'bg-purple-100', border: 'border-purple-300', badge: 'bg-purple-700' },
  [CardType.ITEM]: { bg: 'bg-amber-100', border: 'border-amber-300', badge: 'bg-amber-700' },
  [CardType.CLASS]: { bg: 'bg-blue-100', border: 'border-blue-300', badge: 'bg-blue-700' },
  [CardType.RACE]: { bg: 'bg-green-100', border: 'border-green-300', badge: 'bg-green-700' },
};
const DEFAULT_COLORS = { bg: 'bg-stone-100', border: 'border-stone-300', badge: 'bg-stone-600' };

const resolveSrc = (card: CardData): string | undefined => {
  if (card.imageData) return `data:image/png;base64,${card.imageData}`;
  const url = card.storedImageUrl?.trim();
  if (!url) return undefined;
  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[1] || idMatch[2]}`;
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) return url;
  return undefined;
};

const CardThumbnail: React.FC<CardThumbnailProps> = ({
  card,
  typeLabel,
  onClick,
  onDelete,
  isSelected = false,
}) => {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const src = resolveSrc(card);
  const colors = TYPE_COLORS[card.type] || DEFAULT_COLORS;

  useEffect(() => setImgError(false), [src]);

  const badge =
    card.type === CardType.MONSTER && card.level !== ''
      ? String(card.level)
      : card.type !== CardType.CURSE && card.bonus !== '' && card.bonus !== undefined
        ? formatBonus(card.bonus)
        : '';

  return (
    <div
      className={`group relative w-full aspect-[2/3] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-xl ${
        isSelected ? 'ring-2 ring-amber-600 shadow-xl' : 'shadow-md'
      } ${colors.bg} ${colors.border} border-2`}
    >
      <button
        onClick={onClick}
        className="absolute inset-0 w-full h-full text-left focus:outline-none focus:ring-2 focus:ring-amber-500"
        title={t('cardThumbnail.edit')}
      >
        <div className="absolute inset-0 bg-white/50">
          {src && !imgError ? (
            <img
              src={src}
              alt={card.title}
              className={`w-full h-full object-contain p-2 ${card.imageFlipX ? '-scale-x-100' : ''}`}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : null}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div
          className={`absolute top-2 left-2 ${colors.badge} text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm`}
        >
          {typeLabel}
          {badge && ` · ${badge}`}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-lg">
            {withGuillemets(card.title || '') || t('cardThumbnail.untitled')}
          </h3>
          {card.description && (
            <p className="text-white/70 text-[10px] mt-1 line-clamp-1">
              {withGuillemets(card.description)}
            </p>
          )}
        </div>
      </button>

      {onDelete && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-white/90 hover:bg-red-600 hover:text-white text-red-700 shadow flex items-center justify-center opacity-70 group-hover:opacity-100 transition"
          title={t('cardThumbnail.delete')}
          aria-label={t('cardThumbnail.delete')}
        >
          🗑
        </button>
      )}

      {onDelete && confirming && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 p-3 text-center">
          <p className="text-white text-sm font-semibold">{t('cardThumbnail.confirmDelete')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded"
            >
              {t('cardThumbnail.delete')}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 text-sm rounded"
            >
              {t('cardThumbnail.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardThumbnail;
