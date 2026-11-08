export enum CardType {
  MONSTER = 'Monstre',
  CURSE = 'Malédiction',
  ITEM = 'Objet',
  CLASS = 'Classe',
  RACE = 'Race',
  LEVEL_UP = 'Gain de niveau',
  FAITHFUL_SERVANT = 'Fidèle serviteur',
  DUNGEON_TRAP = 'Piège Donjon',
  DUNGEON_BONUS = 'Bonus Donjon',
  TREASURE_TRAP = 'Piège Trésor',
  OTHER = 'Autre',
}

export type CardLayout = 'standard';

import type { PrintMode, PrintSettings } from './utils/printLayout';

export type CardLanguage = 'fr' | 'en' | 'de';

export type CardDesign = 'classic' | 'modern';

export type TextAlign = 'left' | 'right' | 'justify' | 'center';

export interface CardData {
  id: string; // Identifiant unique pour la persistance
  title: string;
  type: CardType;
  layout: CardLayout; // Nouveau champ pour le style
  level: number | '';
  bonus: number | string;
  description: string;
  badStuff: string;
  gold: string;
  imagePrePrompt: string;
  imagePrompt: string;
  imageData: string | null; // Base64 string (temporaire pour la génération)
  storedImageUrl?: string; // URL Google Drive (persistant)
  // New fields for extended editing
  itemSlot: string;
  isBig: boolean;
  restrictions: string;
  levelsGained: number | ''; // Niveaux gagnés en cas de victoire (Monstre)
  imageScale?: number; // Pourcentage de taille de l'image (défaut 100)
  imageOffsetX?: number; // Décalage horizontal en %
  imageOffsetY?: number; // Décalage vertical en %
  imageFlipX?: boolean; // Bild waagerecht spiegeln (Blickrichtung umdrehen)
  bodyFontSize?: number; // Schriftgröße des Kartentexts in px bei 661 px Kartenbreite (Standard 31)
  textAlign?: TextAlign; // Ausrichtung der Beschreibung (Standard links)
  restrictionsAlign?: TextAlign; // Ausrichtung der Einschränkungen
  badStuffAlign?: TextAlign; // Ausrichtung von "Schlimme Dinge" (Monster)
  textIndent?: boolean; // Absatz-Einzug (Standard an)
  descriptionBoxScale?: number; // Pourcentage de taille de l'encart description (défaut 100)
  isBaseCard: boolean;
  isValidated: boolean;
  internalComment: string;
}

export interface PlaceholderCardData {
  level: number;
  type: CardType;
  targetTreasures: number;
  targetLevelsGained: number;
  isPlaceholder: true;
}

export const INITIAL_CARD_DATA: CardData = {
  id: '', // Sera généré à l'initialisation
  title: 'Unsägliches Grauen',
  type: CardType.MONSTER,
  layout: 'standard',
  level: 10,
  bonus: '',
  description: 'Es bringt alles auf dem Spielteppich durcheinander.',
  badStuff: 'Verliere deine Kopfbedeckung und 2 Stufen.',
  gold: '3',
  imagePrePrompt:
    'Erzeuge eine quadratische Illustration (1:1). Der Zeichenstil soll den des Kartenspiels „Munchkin“ und des Zeichners John Kovalic perfekt nachahmen: satirischer, handgezeichneter Cartoon-Stil mit dicken schwarzen Konturen und humorvoller Fantasy-Stimmung. Das Bild zeigt ein einzelnes, freigestelltes, zentriertes Element. Auf dem Bild darf absolut kein Text sein. Der Hintergrund ist eine einfarbige, neutrale, schlichte Fläche ohne jede Kulisse oder Details. Das zu erzeugende Element:',

  imagePrompt: 'Ein lustiges Cartoon-Monster aus Spaghetti',
  imageData: null,
  storedImageUrl: '/demo/demo_card.png',
  itemSlot: '',
  isBig: false,
  restrictions: '',
  levelsGained: 1,
  imageScale: 100,
  imageOffsetX: 0,
  imageOffsetY: 0,
  descriptionBoxScale: 100,
  isBaseCard: false,
  isValidated: false,
  internalComment: '',
};

export interface GlobalSettings {
  // Custom card backs (base64 data URL or null = use default)
  customBackDonjon: string | null;
  customBackTresor: string | null;
  // Custom layouts (front faces)
  customLayoutClass: string | null;
  customLayoutRace: string | null;
  customLayoutMalediction: string | null;
  customLayoutEquipement: string | null;
  customLayoutItem: string | null;
  customLayoutLvlup: string | null;
  customLayoutMonstre: string | null;
  // Fonts per text type (Google Fonts family names)
  fontTitle: string;
  fontDescription: string;
  fontMeta: string;
  // Language for automatic labels
  language: CardLanguage;
  // Card front design ('classic' = printed-card look, 'modern' = original PNG layouts)
  cardDesign?: CardDesign;
  // Veraltet (vor Druckart): true = Rand + Pergament mitdrucken
  printFrame?: boolean;
  // Druckart: cutout = Innenfläche zum Ausschneiden, direct = auf Blanko-Karte, full = ganze Karte
  printMode?: PrintMode;
  // A4 print grid (card size, gap, printer offset) shared by test page and card PDF
  print?: PrintSettings;
  // Default pre-prompt for AI image generation
  defaultImagePrePrompt: string;
}

export const AVAILABLE_FONTS = [
  'Windlass',
  'IM Fell English SC',
  'Rye',
  'Metamorphous',
  'Caslon Antique',
  'IM Fell DW Pica',
  'IM Fell English',
  'MedievalSharp',
  'Cinzel',
  'Pirata One',
  'EB Garamond',
  'Lora',
  'Merriweather',
  'Inter',
  'Roboto',
  'Outfit',
  'Playfair Display',
  'Spectral',
] as const;

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  customBackDonjon: null,
  customBackTresor: null,
  customLayoutClass: null,
  customLayoutRace: null,
  customLayoutMalediction: null,
  customLayoutEquipement: null,
  customLayoutItem: null,
  customLayoutLvlup: null,
  customLayoutMonstre: null,
  fontTitle: 'Windlass',
  fontDescription: 'Caslon Antique',
  fontMeta: 'MedievalSharp',
  language: 'de',
  cardDesign: 'classic',
  printFrame: false,
  defaultImagePrePrompt: INITIAL_CARD_DATA.imagePrePrompt,
};
