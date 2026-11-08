import React, { useMemo } from 'react';
import { GlobalSettings, AVAILABLE_FONTS, INITIAL_CARD_DATA, CardData, CardType } from '../types';
import { useNotification } from './NotificationContext';
import CardPreview from './CardPreview';
import { AI_ENABLED } from '../utils/features';
import { useTranslation } from '../i18n/LanguageContext';

interface GlobalSettingsProps {
  settings: GlobalSettings;
  onChange: (settings: GlobalSettings) => void;
  onResetToDefaults: () => void;
}

const GlobalSettingsComponent: React.FC<GlobalSettingsProps> = ({
  settings,
  onChange,
  onResetToDefaults,
}) => {
  const { showNotification } = useNotification();
  const { t } = useTranslation();

  const DEMO_CARD: CardData = useMemo(
    () => ({
      id: 'demo-card',
      title: t('globalSettings.demoTitle'),
      type: CardType.MONSTER,
      layout: 'standard',
      level: 15,
      bonus: '+10',
      description: t('globalSettings.demoDesc'),
      badStuff: t('globalSettings.demoBadStuff'),
      gold: '3',
      imagePrePrompt: INITIAL_CARD_DATA.imagePrePrompt,
      imagePrompt: t('globalSettings.demoArtPrompt'),
      storedImageUrl: '/demo/demo_card.png',
      imageData: null,
      itemSlot: '',
      isBig: false,
      restrictions: '',
      levelsGained: 2,
      imageScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0,
      isBaseCard: false,
      isValidated: false,
      internalComment: '',
    }),
    [t],
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-amber-900/20 pb-4 gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-amber-900 flex items-center gap-2">
            <span>⚙️</span> {t('globalSettings.title')}
          </h2>
          <p className="text-amber-800/60 mt-1">{t('globalSettings.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            if (confirm(t('globalSettings.confirmReset'))) {
              onResetToDefaults();
              showNotification(t('globalSettings.resetSuccess'), 'info');
            }
          }}
          className="text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg border border-red-200 transition-colors"
        >
          {t('globalSettings.resetAll')}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* SETTINGS COLUMN */}
        <div className="flex-1 space-y-8">
          {/* 2. Fonts */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center gap-3">
              <span className="text-2xl">🔤</span>
              <div>
                <h3 className="font-bold text-stone-800">{t('globalSettings.fonts')}</h3>
                <p className="text-xs text-stone-500">{t('globalSettings.fontsDesc')}</p>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-600 uppercase">
                    {t('globalSettings.titles')}
                  </label>
                  <select
                    value={settings.fontTitle}
                    onChange={(e) => onChange({ ...settings, fontTitle: e.target.value })}
                    className="w-full p-2 rounded-lg border border-stone-200 text-sm"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-600 uppercase">
                    {t('globalSettings.description')}
                  </label>
                  <select
                    value={settings.fontDescription}
                    onChange={(e) => onChange({ ...settings, fontDescription: e.target.value })}
                    className="w-full p-2 rounded-lg border border-stone-200 text-sm"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-600 uppercase">
                  {t('globalSettings.meta')}
                </label>
                <select
                  value={settings.fontMeta}
                  onChange={(e) => onChange({ ...settings, fontMeta: e.target.value })}
                  className="w-full p-2 rounded-lg border border-stone-200 text-sm"
                >
                  {AVAILABLE_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Card design */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center gap-3">
              <span className="text-2xl">🃏</span>
              <div>
                <h3 className="font-bold text-stone-800">{t('globalSettings.cardDesign')}</h3>
                <p className="text-xs text-stone-500">{t('globalSettings.cardDesignDesc')}</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {(['classic', 'modern'] as const).map((design) => {
                  const active = (settings.cardDesign ?? 'classic') === design;
                  return (
                    <button
                      key={design}
                      onClick={() => onChange({ ...settings, cardDesign: design })}
                      className={`flex-1 text-left p-3 rounded-lg border-2 transition-all ${active ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-100 text-stone-500'}`}
                    >
                      <span className="font-bold block">
                        {t(
                          design === 'classic'
                            ? 'globalSettings.designClassic'
                            : 'globalSettings.designModern',
                        )}
                      </span>
                      <span className="text-xs">
                        {t(
                          design === 'classic'
                            ? 'globalSettings.designClassicDesc'
                            : 'globalSettings.designModernDesc',
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Language */}
          <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <h3 className="font-bold text-stone-800">{t('globalSettings.language')}</h3>
                <p className="text-xs text-stone-500">{t('globalSettings.languageDesc')}</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex gap-4">
                <button
                  onClick={() => onChange({ ...settings, language: 'fr' })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${settings.language === 'fr' ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-100 text-stone-400'}`}
                >
                  <span className="text-lg">🇫🇷</span>{' '}
                  <span className="font-bold">{t('globalSettings.french')}</span>
                </button>
                <button
                  onClick={() => onChange({ ...settings, language: 'en' })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${settings.language === 'en' ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-100 text-stone-400'}`}
                >
                  <span className="text-lg">🇬🇧</span>{' '}
                  <span className="font-bold">{t('globalSettings.english')}</span>
                </button>
                <button
                  onClick={() => onChange({ ...settings, language: 'de' })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${settings.language === 'de' ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-100 text-stone-400'}`}
                >
                  <span className="text-lg">🇩🇪</span>{' '}
                  <span className="font-bold">{t('globalSettings.german')}</span>
                </button>
              </div>
            </div>
          </section>

          {/* 4. Global Prompt */}
          {AI_ENABLED && (
            <section className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center gap-3">
                <span className="text-2xl">✏️</span>
                <div>
                  <h3 className="font-bold text-stone-800">{t('globalSettings.defaultPrompt')}</h3>
                  <p className="text-xs text-stone-500">{t('globalSettings.defaultPromptDesc')}</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <textarea
                  value={settings.defaultImagePrePrompt}
                  onChange={(e) => onChange({ ...settings, defaultImagePrePrompt: e.target.value })}
                  className="w-full h-24 p-3 text-sm rounded-lg border border-stone-200 outline-none resize-none"
                  placeholder={t('globalSettings.promptPlaceholder')}
                />
                <button
                  onClick={() => {
                    onChange({
                      ...settings,
                      defaultImagePrePrompt: INITIAL_CARD_DATA.imagePrePrompt,
                    });
                    showNotification(t('globalSettings.promptReset'), 'info');
                  }}
                  className="text-xs text-stone-500 underline flex ml-auto"
                >
                  {t('globalSettings.reset')}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* PREVIEW COLUMN (STICKY) */}
        <div className="w-full lg:w-[450px]">
          <div className="lg:sticky lg:top-8 space-y-4">
            <div className="bg-amber-900/5 rounded-2xl p-6 border-2 border-dashed border-amber-900/20">
              <h3 className="text-center font-bold text-amber-900 mb-4 uppercase text-sm tracking-widest">
                {t('globalSettings.livePreview')}
              </h3>
              <div className="scale-75 md:scale-90 origin-top flex justify-center">
                <CardPreview data={DEMO_CARD} globalSettings={settings} index={0} />
              </div>
              <p className="text-center text-[10px] text-amber-800/40 mt-4 italic font-medium px-4">
                {t('globalSettings.previewHint')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="py-12 italic text-xs text-stone-400 text-center">
        {t('globalSettings.autoSave')}
      </div>
    </div>
  );
};

export default GlobalSettingsComponent;
