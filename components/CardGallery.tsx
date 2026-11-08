import React, { useState, useMemo } from 'react';
import { CardData, CardType, GlobalSettings } from '../types';
import CardThumbnail from './CardThumbnail';
import BatchExportRenderer from './BatchExportRenderer';
import BatchPdfExportRenderer from './BatchPdfExportRenderer';
import { getCardCategory } from '../utils/layoutUtils';
import { cardTypeKey, translateItemSlotFor } from '../utils/cardLabels';
import { useTranslation } from '../i18n/LanguageContext';

/**
 * Galerie: zeigt nur die gespeicherten Karten (keine Platzhalter, kein Deck-Ziel),
 * gruppiert nach Kartentyp, Gegenstände zusätzlich nach Slot. Karten lassen sich hier löschen.
 */
interface CardGalleryProps {
  cards: CardData[];
  onSelectCard: (card: CardData) => void;
  onNewCard: (initialData?: Partial<CardData>) => void;
  onDeleteCard: (card: CardData) => void;
  isLoading: boolean;
  selectedCardId?: string;
  globalSettings: GlobalSettings;
}

const CARD_TYPE_ORDER: CardType[] = [
  CardType.MONSTER,
  CardType.CURSE,
  CardType.ITEM,
  CardType.CLASS,
  CardType.RACE,
  CardType.LEVEL_UP,
  CardType.FAITHFUL_SERVANT,
  CardType.DUNGEON_TRAP,
  CardType.DUNGEON_BONUS,
  CardType.TREASURE_TRAP,
  CardType.OTHER,
];

const ITEM_SLOT_ORDER = [
  'Monture',
  'Amélioration de Monture',
  'Couvre-chef',
  'Armure',
  'Chaussures',
  '1 Main',
  '2 Mains',
  'NoSlot',
  'Amélioration',
  'Usage Unique',
  '', // Einmalig
];

const SECTION_STYLE: Partial<Record<CardType, { bg: string; border: string; header: string }>> = {
  [CardType.MONSTER]: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-700' },
  [CardType.CURSE]: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-700' },
  [CardType.ITEM]: { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-700' },
  [CardType.CLASS]: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-700' },
  [CardType.RACE]: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-700' },
};
const DEFAULT_STYLE = { bg: 'bg-stone-50', border: 'border-stone-200', header: 'bg-stone-600' };

const levelOf = (c: CardData) => (typeof c.level === 'number' ? c.level : 0);

const CardGallery: React.FC<CardGalleryProps> = ({
  cards,
  onSelectCard,
  onNewCard,
  onDeleteCard,
  isLoading,
  selectedCardId,
  globalSettings,
}) => {
  const { t, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterImage, setFilterImage] = useState<'all' | 'with' | 'without'>('all');
  const [sortByLevel, setSortByLevel] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<CardType>>(new Set());
  const [exportMode, setExportMode] = useState<'all' | 'Donjon' | 'Tresor'>('all');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const typeLabel = (type: CardType) => t(`cardTypes.${cardTypeKey(type)}`);
  const slotLabel = (slot: string) =>
    slot === ''
      ? t('cardGallery.slotOneShot')
      : slot === 'NoSlot'
        ? t('cardGallery.slotNoSlot')
        : translateItemSlotFor(slot, language);

  const filteredCards = useMemo(() => {
    let result = cards;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (c) =>
          (c.title || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.internalComment || '').toLowerCase().includes(q),
      );
    }
    if (filterImage === 'with') result = result.filter((c) => c.imageData || c.storedImageUrl);
    if (filterImage === 'without') result = result.filter((c) => !c.imageData && !c.storedImageUrl);
    return result;
  }, [cards, searchQuery, filterImage]);

  const sorted = (list: CardData[]) =>
    sortByLevel ? [...list].sort((a, b) => levelOf(a) - levelOf(b)) : list;

  const byType = useMemo(() => {
    const map = new Map<CardType, CardData[]>();
    for (const c of filteredCards) {
      const type = CARD_TYPE_ORDER.includes(c.type) ? c.type : CardType.OTHER;
      map.set(type, [...(map.get(type) || []), c]);
    }
    return map;
  }, [filteredCards]);

  const exportCards = filteredCards.filter(
    (c) => exportMode === 'all' || getCardCategory(c) === exportMode,
  );

  const toggle = (type: CardType) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const renderGrid = (list: CardData[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {sorted(list).map((card) => (
        <CardThumbnail
          key={card.id}
          card={card}
          typeLabel={typeLabel(card.type)}
          onClick={() => onSelectCard(card)}
          onDelete={() => onDeleteCard(card)}
          isSelected={card.id === selectedCardId}
        />
      ))}
    </div>
  );

  const countText = (n: number) =>
    `${n} ${n === 1 ? t('cardGallery.cardWord') : t('cardGallery.cardWordPlural')}`;

  const startExport = (kind: 'zip' | 'pdf') => {
    if (exportCards.length === 0) {
      alert(t('cardGallery.noTypeToExport'));
      return;
    }
    setExportProgress({ current: 0, total: exportCards.length });
    if (kind === 'zip') setIsExportingZip(true);
    else setIsExportingPdf(true);
  };

  const exportOverlay = (title: string, onCancel: () => void) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm w-full text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
          <div
            className="bg-amber-700 h-full transition-all duration-300 ease-out"
            style={{
              width: `${(exportProgress.current / (exportProgress.total || 1)) * 100}%`,
            }}
          />
        </div>
        <div className="text-sm text-gray-600">
          {t('cardGallery.exportProgressCard', {
            current: exportProgress.current,
            total: exportProgress.total,
          })}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow transition-colors"
        >
          ✕ {t('cardGallery.cancelExport')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full">
      {/* Kopfleiste */}
      <div className="sticky top-0 z-20 bg-stone-100/95 backdrop-blur-sm border-b border-stone-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('cardGallery.searchPlaceholder')}
              className="flex-grow px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white shadow-sm"
            />
            <button
              onClick={() => onNewCard()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg shadow-md transition-colors whitespace-nowrap"
            >
              ➕ {t('cardGallery.newCard')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span className="font-medium">
              {filteredCards.length === cards.length
                ? countText(cards.length)
                : `${countText(filteredCards.length)} ${t('cardGallery.cardsFiltered')}`}
            </span>
            <select
              value={filterImage}
              onChange={(e) => setFilterImage(e.target.value as 'all' | 'with' | 'without')}
              className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">{t('cardGallery.imageAll')}</option>
              <option value="with">{t('cardGallery.withImage')}</option>
              <option value="without">{t('cardGallery.withoutImage')}</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sortByLevel}
                onChange={(e) => setSortByLevel(e.target.checked)}
                className="w-4 h-4 accent-amber-700"
              />
              {t('cardGallery.sortByLevel')}
            </label>

            {filteredCards.length > 0 && (
              <div className="flex items-center gap-2 sm:ml-auto">
                <select
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value as 'all' | 'Donjon' | 'Tresor')}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
                  disabled={isExportingZip || isExportingPdf}
                >
                  <option value="all">{t('cardGallery.exportAll')}</option>
                  <option value="Donjon">{t('cardGallery.exportDungeon')}</option>
                  <option value="Tresor">{t('cardGallery.exportTreasure')}</option>
                </select>
                <button
                  onClick={() => startExport('zip')}
                  disabled={isExportingZip || isExportingPdf}
                  className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium"
                  title={t('cardGallery.exportZipTitle')}
                >
                  {t('cardGallery.exportZipButton')}
                </button>
                <button
                  onClick={() => startExport('pdf')}
                  disabled={isExportingZip || isExportingPdf}
                  className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium"
                  title={t('cardGallery.exportPdfTitle')}
                >
                  {t('cardGallery.exportPdfButton')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-700 border-t-transparent"></div>
            <p className="text-gray-600 font-medium">{t('cardGallery.loading')}</p>
          </div>
        </div>
      )}

      {!isLoading && cards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-6xl mb-4">🃏</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">
            {t('cardGallery.noCardsCreated')}
          </h3>
          <p className="text-gray-500 text-center mb-6 max-w-md">{t('cardGallery.noCardsDesc')}</p>
          <button
            onClick={() => onNewCard()}
            className="px-6 py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg shadow-lg"
          >
            ➕ {t('cardGallery.createFirstCard')}
          </button>
        </div>
      )}

      {!isLoading && cards.length > 0 && filteredCards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <h3 className="text-xl font-bold text-gray-700 mb-2">{t('cardGallery.noResults')}</h3>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterImage('all');
            }}
            className="text-amber-700 hover:text-amber-800 font-medium underline"
          >
            {t('cardGallery.clearSearch')}
          </button>
        </div>
      )}

      {!isLoading && filteredCards.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {CARD_TYPE_ORDER.map((type) => {
            const list = byType.get(type) || [];
            if (list.length === 0) return null;
            const style = SECTION_STYLE[type] || DEFAULT_STYLE;
            const isCollapsed = collapsed.has(type);
            return (
              <section
                key={type}
                className={`rounded-xl overflow-hidden border-2 ${style.border} ${style.bg} shadow-sm`}
              >
                <button
                  onClick={() => toggle(type)}
                  className={`w-full flex items-center justify-between px-4 py-3 ${style.header} text-white font-bold text-lg hover:brightness-110`}
                >
                  <span>
                    {typeLabel(type)}{' '}
                    <span className="font-normal opacity-80">({list.length})</span>
                  </span>
                  <span className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                    ▾
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="p-4 space-y-4">
                    {type === CardType.ITEM
                      ? ITEM_SLOT_ORDER.map((slot) => {
                          const slotCards = list.filter((c) =>
                            ITEM_SLOT_ORDER.includes(c.itemSlot || '')
                              ? (c.itemSlot || '') === slot
                              : slot === 'NoSlot',
                          );
                          if (slotCards.length === 0) return null;
                          return (
                            <div key={slot || 'oneshot'} className="space-y-2">
                              <div className="px-2 py-1.5 bg-amber-100 border-l-4 border-amber-700 rounded text-sm font-semibold text-amber-900">
                                {slotLabel(slot)}{' '}
                                <span className="font-normal text-amber-700">
                                  ({slotCards.length})
                                </span>
                              </div>
                              {renderGrid(slotCards)}
                            </div>
                          );
                        })
                      : renderGrid(list)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {isExportingZip && (
        <>
          {exportOverlay(t('cardGallery.exportingZip'), () => setIsExportingZip(false))}
          <BatchExportRenderer
            cards={exportCards}
            onComplete={() => setIsExportingZip(false)}
            onProgress={(current, total) => setExportProgress({ current, total })}
            globalSettings={globalSettings}
          />
        </>
      )}
      {isExportingPdf && (
        <>
          {exportOverlay(t('cardGallery.exportingPdf'), () => setIsExportingPdf(false))}
          <BatchPdfExportRenderer
            cards={exportCards}
            onComplete={() => setIsExportingPdf(false)}
            onProgress={(current, total) => setExportProgress({ current, total })}
            globalSettings={globalSettings}
          />
        </>
      )}
    </div>
  );
};

export default CardGallery;
