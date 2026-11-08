import { CardLanguage } from '../types';

/**
 * Labels printed on the cards themselves (depend on the "game language" setting,
 * not on the UI language). Item slot values are stored internally in French.
 */
export const CARD_LABELS: Record<
  CardLanguage,
  {
    badStuff: string;
    levels: string;
    big: string;
    enhancement: string;
    forSteed: string;
  }
> = {
  fr: {
    badStuff: 'Incident Fâcheux : ',
    levels: 'niveaux',
    big: 'Gros',
    enhancement: 'Amélioration',
    forSteed: 'de Monture',
  },
  en: {
    badStuff: 'Bad Stuff: ',
    levels: 'levels',
    big: 'Big',
    enhancement: 'Enhancement',
    forSteed: 'for Steed',
  },
  de: {
    badStuff: 'Schlimme Dinge: ',
    levels: 'Stufen',
    big: 'Groß',
    enhancement: 'Verbesserung',
    forSteed: 'für Reittier',
  },
};

const ITEM_SLOT_LABELS: Record<Exclude<CardLanguage, 'fr'>, Record<string, string>> = {
  en: {
    'Usage Unique': 'One-shot',
    '1 Main': '1 Hand',
    '2 Mains': '2 Hands',
    'Couvre-chef': 'Headgear',
    Chaussures: 'Footgear',
    Armure: 'Armor',
    Monture: 'Steed',
    Amélioration: 'Enhancement',
    'Amélioration de Monture': 'Steed Enhancement',
  },
  de: {
    'Usage Unique': 'Einmalig',
    '1 Main': '1 Hand',
    '2 Mains': '2 Hände',
    'Couvre-chef': 'Kopfbedeckung',
    Chaussures: 'Schuhwerk',
    Armure: 'Rüstung',
    Monture: 'Reittier',
    Amélioration: 'Verbesserung',
    'Amélioration de Monture': 'Reittier-Verbesserung',
  },
};

/** Translates an internal (French) item slot value into the given language. */
export function translateItemSlotFor(slot: string, language: CardLanguage | undefined): string {
  if (!language || language === 'fr') return slot;
  return ITEM_SLOT_LABELS[language][slot] || slot;
}
