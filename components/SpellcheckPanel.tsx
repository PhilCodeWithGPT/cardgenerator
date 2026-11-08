import React, { useState } from 'react';
import { CardData } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { SPELL_FIELDS, SpellField, SpellResult } from '../services/spellcheck';
import { diffWords, keepLineIndent } from '../utils/textDiff';

interface SpellcheckPanelProps {
  card: CardData;
  result: SpellResult;
  onApply: (updates: Partial<CardData>) => void;
  onClose: () => void;
}

/** Vorlesen über die Sprachausgabe des Geräts (hilft bei LRS). */
const speak = (text: string) => {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[»«›‹]/g, ''));
    u.lang = 'de-DE';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    /* keine Sprachausgabe verfügbar */
  }
};

/**
 * Ergebnis der Rechtschreibprüfung: je Feld vorher/nachher mit markierten Änderungen,
 * kurze Erklärungen in einfacher Sprache, Übernehmen je Feld (Standard: alle an).
 */
const SpellcheckPanel: React.FC<SpellcheckPanelProps> = ({ card, result, onApply, onClose }) => {
  const { t } = useTranslation();

  const corrected = (f: SpellField) => keepLineIndent(card[f] ?? '', result[f] ?? '');
  const changedFields = SPELL_FIELDS.filter((f) => (card[f] ?? '') !== corrected(f));
  const [selected, setSelected] = useState<Set<SpellField>>(new Set(changedFields));

  const apply = () => {
    const updates: Partial<CardData> = {};
    selected.forEach((f) => (updates[f] = corrected(f)));
    onApply(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-stone-800">✨ {t('spellcheck.title')}</h3>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-stone-500 hover:text-stone-800"
            aria-label={t('spellcheck.cancel')}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-5 text-lg leading-relaxed">
          {changedFields.length === 0 ? (
            <p className="text-green-700 font-bold text-xl">👍 {t('spellcheck.allGood')}</p>
          ) : (
            changedFields.map((f) => {
              const parts = diffWords(card[f] ?? '', corrected(f));
              const whys = result.changes.filter((c) => c.field === f && c.why);
              return (
                <div key={f} className="border border-stone-200 rounded-lg p-4">
                  <label className="flex items-center gap-2 mb-2 text-sm font-bold text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-green-700"
                      checked={selected.has(f)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(f);
                          else next.delete(f);
                          return next;
                        })
                      }
                    />
                    {t(`spellcheck.field.${f}`)} – {t('spellcheck.take')}
                  </label>
                  <p className="whitespace-pre-wrap text-stone-800">
                    {parts.map((p, i) =>
                      p.type === 'same' ? (
                        <span key={i}>{p.text}</span>
                      ) : p.type === 'del' ? (
                        <span key={i} className="bg-red-100 text-red-700 line-through">
                          {p.text}
                        </span>
                      ) : (
                        <span key={i} className="bg-green-100 text-green-800 font-bold">
                          {p.text}
                        </span>
                      ),
                    )}
                  </p>
                  {whys.length > 0 && (
                    <ul className="mt-3 space-y-1 text-base text-stone-700">
                      {whys.map((c, i) => (
                        <li key={i}>
                          <span className="text-red-700 line-through">{c.before}</span> →{' '}
                          <span className="text-green-800 font-bold">{c.after}</span>: {c.why}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => speak(corrected(f))}
                    className="mt-3 text-sm px-3 py-1 rounded border border-stone-300 hover:bg-stone-50"
                  >
                    🔊 {t('spellcheck.readAloud')}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50"
          >
            {changedFields.length === 0 ? t('spellcheck.close') : t('spellcheck.cancel')}
          </button>
          {changedFields.length > 0 && (
            <button
              onClick={apply}
              disabled={selected.size === 0}
              className="px-5 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold disabled:opacity-50"
            >
              ✓ {t('spellcheck.apply')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpellcheckPanel;
